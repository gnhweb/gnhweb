import { useEffect, useRef, useState } from "react";
import { GameManager } from "./GameManager";
import { randomPrompt } from "./promptBank";
import { CATEGORY_LABEL, PromptCategory } from "./types";
import { WaitingOverlay } from "./WaitingOverlay";
const MAX_TEXT_LENGTH = 60;

/**
 * 글쓰기 턴 UI. 두 가지 경우를 모두 처리한다:
 *  - turn 0 (프롬프트 작성): 참가자 전원이 동시에 자기 체인의 첫 항목을 적는다.
 *    자유 입력 또는 "랜덤 뽑기" 버튼으로 활성 카테고리 풀에서 하나를 뽑아 채울 수 있다.
 *  - 그 외 짝수 턴 (추측): 직전 사람이 그린 그림만 보고 "이게 뭘 그린 건지" 한 문장으로 추측해 적는다.
 *    (갈틱폰 핵심 규칙 — 프롬프트나 이전 문장은 볼 수 없고 오직 그림만 본다.)
 * 시간이 다 되면 아직 제출하지 않은 사람은 자동으로 제출된다.
 */
export function WritingPanel({ gm }: { gm: GameManager }) {
  const [, forceUpdate] = useState(0);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<PromptCategory | null>(null);
  const startedAtRef = useRef(Date.now());
  const autoSubmittedRef = useRef(false);

  const isPromptTurn = gm.myEntryType === "prompt";
  const previousDrawing = !isPromptTurn ? gm.previousEntry?.content ?? null : null;

  useEffect(() => {
    startedAtRef.current = Date.now();
    autoSubmittedRef.current = false;
    setText("");
    setCategory(null);
  }, [gm.currentTurn]);

  useEffect(() => {
    const rerender = () => forceUpdate((n) => n + 1);
    gm.on("entry-update", rerender);
    gm.on("phase-change", rerender);
    return () => {
      gm.off("entry-update", rerender);
      gm.off("phase-change", rerender);
    };
  }, [gm]);

  const totalSec = gm.settings.writeTimeSec;
  const [remaining, setRemaining] = useState(totalSec);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, totalSec - Math.floor((Date.now() - startedAtRef.current) / 1000));
      setRemaining(left);
      if (left === 0 && !gm.haveISubmittedThisTurn && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        if (isPromptTurn) {
          const fallback = randomPrompt(gm.settings.activeCategories, gm.settings.seasonalPack);
          gm.submitPrompt(text.trim() || fallback.text, category ?? fallback.category);
        } else {
          gm.submitEntry(text.trim() || "(무엇인지 잘 모르겠어요)");
        }
      }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gm, gm.currentTurn, totalSec, text, category, isPromptTurn]);

  const submitted = gm.haveISubmittedThisTurn;

  const pickRandom = () => {
    const picked = randomPrompt(gm.settings.activeCategories, gm.settings.seasonalPack);
    setText(picked.text);
    setCategory(picked.category);
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    if (isPromptTurn) {
      gm.submitPrompt(text.trim(), category ?? "random");
    } else {
      gm.submitEntry(text.trim());
    }
  };

 if (submitted) {
  return <WaitingOverlay gm={gm} />;
}

  return (
    <div className="w-full max-w-md bg-gray-800 rounded-2xl p-6 text-white flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{isPromptTurn ? "✍️ 프롬프트 작성" : "🔎 이건 무슨 그림일까요?"}</h2>
        <span className={`text-sm font-mono ${remaining <= 5 ? "text-red-400" : "text-gray-400"}`}>
          {remaining}초
        </span>
      </div>

      {isPromptTurn ? (
        <p className="text-xs text-gray-400">
          다음 사람이 이 문장을 보고 그림으로 그릴 거예요. 짧고 명확하게 적어주세요.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400">그림만 보고 무엇을 그린 건지 한 문장으로 적어주세요.</p>
          {previousDrawing && (
            <div className="w-full rounded-lg overflow-hidden border border-gray-700 bg-white">
              <img src={previousDrawing} alt="이전 사람이 그린 그림" className="w-full h-auto" />
            </div>
          )}
        </>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
        placeholder={isPromptTurn ? "예: 대표기도 순서 걸렸는데 뭐라 할지 까먹은 집사님" : "예: 헌금 시간에 당황한 청년"}
        rows={isPromptTurn ? 3 : 2}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 resize-none"
      />
      <div className="flex justify-between text-[11px] text-gray-500">
        <span>
          {isPromptTurn
            ? category
              ? `${CATEGORY_LABEL[category].emoji} ${CATEGORY_LABEL[category].label}`
              : "카테고리: 직접 입력"
            : ""}
        </span>
        <span>{text.length}/{MAX_TEXT_LENGTH}</span>
      </div>

      {isPromptTurn && (
        <button
          onClick={pickRandom}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer text-sm"
        >
          🎲 랜덤 뽑기
        </button>
      )}

      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="w-full py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg cursor-pointer disabled:cursor-default font-medium"
      >
        제출
      </button>
    </div>
  );
}