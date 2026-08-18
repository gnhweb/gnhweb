import { useEffect, useState } from "react";
import { ROLE_INFO, ROLE_REVEAL_TEXT, isWolfFaction, type Role } from "./types";

/** 추방 결과로 이 화면에 표시할 정보. ejectedId가 있었을 때만 name/role을 채워서 넘긴다.
 * (players 맵은 이후 게임이 계속 진행되며 바뀔 수 있으므로, 사건이 벌어진 "그 순간"의
 * 이름/역할을 PhaserGame.tsx에서 미리 스냅샷으로 캡처해 넘겨받는다) */
export type EjectionResult = { name: string; role: Role } | "tie" | null;

const AUTO_DISMISS_MS = 3400;
/** 연출이 너무 빨리 끊겨 보이지 않도록, 스킵은 이 시간이 지난 뒤부터만 허용한다. */
const SKIP_UNLOCK_MS = 700;

/**
 * 🚀 추방(이젝션) 시네마틱 — 어몽어스의 "우주선 밖으로 튕겨나가는" 연출을 벤치마킹.
 * 기존에는 상단 배너 텍스트 한 줄로만 결과를 알렸지만, 결정적 순간을 모달이 아니라
 * 화면 전체를 장악하는 짧은 '장면'으로 승격시킨다(기획안 6-6).
 * - 실루엣이 화면 중앙에 떨어지듯 등장 → 역할 공개 텍스트가 이어서 페이드인
 * - 진영 테마 컬러(양=따뜻한 톤, 늑대=차가운 톤)를 배경에 은은히 반영
 * - 동률(무효표)일 때도 전용 연출로 "아무도 추방되지 않았다"를 명확히 전달
 * - 진행 템포를 늦추지 않도록 자동으로 사라지며, 짧은 유예 후 탭으로 스킵할 수 있다(유의사항 참고)
 */
export function EjectionOverlay({ result, onDone }: { result: EjectionResult; onDone: () => void }) {
  const [skippable, setSkippable] = useState(false);

  useEffect(() => {
    setSkippable(false);
    const unlockTimer = setTimeout(() => setSkippable(true), SKIP_UNLOCK_MS);
    const dismissTimer = setTimeout(onDone, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(unlockTimer);
      clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (result === null) return null;

  const isTie = result === "tie";
  const wolfSide = !isTie && isWolfFaction(result.role);
  // 양 진영은 따뜻한 톤(호박색), 늑대 진영은 차가운 톤(남색)을 배경에 은은히 깐다.
  const themeGlow = isTie
    ? "radial-gradient(circle at 50% 40%, rgba(107,114,128,0.35), transparent 65%)"
    : wolfSide
    ? "radial-gradient(circle at 50% 40%, rgba(59,74,167,0.45), transparent 65%)"
    : "radial-gradient(circle at 50% 40%, rgba(217,142,44,0.4), transparent 65%)";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/92 cursor-pointer select-none"
      style={{ background: `${themeGlow}, rgba(0,0,0,0.92)`, animation: "ejection-backdrop-in 0.25s ease-out" }}
      onClick={() => skippable && onDone()}
    >
      <style>{`
        @keyframes ejection-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ejection-drop-in {
          0% { opacity: 0; transform: translateY(-60px) rotate(-8deg) scale(0.85); }
          55% { opacity: 1; transform: translateY(8px) rotate(3deg) scale(1.04); }
          100% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
        }
        @keyframes ejection-text-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ejection-tie-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>

      {isTie ? (
        <div className="text-center px-6" style={{ animation: "ejection-tie-shake 0.5s ease-out" }}>
          <p className="text-6xl mb-4">🤷</p>
          <h2 className="text-2xl font-bold text-gray-200 mb-2">동률 — 아무도 추방되지 않았습니다</h2>
          <p className="text-sm text-gray-400">표가 갈려 이번엔 아무도 추방되지 않았어요.</p>
        </div>
      ) : (
        <div className="text-center px-6">
          <div
            className={`mx-auto mb-5 w-28 h-28 rounded-full flex items-center justify-center text-6xl border-4 ${
              wolfSide ? "bg-indigo-950 border-indigo-400" : "bg-amber-950 border-amber-400"
            }`}
            style={{ animation: "ejection-drop-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            {ROLE_INFO[result.role].emoji}
          </div>
          <h2
            className="text-2xl font-bold text-white mb-2"
            style={{ animation: "ejection-text-in 0.3s ease-out 0.35s both" }}
          >
            {result.name}님이 추방되었습니다
          </h2>
          <p
            className={`text-sm max-w-sm mx-auto leading-relaxed ${wolfSide ? "text-indigo-200" : "text-amber-200"}`}
            style={{ animation: "ejection-text-in 0.3s ease-out 0.55s both" }}
          >
            {ROLE_REVEAL_TEXT[result.role]}
          </p>
        </div>
      )}

      {skippable && (
        <p
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-gray-500"
          style={{ animation: "ejection-text-in 0.3s ease-out" }}
        >
          화면을 탭하면 넘어갑니다
        </p>
      )}
    </div>
  );
}