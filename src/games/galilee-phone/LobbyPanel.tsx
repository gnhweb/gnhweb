import { useEffect, useState } from "react";
import { GameManager } from "./GameManager";
import {
  ALL_CATEGORIES,
  CATEGORY_LABEL,
  WRITE_TIME_OPTIONS,
  DRAW_TIME_OPTIONS,
  SEASONAL_PACK_LABEL,
  SeasonalPack,
  MIN_PLAYERS,
  MAX_PLAYERS,
  ALL_TEAMS,
  MIN_PLAYERS_PER_TEAM,
  TEAM_NAME_MAX_LENGTH,
  Player,
} from "./types";

/**
 * 로비 대기실. 참가자 리스트 + (방장 전용) 프롬프트 카테고리/타이머/시즌팩 설정 패널 + 시작 버튼.
 * pharisee/wolves-and-sheep의 로비 UI와 동일한 톤(다크 배경, 방장만 조정 가능 안내)을 따른다.
 */
export function LobbyPanel({ gm, onLeave }: { gm: GameManager; onLeave: () => void }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const rerender = () => forceUpdate((n) => n + 1);
    gm.on("lobby-update", rerender);
    gm.on("settings-update", rerender);
    gm.on("phase-change", rerender);
    return () => {
      gm.off("lobby-update", rerender);
      gm.off("settings-update", rerender);
      gm.off("phase-change", rerender);
    };
  }, [gm]);

  const isHost = gm.isHost;
  const players = gm.presenceOrder;
  const settings = gm.settings;

  const myIndex = players.findIndex((p) => p.id === gm.userId);
  const isOverflow = myIndex >= MAX_PLAYERS;
  const overflowCount = Math.max(0, players.length - MAX_PLAYERS);

  const toggleCategory = (cat: (typeof ALL_CATEGORIES)[number]) => {
    if (!isHost) return;
    const active = settings.activeCategories.includes(cat)
      ? settings.activeCategories.filter((c) => c !== cat)
      : [...settings.activeCategories, cat];
    gm.updateSettings({ activeCategories: active });
  };

  // 8단계: 최대 인원(12명)을 넘겨서 입장한 사람에게는 설정 패널 대신 "새 방을 만들어 나눠 진행하라"는
  // 안내만 보여준다 — 갤러리 공개 페이즈가 너무 길어지는 걸 막기 위한 GDD 3.1절 룰의 UX 반영.
  if (isOverflow) {
    return (
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-6 text-white flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold mb-1">🕊️ 갈릴리폰</h2>
          <p className="text-xs text-gray-400">
            방 코드: <span className="tracking-widest font-semibold text-amber-400">{gm.roomCode}</span>
          </p>
        </div>

        <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-amber-300">🚪 이 방은 이미 꽉 찼어요</p>
          <p className="text-xs text-gray-300 leading-relaxed">
            갈릴리폰은 갤러리 공개가 너무 길어지지 않도록 한 방에 최대 {MAX_PLAYERS}명까지만 함께해요. 지금{" "}
            {players.length}명이 모여 있어서 회원님은 대기 순번 {myIndex + 1}번째예요. 새 방을 만들어 남는 인원과
            따로 진행해 주세요!
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">참가자 ({players.length}명)</p>
          <ul className="flex flex-wrap gap-2">
            {players.map((p, i) => (
              <li
                key={p.id}
                className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${
                  i >= MAX_PLAYERS ? "bg-amber-950/50 text-amber-300 border border-amber-800" : "bg-gray-700"
                }`}
              >
                {i === 0 && <span title="방장">👑</span>}
                {p.name}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onLeave}
          className="w-full py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium"
        >
          🔀 새 방 만들러 나가기
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-gray-800 rounded-2xl p-6 text-white flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold mb-1">🕊️ 갈릴리폰</h2>
        <p className="text-xs text-gray-400">방 코드: <span className="tracking-widest font-semibold text-amber-400">{gm.roomCode}</span></p>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2">
          참가자 ({players.length}명, 최소 {MIN_PLAYERS}명 · 최대 {MAX_PLAYERS}명)
        </p>
        <ul className="flex flex-wrap gap-2">
          {players.map((p, i) => (
            <li
              key={p.id}
              className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${
                i >= MAX_PLAYERS ? "bg-amber-950/50 text-amber-300 border border-amber-800" : "bg-gray-700"
              }`}
            >
              {i === 0 && <span title="방장">👑</span>}
              {p.name}
            </li>
          ))}
        </ul>
        {overflowCount > 0 && (
          <p className="text-[11px] text-amber-400 mt-2">
            ⚠️ {overflowCount}명이 최대 인원을 넘겨 대기 중이에요. 새 방을 만들어 나눠 진행하도록 안내해주세요 —
            초과 인원에게는 자동으로 안내 화면이 보여요.
          </p>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-300">
          ⚙️ 게임 설정{!isHost ? " (방장만 변경 가능)" : ""}
        </p>

        <div>
          <p className="text-[11px] text-gray-500 mb-2">프롬프트 카테고리</p>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const active = settings.activeCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  disabled={!isHost}
                  className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer disabled:cursor-default ${
                    active
                      ? "bg-amber-700 border-amber-600 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400"
                  }`}
                >
                  {CATEGORY_LABEL[cat].emoji} {CATEGORY_LABEL[cat].label}
                </button>
              );
            })}
          </div>
          {settings.activeCategories.length === 0 && (
            <p className="text-[11px] text-red-400 mt-1.5">카테고리를 1개 이상 선택해야 시작할 수 있어요.</p>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-[11px] text-gray-500 mb-1.5">글쓰기 턴</p>
            <div className="flex gap-1.5">
              {WRITE_TIME_OPTIONS.map((sec) => (
                <TimerChip
                  key={sec}
                  active={settings.writeTimeSec === sec}
                  disabled={!isHost}
                  onClick={() => gm.updateSettings({ writeTimeSec: sec })}
                >
                  {sec}초
                </TimerChip>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-gray-500 mb-1.5">그리기 턴</p>
            <div className="flex gap-1.5">
              {DRAW_TIME_OPTIONS.map((sec) => (
                <TimerChip
                  key={sec}
                  active={settings.drawTimeSec === sec}
                  disabled={!isHost}
                  onClick={() => gm.updateSettings({ drawTimeSec: sec })}
                >
                  {sec}초
                </TimerChip>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] text-gray-500 mb-1.5">시즌 프롬프트 팩</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SEASONAL_PACK_LABEL) as SeasonalPack[]).map((pack) => (
              <TimerChip
                key={pack}
                active={settings.seasonalPack === pack}
                disabled={!isHost}
                onClick={() => gm.updateSettings({ seasonalPack: pack })}
              >
                {SEASONAL_PACK_LABEL[pack]}
              </TimerChip>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-800 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-300">⛵ 팀전 모드 (선택)</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {settings.teamLabels.galilee.emoji} {settings.teamLabels.galilee.label} vs{" "}
                {settings.teamLabels.tiberias.emoji} {settings.teamLabels.tiberias.label}로 나눠 리액션을 겨뤄봐요.
                승패보다 재미가 우선이라 순위는 매기지 않아요.
              </p>
            </div>
            <button
              onClick={() => gm.toggleTeamMode()}
              disabled={!isHost}
              className={`shrink-0 w-11 h-6 rounded-full cursor-pointer disabled:cursor-default transition-colors relative ${
                settings.teamMode ? "bg-amber-600" : "bg-gray-700"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.teamMode ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {settings.teamMode && <TeamAssignPanel gm={gm} isHost={isHost} players={players} />}
        </div>
      </div>

      {isHost ? (
        <button
          onClick={() => gm.startGame()}
          disabled={!gm.canStart}
          className="w-full py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg cursor-pointer disabled:cursor-default font-medium"
        >
          {gm.canStart
            ? "게임 시작"
            : players.length < MIN_PLAYERS
            ? `최소 ${MIN_PLAYERS}명 이상 모여야 시작할 수 있어요`
            : players.length > MAX_PLAYERS
            ? "인원이 너무 많아요 (12명 초과 시 방을 나눠주세요)"
            : settings.activeCategories.length === 0
            ? "카테고리를 1개 이상 선택해주세요"
            : `각 팀 최소 ${MIN_PLAYERS_PER_TEAM}명이 필요해요`}
        </button>
      ) : (
        <p className="text-center text-sm text-gray-400 py-2">방장이 게임을 시작하길 기다리는 중...</p>
      )}

      <button onClick={onLeave} className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
        방 나가기
      </button>
    </div>
  );
}

/**
 * 팀전 모드가 켜졌을 때 로비에 나타나는 팀 배정 패널.
 * 방장은 "팀 섞기"로 무작위 재배정하거나, 참가자 칩을 탭해 다른 팀으로 옮길 수 있다.
 * 최대 인원(12명)을 넘겨 대기 중인 사람은 팀 배정 대상에서 제외한다.
 */
function TeamAssignPanel({ gm, isHost, players }: { gm: GameManager; isHost: boolean; players: Player[] }) {
  const activePlayers = players.slice(0, MAX_PLAYERS);
  const counts = gm.teamCounts;
  const labels = gm.settings.teamLabels;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {ALL_TEAMS.map((team) => {
          const meta = labels[team];
          const teamPlayers = activePlayers.filter((p) => gm.playerTeams.get(p.id) === team);
          const short = counts[team] < MIN_PLAYERS_PER_TEAM;
          return (
            <div
              key={team}
              className={`rounded-lg p-2.5 border ${short ? "border-red-800/60 bg-red-950/20" : "border-gray-700 bg-gray-800"}`}
            >
              {isHost ? (
                <div className="flex items-center gap-1 mb-1.5">
                  <input
                    value={meta.emoji}
                    onChange={(e) => gm.updateTeamLabel(team, { emoji: e.target.value.slice(0, 4) })}
                    maxLength={4}
                    className="w-8 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-center text-xs outline-none focus:border-amber-400"
                  />
                  <input
                    value={meta.label}
                    onChange={(e) => gm.updateTeamLabel(team, { label: e.target.value.slice(0, TEAM_NAME_MAX_LENGTH) })}
                    maxLength={TEAM_NAME_MAX_LENGTH}
                    className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-amber-400"
                  />
                  <span className={`text-[10px] shrink-0 ${short ? "text-red-400" : "text-gray-500"}`}>
                    ({teamPlayers.length}명)
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-semibold mb-1.5">
                  {meta.emoji} {meta.label}{" "}
                  <span className={short ? "text-red-400" : "text-gray-500"}>({teamPlayers.length}명)</span>
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {teamPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => isHost && gm.setPlayerTeam(p.id, team === "galilee" ? "tiberias" : "galilee")}
                    disabled={!isHost}
                    title={isHost ? "탭해서 상대 팀으로 이동" : undefined}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-gray-700 hover:bg-gray-600 cursor-pointer disabled:cursor-default"
                  >
                    {p.name}
                  </button>
                ))}
                {teamPlayers.length === 0 && <span className="text-[10px] text-gray-600">아직 없음</span>}
              </div>
            </div>
          );
        })}
      </div>

      {(counts.galilee < MIN_PLAYERS_PER_TEAM || counts.tiberias < MIN_PLAYERS_PER_TEAM) && (
        <p className="text-[10px] text-red-400">각 팀 최소 {MIN_PLAYERS_PER_TEAM}명이 배정돼야 시작할 수 있어요.</p>
      )}

      {isHost && (
        <button
          onClick={() => gm.shuffleTeams()}
          className="w-full py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer text-[11px]"
        >
          🔀 팀 섞기
        </button>
      )}
    </div>
  );
}

function TimerChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer disabled:cursor-default ${
        active ? "bg-amber-700 border-amber-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}