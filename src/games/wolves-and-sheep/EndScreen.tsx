import { useEffect, useMemo, useState } from "react";
import { GameManager } from "./GameManger";
import { ROLE_LABEL, ROLE_INFO, isWolfFaction, isSheepFaction, ENDING_VERSES } from "./types";
import { playWin, playLose } from "./soundManager";
import { PRESS_FX } from "./uiFeedback";

/** 결과 화면 전용 keyframes(등장 페이드, 역할 목록 순차 등장, 승리 색종이 낙하).
 * 다른 컴포넌트와 동일하게 <style> 태그로 자체 완결시켜 별도 CSS 파일이 필요 없게 했다. */
function EndScreenStyles() {
  return (
    <style>{`
      @keyframes endscreen-in {
        from { opacity: 0; transform: scale(0.92) translateY(10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes endscreen-emoji-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes endscreen-row-in {
        from { opacity: 0; transform: translateX(-6px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes endscreen-confetti-fall {
        from { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
        to { transform: translateY(110vh) rotate(360deg); opacity: 0.8; }
      }
    `}</style>
  );
}

const CONFETTI_COLORS = ["#fbbf24", "#f472b6", "#34d399", "#60a5fa", "#a78bfa"];

/** 내가 승리했을 때만 띄우는 가벼운 색종이 낙하 연출. 외부 파티클 라이브러리 없이
 * CSS keyframe 애니메이션 20개를 랜덤 위치/속도로 뿌리는 방식으로 구현했다. */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.4 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    []
  );
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-5vh",
            width: p.size,
            height: p.size * 1.6,
            backgroundColor: p.color,
            borderRadius: 2,
            animation: `endscreen-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function EndScreen({ gm, onExit }: { gm: GameManager; onExit: () => void }) {
  const isWin = gm.winner === "sheep" ? isSheepFaction(gm.myRole) : isWolfFaction(gm.myRole);
  const [leaving, setLeaving] = useState(false);

  // 결과 화면이 뜨는 순간 딱 한 번만 승/패 사운드를 재생한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isWin) playWin();
    else playLose();
  }, []);

  // 이번 판 하이라이트: 미션을 가장 많이 완료한 플레이어를 "내가 뭘 했는지" 성취감 포인트로 보여준다.
  // (표 수는 회의가 끝날 때마다 초기화되기 때문에 마지막 판 결과만 남아있어 "최다 득표"는 신뢰 있게 집계할 수 없어 제외)
  const topTasker = useMemo(() => {
    const list = [...gm.players.values()].filter((p) => p.tasksCompleted > 0);
    if (list.length === 0) return null;
    return list.reduce((best, p) => (p.tasksCompleted > best.tasksCompleted ? p : best), list[0]);
  }, [gm.players]);

  // returnToLobby()가 방 전체에 "return_to_lobby"를 브로드캐스트하면 모든 클라이언트의
  // gm이 phase-change("lobby")를 emit한다 — PhaserGame.tsx가 이미 그 이벤트를 구독해
  // setPhase("lobby")로 반영하므로, 방을 나가지 않고도 같은 참가자 그대로 로비로 돌아간다.
  // 클릭 즉시 전환되던 것을, 짧은 페이드아웃을 먼저 보여준 뒤 실제 전환이 일어나도록 부드럽게 만든다.
  const playAgain = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => gm.returnToLobby(), 180);
  };

  return (
    // 버그 수정(모바일 UI 잘림): 예전엔 바깥 레이어가 overflow-hidden + flex 중앙 정렬뿐이라
    // 스크롤이 전혀 안 됐다. 참가자가 많아 "전체 역할 공개" 목록이 길어지면, 가로 모드의 짧은
    // 세로 폭 화면에서 목록 아래쪽(그리고 "다시하기"/"방 나가기" 버튼)이 그대로 화면 밖으로
    // 잘려서 아예 눌리지 않는 문제가 있었다. 색종이(Confetti)는 자체적으로 overflow-hidden을
    // 가진 별도 절대 위치 레이어라 바깥 레이어의 overflow를 auto로 바꿔도 화면 밖으로 새지 않는다.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90">
      <EndScreenStyles />
      {isWin && <Confetti />}
      <div className="min-h-full flex items-center justify-center px-4 py-8">
      <div
        className="relative z-10 text-center text-white transition-opacity duration-150 ease-in"
        style={{ animation: "endscreen-in 0.35s ease-out", opacity: leaving ? 0 : 1 }}
      >
        <p className="text-5xl mb-4" style={{ animation: "endscreen-emoji-bounce 1.4s ease-in-out infinite" }}>
          {gm.winner === "sheep" ? "🐑" : "🐺"}
        </p>
        <h2 className="text-3xl font-bold mb-2">
          {gm.winner === "sheep" ? "양들이 승리했습니다!" : "늑대가 승리했습니다..."}
        </h2>
        <p className={`text-lg mb-4 ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
          {isWin ? "당신은 승리했습니다 🎉" : "당신은 패배했습니다"}
        </p>
        {gm.winner && (
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl px-5 py-4 mb-6 max-w-sm mx-auto">
            <p className="text-yellow-200/90 text-sm leading-relaxed italic">
              "{ENDING_VERSES[gm.winner].verse}"
            </p>
            <p className="text-gray-500 text-xs mt-1">— {ENDING_VERSES[gm.winner].ref}</p>
            <p className="text-gray-300 text-xs mt-3">{ENDING_VERSES[gm.winner].narration}</p>
          </div>
        )}
        {topTasker && (
          <p className="text-xs text-amber-200/80 mb-4">
            🏅 이번 판 최다 미션 완료: <span className="font-semibold">{topTasker.name}</span>
            {topTasker.id === gm.userId && <span className="text-indigo-300"> (나)</span>} — {topTasker.tasksCompleted}개
          </p>
        )}
        <div className="bg-gray-900 rounded-xl p-4 mb-6 max-w-sm mx-auto text-left">
          <p className="text-sm text-gray-400 mb-2">전체 역할 공개</p>
          <div className="space-y-1">
            {[...gm.players.values()].map((p, i) => (
              <div
                key={p.id}
                style={{ animation: `endscreen-row-in 0.3s ease-out ${i * 60}ms both` }}
                className={`flex justify-between text-sm px-2 py-1 rounded ${
                  p.id === gm.userId ? "bg-indigo-900/40 ring-1 ring-indigo-400/50" : ""
                }`}
              >
                <span>
                  {p.name}
                  {p.id === gm.userId && <span className="text-indigo-300 text-xs ml-1">(나)</span>}
                </span>
                <span className={isWolfFaction(p.role) ? "text-rose-400" : "text-emerald-400"}>
                  {ROLE_INFO[p.role].emoji} {ROLE_LABEL[p.role]} {p.alive ? "" : "(탈락)"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          {gm.isHost ? (
            <button
              onClick={playAgain}
              disabled={leaving}
              className={`px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer font-medium ${PRESS_FX}`}
            >
              🔁 같은 인원으로 다시하기
            </button>
          ) : (
            <p className="text-xs text-gray-400">방장이 다시하기를 누르면 곧바로 로비로 돌아가요.</p>
          )}
          <button
            onClick={onExit}
            className={`px-6 py-2 text-sm text-gray-400 hover:text-white cursor-pointer transition-colors ${PRESS_FX}`}
          >
            방 나가기
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}