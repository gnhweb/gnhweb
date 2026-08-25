import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { GameManager } from "./GameManager";
import { isPhariseeAlignedForWin } from "./types";
import { getScriptureTrialForRound } from "./scriptureTrials";

interface LegendLayerProps { gm: GameManager }
interface CounselMsg { id: string; senderId: string; senderName: string; text: string; round: number }
interface TrustMap { trust: Record<string, number>; doubt: Record<string, number> }

const COUNSEL_EVENT = "legend_counsel";
const SCRIPTURE_EVENT = "legend_scripture_answer";
const TRUST_EVENT = "legend_trust_vote";
const CHANNEL_PREFIX = "pharisee-legend-";

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

export default function LegendLayer({ gm }: LegendLayerProps) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"scripture" | "mind" | "season">("scripture");
  const [counsel, setCounsel] = useState<CounselMsg[]>([]);
  const [counselText, setCounselText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealedCounts, setRevealedCounts] = useState<Record<string, number> | null>(null);
  const [trustMap, setTrustMap] = useState<TrustMap>({ trust: {}, doubt: {} });
  const [myTrustTarget, setMyTrustTarget] = useState<string | null>(null);
  const [myDoubtTarget, setMyDoubtTarget] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const processedGameRef = useRef<string>("");

  const trial = useMemo(() => getScriptureTrialForRound(gm.round), [gm.round]);
  const myId = gm.userId;
  const me = gm.me;
  const alive = gm.alivePlayers;
  const phariseeSide = isPhariseeAlignedForWin(gm.myRole);
  const gameKey = `${gm.roomCode}-${gm.round}`;
  const everyoneAnswered = Object.keys(answers).filter((id) => alive.some((p) => p.id === id)).length >= alive.length;

  useEffect(() => {
    const channel = supabase.channel(`${CHANNEL_PREFIX}${gm.roomCode}`);
    channel
      .on("broadcast", { event: COUNSEL_EVENT }, ({ payload }) => {
        if (payload?.round !== gm.round) return;
        setCounsel((prev) => prev.some((m) => m.id === payload.id) ? prev : [...prev, payload as CounselMsg].slice(-30));
      })
      .on("broadcast", { event: SCRIPTURE_EVENT }, ({ payload }) => {
        if (payload?.round !== gm.round) return;
        setAnswers((prev) => ({ ...prev, [payload.userId]: payload.optionId }));
      })
      .on("broadcast", { event: TRUST_EVENT }, ({ payload }) => {
        if (payload?.round !== gm.round) return;
        setTrustMap((prev) => {
          const trust = { ...prev.trust };
          const doubt = { ...prev.doubt };
          if (payload.kind === "trust") trust[payload.targetId] = (trust[payload.targetId] || 0) + 1;
          if (payload.kind === "doubt") doubt[payload.targetId] = (doubt[payload.targetId] || 0) + 1;
          return { trust, doubt };
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gm.roomCode, gm.round]);

  useEffect(() => {
    setAnswers({});
    setRevealedCounts(null);
    setTrustMap({ trust: {}, doubt: {} });
    setMyTrustTarget(null);
    setMyDoubtTarget(null);
    setCounsel([]);
  }, [gm.round]);

  useEffect(() => {
    if (gm.phase !== "day-discuss") return;
    const timer = window.setTimeout(() => {
      const counts: Record<string, number> = {};
      Object.values(answers).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      setRevealedCounts(counts);
    }, Math.max(2500, gm.phaseEndsAt - Date.now() > 6500 ? 5000 : 0));
    return () => window.clearTimeout(timer);
  }, [gm.phase, gm.round, gm.phaseEndsAt, answers]);

  useEffect(() => {
    if (!me || gm.phase === "lobby") return;
    const load = async () => {
      const { data } = await supabase
        .from("pharisee_legend_meta")
        .select("*")
        .eq("user_id", myId)
        .maybeSingle();
      setMeta(data || { user_id: myId, user_name: gm.userName, prestige: 0, reputation: 0, games: 0, wins: 0, mvps: 0, scripture_trials: 0, clutch_votes: 0 });
    };
    load();
  }, [gm.phase, myId, gm.userName]);

  useEffect(() => {
    if (gm.phase !== "ended") return;
    const key = `${gm.roomCode}-ended`;
    if (processedGameRef.current === key) return;
    processedGameRef.current = key;
    const won = gm.winner === "citizen" ? !isPhariseeAlignedForWin(gm.myRole) : isPhariseeAlignedForWin(gm.myRole);
    const scriptureBonus = Object.prototype.hasOwnProperty.call(answers, myId) ? 5 : 0;
    const prestigeDelta = (won ? 30 : 10) + scriptureBonus + (myTrustTarget ? 2 : 0) + (myDoubtTarget ? 2 : 0);
    const reputationDelta = won ? 3 : 1;
    const save = async () => {
      const current = meta || { prestige: 0, reputation: 0, games: 0, wins: 0, mvps: 0, scripture_trials: 0, clutch_votes: 0 };
      const next = {
        user_id: myId,
        user_name: gm.userName,
        season_year: new Date().getFullYear(),
        prestige: Number(current.prestige || 0) + prestigeDelta,
        reputation: clamp(Number(current.reputation || 0) + reputationDelta, 0, 999),
        games: Number(current.games || 0) + 1,
        wins: Number(current.wins || 0) + (won ? 1 : 0),
        mvps: Number(current.mvps || 0),
        scripture_trials: Number(current.scripture_trials || 0) + (scriptureBonus ? 1 : 0),
        clutch_votes: Number(current.clutch_votes || 0) + (myDoubtTarget ? 1 : 0),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from("pharisee_legend_meta").upsert(next, { onConflict: "user_id" });
      setMeta(next);
    };
    save();
  }, [gm.phase, gm.winner, gm.myRole, gm.roomCode]);

  const sendCounsel = async () => {
    if (!phariseeSide || gm.phase !== "night" || !counselText.trim()) return;
    const msg: CounselMsg = { id: `${myId}-${Date.now()}`, senderId: myId, senderName: gm.userName, text: counselText.trim().slice(0, 140), round: gm.round };
    setCounsel((prev) => [...prev, msg].slice(-30));
    await supabase.channel(`${CHANNEL_PREFIX}${gm.roomCode}`).send({ type: "broadcast", event: COUNSEL_EVENT, payload: msg });
    setCounselText("");
  };

  const answerScripture = async (optionId: string) => {
    if (gm.phase !== "day-discuss" || !me?.alive || answers[myId]) return;
    setAnswers((prev) => ({ ...prev, [myId]: optionId }));
    await supabase.channel(`${CHANNEL_PREFIX}${gm.roomCode}`).send({ type: "broadcast", event: SCRIPTURE_EVENT, payload: { userId: myId, optionId, round: gm.round } });
  };

  const voteTrust = async (kind: "trust" | "doubt", targetId: string) => {
    if (gm.phase !== "day-discuss" || !me?.alive || targetId === myId) return;
    if (kind === "trust" && myTrustTarget) return;
    if (kind === "doubt" && myDoubtTarget) return;
    if (kind === "trust") setMyTrustTarget(targetId); else setMyDoubtTarget(targetId);
    await supabase.channel(`${CHANNEL_PREFIX}${gm.roomCode}`).send({ type: "broadcast", event: TRUST_EVENT, payload: { voterId: myId, targetId, kind, round: gm.round } });
  };

  if (gm.phase === "ended") {
    const prestige = Number(meta?.prestige || 0);
    const rank = prestige >= 500 ? "전설의 서기관" : prestige >= 250 ? "말씀의 전략가" : prestige >= 100 ? "분별의 수련자" : "새로운 제자";
    return (
      <div className="mt-3 w-full rounded-2xl border border-amber-700/40 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 text-white shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-[11px] uppercase tracking-[0.18em] text-amber-400">LEGEND PROFILE</p><p className="font-bold text-lg">{rank}</p></div>
          <div className="text-right"><p className="text-xs text-gray-500">명성</p><p className="text-2xl font-black text-amber-300">{prestige}</p></div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          <div className="rounded-xl bg-gray-900 p-2"><p className="text-[10px] text-gray-500">게임</p><p className="font-bold">{meta?.games ?? 0}</p></div>
          <div className="rounded-xl bg-gray-900 p-2"><p className="text-[10px] text-gray-500">승리</p><p className="font-bold text-emerald-300">{meta?.wins ?? 0}</p></div>
          <div className="rounded-xl bg-gray-900 p-2"><p className="text-[10px] text-gray-500">말씀</p><p className="font-bold">{meta?.scripture_trials ?? 0}</p></div>
          <div className="rounded-xl bg-gray-900 p-2"><p className="text-[10px] text-gray-500">평판</p><p className="font-bold">{meta?.reputation ?? 0}</p></div>
        </div>
      </div>
    );
  }

  if (gm.phase === "night" && !gm.isSpectator) {
    return (
      <div className="mt-3 w-full rounded-2xl border border-indigo-800/50 bg-gray-950/95 shadow-xl overflow-hidden">
        <button onClick={() => setOpen((v) => !v)} className="w-full px-4 py-3 flex items-center justify-between text-left">
          <span className="text-sm font-bold text-indigo-200">🌙 비밀 작전실 {phariseeSide ? "· 바리새인 연합" : ""}</span><span className="text-xs text-gray-500">{open ? "접기" : "열기"}</span>
        </button>
        {open && (
          <div className="p-3 border-t border-gray-800">
            {phariseeSide ? <>
              <p className="text-[11px] text-gray-500 mb-2">이번 밤, 서로의 판단을 맞춰보세요. 메시지는 게임 화면에만 표시됩니다.</p>
              <div className="h-28 overflow-y-auto space-y-1 mb-2">{counsel.length ? counsel.map((m) => <p key={m.id} className="text-xs"><span className="text-rose-300 font-semibold">{m.senderName}</span><span className="text-gray-400"> · {m.text}</span></p>) : <p className="text-xs text-gray-600">아직 비밀 작전이 없습니다.</p>}</div>
              <div className="flex gap-2"><input value={counselText} onChange={(e) => setCounselText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCounsel()} maxLength={140} placeholder="누구를 의심할지 짧게 상의..." className="flex-1 rounded-xl bg-gray-900 border border-gray-800 px-3 py-2 text-xs outline-none focus:border-rose-600"/><button onClick={sendCounsel} className="rounded-xl px-3 bg-rose-800 text-xs">전송</button></div>
            </> : <p className="text-xs text-gray-400 leading-relaxed">오늘 밤은 말보다 행동을 지켜보세요. 아침에 말씀 사건이 당신의 판단을 흔들 수 있습니다.</p>}
          </div>
        )}
      </div>
    );
  }

  if (gm.phase !== "day-discuss" || !me?.alive) return null;

  const trustLeaders = Object.entries(trustMap.trust).sort((a,b) => b[1]-a[1]).slice(0,2);
  const doubtLeaders = Object.entries(trustMap.doubt).sort((a,b) => b[1]-a[1]).slice(0,2);

  return (
    <div className="mt-3 w-full rounded-2xl border border-amber-800/40 bg-gray-950/95 shadow-xl overflow-hidden">
      <div className="flex gap-1 p-2 bg-gray-900">
        {[['scripture','📖 말씀 사건'],['mind','🧠 심리전'],['season','🏆 명성']].map(([id,label]) => <button key={id} onClick={() => setTab(id as any)} className={`flex-1 rounded-lg py-2 text-xs ${tab===id?'bg-amber-800 text-white':'text-gray-500'}`}>{label}</button>)}
      </div>
      {tab === "scripture" && <div className="p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-500">SCRIPTURE TRIAL · {gm.round}</p>
        <p className="text-xs text-amber-200 mt-1">{trial.reference}</p>
        <p className="text-sm font-semibold mt-1">{trial.question}</p>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{trial.situation}</p>
        <div className="mt-3 space-y-2">{trial.options.map((o) => <button key={o.id} disabled={!!answers[myId]} onClick={() => answerScripture(o.id)} className={`w-full rounded-xl p-3 text-left border ${answers[myId]===o.id?'border-amber-500 bg-amber-950/60':'border-gray-800 bg-gray-900 hover:bg-gray-800'}`}><span className="text-sm">{o.label}</span><span className="block text-[10px] text-gray-600 mt-1">{answers[myId]===o.id ? "선택 완료" : "이 선택이 오늘의 판단 단서가 됩니다"}</span></button>)}</div>
        {revealedCounts && <div className="mt-3 bg-gray-900 rounded-xl p-3"><p className="text-xs font-semibold text-gray-300 mb-2">공동체의 선택</p>{trial.options.map((o) => <div key={o.id} className="mb-2"><div className="flex justify-between text-[10px] text-gray-500"><span>{o.label}</span><span>{revealedCounts[o.id] || 0}명</span></div><div className="h-1.5 rounded-full bg-gray-800 overflow-hidden"><div className="h-full bg-amber-600" style={{width: `${Math.round(((revealedCounts[o.id] || 0) / Math.max(1, alive.length)) * 100)}%`}} /></div></div>)}</div>}
      </div>}
      {tab === "mind" && <div className="p-3"><p className="text-xs text-gray-400 mb-2">한 라운드에 신뢰 1명, 의심 1명을 찍을 수 있어요. 개인 선택은 비공개이고 집계만 공개됩니다.</p><div className="grid grid-cols-2 gap-2">{alive.filter(p=>p.id!==myId).map(p=><div key={p.id} className="rounded-xl bg-gray-900 p-2.5"><p className="text-xs font-semibold truncate">{p.name}</p><div className="flex gap-1.5 mt-2"><button disabled={!!myTrustTarget} onClick={()=>voteTrust('trust',p.id)} className={`flex-1 rounded-lg py-1.5 text-[10px] ${myTrustTarget===p.id?'bg-emerald-800':'bg-gray-800'}`}>🤝 신뢰</button><button disabled={!!myDoubtTarget} onClick={()=>voteTrust('doubt',p.id)} className={`flex-1 rounded-lg py-1.5 text-[10px] ${myDoubtTarget===p.id?'bg-rose-800':'bg-gray-800'}`}>⚠️ 의심</button></div></div>)}</div><div className="grid grid-cols-2 gap-2 mt-3"><div className="rounded-xl bg-emerald-950/30 p-3"><p className="text-[10px] text-emerald-400">신뢰 상위</p>{trustLeaders.length?trustLeaders.map(([id,n])=><p key={id} className="text-xs mt-1">{gm.players.get(id)?.name ?? "익명"} · {n}</p>):<p className="text-xs text-gray-600 mt-1">아직 없음</p>}</div><div className="rounded-xl bg-rose-950/30 p-3"><p className="text-[10px] text-rose-400">의심 상위</p>{doubtLeaders.length?doubtLeaders.map(([id,n])=><p key={id} className="text-xs mt-1">{gm.players.get(id)?.name ?? "익명"} · {n}</p>):<p className="text-xs text-gray-600 mt-1">아직 없음</p>}</div></div></div>}
      {tab === "season" && <div className="p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-amber-500">SEASON META</p><p className="text-lg font-black mt-1">{meta?.prestige ?? 0} 명성</p><p className="text-xs text-gray-500 mt-1">게임에서 얻은 명성으로 칭호가 올라갑니다. 승리·말씀 사건 참여·결정적 판단이 기록됩니다.</p><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-gray-900 p-2"><p className="text-[10px] text-gray-500">승률</p><p className="text-sm font-bold">{meta?.games ? Math.round((meta.wins/meta.games)*100) : 0}%</p></div><div className="rounded-xl bg-gray-900 p-2"><p className="text-[10px] text-gray-500">평판</p><p className="text-sm font-bold">{meta?.reputation ?? 0}</p></div><div className="rounded-xl bg-gray-900 p-2"><p className="text-[10px] text-gray-500">MVP</p><p className="text-sm font-bold">{meta?.mvps ?? 0}</p></div></div></div>}
    </div>
  );
}
