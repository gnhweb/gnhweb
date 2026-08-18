import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { censorProfanity } from "@/lib/chatSafety";
import {
  Phase,
  Player,
  Chain,
  ChainEntry,
  EntryType,
  PromptCategory,
  RoomSettings,
  DEFAULT_SETTINGS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  MAX_GUESS_LENGTH,
  turnEntryType,
  phaseForTurn,
  AwardCategory,
  VOTED_AWARD_CATEGORIES,
  TeamId,
  ALL_TEAMS,
  MIN_PLAYERS_PER_TEAM,
} from "./types";

/** 이 게임은 Phaser가 필요 없는 DOM 기반이라 아주 작은 이벤트 이미터만 직접 둔다 (pharisee GameManager와 동일한 패턴). */
class MiniEmitter {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  on(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return this;
  }
  off(event: string, fn: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(fn);
    return this;
  }
  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
    return true;
  }
}

/** 신앙 소재 원 카테고리 — "말씀 부활상"(resurrection) 후보 체인을 가릴 때 사용 (GDD 4.2절: 있을 경우만 등장하는 히든 상) */
const FAITH_CATEGORIES: PromptCategory[] = ["church_life", "bible_story", "worship", "gratitude"];

export class GameManager extends MiniEmitter {
  channel: RealtimeChannel;
  roomCode: string;
  userId: string;
  userName: string;

  presenceOrder: Player[] = [];

  phase: Phase = "lobby";
  settings: RoomSettings = { ...DEFAULT_SETTINGS };

  /** 게임 시작 시 확정된 체인 순환 순서 (player id 배열). 체인 i는 playerOrder[i]가 원작자. */
  playerOrder: string[] = [];
  playerNames: Map<string, string> = new Map();

  /** 팀전 모드일 때만 의미가 있다 (playerId -> teamId). 로비에서만 편집 가능하고 게임 시작 시 그대로 얼어붙는다. */
  playerTeams: Map<string, TeamId> = new Map();

  chains: Chain[] = [];
  currentTurn = 0;
  totalTurns = 0;
  /** 이번 턴에 제출을 마친 player id 집합 */
  submittedThisTurn: Set<string> = new Set();

  // ---------- 5단계: 갤러리 공개 ----------
  revealStarted = false;
  revealChainIdx = 0;
  /** 현재 공개 중인 체인에서 몇 번째 항목까지 보여줄지 (1부터 시작 = 프롬프트만 보이는 상태) */
  revealEntryCount = 0;
  /** 자동 재생 여부 — 방장 로컬 상태로만 쓰이며(호스트만 타이머를 굴림) 다른 클라이언트와 동기화하지 않는다 */
  autoPlay = false;
  /** 체인별 실시간 리액션 누적 수 (chain.id -> count) — "웃음 참사상" 자동 집계용 (GDD 4.2절) */
  reactionCounts: Map<string, number> = new Map();

  // ---------- 6단계: 시상식 ----------
  /** 이번 판에 실제로 진행할 투표 카테고리 목록 (말씀 부활상은 후보 체인이 있을 때만 포함) */
  awardCategories: AwardCategory[] = [];
  votingCategoryIdx = 0;
  /** category -> (voterId -> chainId) */
  votes: Map<AwardCategory, Map<string, string>> = new Map();
  awardsRevealed = false;

  private subscribed = false;
  private wasHost = false;

  constructor(roomCode: string, userId: string, userName: string) {
    super();
    this.roomCode = roomCode;
    this.userId = userId;
    this.userName = userName;
    this.channel = supabase.channel(`galilee-room-${roomCode}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    this.bind();
  }

  get isHost(): boolean {
    if (this.presenceOrder.length === 0) return false;
    return this.presenceOrder[0].id === this.userId;
  }

  get canStart(): boolean {
    return (
      this.isHost &&
      this.phase === "lobby" &&
      this.presenceOrder.length >= MIN_PLAYERS &&
      this.presenceOrder.length <= MAX_PLAYERS &&
      this.settings.activeCategories.length > 0 &&
      (!this.settings.teamMode || this.isTeamBalanceReady)
    );
  }

  /** 활성 참가자(최대 인원 이내)만 대상으로 팀별 인원수를 센다. 팀전 모드가 아닐 땐 항상 빈 값. */
  get teamCounts(): Record<TeamId, number> {
    const counts = { galilee: 0, tiberias: 0 } as Record<TeamId, number>;
    this.activePlayers.forEach((p) => {
      const team = this.playerTeams.get(p.id);
      if (team) counts[team] += 1;
    });
    return counts;
  }

  /** 최대 인원(12명) 이내의, 실제로 이번 판에 참여할 참가자만. 팀 배정/시작 조건 계산의 기준이 된다. */
  get activePlayers(): Player[] {
    return this.presenceOrder.slice(0, MAX_PLAYERS);
  }

  /** 팀전 모드로 시작할 수 있는 상태인지 — 활성 참가자 전원이 배정되어 있고, 각 팀이 최소 인원을 채웠는지. */
  get isTeamBalanceReady(): boolean {
    const counts = this.teamCounts;
    const assigned = this.activePlayers.every((p) => this.playerTeams.has(p.id));
    return assigned && ALL_TEAMS.every((t) => counts[t] >= MIN_PLAYERS_PER_TEAM);
  }

  /** 현재 턴에 "내가" 수행해야 하는 작업 유형 (전원이 동시에, 서로 다른 체인 조각을 작업) */
  get myEntryType(): EntryType {
    return turnEntryType(this.currentTurn);
  }

  private chainIndexForPlayer(playerId: string, turn: number): number {
    const n = this.playerOrder.length;
    if (n === 0) return -1;
    const playerIdx = this.playerOrder.indexOf(playerId);
    if (playerIdx === -1) return -1;
    return ((playerIdx - turn) % n + n) % n;
  }

  /** 현재 턴에 내가 이어써야 할 체인의 인덱스. 체인 i는 playerOrder[i]가 시작, 턴 t에는 (i+t)%N번째 사람이 작업 → i = (내 순번 - t) mod N */
  get myChainIndex(): number {
    return this.chainIndexForPlayer(this.userId, this.currentTurn);
  }

  /** 그리기/추측 턴에서, 내가 이어받은 체인의 직전 항목(내가 보고 작업해야 할 원본) */
  get previousEntry(): ChainEntry | null {
    const idx = this.myChainIndex;
    if (idx === -1) return null;
    const chain = this.chains[idx];
    if (!chain || chain.entries.length === 0) return null;
    return chain.entries[chain.entries.length - 1];
  }

  get haveISubmittedThisTurn(): boolean {
    return this.submittedThisTurn.has(this.userId);
  }

  get submittedCount(): number {
    return this.submittedThisTurn.size;
  }

  /** 아직 이번 턴을 제출하지 않은 사람들의 이름 (WaitingOverlay에서 사용) */
  get pendingPlayerNames(): string[] {
    return this.playerOrder
      .filter((id) => !this.submittedThisTurn.has(id))
      .map((id) => this.playerNames.get(id) ?? "참가자");
  }

  private bind() {
    this.channel
      .on("presence", { event: "sync" }, () => this.onPresenceSync())
      .on("broadcast", { event: "room_settings" }, ({ payload }) => this.applyRoomSettings(payload))
      .on("broadcast", { event: "team_update" }, ({ payload }) => this.applyTeamUpdate(payload))
      .on("broadcast", { event: "game_start" }, ({ payload }) => this.applyGameStart(payload))
      .on("broadcast", { event: "entry_submitted" }, ({ payload }) => this.applyEntrySubmitted(payload))
      .on("broadcast", { event: "turn_advance" }, ({ payload }) => this.applyTurnAdvance(payload))
      .on("broadcast", { event: "chain_hidden" }, ({ payload }) => this.applyChainHidden(payload))
      .on("broadcast", { event: "reveal_start" }, () => this.applyRevealStart())
      .on("broadcast", { event: "reveal_advance" }, ({ payload }) => this.applyRevealAdvance(payload))
      .on("broadcast", { event: "reaction" }, ({ payload }) => this.applyReaction(payload))
      .on("broadcast", { event: "reveal_finish" }, () => this.applyRevealFinish())
      .on("broadcast", { event: "award_vote" }, ({ payload }) => this.applyAwardVote(payload))
      .on("broadcast", { event: "award_next" }, ({ payload }) => this.applyAwardNext(payload))
      .on("broadcast", { event: "award_reveal" }, () => this.applyAwardReveal())
      .on("broadcast", { event: "play_again" }, () => this.applyPlayAgain())
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !this.subscribed) {
          this.subscribed = true;
          await this.channel.track({ userId: this.userId, userName: this.userName, joinedAt: Date.now() });
        }
      });
  }

  destroy() {
    supabase.removeChannel(this.channel);
  }

  // ---------- presence / lobby ----------
  private onPresenceSync() {
    const state = this.channel.presenceState();
    const order: Player[] = [];
    Object.entries(state).forEach(([id, metas]) => {
      const meta = (metas as any[])[0];
      order.push({ id, name: meta.userName, joinedAt: meta.joinedAt });
    });
    order.sort((a, b) => a.joinedAt - b.joinedAt);
    this.presenceOrder = order;
    const hostNow = this.isHost;
    this.wasHost = hostNow;
    // 로비에서 누가 새로 들어오면, 방장이 그동안 조절해둔 설정을 즉시 다시 뿌려준다
    // (새로 들어온 사람은 이전 broadcast를 못 받았으므로 기본값만 갖고 있는 상태)
    if (hostNow && this.phase === "lobby") {
      this.channel.send({ type: "broadcast", event: "room_settings", payload: this.settings });
      // 팀전 모드 중 새로 들어온 사람은 아직 팀이 없으니, 더 인원이 적은 팀에 자동으로 채워 넣고 전파한다.
      if (this.settings.teamMode) {
        let changed = false;
        this.activePlayers.forEach((p) => {
          if (!this.playerTeams.has(p.id)) {
            this.playerTeams.set(p.id, this.smallerTeam());
            changed = true;
          }
        });
        if (changed) this.broadcastTeamUpdate();
      }
    }
    this.emit("lobby-update");
  }

  /** 현재 인원이 더 적은(같으면 갈릴리호) 팀 id — 새 참가자 자동 배정, 수동 배정 시 균형 참고용으로 쓰인다. */
  private smallerTeam(): TeamId {
    const counts = this.teamCounts;
    return counts.tiberias < counts.galilee ? "tiberias" : "galilee";
  }

  private broadcastTeamUpdate() {
    const assignments = Object.fromEntries(this.playerTeams);
    this.emit("lobby-update");
    this.channel.send({
      type: "broadcast",
      event: "team_update",
      payload: { assignments },
    });
  }

  private applyTeamUpdate(payload: { assignments: Record<string, TeamId> }) {
    if (this.phase !== "lobby") return;
    this.playerTeams = new Map(Object.entries(payload.assignments) as [string, TeamId][]);
    this.emit("lobby-update");
  }

  /** 방장 전용: 팀전 모드를 켜고 끈다. 켤 때는 활성 참가자를 무작위로 2팀에 고르게 나눠 배정한다 (GDD 8절). */
  toggleTeamMode() {
    if (!this.isHost || this.phase !== "lobby") return;
    const enabling = !this.settings.teamMode;
    this.updateSettings({ teamMode: enabling });
    if (enabling) {
      this.shuffleTeams();
    } else {
      this.playerTeams = new Map();
      this.broadcastTeamUpdate();
    }
  }

  /** 방장 전용: 활성 참가자를 무작위로 섞어 두 팀에 최대한 고르게 재배정한다. */
  shuffleTeams() {
    if (!this.isHost || this.phase !== "lobby" || !this.settings.teamMode) return;
    const shuffled = [...this.activePlayers].sort(() => Math.random() - 0.5);
    const next = new Map<string, TeamId>();
    shuffled.forEach((p, i) => next.set(p.id, i % 2 === 0 ? "galilee" : "tiberias"));
    this.playerTeams = next;
    this.broadcastTeamUpdate();
  }

  /** 방장 전용: 특정 참가자 한 명의 팀을 수동으로 바꾼다 (팀 칩을 탭해서 이동). */
  setPlayerTeam(playerId: string, team: TeamId) {
    if (!this.isHost || this.phase !== "lobby" || !this.settings.teamMode) return;
    this.playerTeams.set(playerId, team);
    this.broadcastTeamUpdate();
  }

  /** 방장 전용: 팀 이름/이모지를 커스터마이징한다 (예: "1소그룹" vs "2소그룹"). 로비 설정의 일부라 기존 room_settings 전파 경로를 그대로 탄다. */
  updateTeamLabel(team: TeamId, partial: Partial<{ emoji: string; label: string }>) {
    if (!this.isHost || this.phase !== "lobby") return;
    const nextLabels = { ...this.settings.teamLabels, [team]: { ...this.settings.teamLabels[team], ...partial } };
    this.updateSettings({ teamLabels: nextLabels });
  }

  /** 방장만 호출 가능. 카테고리/타이머/시즌팩 등 로비 설정을 바꾸고 다른 참가자에게 전파한다. */
  updateSettings(partial: Partial<RoomSettings>) {
    if (!this.isHost || this.phase !== "lobby") return;
    this.settings = { ...this.settings, ...partial };
    this.emit("settings-update");
    this.channel.send({ type: "broadcast", event: "room_settings", payload: this.settings });
  }

  private applyRoomSettings(payload: RoomSettings) {
    if (this.phase !== "lobby") return; // 게임이 시작된 뒤엔 그 판의 설정이 고정되어야 한다
    this.settings = payload;
    this.emit("settings-update");
  }

  /** 방장만 호출 가능. 최소 인원을 채우면 게임을 시작하고 체인 순환 순서를 확정한다. */
  startGame() {
    if (!this.canStart) return;
    const playerOrder = this.presenceOrder.map((p) => p.id);
    const names = Object.fromEntries(this.presenceOrder.map((p) => [p.id, p.name]));
    const teams = this.settings.teamMode
      ? (Object.fromEntries(playerOrder.map((id) => [id, this.playerTeams.get(id)]).filter(([, t]) => t)) as Record<
          string,
          TeamId
        >)
      : {};
    const payload = { settings: this.settings, playerOrder, names, teams };
    this.applyGameStart(payload);
    this.channel.send({ type: "broadcast", event: "game_start", payload });
  }

  private applyGameStart(payload: {
    settings: RoomSettings;
    playerOrder: string[];
    names: Record<string, string>;
    teams?: Record<string, TeamId>;
  }) {
    this.settings = payload.settings;
    this.playerOrder = payload.playerOrder;
    this.playerNames = new Map(Object.entries(payload.names));
    if (payload.teams) this.playerTeams = new Map(Object.entries(payload.teams) as [string, TeamId][]);
    this.totalTurns = this.playerOrder.length;
    this.currentTurn = 0;
    this.submittedThisTurn = new Set();
    this.chains = this.playerOrder.map((authorId, i) => ({
      id: `chain-${i}`,
      originAuthorId: authorId,
      entries: [],
      hidden: false,
    }));
    this.revealStarted = false;
    this.revealChainIdx = 0;
    this.revealEntryCount = 0;
    this.autoPlay = false;
    this.reactionCounts = new Map();
    this.awardCategories = [];
    this.votingCategoryIdx = 0;
    this.votes = new Map();
    this.awardsRevealed = false;
    this.phase = phaseForTurn(this.currentTurn, this.totalTurns);
    this.emit("phase-change", this.phase);
  }

  /** 프롬프트 작성 턴(turn 0) 전용 제출. */
  submitPrompt(text: string, category: PromptCategory) {
    if (this.myEntryType !== "prompt") return;
    this.submitEntry(text, category);
  }

  /**
   * 현재 턴에 맞는 항목(prompt/drawing/guess)을 내 체인 조각에 제출한다.
   * drawing 항목의 content는 PNG data URL (CanvasBoard에서 채워짐).
   */
  submitEntry(content: string, category?: PromptCategory) {
    if (this.haveISubmittedThisTurn) return;
    const idx = this.myChainIndex;
    if (idx === -1) return;
    const type = this.myEntryType;
    // 그리기 턴의 content는 PNG data URL이라 필터 대상이 아니고, 프롬프트/추측(텍스트) 턴만
    // 부적절어 필터를 거친다 — 다른 게임 채팅에서 쓰는 공용 필터를 그대로 재사용 (GDD 3.2/6.5절)
    const safeContent = type === "drawing" ? content : censorProfanity(content.trim().slice(0, MAX_GUESS_LENGTH));
    const entry: ChainEntry = {
      turnIndex: this.currentTurn,
      authorId: this.userId,
      authorName: this.userName,
      type,
      content: safeContent,
      category,
      submittedAt: Date.now(),
    };
    this.chains[idx].entries.push(entry);
    this.submittedThisTurn.add(this.userId);
    this.emit("entry-update");
    this.channel.send({ type: "broadcast", event: "entry_submitted", payload: { chainIndex: idx, entry } });
    if (this.isHost) this.maybeAdvanceTurn();
  }

  private applyEntrySubmitted(payload: { chainIndex: number; entry: ChainEntry }) {
    const { chainIndex, entry } = payload;
    const chain = this.chains[chainIndex];
    if (chain && !chain.entries.some((e) => e.authorId === entry.authorId && e.turnIndex === entry.turnIndex)) {
      chain.entries.push(entry);
    }
    this.submittedThisTurn.add(entry.authorId);
    this.emit("entry-update");
    if (this.isHost) this.maybeAdvanceTurn();
  }

  /** 방장 전용: 전원이 이번 턴을 제출했으면 다음 턴으로 넘어간다. */
  private maybeAdvanceTurn() {
    if (this.submittedThisTurn.size < this.playerOrder.length) return;
    const nextTurn = this.currentTurn + 1;
    this.applyTurnAdvance({ currentTurn: nextTurn });
    this.channel.send({ type: "broadcast", event: "turn_advance", payload: { currentTurn: nextTurn } });
  }

  /** 방장 전용 비상 스킵: 연결이 끊긴 사람이 있어 제출이 영영 안 모일 때, 미제출자를 빈 항목으로 채우고 강제로 다음 턴으로 넘어간다. */
  forceAdvanceTurn() {
    if (!this.isHost) return;
    if (this.submittedThisTurn.size >= this.playerOrder.length) return;
    const type = this.myEntryType;
    this.playerOrder.forEach((playerId) => {
      if (this.submittedThisTurn.has(playerId)) return;
      const idx = this.chainIndexForPlayer(playerId, this.currentTurn);
      const chain = this.chains[idx];
      if (!chain) return;
      const entry: ChainEntry = {
        turnIndex: this.currentTurn,
        authorId: playerId,
        authorName: this.playerNames.get(playerId) ?? "참가자",
        type,
        content: type === "drawing" ? "" : "(응답 없음)",
        submittedAt: Date.now(),
      };
      chain.entries.push(entry);
      this.submittedThisTurn.add(playerId);
      this.channel.send({ type: "broadcast", event: "entry_submitted", payload: { chainIndex: idx, entry } });
    });
    this.emit("entry-update");
    const nextTurn = this.currentTurn + 1;
    this.applyTurnAdvance({ currentTurn: nextTurn });
    this.channel.send({ type: "broadcast", event: "turn_advance", payload: { currentTurn: nextTurn } });
  }

  private applyTurnAdvance(payload: { currentTurn: number }) {
    if (payload.currentTurn <= this.currentTurn) return;
    this.currentTurn = payload.currentTurn;
    this.submittedThisTurn = new Set();
    this.phase = phaseForTurn(this.currentTurn, this.totalTurns);
    this.emit("phase-change", this.phase);
  }

  // ---------- 5단계: 갤러리 공개 ----------

  /** 숨기지 않은(공개 대상) 체인만. reveal 순서 및 시상식 후보 목록의 기준이 된다. */
  get visibleChains(): Chain[] {
    return this.chains.filter((c) => !c.hidden);
  }

  get currentRevealChain(): Chain | null {
    return this.visibleChains[this.revealChainIdx] ?? null;
  }

  /**
   * 공개된(숨기지 않은) 모든 체인에서 그림 항목만 전부 모은 것 — 시상식 마지막에 보여줄
   * "오늘의 모든 그림" 사진 벽(FinalPhotoWall)의 데이터 소스가 된다.
   */
  get allRevealedDrawings(): { chain: Chain; entry: ChainEntry }[] {
    return this.visibleChains.flatMap((chain) =>
      chain.entries.filter((e) => e.type === "drawing").map((entry) => ({ chain, entry }))
    );
  }

  /** 체인의 소속 팀 — 원작자(프롬프트를 처음 쓴 사람)의 팀을 그대로 물려받는다. 팀전 모드가 아니면 항상 null. */
  teamForChain(chain: Chain): TeamId | null {
    if (!this.settings.teamMode) return null;
    return this.playerTeams.get(chain.originAuthorId) ?? null;
  }

  /**
   * 팀별 누적 리액션 수 (GDD 8절 "팀 대항 리액션 스코어"). 순위/승패 연출 없이 시상식 결과 화면 하단에
   * "오늘 어느 배가 더 웃겼는지" 정도의 가벼운 비교로만 보여준다 — 톤 원칙(GDD 5.2/8절)에 따른 절제.
   */
  get teamScores(): Record<TeamId, number> {
    const scores = { galilee: 0, tiberias: 0 } as Record<TeamId, number>;
    if (!this.settings.teamMode) return scores;
    this.visibleChains.forEach((chain) => {
      const team = this.teamForChain(chain);
      if (!team) return;
      scores[team] += this.reactionCounts.get(chain.id) ?? 0;
    });
    return scores;
  }

  get isRevealFinished(): boolean {
    return this.revealStarted && this.revealChainIdx >= this.visibleChains.length;
  }

  /** 공개 시작 전, 원작자 본인 또는 방장이 특정 체인을 발표에서 제외한다 (GDD 3.6절). */
  setChainHidden(idx: number, hidden: boolean) {
    if (this.revealStarted) return;
    const chain = this.chains[idx];
    if (!chain) return;
    const canToggle = chain.originAuthorId === this.userId || this.isHost;
    if (!canToggle) return;
    chain.hidden = hidden;
    this.emit("reveal-update");
    this.channel.send({ type: "broadcast", event: "chain_hidden", payload: { idx, hidden } });
  }

  private applyChainHidden(payload: { idx: number; hidden: boolean }) {
    const chain = this.chains[payload.idx];
    if (!chain) return;
    chain.hidden = payload.hidden;
    this.emit("reveal-update");
  }

  /** 방장 전용: 갤러리 공개를 시작한다. */
  startReveal() {
    if (!this.isHost || this.revealStarted) return;
    this.applyRevealStart();
    this.channel.send({ type: "broadcast", event: "reveal_start", payload: {} });
  }

  private applyRevealStart() {
    this.revealStarted = true;
    this.revealChainIdx = 0;
    this.revealEntryCount = this.visibleChains.length > 0 ? 1 : 0;
    this.emit("reveal-update");
  }

  /** 방장 전용: 현재 체인에서 한 항목씩 더 보여주고, 다 보여줬으면 다음 체인으로 넘어간다. */
  revealNext() {
    if (!this.isHost || !this.revealStarted || this.isRevealFinished) return;
    const chain = this.currentRevealChain;
    if (!chain) return;
    let { revealChainIdx, revealEntryCount } = this;
    if (revealEntryCount < chain.entries.length) {
      revealEntryCount += 1;
    } else {
      revealChainIdx += 1;
      revealEntryCount = 1;
    }
    this.applyRevealAdvance({ revealChainIdx, revealEntryCount });
    this.channel.send({ type: "broadcast", event: "reveal_advance", payload: { revealChainIdx, revealEntryCount } });
  }

  private applyRevealAdvance(payload: { revealChainIdx: number; revealEntryCount: number }) {
    this.revealChainIdx = payload.revealChainIdx;
    this.revealEntryCount = payload.revealEntryCount;
    this.emit("reveal-update");
  }

  toggleAutoPlay() {
    if (!this.isHost) return;
    this.autoPlay = !this.autoPlay;
    this.emit("reveal-update");
  }

  /** 현재 공개 중인 체인에 이모지 리액션을 보낸다. 발신자도 즉시 애니메이션이 보이도록 낙관적으로 로컬 반영 후 브로드캐스트한다. */
  sendReaction(emoji: string) {
    const chain = this.currentRevealChain;
    if (!chain) return;
    this.reactionCounts.set(chain.id, (this.reactionCounts.get(chain.id) ?? 0) + 1);
    this.emit("reaction", { emoji, chainId: chain.id });
    this.channel.send({ type: "broadcast", event: "reaction", payload: { emoji, chainId: chain.id } });
  }

  private applyReaction(payload: { emoji: string; chainId: string }) {
    this.reactionCounts.set(payload.chainId, (this.reactionCounts.get(payload.chainId) ?? 0) + 1);
    this.emit("reaction", payload);
  }

  /** 방장 전용: 갤러리 공개를 마치고 시상식으로 넘어간다. 이번 판 투표 카테고리(말씀 부활상은 후보가 있을 때만)를 확정한다. */
  finishReveal() {
    if (!this.isHost) return;
    const hasResurrectionCandidate = this.visibleChains.some((c) => {
      const origin = c.entries[0];
      return origin?.type === "prompt" && origin.category && FAITH_CATEGORIES.includes(origin.category);
    });
    const awardCategories = VOTED_AWARD_CATEGORIES.filter((cat) =>
      cat === "resurrection" ? hasResurrectionCandidate : true
    );
    this.applyRevealFinish(awardCategories);
    this.channel.send({ type: "broadcast", event: "reveal_finish", payload: { awardCategories } });
  }

  private applyRevealFinish(awardCategoriesPayload?: AwardCategory[]) {
    const hasResurrectionCandidate = this.visibleChains.some((c) => {
      const origin = c.entries[0];
      return origin?.type === "prompt" && origin.category && FAITH_CATEGORIES.includes(origin.category);
    });
    this.awardCategories =
      awardCategoriesPayload ??
      VOTED_AWARD_CATEGORIES.filter((cat) => (cat === "resurrection" ? hasResurrectionCandidate : true));
    this.votingCategoryIdx = 0;
    this.votes = new Map();
    this.awardsRevealed = false;
    this.phase = "awards";
    this.emit("phase-change", this.phase);
  }

  // ---------- 6단계: 시상식 ----------

  get currentVotingCategory(): AwardCategory | null {
    return this.awardCategories[this.votingCategoryIdx] ?? null;
  }

  get isVotingFinished(): boolean {
    return this.votingCategoryIdx >= this.awardCategories.length;
  }

  get haveIVotedCurrentCategory(): boolean {
    const cat = this.currentVotingCategory;
    if (!cat) return false;
    return this.votes.get(cat)?.has(this.userId) ?? false;
  }

  get votedCountForCurrentCategory(): number {
    const cat = this.currentVotingCategory;
    if (!cat) return 0;
    return this.votes.get(cat)?.size ?? 0;
  }

  /** 후보 체인 목록 — resurrection 카테고리는 신앙 소재로 시작한 체인만 후보가 된다. */
  candidateChainsFor(category: AwardCategory): Chain[] {
    if (category === "resurrection") {
      return this.visibleChains.filter((c) => {
        const origin = c.entries[0];
        return origin?.type === "prompt" && origin.category && FAITH_CATEGORIES.includes(origin.category);
      });
    }
    return this.visibleChains;
  }

  /** 현재 투표 카테고리에 체인 하나를 선택해 투표한다 (같은 카테고리에 재투표하면 이전 표를 대체). */
  castVote(chainId: string) {
    const cat = this.currentVotingCategory;
    if (!cat) return;
    this.applyAwardVote({ category: cat, voterId: this.userId, chainId });
    this.channel.send({ type: "broadcast", event: "award_vote", payload: { category: cat, voterId: this.userId, chainId } });
  }

  private applyAwardVote(payload: { category: AwardCategory; voterId: string; chainId: string }) {
    if (!this.votes.has(payload.category)) this.votes.set(payload.category, new Map());
    this.votes.get(payload.category)!.set(payload.voterId, payload.chainId);
    this.emit("award-update");
  }

  /** 방장 전용: 다음 투표 카테고리로 넘어간다. 마지막 카테고리 다음엔 결과 공개 화면으로 전환된다. */
  nextVotingCategory() {
    if (!this.isHost) return;
    const nextIdx = this.votingCategoryIdx + 1;
    this.applyAwardNext({ votingCategoryIdx: nextIdx });
    this.channel.send({ type: "broadcast", event: "award_next", payload: { votingCategoryIdx: nextIdx } });
  }

  private applyAwardNext(payload: { votingCategoryIdx: number }) {
    if (payload.votingCategoryIdx <= this.votingCategoryIdx && this.votingCategoryIdx !== 0) return;
    this.votingCategoryIdx = payload.votingCategoryIdx;
    this.emit("award-update");
  }

  /** 방장 전용: 투표를 마감하고 컨페티와 함께 전체 시상 결과를 공개한다. */
  revealAwards() {
    if (!this.isHost) return;
    this.applyAwardReveal();
    this.channel.send({ type: "broadcast", event: "award_reveal", payload: {} });
  }

  private applyAwardReveal() {
    this.awardsRevealed = true;
    this.emit("award-update");
  }

  /** category별 우승 체인과 득표수. distortion/artistry/resurrection은 투표 집계, chaos는 리액션 집계로 자동 결정된다 (GDD 4.2절). */
  get awardResults(): Partial<Record<AwardCategory, { chain: Chain; count: number } | null>> {
    const results: Partial<Record<AwardCategory, { chain: Chain; count: number } | null>> = {};
    for (const cat of this.awardCategories) {
      const tally = new Map<string, number>();
      this.votes.get(cat)?.forEach((chainId) => tally.set(chainId, (tally.get(chainId) ?? 0) + 1));
      let winnerId: string | null = null;
      let best = -1;
      tally.forEach((count, chainId) => {
        if (count > best) {
          best = count;
          winnerId = chainId;
        }
      });
      const chain = winnerId ? this.chains.find((c) => c.id === winnerId) ?? null : null;
      results[cat] = chain ? { chain, count: best } : null;
    }

    // chaos(웃음 참사상)는 투표 대상이 아니라 갤러리 공개 중 쌓인 리액션 집계로 자동 결정된다.
    let chaosChain: Chain | null = null;
    let chaosCount = -1;
    this.visibleChains.forEach((chain) => {
      const count = this.reactionCounts.get(chain.id) ?? 0;
      if (count > chaosCount) {
        chaosCount = count;
        chaosChain = chain;
      }
    });
    results.chaos = chaosChain && chaosCount > 0 ? { chain: chaosChain, count: chaosCount } : null;

    return results;
  }

  // ---------- 다시하기 ----------

  /** 방장 전용: 같은 방/참가자를 유지한 채 로비로 돌아가 새 판을 준비한다 (GDD 5절 UX 플로우). */
  playAgain() {
    if (!this.isHost) return;
    this.applyPlayAgain();
    this.channel.send({ type: "broadcast", event: "play_again", payload: {} });
  }

  private applyPlayAgain() {
    this.playerOrder = [];
    this.playerNames = new Map();
    this.chains = [];
    this.currentTurn = 0;
    this.totalTurns = 0;
    this.submittedThisTurn = new Set();
    this.revealStarted = false;
    this.revealChainIdx = 0;
    this.revealEntryCount = 0;
    this.autoPlay = false;
    this.reactionCounts = new Map();
    this.awardCategories = [];
    this.votingCategoryIdx = 0;
    this.votes = new Map();
    this.awardsRevealed = false;
    this.phase = "lobby";
    this.emit("phase-change", this.phase);
    this.emit("lobby-update");
  }
}