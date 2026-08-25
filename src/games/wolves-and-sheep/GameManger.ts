import Phaser from "phaser";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Role,
  Phase,
  PlayerState,
  TASK_SPOTS,
  TaskSpot,
  BLACKOUT_PROGRESS_NEEDED,
  SPECIAL_ROLE_MIN_PLAYERS,
  INTERCESSOR_MIN_PLAYERS,
  INTERCESSION_QUIZ_BANK,
  IntercessionQuestion,
  GameSettings,
  DEFAULT_GAME_SETTINGS,
  isWolfFaction,
  isSheepFaction,
  assignRandomTasks,
  CANDLE_SPOT_IDS,
  CANDLE_PRESSES_NEEDED,
  CandleSpotId,
} from "./types";
import { EquippedCosmetics, loadEquipped, recordGameCompletion, recordTaskCompletion, saveEquipped } from "./cosmetics";

interface DeadBody {
  id: string;
  x: number;
  y: number;
  victimName: string;
}

interface ChatMsg {
  id: string;
  senderName: string;
  text: string;
}

export interface InvestigationResult {
  targetId: string;
  targetName: string;
  isWolf: boolean;
}

export interface GameStateSnapshot {
  phase: Phase;
  settings: GameSettings;
  players: Record<string, PlayerState>;
  deadBodies: DeadBody[];
  votes: Record<string, string>;
  meetingReason: string;
  meetingCallType: "body" | "emergency" | null;
  meetingEndsAt: number;
  meetingSubPhase: "discuss" | "vote";
  chatLog: ChatMsg[];
  killCooldownUntil: number;
  sabotageCooldownUntil: number;
  blackoutActive: boolean;
  blackoutEndsAt: number;
  blackoutProgress: number;
  reactorActive: boolean;
  reactorEndsAt: number;
  reactorLeftFixed: boolean;
  reactorRightFixed: boolean;
  doorLockRoomId: string | null;
  doorLockEndsAt: number;
  candleActive: boolean;
  candleEndsAt: number;
  candleSpotIds: [CandleSpotId, CandleSpotId];
  candleAProgress: number;
  candleBProgress: number;
  candleAFixed: boolean;
  candleBFixed: boolean;
  pipeActive: boolean;
  pipeEndsAt: number;
  pipeAFixed: boolean;
  pipeBFixed: boolean;
  protectedId: string | null;
  shepherdUsedThisRound: boolean;
  prophetUsedThisRound: boolean;
  intercessorUsedThisGame: boolean;
  activeIntercession: { targetId: string; targetName: string; question: IntercessionQuestion } | null;
  lastIntercessionResult: { targetName: string; success: boolean } | null;
  totalTasksRequired: number;
  totalTasksCompleted: number;
  taskAssignments: Record<string, string[]>;
  completedTaskIds: Record<string, string[]>;
  winner: "sheep" | "wolf" | null;
  emergencyCallsUsed: number;
}

export class GameManager extends Phaser.Events.EventEmitter {
  channel: RealtimeChannel;
  roomCode: string;
  userId: string;
  userName: string;

  players: Map<string, PlayerState> = new Map();
  presenceOrder: { id: string; name: string; joinedAt: number; hat?: string; pet?: string }[] = [];

  myEquipped: EquippedCosmetics = loadEquipped();
  settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };

  phase: Phase = "lobby";
  myRole: Role = "sheep";
  totalTasksRequired = 0;
  totalTasksCompleted = 0;
  myCompletedTasks: Set<string> = new Set();
  taskAssignments: Record<string, string[]> = {};
  completedTaskIds: Record<string, string[]> = {};

  get myTaskSpots(): TaskSpot[] {
    const ids = this.taskAssignments[this.userId];
    if (!ids) return [];
    return TASK_SPOTS.filter((t) => ids.includes(t.id));
  }

  deadBodies: DeadBody[] = [];
  votes: Map<string, string> = new Map();
  meetingReason = "";
  meetingCallType: "body" | "emergency" | null = null;
  meetingEndsAt = 0;
  meetingSubPhase: "discuss" | "vote" = "discuss";
  chatLog: ChatMsg[] = [];

  killCooldownUntil = 0;
  sabotageCooldownUntil = 0;
  blackoutActive = false;
  blackoutEndsAt = 0;
  blackoutProgress = 0;
  hasContributedToBlackout = false;
  emergencyCallsUsed = 0;

  ghostChatLog: ChatMsg[] = [];

  reactorActive = false;
  reactorEndsAt = 0;
  reactorLeftFixed = false;
  reactorRightFixed = false;

  doorLockRoomId: string | null = null;
  doorLockEndsAt = 0;

  candleActive = false;
  candleEndsAt = 0;
  candleSpotIds: [CandleSpotId, CandleSpotId] = [CANDLE_SPOT_IDS[0], CANDLE_SPOT_IDS[1]];
  candleAProgress = 0;
  candleBProgress = 0;
  candleAFixed = false;
  candleBFixed = false;

  pipeActive = false;
  pipeEndsAt = 0;
  pipeAFixed = false;
  pipeBFixed = false;

  protectedId: string | null = null;
  shepherdUsedThisRound = false;
  prophetUsedThisRound = false;
  investigationResult: InvestigationResult | null = null;

  intercessorUsedThisGame = false;
  activeIntercession: { targetId: string; targetName: string; question: IntercessionQuestion } | null = null;
  lastIntercessionResult: { targetName: string; success: boolean } | null = null;

  winner: "sheep" | "wolf" | null = null;

  private subscribed = false;
  private joinedAt: number;
  private unbindVisibility: (() => void) | null = null;
  private blockedKillVictims = new Set<string>();
  private pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private lastRoleAssignment: Record<string, Role> | null = null;
  private returnToLobbyInFlight = false;
  private roleChannel: RealtimeChannel | null = null;
  private hostId: string | null = null;
  private gameNonce = "";
  private revealedRoles: Record<string, Role> = {};
  private processedBlackoutPresses = new Set<string>();
  private activeSabotageKind: "blackout" | "reactor" | "door" | "candle" | "pipe" | null = null;
  private activeMeetingId: string | null = null;

  // WOLVES-HARDENING-V2
  // WOLVES-SABOTAGE-RESET-V1
  private isValidCoordinate(value: number, max: number) {
    return Number.isFinite(value) && value >= 0 && value <= max;
  }

  private isAlivePlayer(id: string) {
    return this.players.get(id)?.alive === true;
  }

  private hasActiveSabotage() {
    return this.activeSabotageKind !== null;
  }

  private clearActiveSabotage(kind?: typeof this.activeSabotageKind) {
    if (!kind || this.activeSabotageKind === kind) this.activeSabotageKind = null;
  }

  private scheduleTimeout(fn: () => void, delay: number) {
    const id = setTimeout(() => {
      this.pendingTimeouts.delete(id);
      fn();
    }, delay);
    this.pendingTimeouts.add(id);
    return id;
  }

  constructor(roomCode: string, userId: string, userName: string) {
    super();
    this.roomCode = roomCode;
    this.userId = userId;
    this.userName = userName;
    this.joinedAt = Date.now();
    this.channel = supabase.channel(`wolves-room-${roomCode}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    this.bind();
    this.bindRoleChannel();
    this.bindVisibility();
  }

  get isHost(): boolean {
    if (this.hostId) return this.hostId === this.userId;
    return this.presenceOrder.length > 0 && this.presenceOrder[0].id === this.userId;
  }

  private bindRoleChannel() {
    this.roleChannel = supabase.channel(`wolves-role-${this.roomCode}-${this.userId}`, { config: { broadcast: { self: false } } });
    this.roleChannel
      .on("broadcast", { event: "role" }, ({ payload }) => this.applyPrivateRole(payload))
      .on("broadcast", { event: "investigation_result" }, ({ payload }) => {
        if (payload?.requesterId === this.userId) {
          this.investigationResult = payload.result ?? null;
          this.emit("ability-update");
        }
      })
      .subscribe();
  }

  private applyPrivateRole(payload: { role?: Role; gameNonce?: string }) {
    if (!payload?.role || (payload.gameNonce && this.gameNonce && payload.gameNonce !== this.gameNonce)) return;
    this.myRole = payload.role;
    const me = this.players.get(this.userId);
    if (me) me.role = payload.role;
    this.emit("role-update", payload.role);
  }

  private sendPrivateRoles(roles: Record<string, Role>) {
    const nonce = this.gameNonce;
    Object.entries(roles).forEach(([id, role]) => {
      if (id === this.userId) {
        this.applyPrivateRole({ role, gameNonce: nonce });
        return;
      }
      const channelName = `wolves-role-${this.roomCode}-${id}`;
      const send = () => {
        const ch = supabase.channel(channelName);
        ch.send({ type: "broadcast", event: "role", payload: { role, gameNonce: nonce } }).finally(() => {
          setTimeout(() => supabase.removeChannel(ch), 300);
        });
      };
      send();
      this.scheduleTimeout(send, 600);
      this.scheduleTimeout(send, 1400);
    });
  }

  get me(): PlayerState | undefined {
    return this.players.get(this.userId);
  }

  get alivePlayers(): PlayerState[] {
    return [...this.players.values()].filter((p) => p.alive);
  }

  get isWolfSide(): boolean {
    return isWolfFaction(this.myRole);
  }

  private bind() {
    this.channel
      .on("presence", { event: "sync" }, () => this.onPresenceSync())
      .on("broadcast", { event: "settings_update" }, ({ payload }) => this.applySettingsUpdate(payload))
      .on("broadcast", { event: "host_announce" }, ({ payload }) => { if (payload?.hostId) this.hostId = payload.hostId; })
      .on("broadcast", { event: "return_to_lobby" }, () => this.applyReturnToLobby())
      .on("broadcast", { event: "game_start" }, ({ payload }) => this.applyGameStart(payload))
      .on("broadcast", { event: "state_sync" }, ({ payload }) => this.applyStateSync(payload))
      .on("broadcast", { event: "move" }, ({ payload }) => this.applyMove(payload))
      .on("broadcast", { event: "task_progress" }, ({ payload }) => this.applyTaskProgress(payload))
      .on("broadcast", { event: "kill" }, ({ payload }) => this.applyKill(payload))
      .on("broadcast", { event: "meeting_start" }, ({ payload }) => this.applyMeetingStart(payload))
      .on("broadcast", { event: "chat" }, ({ payload }) => this.applyChat(payload))
      .on("broadcast", { event: "ghost_chat" }, ({ payload }) => this.applyGhostChat(payload))
      .on("broadcast", { event: "vote" }, ({ payload }) => this.applyVote(payload))
      .on("broadcast", { event: "vote_cancel" }, ({ payload }) => this.applyVoteCancel(payload))
      .on("broadcast", { event: "meeting_end" }, ({ payload }) => this.applyMeetingEnd(payload))
      .on("broadcast", { event: "sabotage_blackout" }, ({ payload }) => this.applyBlackoutStart(payload))
      .on("broadcast", { event: "blackout_progress" }, () => this.applyBlackoutProgress())
      .on("broadcast", { event: "blackout_end" }, () => this.applyBlackoutEnd())
      .on("broadcast", { event: "sabotage_reactor" }, ({ payload }) => this.applyReactorStart(payload))
      .on("broadcast", { event: "reactor_fix" }, ({ payload }) => this.applyReactorFix(payload))
      .on("broadcast", { event: "reactor_end" }, () => this.applyReactorEnd())
      .on("broadcast", { event: "sabotage_door" }, ({ payload }) => this.applyDoorLock(payload))
      .on("broadcast", { event: "door_unlock" }, () => this.applyDoorUnlock())
      .on("broadcast", { event: "sabotage_candle" }, ({ payload }) => this.applyCandleStart(payload))
      .on("broadcast", { event: "candle_progress" }, ({ payload }) => this.applyCandleProgress(payload))
      .on("broadcast", { event: "candle_end" }, () => this.applyCandleEnd())
      .on("broadcast", { event: "sabotage_pipe" }, ({ payload }) => this.applyPipeStart(payload))
      .on("broadcast", { event: "pipe_fix" }, ({ payload }) => this.applyPipeFix(payload))
      .on("broadcast", { event: "pipe_end" }, () => this.applyPipeEnd())
      .on("broadcast", { event: "shepherd_protect" }, ({ payload }) => this.applyProtect(payload))
      .on("broadcast", { event: "intercession_reveal" }, ({ payload }) => this.applyIntercession(payload))
      .on("broadcast", { event: "hide_state" }, ({ payload }) => this.applyHideState(payload))
      .on("broadcast", { event: "game_end" }, ({ payload }) => this.applyGameEnd(payload))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          this.subscribed = true;
          await this.trackPresence().catch(() => {});
        }
      });
  }

  private bindVisibility() {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !this.subscribed) return;
      this.trackPresence().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    this.unbindVisibility = () => document.removeEventListener("visibilitychange", onVisible);
  }

  private async trackPresence() {
    await this.channel.track({
      userId: this.userId,
      userName: this.userName,
      joinedAt: this.joinedAt,
      hat: this.myEquipped.hat ?? undefined,
      pet: this.myEquipped.pet ?? undefined,
    });
  }

  setEquipped(equipped: EquippedCosmetics) {
    this.myEquipped = equipped;
    saveEquipped(equipped);
    if (this.subscribed) this.trackPresence();
    this.emit("lobby-update");
  }

  destroy() {
    this.unbindVisibility?.();
    this.unbindVisibility = null;
    for (const id of this.pendingTimeouts) clearTimeout(id);
    this.pendingTimeouts.clear();
    if (this.roleChannel) {
      supabase.removeChannel(this.roleChannel);
      this.roleChannel = null;
    }
    supabase.removeChannel(this.channel);
  }

  private onPresenceSync() {
    const state = this.channel.presenceState();
    const order: { id: string; name: string; joinedAt: number; hat?: string; pet?: string }[] = [];
    Object.entries(state).forEach(([id, metas]) => {
      const meta = (metas as any[])[0];
      order.push({ id, name: meta.userName, joinedAt: meta.joinedAt, hat: meta.hat, pet: meta.pet });
    });
    order.sort((a, b) => a.joinedAt - b.joinedAt);
    this.presenceOrder = order;
    if (!this.hostId || !order.some((p) => p.id === this.hostId)) this.hostId = order[0]?.id ?? null;
    this.emit("lobby-update");
    if (this.isHost) {
      this.channel.send({ type: "broadcast", event: "host_announce", payload: { hostId: this.hostId } });
    }
    if (this.isHost && this.phase === "lobby") {
      this.channel.send({ type: "broadcast", event: "settings_update", payload: this.settings });
    }
    if (this.isHost && this.phase !== "lobby") {
      this.channel.send({ type: "broadcast", event: "state_sync", payload: this.serializeState() });
      this.sendPrivateRoles(Object.fromEntries([...this.players.entries()].map(([id, p]) => [id, p.role])));
    }
  }

  updateSettings(partial: Partial<GameSettings>) {
    if (!this.isHost || this.phase !== "lobby") return;
    const next = { ...this.settings, ...partial };
    this.applySettingsUpdate(next);
    this.channel.send({ type: "broadcast", event: "settings_update", payload: next });
  }

  private applySettingsUpdate(payload: GameSettings) {
    this.settings = { ...DEFAULT_GAME_SETTINGS, ...payload };
    this.emit("settings-update");
  }

  returnToLobby() {
    if (!this.isHost || this.phase !== "ended" || this.returnToLobbyInFlight) return;
    this.returnToLobbyInFlight = true;
    this.applyReturnToLobby();
    this.channel.send({ type: "broadcast", event: "return_to_lobby", payload: {} });
  }

  private applyReturnToLobby() {
    this.activeSabotageKind = null;
    this.players.clear();
    this.deadBodies = [];
    this.votes.clear();
    this.chatLog = [];
    this.ghostChatLog = [];
    this.killCooldownUntil = 0;
    this.sabotageCooldownUntil = 0;
    this.blackoutActive = false;
    this.activeSabotageKind = null;
    this.processedBlackoutPresses.clear();
    this.blackoutEndsAt = 0;
    this.blackoutProgress = 0;
    this.reactorActive = false;
    this.reactorEndsAt = 0;
    this.reactorLeftFixed = false;
    this.reactorRightFixed = false;
    this.doorLockRoomId = null;
    this.doorLockEndsAt = 0;
    this.candleActive = false;
    this.candleEndsAt = 0;
    this.candleAProgress = 0;
    this.candleBProgress = 0;
    this.candleAFixed = false;
    this.candleBFixed = false;
    this.pipeActive = false;
    this.pipeEndsAt = 0;
    this.pipeAFixed = false;
    this.pipeBFixed = false;
    this.emergencyCallsUsed = 0;
    this.winner = null;
    this.myRole = "sheep";
    this.taskAssignments = {};
    this.completedTaskIds = {};
    this.totalTasksRequired = 0;
    this.totalTasksCompleted = 0;
    this.myCompletedTasks.clear();
    this.meetingReason = "";
    this.meetingCallType = null;
    this.meetingEndsAt = 0;
    this.meetingSubPhase = "discuss";
    this.intercessorUsedThisGame = false;
    this.activeIntercession = null;
    this.lastIntercessionResult = null;
    this.resetRoundAbilities();
    this.phase = "lobby";
    this.returnToLobbyInFlight = false;
    this.emit("phase-change", "lobby");
  }

  private shuffleIds(ids: string[]) {
    const shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private sameRoleAssignment(a: Record<string, Role> | null, b: Record<string, Role>) {
    if (!a) return false;
    const aIds = Object.keys(a);
    const bIds = Object.keys(b);
    if (aIds.length !== bIds.length) return false;
    return aIds.every((id) => a[id] === b[id]);
  }

  startGame() {
    if (!this.isHost || this.phase !== "lobby" || this.presenceOrder.length < 3) return;
    const ids = this.presenceOrder.map((p) => p.id);
    const useSpecial = ids.length >= SPECIAL_ROLE_MIN_PLAYERS;
    const useIntercessor = ids.length >= INTERCESSOR_MIN_PLAYERS;

    let roles: Record<string, Role> = {};
    let shuffled = this.shuffleIds(ids);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (attempt > 0) shuffled = this.shuffleIds(ids);
      const wolfCount = Math.max(1, Math.floor(ids.length / 4));
      const wolfIds = shuffled.slice(0, wolfCount);
      const sheepIds = shuffled.slice(wolfCount);
      const candidate: Record<string, Role> = {};
      wolfIds.forEach((id, i) => {
        candidate[id] = useSpecial && i === 0 ? "falseProphet" : "wolf";
      });
      sheepIds.forEach((id, i) => {
        if (useSpecial && i === 0) candidate[id] = "shepherd";
        else if (useSpecial && i === 1 && sheepIds.length >= 2) candidate[id] = "prophet";
        else if (useSpecial && useIntercessor && i === 2 && sheepIds.length >= 3) candidate[id] = "intercessor";
        else candidate[id] = "sheep";
      });
      roles = candidate;
      if (!this.sameRoleAssignment(this.lastRoleAssignment, roles) || attempt === 11) break;
    }
    this.lastRoleAssignment = { ...roles };

    const wolfIds = Object.entries(roles).filter(([, role]) => isWolfFaction(role)).map(([id]) => id);
    const sheepIds = Object.entries(roles).filter(([, role]) => isSheepFaction(role)).map(([id]) => id);

    const spawns: Record<string, { x: number; y: number }> = {};
    ids.forEach((id, i) => {
      const angle = (i / ids.length) * Math.PI * 2;
      spawns[id] = { x: 1800 + Math.cos(angle) * 110, y: 1400 + Math.sin(angle) * 110 };
    });

    const taskAssignments = assignRandomTasks(
      sheepIds.filter((id) => isSheepFaction(roles[id])),
      this.settings.taskPoolSize
    );
    this.gameNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = {
      playerIds: ids,
      roles,
      spawns,
      gameNonce: this.gameNonce,
      names: Object.fromEntries(this.presenceOrder.map((p) => [p.id, p.name])),
      hats: Object.fromEntries(this.presenceOrder.filter((p) => p.hat).map((p) => [p.id, p.hat!])),
      pets: Object.fromEntries(this.presenceOrder.filter((p) => p.pet).map((p) => [p.id, p.pet!])),
      settings: this.settings,
      taskAssignments,
    };
    this.applyGameStart(payload);
    const publicPayload = { ...payload, roles: undefined };
    this.channel.send({ type: "broadcast", event: "game_start", payload: publicPayload });
    this.sendPrivateRoles(roles);
  }

  private applyGameStart(payload: {
    this.activeSabotageKind = null;
    roles?: Record<string, Role>;
    playerIds?: string[];
    spawns: Record<string, { x: number; y: number }>;
    names: Record<string, string>;
    hats?: Record<string, string>;
    pets?: Record<string, string>;
    settings?: GameSettings;
    taskAssignments?: Record<string, string[]>;
    gameNonce?: string;
  }) {
    if (payload.settings) this.settings = { ...DEFAULT_GAME_SETTINGS, ...payload.settings };
    this.gameNonce = payload.gameNonce ?? this.gameNonce;
    const ids = payload.playerIds ?? Object.keys(payload.roles ?? {});
    const roles = payload.roles ?? {};
    this.players.clear();
    ids.forEach((id) => {
      const role = roles[id] ?? (id === this.userId ? this.myRole : "sheep");
      const spawn = payload.spawns[id] ?? { x: 1800, y: 1400 };
      this.players.set(id, {
        id,
        name: payload.names[id] ?? "익명",
        role,
        alive: true,
        x: spawn.x,
        y: spawn.y,
        tasksCompleted: 0,
        hidden: false,
        hat: payload.hats?.[id],
        pet: payload.pets?.[id],
      });
    });
    if (payload.roles?.[this.userId]) this.myRole = payload.roles[this.userId];
    this.taskAssignments = payload.taskAssignments ?? {};
    this.totalTasksRequired = Object.values(this.taskAssignments).reduce((sum, ids) => sum + ids.length, 0);
    this.totalTasksCompleted = 0;
    this.myCompletedTasks.clear();
    this.completedTaskIds = {};
    this.deadBodies = [];
    this.votes.clear();
    this.chatLog = [];
    this.ghostChatLog = [];
    this.winner = null;
    this.killCooldownUntil = 0;
    this.sabotageCooldownUntil = 0;
    this.blackoutActive = false;
    this.blackoutEndsAt = 0;
    this.blackoutProgress = 0;
    this.reactorActive = false;
    this.reactorEndsAt = 0;
    this.reactorLeftFixed = false;
    this.reactorRightFixed = false;
    this.doorLockRoomId = null;
    this.doorLockEndsAt = 0;
    this.candleActive = false;
    this.candleEndsAt = 0;
    this.candleAProgress = 0;
    this.candleBProgress = 0;
    this.candleAFixed = false;
    this.candleBFixed = false;
    this.pipeActive = false;
    this.pipeEndsAt = 0;
    this.pipeAFixed = false;
    this.pipeBFixed = false;
    this.emergencyCallsUsed = 0;
    this.intercessorUsedThisGame = false;
    this.activeIntercession = null;
    this.lastIntercessionResult = null;
    this.resetRoundAbilities();
    this.phase = "playing";
    this.emit("phase-change", "playing");
  }

  private resetRoundAbilities() {
    this.protectedId = null;
    this.blockedKillVictims.clear();
    this.shepherdUsedThisRound = false;
    this.prophetUsedThisRound = false;
    this.investigationResult = null;
    this.emit("ability-update");
  }

  serializeState(): GameStateSnapshot {
    return {
      phase: this.phase,
      settings: this.settings,
      players: Object.fromEntries([...this.players.entries()].map(([id, p]) => [id, { ...p, role: this.revealedRoles[id] ?? "sheep" }])),
      deadBodies: this.deadBodies,
      votes: Object.fromEntries(this.votes),
      meetingReason: this.meetingReason,
      meetingCallType: this.meetingCallType,
      meetingEndsAt: this.meetingEndsAt,
      meetingSubPhase: this.meetingSubPhase,
      chatLog: this.chatLog,
      killCooldownUntil: this.killCooldownUntil,
      sabotageCooldownUntil: this.sabotageCooldownUntil,
      blackoutActive: this.blackoutActive,
      blackoutEndsAt: this.blackoutEndsAt,
      blackoutProgress: this.blackoutProgress,
      reactorActive: this.reactorActive,
      reactorEndsAt: this.reactorEndsAt,
      reactorLeftFixed: this.reactorLeftFixed,
      reactorRightFixed: this.reactorRightFixed,
      doorLockRoomId: this.doorLockRoomId,
      doorLockEndsAt: this.doorLockEndsAt,
      candleActive: this.candleActive,
      candleEndsAt: this.candleEndsAt,
      candleSpotIds: this.candleSpotIds,
      candleAProgress: this.candleAProgress,
      candleBProgress: this.candleBProgress,
      candleAFixed: this.candleAFixed,
      candleBFixed: this.candleBFixed,
      pipeActive: this.pipeActive,
      pipeEndsAt: this.pipeEndsAt,
      pipeAFixed: this.pipeAFixed,
      pipeBFixed: this.pipeBFixed,
      protectedId: this.protectedId,
      shepherdUsedThisRound: this.shepherdUsedThisRound,
      prophetUsedThisRound: this.prophetUsedThisRound,
      intercessorUsedThisGame: this.intercessorUsedThisGame,
      activeIntercession: this.activeIntercession,
      lastIntercessionResult: this.lastIntercessionResult,
      totalTasksRequired: this.totalTasksRequired,
      totalTasksCompleted: this.totalTasksCompleted,
      taskAssignments: this.taskAssignments,
      completedTaskIds: this.completedTaskIds,
      winner: this.winner,
      emergencyCallsUsed: this.emergencyCallsUsed,
    };
  }

  private applyStateSync(payload: GameStateSnapshot) {
    this.phase = payload.phase;
    this.settings = { ...DEFAULT_GAME_SETTINGS, ...payload.settings };
    const currentMyRole = this.myRole;
    const publicPlayers = Object.fromEntries(Object.entries(payload.players).map(([id, p]) => [id, { ...p, role: this.revealedRoles[id] ?? "sheep" }]));
    this.players = new Map(Object.entries(publicPlayers));
    const myPlayer = this.players.get(this.userId);
    if (myPlayer) myPlayer.role = currentMyRole;
    this.deadBodies = payload.deadBodies;
    this.votes = new Map(Object.entries(payload.votes));
    this.meetingReason = payload.meetingReason;
    this.meetingCallType = payload.meetingCallType;
    this.meetingEndsAt = payload.meetingEndsAt;
    this.meetingSubPhase = payload.meetingSubPhase;
    this.chatLog = payload.chatLog;
    this.killCooldownUntil = payload.killCooldownUntil;
    this.sabotageCooldownUntil = payload.sabotageCooldownUntil;
    this.blackoutActive = payload.blackoutActive;
    this.blackoutEndsAt = payload.blackoutEndsAt;
    this.blackoutProgress = payload.blackoutProgress;
    this.reactorActive = payload.reactorActive;
    this.reactorEndsAt = payload.reactorEndsAt;
    this.reactorLeftFixed = payload.reactorLeftFixed;
    this.reactorRightFixed = payload.reactorRightFixed;
    this.doorLockRoomId = payload.doorLockRoomId;
    this.doorLockEndsAt = payload.doorLockEndsAt;
    this.candleActive = payload.candleActive;
    this.candleEndsAt = payload.candleEndsAt;
    this.candleSpotIds = payload.candleSpotIds;
    this.candleAProgress = payload.candleAProgress;
    this.candleBProgress = payload.candleBProgress;
    this.candleAFixed = payload.candleAFixed;
    this.candleBFixed = payload.candleBFixed;
    this.pipeActive = payload.pipeActive;
    this.pipeEndsAt = payload.pipeEndsAt;
    this.pipeAFixed = payload.pipeAFixed;
    this.pipeBFixed = payload.pipeBFixed;
    this.protectedId = payload.protectedId;
    this.shepherdUsedThisRound = payload.shepherdUsedThisRound;
    this.prophetUsedThisRound = payload.prophetUsedThisRound;
    this.intercessorUsedThisGame = payload.intercessorUsedThisGame;
    this.activeIntercession = payload.activeIntercession;
    this.lastIntercessionResult = payload.lastIntercessionResult;
    this.totalTasksRequired = payload.totalTasksRequired;
    this.totalTasksCompleted = payload.totalTasksCompleted;
    this.taskAssignments = payload.taskAssignments ?? this.taskAssignments;
    this.completedTaskIds = payload.completedTaskIds ?? this.completedTaskIds;
    this.winner = payload.winner;
    this.emergencyCallsUsed = payload.emergencyCallsUsed;

    this.myRole = this.myRole || this.players.get(this.userId)?.role || "sheep";
    this.myCompletedTasks = new Set(this.completedTaskIds[this.userId] ?? []);

    this.emit("phase-change", this.phase);
    this.emit("lobby-update");
    this.emit("ability-update");
    this.emit("tasks-update");
    this.emit("chat-update");
    this.emit("vote-update");
    this.emit("blackout-change");
    this.emit("reactor-change");
    this.emit("doorlock-change");
  }

  sendMove(x: number, y: number) {
    if (this.phase !== "playing" || !this.me?.alive) return;
    if (!this.isValidCoordinate(x, 3600) || !this.isValidCoordinate(y, 2800)) return;
    const p = this.players.get(this.userId);
    if (!p) return;
    if (Math.hypot(x - p.x, y - p.y) > 360) return;
    p.x = x;
    p.y = y;
    this.channel.send({ type: "broadcast", event: "move", payload: { id: this.userId, x, y } });
  }

  private applyMove(payload: { id: string; x: number; y: number }) {
    if (this.phase !== "playing") return;
    if (!this.isValidCoordinate(payload.x, 3600) || !this.isValidCoordinate(payload.y, 2800)) return;
    const p = this.players.get(payload.id);
    if (!p || !p.alive) return;
    if (Math.hypot(payload.x - p.x, payload.y - p.y) > 360) return;
    p.x = payload.x;
    p.y = payload.y;
    this.emit("player-moved", payload.id);
  }

  completeTask(taskId: string) {
    if (this.phase !== "playing" || !this.me?.alive) return;
    if (!(this.taskAssignments[this.userId] ?? []).includes(taskId)) return;
    if (this.myCompletedTasks.has(taskId)) return;
    this.myCompletedTasks.add(taskId);
    recordTaskCompletion();
    this.applyTaskProgress({ playerId: this.userId, taskId });
    this.channel.send({ type: "broadcast", event: "task_progress", payload: { playerId: this.userId, taskId } });
  }

  private applyTaskProgress(payload: { playerId: string; taskId: string }) {
    if (this.phase !== "playing") return;
    if (!this.isAlivePlayer(payload.playerId)) return;
    if (!(this.taskAssignments[payload.playerId] ?? []).includes(payload.taskId)) return;
    const done = this.completedTaskIds[payload.playerId] ?? (this.completedTaskIds[payload.playerId] = []);
    if (done.includes(payload.taskId)) return;
    done.push(payload.taskId);
    const p = this.players.get(payload.playerId);
    if (p) p.tasksCompleted += 1;
    this.totalTasksCompleted += 1;
    this.emit("tasks-update");
    this.checkWin();
  }

  canKill(now: number) {
    return this.isWolfSide && now >= this.killCooldownUntil && this.phase === "playing";
  }

  killPlayer(victimId: string) {
    if (!this.canKill(Date.now()) || victimId === this.userId) return;
    const victim = this.players.get(victimId);
    if (!victim || !victim.alive) return;
    this.killCooldownUntil = Date.now() + this.settings.killCooldownMs;
    const payload = { victimId, x: victim.x, y: victim.y, victimName: victim.name };
    this.applyKill(payload);
    this.channel.send({ type: "broadcast", event: "kill", payload });
  }

  private applyKill(payload: { victimId: string; x: number; y: number; victimName: string }) {
    if (this.phase !== "playing") return;
    if (this.blockedKillVictims.has(payload.victimId)) return;
    const p = this.players.get(payload.victimId);
    if (!p || !p.alive) return;
    if (payload.victimId === this.protectedId) {
      this.protectedId = null;
      this.blockedKillVictims.add(payload.victimId);
      this.emit("kill-blocked", payload.victimId);
      return;
    }
    p.alive = false;
    if (!this.deadBodies.some((body) => body.id === payload.victimId)) {
      this.deadBodies.push({ id: payload.victimId, x: payload.x, y: payload.y, victimName: payload.victimName });
    }
    this.emit("player-killed", payload.victimId);
    this.checkWin();
  }

  canProtect() {
    return this.myRole === "shepherd" && !this.shepherdUsedThisRound && this.phase === "playing";
  }

  protectPlayer(targetId: string) {
    if (!this.canProtect()) return;
    if (!this.players.has(targetId) || !this.players.get(targetId)?.alive) return;
    this.shepherdUsedThisRound = true;
    const payload = { targetId };
    this.applyProtect(payload);
    this.channel.send({ type: "broadcast", event: "shepherd_protect", payload });
    this.emit("ability-update");
  }

  private applyProtect(payload: { targetId: string }) {
    if (this.phase !== "playing") return;
    const target = this.players.get(payload.targetId);
    if (!target || !target.alive) return;
    this.protectedId = payload.targetId;
    this.emit("ability-update");
  }

  setHidden(hidden: boolean) {
    const me = this.players.get(this.userId);
    if (!me) return;
    if (!hidden && !me.hidden) return;
    me.hidden = hidden;
    this.channel.send({ type: "broadcast", event: "hide_state", payload: { id: this.userId, hidden } });
    this.emit("hide-change", this.userId);
  }

  private applyHideState(payload: { id: string; hidden: boolean }) {
    const p = this.players.get(payload.id);
    if (p) p.hidden = payload.hidden;
    this.emit("hide-change", payload.id);
  }

  canInvestigate() {
    return (
      (this.myRole === "prophet" || this.myRole === "falseProphet") &&
      !this.prophetUsedThisRound &&
      this.phase === "playing"
    );
  }

  investigate(targetId: string): InvestigationResult | null {
    if (!this.canInvestigate()) return null;
    const target = this.players.get(targetId);
    if (!target || !target.alive || target.id === this.userId) return null;
    this.prophetUsedThisRound = true;
    const trueIsWolf = isWolfFaction(target.role);
    const shown = this.myRole === "falseProphet" ? !trueIsWolf : trueIsWolf;
    this.investigationResult = { targetId, targetName: target.name, isWolf: shown };
    this.emit("ability-update");
    return this.investigationResult;
  }

  canIntercede() {
    return this.myRole === "intercessor" && !this.intercessorUsedThisGame && this.phase === "playing" && this.deadBodies.length > 0;
  }

  beginIntercession(targetId: string) {
    if (!this.canIntercede()) return;
    const body = this.deadBodies.find((b) => b.id === targetId);
    if (!body) return;
    const question = INTERCESSION_QUIZ_BANK[Math.floor(Math.random() * INTERCESSION_QUIZ_BANK.length)];
    this.activeIntercession = { targetId: body.id, targetName: body.victimName, question };
    this.emit("ability-update");
  }

  answerIntercession(selectedIndex: number) {
    const active = this.activeIntercession;
    if (!active || this.intercessorUsedThisGame) return;
    this.intercessorUsedThisGame = true;
    const correct = selectedIndex === active.question.answerIndex;
    const body = this.deadBodies.find((b) => b.id === active.targetId);
    this.lastIntercessionResult = { targetName: active.targetName, success: correct && !!body };
    this.activeIntercession = null;
    if (correct && body) {
      const payload = { targetId: body.id, targetName: body.victimName, x: body.x, y: body.y, byName: this.userName };
      this.applyIntercession(payload);
      this.channel.send({ type: "broadcast", event: "intercession_reveal", payload });
    } else {
      this.emit("ability-update");
    }
  }

  cancelIntercession() {
    this.activeIntercession = null;
    this.emit("ability-update");
  }

  private applyIntercession(payload: { targetId: string; targetName: string; x: number; y: number; byName: string }) {
    if (this.phase !== "playing") return;
    const p = this.players.get(payload.targetId);
    if (p && !p.alive) {
      p.alive = true;
      this.blockedKillVictims.delete(payload.targetId);
      p.x = payload.x;
      p.y = payload.y;
    }
    this.deadBodies = this.deadBodies.filter((b) => b.id !== payload.targetId);
    this.emit("player-revived", payload);
    this.emit("ability-update");
  }

  canCallEmergency() {
    return this.emergencyCallsUsed < this.settings.maxEmergencyMeetings && this.phase === "playing";
  }

  callMeeting(reason: string) {
    if (this.phase !== "playing" || !this.me?.alive) return;
    if (reason !== "emergency" && reason !== "body") return;
    if (this.phase !== "playing") return;
    if (reason === "emergency" && this.emergencyCallsUsed >= this.settings.maxEmergencyMeetings) return;
    const nextEmergencyCallsUsed = reason === "emergency" ? this.emergencyCallsUsed + 1 : this.emergencyCallsUsed;
    const payload = { reason, callerName: this.userName, emergencyCallsUsed: nextEmergencyCallsUsed };
    this.applyMeetingStart(payload);
    this.channel.send({ type: "broadcast", event: "meeting_start", payload });
  }

  private applyMeetingStart(payload: {
    this.activeSabotageKind = null; reason: string; callerName: string; emergencyCallsUsed: number }) {
    if (this.phase !== "playing" || this.winner) return;
    let interruptedSabotage = false;
    if (this.blackoutActive) { this.blackoutActive = false; interruptedSabotage = true; this.emit("blackout-change"); }
    if (this.reactorActive) { this.reactorActive = false; interruptedSabotage = true; this.emit("reactor-change"); }
    if (this.doorLockRoomId) { this.doorLockRoomId = null; interruptedSabotage = true; this.emit("doorlock-change"); }
    if (this.candleActive) { this.candleActive = false; interruptedSabotage = true; this.emit("candle-change"); }
    if (this.pipeActive) { this.pipeActive = false; interruptedSabotage = true; this.emit("pipe-change"); }
    if (interruptedSabotage) this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;

    this.phase = "meeting";
    this.meetingCallType = payload.reason === "emergency" ? "emergency" : "body";
    this.meetingReason = `${payload.callerName}님이 회의를 소집했습니다 (${payload.reason === "emergency" ? "긴급 기도 모임" : "시신 발견"})`;
    this.meetingSubPhase = "discuss";
    this.meetingEndsAt = Date.now() + this.settings.meetingDiscussMs;
    this.emergencyCallsUsed = payload.emergencyCallsUsed;
    this.votes.clear();
    this.chatLog = [];
    this.emit("phase-change", "meeting");
    this.scheduleTimeout(() => {
      if (this.phase === "meeting" && this.meetingSubPhase === "discuss") {
        this.meetingSubPhase = "vote";
        this.meetingEndsAt = Date.now() + this.settings.meetingVoteMs;
        this.emit("meeting-subphase", "vote");
        this.scheduleTimeout(() => {
          if (this.isHost && this.phase === "meeting") this.resolveMeeting();
        }, this.settings.meetingVoteMs + 500);
      }
    }, this.settings.meetingDiscussMs);
  }

  sendChat(text: string) {
    if (!this.me?.alive) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const msg = { id: `${this.userId}-${Date.now()}`, senderName: this.userName, text: trimmed };
    this.applyChat(msg);
    this.channel.send({ type: "broadcast", event: "chat", payload: msg });
  }

  private applyChat(msg: ChatMsg) {
    this.chatLog.push(msg);
    if (this.chatLog.length > 100) this.chatLog.shift();
    this.emit("chat-update");
  }

  sendGhostChat(text: string) {
    if (this.me?.alive) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const msg = { id: `${this.userId}-${Date.now()}`, senderName: this.userName, text: trimmed };
    this.applyGhostChat(msg);
    this.channel.send({ type: "broadcast", event: "ghost_chat", payload: msg });
  }

  private applyGhostChat(msg: ChatMsg) {
    this.ghostChatLog.push(msg);
    if (this.ghostChatLog.length > 100) this.ghostChatLog.shift();
    this.emit("ghost-chat-update");
  }

  castVote(targetId: string) {
    if (!this.me?.alive) return;
    if (this.phase !== "meeting" || this.meetingSubPhase !== "vote") return;
    const payload = { voterId: this.userId, targetId };
    this.applyVote(payload);
    this.channel.send({ type: "broadcast", event: "vote", payload });
  }

  cancelVote() {
    if (!this.me?.alive) return;
    if (!this.votes.has(this.userId)) return;
    const payload = { voterId: this.userId };
    this.applyVoteCancel(payload);
    this.channel.send({ type: "broadcast", event: "vote_cancel", payload });
  }

  private applyVote(payload: { voterId: string; targetId: string }) {
    if (this.phase !== "meeting" || this.meetingSubPhase !== "vote") return;
    const voter = this.players.get(payload.voterId);
    if (!voter || !voter.alive) return;
    const target = payload.targetId ? this.players.get(payload.targetId) : null;
    if (payload.targetId && (!target || !target.alive)) return;
    this.votes.set(payload.voterId, payload.targetId);
    this.emit("vote-update");
    this.maybeResolveMeetingEarly();
  }

  private applyVoteCancel(payload: { voterId: string }) {
    if (this.phase !== "meeting" || this.meetingSubPhase !== "vote") return;
    if (!this.isAlivePlayer(payload.voterId)) return;
    this.votes.delete(payload.voterId);
    this.emit("vote-update");
  }

  private maybeResolveMeetingEarly() {
    if (!this.isHost) return;
    if (this.phase !== "meeting" || this.meetingSubPhase !== "vote") return;
    const aliveIds = this.alivePlayers.map((p) => p.id);
    if (aliveIds.length === 0) return;
    const allVoted = aliveIds.every((id) => this.votes.has(id));
    if (allVoted) this.resolveMeeting();
  }

  private resolveMeeting() {
    const tally = new Map<string, number>();
    this.votes.forEach((targetId) => { if (targetId) tally.set(targetId, (tally.get(targetId) ?? 0) + 1); });
    let ejectedId: string | null = null;
    let max = 0;
    let tie = false;
    tally.forEach((count, id) => {
      if (count > max) { max = count; ejectedId = id; tie = false; }
      else if (count === max) tie = true;
    });
    if (tie) ejectedId = null;
    const payload = { ejectedId, role: ejectedId ? this.players.get(ejectedId)?.role ?? null : null };
    this.applyMeetingEnd(payload);
    this.channel.send({ type: "broadcast", event: "meeting_end", payload });
  }

  private applyMeetingEnd(payload: { ejectedId: string | null }) {
    if (payload.ejectedId) {
      const p = this.players.get(payload.ejectedId);
      if (p) { p.alive = false; if (payload.role) { p.role = payload.role; this.revealedRoles[payload.ejectedId] = payload.role; } }
    }
    this.phase = "playing";
    this.resetRoundAbilities();
    this.emit("meeting-result", payload.ejectedId);
    this.emit("phase-change", "playing");
    this.checkWin();
  }

  canOpenSabotageMenu(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.blackoutActive && !this.reactorActive && !this.doorLockRoomId && !this.candleActive && !this.pipeActive;
  }

  private hasActiveSabotage() { return this.activeSabotageKind !== null; }

  canSabotage(now: number) {
    return this.isWolfSide && this.me?.alive === true && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.hasActiveSabotage();
  }

  triggerBlackout() {
    if (!this.canSabotage(Date.now())) return;

    if (!this.canSabotage(Date.now())) return;
    this.activeSabotageKind = "blackout";
    const payload = { endsAt: Date.now() + this.settings.blackoutDurationMs };
    this.applyBlackoutStart(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_blackout", payload });
  }

  private applyBlackoutStart(payload: { endsAt: number }) {
    if (this.phase !== "playing" || this.hasActiveSabotage()) return;
    this.activeSabotageKind = "blackout";
    this.blackoutActive = true;
    this.blackoutEndsAt = payload.endsAt;
    this.blackoutProgress = 0;
    this.hasContributedToBlackout = false;
    this.emit("blackout-change");
  }

  progressBlackout() {
    if (!this.me?.alive || this.phase !== "playing") return;
    if (!this.blackoutActive) return;
    this.hasContributedToBlackout = true;
    const pressId = `${this.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.applyBlackoutProgress({ pressId });
    this.channel.send({ type: "broadcast", event: "blackout_progress", payload: { pressId } });
  }

  private applyBlackoutProgress(payload: { pressId?: string } = {}) {
    if (!this.blackoutActive) return;
    if (payload.pressId) {
      if (this.processedBlackoutPresses.has(payload.pressId)) return;
      this.processedBlackoutPresses.add(payload.pressId);
    }
    this.blackoutProgress += 1;
    this.emit("blackout-change");
    if (this.blackoutProgress >= BLACKOUT_PROGRESS_NEEDED) this.endBlackout(true);
  }

  private endBlackout(broadcast: boolean) {
    this.clearActiveSabotage("blackout");
    this.blackoutActive = false;
    this.activeSabotageKind = null;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("blackout-change");
    if (broadcast) this.channel.send({ type: "broadcast", event: "blackout_end", payload: {} });
  }

  private applyBlackoutEnd() {
    this.clearActiveSabotage("blackout");
    this.blackoutActive = false;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("blackout-change");
  }

  canReactorSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.hasActiveSabotage();
  }

  triggerReactorSabotage() {
    if (!this.canReactorSabotage(Date.now()) || this.hasActiveSabotage()) return;

    if (!this.canReactorSabotage(Date.now())) return;
    this.activeSabotageKind = "reactor";
    const payload = { endsAt: Date.now() + this.settings.reactorSabotageDurationMs };
    this.applyReactorStart(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_reactor", payload });
  }

  private applyReactorStart(payload: { endsAt: number }) {
    if (this.phase !== "playing" || this.hasActiveSabotage()) return;
    this.activeSabotageKind = "reactor";
    this.reactorActive = true;
    this.reactorEndsAt = payload.endsAt;
    this.reactorLeftFixed = false;
    this.reactorRightFixed = false;
    this.emit("reactor-change");
    this.scheduleTimeout(() => {
      if (this.reactorActive && this.reactorEndsAt === payload.endsAt) {
        this.applyGameEnd({ winner: "wolf" });
        if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload: { winner: "wolf" } });
      }
    }, Math.max(0, payload.endsAt - Date.now()));
  }

  fixReactorPanel(side: "left" | "right") {
    if (!this.me?.alive || this.phase !== "playing") return;
    if (!this.reactorActive) return;
    const payload = { side };
    this.applyReactorFix(payload);
    this.channel.send({ type: "broadcast", event: "reactor_fix", payload });
  }

  private applyReactorFix(payload: { side: "left" | "right" }) {
    if (!this.reactorActive) return;
    if (payload.side === "left") this.reactorLeftFixed = true;
    else this.reactorRightFixed = true;
    this.emit("reactor-change");
    if (this.reactorLeftFixed && this.reactorRightFixed) {
      this.reactorActive = false;
      this.activeSabotageKind = null;
      this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
      this.emit("reactor-change");
      this.channel.send({ type: "broadcast", event: "reactor_end", payload: {} });
    }
  }

  private applyReactorEnd() {
    this.clearActiveSabotage("reactor");
    this.reactorActive = false;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("reactor-change");
  }

  canDoorSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.hasActiveSabotage();
  }

  triggerDoorLock(roomId: string) {
    if (!this.canDoorSabotage(Date.now()) || this.hasActiveSabotage()) return;

    if (!this.canDoorSabotage(Date.now())) return;
    this.activeSabotageKind = "door";
    const payload = { roomId, endsAt: Date.now() + this.settings.doorLockDurationMs };
    this.applyDoorLock(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_door", payload });
  }

  private applyDoorLock(payload: { roomId: string; endsAt: number }) {
    if (this.phase !== "playing" || this.hasActiveSabotage()) return;
    this.activeSabotageKind = "door";
    if (this.phase !== "playing") return;
    this.doorLockRoomId = payload.roomId;
    this.doorLockEndsAt = payload.endsAt;
    this.emit("doorlock-change");
    this.scheduleTimeout(() => {
      if (this.doorLockRoomId === payload.roomId && this.doorLockEndsAt === payload.endsAt) this.endDoorLock(this.isHost);
    }, Math.max(0, payload.endsAt - Date.now()));
  }

  private endDoorLock(broadcast: boolean) {
    this.clearActiveSabotage("door");
    this.doorLockRoomId = null;
    this.doorLockEndsAt = 0;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("doorlock-change");
    if (broadcast) this.channel.send({ type: "broadcast", event: "door_unlock", payload: {} });
  }

  private applyDoorUnlock() {
    this.clearActiveSabotage("door");
    this.doorLockRoomId = null;
    this.doorLockEndsAt = 0;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("doorlock-change");
  }

  canCandleSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.hasActiveSabotage();
  }

  triggerCandleSabotage() {
    if (!this.canCandleSabotage(Date.now()) || this.hasActiveSabotage()) return;

    if (!this.canCandleSabotage(Date.now())) return;
    this.activeSabotageKind = "candle";
    const shuffled = [...CANDLE_SPOT_IDS].sort(() => Math.random() - 0.5);
    const spotIds: [CandleSpotId, CandleSpotId] = [shuffled[0], shuffled[1]];
    const payload = { endsAt: Date.now() + this.settings.candleSabotageDurationMs, spotIds };
    this.applyCandleStart(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_candle", payload });
  }

  private applyCandleStart(payload: { endsAt: number; spotIds: [CandleSpotId, CandleSpotId] }) {
    if (this.phase !== "playing" || this.hasActiveSabotage()) return;
    this.activeSabotageKind = "candle";
    this.candleActive = true;
    this.candleEndsAt = payload.endsAt;
    this.candleSpotIds = payload.spotIds;
    this.candleAProgress = 0;
    this.candleBProgress = 0;
    this.candleAFixed = false;
    this.candleBFixed = false;
    this.emit("candle-change");
    this.scheduleTimeout(() => {
      if (this.candleActive && this.candleEndsAt === payload.endsAt) {
        this.applyGameEnd({ winner: "wolf" });
        if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload: { winner: "wolf" } });
      }
    }, Math.max(0, payload.endsAt - Date.now()));
  }

  extinguishCandle(role: "a" | "b") {
    if (!this.me?.alive || this.phase !== "playing") return;
    if (!this.candleActive) return;
    if (role === "a" ? this.candleAFixed : this.candleBFixed) return;
    const payload = { role };
    this.applyCandleProgress(payload);
    this.channel.send({ type: "broadcast", event: "candle_progress", payload });
  }

  private applyCandleProgress(payload: { role: "a" | "b" }) {
    if (!this.candleActive) return;
    if (payload.role === "a") {
      if (this.candleAFixed) return;
      this.candleAProgress += 1;
      if (this.candleAProgress >= CANDLE_PRESSES_NEEDED) this.candleAFixed = true;
    } else {
      if (this.candleBFixed) return;
      this.candleBProgress += 1;
      if (this.candleBProgress >= CANDLE_PRESSES_NEEDED) this.candleBFixed = true;
    }
    this.emit("candle-change");
    if (this.candleAFixed && this.candleBFixed) {
      this.candleActive = false;
      this.candleEndsAt = 0;
      this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
      this.emit("candle-change");
      this.channel.send({ type: "broadcast", event: "candle_end", payload: {} });
    }
  }

  private applyCandleEnd() {
    this.clearActiveSabotage("candle");
    this.candleActive = false;
    this.candleEndsAt = 0;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("candle-change");
  }

  canPipeSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.hasActiveSabotage();
  }

  triggerPipeSabotage() {
    if (!this.canPipeSabotage(Date.now()) || this.hasActiveSabotage()) return;

    if (!this.canPipeSabotage(Date.now())) return;
    this.activeSabotageKind = "pipe";
    const payload = { endsAt: Date.now() + this.settings.pipeSabotageDurationMs };
    this.applyPipeStart(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_pipe", payload });
  }

  private applyPipeStart(payload: { endsAt: number }) {
    if (this.phase !== "playing" || this.hasActiveSabotage()) return;
    this.activeSabotageKind = "pipe";
    this.pipeActive = true;
    this.pipeEndsAt = payload.endsAt;
    this.pipeAFixed = false;
    this.pipeBFixed = false;
    this.emit("pipe-change");
    this.scheduleTimeout(() => {
      if (this.pipeActive && this.pipeEndsAt === payload.endsAt) {
        this.applyGameEnd({ winner: "wolf" });
        if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload: { winner: "wolf" } });
      }
    }, Math.max(0, payload.endsAt - Date.now()));
  }

  fixPipePanel(panel: "a" | "b") {
    if (!this.me?.alive || this.phase !== "playing") return;
    if (!this.pipeActive) return;
    const payload = { panel };
    this.applyPipeFix(payload);
    this.channel.send({ type: "broadcast", event: "pipe_fix", payload });
  }

  private applyPipeFix(payload: { panel: "a" | "b" }) {
    if (!this.pipeActive) return;
    if (payload.panel === "a") this.pipeAFixed = true;
    else this.pipeBFixed = true;
    this.emit("pipe-change");
    if (this.pipeAFixed && this.pipeBFixed) {
      this.pipeActive = false;
      this.pipeEndsAt = 0;
      this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
      this.emit("pipe-change");
      this.channel.send({ type: "broadcast", event: "pipe_end", payload: {} });
    }
  }

  private applyPipeEnd() {
    this.clearActiveSabotage("pipe");
    this.pipeActive = false;
    this.pipeEndsAt = 0;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("pipe-change");
  }

  private checkWin() {
    if (!this.isHost) return;
    if (this.phase === "ended" || this.winner) return;
    const alive = this.alivePlayers;
    const aliveWolves = alive.filter((p) => isWolfFaction(p.role)).length;
    const aliveSheep = alive.filter((p) => isSheepFaction(p.role)).length;
    let winner: "sheep" | "wolf" | null = null;
    if (aliveWolves === 0) winner = "sheep";
    else if (aliveWolves >= aliveSheep) winner = "wolf";
    else if (this.totalTasksRequired > 0 && this.totalTasksCompleted >= this.totalTasksRequired) winner = "sheep";
    if (winner) {
      const payload = { winner };
      this.applyGameEnd({ ...payload, roles: Object.fromEntries([...this.players.entries()].map(([id, p]) => [id, p.role])) });
      if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload: { ...payload, roles: Object.fromEntries([...this.players.entries()].map(([id, p]) => [id, p.role])) } });
    }
  }

  private applyGameEnd(payload: {
    this.activeSabotageKind = null; winner: "sheep" | "wolf"; roles?: Record<string, Role> }) {
    if (this.phase === "ended") return;
    this.winner = payload.winner;
    if (payload.roles) {
      this.revealedRoles = payload.roles;
      Object.entries(payload.roles).forEach(([id, role]) => { const p = this.players.get(id); if (p) p.role = role; });
    }
    this.phase = "ended";
    const myFaction = isWolfFaction(this.myRole) ? "wolf" : "sheep";
    recordGameCompletion(myFaction === payload.winner);
    this.emit("phase-change", "ended");
  }
}
