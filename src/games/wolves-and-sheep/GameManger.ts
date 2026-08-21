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

/**
 * 재접속(이어하기) 시 방장이 현재 게임 상태를 통째로 스냅샷으로 만들어 뿌려주는 페이로드.
 * serializeState() / applyStateSync()가 이 형태를 서로 주고받는다.
 * "내 것"이 아니라 "방 전체가 공유하는 상태"만 담는다 — myCompletedTasks, investigationResult처럼
 * 클라이언트 로컬 전용인 값은 포함하지 않는다(4-3-(1) 참고, 알려진 제약사항).
 */
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
  /** 플레이어 id -> 그 사람에게 배정된 미션 id 목록. 방장이 game_start 때 한 번 뽑아서
   *  전원에게 뿌리므로(어몽어스식 랜덤 분배), 재접속자도 이 값을 그대로 받아 적용한다. */
  taskAssignments: Record<string, string[]>;
  /** 플레이어 id -> 그 사람이 실제로 완료한 미션 id 목록(방 전체 공유 상태).
   *  재접속 시 myCompletedTasks(로컬 전용)를 이 값으로 복원해서, 이미 끝낸 미션을
   *  다시 완료 처리해 totalTasksCompleted가 중복 집계되는 걸 막는다. */
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

  /** 로비에서 내가 장착한 모자/펫 — track()으로 방 전체에 알려서 game_start 페이로드에 포함시킨다. */
  myEquipped: EquippedCosmetics = loadEquipped();

  /** 방장이 로비에서 조절하는 게임 설정값. 방장이 바뀌면 방 전체에 브로드캐스트되어 동기화된다. */
  settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };

  phase: Phase = "lobby";
  myRole: Role = "sheep";
  totalTasksRequired = 0;
  totalTasksCompleted = 0;
  myCompletedTasks: Set<string> = new Set();
  /** 플레이어 id -> 배정된 미션 id 목록 (어몽어스식 랜덤 분배 결과). */
  taskAssignments: Record<string, string[]> = {};
  /** 플레이어 id -> 실제로 완료한 미션 id 목록(방 전체 공유, state_sync로 전달됨).
   *  myCompletedTasks는 로컬 전용이라 재접속하면 비어버리므로, 이 값을 진짜 출처(source of
   *  truth)로 삼아 재접속 시 myCompletedTasks를 복원하고 totalTasksCompleted 중복 집계를 막는다. */
  completedTaskIds: Record<string, string[]> = {};

  /** 내게 배정된 미션 지점 목록. 맵 마커/미션 나침반이 전체 TASK_SPOTS 대신 이걸 참조한다. */
  get myTaskSpots(): TaskSpot[] {
    const ids = this.taskAssignments[this.userId];
    if (!ids) return [];
    return TASK_SPOTS.filter((t) => ids.includes(t.id));
  }

  deadBodies: DeadBody[] = [];
  votes: Map<string, string> = new Map(); // voterId -> targetId ('' = 기권)
  meetingReason = "";
  // 6-4: MeetingModal이 "신고"와 "긴급 기도 모임"을 아이콘·컬러로 즉시 구분해 보여줄 수 있도록,
  // 문구를 파싱하는 대신 원본 사유를 그대로 들고 있는다.
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

  // 유령(사망자)끼리만 쓰는 별도 채팅 로그. 일반 chatLog(회의 중 공개 토론)와 분리해서
  // 살아있는 플레이어에게는 절대 안 보이게 한다 — UI에서 me.alive === false일 때만 렌더링.
  ghostChatLog: ChatMsg[] = [];

  // ---- 사보타지 확장: 보일러실(2인 협동) / 도어락 ----
  reactorActive = false;
  reactorEndsAt = 0;
  reactorLeftFixed = false;
  reactorRightFixed = false;

  doorLockRoomId: string | null = null;
  doorLockEndsAt = 0;

  // ---- 사보타지 확장: 촛불 화재 / 배수관 파열 (둘 다 2인 협동 수리) ----
  // 촛불 화재는 후보 4곳(CANDLE_SPOT_IDS) 중 매 사보타지마다 랜덤으로 뽑힌 2곳만 불이 붙는다.
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

  // ---- 특수 역할: 목자(보호) / 선지자·거짓 선지자(조사) ----
  protectedId: string | null = null;
  shepherdUsedThisRound = false;
  prophetUsedThisRound = false;
  investigationResult: InvestigationResult | null = null;

  // ---- 특수 역할: 중보자(중보 기도로 부활, 게임당 1회) ----
  /** 라운드 단위가 아니라 "게임 전체에 단 1번"이라 resetRoundAbilities에서 초기화하지 않는다. */
  intercessorUsedThisGame = false;
  /** 지금 기도 대상으로 고른 시신 + 그에 응답으로 주어진 말씀 문제(정답 맞히면 부활) */
  activeIntercession: { targetId: string; targetName: string; question: IntercessionQuestion } | null = null;
  /** 직전 중보 기도 결과(성공/실패) — UI에서 결과 문구를 보여주기 위함 */
  lastIntercessionResult: { targetName: string; success: boolean } | null = null;

  winner: "sheep" | "wolf" | null = null;

  private subscribed = false;
  private unbindVisibility: (() => void) | null = null;

  constructor(roomCode: string, userId: string, userName: string) {
    super();
    this.roomCode = roomCode;
    this.userId = userId;
    this.userName = userName;
    this.channel = supabase.channel(`wolves-room-${roomCode}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    this.bind();
    this.bindVisibility();
  }

  get isHost(): boolean {
    if (this.presenceOrder.length === 0) return false;
    return this.presenceOrder[0].id === this.userId;
  }

  get me(): PlayerState | undefined {
    return this.players.get(this.userId);
  }

  get alivePlayers(): PlayerState[] {
    return [...this.players.values()].filter((p) => p.alive);
  }

  /** 내 역할이 늑대 진영(늑대/거짓 선지자)인지 */
  get isWolfSide(): boolean {
    return isWolfFaction(this.myRole);
  }

  private bind() {
    this.channel
      .on("presence", { event: "sync" }, () => this.onPresenceSync())
      .on("broadcast", { event: "settings_update" }, ({ payload }) => this.applySettingsUpdate(payload))
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
        // [버그 수정 - iOS 재접속] 예전엔 "최초 1회만" presence를 track해서, 앱 전환/화면
        // 잠금 등으로 iOS가 웹소켓을 끊었다가 realtime-js가 자체적으로 재연결에 성공해
        // SUBSCRIBED가 다시 오더라도 이 클라이언트는 다시 track하지 않았다. 그 결과 재연결은
        // 됐는데도 presence(방 참가자 목록)에는 계속 빠진 채로 남아, 본인 화면도 다른 사람
        // 화면도 게임이 멈춘 것처럼 보이는 원인이었다(정상적으로 나갔다 URL로 재접속하는
        // 경우는 새 GameManager라 문제없었지만, 탭을 유지한 채 잠깐 백그라운드로 갔다 온
        // 경우가 실제로 훨씬 흔하다). track()은 멱등적이라 매번 다시 불러도 안전하다.
        if (status === "SUBSCRIBED") {
          this.subscribed = true;
          await this.trackPresence().catch(() => {});
        }
      });
  }

  /** 탭을 유지한 채 백그라운드로 갔다가(iOS 앱 전환, 화면 잠금 등) 돌아왔을 때를 대비한
   *  방어선. 위 subscribe 콜백이 재연결 시 SUBSCRIBED를 다시 보내주는 게 정상 경로지만,
   *  기기/타이밍에 따라 그 신호를 놓치는 경우에도 여기서 한 번 더 presence를 재등록해
   *  "돌아왔는데 게임이 멈춰 있다"는 상황을 방지한다. */
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
      joinedAt: Date.now(),
      hat: this.myEquipped.hat ?? undefined,
      pet: this.myEquipped.pet ?? undefined,
    });
  }

  /** 로비에서 코스메틱 패널이 장착을 바꿀 때 호출 — 로컬에 저장하고 presence를 다시 track해 방 전체에 알린다. */
  setEquipped(equipped: EquippedCosmetics) {
    this.myEquipped = equipped;
    saveEquipped(equipped);
    if (this.subscribed) this.trackPresence();
    this.emit("lobby-update");
  }

  destroy() {
    this.unbindVisibility?.();
    this.unbindVisibility = null;
    supabase.removeChannel(this.channel);
  }

  // ---------- presence / lobby ----------
  private onPresenceSync() {
    const state = this.channel.presenceState();
    const order: { id: string; name: string; joinedAt: number; hat?: string; pet?: string }[] = [];
    Object.entries(state).forEach(([id, metas]) => {
      const meta = (metas as any[])[0];
      order.push({ id, name: meta.userName, joinedAt: meta.joinedAt, hat: meta.hat, pet: meta.pet });
    });
    order.sort((a, b) => a.joinedAt - b.joinedAt);
    this.presenceOrder = order;
    this.emit("lobby-update");
    // 방장은 참가자 구성이 바뀔 때마다(특히 새로 들어온 사람) 현재 설정값을 다시
    // 브로드캐스트한다 — broadcast는 발신 시점에 구독 중인 클라이언트에게만 전달되므로,
    // 늦게 들어온 사람은 방장이 로비에서 이미 바꿔둔 설정을 놓치기 때문이다.
    if (this.isHost && this.phase === "lobby") {
      this.channel.send({ type: "broadcast", event: "settings_update", payload: this.settings });
    }
    // 재접속(이어하기) 지원: 로비와 동일한 패턴으로, 게임이 진행 중일 때 참가자 구성이
    // 바뀌면(특히 나갔다 돌아온 사람) 방장이 전체 상태 스냅샷을 다시 뿌려준다.
    // "누가 새로 왔는지" 구분하지 않고 매번 통째로 보내는 이유는 로비 로직과 동일 —
    // 인원이 자주 바뀌지 않는 게임 특성상 부담이 거의 없고 구현이 단순해진다.
    if (this.isHost && this.phase !== "lobby") {
      this.channel.send({ type: "broadcast", event: "state_sync", payload: this.serializeState() });
    }
  }

  // ---------- 게임 설정 (방장 전용, 로비에서만 변경 가능) ----------
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

  /** 게임 종료 후 같은 인원 그대로 로비로 돌아간다(어몽어스식 "다시하기"). 방장만 호출 가능. */
  returnToLobby() {
    if (!this.isHost || this.phase !== "ended") return;
    this.applyReturnToLobby();
    this.channel.send({ type: "broadcast", event: "return_to_lobby", payload: {} });
  }

  private applyReturnToLobby() {
    this.players.clear();
    this.deadBodies = [];
    this.votes.clear();
    this.chatLog = [];
    this.ghostChatLog = [];
    this.killCooldownUntil = 0;
    this.sabotageCooldownUntil = 0;
    this.blackoutActive = false;
    this.reactorActive = false;
    this.doorLockRoomId = null;
    this.candleActive = false;
    this.pipeActive = false;
    this.emergencyCallsUsed = 0;
    this.winner = null;
    this.intercessorUsedThisGame = false;
    this.activeIntercession = null;
    this.lastIntercessionResult = null;
    this.resetRoundAbilities();
    this.phase = "lobby";
    this.emit("phase-change", "lobby");
  }

  // ---------- game start ----------
  startGame() {
    if (!this.isHost || this.presenceOrder.length < 3) return;
    const ids = this.presenceOrder.map((p) => p.id);
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const wolfCount = Math.max(1, Math.floor(ids.length / 4));
    const wolfIds = shuffled.slice(0, wolfCount);
    const sheepIds = shuffled.slice(wolfCount);
    // 8명 이상일 때만 특수 역할(목자/선지자/거짓 선지자) 활성화
    const useSpecial = ids.length >= SPECIAL_ROLE_MIN_PLAYERS;
    // 10명 이상일 때만 세 번째 양 진영 특수 역할(중보자)까지 추가로 활성화
    const useIntercessor = ids.length >= INTERCESSOR_MIN_PLAYERS;

    const roles: Record<string, Role> = {};
    wolfIds.forEach((id, i) => {
      roles[id] = useSpecial && i === 0 ? "falseProphet" : "wolf";
    });
    sheepIds.forEach((id, i) => {
      if (useSpecial && i === 0) roles[id] = "shepherd";
      else if (useSpecial && i === 1 && sheepIds.length >= 2) roles[id] = "prophet";
      else if (useSpecial && useIntercessor && i === 2 && sheepIds.length >= 3) roles[id] = "intercessor";
      else roles[id] = "sheep";
    });

    const spawns: Record<string, { x: number; y: number }> = {};
    ids.forEach((id, i) => {
      const angle = (i / ids.length) * Math.PI * 2;
      // 기도실(중앙 허브) 중심부에서 스폰 — "The Skeld" 스타일 맵 재설계(types.ts)로
      // 중앙 방이 hall(x:1450,y:1170,w:700,h:460, 중심 1800,1400)로 바뀌면서 좌표도 함께 옮김
      spawns[id] = { x: 1800 + Math.cos(angle) * 110, y: 1400 + Math.sin(angle) * 110 };
    });
    // 양 진영(늑대 제외)에게만 미션을 배정한다 — 어몽어스처럼 사람마다 무작위로 몇 개씩만.
    // 미션 종류 개수는 방장이 로비 설정에서 정한 값(settings.taskPoolSize)을 따른다.
    const taskAssignments = assignRandomTasks(
      sheepIds.filter((id) => isSheepFaction(roles[id])),
      this.settings.taskPoolSize
    );
    const payload = {
      roles,
      spawns,
      names: Object.fromEntries(this.presenceOrder.map((p) => [p.id, p.name])),
      hats: Object.fromEntries(this.presenceOrder.filter((p) => p.hat).map((p) => [p.id, p.hat!])),
      pets: Object.fromEntries(this.presenceOrder.filter((p) => p.pet).map((p) => [p.id, p.pet!])),
      settings: this.settings,
      taskAssignments,
    };
    this.applyGameStart(payload);
    this.channel.send({ type: "broadcast", event: "game_start", payload });
  }

  private applyGameStart(payload: {
    roles: Record<string, Role>;
    spawns: Record<string, { x: number; y: number }>;
    names: Record<string, string>;
    hats?: Record<string, string>;
    pets?: Record<string, string>;
    settings?: GameSettings;
    taskAssignments?: Record<string, string[]>;
  }) {
    // 방장이 로비에서 확정한 설정값을 그 판 내내 고정해서 쓴다(늦게 합류한 클라이언트도
    // game_start 페이로드로 함께 받으므로 별도 동기화 없이 항상 정확한 값을 갖는다).
    if (payload.settings) this.settings = { ...DEFAULT_GAME_SETTINGS, ...payload.settings };
    this.players.clear();
    Object.entries(payload.roles).forEach(([id, role]) => {
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
    this.myRole = payload.roles[this.userId] ?? "sheep";
    this.taskAssignments = payload.taskAssignments ?? {};
    // 총 필요 미션 수 = 각자에게 배정된 미션 개수의 합(사람마다 배정량이 다를 수 있으므로
    // 더 이상 "양 진영 인원 * 12"가 아니다).
    this.totalTasksRequired = Object.values(this.taskAssignments).reduce((sum, ids) => sum + ids.length, 0);
    this.totalTasksCompleted = 0;
    this.myCompletedTasks.clear();
    this.completedTaskIds = {};
    this.deadBodies = [];
    this.votes.clear();
    this.chatLog = [];
    this.ghostChatLog = [];
    this.winner = null;
    this.phase = "playing";
    this.intercessorUsedThisGame = false;
    this.activeIntercession = null;
    this.lastIntercessionResult = null;
    this.resetRoundAbilities();
    this.emit("phase-change", "playing");
  }

  /** 라운드(회의 종료 후)마다 목자 보호 / 선지자 조사 가능 횟수를 초기화 */
  private resetRoundAbilities() {
    this.protectedId = null;
    this.shepherdUsedThisRound = false;
    this.prophetUsedThisRound = false;
    this.investigationResult = null;
    this.emit("ability-update");
  }

  // ---------- 재접속(이어하기): 방장이 현재 상태를 스냅샷으로 뿌려주고, 재입장자가 그대로 적용 ----------
  /** 방장이 현재 게임 진행 상태를 통째로 직렬화한다. Map은 순수 객체로 변환해서 전송한다. */
  serializeState(): GameStateSnapshot {
    return {
      phase: this.phase,
      settings: this.settings,
      players: Object.fromEntries(this.players),
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

  /**
   * 재입장자가 받은 스냅샷을 그대로 내부 상태에 덮어쓴다. applyGameStart와 비슷한 형태로,
   * 여러 번 받아도(방장이 presence sync마다 다시 쏴줘도) 항상 최신 상태로 안전하게 덮어써야 한다.
   * myCompletedTasks(어떤 과업을 완료했는지 세부 목록)와 investigationResult(내 조사 결과)는
   * 클라이언트 로컬 전용 정보라 스냅샷에 없다 — 알려진 제약사항(문서 4-3-(1), 5번 표 참고).
   */
  private applyStateSync(payload: GameStateSnapshot) {
    this.phase = payload.phase;
    this.settings = { ...DEFAULT_GAME_SETTINGS, ...payload.settings };
    this.players = new Map(Object.entries(payload.players));
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

    this.myRole = this.players.get(this.userId)?.role ?? "sheep";
    // 버그 수정: myCompletedTasks는 로컬 전용이라 재접속으로 GameManager가 새로 만들어지면
    // 빈 Set으로 시작한다. 그 상태에서 이미 끝낸 내 미션을 또 완료 처리할 수 있게 되어,
    // totalTasksCompleted가 실제 완료 수보다 더 많이 올라가고("미션을 다 하지 않았는데도
    // 게임이 끝남") 결과 화면 진행도 표시도 실제와 달라졌다. 방 전체가 공유하는
    // completedTaskIds(위에서 막 동기화됨)로 복원해서 항상 실제 완료 상태와 일치시킨다.
    this.myCompletedTasks = new Set(this.completedTaskIds[this.userId] ?? []);

    // UI가 구독 중인 이벤트들을 한 번씩 emit해서 화면을 즉시 최신 상태로 그려주게 한다.
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

  // ---------- movement ----------
  sendMove(x: number, y: number) {
    const p = this.players.get(this.userId);
    if (p) {
      p.x = x;
      p.y = y;
    }
    this.channel.send({ type: "broadcast", event: "move", payload: { id: this.userId, x, y } });
  }

  private applyMove(payload: { id: string; x: number; y: number }) {
    const p = this.players.get(payload.id);
    if (p) {
      p.x = payload.x;
      p.y = payload.y;
      this.emit("player-moved", payload.id);
    }
  }

  // ---------- tasks ----------
  completeTask(taskId: string) {
    if (this.myCompletedTasks.has(taskId)) return;
    this.myCompletedTasks.add(taskId);
    recordTaskCompletion();
    this.applyTaskProgress({ playerId: this.userId, taskId });
    this.channel.send({ type: "broadcast", event: "task_progress", payload: { playerId: this.userId, taskId } });
  }

  private applyTaskProgress(payload: { playerId: string; taskId: string }) {
    // 버그 수정: completedTaskIds(방 전체 공유 상태)를 실제 출처로 삼아, 같은 (플레이어, 미션)
    // 조합이 이미 기록돼 있으면 무시한다 — 재접속으로 로컬 myCompletedTasks가 초기화된 클라이언트가
    // 이미 끝낸 미션을 다시 완료 처리해서 totalTasksCompleted가 실제보다 부풀려지는 걸 막는다.
    const done = this.completedTaskIds[payload.playerId] ?? (this.completedTaskIds[payload.playerId] = []);
    if (done.includes(payload.taskId)) return;
    done.push(payload.taskId);
    const p = this.players.get(payload.playerId);
    if (p) p.tasksCompleted += 1;
    this.totalTasksCompleted += 1;
    this.emit("tasks-update");
    this.checkWin();
  }

  // ---------- kill ----------
  canKill(now: number) {
    return this.isWolfSide && now >= this.killCooldownUntil && this.phase === "playing";
  }

  killPlayer(victimId: string) {
    const victim = this.players.get(victimId);
    if (!victim || !victim.alive) return;
    this.killCooldownUntil = Date.now() + this.settings.killCooldownMs;
    const payload = { victimId, x: victim.x, y: victim.y, victimName: victim.name };
    this.applyKill(payload);
    this.channel.send({ type: "broadcast", event: "kill", payload });
  }

  private applyKill(payload: { victimId: string; x: number; y: number; victimName: string }) {
    if (payload.victimId === this.protectedId) {
      // 목자의 보호로 생존 — 보호는 1회성으로 소모되고 아무도 이 사실을 알 수 없음
      this.protectedId = null;
      this.emit("kill-blocked", payload.victimId);
      return;
    }
    const p = this.players.get(payload.victimId);
    if (p) p.alive = false;
    this.deadBodies.push({ id: payload.victimId, x: payload.x, y: payload.y, victimName: payload.victimName });
    this.emit("player-killed", payload.victimId);
    this.checkWin();
  }

  // ---------- shepherd: 보호 ----------
  canProtect() {
    return this.myRole === "shepherd" && !this.shepherdUsedThisRound && this.phase === "playing";
  }

  protectPlayer(targetId: string) {
    if (!this.canProtect()) return;
    this.shepherdUsedThisRound = true;
    const payload = { targetId };
    this.applyProtect(payload);
    this.channel.send({ type: "broadcast", event: "shepherd_protect", payload });
    this.emit("ability-update");
  }

  private applyProtect(payload: { targetId: string }) {
    this.protectedId = payload.targetId;
    this.emit("ability-update");
  }

  // ---------- 은신 스팟: 숨기 ----------
  setHidden(hidden: boolean) {
    const me = this.players.get(this.userId);
    if (me) me.hidden = hidden;
    this.channel.send({ type: "broadcast", event: "hide_state", payload: { id: this.userId, hidden } });
    this.emit("hide-change", this.userId);
  }

  private applyHideState(payload: { id: string; hidden: boolean }) {
    const p = this.players.get(payload.id);
    if (p) p.hidden = payload.hidden;
    this.emit("hide-change", payload.id);
  }

  // ---------- prophet / falseProphet: 조사 ----------
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
    if (!target) return null;
    this.prophetUsedThisRound = true;
    const trueIsWolf = isWolfFaction(target.role);
    // 거짓 선지자는 결과를 항상 반대로 봄
    const shown = this.myRole === "falseProphet" ? !trueIsWolf : trueIsWolf;
    this.investigationResult = { targetId, targetName: target.name, isWolf: shown };
    this.emit("ability-update");
    return this.investigationResult;
  }

  // ---------- intercessor: 중보 기도로 부활 (게임당 1회) ----------
  /** 아직 기도해주지 않은 시신이 하나라도 있는지 */
  canIntercede() {
    return this.myRole === "intercessor" && !this.intercessorUsedThisGame && this.phase === "playing" && this.deadBodies.length > 0;
  }

  /** 특정 시신을 위해 중보 기도를 시작한다 — 말씀 문제 은행에서 무작위로 한 문제를 뽑아 낸다.
   * 아직 답을 맞히기 전이라 다른 플레이어에게는 알리지 않고 나(중보자) 화면에서만 진행한다. */
  beginIntercession(targetId: string) {
    if (!this.canIntercede()) return;
    const body = this.deadBodies.find((b) => b.id === targetId);
    if (!body) return;
    const question = INTERCESSION_QUIZ_BANK[Math.floor(Math.random() * INTERCESSION_QUIZ_BANK.length)];
    this.activeIntercession = { targetId: body.id, targetName: body.victimName, question };
    this.emit("ability-update");
  }

  /** 진행 중인 기도의 말씀 문제에 답한다. 정답이면 그 자리에서 부활, 오답이면 이번 판의
   * 유일한 기회를 그대로 소진한다 — 어느 쪽이든 게임당 1회 제한이므로 신중하게 답해야 한다. */
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

  /** 기도 취소(다른 대상을 다시 고르고 싶을 때) — 문제는 버려지고 기회는 아직 소진되지 않는다. */
  cancelIntercession() {
    this.activeIntercession = null;
    this.emit("ability-update");
  }

  private applyIntercession(payload: { targetId: string; targetName: string; x: number; y: number; byName: string }) {
    const p = this.players.get(payload.targetId);
    if (p && !p.alive) {
      p.alive = true;
      p.x = payload.x;
      p.y = payload.y;
    }
    this.deadBodies = this.deadBodies.filter((b) => b.id !== payload.targetId);
    this.emit("player-revived", payload);
    this.emit("ability-update");
  }

  // ---------- meetings ----------
  canCallEmergency() {
    return this.emergencyCallsUsed < this.settings.maxEmergencyMeetings && this.phase === "playing";
  }

  callMeeting(reason: string) {
    if (this.phase !== "playing") return;
    // 버그 수정: emergencyCallsUsed를 로컬에서만 올리고 브로드캐스트하지 않으면
    // 다른 플레이어들은 이 값을 전혀 모르게 된다 — 결과적으로 "게임당 1회" 제한이
    // 플레이어 한 명 한 명한테 각각 적용돼서 인원수만큼 긴급 소집이 가능해지는 버그가 있었다.
    // 이제 다음 카운트를 계산해서 payload에 실어 보내고, 모든 클라이언트(호출자 포함)가
    // applyMeetingStart에서 이 값을 그대로 반영하게 한다.
    if (reason === "emergency" && this.emergencyCallsUsed >= this.settings.maxEmergencyMeetings) return;
    const nextEmergencyCallsUsed = reason === "emergency" ? this.emergencyCallsUsed + 1 : this.emergencyCallsUsed;
    const payload = { reason, callerName: this.userName, emergencyCallsUsed: nextEmergencyCallsUsed };
    this.applyMeetingStart(payload);
    this.channel.send({ type: "broadcast", event: "meeting_start", payload });
  }

  private applyMeetingStart(payload: { reason: string; callerName: string; emergencyCallsUsed: number }) {
    // [수정] 사보타지가 진행 중인 상태로 시체를 발견해서(혹은 긴급 소집으로) 회의가 열리면
    // 진행 중이던 사보타지를 전부 중지한다. 예전엔 이 처리가 없어서, 다 같이 모여 회의하는
    // 동안에도 사보타지 타이머가 뒤에서 계속 흘러 시간이 다 되면 회의 도중 늑대 승리로
    // 끝나버리거나(보일러실/방송/배수관), 정전으로 인한 시야 제한이 회의 중에도 풀리지 않는
    // 문제가 있었다. 각 setTimeout 콜백은 Active 플래그가 꺼지면 스스로 아무 일도 하지 않으므로,
    // 여기서 상태만 꺼주면 된다.
    // 진행 중이던 사보타지가 회의로 강제 중단되는 경우도 "해결"로 취급해 쿨타임을 돌린다.
    // 안 그러면 회의가 끝나고 다시 playing으로 돌아오자마자(양들이 실제로 사보타지를 풀지도
    // 않았는데) 늑대가 쿨타임 없이 곧바로 다음 사보타지를 걸 수 있게 된다.
    let interruptedSabotage = false;
    if (this.blackoutActive) {
      this.blackoutActive = false;
      interruptedSabotage = true;
      this.emit("blackout-change");
    }
    if (this.reactorActive) {
      this.reactorActive = false;
      interruptedSabotage = true;
      this.emit("reactor-change");
    }
    if (this.doorLockRoomId) {
      this.doorLockRoomId = null;
      interruptedSabotage = true;
      this.emit("doorlock-change");
    }
    if (this.candleActive) {
      this.candleActive = false;
      interruptedSabotage = true;
      this.emit("candle-change");
    }
    if (this.pipeActive) {
      this.pipeActive = false;
      interruptedSabotage = true;
      this.emit("pipe-change");
    }
    if (interruptedSabotage) {
      this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    }

    this.phase = "meeting";
    this.meetingCallType = payload.reason === "emergency" ? "emergency" : "body";
    this.meetingReason = `${payload.callerName}님이 회의를 소집했습니다 (${
      payload.reason === "emergency" ? "긴급 기도 모임" : "시신 발견"
    })`;
    this.meetingSubPhase = "discuss";
    this.meetingEndsAt = Date.now() + this.settings.meetingDiscussMs;
    // 방 전체가 공유하는 긴급 소집 횟수를 payload 값으로 동기화한다 (버그 수정 참고).
    this.emergencyCallsUsed = payload.emergencyCallsUsed;
    this.votes.clear();
    this.chatLog = [];
    this.emit("phase-change", "meeting");
    setTimeout(() => {
      if (this.phase === "meeting" && this.meetingSubPhase === "discuss") {
        this.meetingSubPhase = "vote";
        this.meetingEndsAt = Date.now() + this.settings.meetingVoteMs;
        this.emit("meeting-subphase", "vote");
        setTimeout(() => {
          if (this.isHost && this.phase === "meeting") this.resolveMeeting();
        }, this.settings.meetingVoteMs + 500);
      }
    }, this.settings.meetingDiscussMs);
  }

  sendChat(text: string) {
    // 죽은 사람(유령)은 산 사람들의 회의 토론에 개입할 수 없다 — 관전만 가능.
    // (유령 전용 채팅은 sendGhostChat으로 별도 처리)
    if (!this.me?.alive) return;
    const msg = { id: `${this.userId}-${Date.now()}`, senderName: this.userName, text };
    this.applyChat(msg);
    this.channel.send({ type: "broadcast", event: "chat", payload: msg });
  }

  private applyChat(msg: ChatMsg) {
    this.chatLog.push(msg);
    this.emit("chat-update");
  }

  /** 유령 전용 채팅. 회의 중이 아니어도(플레이 중 언제든) 다른 유령들과 자유롭게 대화할 수 있다.
   * 브로드캐스트 자체는 방 전체에 전달되지만, 산 사람 클라이언트는 UI에서 이 로그를 절대
   * 렌더링하지 않는 방식으로 "유령만 보임"을 구현한다(신뢰 기반 클라이언트 모델 — 다른
   * 사보타지/능력 로직과 동일한 방식). */
  sendGhostChat(text: string) {
    if (this.me?.alive) return;
    const msg = { id: `${this.userId}-${Date.now()}`, senderName: this.userName, text };
    this.applyGhostChat(msg);
    this.channel.send({ type: "broadcast", event: "ghost_chat", payload: msg });
  }

  private applyGhostChat(msg: ChatMsg) {
    this.ghostChatLog.push(msg);
    this.emit("ghost-chat-update");
  }

  castVote(targetId: string) {
    // 죽은 사람은 추방 투표에 참여할 수 없다.
    if (!this.me?.alive) return;
    if (this.phase !== "meeting" || this.meetingSubPhase !== "vote") return;
    // 투표 시간이 끝나기 전에는 몇 번이든 다른 대상(또는 스킵)으로 바꿔 투표할 수 있다.
    const payload = { voterId: this.userId, targetId };
    this.applyVote(payload);
    this.channel.send({ type: "broadcast", event: "vote", payload });
  }

  /** 이미 넣은 투표를 취소해서 "아직 투표 안 한" 상태로 되돌린다. */
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
    this.maybeResolveMeetingEarly();
  }

  private applyVoteCancel(payload: { voterId: string }) {
    this.votes.delete(payload.voterId);
    this.emit("vote-update");
  }

  /** 생존자 전원이 투표(스킵 포함)를 마치면 투표 시간이 남아있어도 곧바로 결과를 낸다. */
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
      } else if (count === max) {
        tie = true;
      }
    });
    if (tie) ejectedId = null;
    const payload = { ejectedId };
    this.applyMeetingEnd(payload);
    this.channel.send({ type: "broadcast", event: "meeting_end", payload });
  }

  private applyMeetingEnd(payload: { ejectedId: string | null }) {
    if (payload.ejectedId) {
      const p = this.players.get(payload.ejectedId);
      if (p) p.alive = false;
    }
    this.phase = "playing";
    this.resetRoundAbilities();
    this.emit("meeting-result", payload.ejectedId);
    this.emit("phase-change", "playing");
    this.checkWin();
  }

  // ---------- sabotage: 메뉴 열기 공용 조건 (5종 모두 비활성 + 쿨다운 종료) ----------
  canOpenSabotageMenu(now: number) {
    return (
      this.isWolfSide &&
      now >= this.sabotageCooldownUntil &&
      this.phase === "playing" &&
      !this.blackoutActive &&
      !this.reactorActive &&
      !this.doorLockRoomId &&
      !this.candleActive &&
      !this.pipeActive
    );
  }

  // ---------- sabotage: blackout ----------
  canSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.blackoutActive;
  }

  triggerBlackout() {
    // 버그 수정: 예전엔 여기(발동 시점)에서 쿨타임을 바로 돌리기 시작해서, 사보타지가
    // 아직 안 풀렸는데도(양들이 정전을 못 끈 상태에서도) 쿨타임만 다 돌아버리는 경우가
    // 있었다. 쿨타임은 이제 사보타지가 "해결된 후"(endBlackout/applyBlackoutEnd)에만 돈다.
    const payload = { endsAt: Date.now() + this.settings.blackoutDurationMs };
    this.applyBlackoutStart(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_blackout", payload });
  }

  private applyBlackoutStart(payload: { endsAt: number }) {
    this.blackoutActive = true;
    this.blackoutEndsAt = payload.endsAt;
    this.blackoutProgress = 0;
    this.hasContributedToBlackout = false;
    this.emit("blackout-change");
    // [버그 수정] 예전엔 여기서 settings.blackoutDurationMs가 지나면 스페이스바를
    // 5번 다 채우지 못했어도 setTimeout이 조용히 정전을 꺼버렸다 — "기도실에 모여
    // 합심해서 5번 눌러야 정전이 풀린다"는 협동 목표 자체가 시간이 지나면 그냥
    // 무효화되는 것처럼 느껴지는 원인이었다. 이제 정전은 오직 (1) 합심 기도로
    // blackoutProgress가 BLACKOUT_PROGRESS_NEEDED에 도달하거나(progressBlackout →
    // applyBlackoutProgress) (2) 회의가 소집될 때(applyMeetingStart)만 꺼진다.
  }

  progressBlackout() {
    // [버그 수정] 예전엔 this.blackoutProgress += 1을 로컬에서만 올리고 다른 클라이언트에는
    // 전혀 알리지 않았다 — 원자로/방송/배수관 수리는 fixReactorPanel 등에서 매번
    // channel.send로 방송하는데, 여기만 빠져 있었다. 그 결과 두 가지 문제가 있었다:
    //   1) 같이 기도하러 온 다른 양들의 스페이스바가 서로 안 합쳐지고 각자 따로 5번을
    //      채워야 했다("합심 기도"인데 협동이 실제로는 안 되던 상태).
    //   2) 더 심각하게는, 정전을 해결한 사람의 화면에서만 blackoutActive가 꺼졌을 뿐
    //      다른 클라이언트(특히 사보타지를 건 늑대 본인)는 그 사실을 모른 채 자기 화면에서
    //      독립적으로 돌고 있는 시간초과 타이머가 그대로 발동해 "분명 제시간에 껐는데
    //      늑대 승리로 끝나버리는" 것처럼 보이는 경합(race condition)이 생길 수 있었다.
    // 이제 매 스페이스바 입력마다 다른 모든 클라이언트에게도 방송해서 진행도가
    // 실시간으로 같이 맞춰지도록 한다.
    if (!this.blackoutActive) return;
    this.hasContributedToBlackout = true;
    this.applyBlackoutProgress();
    this.channel.send({ type: "broadcast", event: "blackout_progress", payload: {} });
  }

  private applyBlackoutProgress() {
    if (!this.blackoutActive) return;
    this.blackoutProgress += 1;
    this.emit("blackout-change");
    if (this.blackoutProgress >= BLACKOUT_PROGRESS_NEEDED) this.endBlackout(true);
  }

  private endBlackout(broadcast: boolean) {
    this.blackoutActive = false;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("blackout-change");
    if (broadcast) this.channel.send({ type: "broadcast", event: "blackout_end", payload: {} });
  }

  private applyBlackoutEnd() {
    this.blackoutActive = false;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("blackout-change");
  }

  // ---------- sabotage: reactor (2인 협동 수리) ----------
  canReactorSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.reactorActive;
  }

  triggerReactorSabotage() {
    // 버그 수정: 쿨타임은 발동 시점이 아니라 사보타지가 해결된 후(applyReactorFix로 양쪽이
    // 다 고쳐지거나 applyReactorEnd)에만 돈다.
    const payload = { endsAt: Date.now() + this.settings.reactorSabotageDurationMs };
    this.applyReactorStart(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_reactor", payload });
  }

  private applyReactorStart(payload: { endsAt: number }) {
    this.reactorActive = true;
    this.reactorEndsAt = payload.endsAt;
    this.reactorLeftFixed = false;
    this.reactorRightFixed = false;
    this.emit("reactor-change");
    setTimeout(() => {
      if (this.reactorActive && this.reactorEndsAt === payload.endsAt) {
        // 시간 내에 양쪽 패널을 못 고치면 늑대 승리로 즉시 게임 종료
        this.applyGameEnd({ winner: "wolf" });
        if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload: { winner: "wolf" } });
      }
    }, Math.max(0, payload.endsAt - Date.now()));
  }

  fixReactorPanel(side: "left" | "right") {
    if (!this.reactorActive) return;
    const payload = { side };
    this.applyReactorFix(payload);
    this.channel.send({ type: "broadcast", event: "reactor_fix", payload });
  }

  private applyReactorFix(payload: { side: "left" | "right" }) {
    if (payload.side === "left") this.reactorLeftFixed = true;
    else this.reactorRightFixed = true;
    this.emit("reactor-change");
    if (this.reactorLeftFixed && this.reactorRightFixed) {
      this.reactorActive = false;
      this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
      this.emit("reactor-change");
      this.channel.send({ type: "broadcast", event: "reactor_end", payload: {} });
    }
  }

  private applyReactorEnd() {
    this.reactorActive = false;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("reactor-change");
  }

  // ---------- sabotage: door lock ----------
  canDoorSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.doorLockRoomId;
  }

  triggerDoorLock(roomId: string) {
    // 버그 수정: 쿨타임은 발동 시점이 아니라 잠금이 해제된 후(endDoorLock/applyDoorUnlock)에만 돈다.
    const payload = { roomId, endsAt: Date.now() + this.settings.doorLockDurationMs };
    this.applyDoorLock(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_door", payload });
  }

  private applyDoorLock(payload: { roomId: string; endsAt: number }) {
    this.doorLockRoomId = payload.roomId;
    this.doorLockEndsAt = payload.endsAt;
    this.emit("doorlock-change");
    setTimeout(() => {
      // 버그 수정: roomId만 비교하면, 이 타이머가 끝나기 전에 같은 방이 다시 잠긴 경우
      // (레이스 컨디션) "같은 방이니까" 하고 방금 새로 건 잠금을 조기 해제해버렸다.
      // 보일러실 사보타지(applyReactorStart)처럼 endsAt까지 같이 비교해서 "이 타이머가
      // 만든 그 잠금이 지금도 유효한지"를 확인한다.
      // 또한 모든 클라이언트가 각자 endDoorLock(true)로 브로드캐스트하면 불필요하게
      // 중복 전송되므로, host만 브로드캐스트하도록 통일한다(정전/보일러실과 동일 패턴 —
      // 다른 클라이언트도 이 setTimeout이 각자 로컬에서 돌고 있어 로컬 상태는 이미 갱신됨).
      if (this.doorLockRoomId === payload.roomId && this.doorLockEndsAt === payload.endsAt) {
        this.endDoorLock(this.isHost);
      }
    }, Math.max(0, payload.endsAt - Date.now()));
  }

  private endDoorLock(broadcast: boolean) {
    this.doorLockRoomId = null;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("doorlock-change");
    if (broadcast) this.channel.send({ type: "broadcast", event: "door_unlock", payload: {} });
  }

  private applyDoorUnlock() {
    this.doorLockRoomId = null;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("doorlock-change");
  }

  // ---------- sabotage: 촛불 화재 (2인 협동 진화 — 후보 4곳 중 매번 랜덤 2곳에 불이 붙는다) ----------
  // "방송 장비 오류"를 대체한 사보타지: 배수관 파열과 구조가 겹치던(지도 양 끝 2패널,
  // 스페이스바 한 번) 예전 방송 장비 오류 대신, ①불이 붙는 위치가 매번 랜덤이고(CANDLE_SPOT_IDS
  // 4곳 중 2곳 추첨) ②패널 하나를 끄는 데도 연타(CANDLE_PRESSES_NEEDED번)가 필요해 훨씬
  // 긴박하고 참신하게 느껴지도록 설계했다.
  canCandleSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.candleActive;
  }

  triggerCandleSabotage() {
    // 버그 수정: 쿨타임은 발동 시점이 아니라 촛불 두 곳이 모두 꺼진 후(applyCandleEnd)에만 돈다.
    // 4곳 중 서로 다른 2곳을 뽑는다 — 뽑는 주체(사보타지를 건 늑대)가 결정해서 payload로
    // 실어 보내야 모든 클라이언트가 "이번엔 어디에 불이 붙었는지" 똑같이 알 수 있다.
    const shuffled = [...CANDLE_SPOT_IDS].sort(() => Math.random() - 0.5);
    const spotIds: [CandleSpotId, CandleSpotId] = [shuffled[0], shuffled[1]];
    const payload = { endsAt: Date.now() + this.settings.candleSabotageDurationMs, spotIds };
    this.applyCandleStart(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_candle", payload });
  }

  private applyCandleStart(payload: { endsAt: number; spotIds: [CandleSpotId, CandleSpotId] }) {
    this.candleActive = true;
    this.candleEndsAt = payload.endsAt;
    this.candleSpotIds = payload.spotIds;
    this.candleAProgress = 0;
    this.candleBProgress = 0;
    this.candleAFixed = false;
    this.candleBFixed = false;
    this.emit("candle-change");
    setTimeout(() => {
      if (this.candleActive && this.candleEndsAt === payload.endsAt) {
        // 시간 내에 두 촛불을 다 못 끄면 늑대 승리로 즉시 게임 종료 (보일러실/배수관과 동일 패턴)
        this.applyGameEnd({ winner: "wolf" });
        if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload: { winner: "wolf" } });
      }
    }, Math.max(0, payload.endsAt - Date.now()));
  }

  /** 촛불 하나에 스페이스바를 한 번 누를 때마다 호출 — 다른 사보타지처럼 1번에 끝나지 않고
   *  CANDLE_PRESSES_NEEDED번 채워야 그 촛불이 꺼진다. */
  extinguishCandle(role: "a" | "b") {
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
      this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
      this.emit("candle-change");
      this.channel.send({ type: "broadcast", event: "candle_end", payload: {} });
    }
  }

  private applyCandleEnd() {
    this.candleActive = false;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("candle-change");
  }

  // ---------- sabotage: 배수관 파열 (2인 협동 수리 — 주방 2 ↔ 도서실, 서로 멀리 떨어진 두 지점) ----------
  canPipeSabotage(now: number) {
    return this.isWolfSide && now >= this.sabotageCooldownUntil && this.phase === "playing" && !this.pipeActive;
  }

  triggerPipeSabotage() {
    // 버그 수정: 쿨타임은 발동 시점이 아니라 배수관이 다 고쳐진 후(applyPipeFix/applyPipeEnd)에만 돈다.
    const payload = { endsAt: Date.now() + this.settings.pipeSabotageDurationMs };
    this.applyPipeStart(payload);
    this.channel.send({ type: "broadcast", event: "sabotage_pipe", payload });
  }

  private applyPipeStart(payload: { endsAt: number }) {
    this.pipeActive = true;
    this.pipeEndsAt = payload.endsAt;
    this.pipeAFixed = false;
    this.pipeBFixed = false;
    this.emit("pipe-change");
    setTimeout(() => {
      if (this.pipeActive && this.pipeEndsAt === payload.endsAt) {
        this.applyGameEnd({ winner: "wolf" });
        if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload: { winner: "wolf" } });
      }
    }, Math.max(0, payload.endsAt - Date.now()));
  }

  fixPipePanel(panel: "a" | "b") {
    if (!this.pipeActive) return;
    const payload = { panel };
    this.applyPipeFix(payload);
    this.channel.send({ type: "broadcast", event: "pipe_fix", payload });
  }

  private applyPipeFix(payload: { panel: "a" | "b" }) {
    if (payload.panel === "a") this.pipeAFixed = true;
    else this.pipeBFixed = true;
    this.emit("pipe-change");
    if (this.pipeAFixed && this.pipeBFixed) {
      this.pipeActive = false;
      this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
      this.emit("pipe-change");
      this.channel.send({ type: "broadcast", event: "pipe_end", payload: {} });
    }
  }

  private applyPipeEnd() {
    this.pipeActive = false;
    this.sabotageCooldownUntil = Date.now() + this.settings.sabotageCooldownMs;
    this.emit("pipe-change");
  }

  // ---------- win condition ----------
  private checkWin() {
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
      this.applyGameEnd(payload);
      if (this.isHost) this.channel.send({ type: "broadcast", event: "game_end", payload });
    }
  }

  private applyGameEnd(payload: { winner: "sheep" | "wolf" }) {
    if (this.phase === "ended") return;
    this.winner = payload.winner;
    this.phase = "ended";
    const myFaction = isWolfFaction(this.myRole) ? "wolf" : "sheep";
    recordGameCompletion(myFaction === payload.winner);
    this.emit("phase-change", "ended");
  }
}