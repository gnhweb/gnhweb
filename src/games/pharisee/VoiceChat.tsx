import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { GameManager } from "./GameManager";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type VoiceSignal = {
  room: string;
  phase: string;
  senderId: string;
  targetId?: string;
  kind: "hello" | "offer" | "answer" | "ice" | "bye";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

function phaseVoiceEnabled(gm: GameManager) {
  if (gm.phase === "day-discuss") return !!gm.me?.alive || gm.isSpectator;
  if (gm.phase === "night") return gm.isPhariseeSide;
  return false;
}

export default function VoiceChat({ gm }: { gm: GameManager }) {
  const enabled = phaseVoiceEnabled(gm);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakingFrameRef = useRef<number | null>(null);

  const voiceRoom = useMemo(
    () => `pharisee-voice-${gm.roomCode}-${gm.phase}-${gm.phaseEndsAt}`,
    [gm.roomCode, gm.phase, gm.phaseEndsAt],
  );

  const sendSignal = async (payload: Omit<VoiceSignal, "room" | "phase" | "senderId">) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({
      type: "broadcast",
      event: "voice_signal",
      payload: {
        ...payload,
        room: gm.roomCode,
        phase: gm.phase,
        senderId: gm.userId,
      } satisfies VoiceSignal,
    });
  };

  const attachAudio = (peerId: string, stream: MediaStream) => {
    let audio = audioRefs.current.get(peerId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      audio.playsInline = true;
      audioRefs.current.set(peerId, audio);
    }
    audio.srcObject = stream;
    audio.muted = speakerMuted;
    void audio.play().catch(() => {
      // iOS may wait for a user gesture; the next explicit interaction retries playback.
    });
  };

  const updatePeerCount = () => setPeerCount([...peersRef.current.values()].filter((pc) => pc.connectionState !== "closed").length);

  const cleanupPeer = (peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) pc.close();
    peersRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    audioRefs.current.get(peerId)?.pause();
    audioRefs.current.delete(peerId);
    updatePeerCount();
  };

  const createPeer = async (peerId: string, initiator: boolean) => {
    if (!active || peerId === gm.userId || peersRef.current.has(peerId)) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(peerId, pc);
    updatePeerCount();

    const stream = localStreamRef.current;
    stream?.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal({ kind: "ice", targetId: peerId, candidate: event.candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) attachAudio(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) cleanupPeer(peerId);
      else updatePeerCount();
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal({ kind: "offer", targetId: peerId, description: offer });
    }

    return pc;
  };

  const flushPendingIce = async (peerId: string, pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current.get(peerId) ?? [];
    pendingIceRef.current.delete(peerId);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore a stale ICE candidate from a connection that is already closing.
      }
    }
  };

  const start = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("이 브라우저에서는 마이크 기능을 사용할 수 없습니다.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => { track.enabled = true; });
      setMuted(false);
      setActive(true);

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "마이크를 사용할 수 없습니다.");
    }
  };

  const stop = async () => {
    for (const peerId of peersRef.current.keys()) {
      void sendSignal({ kind: "bye", targetId: peerId });
      cleanupPeer(peerId);
    }
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (speakingFrameRef.current) cancelAnimationFrame(speakingFrameRef.current);
    speakingFrameRef.current = null;
    analyserRef.current = null;
    await audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setActive(false);
    setSpeaking(false);
  };

  useEffect(() => {
    if (!enabled) {
      void stop();
      return;
    }

    const channel = supabase.channel(voiceRoom, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    const onSignal = async ({ payload }: { payload: VoiceSignal }) => {
      if (!payload || payload.room !== gm.roomCode || payload.phase !== gm.phase || payload.senderId === gm.userId) return;
      if (payload.targetId && payload.targetId !== gm.userId) return;

      if (payload.kind === "hello") {
        if (!active) return;
        if (gm.userId < payload.senderId) await createPeer(payload.senderId, true);
        return;
      }

      if (payload.kind === "bye") {
        cleanupPeer(payload.senderId);
        return;
      }

      if (!active) return;

      if (payload.kind === "offer" && payload.description) {
        const pc = (await createPeer(payload.senderId, false)) ?? peersRef.current.get(payload.senderId);
        if (!pc) return;
        await pc.setRemoteDescription(payload.description);
        await flushPendingIce(payload.senderId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ kind: "answer", targetId: payload.senderId, description: answer });
        return;
      }

      if (payload.kind === "answer" && payload.description) {
        const pc = peersRef.current.get(payload.senderId);
        if (!pc) return;
        await pc.setRemoteDescription(payload.description);
        await flushPendingIce(payload.senderId, pc);
        return;
      }

      if (payload.kind === "ice" && payload.candidate) {
        const pc = peersRef.current.get(payload.senderId);
        if (!pc || !pc.remoteDescription) {
          const queue = pendingIceRef.current.get(payload.senderId) ?? [];
          queue.push(payload.candidate);
          pendingIceRef.current.set(payload.senderId, queue);
          return;
        }
        try { await pc.addIceCandidate(payload.candidate); } catch { /* stale ICE */ }
      }
    };

    channel.on("broadcast", { event: "voice_signal" }, onSignal).subscribe((status) => {
      if (status === "SUBSCRIBED") void channel.send({ type: "broadcast", event: "voice_signal", payload: { room: gm.roomCode, phase: gm.phase, senderId: gm.userId, kind: "hello" } satisfies VoiceSignal });
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
      void stop();
    };
    // phaseEndsAt intentionally causes a fresh voice room each phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, voiceRoom]);

  useEffect(() => {
    if (!active) return;
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const delta = (value - 128) / 128;
        sum += delta * delta;
      }
      setSpeaking(Math.sqrt(sum / data.length) > 0.045);
      speakingFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (speakingFrameRef.current) cancelAnimationFrame(speakingFrameRef.current);
      speakingFrameRef.current = null;
      setSpeaking(false);
    };
  }, [active]);

  useEffect(() => {
    audioRefs.current.forEach((audio) => {
      audio.muted = speakerMuted;
      if (!speakerMuted) void audio.play().catch(() => undefined);
    });
  }, [speakerMuted]);

  const toggleMic = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMuted(!next);
  };

  if (!enabled) return null;

  return (
    <div className="mt-2 rounded-2xl border border-sky-800/50 bg-slate-950/95 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-bold text-sky-200">🎙️ 음성 토론</p>
          <p className="text-[10px] text-gray-500 truncate">
            {gm.phase === "night" ? "바리새인 비밀 음성방" : "생존자 음성 토론방"}
            {active ? ` · ${peerCount}명 연결` : " · 아직 시작하지 않았어요"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {active && (
            <>
              <button onClick={toggleMic} className={`w-10 h-10 rounded-full flex items-center justify-center border ${muted ? "bg-rose-900/70 border-rose-700 text-rose-200" : "bg-emerald-900/60 border-emerald-700 text-emerald-200"}`} aria-label={muted ? "마이크 켜기" : "마이크 끄기"}>
                {muted ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button onClick={() => setSpeakerMuted((v) => !v)} className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-900 border border-gray-700 text-gray-200" aria-label={speakerMuted ? "스피커 켜기" : "스피커 끄기"}>
                {speakerMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <button onClick={() => void stop()} className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-900 border border-gray-700 text-gray-300" aria-label="음성 나가기">
                <PhoneOff size={17} />
              </button>
            </>
          )}
          {!active && (
            <button onClick={() => void start()} className="min-h-10 px-4 rounded-full bg-sky-700 hover:bg-sky-600 text-xs font-bold text-white">
              🎙️ 음성 시작
            </button>
          )}
        </div>
      </div>
      {active && (
        <div className="px-3 pb-2.5">
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span className={`w-2 h-2 rounded-full ${speaking && !muted ? "bg-emerald-400 animate-pulse" : "bg-gray-700"}`} />
            {speaking && !muted ? "말하는 중" : "마이크 대기 중"}
            <span className="ml-auto">iPhone에서는 음성 시작을 한 번 눌러주세요.</span>
          </div>
        </div>
      )}
      {error && <p className="px-3 pb-3 text-[10px] text-rose-300">{error}</p>}
    </div>
  );
}
