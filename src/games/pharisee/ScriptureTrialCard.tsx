import { useEffect, useMemo, useState } from "react";
import type { GameManager } from "./GameManager";

function useLeft(endsAt: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [endsAt]);
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export default function ScriptureTrialCard({ gm }: { gm: GameManager }) {
  const [, force] = useState(0);
  const left = useLeft(gm.phaseEndsAt);
  const trial = gm.scriptureTrial;
  const myChoice = gm.scriptureTrialChoices.get(gm.userId) ?? null;
  const resolved = gm.scriptureTrialResolved;
  const aliveCount = gm.alivePlayers.length;
  const answeredCount = [...gm.scriptureTrialChoices.keys()].filter((id) => gm.players.get(id)?.alive).length;
  const canAnswer = gm.canAnswerScriptureTrial();
  const selectedOption = useMemo(
    () => trial.options.find((option) => option.id === myChoice),
    [trial, myChoice],
  );

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    gm.on("scripture-trial-update", rerender);
    return () => gm.off("scripture-trial-update", rerender);
  }, [gm]);

  const maxVotes = Math.max(1, ...trial.options.map((option) => gm.scriptureTrialCounts[option.id] ?? 0));

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-950/80 via-gray-900 to-gray-950 shadow-xl shadow-black/20">
      <div className="border-b border-amber-800/30 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-base">📖</span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">SCRIPTURE TRIAL</p>
              <p className="truncate text-sm font-bold text-amber-50">오늘의 말씀 사건</p>
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-amber-800/40 bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
            {resolved ? "집계 완료" : `${answeredCount}/${aliveCount} 응답`}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="rounded-xl border border-white/5 bg-black/20 p-3.5 sm:p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-amber-300">
            <span>{trial.reference}</span>
            <span className="h-1 w-1 rounded-full bg-amber-700" />
            <span>정답 없음</span>
          </div>
          <p className="text-sm font-medium leading-6 text-gray-100 sm:text-[15px]">“{trial.verse}”</p>
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-semibold text-violet-300">상황</p>
          <p className="mt-1 text-sm leading-6 text-gray-200">{trial.situation}</p>
          <p className="mt-3 text-base font-bold leading-6 text-white">{trial.question}</p>
        </div>

        {!resolved && canAnswer && !myChoice && (
          <div className="mt-4 grid gap-2.5">
            {trial.options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => gm.answerScriptureTrial(option.id)}
                className="group w-full rounded-xl border border-gray-700 bg-gray-900/80 px-3.5 py-3.5 text-left transition-all active:scale-[0.99] hover:border-amber-600/70 hover:bg-amber-950/30"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-[11px] font-black text-gray-400 group-hover:bg-amber-900/60 group-hover:text-amber-200">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-100">{option.label}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{option.nuance}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!resolved && myChoice && (
          <div className="mt-4 rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/80">나의 선택</p>
            <p className="mt-1 text-sm font-semibold text-emerald-50">{selectedOption?.label}</p>
            <p className="mt-1 text-[11px] text-gray-500">다른 사람의 선택은 집계가 끝날 때까지 공개되지 않습니다.</p>
          </div>
        )}

        {!resolved && !canAnswer && !myChoice && (
          <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/70 p-3 text-center text-xs text-gray-500">
            {gm.isSpectator ? "👀 관전자 모드에서는 말씀 사건에 응답할 수 없습니다." : "이제 다른 사람의 선택을 기다립니다."}
          </div>
        )}

        {resolved && (
          <div className="mt-4 rounded-xl border border-violet-800/30 bg-violet-950/15 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/80">공동체의 선택</p>
                <p className="mt-1 text-xs text-gray-400">정답을 찾는 시간이 아니라, 서로의 판단 근거를 알아가는 시간입니다.</p>
              </div>
              <span className="text-lg">🧭</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {trial.options.map((option) => {
                const count = gm.scriptureTrialCounts[option.id] ?? 0;
                const width = `${Math.max(4, (count / maxVotes) * 100)}%`;
                return (
                  <div key={option.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-gray-300">{option.label}</span>
                      <span className="shrink-0 font-bold text-gray-500">{count}명</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-violet-500 transition-all" style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-gray-500">💡 이제 토론에서 “왜 그렇게 골랐는지”를 물어보세요. 말씀 선택은 진영의 정답이 아니라 심리전의 단서입니다.</p>
          </div>
        )}

        {!resolved && !myChoice && (
          <p className="mt-3 text-center text-[10px] text-gray-600">토론 종료까지 {left}초 · 모두 응답하면 집계가 즉시 공개됩니다.</p>
        )}
      </div>
    </section>
  );
}
