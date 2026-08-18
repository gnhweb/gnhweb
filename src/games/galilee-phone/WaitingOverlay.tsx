import { GameManager } from "./GameManager";
import { Phase } from "./types";

const PHASE_META: Partial<Record<Phase, { icon: string; verb: string }>> = {
  prompt: { icon: "✍️", verb: "작성하는 중" },
  drawing: { icon: "🎨", verb: "그리는 중" },
  guessing: { icon: "🔎", verb: "추측하는 중" },
};

/**
 * WritingPanel(프롬프트/추측 턴)과 CanvasBoard(그리기 턴)가 공통으로 쓰는 대기 화면.
 * 자신이 제출을 마친 뒤, 아직 제출하지 않은 사람들의 이름을 실시간으로 보여준다.
 * GameManager가 entry_submitted를 받을 때마다 emit("entry-update")하므로,
 * 이 컴포넌트를 렌더링하는 부모 패널이 이미 그 이벤트를 구독하고 있다면 별도 구독 없이도 최신 상태로 리렌더된다.
 */
export function WaitingOverlay({ gm }: { gm: GameManager }) {
  const meta = PHASE_META[gm.phase] ?? { icon: "⏳", verb: "진행하는 중" };
  const pending = gm.pendingPlayerNames;
  const total = gm.playerOrder.length;
  const progress = total === 0 ? 0 : gm.submittedCount / total;

  return (
    <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 text-white text-center flex flex-col gap-4">
      <div className="text-3xl">{meta.icon}</div>
      <p className="text-sm text-gray-300">제출 완료! 다른 사람들을 기다리는 중...</p>

      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-600 transition-all duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {gm.submittedCount} / {total}명 제출함
      </p>

      {pending.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-1.5">
          {pending.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="px-2.5 py-1 bg-gray-900 rounded-full text-[11px] text-gray-400 flex items-center gap-1.5"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {name}님이 아직 {meta.verb}...
            </li>
          ))}
        </ul>
      )}

      {gm.isHost && pending.length > 0 && (
        <button
          onClick={() => gm.forceAdvanceTurn()}
          className="text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer underline decoration-dotted"
        >
          ⏭️ 연결이 끊긴 것 같아요 — 강제로 다음 턴 진행 (방장 전용)
        </button>
      )}
    </div>
  );
}