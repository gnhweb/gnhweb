export type PromptCategory = "church_life" | "bible_story" | "worship" | "gratitude" | "random";

export type Phase = "lobby" | "prompt" | "drawing" | "guessing" | "reveal" | "awards" | "ended";

export type EntryType = "prompt" | "drawing" | "guess";

export interface ChainEntry {
  turnIndex: number;
  authorId: string;
  authorName: string;
  type: EntryType;
  /** 텍스트(prompt/guess) 또는 SVG-path JSON 직렬화 문자열(drawing) */
  content: string;
  /** prompt 타입일 때만 존재 */
  category?: PromptCategory;
  submittedAt: number;
}

export interface Chain {
  id: string;
  originAuthorId: string;
  entries: ChainEntry[];
  /** 호스트 또는 작성자가 갤러리 공개에서 이 체인을 제외하기로 한 경우 */
  hidden: boolean;
}

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
}

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;

export const CATEGORY_LABEL: Record<PromptCategory, { emoji: string; label: string }> = {
  church_life: { emoji: "🏠", label: "교회 생활 밈" },
  bible_story: { emoji: "📖", label: "성경 이야기" },
  worship: { emoji: "🎤", label: "찬양/워십 밈" },
  gratitude: { emoji: "🙏", label: "감사/기도제목" },
  random: { emoji: "🎲", label: "일상/랜덤" },
};

export const ALL_CATEGORIES: PromptCategory[] = ["church_life", "bible_story", "worship", "gratitude", "random"];

export type SeasonalPack = "none" | "christmas" | "easter" | "thanksgiving" | "retreat";

export const SEASONAL_PACK_LABEL: Record<SeasonalPack, string> = {
  none: "평시",
  christmas: "성탄절",
  easter: "부활절",
  thanksgiving: "맥추감사절",
  retreat: "수련회 특집",
};

// ---------- 팀전 변형 (GDD 8절: "팀 대항으로 나눠서 리액션 스코어 경쟁") ----------
// 팀 이름은 갈릴리 호수의 별칭인 "디베랴 호수"(요한복음 6:1, 21:1)에서 따와 게임 이름과 자연스럽게 묶었다.
// 승패보다 재미가 우선이라는 톤 원칙(GDD 5.2/8절)에 따라 순위/승리 연출은 쓰지 않고 "리액션 온도" 비교로 순화한다.
// 팀 이름/이모지는 방장이 로비에서 바꿀 수 있다 (예: "1소그룹" vs "2소그룹") — RoomSettings.teamLabels 참조.

export type TeamId = "galilee" | "tiberias";

export const ALL_TEAMS: TeamId[] = ["galilee", "tiberias"];

export interface TeamLabel {
  emoji: string;
  label: string;
}

/** 기본 팀 이름/이모지 — 방장이 로비에서 커스터마이징하지 않으면 이 값을 그대로 쓴다. */
export const TEAM_LABEL: Record<TeamId, TeamLabel> = {
  galilee: { emoji: "⛵", label: "갈릴리호" },
  tiberias: { emoji: "🛶", label: "디베랴호" },
};

/** 팀전 모드에서 팀당 최소 인원. 전체 최소 인원(4명)과 맞물려 2대2 이상을 보장한다. */
export const MIN_PLAYERS_PER_TEAM = 2;

/** 팀 이름 입력창 글자수 제한 (로비 커스터마이징용) */
export const TEAM_NAME_MAX_LENGTH = 10;

/** 방장이 로비에서 조절할 수 있는 방 설정 — 게임 시작 시점에 확정되어 그 판 내내 유지된다 */
export interface RoomSettings {
  /** 활성화된 프롬프트 카테고리 (복수 선택, 랜덤 믹스가 기본값) */
  activeCategories: PromptCategory[];
  writeTimeSec: number;
  drawTimeSec: number;
  seasonalPack: SeasonalPack;
  /** 팀전 변형 on/off (GDD 8절 확장 아이디어). 기본은 꺼짐 — 개인전이 디폴트 톤을 유지한다. */
  teamMode: boolean;
  /** 방장이 로비에서 바꿀 수 있는 팀 이름/이모지. 예: "1소그룹" vs "2소그룹"처럼 실제 모임 단위로 맞춰 부를 수 있다. */
  teamLabels: Record<TeamId, TeamLabel>;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  activeCategories: [...ALL_CATEGORIES],
  writeTimeSec: 30,
  drawTimeSec: 60,
  seasonalPack: "none",
  teamMode: false,
  teamLabels: { galilee: { ...TEAM_LABEL.galilee }, tiberias: { ...TEAM_LABEL.tiberias } },
};

export const WRITE_TIME_OPTIONS = [20, 30, 45] as const;
export const DRAW_TIME_OPTIONS = [45, 60, 90] as const;

export const MAX_GUESS_LENGTH = 60;

/**
 * 턴 인덱스(0부터)로 그 턴에 전원이 수행할 작업 유형을 결정한다.
 * turn 0 = 프롬프트 작성, 이후 그리기 ⇄ 추측(글) 반복 — GDD 2.2절 체인 구조.
 */
export function turnEntryType(turn: number): EntryType {
  if (turn === 0) return "prompt";
  return turn % 2 === 1 ? "drawing" : "guess";
}

/** 턴 인덱스로 그 턴의 게임 phase를 결정한다. totalTurns를 넘어서면 갤러리 공개로 전환. */
export function phaseForTurn(turn: number, totalTurns: number): Phase {
  if (turn >= totalTurns) return "reveal";
  const t = turnEntryType(turn);
  if (t === "prompt") return "prompt";
  if (t === "drawing") return "drawing";
  return "guessing";
}

// ---------- 5~6단계: 갤러리 공개 & 시상식 ----------

/** 실시간 리액션 이모지 (GDD 4.1절) */
export const REACTION_EMOJIS = ["😂", "🙏", "😱", "👏"] as const;

export type AwardCategory = "distortion" | "artistry" | "resurrection" | "chaos";

export const AWARD_LABEL: Record<AwardCategory, { emoji: string; label: string; desc: string }> = {
  distortion: { emoji: "🏆", label: "최고의 왜곡상", desc: "원본과 결과물 간극이 가장 큰 체인" },
  artistry: { emoji: "🎨", label: "은혜의 붓터치상", desc: "가장 정성스럽게(혹은 웃기게) 그린 그림" },
  resurrection: { emoji: "📜", label: "말씀 부활상", desc: "신앙 소재로 시작해서 신앙 소재로 절묘하게 되돌아온 체인" },
  chaos: { emoji: "🤣", label: "웃음 참사상", desc: "리액션 이모지가 가장 많이 달린 체인" },
};

/** distortion/artistry/resurrection은 전원 투표로, chaos는 갤러리 공개 중 쌓인 리액션 집계로 자동 결정된다 (GDD 4.2절) */
export const VOTED_AWARD_CATEGORIES: AwardCategory[] = ["distortion", "artistry", "resurrection"];