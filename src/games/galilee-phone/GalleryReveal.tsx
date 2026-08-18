import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GameManager } from "./GameManager";
import { ChainEntry, REACTION_EMOJIS } from "./types";

type FloatingReaction = { id: number; emoji: string };

const AUTOPLAY_INTERVAL_MS = 5000;

/**
 * 갤러리 공개 페이즈. 두 서브 화면으로 구성된다:
 *  1) 공개 시작 전 — 원작자 본인 또는 방장이 특정 체인을 "이 체인은 공개하지 않기"로 스킵할 수 있는 확인 화면 (GDD 3.6절)
 *  2) 공개 중 — 체인 하나를 처음(프롬프트)부터 끝까지 카카오톡 대화창처럼 위→아래로 순서대로 슬라이드 공개 (GDD 4.1절)
 * 방장이 "다음"으로 진행하거나 "자동 재생"을 켤 수 있고, 전원이 이모지로 실시간 리액션을 보낼 수 있다.
 */
export function GalleryReveal({ gm }: { gm: GameManager }) {
  const [, forceUpdate] = useState(0);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const floatingIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rerender = () => forceUpdate((n) => n + 1);
    const onReaction = (payload: { emoji: string }) => {
      const id = floatingIdRef.current++;
      setFloating((prev) => [...prev, { id, emoji: payload.emoji }]);
      setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== id)), 1600);
    };
    gm.on("reveal-update", rerender);
    gm.on("phase-change", rerender);
    gm.on("reaction", onReaction);
    return () => {
      gm.off("reveal-update", rerender);
      gm.off("phase-change", rerender);
      gm.off("reaction", onReaction);
    };
  }, [gm]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [gm.revealChainIdx, gm.revealEntryCount]);

  // 방장 쪽에서만 자동 재생 타이머를 굴린다 (진행 신호는 방장 한 명만 broadcast하면 충분)
  useEffect(() => {
    if (!gm.isHost || !gm.autoPlay || !gm.revealStarted || gm.isRevealFinished) return;
    const id = setInterval(() => gm.revealNext(), AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [gm, gm.isHost, gm.autoPlay, gm.revealStarted, gm.revealChainIdx, gm.revealEntryCount, gm.isRevealFinished]);

  if (!gm.revealStarted) {
    return <PreRevealGate gm={gm} />;
  }

  const chain = gm.currentRevealChain;

  if (gm.isRevealFinished || !chain) {
    return (
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 text-white text-center flex flex-col gap-4">
        <p className="text-2xl">🎉</p>
        <p className="text-sm text-gray-300">모든 체인 공개가 끝났어요!</p>
        {gm.isHost ? (
          <button
            onClick={() => gm.finishReveal()}
            className="w-full py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium"
          >
            🏆 시상식으로 넘어가기
          </button>
        ) : (
          <p className="text-xs text-gray-500">방장이 시상식을 시작하길 기다리는 중...</p>
        )}
      </div>
    );
  }

  const shownEntries = chain.entries.slice(0, gm.revealEntryCount);
  const chainNum = gm.revealChainIdx + 1;
  const chainTotal = gm.visibleChains.length;

  return (
    <div className="relative w-full max-w-md bg-gray-800 rounded-2xl p-4 sm:p-6 text-white flex flex-col gap-3">
      {/* 플로팅 리액션 애니메이션 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <AnimatePresence>
          {floating.map((f) => (
            <motion.span
              key={f.id}
              initial={{ opacity: 1, y: 0, x: Math.random() * 60 - 30 }}
              animate={{ opacity: 0, y: -160 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
              className="absolute bottom-24 left-1/2 text-3xl"
            >
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">📖 갤러리 공개</h2>
        <div className="flex items-center gap-2">
          {gm.settings.teamMode &&
            (() => {
              const team = gm.teamForChain(chain);
              if (!team) return null;
              const meta = gm.settings.teamLabels[team];
              return (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 border border-gray-600">
                  {meta.emoji} {meta.label}
                </span>
              );
            })()}
          <span className="text-xs text-gray-400">
            체인 {chainNum} / {chainTotal}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="w-full max-h-[420px] overflow-y-auto flex flex-col gap-2 bg-gray-900 rounded-xl p-3"
      >
        <AnimatePresence initial={false}>
          {shownEntries.map((entry, i) => (
            <motion.div
              key={`${chain.id}-${i}`}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <EntryBubble entry={entry} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => gm.sendReaction(emoji)}
            className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-lg flex items-center justify-center cursor-pointer border border-gray-600"
          >
            {emoji}
          </button>
        ))}
      </div>

      {gm.isHost ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => gm.revealNext()}
            className="flex-1 py-2.5 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium text-sm"
          >
            다음 ▶
          </button>
          <button
            onClick={() => gm.toggleAutoPlay()}
            className={`px-3 py-2.5 rounded-lg cursor-pointer text-xs border ${
              gm.autoPlay ? "bg-amber-900/50 border-amber-600 text-amber-300" : "bg-gray-700 border-gray-600 text-gray-300"
            }`}
          >
            ⏱️ 자동재생 {gm.autoPlay ? "ON" : "OFF"}
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-gray-500">방장이 다음으로 넘기길 기다리는 중...</p>
      )}
    </div>
  );
}

/** 프롬프트/추측(텍스트)은 말풍선으로, 그림은 이미지로 표시한다. */
function EntryBubble({ entry }: { entry: ChainEntry }) {
  if (entry.type === "drawing") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500">🎨 {entry.authorName}</span>
        <div className="rounded-lg overflow-hidden border border-gray-700 bg-white">
          <img src={entry.content} alt={`${entry.authorName}님의 그림`} className="w-full h-auto" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-gray-500">{entry.type === "prompt" ? "✍️" : "🔎"} {entry.authorName}</span>
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">{entry.content}</div>
    </div>
  );
}

/** 공개 시작 전 확인 화면. 각자 본인이 원작자인 체인을 숨길 수 있고, 방장은 아무 체인이나 숨길 수 있다. */
function PreRevealGate({ gm }: { gm: GameManager }) {
  const chains = gm.chains;
  return (
    <div className="w-full max-w-md bg-gray-800 rounded-2xl p-6 text-white flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold mb-1">📖 공개 전 확인</h2>
        <p className="text-xs text-gray-400">
          내 체인의 결과물이 공개되길 원치 않으면 숨길 수 있어요. 숨긴 체인은 조용히 제외되고, 다른 체인은 정상 공개돼요.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {chains.map((chain, idx) => {
          const ownerName = gm.playerNames.get(chain.originAuthorId) ?? "누군가";
          const canToggle = chain.originAuthorId === gm.userId || gm.isHost;
          return (
            <li
              key={chain.id}
              className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 text-sm"
            >
              <span className={chain.hidden ? "text-gray-600 line-through" : "text-gray-200"}>
                {gm.settings.teamMode &&
                  gm.teamForChain(chain) &&
                  `${gm.settings.teamLabels[gm.teamForChain(chain)!].emoji} `}
                {ownerName}님의 체인
              </span>
              {canToggle ? (
                <button
                  onClick={() => gm.setChainHidden(idx, !chain.hidden)}
                  className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer border ${
                    chain.hidden
                      ? "bg-gray-700 border-gray-600 text-gray-300"
                      : "bg-red-900/40 border-red-800 text-red-300"
                  }`}
                >
                  {chain.hidden ? "다시 공개하기" : "이 체인은 공개하지 않기"}
                </button>
              ) : (
                <span className="text-[11px] text-gray-600">{chain.hidden ? "숨김" : ""}</span>
              )}
            </li>
          );
        })}
      </ul>

      {gm.isHost ? (
        <button
          onClick={() => gm.startReveal()}
          className="w-full py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium"
        >
          ▶️ 공개 시작
        </button>
      ) : (
        <p className="text-center text-sm text-gray-400 py-2">방장이 공개를 시작하길 기다리는 중...</p>
      )}
    </div>
  );
}