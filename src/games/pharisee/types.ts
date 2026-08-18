export type Role =
  | "citizen"
  | "pharisee"
  | "intercessor"
  | "prophet"
  | "deacon"
  | "traitor"
  | "martyr";
export type Phase = "lobby" | "night" | "day-discuss" | "day-vote" | "day-lastwords" | "ended";

export interface PlayerState {
  id: string;
  name: string;
  role: Role;
  alive: boolean;
}

export interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
}

export const MIN_PLAYERS = 4;
/** 이 인원 이상일 때만 안수집사·배신자가 추가로 등장 — 방 설정에서 조절 가능한 기본값 */
export const SPECIAL_ROLES_MIN_PLAYERS = 8;
/** 이 인원 이상일 때만 순교자가 추가로 등장 — 방 설정 대상은 아님 */
export const ADVANCED_ROLES_MIN_PLAYERS = 12;
export const NIGHT_MS = 25000;
export const DAY_DISCUSS_MS = 60000;
export const DAY_VOTE_MS = 30000;
export const REVEAL_MS = 5000;
/** 출교 확정 전, 지목된 사람이 마지막으로 발언할 수 있는 시간 */
export const LAST_WORDS_MS = 15000;
/** 게임 종료 후 MVP 투표에 주어지는 시간 */
export const MVP_VOTE_MS = 20000;

// ---------- 6단계: 방 설정 커스터마이징 ----------

/** 방장이 로비에서 조절할 수 있는 게임 설정 — game_start 시점에 확정되어 그 판 내내 유지된다 */
export interface RoomSettings {
  nightMs: number;
  discussMs: number;
  voteMs: number;
  /** 바리새인 비율 분모 — 인원의 1/phariseeRatio 명이 바리새인으로 배정됨 (예: 4면 1/4) */
  phariseeRatio: number;
  /** 이 인원 이상일 때만 안수집사·배신자가 추가로 등장 */
  specialRolesMinPlayers: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  nightMs: NIGHT_MS,
  discussMs: DAY_DISCUSS_MS,
  voteMs: DAY_VOTE_MS,
  phariseeRatio: 4,
  specialRolesMinPlayers: SPECIAL_ROLES_MIN_PLAYERS,
};

/** 로비 설정 패널의 타이머 선택지 (밀리초) */
export const TIMER_OPTIONS = {
  nightMs: [15000, 20000, 25000, 30000, 40000],
  discussMs: [30000, 45000, 60000, 90000, 120000],
  voteMs: [15000, 20000, 30000, 45000],
} as const;

export const PHARISEE_RATIO_OPTIONS = [3, 4, 5, 6] as const;
export const SPECIAL_ROLES_THRESHOLD_OPTIONS = [6, 7, 8, 9, 10] as const;

/** 낮 토론 중 가볍게 던질 수 있는 반응 이모지 */
export const REACTIONS = ["🙏", "😢", "😨", "🤔", "🔥", "👀", "😂", "💔"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export const ROLE_LABEL: Record<Role, string> = {
  citizen: "초대교회 성도",
  pharisee: "바리새인",
  intercessor: "중보 기도자",
  prophet: "선지자",
  deacon: "안수집사",
  traitor: "배신자",
  martyr: "순교자",
};

export const ROLE_INFO: Record<Role, { emoji: string; title: string; desc: string }> = {
  citizen: {
    emoji: "🕊️",
    title: "당신은 초대교회 성도입니다",
    desc: "숨겨진 바리새인을 찾아내야 합니다. 낮에는 말씀과 신앙 고백으로 자신의 정체성을 증명하고, 투표로 바리새인을 색출하세요.",
  },
  pharisee: {
    emoji: "🐍",
    title: "당신은 바리새인입니다",
    desc: "초대교회를 핍박하는 세력입니다. 밤마다 다른 바리새인과 함께 성도 한 명을 지목해 침묵시키세요. 낮에는 정체를 들키지 않도록 변론해야 합니다.",
  },
  intercessor: {
    emoji: "🙏",
    title: "당신은 중보 기도자입니다",
    desc: "밤마다 기도로 성도 한 명을 지켜주세요. 본인을 선택할 수도 있습니다. 당신이 중보 기도자라는 사실은 끝까지 숨기는 게 좋아요.",
  },
  prophet: {
    emoji: "📖",
    title: "당신은 선지자입니다",
    desc: "밤마다 한 사람을 지목해 그가 성도인지 바리새인인지 영적으로 분별할 수 있습니다. 낮에 이 사실을 밝힐지는 신중히 결정하세요.",
  },
  deacon: {
    emoji: "🛡️",
    title: "당신은 안수집사입니다",
    desc: "밤마다 한 사람을 지목해 지켜주세요(본인은 선택 불가). 그 사람이 밤에 공격받으면, 대신 당신이 침묵당합니다. 몸을 던져서라도 공동체를 지키는 역할입니다.",
  },
  traitor: {
    emoji: "🎭",
    title: "당신은 배신자입니다",
    desc: "겉으로는 성도지만 바리새인 편입니다. 밤 지목에는 참여하지 않지만 누가 바리새인인지 알고 있고, 선지자의 분별에도 걸리지 않습니다. 정체를 숨기고 성도인 척 바리새인을 도우세요.",
  },
  martyr: {
    emoji: "✝️",
    title: "당신은 순교자입니다",
    desc: "누명을 쓰고 출교당하더라도 헛되지 않습니다. 당신이 투표로 지목되어 마지막 유언을 하게 되면, 단 한 번, 한 사람을 지목해 고발할 수 있습니다. 그 사람이 정말 바리새인 편이었다면, 당신과 함께 처단됩니다.",
  },
};

export const ROLE_REVEAL_TEXT: Record<Role, string> = {
  citizen: "평범한 초대교회 성도였습니다.",
  pharisee: "바리새인이었습니다.",
  intercessor: "숨은 중보 기도자였습니다.",
  prophet: "진실한 선지자였습니다.",
  deacon: "몸을 던진 안수집사였습니다.",
  traitor: "성도인 척한 배신자였습니다.",
  martyr: "마지막까지 진실을 고발한 순교자였습니다.",
};

/** 바리새인 진영 여부 (선지자 분별 기준 — 배신자는 여기 포함되지 않아 성도로 보임) */
export function isPhariseeFaction(role: Role): boolean {
  return role === "pharisee";
}

/** 성도 진영(성도 + 중보 기도자 + 선지자 + 안수집사 + 순교자) 여부 — 배신자는 겉보기만 성도라 제외 */
export function isCitizenFaction(role: Role): boolean {
  return !isPhariseeFaction(role) && role !== "traitor";
}

/** 승리 판정 기준 진영 — 배신자는 바리새인 편에서 승리하므로 여기 포함됨 */
export function isPhariseeAlignedForWin(role: Role): boolean {
  return role === "pharisee" || role === "traitor";
}

// ---------- 밤 순서 연출 (마피아42 스타일 "지금은 OO의 시간입니다") ----------
// 실제 행동 판정 로직(GameManager의 밤 액션 수집/resolveNight)은 그대로 두고,
// 이미 모든 클라이언트가 알고 있는 phaseEndsAt/nightMs만으로 각자 계산하는
// 순수 연출용 타임라인이라 별도 네트워크 동기화가 필요 없다.
export interface NightStep {
  /** null이면 특정 직업 차례가 아닌 도입/마무리 안내 문구 */
  role: Role | null;
  icon: string;
  label: string;
}

/** 실제 진영 판정과 무관하게, 연출상 자연스러운 순서로만 나열 (바리새인 조직 → 단독범 → 수호자들 → 분별자들) */
const NIGHT_ROLE_ORDER: { role: Role; verb: string }[] = [
  { role: "pharisee", verb: "은밀히 모여 침묵시킬 사람을 의논합니다" },
  { role: "deacon", verb: "몸으로 지킬 사람을 정합니다" },
  { role: "intercessor", verb: "기도로 지킬 사람을 정합니다" },
  { role: "prophet", verb: "말씀으로 한 사람을 분별합니다" },
];

/** 이번 판에 실제로 존재하는 직업만 걸러서 밤 시퀀스를 구성한다 */
export function buildNightSequence(presentRoles: Set<Role>): NightStep[] {
  const steps: NightStep[] = [{ role: null, icon: "🕯️", label: "모두가 눈을 감고 조용히 기도합니다..." }];
  NIGHT_ROLE_ORDER.forEach(({ role, verb }) => {
    if (presentRoles.has(role)) {
      steps.push({ role, icon: ROLE_INFO[role].emoji, label: `${ROLE_LABEL[role]}이(가) ${verb}` });
    }
  });
  steps.push({ role: null, icon: "🌄", label: "곧 아침이 밝아옵니다..." });
  return steps;
}

/** 밤 페이즈 경과 시간을 전체 단계 수로 균등하게 나눠 현재 몇 번째 단계인지 계산 */
export function nightStepIndex(elapsedMs: number, totalMs: number, stepCount: number): number {
  if (stepCount <= 0 || totalMs <= 0) return 0;
  const perStep = totalMs / stepCount;
  const idx = Math.floor(Math.max(0, elapsedMs) / perStep);
  return Math.min(Math.max(idx, 0), stepCount - 1);
}

// ---------- 4단계: 전적 / 칭호 / MVP ----------

/** pharisee_player_stats 테이블 한 행 — 리더보드·내 전적 조회에 사용 */
export interface PlayerStatsRow {
  user_id: string;
  user_name: string;
  games_played: number;
  wins: number;
  losses: number;
  mvp_count: number;
}

/** 승수 기준 칭호 단계 (낮은 순부터 정렬) */
export const TITLE_TIERS: { minWins: number; label: string; emoji: string }[] = [
  { minWins: 0, label: "새신자", emoji: "🌱" },
  { minWins: 3, label: "성실한 성도", emoji: "🕊️" },
  { minWins: 8, label: "말씀의 용사", emoji: "📖" },
  { minWins: 15, label: "믿음의 장로", emoji: "⛪" },
  { minWins: 30, label: "영적 분별자", emoji: "✨" },
];

/** 누적 승수로 현재 칭호를 계산한다 */
export function getTitle(wins: number): { label: string; emoji: string } {
  let result = TITLE_TIERS[0];
  for (const t of TITLE_TIERS) {
    if (wins >= t.minWins) result = t;
  }
  return { label: result.label, emoji: result.emoji };
}

/** 낮 변론 도우미 — 클릭 한 번으로 채팅창에 인용되는 오늘의 추천 말씀 */
export const VERSE_HELPERS: { ref: string; text: string }[] = [
  { ref: "고린도전서 13:4", text: "사랑은 오래 참고 사랑은 온유하며" },
  { ref: "시편 23:1", text: "여호와는 나의 목자시니 내게 부족함이 없으리로다" },
  { ref: "잠언 18:21", text: "죽고 사는 것이 혀의 힘에 달렸나니" },
  { ref: "요한복음 8:32", text: "진리를 알지니 진리가 너희를 자유롭게 하리라" },
  { ref: "야고보서 1:19", text: "듣기는 속히 하고 말하기는 더디 하며" },
  { ref: "마태복음 7:1", text: "비판을 받지 아니하려거든 비판하지 말라" },
  { ref: "잠언 12:22", text: "거짓 입술은 여호와께 미움을 받아도 진실하게 행하는 자는 그의 기쁨을 받으시느니라" },
  { ref: "로마서 12:10", text: "형제를 사랑하여 서로 우애하고 존경하기를 서로 먼저 하며" },
];

// ---------- 9단계: 랭크 / 시즌 ----------

/** pharisee_seasons 테이블 한 행 */
export interface SeasonRow {
  id: string;
  season_number: number;
  label: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

/** pharisee_season_stats 테이블 한 행 — 시즌 한정 랭크 포인트(RP) */
export interface SeasonStatsRow {
  season_id: string;
  user_id: string;
  user_name: string;
  rp: number;
  games_played: number;
  wins: number;
  losses: number;
  mvp_count: number;
}

/** RP 기준 랭크 티어 (낮은 순부터 정렬) — 승수 기반 TITLE_TIERS와는 별개로, 시즌마다 초기화되는 경쟁 지표 */
export const RANK_TIERS: { minRp: number; label: string; emoji: string }[] = [
  { minRp: 0, label: "나그네", emoji: "🥾" },
  { minRp: 60, label: "순례자", emoji: "🧭" },
  { minRp: 150, label: "파수꾼", emoji: "🔥" },
  { minRp: 280, label: "증인", emoji: "✝️" },
  { minRp: 450, label: "사도", emoji: "📯" },
  { minRp: 650, label: "빛의 증거자", emoji: "✨" },
];

/** 시즌 RP로 현재 랭크 티어를 계산한다 */
export function getRankTier(rp: number): { label: string; emoji: string } {
  let result = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (rp >= t.minRp) result = t;
  }
  return { label: result.label, emoji: result.emoji };
}