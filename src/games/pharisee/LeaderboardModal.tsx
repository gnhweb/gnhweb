import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GameManager } from "./GameManager";
import { PlayerStatsRow, SeasonRow, SeasonStatsRow, getTitle, getRankTier } from "./types";

type Tab = "lifetime" | "season";

export default function LeaderboardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("lifetime");
  const [rows, setRows] = useState<PlayerStatsRow[] | null>(null);
  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [seasonRows, setSeasonRows] = useState<SeasonStatsRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchLifetime = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await GameManager.fetchLeaderboard(20);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "리더보드를 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSeason = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const activeSeason = await GameManager.fetchActiveSeason();
      setSeason(activeSeason);
      const data = await GameManager.fetchSeasonLeaderboard(activeSeason.id, 20);
      setSeasonRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "시즌 랭크를 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (tab === "lifetime") fetchLifetime();
    else fetchSeason();
  }, [isOpen, tab, fetchLifetime, fetchSeason]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col text-white"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h3 className="font-bold text-amber-300">🏆 명예의 전당</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white cursor-pointer text-sm">
                닫기
              </button>
            </div>
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setTab("lifetime")}
                className={`flex-1 py-2.5 text-xs cursor-pointer ${
                  tab === "lifetime" ? "text-amber-300 border-b-2 border-amber-500 -mb-px" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                누적 전적
              </button>
              <button
                onClick={() => setTab("season")}
                className={`flex-1 py-2.5 text-xs cursor-pointer ${
                  tab === "season" ? "text-amber-300 border-b-2 border-amber-500 -mb-px" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                🔥 시즌 랭크{season ? ` · ${season.label}` : ""}
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {loading && <p className="text-center text-sm text-gray-500 py-8">불러오는 중...</p>}
              {error && <p className="text-center text-sm text-rose-400 py-8">{error}</p>}

              {!loading && !error && tab === "lifetime" && rows?.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-8">아직 기록이 없어요. 첫 게임을 플레이해보세요!</p>
              )}
              {!loading &&
                !error &&
                tab === "lifetime" &&
                rows?.map((r, i) => {
                  const title = getTitle(r.wins);
                  const winRate = r.games_played > 0 ? Math.round((r.wins / r.games_played) * 100) : 0;
                  return (
                    <div key={r.user_id} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5">
                      <span className="w-6 text-center text-sm font-bold text-gray-400">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {title.emoji} {r.user_name}
                          <span className="text-[11px] text-amber-300 font-normal ml-1.5">{title.label}</span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {r.games_played}전 {r.wins}승 {r.losses}패 · 승률 {winRate}%
                          {r.mvp_count > 0 && ` · MVP ${r.mvp_count}회`}
                        </p>
                      </div>
                    </div>
                  );
                })}

              {!loading && !error && tab === "season" && seasonRows?.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-8">
                  이번 시즌엔 아직 기록이 없어요. 첫 판을 플레이해서 RP를 쌓아보세요!
                </p>
              )}
              {!loading &&
                !error &&
                tab === "season" &&
                seasonRows?.map((r, i) => {
                  const rank = getRankTier(r.rp);
                  const winRate = r.games_played > 0 ? Math.round((r.wins / r.games_played) * 100) : 0;
                  return (
                    <div key={r.user_id} className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5">
                      <span className="w-6 text-center text-sm font-bold text-gray-400">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {rank.emoji} {r.user_name}
                          <span className="text-[11px] text-amber-300 font-normal ml-1.5">
                            {rank.label} · {r.rp} RP
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {r.games_played}전 {r.wins}승 {r.losses}패 · 승률 {winRate}%
                          {r.mvp_count > 0 && ` · MVP ${r.mvp_count}회`}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}