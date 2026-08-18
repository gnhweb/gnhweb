import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { GameManager } from "./GameManager";
import { AWARD_LABEL, Chain, ALL_TEAMS, TeamLabel } from "./types";
import { FinalPhotoWall } from "./FinalPhotoWall";

/**
 * 시상식 페이즈 (GDD 4.2절). 두 서브 화면으로 구성된다:
 *  1) 투표 — awardCategories를 하나씩 순서대로, 전원이 후보 체인 중 하나에 투표.
 *     (chaos=웃음 참사상은 투표 대상이 아니라 갤러리 공개 중 리액션 집계로 자동 결정되므로 여기 등장하지 않는다.)
 *  2) 결과 공개 — 방장이 "결과 발표"를 누르면 카테고리별 우승 체인이 배지와 함께 컨페티 애니메이션으로 공개된다.
 * 순위 경쟁이 아니라 전원 참여형 "재미 배지" 개념이라 승패 연출은 피하고 다같이 웃는 톤을 유지한다.
 */
export function AwardsCeremony({ gm, onLeave }: { gm: GameManager; onLeave: () => void }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const rerender = () => forceUpdate((n) => n + 1);
    gm.on("award-update", rerender);
    gm.on("phase-change", rerender);
    return () => {
      gm.off("award-update", rerender);
      gm.off("phase-change", rerender);
    };
  }, [gm]);

  useEffect(() => {
    if (!gm.awardsRevealed) return;
    // 결과 공개 순간 화면 전체에 컨페티를 두어 번 터뜨린다
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
    const id = setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 } }), 350);
    return () => clearTimeout(id);
  }, [gm.awardsRevealed]);

  if (gm.awardsRevealed) {
    return <ResultsView gm={gm} onLeave={onLeave} />;
  }

  if (gm.awardCategories.length === 0) {
    return (
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 text-white text-center flex flex-col gap-4">
        <p className="text-2xl">🏆</p>
        <p className="text-sm text-gray-300">이번 판은 투표할 체인이 없어요. 바로 결과를 볼게요!</p>
        {gm.isHost ? (
          <button
            onClick={() => gm.revealAwards()}
            className="w-full py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium"
          >
            🎉 시상 결과 보기
          </button>
        ) : (
          <p className="text-xs text-gray-500">방장을 기다리는 중...</p>
        )}
      </div>
    );
  }

  if (gm.isVotingFinished) {
    return (
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 text-white text-center flex flex-col gap-4">
        <p className="text-2xl">🗳️</p>
        <p className="text-sm text-gray-300">모든 투표가 끝났어요!</p>
        {gm.isHost ? (
          <button
            onClick={() => gm.revealAwards()}
            className="w-full py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium"
          >
            🎉 시상 결과 발표하기
          </button>
        ) : (
          <p className="text-xs text-gray-500">방장이 결과를 발표하길 기다리는 중...</p>
        )}
      </div>
    );
  }

  return <VotingView gm={gm} />;
}

function VotingView({ gm }: { gm: GameManager }) {
  const category = gm.currentVotingCategory;
  if (!category) return null;
  const meta = AWARD_LABEL[category];
  const candidates = gm.candidateChainsFor(category);
  const myVote = gm.votes.get(category)?.get(gm.userId) ?? null;
  const catNum = gm.votingCategoryIdx + 1;
  const catTotal = gm.awardCategories.length;

  return (
    <div className="w-full max-w-md bg-gray-800 rounded-2xl p-4 sm:p-6 text-white flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">🗳️ 시상식 투표</h2>
        <span className="text-xs text-gray-400">
          {catNum} / {catTotal}
        </span>
      </div>

      <div className="text-center py-2">
        <div className="text-3xl">{meta.emoji}</div>
        <p className="text-lg font-bold mt-1">{meta.label}</p>
        <p className="text-xs text-gray-400 mt-1">{meta.desc}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto">
        {candidates.map((chain, i) => (
          <CandidateCard
            key={chain.id}
            chain={chain}
            index={i}
            selected={myVote === chain.id}
            onSelect={() => gm.castVote(chain.id)}
            teamLabel={(() => {
              const team = gm.teamForChain(chain);
              return team ? gm.settings.teamLabels[team] : null;
            })()}
          />
        ))}
      </div>

      <p className="text-center text-xs text-gray-500">{gm.votedCountForCurrentCategory} / {gm.playerOrder.length}명 투표함</p>

      {gm.isHost ? (
        <button
          onClick={() => gm.nextVotingCategory()}
          className="w-full py-2.5 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium text-sm"
        >
          {catNum === catTotal ? "투표 마감 ▶" : "다음 시상 항목 ▶"}
        </button>
      ) : (
        <p className="text-center text-xs text-gray-500">
          {gm.haveIVotedCurrentCategory ? "투표 완료! 방장이 다음으로 넘기길 기다리는 중..." : "체인 하나를 골라 투표해주세요"}
        </p>
      )}
    </div>
  );
}

function CandidateCard({
  chain,
  index,
  selected,
  onSelect,
  teamLabel,
}: {
  chain: Chain;
  index: number;
  selected: boolean;
  onSelect: () => void;
  teamLabel?: TeamLabel | null;
}) {
  const preview = chain.entries.find((e) => e.type === "drawing");
  const firstPrompt = chain.entries[0];
  const lastEntry = chain.entries[chain.entries.length - 1];

  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-lg p-2 border cursor-pointer flex flex-col gap-1.5 transition-colors ${
        selected ? "border-amber-400 bg-amber-900/30" : "border-gray-700 bg-gray-900 hover:border-gray-600"
      }`}
    >
      <span className="text-[10px] text-gray-500 flex items-center gap-1">
        체인 #{index + 1}
        {teamLabel && (
          <span className="px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700">{teamLabel.emoji}</span>
        )}
      </span>
      {preview ? (
        <div className="rounded overflow-hidden border border-gray-700 bg-white">
          <img src={preview.content} alt="체인 그림" className="w-full h-20 object-cover" />
        </div>
      ) : (
        <div className="rounded border border-gray-700 bg-gray-800 h-20 flex items-center justify-center text-[10px] text-gray-600">
          그림 없음
        </div>
      )}
      <p className="text-[11px] text-gray-400 line-clamp-1">시작: {firstPrompt?.content}</p>
      <p className="text-[11px] text-amber-300 line-clamp-1">최종: {lastEntry?.content}</p>
      {selected && <span className="text-[10px] text-amber-400 font-medium">✓ 내 투표</span>}
    </button>
  );
}

/**
 * 팀전 모드 결과 화면 하단에 붙는 "웃음 온도" 비교 (GDD 8절 팀전 변형).
 * 일부러 "승리/패배"라는 단어를 쓰지 않고 리액션 합계를 그래프로만 보여준다 — 순위 경쟁이 아니라
 * 전원 참여형 재미 배지라는 시상식 톤 원칙(GDD 4.2/5.2절)을 팀전에도 그대로 지키기 위함.
 */
function TeamScorePanel({ gm }: { gm: GameManager }) {
  const scores = gm.teamScores;
  const labels = gm.settings.teamLabels;
  const total = Math.max(1, scores.galilee + scores.tiberias);

  return (
    <div className="bg-gray-900 rounded-xl p-3 border border-gray-700 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-300 text-center">🌡️ 오늘의 웃음 온도</p>
      <div className="flex flex-col gap-1.5">
        {ALL_TEAMS.map((team) => {
          const meta = labels[team];
          const score = scores[team];
          const pct = Math.round((score / total) * 100);
          return (
            <div key={team} className="flex items-center gap-2">
              <span className="text-[11px] w-20 shrink-0 truncate">
                {meta.emoji} {meta.label}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full bg-amber-600 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 w-14 text-right">리액션 {score}개</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-500 text-center">순위가 아니라 오늘 다같이 얼마나 웃었는지 온도예요 🔥</p>
    </div>
  );
}

function ResultsView({ gm, onLeave }: { gm: GameManager; onLeave: () => void }) {
  const results = gm.awardResults;
  const allCategories = [...gm.awardCategories, "chaos" as const];

  return (
    <div className="w-full max-w-md bg-gray-800 rounded-2xl p-4 sm:p-6 text-white flex flex-col gap-4">
      <div className="text-center">
        <p className="text-2xl">🎉</p>
        <h2 className="text-lg font-bold mt-1">시상식 결과</h2>
        <p className="text-xs text-gray-400 mt-1">순위가 아니라 다같이 웃기 위한 재미 배지예요</p>
      </div>

      <div className="flex flex-col gap-3">
        <AnimatePresence>
          {allCategories.map((cat, i) => {
            const meta = AWARD_LABEL[cat];
            const result = results[cat];
            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: i * 0.15 }}
                className="bg-gray-900 rounded-xl p-3 flex gap-3 items-center border border-gray-700"
              >
                <div className="text-3xl shrink-0">{meta.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{meta.label}</p>
                  {result ? (
                    <>
                      <p className="text-xs text-amber-300 truncate">
                        {gm.playerNames.get(result.chain.originAuthorId) ?? "누군가"}님의 체인
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {cat === "chaos" ? `리액션 ${result.count}개` : `${result.count}표`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">이번 판엔 주인공이 없었어요</p>
                  )}
                </div>
                {result?.chain.entries.find((e) => e.type === "drawing") && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-700 bg-white shrink-0">
                    <img
                      src={result.chain.entries.find((e) => e.type === "drawing")!.content}
                      alt="수상 체인 그림"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {gm.settings.teamMode && <TeamScorePanel gm={gm} />}

      <FinalPhotoWall gm={gm} />

      <div className="flex gap-2 mt-1">
        {gm.isHost ? (
          <button
            onClick={() => gm.playAgain()}
            className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium text-sm"
          >
            🔄 다시하기
          </button>
        ) : (
          <p className="flex-1 text-center text-xs text-gray-500 py-3">방장이 다시하기를 누르면 새 판이 시작돼요</p>
        )}
        <button
          onClick={onLeave}
          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer text-sm"
        >
          나가기
        </button>
      </div>
    </div>
  );
}