import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sanitizeChatText, CHAT_COOLDOWN_MS } from "@/lib/chatSafety";
import {
  Role,
  Phase,
  PlayerState,
  ChatMsg,
  PlayerStatsRow,
  SeasonRow,
  SeasonStatsRow,
  RoomSettings,
  DEFAULT_SETTINGS,
  MIN_PLAYERS,
  LAST_WORDS_MS,
  MVP_VOTE_MS,
  ADVANCED_ROLES_MIN_PLAYERS,
  isPhariseeFaction,
  isPhariseeAlignedForWin,
} from "./types";

export interface ReactionEvent {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
}

export interface InvestigationResult {
  targetId: string;
  targetName: string;
  isPharisee: boolean;
}

/** 이 게임은 캔버스가 필요 없는 텍스트 기반이라 Phaser 없이 아주 작은 이벤트 이미터만 직접 둔다. */
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

export class GameManager extends MiniEmitter {
  channel: RealtimeChannel;
  roomCode: string;
  userId: string;
  userName: string;

  players: Map<string, PlayerState> = new Map();
  presenceOrder: { id: string; name: string; joinedAt: number }[] = [];

  phase: Phase = "lobby";
  myRole: Role = "citizen";
  round = 1;

  // ---- 6단계: 방 설정 ----
  settings: RoomSettings = { ...DEFAULT_SETTINGS };

  phaseEndsAt = 0;
  /** 지난 밤 사망자 명단 */
  lastNightVictimIds: string[] = [];
  lastNightSaved = false;

  chatLog: ChatMsg[] = [];
  ghostChatLog: ChatMsg[] = [];
  votes: Map<string, string> = new Map(); // voterId -> targetId ('' = 기권)

  /** 도배 방지용 — 채팅/유령채팅/마지막유언 통틀어 이 사람이 마지막으로 메시지를 보낸 시각 */
  private lastChatSentAt = 0;

  // ---- 마지막 유언 ----
  lastWordsTargetId: string | null = null;
  lastWordsMsgs: ChatMsg[] = [];

  // ---- 순교자: 마지막 유언 중 1회 고발 ----
  /** 순교자가 이번 마지막 유언에서 고발한 대상 — 라운드(마지막 유언 세션)마다 초기화됨 */
  martyrAccusedTargetId: string | null = null;
  /** 방금 확정된 출교에서 순교자의 고발이 적중해 함께 처단된 대상 — UI 연출용, 다음 라운드 시작 시 초기화됨 */
  martyrStrikeResultId: string | null = null;

  // ---- 밤 행동 ----
  phariseeVotes: Map<string, string> = new Map(); // phariseeId -> targetId
  protectedId: string | null = null;
  intercessorUsedThisRound = false;
  prophetUsedThisRound = false;
  investigationResult: InvestigationResult | null = null;
  deaconGuardId: string | null = null;
  deaconUsedThisRound = false;

  winner: "citizen" | "pharisee" | null = null;

  // ---- 4단계: 전적 / MVP ----
  mvpVotes: Map<string, string> = new Map(); // voterId -> targetId
  mvpVoteCounts: Record<string, number> = {};
  mvpResultId: string | null = null;
  mvpVoted = false;
  private mvpResolved = false;
  resultRecorded = false;

  // ---- 5단계: 안정성(재접속 / 방장 이탈 대응) ----
  /** 새로고침 등으로 진행 중이던 게임을 복구해 들어온 경우 true */
  reconnected = false;
  /** 이번 판에 참여하지 않은 채로 진행 중인 게임에 들어와 구경만 하는 경우 true */
  spectatorJoined = false;
  private wasHost = false;
  private hydrated = false;

  private subscribed = false;
  private nightTimer: ReturnType<typeof setTimeout> | null = null;
  private voteTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWordsTimer: ReturnType<typeof setTimeout> | null = null;
  private mvpTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(roomCode: string, userId: string, userName: string) {
    super();
    this.roomCode = roomCode;
    this.userId = userId;
    this.userName = userName;
    this.channel = supabase.channel(`pharisee-room-${roomCode}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    this.bind();
    this.hydrateIfInProgress();
  }

  get isHost(): boolean {
    if (this.presenceOrder.length === 0) return false;
    return this.presenceOrder[0].id === this.userId;
  }

  get me(): PlayerState | undefined {
    return this.players.get(this.userId);
  }

  /** 이번 판 명단에 없는 사람 — 진행 중인 게임에 구경만 하러 들어온 관전자 */
  get isSpectator(): boolean {
    return this.phase !== "lobby" && !this.players.has(this.userId);
  }

  get alivePlayers(): PlayerState[] {
    return [...this.players.values()].filter((p) => p.alive);
  }

  get isPhariseeSide(): boolean {
    return isPhariseeFaction(this.myRole);
  }

  private bind() {
    this.channel
      .on("presence", { event: "sync" }, () => this.onPresenceSync())
      .on("broadcast", { event: "game_start" }, ({ payload }) => this.applyGameStart(payload))
      .on("broadcast", { event: "chat" }, ({ payload }) => this.applyChat(payload))
      .on("broadcast", { event: "ghost_chat" }, ({ payload }) => this.applyGhostChat(payload))
      .on("broadcast", { event: "vote" }, ({ payload }) => this.applyVote(payload))
      .on("broadcast", { event: "vote_cancel" }, ({ payload }) => this.applyVoteCancel(payload))
      .on("broadcast", { event: "pharisee_vote" }, ({ payload }) => this.applyPhariseeVote(payload))
      .on("broadcast", { event: "protect" }, ({ payload }) => this.applyProtect(payload))
      .on("broadcast", { event: "guard" }, ({ payload }) => this.applyGuard(payload))
      .on("broadcast", { event: "night_end" }, ({ payload }) => this.applyNightEnd(payload))
      .on("broadcast", { event: "day_vote_start" }, () => this.applyDayVoteStart())
      .on("broadcast", { event: "last_words_start" }, ({ payload }) => this.applyLastWordsStart(payload))
      .on("broadcast", { event: "last_words_msg" }, ({ payload }) => this.applyLastWordsMsg(payload))
      .on("broadcast", { event: "vote_end" }, ({ payload }) => this.applyEjection(payload))
      .on("broadcast", { event: "reaction" }, ({ payload }) => this.applyReaction(payload))
      .on("broadcast", { event: "game_end" }, ({ payload }) => this.applyGameEnd(payload))
      .on("broadcast", { event: "mvp_vote" }, ({ payload }) => this.applyMvpVote(payload))
      .on("broadcast", { event: "mvp_result" }, ({ payload }) => this.applyMvpResult(payload))
      .on("broadcast", { event: "room_settings" }, ({ payload }) => this.applyRoomSettings(payload))
      .on("broadcast", { event: "martyr_accuse" }, ({ payload }) => this.applyMartyrAccuse(payload))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !this.subscribed) {
          this.subscribed = true;
          await this.channel.track({ userId: this.userId, userName: this.userName, joinedAt: Date.now() });
        }
      });
  }

  destroy() {
    if (this.nightTimer) clearTimeout(this.nightTimer);
    if (this.voteTimer) clearTimeout(this.voteTimer);
    if (this.lastWordsTimer) clearTimeout(this.lastWordsTimer);
    if (this.mvpTimer) clearTimeout(this.mvpTimer);
    this.nightTimer = null;
    this.voteTimer = null;
    this.lastWordsTimer = null;
    this.mvpTimer = null;
    supabase.removeChannel(this.channel);
  }

  // ---------- presence / lobby ----------
  private onPresenceSync() {
    const state = this.channel.presenceState();
    const order: { id: string; name: string; joinedAt: number }[] = [];
    Object.entries(state).forEach(([id, metas]) => {
      const meta = (metas as any[])[0];
      order.push({ id, name: meta.userName, joinedAt: meta.joinedAt });
    });
    order.sort((a, b) => a.joinedAt - b.joinedAt);
    this.presenceOrder = order;
    const hostNow = this.isHost;
    // 방장이 아니었다가 방금 방장이 됐다면(= 이전 방장이 이탈했다면) 진행 중이던 페이즈를 이어받는다
    if (!this.wasHost && hostNow) this.resumeAsHost();
    this.wasHost = hostNow;
    // 로비에서 누가 새로 들어오면, 방장이 그동안 조절해둔 설정을 즉시 다시 뿌려준다
    // (새로 들어온 사람은 이전 broadcast를 못 받았으므로 기본값만 갖고 있는 상태)
    if (hostNow && this.phase === "lobby") {
      this.channel.send({ type: "broadcast", event: "room_settings", payload: this.settings });
    }
    this.emit("lobby-update");
  }

  // ---------- 6단계: 방 설정(로비에서만 방장이 조절 가능) ----------
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

  /**
   * 방장 이탈 등으로 방금 방장 권한을 넘겨받았을 때, 진행 중이던 페이즈의 타이머를
   * 이어받아 다시 예약한다. 원래 방장이 갖고 있던 setTimeout은 그 사람의 브라우저와
   * 함께 사라지므로, 새 방장이 남은 시간을 계산해 스스로 다시 걸어줘야 게임이 멈추지 않는다.
   */
  private resumeAsHost() {
    if (this.phase === "lobby" || this.phase === "ended") return;
    const remaining = Math.max(0, this.phaseEndsAt - Date.now());
    if (this.phase === "night" && !this.nightTimer) {
      this.nightTimer = setTimeout(() => this.resolveNight(), remaining + 500);
    } else if (this.phase === "day-discuss" && !this.voteTimer) {
      this.voteTimer = setTimeout(() => {
        this.applyDayVoteStart();
        this.channel.send({ type: "broadcast", event: "day_vote_start", payload: {} });
      }, remaining);
    } else if (this.phase === "day-vote" && !this.voteTimer) {
      this.voteTimer = setTimeout(() => this.resolveVote(), remaining + 500);
    } else if (this.phase === "day-lastwords" && !this.lastWordsTimer && this.lastWordsTargetId) {
      const targetId = this.lastWordsTargetId;
      this.lastWordsTimer = setTimeout(() => this.finalizeEjection(targetId), remaining + 500);
    }
  }

  // ---------- 5단계: 상태 스냅샷 저장 / 복구 ----------
  /** 진행 중인 페이즈가 바뀔 때마다 방장이 서버에 현재 상태를 저장해둔다 (재접속 복구용) */
  private async persistSnapshot() {
    if (!this.isHost) return;
    const roles: Record<string, Role> = {};
    const names: Record<string, string> = {};
    const alive: Record<string, boolean> = {};
    this.players.forEach((p) => {
      roles[p.id] = p.role;
      names[p.id] = p.name;
      alive[p.id] = p.alive;
    });
    const state = {
      phase: this.phase,
      round: this.round,
      phaseEndsAt: this.phaseEndsAt,
      roles,
      names,
      alive,
      lastNightVictimIds: this.lastNightVictimIds,
      lastNightSaved: this.lastNightSaved,
      protectedId: this.protectedId,
      deaconGuardId: this.deaconGuardId,
      intercessorUsedThisRound: this.intercessorUsedThisRound,
      prophetUsedThisRound: this.prophetUsedThisRound,
      deaconUsedThisRound: this.deaconUsedThisRound,
      lastWordsTargetId: this.lastWordsTargetId,
      winner: this.winner,
      martyrAccusedTargetId: this.martyrAccusedTargetId,
    };
    try {
      const { error } = await supabase
        .from("pharisee_rooms")
        .upsert({ room_code: this.roomCode, state, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (e) {
      console.error("[pharisee] 상태 저장 실패", e);
    }
  }

  /** 마운트 시, 이 방에서 이미 진행 중인 게임이 있고 내가 참여자라면 상태를 복구해 들어간다 */
  private async hydrateIfInProgress() {
    try {
      const { data, error } = await supabase
        .from("pharisee_rooms")
        .select("state")
        .eq("room_code", this.roomCode)
        .maybeSingle();
      if (error) throw error;
      const snap = data?.state as
        | {
            phase: Phase;
            round: number;
            phaseEndsAt: number;
            roles: Record<string, Role>;
            names: Record<string, string>;
            alive: Record<string, boolean>;
            /** 신규 필드. 옛 스냅샷에는 없을 수 있어 optional */
            lastNightVictimIds?: string[];
            /** 리팩터링 이전 스냅샷과의 하위호환용 — 있으면 lastNightVictimIds로 변환해 읽는다 */
            lastNightVictimId?: string | null;
            lastNightSaved: boolean;
            protectedId: string | null;
            deaconGuardId: string | null;
            intercessorUsedThisRound: boolean;
            prophetUsedThisRound: boolean;
            deaconUsedThisRound: boolean;
            lastWordsTargetId: string | null;
            winner: "citizen" | "pharisee" | null;
            martyrAccusedTargetId?: string | null;
          }
        | undefined;
      if (!snap || snap.phase === "lobby" || snap.phase === "ended") return;
      const wasParticipant = !!snap.roles[this.userId];

      this.players.clear();
      Object.entries(snap.roles).forEach(([id, role]) => {
        this.players.set(id, { id, name: snap.names[id] ?? "익명", role, alive: snap.alive[id] ?? true });
      });
      // 관전자는 자기 역할이 없으므로 myRole은 그냥 기본값으로 둔다 — isSpectator로 UI에서 분기 처리
      this.myRole = snap.roles[this.userId] ?? this.myRole;
      this.phase = snap.phase;
      this.round = snap.round;
      this.phaseEndsAt = snap.phaseEndsAt;
      // 신규 필드 우선, 없으면(리팩터링 이전 스냅샷) 단수 필드를 배열로 변환해 읽는다
      this.lastNightVictimIds = snap.lastNightVictimIds ?? (snap.lastNightVictimId ? [snap.lastNightVictimId] : []);
      this.lastNightSaved = snap.lastNightSaved;
      this.protectedId = snap.protectedId;
      this.deaconGuardId = snap.deaconGuardId;
      this.intercessorUsedThisRound = snap.intercessorUsedThisRound;
      this.prophetUsedThisRound = snap.prophetUsedThisRound;
      this.deaconUsedThisRound = snap.deaconUsedThisRound;
      this.lastWordsTargetId = snap.lastWordsTargetId;
      this.winner = snap.winner;
      this.martyrAccusedTargetId = snap.martyrAccusedTargetId ?? null;
      this.hydrated = true;
      if (wasParticipant) {
        this.reconnected = true;
      } else {
        this.spectatorJoined = true;
      }
      this.emit("phase-change", this.phase);
      // 배너 등 1회성 알림에 소비된 뒤에는 평소처럼 동작하도록 즉시 해제
      this.reconnected = false;
      this.spectatorJoined = false;
      // 방장 지위를 이어받은 채로 새로고침한 경우를 대비해, presence가 아직 안 잡혔더라도
      // 다음 sync 때 resumeAsHost가 정상 동작하도록 wasHost는 false로 유지해둔다.
    } catch (e) {
      console.error("[pharisee] 게임 상태 복구 실패", e);
    }
  }

  // ---------- game start ----------
  startGame() {
    if (!this.isHost || this.presenceOrder.length < MIN_PLAYERS) return;
    const ids = this.presenceOrder.map((p) => p.id);
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const phariseeCount = Math.max(1, Math.floor(ids.length / this.settings.phariseeRatio));
    const phariseeIds = shuffled.slice(0, phariseeCount);
    const rest = shuffled.slice(phariseeCount);
    const specialRolesActive = ids.length >= this.settings.specialRolesMinPlayers;
    // 순교자는 인원이 넉넉할 때(기본 12명+)만 자동으로 추가되는 확장 역할
    const advancedRolesActive = ids.length >= ADVANCED_ROLES_MIN_PLAYERS;

    const roles: Record<string, Role> = {};
    phariseeIds.forEach((id) => (roles[id] = "pharisee"));
    rest.forEach((id, i) => {
      if (i === 0) roles[id] = "intercessor";
      else if (i === 1 && rest.length >= 2) roles[id] = "prophet";
      else if (specialRolesActive && i === 2 && rest.length >= 3) roles[id] = "deacon";
      else if (specialRolesActive && i === 3 && rest.length >= 4) roles[id] = "traitor";
      else if (advancedRolesActive && i === 4 && rest.length >= 5) roles[id] = "martyr";
      else roles[id] = "citizen";
    });

    const payload = {
      roles,
      names: Object.fromEntries(this.presenceOrder.map((p) => [p.id, p.name])),
      settings: this.settings,
    };
    this.applyGameStart(payload);
    this.channel.send({ type: "broadcast", event: "game_start", payload });
  }

  private applyGameStart(payload: { roles: Record<string, Role>; names: Record<string, string>; settings?: RoomSettings }) {
    this.players.clear();
    Object.entries(payload.roles).forEach(([id, role]) => {
      this.players.set(id, { id, name: payload.names[id] ?? "익명", role, alive: true });
    });
    this.myRole = payload.roles[this.userId] ?? "citizen";
    this.settings = payload.settings ?? this.settings;
    this.round = 1;
    this.chatLog = [];
    this.ghostChatLog = [];
    this.votes.clear();
    this.lastWordsTargetId = null;
    this.lastWordsMsgs = [];
    this.winner = null;
    this.mvpVotes.clear();
    this.mvpVoteCounts = {};
    this.mvpResultId = null;
    this.mvpVoted = false;
    this.mvpResolved = false;
    this.resultRecorded = false;
    this.martyrAccusedTargetId = null;
    this.martyrStrikeResultId = null;
    this.lastNightVictimIds = [];
    if (this.mvpTimer) clearTimeout(this.mvpTimer);
    this.resetRoundState();
    this.phase = "night";
    this.phaseEndsAt = Date.now() + this.settings.nightMs;
    this.emit("phase-change", "night");
    if (this.isHost) {
      this.nightTimer = setTimeout(() => this.resolveNight(), this.settings.nightMs + 500);
      this.persistSnapshot();
    }
  }

  private resetRoundState() {
    this.phariseeVotes.clear();
    this.protectedId = null;
    this.intercessorUsedThisRound = false;
    this.prophetUsedThisRound = false;
    this.investigationResult = null;
    this.deaconGuardId = null;
    this.deaconUsedThisRound = false;
    this.martyrAccusedTargetId = null;
    this.emit("ability-update");
  }

  // ---------- night: 바리새인 지목 ----------
  canVotePharisee() {
    return this.myRole === "pharisee" && this.phase === "night" && !!this.me?.alive;
  }

  votePharisee(targetId: string) {
    if (!this.canVotePharisee()) return;
    const payload = { voterId: this.userId, targetId };
    this.applyPhariseeVote(payload);
    this.channel.send({ type: "broadcast", event: "pharisee_vote", payload });
  }

  private applyPhariseeVote(payload: { voterId: string; targetId: string }) {
    this.phariseeVotes.set(payload.voterId, payload.targetId);
    this.emit("ability-update");
  }

  // ---------- night: 중보 기도자 보호 ----------
  canProtect() {
    return this.myRole === "intercessor" && !this.intercessorUsedThisRound && this.phase === "night" && !!this.me?.alive;
  }

  protectPlayer(targetId: string) {
    if (!this.canProtect()) return;
    this.intercessorUsedThisRound = true;
    const payload = { targetId };
    this.applyProtect(payload);
    this.channel.send({ type: "broadcast", event: "protect", payload });
    this.emit("ability-update");
  }

  private applyProtect(payload: { targetId: string }) {
    this.protectedId = payload.targetId;
    this.emit("ability-update");
  }

  // ---------- night: 안수집사 몸으로 지키기 ----------
  canGuard() {
    return this.myRole === "deacon" && !this.deaconUsedThisRound && this.phase === "night" && !!this.me?.alive;
  }

  guardPlayer(targetId: string) {
    if (!this.canGuard()) return;
    if (targetId === this.userId) return; // 자기 자신은 지킬 수 없음
    this.deaconUsedThisRound = true;
    const payload = { targetId };
    this.applyGuard(payload);
    this.channel.send({ type: "broadcast", event: "guard", payload });
    this.emit("ability-update");
  }

  private applyGuard(payload: { targetId: string }) {
    this.deaconGuardId = payload.targetId;
    this.emit("ability-update");
  }

  // ---------- night: 선지자 분별 ----------
  canInvestigate() {
    return this.myRole === "prophet" && !this.prophetUsedThisRound && this.phase === "night" && !!this.me?.alive;
  }

  investigate(targetId: string): InvestigationResult | null {
    if (!this.canInvestigate()) return null;
    const target = this.players.get(targetId);
    if (!target) return null;
    this.prophetUsedThisRound = true;
    this.investigationResult = { targetId, targetName: target.name, isPharisee: isPhariseeFaction(target.role) };
    this.emit("ability-update");
    return this.investigationResult;
  }

  // ---------- 순교자: 마지막 유언 중 1회 고발(자신이 지목되었을 때만) ----------
  canMartyrAccuse() {
    return (
      this.myRole === "martyr" &&
      this.phase === "day-lastwords" &&
      this.userId === this.lastWordsTargetId &&
      !this.martyrAccusedTargetId
    );
  }

  martyrAccuse(targetId: string) {
    if (!this.canMartyrAccuse()) return;
    if (targetId === this.userId) return; // 자기 자신은 고발할 수 없음
    const payload = { targetId };
    this.applyMartyrAccuse(payload);
    this.channel.send({ type: "broadcast", event: "martyr_accuse", payload });
  }

  private applyMartyrAccuse(payload: { targetId: string }) {
    this.martyrAccusedTargetId = payload.targetId;
    this.emit("ability-update");
  }

  // ---------- night 종료(호스트만) ----------
  private resolveNight() {
    if (!this.isHost) return;
    const tally = new Map<string, number>();
    this.phariseeVotes.forEach((targetId) => {
      if (!targetId) return;
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    });
    let targetId: string | null = null;
    let max = 0;
    let tie = false;
    tally.forEach((count, id) => {
      if (count > max) {
        max = count;
        targetId = id;
        tie = false;
      } else if (count === max) tie = true;
    });
    if (tie) targetId = null;

    const victims = new Set<string>();
    let saved = false;

    if (targetId) {
      if (targetId === this.protectedId) {
        // 중보 기도자의 보호 — 완전히 무사함
        saved = true;
      } else if (targetId === this.deaconGuardId) {
        // 안수집사가 지키던 사람이 표적이 됨 — 안수집사가 대신 희생됨
        const deacon = [...this.players.values()].find((p) => p.role === "deacon" && p.alive);
        victims.add(deacon && deacon.id !== targetId ? deacon.id : targetId);
      } else {
        victims.add(targetId);
      }
    }

    const payload = { victimIds: [...victims], saved };
    this.applyNightEnd(payload);
    this.channel.send({ type: "broadcast", event: "night_end", payload });
  }

  private applyNightEnd(payload: { victimIds: string[]; saved: boolean }) {
    payload.victimIds.forEach((id) => {
      const p = this.players.get(id);
      if (p) p.alive = false;
    });
    this.lastNightVictimIds = payload.victimIds;
    this.lastNightSaved = payload.saved;
    this.phase = "day-discuss";
    this.chatLog = [];
    this.votes.clear();
    this.phaseEndsAt = Date.now() + this.settings.discussMs;
    this.emit("phase-change", "day-discuss");
    if (!this.checkWin() && this.isHost) {
      this.voteTimer = setTimeout(() => {
        this.applyDayVoteStart();
        this.channel.send({ type: "broadcast", event: "day_vote_start", payload: {} });
      }, this.settings.discussMs);
      this.persistSnapshot();
    }
  }

  private applyDayVoteStart() {
    this.phase = "day-vote";
    this.phaseEndsAt = Date.now() + this.settings.voteMs;
    this.emit("phase-change", "day-vote");
    if (this.isHost) {
      this.voteTimer = setTimeout(() => this.resolveVote(), this.settings.voteMs + 500);
      this.persistSnapshot();
    }
  }

  // ---------- 낮 채팅 ----------
  sendChat(text: string) {
    if (!this.me?.alive) return; // 사망자·관전자는 본 채팅에 낄 수 없음 — 유령 채팅을 이용해야 함
    const clean = sanitizeChatText(text);
    if (!clean) return;
    const now = Date.now();
    if (now - this.lastChatSentAt < CHAT_COOLDOWN_MS) {
      this.emit("chat-blocked");
      return;
    }
    this.lastChatSentAt = now;
    const msg = { id: `${this.userId}-${now}`, senderId: this.userId, senderName: this.userName, text: clean };
    this.applyChat(msg);
    this.channel.send({ type: "broadcast", event: "chat", payload: msg });
  }

  private applyChat(msg: ChatMsg) {
    this.chatLog.push(msg);
    this.emit("chat-update");
  }

  /** 사망한 플레이어끼리만 보이는 유령 채팅 — 모두에게 브로드캐스트되지만 살아있는 클라이언트는 화면에 표시하지 않는다. */
  sendGhostChat(text: string) {
    if (this.me?.alive) return;
    const clean = sanitizeChatText(text);
    if (!clean) return;
    const now = Date.now();
    if (now - this.lastChatSentAt < CHAT_COOLDOWN_MS) {
      this.emit("chat-blocked");
      return;
    }
    this.lastChatSentAt = now;
    const msg = { id: `${this.userId}-${now}`, senderId: this.userId, senderName: this.userName, text: clean };
    this.applyGhostChat(msg);
    this.channel.send({ type: "broadcast", event: "ghost_chat", payload: msg });
  }

  private applyGhostChat(msg: ChatMsg) {
    this.ghostChatLog.push(msg);
    this.emit("ghost-chat-update");
  }

  // ---------- 낮 투표(출교) ----------
  /** 투표하기 — 이미 투표했어도 다른 대상으로 바꿔 다시 누를 수 있다 */
  castVote(targetId: string) {
    if (!this.me?.alive) return; // 사망자·관전자는 출교 투표에 참여할 수 없음
    const payload = { voterId: this.userId, targetId };
    this.applyVote(payload);
    this.channel.send({ type: "broadcast", event: "vote", payload });
  }

  /** 투표 취소하기 — 아직 투표하지 않았으면 아무 일도 하지 않는다 */
  cancelVote() {
    if (!this.me?.alive) return;
    if (!this.votes.has(this.userId)) return;
    const payload = { voterId: this.userId };
    this.applyVoteCancel(payload);
    this.channel.send({ type: "broadcast", event: "vote_cancel", payload });
  }

  private applyVote(payload: { voterId: string; targetId: string }) {
    this.votes.set(payload.voterId, payload.targetId);
    this.emit("vote-update");
    this.maybeAutoResolveVote();
  }

  private applyVoteCancel(payload: { voterId: string }) {
    this.votes.delete(payload.voterId);
    this.emit("vote-update");
  }

  /** 살아있는 모든 사람이 투표를 마쳤으면(기권 포함) 타이머를 기다리지 않고 바로 다음 단계로 진행한다 */
  private maybeAutoResolveVote() {
    if (!this.isHost || this.phase !== "day-vote") return;
    const aliveCount = this.alivePlayers.length;
    if (aliveCount === 0 || this.votes.size < aliveCount) return;
    if (this.voteTimer) {
      clearTimeout(this.voteTimer);
      this.voteTimer = null;
    }
    this.resolveVote();
  }

  private resolveVote() {
    if (!this.isHost) return;
    const tally = new Map<string, number>();
    this.votes.forEach((targetId) => {
      if (!targetId) return;
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    });
    let ejectedId: string | null = null;
    let max = 0;
    let tie = false;
    tally.forEach((count, id) => {
      if (count > max) {
        max = count;
        ejectedId = id;
        tie = false;
      } else if (count === max) tie = true;
    });
    if (tie) ejectedId = null;

    if (ejectedId) {
      // 바로 출교시키지 않고, 먼저 마지막 유언 페이즈로 넘어간다
      const payload = { targetId: ejectedId };
      this.applyLastWordsStart(payload);
      this.channel.send({ type: "broadcast", event: "last_words_start", payload });
    } else {
      const payload = { ejectedId: null };
      this.applyEjection(payload);
      this.channel.send({ type: "broadcast", event: "vote_end", payload });
    }
  }

  // ---------- 마지막 유언 ----------
  private applyLastWordsStart(payload: { targetId: string }) {
    this.phase = "day-lastwords";
    this.lastWordsTargetId = payload.targetId;
    this.lastWordsMsgs = [];
    this.martyrAccusedTargetId = null;
    this.phaseEndsAt = Date.now() + LAST_WORDS_MS;
    this.emit("phase-change", "day-lastwords");
    if (this.isHost) {
      this.lastWordsTimer = setTimeout(() => this.finalizeEjection(payload.targetId), LAST_WORDS_MS + 500);
      this.persistSnapshot();
    }
  }

  /** 지목된 본인만 보낼 수 있는 마지막 발언 */
  sendLastWords(text: string) {
    if (this.phase !== "day-lastwords" || this.userId !== this.lastWordsTargetId) return;
    const clean = sanitizeChatText(text);
    if (!clean) return;
    const now = Date.now();
    if (now - this.lastChatSentAt < CHAT_COOLDOWN_MS) {
      this.emit("chat-blocked");
      return;
    }
    this.lastChatSentAt = now;
    const msg = { id: `${this.userId}-${now}`, senderId: this.userId, senderName: this.userName, text: clean };
    this.applyLastWordsMsg(msg);
    this.channel.send({ type: "broadcast", event: "last_words_msg", payload: msg });
  }

  private applyLastWordsMsg(msg: ChatMsg) {
    this.lastWordsMsgs.push(msg);
    this.emit("lastwords-update");
  }

  private finalizeEjection(targetId: string) {
    if (!this.isHost) return;
    const ejectedId = targetId;
    // 출교당하는 사람이 순교자이고 실제로 누군가를 고발했다면, 그 대상이 진짜 바리새인 편인지 판정한다
    let martyrStrikeId: string | null = null;
    if (ejectedId && this.martyrAccusedTargetId) {
      const martyr = this.players.get(ejectedId);
      const accused = this.players.get(this.martyrAccusedTargetId);
      if (martyr?.role === "martyr" && accused?.alive && isPhariseeAlignedForWin(accused.role)) {
        martyrStrikeId = accused.id;
      }
    }
    const payload = { ejectedId, martyrStrikeId };
    this.applyEjection(payload);
    this.channel.send({ type: "broadcast", event: "vote_end", payload });
  }

  private applyEjection(payload: { ejectedId: string | null; martyrStrikeId?: string | null }) {
    if (this.lastWordsTimer) clearTimeout(this.lastWordsTimer);
    if (payload.ejectedId) {
      const p = this.players.get(payload.ejectedId);
      if (p) p.alive = false;
    }
    if (payload.martyrStrikeId) {
      const target = this.players.get(payload.martyrStrikeId);
      if (target) target.alive = false;
    }
    this.martyrStrikeResultId = payload.martyrStrikeId ?? null;
    this.emit("vote-result", payload.ejectedId, payload.martyrStrikeId ?? null);
    if (this.checkWin()) return;
    this.round += 1;
    this.resetRoundState();
    this.phase = "night";
    this.phaseEndsAt = Date.now() + this.settings.nightMs;
    this.emit("phase-change", "night");
    if (this.isHost) {
      this.nightTimer = setTimeout(() => this.resolveNight(), this.settings.nightMs + 500);
      this.persistSnapshot();
    }
  }

  // ---------- 리액션 ----------
  sendReaction(emoji: string) {
    const payload: ReactionEvent = { id: `${this.userId}-${Date.now()}`, emoji, senderId: this.userId, senderName: this.userName };
    this.applyReaction(payload);
    this.channel.send({ type: "broadcast", event: "reaction", payload });
  }

  private applyReaction(payload: ReactionEvent) {
    // 로그로 쌓지 않고, 화면에 잠깐 띄우고 사라질 수 있게 이벤트만 흘려보낸다
    this.emit("reaction", payload);
  }

  // ---------- 승리 판정 ----------
  private checkWin(): boolean {
    if (this.phase === "ended" || this.winner) return true;
    const alive = this.alivePlayers;
    const alivePhariseeSide = alive.filter((p) => isPhariseeAlignedForWin(p.role)).length;
    const aliveOthers = alive.length - alivePhariseeSide;
    let winner: "citizen" | "pharisee" | null = null;
    if (alivePhariseeSide === 0) winner = "citizen";
    else if (alivePhariseeSide >= aliveOthers) winner = "pharisee";
    if (winner) {
      const payload = { winner };
      this.applyGameEnd(payload);
      if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload });
      return true;
    }
    return false;
  }

  private applyGameEnd(payload: { winner: "citizen" | "pharisee" }) {
    if (this.phase === "ended") return;
    if (this.nightTimer) clearTimeout(this.nightTimer);
    if (this.voteTimer) clearTimeout(this.voteTimer);
    if (this.lastWordsTimer) clearTimeout(this.lastWordsTimer);
    this.winner = payload.winner;
    this.phase = "ended";
    this.emit("phase-change", "ended");
    this.recordMyResult();
    if (this.isHost) {
      this.mvpTimer = setTimeout(() => this.resolveMvp(), MVP_VOTE_MS);
      this.persistSnapshot();
    }
  }

  // ---------- 4단계: 내 전적 기록(각자 자기 결과를 스스로 기록) ----------
  private async recordMyResult() {
    if (this.resultRecorded) return;
    // 이번 판에 참여하지 않고 구경만 한 관전자는 전적을 기록하지 않는다
    if (!this.players.has(this.userId)) return;
    this.resultRecorded = true;
    const won =
      this.winner === "citizen" ? !isPhariseeAlignedForWin(this.myRole) : isPhariseeAlignedForWin(this.myRole);
    try {
      const { error } = await supabase.rpc("record_pharisee_result", {
        p_user_name: this.userName,
        p_won: won,
      });
      if (error) throw error;
    } catch (e) {
      console.error("[pharisee] 전적 기록 실패", e);
    }
    // 시즌 랭크(RP)는 별도 테이블이라 실패해도 전적 기록 자체엔 영향 없게 독립적으로 처리
    try {
      const { error } = await supabase.rpc("record_pharisee_season_result", {
        p_user_name: this.userName,
        p_won: won,
      });
      if (error) throw error;
    } catch (e) {
      console.error("[pharisee] 시즌 랭크 기록 실패", e);
    }
  }

  // ---------- 4단계: MVP 투표 ----------
  canVoteMvp() {
    return this.phase === "ended" && !this.mvpVoted;
  }

  voteMvp(targetId: string) {
    if (!this.canVoteMvp()) return;
    if (targetId === this.userId) return; // 자기 자신은 투표 불가
    this.mvpVoted = true;
    const payload = { voterId: this.userId, targetId };
    this.applyMvpVote(payload);
    this.channel.send({ type: "broadcast", event: "mvp_vote", payload });
  }

  private applyMvpVote(payload: { voterId: string; targetId: string }) {
    this.mvpVotes.set(payload.voterId, payload.targetId);
    this.emit("mvp-update");
    // 관전자 표까지 세면 실제 참여자가 다 투표하기 전에 조기 마감될 수 있어, 이번 판 참여자(players)의 표만 센다
    const participantVoteCount = [...this.mvpVotes.keys()].filter((voterId) => this.players.has(voterId)).length;
    if (this.isHost && !this.mvpResolved && participantVoteCount >= this.players.size) {
      this.resolveMvp();
    }
  }

  private resolveMvp() {
    if (!this.isHost || this.mvpResolved) return;
    this.mvpResolved = true;
    if (this.mvpTimer) clearTimeout(this.mvpTimer);
    const tally = new Map<string, number>();
    this.mvpVotes.forEach((targetId) => {
      if (!targetId) return;
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    });
    let winnerId: string | null = null;
    let max = 0;
    let tie = false;
    tally.forEach((count, id) => {
      if (count > max) {
        max = count;
        winnerId = id;
        tie = false;
      } else if (count === max) tie = true;
    });
    if (tie || max === 0) winnerId = null;
    const counts: Record<string, number> = {};
    tally.forEach((count, id) => (counts[id] = count));
    const payload = { winnerId, counts };
    this.applyMvpResult(payload);
    this.channel.send({ type: "broadcast", event: "mvp_result", payload });
  }

  private applyMvpResult(payload: { winnerId: string | null; counts: Record<string, number> }) {
    this.mvpResultId = payload.winnerId;
    this.mvpVoteCounts = payload.counts;
    this.emit("mvp-update");
    if (this.isHost && payload.winnerId) {
      this.recordMvp(payload.winnerId);
    }
  }

  private async recordMvp(targetId: string) {
    try {
      const { error } = await supabase.rpc("record_pharisee_mvp", { p_target_user_id: targetId });
      if (error) throw error;
    } catch (e) {
      console.error("[pharisee] MVP 기록 실패", e);
    }
    try {
      const { error } = await supabase.rpc("record_pharisee_season_mvp", { p_target_user_id: targetId });
      if (error) throw error;
    } catch (e) {
      console.error("[pharisee] 시즌 MVP 보너스 기록 실패", e);
    }
  }

  // ---------- 4단계: 리더보드 조회 ----------
  static async fetchLeaderboard(limit = 20): Promise<PlayerStatsRow[]> {
    const { data, error } = await supabase
      .from("pharisee_player_stats")
      .select("user_id, user_name, games_played, wins, losses, mvp_count")
      .order("wins", { ascending: false })
      .order("mvp_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as PlayerStatsRow[];
  }

  static async fetchMyStats(userId: string): Promise<PlayerStatsRow | null> {
    const { data, error } = await supabase
      .from("pharisee_player_stats")
      .select("user_id, user_name, games_played, wins, losses, mvp_count")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as PlayerStatsRow) ?? null;
  }

  // ---------- 9단계: 랭크 / 시즌 조회 ----------
  /** 현재 활성 시즌을 가져온다. 아직 시즌이 시작된 적 없으면 서버(RPC)에서 1시즌을 자동으로 만들어 반환한다. */
  static async fetchActiveSeason(): Promise<SeasonRow> {
    const { data, error } = await supabase.rpc("get_active_pharisee_season");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row as SeasonRow;
  }

  static async fetchSeasonLeaderboard(seasonId: string, limit = 20): Promise<SeasonStatsRow[]> {
    const { data, error } = await supabase
      .from("pharisee_season_stats")
      .select("season_id, user_id, user_name, rp, games_played, wins, losses, mvp_count")
      .eq("season_id", seasonId)
      .order("rp", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as SeasonStatsRow[];
  }

  static async fetchMySeasonStats(seasonId: string, userId: string): Promise<SeasonStatsRow | null> {
    const { data, error } = await supabase
      .from("pharisee_season_stats")
      .select("season_id, user_id, user_name, rp, games_played, wins, losses, mvp_count")
      .eq("season_id", seasonId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as SeasonStatsRow) ?? null;
  }
}