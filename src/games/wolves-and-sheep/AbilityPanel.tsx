import { useEffect, useState } from "react";
import { GameManager } from "./GameManger";
import { PRESS_FX, READY_PULSE_FX } from "./uiFeedback";
import { playUiClick } from "./soundManager";

export function AbilityPanel({ gm }: { gm: GameManager }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const onUpdate = () => forceUpdate((n) => n + 1);
    gm.on("ability-update", onUpdate);
    gm.on("kill-blocked", onUpdate);
    return () => {
      gm.off("ability-update", onUpdate);
      gm.off("kill-blocked", onUpdate);
    };
  }, [gm]);

  if (!gm.me?.alive) return null;

  const isShepherd = gm.myRole === "shepherd";
  const isProphetLike = gm.myRole === "prophet" || gm.myRole === "falseProphet";
  const isIntercessor = gm.myRole === "intercessor";
  if (!isShepherd && !isProphetLike && !isIntercessor) return null;

  const targets = gm.alivePlayers.filter((p) => p.id !== gm.userId);

  // [Phase 1] 아직 이번 라운드/판에 능력을 쓰지 않은 상태(=지금 눌러야 의미가 있는 상태)일 때만
  // 패널 테두리를 은은하게 펄스시켜, 능력이 "준비됐다"는 걸 텍스트를 읽지 않아도 알 수 있게 한다.
  const abilityReady =
    (isShepherd && !gm.shepherdUsedThisRound) ||
    (isProphetLike && !gm.prophetUsedThisRound) ||
    (isIntercessor && !gm.intercessorUsedThisGame && !gm.activeIntercession && gm.deadBodies.length > 0);

  return (
    // z-40: MobileControls의 조이스틱 터치 존(좌하단 넓은 영역, z-index 없음)이 같은
    // 좌하단 구역을 덮고 있어서, z-index를 안 주면 조이스틱 존이 나중에 렌더링되어
    // 이 패널의 버튼 터치를 가로챈다. GhostChatBox 등 같은 자리의 다른 패널과 동일하게
    // z-40을 줘서 항상 조이스틱보다 위에서 터치를 받도록 한다.
    <div
      style={{
        bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
        left: "calc(0.5rem + env(safe-area-inset-left, 0px))",
      }}
      className={`absolute z-40 bg-gray-900/95 border border-gray-700 rounded-xl p-3 w-[min(14rem,92vw)] text-white text-xs max-h-64 overflow-y-auto ${
        abilityReady ? READY_PULSE_FX : ""
      }`}
    >
      {isShepherd && (
        <>
          <p className="font-bold text-indigo-300 mb-1">🛡️ 보호할 사람 지목</p>
          {gm.shepherdUsedThisRound ? (
            <p className="text-gray-500 mb-2">이번 라운드에 이미 보호했습니다.</p>
          ) : (
            <div className="space-y-1 mb-2">
              {targets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    playUiClick();
                    gm.protectPlayer(p.id);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-indigo-700/60 cursor-pointer ${PRESS_FX}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {isProphetLike && (
        <>
          <p className="font-bold text-amber-300 mb-1">📖 정체 조사</p>
          {gm.prophetUsedThisRound ? (
            <div className="mb-1">
              <p className="text-gray-500">이번 라운드 조사를 마쳤습니다.</p>
              {gm.investigationResult && (
                <p className="mt-1 text-sm">
                  <span className="text-emerald-300">{gm.investigationResult.targetName}</span>님은{" "}
                  <span className={gm.investigationResult.isWolf ? "text-rose-400" : "text-emerald-400"}>
                    {gm.investigationResult.isWolf ? "늑대" : "양"}
                  </span>
                  입니다.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {targets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    playUiClick();
                    gm.investigate(p.id);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-amber-700/60 cursor-pointer ${PRESS_FX}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {isIntercessor && (
        <>
          <p className="font-bold text-sky-300 mb-1">🙏 중보 기도</p>
          {gm.intercessorUsedThisGame ? (
            gm.lastIntercessionResult ? (
              <p className={gm.lastIntercessionResult.success ? "text-emerald-400" : "text-gray-500"}>
                {gm.lastIntercessionResult.success
                  ? `${gm.lastIntercessionResult.targetName}님이 다시 살아났습니다. 이번 판의 기도 기회는 다 썼습니다.`
                  : `기도했지만 응답을 놓쳤습니다. 이번 판의 기도 기회는 다 썼습니다.`}
              </p>
            ) : (
              <p className="text-gray-500">이번 판의 중보 기도 기회를 이미 사용했습니다.</p>
            )
          ) : gm.activeIntercession ? (
            <div>
              <p className="text-gray-400 mb-1">
                {gm.activeIntercession.targetName}님을 위해 기도합니다. 말씀 문제를 맞히면 부활합니다.
              </p>
              <p className="font-semibold text-white mb-2">{gm.activeIntercession.question.question}</p>
              <div className="space-y-1 mb-2">
                {gm.activeIntercession.question.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      playUiClick();
                      gm.answerIntercession(i);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-sky-700/60 cursor-pointer ${PRESS_FX}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  playUiClick();
                  gm.cancelIntercession();
                }}
                className={`text-gray-500 hover:text-gray-300 cursor-pointer ${PRESS_FX}`}
              >
                다른 사람을 위해 기도할게요
              </button>
            </div>
          ) : gm.deadBodies.length === 0 ? (
            <p className="text-gray-500">아직 기도할 대상(쓰러진 사람)이 없습니다.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-gray-400 mb-1">단 한 번뿐인 기회입니다 — 신중히 선택하세요.</p>
              {gm.deadBodies.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    playUiClick();
                    gm.beginIntercession(b.id);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-sky-700/60 cursor-pointer ${PRESS_FX}`}
                >
                  {b.victimName}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}