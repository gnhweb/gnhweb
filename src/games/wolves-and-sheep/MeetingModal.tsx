import { useEffect, useRef, useState } from "react";
import { GameManager } from "./GameManger";
import { MEETING_DISCERNMENT_VERSE } from "./types";
import { MAX_CHAT_LENGTH } from "@/lib/chatSafety";
import { playVoteCast } from "./soundManager";
import { PRESS_FX, FLASH_FX } from "./uiFeedback";

/** 모달 등장, 서브페이즈(토론↔투표) 전환, 새 채팅 메시지에 쓰는 페이드/슬라이드 애니메이션.
 * 다른 컴포넌트(PhaserGame.tsx)와 같은 방식으로 <style> 태그에 keyframes를 직접 넣어
 * 별도 CSS 파일 추가 없이 컴포넌트 하나로 완결되게 했다. */
function MeetingAnimStyles() {
  return (
    <style>{`
      @keyframes meeting-modal-in {
        from { opacity: 0; transform: scale(0.95) translateY(8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes meeting-subphase-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes meeting-chat-msg-in {
        from { opacity: 0; transform: translateX(-6px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes meeting-timer-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
      @keyframes meeting-sender-pulse {
        0% { text-shadow: 0 0 0 rgba(52,211,153,0); }
        30% { text-shadow: 0 0 8px rgba(52,211,153,0.9); }
        100% { text-shadow: 0 0 0 rgba(52,211,153,0); }
      }
      @keyframes vote-avatar-in {
        from { opacity: 0; transform: scale(0.4) translateY(-6px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
    `}</style>
  );
}

/** 이름/이미지 에셋 없이(BeanCharacter와 동일한 절차적 생성 원칙) 아이디 기반으로 항상
 * 같은 색이 나오게 하는 간단한 해시. 투표자 아바타 배지 색상에 쓴다. */
const VOTER_AVATAR_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-lime-500",
  "bg-cyan-500",
];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return VOTER_AVATAR_COLORS[h % VOTER_AVATAR_COLORS.length];
}
/* 한 후보 위로 겹쳐 쌓아 보여줄 최대 아바타 수 — 그 이상은 "+N"으로 요약한다. */
const MAX_STACK_AVATARS = 5;

export function MeetingModal({ gm }: { gm: GameManager }) {
  const [, forceUpdate] = useState(0);
  const [subPhase, setSubPhase] = useState<"discuss" | "vote">(gm.meetingSubPhase);
  const [timeLeft, setTimeLeft] = useState(Math.ceil((gm.meetingEndsAt - Date.now()) / 1000));
  const [chatInput, setChatInput] = useState("");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [proclaimed, setProclaimed] = useState(false);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onVote = () => forceUpdate((n) => n + 1);
    const onChat = () => forceUpdate((n) => n + 1);
    const onSub = (p: "discuss" | "vote") => setSubPhase(p);
    const onBlocked = () => {
      setChatNotice("✋ 메시지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요.");
      setTimeout(() => setChatNotice(null), 2000);
    };
    gm.on("vote-update", onVote);
    gm.on("chat-update", onChat);
    gm.on("meeting-subphase", onSub);
    gm.on("chat-blocked", onBlocked);
    return () => {
      gm.off("vote-update", onVote);
      gm.off("chat-update", onChat);
      gm.off("meeting-subphase", onSub);
      gm.off("chat-blocked", onBlocked);
    };
  }, [gm]);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(Math.max(0, Math.ceil((gm.meetingEndsAt - Date.now()) / 1000))), 500);
    return () => clearInterval(t);
  }, [gm]);

  // 새 채팅이 쌓이면 항상 맨 아래(최신 메시지)로 자동 스크롤한다.
  // 안 그러면 대화가 길어질수록 매번 직접 스크롤을 내려야 해서 실시간 토론 흐름이 끊긴다.
  useEffect(() => {
    const el = chatLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [gm.chatLog.length]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    gm.sendChat(chatInput.trim());
    setChatInput("");
  };

  const proclaimRevelation = () => {
    if (!gm.investigationResult || proclaimed) return;
    const { targetName, isWolf } = gm.investigationResult;
    gm.sendChat(`📖 [계시] ${targetName}님은 ${isWolf ? "늑대" : "양"}입니다.`);
    setProclaimed(true);
  };

  // 투표 시간이 끝나기 전이라면 몇 번이든 대상을 바꿔 다시 투표할 수 있다("" = 스킵/기권).
  const vote = (targetId: string) => {
    playVoteCast();
    setMyVote(targetId);
    gm.castVote(targetId);
  };

  // 이미 넣은 투표를 취소해서 "아직 투표 안 한" 상태로 되돌린다.
  const cancelVote = () => {
    setMyVote(null);
    gm.cancelVote();
  };

  const alive = gm.alivePlayers;
  const voteCounts = new Map<string, number>();
  // 6-5: 텍스트 카운트만으로는 "누가" 투표했는지 실시간 분위기가 안 느껴져서,
  // 후보 위로 쌓이는 투표자 아바타에 쓸 이름 목록도 같은 순회에서 함께 모은다.
  const votersByTarget = new Map<string, { id: string; name: string }[]>();
  gm.votes.forEach((targetId, voterId) => {
    if (!targetId) return;
    voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
    const name = gm.players.get(voterId)?.name ?? "?";
    const list = votersByTarget.get(targetId) ?? [];
    list.push({ id: voterId, name });
    votersByTarget.set(targetId, list);
  });

  const canProclaim =
    gm.me?.alive === true &&
    (gm.myRole === "prophet" || gm.myRole === "falseProphet") &&
    !!gm.investigationResult &&
    !proclaimed;
  const isGhost = gm.me?.alive === false;

  return (
    // 버그 수정(모바일에서 중앙이 아니라 위쪽에 붙어 보이던 문제):
    // 예전엔 안쪽 박스에만 overflow-y-auto를 걸고 바깥 오버레이는 그냥 items-center로만
    // 뒀는데, max-h-[85vh]의 "vh"가 모바일에서 주소창 유무에 따라 실제 보이는 화면보다
    // 크게 계산되는 경우가 있어(정적 vh vs 동적 실제 뷰포트) 박스가 화면보다 커지고,
    // 중앙 정렬은 유지된 채로 위아래가 화면 밖으로 밀려나 마치 "위에 붙은 것"처럼 보였다.
    // dvh(동적 뷰포트 높이)로 바꾸고, 바깥 오버레이도 자체적으로 스크롤 가능하게 해서
    // 어떤 화면 크기에서도 항상 화면 안에 온전히 들어오게 했다.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 overflow-y-auto p-4">
      <MeetingAnimStyles />
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-[92%] max-w-2xl text-white max-h-[85dvh] overflow-y-auto my-auto"
        style={{ animation: "meeting-modal-in 0.25s ease-out" }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-yellow-300 flex items-center gap-1.5">
            {/* 6-4: 소집 사유를 아이콘+컬러로 구분해 텍스트를 읽기 전에도 즉시 인지되게 함 */}
            {gm.meetingCallType === "body" ? (
              <span className="inline-flex items-center gap-1 text-rose-400">🚨 신고</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-300">🔔 긴급 소집</span>
            )}
            <span className="text-white/60">—</span>
            {subPhase === "discuss" ? "토론" : "투표"}
          </h3>
          <span
            className={`text-sm ${timeLeft <= 5 ? "text-rose-400 font-bold" : "text-gray-400"}`}
            style={timeLeft <= 5 ? { animation: "meeting-timer-pulse 0.6s ease-in-out infinite" } : undefined}
          >
            남은 시간: {timeLeft}초
          </span>
        </div>
        <p className={`text-xs text-gray-400 ${subPhase === "discuss" ? "mb-1" : "mb-4"}`}>{gm.meetingReason}</p>
        {subPhase === "discuss" && (
          <p className="text-xs text-yellow-200/70 italic mb-4">
            "{MEETING_DISCERNMENT_VERSE.verse}" — {MEETING_DISCERNMENT_VERSE.ref}
          </p>
        )}

        {/* key={subPhase}로 토론↔투표 전환마다 컨테이너를 새로 마운트시켜서
            meeting-subphase-in 애니메이션이 매번 다시 재생되게 한다 */}
        <div key={subPhase} style={{ animation: "meeting-subphase-in 0.25s ease-out" }}>
        {subPhase === "discuss" ? (
          <div>
            {canProclaim && (
              <button
                onClick={proclaimRevelation}
                className={`mb-3 w-full py-2 rounded-lg bg-amber-700/80 hover:bg-amber-600 cursor-pointer text-sm font-medium ${PRESS_FX}`}
              >
                📖 계시 선포하기 ({gm.investigationResult!.targetName}님 조사 결과 공개)
              </button>
            )}
            <div ref={chatLogRef} className="bg-gray-800 rounded-lg h-48 overflow-y-auto p-3 mb-3 space-y-1 text-sm">
              {gm.chatLog.length === 0 && <p className="text-gray-500">아직 대화가 없습니다...</p>}
              {gm.chatLog.map((m, i) => {
                const isLatest = i === gm.chatLog.length - 1;
                return (
                  <p key={m.id} style={{ animation: "meeting-chat-msg-in 0.2s ease-out" }}>
                    {/* 새 메시지가 올라오면 발신자 이름을 짧게 강조해 '누가 말하는지' 바로 알 수 있게 함 */}
                    <span
                      className="text-emerald-400 font-semibold"
                      style={isLatest ? { animation: "meeting-sender-pulse 0.6s ease-out" } : undefined}
                    >
                      {m.senderName}:{" "}
                    </span>
                    <span>{m.text}</span>
                  </p>
                );
              })}
            </div>
            {chatNotice && (
              <p className="text-xs text-amber-300 text-center mb-2">{chatNotice}</p>
            )}
            {isGhost ? (
              // 유령은 산 사람들의 토론에 끼어들 수 없다 — 관전 중임을 명확히 안내
              <p className="text-xs text-gray-500 text-center py-2">
                👻 당신은 유령입니다. 이 토론은 관전만 가능해요.
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  maxLength={MAX_CHAT_LENGTH}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-emerald-400"
                  placeholder="의견을 남겨보세요..."
                />
                <button onClick={sendChat} className={`px-4 py-2 bg-emerald-600 rounded-lg cursor-pointer hover:bg-emerald-500 ${PRESS_FX}`}>
                  전송
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {isGhost && (
              <p className="text-xs text-gray-500 text-center pb-1">👻 유령은 투표할 수 없어요. 결과만 지켜보세요.</p>
            )}
            {alive.map((p) => (
              <button
                key={p.id}
                onClick={() => vote(p.id)}
                disabled={isGhost}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-left transition-all duration-150 ${
                  isGhost ? "cursor-default" : `cursor-pointer ${PRESS_FX}`
                } ${
                  myVote === p.id ? "bg-rose-700 scale-[1.02] ring-2 ring-rose-400" : "bg-gray-800 hover:bg-gray-700"
                } ${myVote !== null && myVote !== p.id ? "opacity-50" : ""}`}
              >
                <span>{p.name}</span>
                {/* 6-5: 표가 들어올 때마다 투표자 아바타가 후보 위로 겹쳐 쌓이는 형태로,
                    "표가 몰리는" 실시간 분위기를 텍스트보다 직관적으로 보여준다.
                    key를 표 수로 바꿔 매번 재마운트시켜서 새로 들어온 표가 플래시로 눈에 띄게 함 */}
                <span key={voteCounts.get(p.id) ?? 0} className={`flex items-center ${FLASH_FX}`}>
                  {(votersByTarget.get(p.id) ?? []).slice(0, MAX_STACK_AVATARS).map((v, idx) => (
                    <span
                      key={v.id}
                      title={v.name}
                      style={{ marginLeft: idx === 0 ? 0 : -8, zIndex: idx, animation: `vote-avatar-in 0.22s ease-out ${idx * 0.03}s both` }}
                      className={`w-5 h-5 rounded-full ${avatarColor(v.id)} border-2 border-gray-900 flex items-center justify-center text-[9px] font-bold text-white shrink-0`}
                    >
                      {v.name.charAt(0)}
                    </span>
                  ))}
                  {(voteCounts.get(p.id) ?? 0) > MAX_STACK_AVATARS && (
                    <span
                      style={{ marginLeft: -8, zIndex: MAX_STACK_AVATARS }}
                      className="w-5 h-5 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-[8px] font-bold text-gray-200 shrink-0"
                    >
                      +{(voteCounts.get(p.id) ?? 0) - MAX_STACK_AVATARS}
                    </span>
                  )}
                  {(voteCounts.get(p.id) ?? 0) === 0 && <span className="text-xs text-gray-500">0표</span>}
                </span>
              </button>
            ))}
            {!isGhost && (
              <button
                onClick={() => vote("")}
                className={`w-full px-4 py-2.5 rounded-lg text-sm cursor-pointer transition-all duration-150 ${PRESS_FX} ${
                  myVote === "" ? "bg-gray-600 scale-[1.02] ring-2 ring-gray-400" : "bg-gray-800 hover:bg-gray-700"
                } ${myVote !== null && myVote !== "" ? "opacity-50" : ""}`}
              >
                스킵 (기권)
              </button>
            )}
            {!isGhost && myVote !== null && (
              <button
                onClick={cancelVote}
                className={`w-full px-4 py-2 rounded-lg text-xs cursor-pointer bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors ${PRESS_FX}`}
              >
                ✋ 투표 취소하기
              </button>
            )}
            {myVote !== null && (
              <p className="text-xs text-gray-400 text-center pt-1">
                {myVote === "" ? "스킵" : alive.find((p) => p.id === myVote)?.name ?? ""}에 투표했어요. 시간 안에 언제든 바꾸거나 취소할 수 있어요.
              </p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}