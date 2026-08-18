import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/useAuth";
import { MAX_CHAT_LENGTH } from "@/lib/chatSafety";
import { GameManager, ReactionEvent } from "./GameManager";
import LeaderboardModal from "./LeaderboardModal";
import { soundEngine } from "./SoundEngine";
import {
  MIN_PLAYERS,
  ROLE_INFO,
  ROLE_LABEL,
  ROLE_REVEAL_TEXT,
  VERSE_HELPERS,
  REACTIONS,
  TIMER_OPTIONS,
  PHARISEE_RATIO_OPTIONS,
  SPECIAL_ROLES_THRESHOLD_OPTIONS,
  ADVANCED_ROLES_MIN_PLAYERS,
  isPhariseeAlignedForWin,
  getTitle,
  getRankTier,
  PlayerStatsRow,
  SeasonRow,
  SeasonStatsRow,
  Role,
  RoomSettings,
  NightStep,
  buildNightSequence,
  nightStepIndex,
} from "./types";

/** 7살도 이해할 수 있게 아주 쉽게 풀어쓴 게임 규칙 · 역할 설명 모달 (버튼으로 열고 닫음) */
function RulesModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"how" | "roles">("how");

  const roleGuide: { role: Role; simple: string }[] = [
    { role: "citizen", simple: "그냥 착한 편이에요. 힘은 없지만 투표로 나쁜 편을 찾는 걸 도와줘요." },
    { role: "pharisee", simple: "나쁜 편이에요. 밤마다 몰래 친구들과 의논해서 한 명을 사라지게 해요." },
    { role: "intercessor", simple: "밤마다 한 명을 골라서 지켜줄 수 있어요. 나를 지켜도 돼요!" },
    { role: "prophet", simple: "밤마다 한 명을 골라서 그 사람이 나쁜 편인지 알아볼 수 있어요." },
    { role: "deacon", simple: "밤마다 한 명을 몸으로 지켜줘요. 그 사람이 공격받으면 대신 사라져요." },
    { role: "traitor", simple: "겉으로는 착한 척하지만, 사실은 나쁜 편이에요. 누가 나쁜 편인지 다 알아요." },
    { role: "martyr", simple: "억울하게 뽑혀서 나가게 되어도, 마지막으로 딱 한 번 나쁜 사람을 알려줄 수 있어요." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800 rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto text-white"
      >
        <div className="sticky top-0 bg-gray-800 flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-700">
          <h2 className="font-bold text-lg">📖 게임 규칙 · 역할</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white cursor-pointer text-xl leading-none px-1">
            ✕
          </button>
        </div>
        <div className="flex px-4 pt-3 gap-2">
          <button
            onClick={() => setTab("how")}
            className={`flex-1 py-2 rounded-lg text-sm cursor-pointer ${
              tab === "how" ? "bg-amber-700" : "bg-gray-900 text-gray-400"
            }`}
          >
            게임 방법
          </button>
          <button
            onClick={() => setTab("roles")}
            className={`flex-1 py-2 rounded-lg text-sm cursor-pointer ${
              tab === "roles" ? "bg-amber-700" : "bg-gray-900 text-gray-400"
            }`}
          >
            역할 소개
          </button>
        </div>

        {tab === "how" ? (
          <div className="px-4 py-4 space-y-3 text-sm leading-relaxed">
            <p>
              🐍 <b>나쁜 편(바리새인)</b>과 🕊️ <b>착한 편(성도)</b>이 서로 숨바꼭질하는 게임이에요.
            </p>
            <div className="bg-gray-900 rounded-lg p-3 space-y-2">
              <p>🌙 <b>밤</b>: 다 같이 눈을 감아요. 나쁜 편은 몰래 한 명을 골라요.</p>
              <p>💬 <b>낮</b>: 눈을 뜨고 누가 나쁜 편인지 이야기해요.</p>
              <p>🗳️ <b>투표</b>: 제일 의심스러운 사람에게 투표해요. 제일 많이 뽑힌 사람은 나가요.</p>
            </div>
            <p className="bg-gray-900 rounded-lg p-3">
              🏆 <b>이기는 법</b>: 나쁜 편을 모두 찾아내면 착한 편이 이겨요! 나쁜 편 수가 착한 편 수와 같아지면 나쁜 편이 이겨요.
            </p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-2">
            {roleGuide.map(({ role, simple }) => (
              <div key={role} className="bg-gray-900 rounded-lg p-3 flex gap-2.5 items-start">
                <span className="text-xl leading-none">{ROLE_INFO[role].emoji}</span>
                <div>
                  <p className="font-medium text-sm">{ROLE_LABEL[role]}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{simple}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 남은 시간이 얼마 없을 때 붉게 펄스를 주는 타이머 뱃지 — 낮/밤 전환 임박 시 긴장감용 */
function TimerBadge({ left }: { left: number }) {
  const urgent = left <= 10;
  return (
    <motion.span
      animate={urgent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 0.6, repeat: Infinity } : {}}
      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
        urgent ? "bg-rose-600 text-white" : "bg-gray-900 text-gray-300"
      }`}
    >
      ⏱ {left}초
    </motion.span>
  );
}

/** 사운드 on/off 토글 — 로비/종료 화면 상단에 배치 */
function MuteToggle() {
  const [muted, setMuted] = useState(soundEngine.muted);
  return (
    <button
      onClick={() => {
        soundEngine.unlock();
        setMuted(soundEngine.toggleMute());
      }}
      title={muted ? "소리 켜기" : "소리 끄기"}
      className="text-xs w-7 h-7 flex items-center justify-center rounded-full bg-gray-900 hover:bg-gray-700 border border-gray-700 cursor-pointer"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

function fmtMs(ms: number) {
  return `${Math.round(ms / 1000)}초`;
}

/** 로비 방 설정 패널 — 방장은 조절, 참가자는 현재 값만 읽기 전용으로 확인 */
function RoomSettingsPanel({ gm }: { gm: GameManager }) {
  const [open, setOpen] = useState(false);
  const s = gm.settings;

  const set = (partial: Partial<RoomSettings>) => gm.updateSettings(partial);

  if (!gm.isHost) {
    return (
      <div className="w-full bg-gray-900 rounded-xl p-4 text-[11px] text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
        <span>🌙 밤 {fmtMs(s.nightMs)}</span>
        <span>💬 토론 {fmtMs(s.discussMs)}</span>
        <span>🗳️ 투표 {fmtMs(s.voteMs)}</span>
        <span>🐍 바리새인 1/{s.phariseeRatio}</span>
        <span>🛡️ 특수역할 {s.specialRolesMinPlayers}명+</span>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-900 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-300 cursor-pointer hover:bg-gray-800"
      >
        <span>⚙️ 방 설정 조절하기</span>
        <span className="text-gray-500">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-800">
          <SettingRow label="🌙 밤 시간">
            {TIMER_OPTIONS.nightMs.map((ms) => (
              <ChipButton key={ms} active={s.nightMs === ms} onClick={() => set({ nightMs: ms })}>
                {fmtMs(ms)}
              </ChipButton>
            ))}
          </SettingRow>
          <SettingRow label="💬 낮 토론 시간">
            {TIMER_OPTIONS.discussMs.map((ms) => (
              <ChipButton key={ms} active={s.discussMs === ms} onClick={() => set({ discussMs: ms })}>
                {fmtMs(ms)}
              </ChipButton>
            ))}
          </SettingRow>
          <SettingRow label="🗳️ 투표 시간">
            {TIMER_OPTIONS.voteMs.map((ms) => (
              <ChipButton key={ms} active={s.voteMs === ms} onClick={() => set({ voteMs: ms })}>
                {fmtMs(ms)}
              </ChipButton>
            ))}
          </SettingRow>
          <SettingRow label="🐍 바리새인 비율">
            {PHARISEE_RATIO_OPTIONS.map((r) => (
              <ChipButton key={r} active={s.phariseeRatio === r} onClick={() => set({ phariseeRatio: r })}>
                1/{r}
              </ChipButton>
            ))}
          </SettingRow>
          <SettingRow label="🛡️ 안수집사·배신자 등장 인원">
            {SPECIAL_ROLES_THRESHOLD_OPTIONS.map((n) => (
              <ChipButton key={n} active={s.specialRolesMinPlayers === n} onClick={() => set({ specialRolesMinPlayers: n })}>
                {n}명+
              </ChipButton>
            ))}
          </SettingRow>
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer border ${
        active ? "bg-amber-700 border-amber-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function PhariseeGame() {
  const { user, profile, profileError } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const roomCode = searchParams.get("room") || "";
  const [joinInput, setJoinInput] = useState("");
  const [showRules, setShowRules] = useState(false);

  if (!roomCode) {
    return (
      <div className="text-white flex flex-col items-center gap-4 bg-gray-800 rounded-2xl p-8 w-[90%] max-w-sm">
        <button
          onClick={() => {
            soundEngine.unlock();
            setSearchParams({ room: randomRoomCode() });
          }}
          className="w-full py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium"
        >
          새 방 만들기
        </button>
        <div className="flex items-center gap-2 w-full">
          <div className="h-px bg-gray-600 flex-1" />
          <span className="text-xs text-gray-500">또는</span>
          <div className="h-px bg-gray-600 flex-1" />
        </div>
        <div className="flex gap-2 w-full">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="방 코드 입력"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center tracking-widest outline-none focus:border-amber-400"
          />
          <button
            onClick={() => {
              soundEngine.unlock();
              if (joinInput.trim()) setSearchParams({ room: joinInput.trim() });
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer"
          >
            참가
          </button>
        </div>
        <button
          onClick={() => setShowRules(true)}
          className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 rounded-lg cursor-pointer text-sm text-gray-300 flex items-center justify-center gap-1.5"
        >
          📖 게임 규칙 · 역할 알아보기
        </button>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  if (!user) {
    return <div className="text-white">로그인 정보를 불러오는 중...</div>;
  }

  // profile(닉네임 포함)이 아직 로딩 중이면 여기서 기다린다.
  // 이걸 기다리지 않고 바로 RoomView를 띄우면 이름이 "익명"으로 방에
  // 접속해버리고, 아래 RoomView의 useEffect는 [roomCode, userId]에만
  // 반응하므로 이름을 나중에 다시 불러와도 그 판 내내 "익명"으로 고정된다.
  if (!profile) {
    if (profileError) {
      return <div className="text-red-400 text-sm px-4 text-center">{profileError}</div>;
    }
    return <div className="text-white">프로필 정보를 불러오는 중...</div>;
  }

  return (
    <RoomView
      roomCode={roomCode}
      userId={user.id}
      userName={profile.name}
      onLeave={() => setSearchParams({})}
    />
  );
}

function useCountdown(endsAt: number) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 500);
    return () => clearInterval(t);
  }, [endsAt]);
  return left;
}

function RoomView({
  roomCode,
  userId,
  userName,
  onLeave,
}: {
  roomCode: string;
  userId: string;
  userName: string;
  onLeave: () => void;
}) {
  const gmRef = useRef<GameManager | null>(null);
  const [, tick] = useState(0);
  const [phase, setPhase] = useState<"lobby" | "night" | "day-discuss" | "day-vote" | "day-lastwords" | "ended">("lobby");
  const [roleRevealDone, setRoleRevealDone] = useState(false);
  const [textBanner, setTextBanner] = useState<string | null>(null);
  const [revealQueue, setRevealQueue] = useState<{ id: string; name: string; role: Role; cause: "night" | "vote" }[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<(ReactionEvent & { left: number })[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    const gm = new GameManager(roomCode, userId, userName);
    gmRef.current = gm;
    const rerender = () => tick((n) => n + 1);
    gm.on("lobby-update", rerender);
    gm.on("ability-update", rerender);
    gm.on("settings-update", rerender);
    gm.on("chat-update", rerender);
    gm.on("ghost-chat-update", rerender);
    gm.on("vote-update", rerender);
    gm.on("lastwords-update", rerender);
    gm.on("mvp-update", rerender);
    gm.on("chat-blocked", () => {
      setTextBanner("✋ 메시지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요.");
      setTimeout(() => setTextBanner(null), 2000);
    });
    gm.on("reaction", (payload: ReactionEvent) => {
      soundEngine.play("reaction");
      const withPos = { ...payload, left: 10 + Math.random() * 80 };
      setFloatingReactions((prev) => [...prev, withPos]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== payload.id));
      }, 2200);
    });
    gm.on("phase-change", (p: string) => {
      setPhase(p as any);
      if (p === "night" && gm.round === 1 && !gm.reconnected) setRoleRevealDone(false);
      // 재접속으로 인한 페이즈 복구는 연출 없이 조용히 처리 — 이미 진행 중이던 상황에
      // 갑자기 종/차임 소리가 겹쳐 울리면 오히려 어색하다
      if (gm.reconnected) {
        setRoleRevealDone(true);
        setTextBanner("🔄 게임에 다시 접속했습니다. 이어서 진행할게요!");
        setTimeout(() => setTextBanner(null), 4000);
        return;
      }
      if (gm.spectatorJoined) {
        setRoleRevealDone(true);
        setTextBanner("👀 진행 중인 게임에 관전자로 입장했습니다.");
        setTimeout(() => setTextBanner(null), 4000);
        return;
      }
      if (p === "night") soundEngine.play("nightStart");
      if (p === "day-vote") soundEngine.play("voteStart");
      if (p === "day-lastwords") soundEngine.play("lastWords");
      if (p === "ended") soundEngine.play(gm.winner === "citizen" ? "winCitizen" : "winPharisee");
      if (p === "day-discuss") {
        if (gm.lastNightVictimIds.length > 0) {
          soundEngine.play("eliminate");
          const cards = gm.lastNightVictimIds.map((id) => {
            const v = gm.players.get(id);
            return { id: `${id}-night-${gm.round}`, name: v?.name ?? "누군가", role: v?.role ?? ("citizen" as Role), cause: "night" as const };
          });
          setRevealQueue((prev) => [...prev, ...cards]);
        } else if (gm.lastNightSaved) {
          soundEngine.play("save");
          setTextBanner("🙏 누군가 중보 기도의 보호로 살아남았습니다...");
          setTimeout(() => setTextBanner(null), 4000);
        } else {
          soundEngine.play("dayStart");
          setTextBanner("🌅 밤사이 아무 일도 일어나지 않았습니다.");
          setTimeout(() => setTextBanner(null), 4000);
        }
      }
    });
    gm.on("vote-result", (ejectedId: string | null, martyrStrikeId?: string | null) => {
      if (ejectedId) {
        soundEngine.play("eliminate");
        const p = gm.players.get(ejectedId);
        setRevealQueue((prev) => [
          ...prev,
          { id: `${ejectedId}-vote-${gm.round}`, name: p?.name ?? "누군가", role: p?.role ?? "citizen", cause: "vote" },
        ]);
        if (martyrStrikeId) {
          const struck = gm.players.get(martyrStrikeId);
          setTextBanner(`✝️ ${p?.name ?? "순교자"}님의 고발이 적중했습니다! ${struck?.name ?? "누군가"}님도 함께 처단됩니다.`);
          setTimeout(() => setTextBanner(null), 4500);
          setRevealQueue((prev) => [
            ...prev,
            {
              id: `${martyrStrikeId}-martyr-${gm.round}`,
              name: struck?.name ?? "누군가",
              role: struck?.role ?? "citizen",
              cause: "vote",
            },
          ]);
        }
      } else {
        soundEngine.play("tie");
        setTextBanner("⚖️ 동점으로 아무도 출교되지 않았습니다.");
        setTimeout(() => setTextBanner(null), 4500);
      }
    });
    return () => gm.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, userId]);

  const gm = gmRef.current;

  // Must be BEFORE all early-return branches — React hooks must always run in the same order.
  const headerLeft = useCountdown(gm ? gm.phaseEndsAt : Date.now());

  if (!gm) return <div className="text-white">연결 중...</div>;

  if (phase === "lobby") {
    const canStart = gm.isHost && gm.presenceOrder.length >= MIN_PLAYERS;
    return (
      <div className="text-white flex flex-col items-center gap-5 bg-gray-800 rounded-2xl p-8 w-[90%] max-w-md">
        <div className="w-full flex justify-end gap-2 -mb-2">
          <MuteToggle />
          <button
            onClick={() => setShowLeaderboard(true)}
            className="text-xs px-3 py-1.5 rounded-full bg-gray-900 hover:bg-gray-700 border border-gray-700 cursor-pointer text-amber-200"
          >
            🏆 명예의 전당
          </button>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-400">방 코드</p>
          <p className="text-3xl font-black tracking-[0.3em] text-amber-300">{roomCode}</p>
        </div>
        <div className="w-full bg-gray-900 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-2">참가자 ({gm.presenceOrder.length}명, 최소 {MIN_PLAYERS}명 필요)</p>
          <div className="space-y-1.5">
            {gm.presenceOrder.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span>{i === 0 ? "👑" : "🕊️"}</span>
                <span>{p.name}</span>
                {p.id === userId && <span className="text-xs text-gray-500">(나)</span>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            인원의 약 1/{gm.settings.phariseeRatio}이 바리새인으로 배정되고, 중보 기도자·선지자가 함께 등장해요.
            {gm.presenceOrder.length >= gm.settings.specialRolesMinPlayers
              ? ` ${gm.settings.specialRolesMinPlayers}명 이상이라 안수집사·배신자도 함께 등장해요.`
              : ` (${gm.settings.specialRolesMinPlayers}명 이상이면 안수집사·배신자도 등장해요)`}
            {gm.presenceOrder.length >= ADVANCED_ROLES_MIN_PLAYERS
              ? ` ${ADVANCED_ROLES_MIN_PLAYERS}명 이상이라 순교자도 함께 등장해요.`
              : ` (${ADVANCED_ROLES_MIN_PLAYERS}명 이상이면 순교자도 등장해요)`}
          </p>
        </div>
        <RoomSettingsPanel gm={gm} />
        {gm.isHost ? (
          <button
            onClick={() => {
              soundEngine.unlock();
              gm.startGame();
            }}
            disabled={!canStart}
            className="w-full py-3 rounded-lg font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 bg-amber-700 hover:bg-amber-600"
          >
            {canStart ? "게임 시작" : `최소 ${MIN_PLAYERS}명 이상 모여야 시작할 수 있어요`}
          </button>
        ) : (
          <p className="text-sm text-gray-400">방장이 게임을 시작하길 기다리는 중...</p>
        )}
        <button onClick={onLeave} className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
          방 나가기
        </button>
        <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      </div>
    );
  }

  if (phase === "ended") {
    return <EndScreen gm={gm} onExit={onLeave} />;
  }

  if (!roleRevealDone) {
    return <RoleRevealOverlay role={gm.myRole} onDone={() => setRoleRevealDone(true)} />;
  }

  return (
    <div className="text-white w-[94%] max-w-2xl relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-amber-300 flex items-center gap-2">
          {gm.round}일째 ·{" "}
          {phase === "night"
            ? "🌙 밤"
            : phase === "day-discuss"
            ? "☀️ 낮 토론"
            : phase === "day-lastwords"
            ? "🕯️ 마지막 유언"
            : "🗳️ 투표"}
          <TimerBadge left={headerLeft} />
        </h2>
        <span className="text-xs text-gray-400 flex items-center gap-2">
          {gm.isSpectator && <span className="px-2 py-0.5 rounded-full bg-violet-900/60 text-violet-200 text-[10px]">👀 관전 중</span>}
          생존 {gm.alivePlayers.length} / {gm.players.size}
        </span>
      </div>
      {textBanner && (
        <div className="mb-3 bg-gray-900/95 border border-amber-700/50 px-4 py-2 rounded-lg text-sm text-center">
          {textBanner}
        </div>
      )}
      {phase === "night" && <NightSequenceBanner gm={gm} />}
      {phase === "night" && <NightView gm={gm} />}
      {phase === "day-discuss" && <DayDiscussView gm={gm} />}
      {phase === "day-vote" && <DayVoteView gm={gm} />}
      {phase === "day-lastwords" && <LastWordsView gm={gm} />}
      {!gm.me?.alive && <GhostChatPanel gm={gm} />}
      <FloatingReactions reactions={floatingReactions} />
      <AnimatePresence>
        {revealQueue[0] && (
          <RevealCardOverlay
            key={revealQueue[0].id}
            card={revealQueue[0]}
            onDone={() => setRevealQueue((prev) => prev.slice(1))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** 화면 하단에서 위로 떠오르며 사라지는 리액션 이모지들 */
function FloatingReactions({ reactions }: { reactions: (ReactionEvent & { left: number })[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 h-64 z-30 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -180, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.1, ease: "easeOut" }}
            className="absolute bottom-0 text-2xl"
            style={{ left: `${r.left}%` }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** 낮/투표 중 가볍게 반응을 던질 수 있는 이모지 바 */
function ReactionBar({ gm }: { gm: GameManager }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => gm.sendReaction(emoji)}
          className="text-base px-2 py-1 rounded-full bg-gray-900 hover:bg-gray-700 border border-gray-700 cursor-pointer"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** 투표로 지목된 사람이 출교 확정 전 마지막으로 발언하는 페이즈 */
function LastWordsView({ gm }: { gm: GameManager }) {
  const left = useCountdown(gm.phaseEndsAt);
  const [input, setInput] = useState("");
  const target = gm.lastWordsTargetId ? gm.players.get(gm.lastWordsTargetId) : null;
  const isMe = gm.userId === gm.lastWordsTargetId;

  const send = () => {
    if (!input.trim()) return;
    gm.sendLastWords(input.trim());
    setInput("");
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-sm text-center text-amber-300 mb-1">
        🕯️ {target?.name ?? "누군가"}님이 가장 많은 표를 받았습니다
      </p>
      <p className="text-xs text-center text-gray-500 mb-3">
        {isMe ? "출교되기 전, 마지막으로 자신을 변론하세요" : "정체가 밝혀지기 전, 마지막 발언을 들어보세요"} (남은 시간 {left}초)
      </p>
      <div className="bg-gray-900 rounded-lg h-40 overflow-y-auto p-3 mb-3 space-y-1 text-sm">
        {gm.lastWordsMsgs.length === 0 && <p className="text-gray-500 text-center">{isMe ? "이제 말씀하세요..." : "아직 발언이 없습니다..."}</p>}
        {gm.lastWordsMsgs.map((m) => (
          <p key={m.id}>
            <span className="text-amber-300 font-semibold">{m.senderName}: </span>
            <span>{m.text}</span>
          </p>
        ))}
      </div>
      {isMe && (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            maxLength={MAX_CHAT_LENGTH}
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-amber-400"
            placeholder="마지막으로 남길 말..."
          />
          <button onClick={send} className="px-4 py-2 bg-amber-700 rounded-lg cursor-pointer hover:bg-amber-600">
            전송
          </button>
        </div>
      )}
      {gm.myRole === "martyr" && isMe && <MartyrAccuseButton gm={gm} />}
    </div>
  );
}

/** 순교자 전용 — 자신이 지목되어 마지막 유언 중일 때, 게임당 1회 한 사람을 고발하는 UI */
function MartyrAccuseButton({ gm }: { gm: GameManager }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  if (gm.martyrAccusedTargetId) {
    const accused = gm.players.get(gm.martyrAccusedTargetId);
    return (
      <p className="text-[11px] text-gray-500 text-center mt-3">
        ✝️ {accused?.name ?? "누군가"}님을 이미 고발했습니다. 결과는 곧 밝혀집니다.
      </p>
    );
  }
  if (!gm.canMartyrAccuse()) return null;
  const targets = [...gm.players.values()].filter((p) => p.alive && p.id !== gm.userId);
  const pickedName = targets.find((p) => p.id === picked)?.name ?? "이 사람";

  if (!confirming) {
    return (
      <div className="mt-3 bg-gray-900 rounded-lg p-3">
        <p className="text-xs text-gray-400 mb-2 text-center">
          ✝️ 순교자의 권한으로 한 사람을 고발할 수 있습니다. 그가 정말 바리새인 편이라면 함께 처단됩니다 (게임당 1회).
        </p>
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {targets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPicked(p.id)}
              className={`w-full px-3 py-2 rounded-lg text-left text-sm cursor-pointer ${
                picked === p.id ? "bg-amber-800" : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => picked && setConfirming(true)}
          disabled={!picked}
          className="w-full mt-2 py-2 rounded-lg bg-rose-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-rose-700 cursor-pointer text-sm"
        >
          고발하기
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3 bg-gray-900 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-400 mb-2">
        정말 {pickedName}님을 고발할까요? 이 능력은 게임 중 딱 한 번만 쓸 수 있고, 고발이 빗나가도 되돌릴 수 없어요.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer text-sm"
        >
          취소
        </button>
        <button
          onClick={() => {
            if (picked) gm.martyrAccuse(picked);
            setConfirming(false);
          }}
          className="flex-1 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 cursor-pointer text-sm"
        >
          고발 확정
        </button>
      </div>
    </div>
  );
}

function RoleRevealOverlay({ role, onDone }: { role: Role; onDone: () => void }) {
  const [flipped, setFlipped] = useState(false);
  // 카드 뒤집기는 순수 연출용 1회성 타이머라 onDone과 무관하게 그대로 둔다.
  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 500);
    return () => clearTimeout(t1);
  }, []);
  const info = ROLE_INFO[role];
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white px-6" style={{ perspective: 800 }}>
      <motion.div
        animate={{ rotateY: flipped ? 0 : 180 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d" }}
        className="flex flex-col items-center"
      >
        <p className="text-6xl mb-4">{flipped ? info.emoji : "🎴"}</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: flipped ? 1 : 0, y: flipped ? 0 : 8 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-center flex flex-col items-center"
      >
        <h2 className="text-2xl font-bold mb-2">{info.title}</h2>
        <p className="text-sm text-gray-400 max-w-xs mb-6">{info.desc}</p>
        {flipped && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={onDone}
            className="px-6 py-2.5 bg-amber-700 hover:bg-amber-600 rounded-lg font-medium cursor-pointer"
          >
            확인했어요, 시작할게요 🙏
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}

/** 밤에 침묵당하거나 낮 투표로 출교된 사람의 정체를 극적으로 공개하는 카드 */
function RevealCardOverlay({
  card,
  onDone,
}: {
  card: { id: string; name: string; role: Role; cause: "night" | "vote" };
  onDone: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  // onDone은 부모가 렌더링될 때마다 새로 만들어지는 인라인 함수라서
  // 그대로 deps에 넣으면 채팅/이벤트가 올 때마다 타이머가 계속 리셋되어
  // 카드가 영원히 안 넘어갈 수 있다. ref에 최신 함수만 담아두고
  // effect 자체는 카드가 바뀔 때(컴포넌트가 새로 마운트될 때) 한 번만 돈다.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 600);
    const t2 = setTimeout(() => onDoneRef.current(), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const info = ROLE_INFO[card.role];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-white px-6"
      onClick={onDone}
    >
      <p className="text-sm text-gray-400 mb-3">
        {card.cause === "night" ? "🕯️ 밤사이 침묵당한 이가 있습니다" : "⚖️ 공동체의 결단으로 출교되었습니다"}
      </p>
      <div style={{ perspective: 800 }}>
        <motion.div
          animate={{ rotateY: flipped ? 0 : 180, scale: flipped ? [1, 1.08, 1] : 1 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="w-44 h-56 rounded-2xl bg-gradient-to-b from-gray-800 to-gray-900 border-2 border-amber-700/60 flex flex-col items-center justify-center shadow-xl"
        >
          {flipped ? (
            <>
              <p className="text-5xl mb-2">{info.emoji}</p>
              <p className="font-bold">{card.name}</p>
              <p className="text-xs text-amber-300 mt-1">{ROLE_LABEL[card.role]}</p>
            </>
          ) : (
            <p className="text-6xl">🎴</p>
          )}
        </motion.div>
      </div>
      <p className="text-xs text-gray-500 mt-4">화면을 탭하면 넘어갑니다</p>
    </motion.div>
  );
}

/** 사망한 플레이어와 관전자가 함께 쓰는 채팅 패널 — 탈락해도, 구경만 해도 계속 참여감을 느끼게 함 */
function GhostChatPanel({ gm }: { gm: GameManager }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const label = gm.isSpectator ? "관전자 채팅" : "유령 채팅";
  const icon = gm.isSpectator ? "👀" : "👻";
  const send = () => {
    if (!input.trim()) return;
    gm.sendGhostChat(input.trim());
    setInput("");
  };
  return (
    <div className="fixed bottom-3 right-3 z-40 w-72 max-w-[90vw]">
      {open ? (
        <div className="bg-gray-900 border border-violet-700/50 rounded-xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 bg-violet-900/40">
            <span className="text-xs font-semibold text-violet-200">
              {icon} {label} {gm.isSpectator ? "(구경꾼·사망자 공용)" : "(사망자 전용)"}
            </span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white cursor-pointer text-xs">
              접기
            </button>
          </div>
          <div className="h-40 overflow-y-auto p-2 space-y-1 text-xs">
            {gm.ghostChatLog.length === 0 && <p className="text-gray-500">아직 대화가 없어요...</p>}
            {gm.ghostChatLog.map((m) => (
              <p key={m.id}>
                <span className="text-violet-300 font-semibold">{m.senderName}: </span>
                <span className="text-gray-200">{m.text}</span>
              </p>
            ))}
          </div>
          <div className="flex gap-1.5 p-2 border-t border-gray-800">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={MAX_CHAT_LENGTH}
              placeholder={gm.isSpectator ? "다른 구경꾼·사망자와 이야기하기..." : "다른 유령들과 이야기하기..."}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-violet-400"
            />
            <button onClick={send} className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-xs cursor-pointer">
              전송
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-violet-800/90 hover:bg-violet-700 text-white text-xs px-3 py-2 rounded-full shadow-lg cursor-pointer flex items-center gap-1.5"
        >
          {icon} {label}
          {gm.ghostChatLog.length > 0 ? ` (${gm.ghostChatLog.length})` : ""}
        </button>
      )}
    </div>
  );
}

/** 밤 페이즈 진행률에서 현재 몇 번째 순서 단계인지 계산 — phaseEndsAt은 이미 모든 클라이언트가
 * 동일하게 갖고 있으므로 별도 네트워크 이벤트 없이도 모두가 같은 순간에 같은 배너를 보게 된다. */
function useNightSequence(gm: GameManager) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [gm.phaseEndsAt]);

  const presentRoles = new Set<Role>();
  gm.players.forEach((p) => presentRoles.add(p.role));
  const steps: NightStep[] = buildNightSequence(presentRoles);
  const totalMs = gm.settings.nightMs;
  const nightStart = gm.phaseEndsAt - totalMs;
  const idx = nightStepIndex(now - nightStart, totalMs, steps.length);
  return { steps, idx };
}

/** 마피아42 스타일 "지금은 OO의 시간입니다" 순차 안내 배너.
 * 실제 능력 사용 가능 여부·판정 로직은 전혀 바꾸지 않는 순수 연출용 컴포넌트라
 * NightView와 별개로 두고 그 위에만 얹는다. */
function NightSequenceBanner({ gm }: { gm: GameManager }) {
  const { steps, idx } = useNightSequence(gm);
  const prevIdx = useRef(idx);
  useEffect(() => {
    if (idx !== prevIdx.current) {
      soundEngine.play("nightStep");
      prevIdx.current = idx;
    }
  }, [idx]);
  const step = steps[idx];
  if (!step) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.4 }}
        className="mb-3 bg-gray-950/80 border border-indigo-800/50 px-4 py-2.5 rounded-lg text-center text-sm text-indigo-200 flex items-center justify-center gap-2"
      >
        <span className="text-base">{step.icon}</span>
        <span>{step.label}</span>
      </motion.div>
    </AnimatePresence>
  );
}

function NightView({ gm }: { gm: GameManager }) {
  const left = useCountdown(gm.phaseEndsAt);
  const alive = gm.alivePlayers;
  const me = gm.me;

  if (!me?.alive) {
    return (
      <p className="text-center text-gray-500 text-sm py-10">
        {gm.isSpectator
          ? `👀 관전 중입니다. 밤 사이의 일은 낮에 공개됩니다... (남은 시간 ${left}초)`
          : `이미 침묵당한 당신은 밤의 결과를 조용히 지켜봅니다... (남은 시간 ${left}초)`}
      </p>
    );
  }

  if (gm.myRole === "pharisee") {
    const targets = alive.filter((p) => p.role !== "pharisee");
    const myVote = gm.phariseeVotes.get(gm.userId);
    return (
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-3">🐍 오늘 밤 침묵시킬 성도를 다른 바리새인과 함께 지목하세요 (남은 시간 {left}초)</p>
        <div className="space-y-2">
          {targets.map((p) => (
            <button
              key={p.id}
              onClick={() => gm.votePharisee(p.id)}
              className={`w-full flex justify-between px-4 py-2.5 rounded-lg text-left cursor-pointer ${
                myVote === p.id ? "bg-rose-800" : "bg-gray-900 hover:bg-gray-700"
              }`}
            >
              <span>{p.name}</span>
              <span className="text-xs text-gray-400">
                {[...gm.phariseeVotes.values()].filter((v) => v === p.id).length}표
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (gm.myRole === "intercessor") {
    return (
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-3">🙏 기도로 지킬 성도를 한 명 선택하세요 (본인 선택 가능, 남은 시간 {left}초)</p>
        <div className="space-y-2">
          {alive.map((p) => (
            <button
              key={p.id}
              onClick={() => gm.protectPlayer(p.id)}
              disabled={gm.intercessorUsedThisRound}
              className={`w-full px-4 py-2.5 rounded-lg text-left cursor-pointer disabled:cursor-not-allowed ${
                gm.protectedId === p.id ? "bg-emerald-800" : "bg-gray-900 hover:bg-gray-700"
              } ${gm.intercessorUsedThisRound && gm.protectedId !== p.id ? "opacity-40" : ""}`}
            >
              {p.name} {p.id === gm.userId && "(나)"}
            </button>
          ))}
        </div>
        {gm.intercessorUsedThisRound && <p className="text-xs text-gray-500 mt-2 text-center">기도를 마쳤습니다. 다른 이들을 기다리는 중...</p>}
      </div>
    );
  }

  if (gm.myRole === "prophet") {
    return (
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-3">📖 정체를 분별하고 싶은 사람을 한 명 선택하세요 (남은 시간 {left}초)</p>
        <div className="space-y-2">
          {alive
            .filter((p) => p.id !== gm.userId)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => gm.investigate(p.id)}
                disabled={gm.prophetUsedThisRound}
                className="w-full px-4 py-2.5 rounded-lg text-left cursor-pointer bg-gray-900 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {p.name}
              </button>
            ))}
        </div>
        {gm.investigationResult && (
          <p className="text-sm mt-3 text-center bg-gray-900 rounded-lg py-2">
            📖 {gm.investigationResult.targetName}님은{" "}
            <span className={gm.investigationResult.isPharisee ? "text-rose-400" : "text-emerald-400"}>
              {gm.investigationResult.isPharisee ? "바리새인" : "초대교회 성도"}
            </span>
            입니다.
          </p>
        )}
      </div>
    );
  }

  if (gm.myRole === "deacon") {
    return (
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-3">
          🛡️ 오늘 밤 몸으로 지킬 성도를 한 명 선택하세요 (본인 선택 불가, 남은 시간 {left}초)
        </p>
        <div className="space-y-2">
          {alive
            .filter((p) => p.id !== gm.userId)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => gm.guardPlayer(p.id)}
                disabled={gm.deaconUsedThisRound}
                className={`w-full px-4 py-2.5 rounded-lg text-left cursor-pointer disabled:cursor-not-allowed ${
                  gm.deaconGuardId === p.id ? "bg-sky-800" : "bg-gray-900 hover:bg-gray-700"
                } ${gm.deaconUsedThisRound && gm.deaconGuardId !== p.id ? "opacity-40" : ""}`}
              >
                {p.name}
              </button>
            ))}
        </div>
        {gm.deaconUsedThisRound && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            지키기로 했습니다. 그 사람이 표적이 되면 당신이 대신 침묵당해요...
          </p>
        )}
      </div>
    );
  }

  if (gm.myRole === "traitor") {
    const pharisees = [...gm.players.values()].filter((p) => p.role === "pharisee");
    return (
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-3">🎭 당신은 배신자입니다. 다음 사람들이 바리새인이에요 (남은 시간 {left}초)</p>
        <div className="space-y-1.5 bg-gray-900 rounded-lg p-3">
          {pharisees.map((p) => (
            <p key={p.id} className={`text-sm ${p.alive ? "text-rose-400" : "text-gray-600 line-through"}`}>
              🐍 {p.name}
            </p>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          정체를 들키지 않도록 낮에는 성도인 척 행동하며 은근히 저들을 도우세요.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 text-center text-sm text-gray-400 py-10">
      🕊️ 밤이 깊었습니다. 조용히 기도하며 아침을 기다리세요... (남은 시간 {left}초)
    </div>
  );
}

function DayDiscussView({ gm }: { gm: GameManager }) {
  const left = useCountdown(gm.phaseEndsAt);
  const [chatInput, setChatInput] = useState("");
  const [proclaimed, setProclaimed] = useState(false);
  const canSpeak = !!gm.me?.alive;

  const sendChat = () => {
    if (!chatInput.trim() || !canSpeak) return;
    gm.sendChat(chatInput.trim());
    setChatInput("");
  };

  const insertVerse = (v: (typeof VERSE_HELPERS)[number]) => {
    if (!canSpeak) return;
    gm.sendChat(`📖 [${v.ref}] "${v.text}"`);
  };

  const proclaimRevelation = () => {
    if (!gm.investigationResult || proclaimed) return;
    const { targetName, isPharisee } = gm.investigationResult;
    gm.sendChat(`📖 [계시] ${targetName}님은 ${isPharisee ? "바리새인" : "성도"}입니다.`);
    setProclaimed(true);
  };

  const canProclaim = canSpeak && gm.myRole === "prophet" && !!gm.investigationResult && !proclaimed;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-2">
        {canSpeak
          ? `말씀과 신앙 고백으로 자신을 변론하고, 의심스러운 사람을 살펴보세요 (남은 시간 ${left}초)`
          : `${gm.isSpectator ? "👀 관전 중입니다" : "당신은 침묵당했습니다"} — 낮 토론을 읽기만 할 수 있어요 (남은 시간 ${left}초)`}
      </p>

      {canProclaim && (
        <button
          onClick={proclaimRevelation}
          className="mb-3 w-full py-2 rounded-lg bg-amber-800/80 hover:bg-amber-700 cursor-pointer text-sm font-medium"
        >
          📖 계시 선포하기 ({gm.investigationResult!.targetName}님 분별 결과 공개)
        </button>
      )}

      {canSpeak && <ReactionBar gm={gm} />}

      {canSpeak && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {VERSE_HELPERS.map((v) => (
            <button
              key={v.ref}
              onClick={() => insertVerse(v)}
              className="text-[11px] px-2 py-1 rounded-full bg-gray-900 hover:bg-gray-700 border border-gray-700 cursor-pointer text-amber-200"
              title={v.text}
            >
              📖 {v.ref}
            </button>
          ))}
        </div>
      )}

      <div className="bg-gray-900 rounded-lg h-56 overflow-y-auto p-3 mb-3 space-y-1 text-sm">
        {gm.chatLog.length === 0 && <p className="text-gray-500">아직 변론이 없습니다...</p>}
        {gm.chatLog.map((m) => (
          <p key={m.id}>
            <span className={m.senderId === gm.userId ? "text-amber-300 font-semibold" : "text-emerald-400 font-semibold"}>
              {m.senderName}:{" "}
            </span>
            <span>{m.text}</span>
          </p>
        ))}
      </div>
      {canSpeak ? (
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            maxLength={MAX_CHAT_LENGTH}
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-amber-400"
            placeholder="말씀이나 신앙 고백으로 변론해보세요..."
          />
          <button onClick={sendChat} className="px-4 py-2 bg-amber-700 rounded-lg cursor-pointer hover:bg-amber-600">
            전송
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-gray-500 text-center">
          {gm.isSpectator ? "우측 하단 관전자 채팅으로 다른 구경꾼과 대화할 수 있어요" : "우측 하단 유령 채팅으로 다른 사망자와 대화할 수 있어요"}
        </p>
      )}
    </div>
  );
}

/** 이름에서 아바타용 이니셜 한 글자를 뽑는다 */
function initial(name: string) {
  return name.trim().charAt(0) || "?";
}

function DayVoteView({ gm }: { gm: GameManager }) {
  const left = useCountdown(gm.phaseEndsAt);
  const alive = gm.alivePlayers;
  const canVote = !!gm.me?.alive;
  const myVote = gm.votes.get(gm.userId) ?? null;

  const votersFor = (targetId: string) =>
    [...gm.votes.entries()]
      .filter(([, t]) => t === targetId)
      .map(([voterId]) => gm.players.get(voterId))
      .filter((p): p is NonNullable<typeof p> => !!p);

  const vote = (targetId: string) => {
    if (!canVote) return;
    if (myVote === targetId) return;
    gm.castVote(targetId);
  };

  const votedCount = alive.filter((p) => gm.votes.has(p.id)).length;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-3">
        {canVote
          ? `가장 의심스러운 사람에게 투표하세요 (남은 시간 ${left}초)`
          : `${gm.isSpectator ? "👀 관전 중입니다" : "당신은 이미 침묵당해 투표할 수 없습니다"} — 실시간 투표 현황만 볼 수 있어요 (남은 시간 ${left}초)`}
      </p>
      <div className="space-y-2">
        {alive.map((p) => {
          const voters = votersFor(p.id);
          return (
            <button
              key={p.id}
              onClick={() => vote(p.id)}
              disabled={!canVote}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-left transition-colors ${
                canVote ? "cursor-pointer" : "cursor-default"
              } ${myVote === p.id ? "bg-rose-700" : "bg-gray-900 hover:bg-gray-700"} ${
                myVote !== null && myVote !== p.id ? "opacity-50" : ""
              }`}
            >
              <span>{p.name}</span>
              <span className="flex items-center gap-1">
                {voters.length === 0 ? (
                  <span className="text-xs text-gray-500">0표</span>
                ) : (
                  <span className="flex -space-x-1.5">
                    {voters.slice(0, 5).map((v) => (
                      <span
                        key={v.id}
                        title={v.name}
                        className="w-5 h-5 rounded-full border border-gray-800 text-[10px] flex items-center justify-center font-bold bg-rose-600"
                      >
                        {initial(v.name)}
                      </span>
                    ))}
                    {voters.length > 5 && (
                      <span className="w-5 h-5 rounded-full bg-gray-700 border border-gray-800 text-[9px] flex items-center justify-center">
                        +{voters.length - 5}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {canVote && (
          <button
            onClick={() => vote("")}
            disabled={myVote === ""}
            className={`w-full px-4 py-2.5 rounded-lg text-sm cursor-pointer ${
              myVote === "" ? "bg-gray-700" : "bg-gray-900 hover:bg-gray-700"
            }`}
          >
            기권 {votersFor("").length > 0 && <span className="text-xs text-gray-500">({votersFor("").length})</span>}
          </button>
        )}
      </div>
      {canVote && myVote !== null && (
        <div className="flex items-center justify-center gap-3 pt-3">
          <p className="text-xs text-gray-400">투표 완료! ({votedCount}/{alive.length}명 투표함)</p>
          <button
            onClick={() => gm.cancelVote()}
            className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-200 cursor-pointer"
          >
            투표 취소
          </button>
        </div>
      )}
      {canVote && myVote === null && (
        <p className="text-xs text-gray-500 text-center pt-3">
          {votedCount}/{alive.length}명 투표함
        </p>
      )}
    </div>
  );
}

function EndScreen({ gm, onExit }: { gm: GameManager; onExit: () => void }) {
  const [, tick] = useState(0);
  const [myStats, setMyStats] = useState<PlayerStatsRow | null>(null);
  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [mySeasonStats, setMySeasonStats] = useState<SeasonStatsRow | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const won =
    !gm.isSpectator &&
    (gm.winner === "citizen" ? !isPhariseeAlignedForWin(gm.myRole) : gm.winner === "pharisee" ? isPhariseeAlignedForWin(gm.myRole) : false);

  useEffect(() => {
    if (!won || gm.isSpectator) return;
    const colors = gm.winner === "citizen" ? ["#fbbf24", "#f5f5f4", "#a78bfa"] : ["#f43f5e", "#7f1d1d"];
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors });
    const t = setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.4 }, colors }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const mvpAnnounced = useRef(false);
  useEffect(() => {
    const rerender = () => tick((n) => n + 1);
    const onMvpUpdate = () => {
      if (gm.mvpResultId && !mvpAnnounced.current) {
        mvpAnnounced.current = true;
        soundEngine.play("save");
      }
      rerender();
    };
    gm.on("mvp-update", onMvpUpdate);
    return () => gm.off("mvp-update", onMvpUpdate);
  }, [gm]);

  useEffect(() => {
    let cancelled = false;
    // 전적 기록이 서버에 반영될 시간을 잠깐 준 뒤 내 최신 전적을 불러온다
    const t = setTimeout(async () => {
      try {
        const stats = await GameManager.fetchMyStats(gm.userId);
        if (!cancelled) setMyStats(stats);
      } catch {
        // 조회 실패는 조용히 무시 — 화면에 칭호를 안 보여줄 뿐 게임 흐름엔 영향 없음
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [gm]);

  useEffect(() => {
    if (gm.isSpectator) return; // 관전자는 이번 판 전적이 기록되지 않으니 시즌 랭크도 조회할 필요 없음
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const activeSeason = await GameManager.fetchActiveSeason();
        if (cancelled) return;
        setSeason(activeSeason);
        const stats = await GameManager.fetchMySeasonStats(activeSeason.id, gm.userId);
        if (!cancelled) setMySeasonStats(stats);
      } catch {
        // 조회 실패는 조용히 무시 — 시즌 배지를 안 보여줄 뿐 게임 흐름엔 영향 없음
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [gm]);

  const others = [...gm.players.values()].filter((p) => p.id !== gm.userId);
  const votesFor = (targetId: string) => [...gm.mvpVotes.values()].filter((v) => v === targetId).length;
  const mvpWinner = gm.mvpResultId ? gm.players.get(gm.mvpResultId) : null;
  const title = myStats ? getTitle(myStats.wins) : null;

  return (
    <div className="text-white flex flex-col items-center gap-5 bg-gray-800 rounded-2xl p-8 w-[92%] max-w-md">
      <div className="w-full flex justify-end -mb-3">
        <MuteToggle />
      </div>
      <p className="text-5xl">{gm.winner === "citizen" ? "🕊️" : "🐍"}</p>
      <h2 className="text-xl font-bold text-center">
        {gm.winner === "citizen" ? "초대교회 성도들의 승리!" : "바리새인들의 승리..."}
        <br />
        <span className="text-sm text-gray-400 font-normal">
          {gm.isSpectator ? "👀 관전을 마쳤습니다" : won ? "당신은 승리했습니다 🎉" : "당신은 패배했습니다"}
        </span>
      </h2>

      {title && myStats && (
        <div className="w-full bg-gray-900/70 border border-amber-800/40 rounded-xl px-4 py-2.5 text-center">
          <p className="text-sm">
            {title.emoji} 당신의 칭호: <span className="text-amber-300 font-semibold">{title.label}</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            누적 {myStats.games_played}전 {myStats.wins}승 {myStats.losses}패
            {myStats.mvp_count > 0 && ` · MVP ${myStats.mvp_count}회`}
          </p>
        </div>
      )}

      {mySeasonStats && season && (
        <div className="w-full bg-gray-900/70 border border-rose-800/30 rounded-xl px-4 py-2.5 text-center">
          <p className="text-sm">
            {getRankTier(mySeasonStats.rp).emoji} {season.label} 랭크:{" "}
            <span className="text-rose-300 font-semibold">{getRankTier(mySeasonStats.rp).label}</span>
            <span className="text-gray-500 text-xs ml-1">({mySeasonStats.rp} RP)</span>
          </p>
        </div>
      )}

      <div className="w-full bg-gray-900 rounded-xl p-4 space-y-1.5">
        {[...gm.players.values()].map((p) => (
          <div key={p.id} className="flex justify-between text-sm">
            <span className={p.alive ? "" : "text-gray-500 line-through"}>{p.name}</span>
            <span className="text-gray-400">{ROLE_LABEL[p.role]}</span>
          </div>
        ))}
      </div>

      <div className="w-full bg-gray-900 rounded-xl p-4">
        {mvpWinner ? (
          <p className="text-sm text-center">
            🌟 이번 판의 MVP는 <span className="text-amber-300 font-semibold">{mvpWinner.name}</span>님입니다!
          </p>
        ) : gm.mvpResultId === null && Object.keys(gm.mvpVoteCounts).length > 0 ? (
          <p className="text-sm text-center text-gray-400">⚖️ MVP 투표가 동점이라 이번엔 선정되지 않았어요.</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-2 text-center">
              🌟 이번 판에서 가장 활약한 사람에게 투표해보세요
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {others.map((p) => (
                <button
                  key={p.id}
                  onClick={() => gm.voteMvp(p.id)}
                  disabled={!gm.canVoteMvp()}
                  className={`px-3 py-2 rounded-lg text-xs text-left cursor-pointer disabled:cursor-not-allowed ${
                    gm.mvpVotes.get(gm.userId) === p.id ? "bg-amber-800" : "bg-gray-800 hover:bg-gray-700"
                  } ${gm.mvpVoted && gm.mvpVotes.get(gm.userId) !== p.id ? "opacity-50" : ""}`}
                >
                  {p.name}
                  {votesFor(p.id) > 0 && <span className="text-gray-500"> · {votesFor(p.id)}표</span>}
                </button>
              ))}
            </div>
            {gm.mvpVoted && <p className="text-[11px] text-gray-500 mt-2 text-center">투표 완료! 결과를 기다리는 중...</p>}
          </>
        )}
      </div>

      <div className="w-full flex gap-2">
        <button
          onClick={() => setShowLeaderboard(true)}
          className="flex-1 py-2.5 rounded-lg text-sm cursor-pointer bg-gray-900 hover:bg-gray-700 border border-gray-700 text-amber-200"
        >
          🏆 명예의 전당
        </button>
        <button onClick={onExit} className="flex-1 py-2.5 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium text-sm">
          나가기
        </button>
      </div>
      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </div>
  );
}