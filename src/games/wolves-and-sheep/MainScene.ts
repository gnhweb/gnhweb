import Phaser from "phaser";
import { GameManager } from "./GameManger";
import { createBeanSprite, createGhostSprite, createBodyMarker, applyWalkAnim, spawnKillPoof, setBeanVisualActive, spawnFootstepDust, BODY_H } from "./BeanCharacter";
import { estimateInitialTier, RuntimeFpsSampler } from "./perfTier";
import { playFootstep, playElevatorRide } from "./soundManager";
import {
  PRAYER_ROOM,
  BELL_SPOT,
  KILL_RADIUS,
  MEETING_CALL_RADIUS,
  TASK_RADIUS,
  WORLD_W,
  WORLD_H,
  WALL_THICKNESS,
  ROOMS,
  FILLER_WALLS,
  HALLWAYS,
  FLOOR_LANDINGS,
  VENTS,
  VENT_INTERACT_RADIUS,
  VENT_COOLDOWN_MS,
  HIDE_SPOTS,
  HIDE_INTERACT_RADIUS,
  REACTOR_PANELS,
  REACTOR_PANEL_RADIUS,
  CANDLE_SPOTS,
  CANDLE_SPOT_IDS,
  CANDLE_SPOT_RADIUS,
  CANDLE_PRESSES_NEEDED,
  CandleSpotId,
  PIPE_PANELS,
  PIPE_PANEL_RADIUS,
  ELEVATORS,
  ELEVATOR_INTERACT_RADIUS,
  ELEVATOR_COOLDOWN_MS,
  EMERGENCY_PASSAGE_GATES,
  EMERGENCY_PASSAGE_INTERACT_RADIUS,
  EMERGENCY_PASSAGE_COOLDOWN_MS,
  RoomDef,
  VentSpot,
  isWolfFaction,
} from "./types";
import { bakeStaticMap, drawWallBevelToGraphics } from "./RoomDecor";
import { ensureTaskIconTexture, ensurePrayerIconTexture, ensureBellIconTexture, ensureHideIconTexture } from "./MapIcons";
import { buildOuterWalls } from "./WallGen";

/** 인게임 이름표/프롬프트에 쓰는 폰트 — 웹 전체(index.css의 --font-body)와 통일한다.
 *  Phaser 캔버스 텍스트는 CSS를 상속하지 않아 기본값을 주지 않으면 브라우저 기본 폰트로
 *  떨어지므로 명시적으로 지정한다. 로드 전에는 브라우저가 자동으로 대체 폰트를 쓴다. */
const NAMEPLATE_FONT = "'Noto Sans KR', sans-serif";

/**
 * ──────────────────────────────────────────────────────────────────
 * 2단계 최적화 요약
 * ──────────────────────────────────────────────────────────────────
 * [A] 정적 맵 베이킹
 *     buildMap() → bakeStaticMap() 한 번 호출.
 *     방 바닥·복도·소품·bevel·문·라벨이 RenderTexture 1장 → Image 1개.
 *     게임 중 라이브 마스크 오브젝트 = 0개.
 *     addWall(): 충돌 Rectangle만 남기고 bevel Graphics 제거
 *               (bevel은 bakeStaticMap의 wallBevels 배열로 전달됨).
 *
 * [B] 안개(Fog of War) 교체
 *     BitmapMask + invertAlpha(스텐실 버퍼 매 프레임) →
 *     RenderTexture.erase() 방식으로 교체.
 *     - fogRT: 매 프레임 어두운 색으로 clear() 후 erase(lightImg)
 *     - 스텐실 버퍼 전환 0회
 *     - resize 시 framebuffer 크래시 없음
 *
 * [C] 정적 텍스트 제거
 *     방 라벨, 층 안내판, vent/hide 라벨 → bakeStaticMap 포함 또는
 *     베이크 직후 destroy. 라이브 Text 오브젝트 대폭 감소.
 * ──────────────────────────────────────────────────────────────────
 *
 * 3단계 최적화 요약 (perfTier.ts 참고)
 * ──────────────────────────────────────────────────────────────────
 * [A] 화면 밖 캐릭터 컬링
 *     otherTargets.forEach에서 카메라 뷰포트(±margin) 밖 캐릭터는:
 *       - 컨테이너/라벨 setVisible(false) (뷰포트 진입/이탈 "순간"에만 토글)
 *       - 눈 깜빡임·펫 둥실 트윈 pause (setBeanVisualActive)
 *       - 위치 보간 갱신 빈도를 3프레임(저사양 5프레임)에 1번으로 낮춤
 *       - 걷기 애니메이션(텍스처 스왑)은 완전히 생략
 *
 * [B] 저사양 기기 분기 (lowSpecMode)
 *     1차: create() 시작 시 estimateInitialTier()로 기기 스펙 기반 즉시 판정
 *          (+ WebGL 미지원 Canvas 폴백 감지 시 강제 저사양)
 *     2차: update()에서 5초간 실측 FPS가 낮으면 강등(승급은 없음, 단방향)
 *     저사양일 때: 안개 갱신 격프레임, 킬 파티클 절반, 카메라 shake 생략,
 *                 정지 캐릭터 숨쉬기 애니메이션 생략, 화면 밖 갱신 더 드물게
 *     테스트용 쿼리: ?lowspec=1 / ?highspec=1 로 강제 지정 가능
 *
 * [C] 렌더러 폴백 감지
 *     this.game.renderer.type === Phaser.CANVAS 이면(WebGL 미지원 기기)
 *     기기 스펙 추정과 무관하게 저사양 모드를 강제 적용.
 * ──────────────────────────────────────────────────────────────────
 */

export class MainScene extends Phaser.Scene {
  private gm!: GameManager;
  private myPlayer!: Phaser.GameObjects.Rectangle;
  private myBean!: Phaser.GameObjects.Container;
  private myFacing: 1 | -1 = 1;
  private myLabel!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private otherRects: Map<string, Phaser.GameObjects.Container> = new Map();
  private otherLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private otherTargets: Map<string, { x: number; y: number }> = new Map();
  private otherFacing: Map<string, 1 | -1> = new Map();
  // [3단계] 각 캐릭터가 지난 프레임에 카메라 뷰포트 안에 있었는지 — 진입/이탈 "순간"에만
  // setVisible/트윈 pause를 호출하기 위한 상태 캐시 (매 프레임 호출하면 의미가 없다).
  private otherInView: Map<string, boolean> = new Map();
  private bodyMarkers: Map<string, Phaser.GameObjects.Container> = new Map();
  // 6-4: 이번 라운드에 이미 "발견 연출"을 재생한 시신 id들 — 같은 시신을 다시 지나칠 때마다
  // 비네트가 반복 재생되지 않도록 최초 발견 순간에만 1회 트리거한다.
  private seenBodyIds: Set<string> = new Set();
  private taskMarkers: Map<string, Phaser.GameObjects.Image> = new Map();
  private promptText!: Phaser.GameObjects.Text;
  private lastMoveSent = 0;
  private lastDustAt = 0;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private kKey!: Phaser.Input.Keyboard.Key;
  private bKey!: Phaser.Input.Keyboard.Key;
  private rKey!: Phaser.Input.Keyboard.Key;
  private vKey!: Phaser.Input.Keyboard.Key;
  private hKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private fKey!: Phaser.Input.Keyboard.Key;
  private mKey!: Phaser.Input.Keyboard.Key;
  private taskModalOpen = false;
  private sabotageMenuOpen = false;
  private ventMenuOpen = false;

  // ---- 맵/충돌 ----
  private wallRects: Phaser.GameObjects.Rectangle[] = [];
  // bevel 정보 — addWall이 수집하고 bakeStaticMap에 전달 후 버림
  private _pendingBevels: Array<{ x: number; y: number; w: number; h: number }> = [];

  // ---- 보일러실 사보타지 패널 ----
  private reactorPanelGfx: { left?: Phaser.GameObjects.Arc; right?: Phaser.GameObjects.Arc } = {};
  // 촛불 화재는 후보 4곳 전부에 항상 그래픽을 깔아두고(평소엔 꺼진 색), 그중 그날 뽑힌
  // 2곳만 사보타지 중 불이 붙은 색으로 바뀐다 — 그래서 a/b 두 개가 아니라 id별 맵으로 관리.
  private candlePanelGfx: Partial<Record<CandleSpotId, Phaser.GameObjects.Arc>> = {};
  private pipePanelGfx: { a?: Phaser.GameObjects.Arc; b?: Phaser.GameObjects.Arc } = {};

  // ---- 도어락 사보타지 ----
  private doorLockWalls: Phaser.GameObjects.Rectangle[] = [];
  private doorLockOverlay: Phaser.GameObjects.Rectangle | null = null;
  private doorLockLabel: Phaser.GameObjects.Text | null = null;

  // ---- 환풍구 / 은신 ----
  private ventCooldownUntil = 0;
  private hidden = false;
  // 벤트 탑승 연출 재생 중인지 — true인 동안 이동 입력/걷기 애니메이션/재진입을 막는다.
  private ventTraveling = false;
  // 갈림길 벤트에서 React 선택 메뉴를 여는 순간의 "출발 벤트" id — vent-select가
  // 돌아왔을 때 어디서 출발했는지 알아야 연출(fromVent 좌표)을 재생할 수 있다.
  private pendingVentSourceId: string | null = null;

  // ---- 엘리베이터 (양/늑대 공용, 벤트와 별개 쿨다운) ----
  private elevatorCooldownUntil = 0;

  // ---- 비상통로(4단계, 정전 사보타지 중에만 열림) ----
  private emergencyPassageCooldownUntil = 0;
  private emergencyGateGfx: Map<string, { box: Phaser.GameObjects.Rectangle; glow: Phaser.GameObjects.Rectangle }> = new Map();
  private elevatorGfx: Map<string, { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = new Map();

  // ---- 시야 제한 (안개) — 2단계: RenderTexture erase 방식 ----
  private visionDiameter = 782;
  // 정전(어둠의 시험) 사보타지 중에는 밝혀지는 원을 이 배율만큼 줄여서 시야를 좁힌다.
  private readonly BLACKOUT_VISION_SCALE = 0.4;
  private fogRT: Phaser.GameObjects.RenderTexture | null = null;
  private fogEraser: Phaser.GameObjects.Image | null = null;
  // 회전/전체화면 전환 중 연속으로 들어오는 resize 이벤트 중 마지막 것만 반영하기 위한 토큰
  private fogRebuildToken = 0;

  // ---- 씬 종료 플래그 ----
  private isShuttingDown = false;
  // ---- 진단용: update() 중 예외가 이미 1회 보고되었는지 ----
  private updateErrored = false;

  // ---- 모바일 터치 조작 ----
  private mobileVector = { x: 0, y: 0 };
  private pendingMobileActions: Set<string> = new Set();
  private lastEmittedPrompt = "";
  private lastEmittedActionType = "";

  // ---- 3단계: 저사양 기기 분기 ----
  private lowSpecMode = false;
  private fpsSampler = new RuntimeFpsSampler();
  private frameCounter = 0;

  constructor() {
    super("MainScene");
  }

  /** 터치스크린 기기 여부. PhaserGame.tsx가 판별해서 넘겨준다.
   * "스페이스바로/K키로/..." 같은 키보드 전용 안내 문구는 이 기기에서는 의미가 없고
   * (모바일은 MobileControls의 터치 버튼을 쓴다) 화면 상단에 계속 겹쳐 떠 있기만
   * 했으므로, 이 값이 true면 promptText(캔버스 텍스트)는 항상 비워 둔다. */
  private isTouch = false;

  init(data: { gm: GameManager; isTouch?: boolean }) {
    this.gm = data.gm;
    this.isTouch = !!data.isTouch;
  }

  /**
   * 버그 진단용(모바일 검은 화면): create() 내부 어딘가에서 예외가 터지면 그 지점부터
   * 아래 로직(맵/캐릭터/카메라 생성 등)이 전부 실행되지 않아 캔버스가 배경색만 깔린 채로
   * 멈춘다 — 화면이 새까맣게 보이는데도 콘솔을 볼 수 없는 사용자에게는 원인 불명의
   * "그냥 검은 화면"으로만 보인다. 실제 로직은 createInner()에 그대로 두고, 여기서는
   * try/catch로 감싸서 성공/실패를 game.events로 밖(PhaserGame.tsx)에 알려 화면에
   * 에러 메시지를 직접 띄울 수 있게 한다.
   */
  create() {
    try {
      this.createInner();
      this.game.events.emit("scene-create-done");
    } catch (err) {
      console.error("[MainScene] create() 중 오류 발생", err);
      this.game.events.emit("scene-create-error", err instanceof Error ? err.message : String(err));
    }
  }

  private createInner() {
    // ── [3단계] 저사양 기기 1차 판정 (기기 스펙 기반, FPS 측정 없이 즉시 가능) ──
    const initialTier = estimateInitialTier();
    this.lowSpecMode = initialTier.tier === "low";
    // WebGL을 지원하지 않는 기기는 Phaser.AUTO가 Canvas 렌더러로 자동 폴백하는데,
    // Canvas는 배칭이 거의 없어 이 게임 구조에서는 훨씬 느리다. 이 경우 기기 스펙
    // 추정과 무관하게 저사양 모드를 강제한다.
    if (this.game.renderer.type === Phaser.CANVAS) {
      this.lowSpecMode = true;
      console.warn("[perf] WebGL 미지원(Canvas 렌더러 폴백) 감지 → 저사양 모드 강제 적용");
    }
    console.info(
      `[perf] 초기 성능 티어: ${this.lowSpecMode ? "low" : "high"} (${initialTier.reason}, renderer=${
        this.game.renderer.type === Phaser.CANVAS ? "canvas" : "webgl"
      })`
    );

    this.visionDiameter = this.gm.settings.visionDiameter || this.visionDiameter;

    // ⓪ 맵 바깥(월드 경계 밖) 여백 마감 — 카메라가 경계 근처(리사이즈로 인한 레터박싱 등)에서
    // 보게 될 수 있는 영역이 무지 검은 화면이 아니라 옅은 별 패턴으로 채워지도록 미리 깔아둔다.
    // 정적 맵(bakeStaticMap)이 그 위를 완전히 덮으므로 평소 플레이 중에는 안 보이고,
    // 경계 근처에서만 살짝 드러난다.
    this.buildOuterVoidBackground();

    // ① 충돌 벽 먼저 생성 (bevel 좌표 수집)
    this._pendingBevels = [];
    this.buildWallsOnly();

    // ② 정적 맵 전체를 굽기 (방 바닥 + 복도 + 소품 + bevel + 문 + 방 라벨 + 층 안내판 포함)
    //    맵 크기가 기기 GPU의 최대 텍스처 크기를 넘으면 내부적으로 여러 타일로 나눠 굽는다
    //    (RoomDecor.bakeStaticMap 참고 — "Framebuffer status: Incomplete Attachment" 버그 수정).
    bakeStaticMap(this, {
      rooms: ROOMS,
      hallways: HALLWAYS,
      wallBevels: this._pendingBevels,
      worldW: WORLD_W,
      worldH: WORLD_H,
      includeLabels: true,
      includeDoors: true,
      extraDraw: (draw) => {
        // 층 안내판 — bake 콜백 안에서 처리
        FLOOR_LANDINGS.forEach((f) => {
          const txt = this.make.text(
            { x: f.x, y: f.y, text: f.label,
              style: { fontSize: "13px", color: "#8fa2ff", fontStyle: "bold" } },
            false
          );
          txt.setOrigin(0.5, 0);
          draw(txt);
          txt.destroy();
        });

        // 기도실, 종치기 구역 표시 — 은은한 반경 표시(원) 위에 촛불/종 아이콘을 얹는다.
        // 아이콘도 정적 맵과 함께 한 번만 구워지므로(baked) 런타임 비용은 그대로 0.
        //
        // 합심 기도 지점(PRAYER_ROOM)은 이제 로비(기도실) 정중앙의 랜드마크라, 구석 방재실에
        // 있던 시절의 "칠해진 원 하나"로는 존재감이 없다 — 촛불 6개를 원형으로 둘러 세우고
        // (실제 기도 모임처럼), 그 위에 이중 글로우 링 + 점선 테두리를 얹어 "여기 모이세요"가
        // 한눈에 들어오는 랜드마크로 꾸몄다. 전부 bake 단계에서 한 번만 그려지므로 프레임 비용은
        // 여전히 0이다.
        const g2 = this.make.graphics({ x: 0, y: 0 }, false);
        const pr = PRAYER_ROOM;
        // 가장 바깥 — 아주 옅은 온기 도는 글로우(러그 경계까지 부드럽게 번지도록)
        g2.fillStyle(0xffb238, 0.06);
        g2.fillCircle(pr.x, pr.y, pr.radius + 34);
        g2.fillStyle(0xffb238, 0.1);
        g2.fillCircle(pr.x, pr.y, pr.radius + 16);
        // 중심 원 — 기존보다 살짝 더 따뜻한 톤
        g2.fillStyle(0x4444aa, 0.16);
        g2.fillCircle(pr.x, pr.y, pr.radius);
        g2.fillStyle(0xffb238, 0.1);
        g2.fillCircle(pr.x, pr.y, pr.radius * 0.55);
        // 금색 테두리 링 — 살짝 두껍게, 은은히
        g2.lineStyle(2.4, 0xffd700, 0.55);
        g2.strokeCircle(pr.x, pr.y, pr.radius);
        // 바깥쪽 점선 링 — 짧은 호를 여러 개 이어 "점선" 느낌을 냄
        g2.lineStyle(1.6, 0xffe6a8, 0.4);
        const dashCount = 20;
        for (let i = 0; i < dashCount; i++) {
          const a0 = (i / dashCount) * Math.PI * 2;
          const a1 = a0 + (Math.PI * 2) / dashCount / 2;
          g2.beginPath();
          g2.arc(pr.x, pr.y, pr.radius + 12, a0, a1, false);
          g2.strokePath();
        }
        // 종치기 구역
        g2.fillStyle(0xaa4444, 0.14);
        g2.fillCircle(BELL_SPOT.x, BELL_SPOT.y, BELL_SPOT.radius);
        draw(g2);
        g2.destroy();

        // 촛불 6개를 원형으로 배치 — 실제 기도 모임처럼 둘러앉은 느낌을 준다.
        const prayerIconKey = ensurePrayerIconTexture(this);
        const candleCount = 6;
        for (let i = 0; i < candleCount; i++) {
          const angle = (i / candleCount) * Math.PI * 2 - Math.PI / 2;
          const ringR = pr.radius - 8;
          const cx = pr.x + Math.cos(angle) * ringR;
          const cy = pr.y + Math.sin(angle) * ringR;
          const candle = this.make.image({ x: cx, y: cy, key: prayerIconKey }, false);
          candle.setScale(0.72);
          draw(candle);
          candle.destroy();
        }
        // 중앙 촛불 — 조금 더 크게, 모임의 중심임을 강조
        const prayerIcon = this.make.image(
          { x: pr.x, y: pr.y, key: prayerIconKey },
          false
        );
        prayerIcon.setScale(1.3);
        draw(prayerIcon);
        prayerIcon.destroy();

        // 버그 수정(비상벨이 촛불 원 밖 위쪽에 떨어져 보임): BELL_SPOT은 이제 촛불 원(pr)과
        // 중심이 같아졌으므로(types.ts 참고), 종 아이콘/라벨을 정중앙 큰 촛불 바로 아래쪽에
        // 살짝 내려 그려서 겹치지 않으면서도 여전히 같은 원 안에 있는 것으로 보이게 한다.
        const bellIcon = this.make.image(
          { x: BELL_SPOT.x, y: BELL_SPOT.y + 30, key: ensureBellIconTexture(this) },
          false
        );
        draw(bellIcon);
        bellIcon.destroy();

        const bellTxt = this.make.text(
          { x: BELL_SPOT.x - 40, y: BELL_SPOT.y + 44, text: BELL_SPOT.label,
            style: { fontSize: "12px", color: "#daa" } },
          false
        );
        draw(bellTxt);
        bellTxt.destroy();
      },
    });
    this._pendingBevels = []; // GC 허용

    // ③ 동적 오브젝트 (태스크 마커, vent, hide spot, 사보타지 패널)
    // 전체 TASK_SPOTS가 아니라 내게 배정된 미션만 그린다 — 어몽어스처럼 사람마다
    // 돌아야 할 미션 지점이 다르다(GameManager.myTaskSpots, 랜덤 분배 결과).
    this.gm.myTaskSpots.forEach((t) => {
      // 미션 타입별 아이콘(클립보드/팔레트/믹서 등) — 예전엔 전부 금색 동그라미 하나였다.
      const icon = this.add.image(t.x, t.y, ensureTaskIconTexture(this, t.type));
      this.taskMarkers.set(t.id, icon);
      // 라벨은 베이킹에 포함하지 않고 라이브 유지 (태스크 완료 시 토글 가능)
      this.add.text(t.x - 20, t.y + 18, t.label, { fontSize: "10px", color: "#ffe" });
    });

    VENTS.forEach((v) => {
      this.add.circle(v.x, v.y, 16, 0x0d1420, 1).setStrokeStyle(2, 0x2dd4bf);
      for (let i = -1; i <= 1; i++) {
        this.add.rectangle(v.x + i * 6, v.y, 2, 20, 0x2dd4bf, 0.7);
      }
      this.add.text(v.x - 24, v.y + 20, v.label, { fontSize: "9px", color: "#5eead4" });
    });

    ELEVATORS.forEach((e) => {
      const box = this.add.rectangle(e.x, e.y, 46, 46, 0x1a1a2e, 1).setStrokeStyle(2, 0x555566);
      this.add.rectangle(e.x, e.y - 14, 34, 4, 0x777777, 0.85);
      this.add.rectangle(e.x, e.y + 14, 34, 4, 0x777777, 0.85);
      const label = this.add.text(e.x - 34, e.y + 28, e.label, { fontSize: "9px", color: "#888899" });
      this.elevatorGfx.set(e.id, { box, label });
    });

    // 비상통로 게이트 — 평소엔 잠긴 셔터 색(어두운 회색), 정전이 발동하면
    // updateEmergencyPassageVisuals()가 밝은 시안색 글로우로 바꿔 "지금 열렸다"를 알린다.
    EMERGENCY_PASSAGE_GATES.forEach((g) => {
      const box = this.add.rectangle(g.x, g.y, 42, 42, 0x14162a, 1).setStrokeStyle(3, 0x555566);
      const glow = this.add.rectangle(g.x, g.y, 54, 54, 0x22d3ee, 0.18).setStrokeStyle(2, 0x22d3ee, 0.7);
      glow.setVisible(false);
      this.tweens.add({
        targets: glow,
        alpha: { from: 1, to: 0.4 },
        scale: { from: 1, to: 1.1 },
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.add.text(g.x - 34, g.y + 28, g.label, { fontSize: "9px", color: "#67e8f9" });
      this.emergencyGateGfx.set(g.id, { box, glow });
    });

    HIDE_SPOTS.forEach((h) => {
      // 지점마다 (데스크/커튼/박스/선반/소파) 맞는 아이콘 — 예전엔 전부 보라 동그라미였다.
      this.add.image(h.x, h.y, ensureHideIconTexture(this, h.id));
      this.add.text(h.x - 26, h.y + 20, h.label, { fontSize: "9px", color: "#c084fc" });
    });

    this.reactorPanelGfx.left = this.add
      .circle(REACTOR_PANELS.left.x, REACTOR_PANELS.left.y, 18, 0x555555, 0.5)
      .setStrokeStyle(2, 0xff6666);
    this.reactorPanelGfx.right = this.add
      .circle(REACTOR_PANELS.right.x, REACTOR_PANELS.right.y, 18, 0x555555, 0.5)
      .setStrokeStyle(2, 0xff6666);
    this.add.text(REACTOR_PANELS.left.x - 26, REACTOR_PANELS.left.y + 22,
      REACTOR_PANELS.left.label, { fontSize: "9px", color: "#faa" });
    this.add.text(REACTOR_PANELS.right.x - 28, REACTOR_PANELS.right.y + 22,
      REACTOR_PANELS.right.label, { fontSize: "9px", color: "#faa" });

    // 촛불 화재 사보타지 지점 (지도 곳곳 4곳 — 매 사보타지마다 그중 랜덤 2곳만 실제로
    // 불이 붙는다. 항상 4곳 모두 그래픽을 깔아두고, 색으로 평소/발화/진화완료를 구분한다)
    CANDLE_SPOT_IDS.forEach((id) => {
      const spot = CANDLE_SPOTS[id];
      this.candlePanelGfx[id] = this.add
        .circle(spot.x, spot.y, 18, 0x555555, 0.5)
        .setStrokeStyle(2, 0xff7a1a);
      this.add.text(spot.x - 30, spot.y + 22,
        spot.label, { fontSize: "9px", color: "#ffb37a" });
    });

    // 배수관 파열 사보타지 패널 (주방 2 ↔ 도서실)
    this.pipePanelGfx.a = this.add
      .circle(PIPE_PANELS.a.x, PIPE_PANELS.a.y, 18, 0x555555, 0.5)
      .setStrokeStyle(2, 0x38bdf8);
    this.pipePanelGfx.b = this.add
      .circle(PIPE_PANELS.b.x, PIPE_PANELS.b.y, 18, 0x555555, 0.5)
      .setStrokeStyle(2, 0x38bdf8);
    this.add.text(PIPE_PANELS.a.x - 24, PIPE_PANELS.a.y + 22,
      PIPE_PANELS.a.label, { fontSize: "9px", color: "#7dd3fc" });
    this.add.text(PIPE_PANELS.b.x - 24, PIPE_PANELS.b.y + 22,
      PIPE_PANELS.b.label, { fontSize: "9px", color: "#7dd3fc" });

    // ④ 내 플레이어
    const me = this.gm.me;
    this.myPlayer = this.add.rectangle(me?.x ?? 700, me?.y ?? 600, 30, 30, 0x000000, 0);
    this.physics.add.existing(this.myPlayer);
    (this.myPlayer.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.physics.add.collider(this.myPlayer, this.wallRects);

    this.myBean = createBeanSprite(this, this.myPlayer.x, this.myPlayer.y, this.gm.userId, {
      hat: me?.hat, pet: me?.pet,
    });
    this.myBean.addAt(
      this.add.circle(0, 6, 23, 0xffd700, 0).setStrokeStyle(2, 0xffd700, 0.85), 0
    );
    this.myBean.setDepth(5);

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.centerOn(this.myPlayer.x, this.myPlayer.y);
    this.cameras.main.startFollow(this.myPlayer, true, 0.12, 0.12);

    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isShuttingDown = true;
      this.scale.off("resize", this.handleResize, this);
    });

    // ⑤ 안개 — RenderTexture erase 방식
    this.buildFogOfWar();

    this.myLabel = this.add.text(
      this.myPlayer.x - 16, this.myPlayer.y - 30,
      `${this.gm.userName} (나)`,
      { fontSize: "11px", color: "#fff", fontFamily: NAMEPLATE_FONT, stroke: "#000000", strokeThickness: 3 }
    );

    this.promptText = this.add
      .text(this.scale.width / 2, 14, "", {
        fontSize: "13px", color: "#ffd700", fontFamily: NAMEPLATE_FONT, stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(950)
      .setVisible(!this.isTouch);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.kKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.bKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.vKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    this.hKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.fKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    this.renderOtherPlayers();

    this.gm.on("player-moved", (id: string) => this.syncOtherTarget(id));
    this.gm.on("player-killed", (victimId: string) => {
      const body = this.gm.deadBodies[this.gm.deadBodies.length - 1];
      if (body) {
        spawnKillPoof(this, body.x, body.y, {
          particleCount: this.lowSpecMode ? 9 : 18,
          skipShake: this.lowSpecMode,
        });
      }
      if (victimId === this.gm.userId) {
        this.myBean.destroy();
        this.myBean = createGhostSprite(this, this.myPlayer.x, this.myPlayer.y, this.gm.userId);
      }
      this.renderOtherPlayers();
    });
    this.gm.on("player-revived", (payload: { targetId: string; x: number; y: number }) => {
      if (payload.targetId === this.gm.userId) {
        this.myBean.destroy();
        this.myPlayer.setPosition(payload.x, payload.y);
        this.myBean = createBeanSprite(this, payload.x, payload.y, this.gm.userId, {
          hat: this.gm.me?.hat, pet: this.gm.me?.pet,
        });
        this.myBean.addAt(
          this.add.circle(0, 6, 23, 0xffd700, 0).setStrokeStyle(2, 0xffd700, 0.85), 0
        );
        this.myBean.setDepth(5);
      } else {
        this.bodyMarkers.get(payload.targetId)?.destroy();
        this.bodyMarkers.delete(payload.targetId);
      }
      this.renderOtherPlayers();
    });
    this.gm.on("hide-change", (id: string) => this.syncHiddenVisual(id));
    this.gm.on("reactor-change", () => this.updateReactorPanelVisuals());
    this.gm.on("doorlock-change", () => this.updateDoorLock());
    this.gm.on("blackout-change", () => this.updateEmergencyPassageVisuals());
    this.gm.on("candle-change", () => this.updateCandlePanelVisuals());
    this.gm.on("pipe-change", () => this.updatePipePanelVisuals());
    this.gm.on("reactor-change", () => this.updateElevatorVisuals());
    this.gm.on("doorlock-change", () => this.updateElevatorVisuals());
    this.gm.on("blackout-change", () => this.updateElevatorVisuals());
    this.gm.on("candle-change", () => this.updateElevatorVisuals());
    this.gm.on("pipe-change", () => this.updateElevatorVisuals());
    this.updateEmergencyPassageVisuals(); // 중간 입장 시에도 현재 정전 상태를 바로 반영
    this.updateElevatorVisuals(); // 중간 입장 시에도 현재 사보타지 상태를 바로 반영
    this.gm.on("phase-change", (phase: string) => {
      if (phase === "playing") this.renderOtherPlayers();
    });

    this.game.events.on("close-task-modal", () => { this.taskModalOpen = false; });
    this.game.events.on("open-task-modal-ack", () => { this.taskModalOpen = true; });
    this.game.events.on("close-sabotage-menu", () => { this.sabotageMenuOpen = false; });
    // 벤트가 3방향 이상으로 갈라지는 경우, React 쪽에서 목적지 선택 메뉴를 띄우고
    // 고른 결과를 "vent-select"로 돌려준다. 취소하면 "close-vent-menu"만 온다.
    this.game.events.on("close-vent-menu", () => {
      this.ventMenuOpen = false;
      this.pendingVentSourceId = null;
    });
    this.game.events.on("vent-select", (targetId: string) => {
      if (!this.ventMenuOpen) return;
      this.ventMenuOpen = false;
      const source = VENTS.find((v) => v.id === this.pendingVentSourceId);
      const target = VENTS.find((v) => v.id === targetId);
      this.pendingVentSourceId = null;
      if (source && target) this.travelThroughVent(source, target);
    });
    this.game.events.on("mobile-move", (v: { x: number; y: number }) => { this.mobileVector = v; });
    this.game.events.on("mobile-action", (type: string) => { this.pendingMobileActions.add(type); });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off("mobile-move");
      this.game.events.off("mobile-action");
    });
  }

  private consumeAction(key: Phaser.Input.Keyboard.Key, mobileType: string): boolean {
    const keyDown = Phaser.Input.Keyboard.JustDown(key);
    const mobileDown = this.pendingMobileActions.has(mobileType);
    if (mobileDown) this.pendingMobileActions.delete(mobileType);
    return keyDown || mobileDown;
  }

  // ─── 벽만 생성 (시각 bevel 제외 — bakeStaticMap에서 처리) ───────────
  private buildWallsOnly() {
    // 방 벽
    ROOMS.forEach((room) => this.buildRoomWalls(room));

    // 필러 벽
    FILLER_WALLS.forEach((f) => this.addWall(f.x, f.y, f.w, f.h));

    // 외곽 자동 벽
    buildOuterWalls(ROOMS, HALLWAYS, WORLD_W, WORLD_H).forEach((w) =>
      this.addWall(w.x, w.y, w.w, w.h)
    );
  }

  private buildRoomWalls(room: RoomDef) {
    const t = WALL_THICKNESS;
    const doorOn = (side: string) => room.doors.find((d) => d.side === side);

    (["top", "bottom"] as const).forEach((side) => {
      const y = side === "top" ? room.y : room.y + room.h;
      const door = doorOn(side);
      if (!door) {
        this.addWall(room.x, y - t / 2, room.w, t);
      } else {
        this.addWall(room.x, y - t / 2, door.at - room.x, t);
        const rightStart = door.at + door.size;
        this.addWall(rightStart, y - t / 2, room.x + room.w - rightStart, t);
      }
    });

    (["left", "right"] as const).forEach((side) => {
      const x = side === "left" ? room.x : room.x + room.w;
      const door = doorOn(side);
      if (!door) {
        this.addWall(x - t / 2, room.y, t, room.h);
      } else {
        this.addWall(x - t / 2, room.y, t, door.at - room.y);
        const bottomStart = door.at + door.size;
        this.addWall(x - t / 2, bottomStart, t, room.y + room.h - bottomStart);
      }
    });
  }

  /**
   * addWall — 2단계 변경: 충돌 Rectangle만 만들고 bevel Graphics는 만들지 않는다.
   * bevel 좌표는 _pendingBevels에 쌓아뒀다가 bakeStaticMap()에 넘긴다.
   */
  private addWall(x: number, y: number, w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x14162a).setStrokeStyle(1, 0x3f4266);
    this.physics.add.existing(r, true);
    this.wallRects.push(r);
    // bevel은 베이킹 시점에 처리
    this._pendingBevels.push({ x, y, w, h });
  }

  // ─── 안개: RenderTexture erase 방식 ──────────────────────────────────
  /**
   * fogRT: 화면 크기(scrollFactor 0)의 어두운 RenderTexture.
   * 매 프레임 updateFogOfWar()에서:
   *   1. fogRT.clear()
   *   2. 전체를 어두운 색으로 채움
   *   3. 플레이어 위치에 fogEraser(빛 이미지)를 erase() → 그 영역만 투명해짐
   *
   * BitmapMask 방식과 달리 스텐실 버퍼 전환이 전혀 없고,
   * resize 시에도 framebuffer 크래시가 발생하지 않는다.
   */
  /**
   * 진단 결과(모바일 검은 화면의 실제 원인): 안개(fogRT)를 화면 회전/전체화면 전환 중에
   * `.resize()`로 프레임버퍼 크기만 바꾸는 방식이 일부 Android 브라우저(삼성 인터넷 등)의
   * WebGL 구현에서 "Framebuffer status: Incomplete Attachment" 오류로 이어지는 것을
   * 실기기에서 확인했다. 프레임버퍼 리사이즈 자체가 그 브라우저들에서 불안정하다고 보고
   * .resize() 호출을 없애고 — 크기가 바뀔 때는 기존 RenderTexture를 완전히 파괴한 뒤
   * 새 크기로 처음부터 다시 만드는 방식으로 바꿨다. 화면 회전/전체화면 전환은 게임 중
   * 자주 일어나는 일이 아니라(보통 한 판에 1~2번) 매번 새로 만들어도 성능에 문제없다.
   */
  private buildOuterVoidBackground() {
    const key = "outer-void-tile";
    if (!this.textures.exists(key)) {
      const size = 128;
      const canvasTex = this.textures.createCanvas(key, size, size);
      const ctx = canvasTex!.getContext();
      ctx.fillStyle = "#0b0e1a";
      ctx.fillRect(0, 0, size, size);
      // 시드를 고정해서 매 세션 같은 느낌의 별자리가 나오게 한다(완전 랜덤이면 타일 이음매가
      // 도드라져 보일 수 있어, 낮은 밀도의 작은 점 몇 개로 절제해서 배치).
      let seed = 1337;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      for (let i = 0; i < 14; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = rand() * 1.1 + 0.3;
        ctx.globalAlpha = 0.25 + rand() * 0.35;
        ctx.fillStyle = "#c9d6ff";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      canvasTex!.refresh();
    }
    // 월드보다 넉넉히 크게 깔아서(리사이즈/레터박싱으로 카메라가 경계 밖을 보더라도)
    // 어느 방향에서든 별 패턴이 이어지도록 한다. depth를 가장 낮게 둬서 baked map이 덮는다.
    const pad = 800;
    this.add
      .tileSprite(
        -pad, -pad,
        WORLD_W + pad * 2, WORLD_H + pad * 2,
        key
      )
      .setOrigin(0, 0)
      .setDepth(-100);
  }

  private buildFogOfWar() {
    const sw = this.scale.width;
    const sh = this.scale.height;
    if (sw <= 0 || sh <= 0) return;

    // 이미 만들어져 있던 안개가 있으면(리사이즈로 인한 재생성) 먼저 완전히 파괴한다 —
    // 기존 프레임버퍼를 재사용/리사이즈하지 않고 항상 깨끗한 상태에서 새로 만든다.
    this.destroyFog();

    // 빛 그라디언트 텍스처 (한 번만 만들고 재사용)
    const size = this.visionDiameter;
    if (!this.textures.exists("lightMask")) {
      const canvasTex = this.textures.createCanvas("lightMask", size, size);
      const ctx = canvasTex!.getContext();
      // 예전엔 0.72~1.0 구간(반경의 마지막 28%)에서만 옅어져 시야 경계가 눈에 띄게 딱딱했다.
      // 페이드 시작점을 앞당기고 중간 정지점을 더 둬서(0.45→0.72→0.88→1.0) 경계가
      // 훨씬 부드러운 그라데이션으로 사라지도록 넓혔다.
      const grad = ctx.createRadialGradient(
        size / 2, size / 2, size * 0.12,
        size / 2, size / 2, size / 2
      );
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.72, "rgba(255,255,255,0.65)");
      grad.addColorStop(0.88, "rgba(255,255,255,0.25)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      canvasTex!.refresh();
    }

    // fogRT: 화면 크기 RenderTexture (scrollFactor 0)
    this.fogRT = this.add
      .renderTexture(0, 0, sw, sh)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);

    // erase용 Image — 실제 화면에는 보이지 않고 fogRT.erase()의 브러시로만 쓰임
    this.fogEraser = this.make.image({ x: 0, y: 0, key: "lightMask" }, false);
    this.fogEraser.setOrigin(0.5, 0.5);
  }

  private destroyFog() {
    this.fogRT?.destroy();
    this.fogRT = null;
    this.fogEraser?.destroy();
    this.fogEraser = null;
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    if (this.isShuttingDown) return;
    const width = gameSize.width;
    const height = gameSize.height;
    if (width <= 0 || height <= 0) return;
    this.cameras.main.setSize(width, height);
    this.promptText?.setPosition(width / 2, 14);

    // 같은 프레임 안에서 연달아 여러 번 resize 이벤트가 올 수 있으므로(회전 애니메이션 중
    // 브라우저가 중간값을 여러 번 보고하는 경우), 매번 즉시 재생성하지 않고 한 틱 미룬 뒤
    // 가장 마지막 크기로 딱 한 번만 안개를 재생성한다.
    this.fogRebuildToken = (this.fogRebuildToken ?? 0) + 1;
    const myToken = this.fogRebuildToken;
    this.time.delayedCall(50, () => {
      if (this.isShuttingDown || !this.sys.isActive()) return;
      if (myToken !== this.fogRebuildToken) return; // 그 사이 더 최신 resize가 들어왔음
      try {
        this.buildFogOfWar();
      } catch (err) {
        // 안개 재생성마저 실패하면(극단적인 기기 호환성 문제), 게임 자체를 멈추기보다
        // 안개 없이(=시야 제한 없이) 계속 진행되도록 조용히 포기한다. 시야가 넓어지는 건
        // 밸런스상 아쉽지만, 화면이 아예 안 뜨는 것보다는 훨씬 낫다.
        console.error("[MainScene] 안개(fog) 재생성 실패 — 시야 제한 없이 계속 진행", err);
        this.destroyFog();
      }
    });
  }

  private updateFogOfWar() {
    if (!this.fogRT || !this.fogEraser) return;

    // 자가 복구: 화면 회전/전체화면 전환/모바일 주소창 접힘 등으로 resize 이벤트가 씹히거나
    // 레이아웃이 자리잡기 전 크기로만 한 번 오는 경우, fogRT가 실제 화면보다 작게 굳어버려서
    // "화면 절반은 안개가 정상 동작하고 나머지 절반은 안개가 아예 안 덮이는" 증상이 났다
    // (정전/어둠의 시험 중 신고된 버그). handleResize의 디바운스 재생성 경로가 놓치는 경우를
    // 대비해, 여기서 매 프레임 아주 저렴한 크기 비교만으로 어긋남을 즉시 바로잡는다.
    const sw = this.scale.width;
    const sh = this.scale.height;
    if (sw > 0 && sh > 0 && (this.fogRT.width !== sw || this.fogRT.height !== sh)) {
      this.buildFogOfWar();
      if (!this.fogRT || !this.fogEraser) return;
    }

    const isGhost = !(this.gm.me?.alive ?? true);
    this.fogRT.setVisible(!isGhost);
    if (isGhost) return;

    // 플레이어 월드좌표 → 화면좌표 변환
    const cam = this.cameras.main;
    const sx = (this.myPlayer.x - cam.scrollX) * cam.zoom;
    const sy = (this.myPlayer.y - cam.scrollY) * cam.zoom;

    // fogRT를 매 프레임 다시 그림: 먼저 어두운 색으로 채우고, 플레이어 위치를 지운다
    this.fogRT.clear();
    this.fogRT.fill(0x03040a, 0.93);
    // [수정] "정전(어둠의 시험)" 사보타지가 진행 중일 때는 실제로 시야가 좁아지도록,
    // 평소 밝기(cam.zoom)에 정전 전용 축소 배율을 곱해 빛이 닿는 원(erase 브러시)을
    // 확 줄인다. 예전엔 blackoutActive와 무관하게 늘 같은 크기로 밝혀서 "정전"이라는
    // 이름이 무색하게 시야가 전혀 좁아지지 않았다.
    // [수정] 정전으로 시야가 좁아지는 건 양(및 진행 중인 임포스터를 제외한 나머지)에게만 해당한다.
    // 임포스터(늑대)는 자기가 스스로 일으킨 사보타지이므로 시야가 좁아지면 안 된다.
    const isBlackoutAffected = this.gm.blackoutActive && !isWolfFaction(this.gm.myRole);
    const eraserScale = cam.zoom * (isBlackoutAffected ? this.BLACKOUT_VISION_SCALE : 1);
    this.fogEraser.setPosition(sx, sy);
    this.fogEraser.setScale(eraserScale);
    this.fogRT.erase(this.fogEraser, sx, sy);
  }

  private syncOtherTarget(id: string) {
    const p = this.gm.players.get(id);
    if (!p || id === this.gm.userId || p.hidden) return;
    this.otherTargets.set(id, { x: p.x, y: p.y });
  }

  private syncHiddenVisual(id: string) {
    if (id === this.gm.userId) return;
    const p = this.gm.players.get(id);
    const bean = this.otherRects.get(id);
    const label = this.otherLabels.get(id);
    // 버그 수정(숨기 상태가 다른 사람에게 희미하게 보임): 0.15는 완전히 안 보이는 게 아니라
    // "약간 비치는" 수준이라 숨어도 실루엣이 드러났다. 숨기는 다른 사람 눈에는 완전히
    // 사라져야 하므로 0으로 바꾼다(나 자신에게는 여전히 0.35로 보여 내 위치는 알 수 있게 둔다).
    // 이름표도 캐릭터와 별개로 항상 떠 있었어서, 몸은 숨겨져도 이름표만으로 위치가 드러나던
    // 것도 같이 고쳤다.
    if (bean && p) bean.setAlpha(p.hidden ? 0 : 1);
    if (label && p) label.setAlpha(p.hidden ? 0 : 1);
  }

  private updateReactorPanelVisuals() {
    const left = this.reactorPanelGfx.left;
    const right = this.reactorPanelGfx.right;
    if (!left || !right) return;
    if (!this.gm.reactorActive) {
      left.setFillStyle(0x555555, 0.5);
      right.setFillStyle(0x555555, 0.5);
      return;
    }
    left.setFillStyle(this.gm.reactorLeftFixed ? 0x22c55e : 0xff3b3b, 0.75);
    right.setFillStyle(this.gm.reactorRightFixed ? 0x22c55e : 0xff3b3b, 0.75);
  }

  private updateCandlePanelVisuals() {
    CANDLE_SPOT_IDS.forEach((id) => {
      const gfx = this.candlePanelGfx[id];
      if (!gfx) return;
      // 이번 라운드에 뽑히지 않은 후보 지점이거나 사보타지가 꺼져 있으면 평소 색(꺼짐)으로.
      if (!this.gm.candleActive || !this.gm.candleSpotIds.includes(id)) {
        gfx.setFillStyle(0x555555, 0.5);
        return;
      }
      const role = this.gm.candleSpotIds[0] === id ? "a" : "b";
      const fixed = role === "a" ? this.gm.candleAFixed : this.gm.candleBFixed;
      gfx.setFillStyle(fixed ? 0x22c55e : 0xff7a1a, 0.85);
    });
  }

  private updatePipePanelVisuals() {
    const a = this.pipePanelGfx.a;
    const b = this.pipePanelGfx.b;
    if (!a || !b) return;
    if (!this.gm.pipeActive) {
      a.setFillStyle(0x555555, 0.5);
      b.setFillStyle(0x555555, 0.5);
      return;
    }
    a.setFillStyle(this.gm.pipeAFixed ? 0x22c55e : 0x38bdf8, 0.75);
    b.setFillStyle(this.gm.pipeBFixed ? 0x22c55e : 0x38bdf8, 0.75);
  }

  private updateEmergencyPassageVisuals() {
    const open = this.gm.blackoutActive;
    this.emergencyGateGfx.forEach(({ box, glow }) => {
      box.setStrokeStyle(3, open ? 0x22d3ee : 0x555566);
      box.setFillStyle(open ? 0x0d3a40 : 0x14162a, 1);
      glow.setVisible(open);
    });
  }

  // 엘리베이터는 사보타지 진행 중에만 탑승 가능하다 — 평소엔 회색으로 꺼져 있다가,
  // 사보타지가 하나라도 활성화되면 노란빛으로 켜져서 "지금은 탈 수 있다"를 알려준다.
  private updateElevatorVisuals() {
    const active =
      this.gm.blackoutActive || this.gm.reactorActive || !!this.gm.doorLockRoomId ||
      this.gm.candleActive || this.gm.pipeActive;
    this.elevatorGfx.forEach(({ box, label }) => {
      box.setStrokeStyle(2, active ? 0xfbbf24 : 0x555566);
      label.setColor(active ? "#fbbf24" : "#888899");
    });
  }

  private updateDoorLock() {
    this.doorLockWalls.forEach((w) => {
      const idx = this.wallRects.indexOf(w);
      if (idx >= 0) this.wallRects.splice(idx, 1);
      w.destroy();
    });
    this.doorLockWalls = [];
    this.doorLockOverlay?.destroy();
    this.doorLockOverlay = null;
    this.doorLockLabel?.destroy();
    this.doorLockLabel = null;

    const roomId = this.gm.doorLockRoomId;
    if (!roomId) return;
    const room = ROOMS.find((r) => r.id === roomId);
    if (!room) return;

    this.doorLockOverlay = this.add
      .rectangle(room.x + room.w / 2, room.y + room.h / 2, room.w, room.h, 0xff0000, 0.16)
      .setDepth(1);
    this.doorLockLabel = this.add
      .text(room.x + room.w / 2, room.y - 18, `🔒 ${room.label} 잠김`, {
        fontSize: "13px", color: "#fca5a5",
      })
      .setOrigin(0.5)
      .setDepth(3);

    room.doors.forEach((door) => {
      const t = WALL_THICKNESS + 6;
      let rect: Phaser.GameObjects.Rectangle;
      if (door.side === "top" || door.side === "bottom") {
        const y = door.side === "top" ? room.y : room.y + room.h;
        rect = this.add
          .rectangle(door.at + door.size / 2, y, door.size, t, 0xdc2626, 0.85)
          .setStrokeStyle(2, 0xfca5a5);
      } else {
        const x = door.side === "left" ? room.x : room.x + room.w;
        rect = this.add
          .rectangle(x, door.at + door.size / 2, t, door.size, 0xdc2626, 0.85)
          .setStrokeStyle(2, 0xfca5a5);
      }
      rect.setDepth(2);
      this.physics.add.existing(rect, true);
      this.wallRects.push(rect);
      this.doorLockWalls.push(rect);
    });
  }

  private renderOtherPlayers() {
    this.gm.players.forEach((p, id) => {
      if (id === this.gm.userId) return;
      if (!p.alive) {
        this.otherRects.get(id)?.destroy();
        this.otherLabels.get(id)?.destroy();
        this.otherRects.delete(id);
        this.otherLabels.delete(id);
        this.otherInView.delete(id);
        if (!this.bodyMarkers.has(id)) {
          // 죽은 자리엔 그 사람 색깔의 십자가가 남는다(누구인지 색으로 알아볼 수 있다).
          const marker = createBodyMarker(this, p.x, p.y, id);
          this.bodyMarkers.set(id, marker);
        }
        return;
      }
      if (!this.otherRects.has(id)) {
        const bean = createBeanSprite(this, p.x, p.y, id, { hat: p.hat, pet: p.pet });
        // 버그 수정(숨기 상태가 다른 사람에게 희미하게 보임): syncHiddenVisual과 동일하게 0으로.
        bean.setAlpha(p.hidden ? 0 : 1);
        const label = this.add.text(p.x - 16, p.y - 30, p.name, {
          fontSize: "11px", color: "#ddd", fontFamily: NAMEPLATE_FONT, stroke: "#000000", strokeThickness: 3,
        });
        label.setAlpha(p.hidden ? 0 : 1);
        this.otherRects.set(id, bean);
        this.otherLabels.set(id, label);
        this.otherTargets.set(id, { x: p.x, y: p.y });
      }
    });
  }

  update(time: number) {
    try {
      this.updateInner(time);
    } catch (err) {
      // 버그 진단용: update() 도중 예외가 나면 Phaser는 그 프레임부터 조용히 렌더를
      // 멈추는 경우가 있다(캔버스가 마지막 프레임 상태로 얼어붙거나 새까맣게 보임).
      // 매 프레임 반복 호출되므로 콘솔 스팸을 막기 위해 최초 1회만 이벤트를 쏜다.
      if (!this.isShuttingDown && !this.updateErrored) {
        console.error("[MainScene] update() 중 오류 발생", err);
        this.game.events.emit("scene-update-error", err instanceof Error ? err.message : String(err));
        this.updateErrored = true; // 매 프레임 반복 에러로 인한 콘솔/이벤트 스팸 방지
      }
    }
  }

  private updateInner(time: number) {
    if (this.gm.phase !== "playing") {
      this.fogRT?.setVisible(false);
      return;
    }

    this.frameCounter++;

    // ── [3단계] 2차 판정: 5초간 실측 FPS가 낮으면 저사양으로 강등 (승급은 없음) ──
    if (!this.lowSpecMode) {
      const shouldDowngrade = this.fpsSampler.sample(time, this.game.loop.actualFps);
      if (shouldDowngrade) {
        this.lowSpecMode = true;
        console.warn("[perf] 실측 FPS 저조(5초 평균 40 미만) → 저사양 모드로 전환");
      }
    }

    const body = this.myPlayer.body as Phaser.Physics.Arcade.Body;
    const isGhost = !(this.gm.me?.alive ?? true);
    body.checkCollision.none = isGhost;
    const speed = isGhost ? 260 : 200;
    body.setVelocity(0);

    const canMove =
      isGhost || (!this.taskModalOpen && !this.sabotageMenuOpen && !this.hidden && !this.ventTraveling);
    if (canMove) {
      let vx = 0, vy = 0;
      if (this.cursors.left.isDown) vx -= 1;
      if (this.cursors.right.isDown) vx += 1;
      if (this.cursors.up.isDown) vy -= 1;
      if (this.cursors.down.isDown) vy += 1;
      if (vx === 0 && vy === 0) {
        vx = this.mobileVector.x;
        vy = this.mobileVector.y;
      }
      body.setVelocityX(vx * speed);
      body.setVelocityY(vy * speed);
    }

    // M키로 미니맵 켜기/끄기 — 이동 여부와 무관하게 항상 반응해야 하므로(이동 중에도
    // 화살표 키에서 손을 떼지 않고 바로 토글할 수 있도록) canMove/hidden 등 어떤 조건과도
    // 묶지 않고 매 프레임 독립적으로 확인한다. 실제 열림/닫힘 상태는 MiniMap.tsx가 갖고
    // 있으므로 여기서는 그냥 "토글해라"는 신호만 쏜다.
    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      this.game.events.emit("toggle-minimap");
    }

    this.myLabel.setPosition(this.myPlayer.x - 16, this.myPlayer.y - 30);
    this.myLabel.setVisible(!this.hidden);
    this.myBean.setPosition(this.myPlayer.x, this.myPlayer.y);

    // 벤트 이동 연출 중에는 여기서 매 프레임 scale/alpha를 되돌리면 travelThroughVent의
    // 트윈과 충돌해 연출이 아예 안 보이게 된다 — 연출이 끝날 때까지 건드리지 않는다.
    if (!isGhost && !this.ventTraveling) {
      this.myBean.setAlpha(this.hidden ? 0.35 : 1);
      const vel = body.velocity;
      const moving = Math.abs(vel.x) > 5 || Math.abs(vel.y) > 5;
      if (Math.abs(vel.x) > 5) this.myFacing = vel.x < 0 ? -1 : 1;
      applyWalkAnim(this.myBean, moving, this.myFacing, time, { skipBreathe: this.lowSpecMode });
      if (moving) {
        playFootstep();
        // 스텝 주기마다만 먼지를 띄운다(매 프레임이면 과함). 저사양 모드에서는 아예 생략.
        if (!this.lowSpecMode && time - this.lastDustAt > 260) {
          this.lastDustAt = time;
          spawnFootstepDust(this, this.myPlayer.x, this.myPlayer.y + BODY_H / 2 - 4);
        }
      }
    }

    if (!this.hidden && time - this.lastMoveSent > 80) {
      this.lastMoveSent = time;
      this.gm.sendMove(this.myPlayer.x, this.myPlayer.y);
    }

    this.otherTargets.forEach((target, id) => {
      const bean = this.otherRects.get(id);
      const label = this.otherLabels.get(id);
      if (!bean) return;

      // [3단계] 뷰포트 진입/이탈 "순간"에만 visible 토글 + 트윈 pause/resume.
      // 매 프레임 호출하면 컬링의 의미가 없으므로 상태가 실제로 바뀔 때만 처리한다.
      const inView = this.isNearViewport(bean.x, bean.y);
      const wasInView = this.otherInView.get(id) ?? true;
      if (inView !== wasInView) {
        bean.setVisible(inView);
        label?.setVisible(inView);
        setBeanVisualActive(this, bean, inView);
        this.otherInView.set(id, inView);
      }

      // 화면 밖: 위치 보간 갱신 빈도를 낮춘다 (저사양 5프레임/1, 일반 3프레임/1).
      // 완전히 멈추지는 않는다 — 그러면 다시 화면에 들어왔을 때 위치가 크게 어긋나 있다.
      if (!inView) {
        const every = this.lowSpecMode ? 5 : 3;
        if (this.frameCounter % every !== 0) return;
      }

      const dx = target.x - bean.x;
      const dy = target.y - bean.y;
      const moving = Math.abs(dx) > 1 || Math.abs(dy) > 1;
      if (Math.abs(dx) > 1) this.otherFacing.set(id, dx < 0 ? -1 : 1);
      bean.x = Phaser.Math.Linear(bean.x, target.x, 0.2);
      bean.y = Phaser.Math.Linear(bean.y, target.y, 0.2);
      label?.setPosition(bean.x - 16, bean.y - 32);

      // 화면 밖이면 어차피 안 보이므로 걷기 애니메이션(텍스처 스왑)은 완전히 생략한다.
      if (inView) {
        applyWalkAnim(bean, moving, this.otherFacing.get(id) ?? 1, time, {
          skipBreathe: this.lowSpecMode,
        });
      }
    });

    // 안개: 저사양 모드에서는 격프레임으로만 갱신한다. 안개는 플레이어가 움직일 때만
    // 서서히 바뀌는 성질이라, 한 프레임 걸러 갱신해도 체감 차이가 거의 없다.
    if (!this.lowSpecMode || this.frameCounter % 2 === 0) {
      this.updateFogOfWar();
    }
    this.handleProximity(time);
  }

  /**
   * [3단계] 캐릭터가 카메라 뷰포트(±margin) 안에 있는지 확인한다.
   * margin을 두는 이유: 화면 경계에 딱 붙어서 "보이자마자 애니메이션이 툭 시작"하는
   * 느낌이 아니라, 살짝 여유를 두고 미리 갱신을 재개해 자연스럽게 만들기 위해서다.
   */
  private isNearViewport(x: number, y: number, margin = 160): boolean {
    const view = this.cameras.main.worldView;
    return (
      x >= view.x - margin &&
      x <= view.right + margin &&
      y >= view.y - margin &&
      y <= view.bottom + margin
    );
  }

  private dist(x: number, y: number) {
    return Phaser.Math.Distance.Between(this.myPlayer.x, this.myPlayer.y, x, y);
  }

  /**
   * 벤트 탑승 연출 — 예전엔 setPosition으로 순간이동시켰지만, 그러면 화면이 뚝 끊겨
   * 보였다. 지금은 출발 벤트에서 몸이 오그라들며 사라지고(shrink+fade), 그 사이에
   * 실제 좌표를 도착 벤트로 옮긴 뒤, 도착 벤트에서 다시 커지며 나타나는 짧은 트윈
   * 2단계로 재생한다. 연출 중엔 ventTraveling=true로 이동 입력과 걷기 애니메이션을
   * 막아 트윈과 충돌하지 않게 한다(updateInner 참고).
   */
  private travelThroughVent(fromVent: VentSpot, target: VentSpot) {
    if (this.ventTraveling) return;
    this.ventTraveling = true;
    this.ventMenuOpen = false;

    const body = this.myPlayer.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);
    this.myPlayer.setPosition(fromVent.x, fromVent.y);
    body.reset(fromVent.x, fromVent.y);
    this.myBean.setPosition(fromVent.x, fromVent.y);
    this.gm.sendMove(fromVent.x, fromVent.y);

    playElevatorRide();
    this.spawnVentPuff(fromVent.x, fromVent.y);

    const facing = this.myFacing;
    this.tweens.add({
      targets: this.myBean,
      scaleX: 0.05 * facing,
      scaleY: 0.05,
      alpha: 0,
      duration: 230,
      ease: "Cubic.easeIn",
      onComplete: () => {
        this.myPlayer.setPosition(target.x, target.y);
        body.reset(target.x, target.y);
        this.myBean.setPosition(target.x, target.y);
        this.gm.sendMove(target.x, target.y);
        this.spawnVentPuff(target.x, target.y);

        this.tweens.add({
          targets: this.myBean,
          scaleX: facing,
          scaleY: 1,
          alpha: 1,
          duration: 230,
          ease: "Back.easeOut",
          onComplete: () => {
            this.ventTraveling = false;
            this.ventCooldownUntil = Date.now() + VENT_COOLDOWN_MS;
          },
        });
      },
    });
  }

  /** 벤트 입·출구에서 터지는 작은 바람 이펙트(💨) — 연출용, 충돌/판정과 무관. */
  private spawnVentPuff(x: number, y: number) {
    const puff = this.add.text(x, y - 6, "💨", { fontSize: "22px" }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: puff,
      scale: { from: 0.5, to: 1.4 },
      alpha: { from: 0.9, to: 0 },
      y: y - 22,
      duration: 420,
      ease: "Cubic.easeOut",
      onComplete: () => puff.destroy(),
    });
  }

  private handleProximity(time: number) {
    let prompt = "";
    let actionType = "";
    const alive = this.gm.me?.alive;
    const now = Date.now();

    if (this.sabotageMenuOpen) {
      if (!this.isTouch) this.promptText.setText("사보타지 메뉴에서 선택하세요");
      return;
    }

    if (this.ventMenuOpen) {
      if (!this.isTouch) this.promptText.setText("환풍구 목적지를 선택하세요");
      return;
    }

    if (this.ventTraveling) {
      if (!this.isTouch) this.promptText.setText("환풍구 이동 중...");
      return;
    }

    // [수정] 죽어서 유령이 된 뒤에도(양 진영이었다면) 남은 미션을 계속 수행할 수 있게 되어,
    // "죽었다고 미션이 영영 막히는" 문제를 없앤다. 늑대 진영은 애초에 배정된 미션이 없어
    // (myTaskSpots가 비어 있음) 유령이 돼도 여기서 할 일이 새로 생기진 않는다.
    if (!isWolfFaction(this.gm.myRole) && !this.taskModalOpen && !this.hidden) {
      const nearTask = this.gm.myTaskSpots.find(
        (t) => !this.gm.myCompletedTasks.has(t.id) && this.dist(t.x, t.y) < TASK_RADIUS
      );
      if (nearTask) {
        prompt = `스페이스바로 [${nearTask.label}] 시작`;
        actionType = "space";
        if (this.consumeAction(this.spaceKey, "space")) {
          this.taskModalOpen = true;
          this.game.events.emit("open-task-modal-request", nearTask.id);
        }
      }
    }

    // 버그 수정: 늑대(임포스터)가 시신을 신고하지 못하는 문제가 있었다 — R키 자체엔 원래
    // 진영 제한이 없었지만, 이 체크가 사보타지 수리/환풍구/사보타지 메뉴 프롬프트보다 뒤에
    // 있어서 그것들이 먼저 prompt를 차지하면 모바일에서는 "R로 신고" 버튼 자체가 뜨지 않았다
    // (늑대는 살해 직후 환풍구 근처에 있는 경우가 많아 이 문제를 특히 자주 겪었다). 신고는
    // 늦을수록 손해이므로 다른 프롬프트보다 먼저 확인해 항상 최우선으로 뜨게 한다.
    // 진영 구분 없이(양/늑대 모두) 동일하게 동작한다.
    if (alive && !this.hidden && !this.sabotageMenuOpen) {
      const nearBody = this.gm.deadBodies.find((b) => this.dist(b.x, b.y) < MEETING_CALL_RADIUS);
      // 6-4: 시신을 처음 발견하는 순간, 신고 가능 여부와 별개로 화면 비네트+효과음으로
      // 긴장감을 즉시 전달한다(react 쪽 PhaserGame.tsx가 이 이벤트를 구독해 연출을 그린다).
      if (nearBody && !this.seenBodyIds.has(nearBody.id)) {
        this.seenBodyIds.add(nearBody.id);
        this.game.events.emit("body-discovered", nearBody.victimName);
      }
      if (nearBody) {
        prompt = "R키로 신고 (긴급회의 소집)";
        actionType = "r";
        if (this.consumeAction(this.rKey, "r")) this.gm.callMeeting("body");
      } else if (this.dist(BELL_SPOT.x, BELL_SPOT.y) < BELL_SPOT.radius && this.gm.canCallEmergency()) {
        prompt = "R키로 긴급 기도 모임 소집";
        actionType = "r";
        if (this.consumeAction(this.rKey, "r")) this.gm.callMeeting("emergency");
      }
    }

    // [수정] 원래 사보타지 수리는 양 진영만 할 수 있었는데, 늑대(임포스터)도 자기가 일으킨
    // 사보타지를 스스로 해결할 수 있도록 진영 제한을 없앴다 — 예: 다른 늑대가 이미 죽은
    // 상황에서 의심을 피하려고 직접 고치러 가는 것도 가능해진다.
    if (alive && this.gm.reactorActive && !this.hidden && !this.sabotageMenuOpen) {
      const nearLeft = !this.gm.reactorLeftFixed &&
        this.dist(REACTOR_PANELS.left.x, REACTOR_PANELS.left.y) < REACTOR_PANEL_RADIUS;
      const nearRight = !this.gm.reactorRightFixed &&
        this.dist(REACTOR_PANELS.right.x, REACTOR_PANELS.right.y) < REACTOR_PANEL_RADIUS;
      if (nearLeft) {
        if (!prompt) { prompt = `스페이스바로 [${REACTOR_PANELS.left.label}] 수리`; actionType = "space"; }
        if (this.consumeAction(this.spaceKey, "space")) this.gm.fixReactorPanel("left");
      } else if (nearRight) {
        if (!prompt) { prompt = `스페이스바로 [${REACTOR_PANELS.right.label}] 수리`; actionType = "space"; }
        if (this.consumeAction(this.spaceKey, "space")) this.gm.fixReactorPanel("right");
      }
    }

    if (alive && this.gm.candleActive && !this.hidden && !this.sabotageMenuOpen) {
      const spotA = CANDLE_SPOTS[this.gm.candleSpotIds[0]];
      const spotB = CANDLE_SPOTS[this.gm.candleSpotIds[1]];
      const nearA = !this.gm.candleAFixed && this.dist(spotA.x, spotA.y) < CANDLE_SPOT_RADIUS;
      const nearB = !this.gm.candleBFixed && this.dist(spotB.x, spotB.y) < CANDLE_SPOT_RADIUS;
      if (nearA) {
        if (!prompt) {
          prompt = `스페이스바 연타로 [${spotA.label}] 촛불 진화 (${this.gm.candleAProgress}/${CANDLE_PRESSES_NEEDED})`;
          actionType = "space";
        }
        if (this.consumeAction(this.spaceKey, "space")) this.gm.extinguishCandle("a");
      } else if (nearB) {
        if (!prompt) {
          prompt = `스페이스바 연타로 [${spotB.label}] 촛불 진화 (${this.gm.candleBProgress}/${CANDLE_PRESSES_NEEDED})`;
          actionType = "space";
        }
        if (this.consumeAction(this.spaceKey, "space")) this.gm.extinguishCandle("b");
      }
    }

    if (alive && this.gm.pipeActive && !this.hidden && !this.sabotageMenuOpen) {
      const nearA = !this.gm.pipeAFixed &&
        this.dist(PIPE_PANELS.a.x, PIPE_PANELS.a.y) < PIPE_PANEL_RADIUS;
      const nearB = !this.gm.pipeBFixed &&
        this.dist(PIPE_PANELS.b.x, PIPE_PANELS.b.y) < PIPE_PANEL_RADIUS;
      if (nearA) {
        if (!prompt) { prompt = `스페이스바로 [${PIPE_PANELS.a.label}] 잠그기`; actionType = "space"; }
        if (this.consumeAction(this.spaceKey, "space")) this.gm.fixPipePanel("a");
      } else if (nearB) {
        if (!prompt) { prompt = `스페이스바로 [${PIPE_PANELS.b.label}] 잠그기`; actionType = "space"; }
        if (this.consumeAction(this.spaceKey, "space")) this.gm.fixPipePanel("b");
      }
    }

    if (alive && isWolfFaction(this.gm.myRole) && !this.hidden && !this.sabotageMenuOpen) {
      const nearVictim = [...this.gm.players.values()].find(
        (p) => p.id !== this.gm.userId && p.alive && !p.hidden && this.dist(p.x, p.y) < KILL_RADIUS
      );
      if (nearVictim && this.gm.canKill(now)) {
        if (!prompt) { prompt = `K키로 [${nearVictim.name}] 처치`; actionType = "k"; }
        if (this.consumeAction(this.kKey, "k")) this.gm.killPlayer(nearVictim.id);
      }
      if (!this.sabotageMenuOpen && this.gm.canOpenSabotageMenu(now)) {
        if (!prompt) { prompt = "B키로 사보타지 메뉴 열기"; actionType = "b"; }
        if (this.consumeAction(this.bKey, "b")) {
          this.sabotageMenuOpen = true;
          this.game.events.emit("open-sabotage-menu-request");
        }
      }

      const nearVent = VENTS.find((v) => this.dist(v.x, v.y) < VENT_INTERACT_RADIUS);
      if (nearVent && now >= this.ventCooldownUntil && !this.ventMenuOpen && !this.ventTraveling) {
        if (!prompt) { prompt = `V키로 [${nearVent.label}] 안으로 이동`; actionType = "v"; }
        if (this.consumeAction(this.vKey, "v")) {
          if (nearVent.links.length > 1) {
            // 갈림길 벤트 — 어디로 나갈지 React 쪽 선택 메뉴(방향 화살표)에 맡긴다.
            this.ventMenuOpen = true;
            this.pendingVentSourceId = nearVent.id;
            this.game.events.emit("open-vent-menu-request", {
              ventId: nearVent.id,
              from: { x: nearVent.x, y: nearVent.y },
              options: nearVent.links
                .map((linkId) => VENTS.find((v) => v.id === linkId))
                .filter((v): v is (typeof VENTS)[number] => !!v)
                .map((v) => ({ id: v.id, label: v.label, x: v.x, y: v.y })),
            });
          } else {
            const target = VENTS.find((v) => v.id === nearVent.links[0]);
            if (target) this.travelThroughVent(nearVent, target);
          }
        }
      }
    }

    // 엘리베이터 — 예전엔 언제나 자유롭게 탈 수 있어서 사실상 순간이동 지름길로만 쓰이며
    // 존재감이 없었다. 이제는 "사보타지 진행 중"에만 열리는 비상 이동 수단으로 바꿔서,
    // 사보타지 대응(패널로 흩어지기/기도실로 모이기)에 실제로 쓰이는 장치로 만든다.
    // 비상통로(EMERGENCY_PASSAGE_GATES)와 마찬가지로 진영 구분 없이 양/늑대 모두 이용 가능.
    const anySabotageActive =
      this.gm.blackoutActive || this.gm.reactorActive || !!this.gm.doorLockRoomId ||
      this.gm.candleActive || this.gm.pipeActive;
    if (alive && !this.hidden && anySabotageActive) {
      const nearElevator = ELEVATORS.find((e) => this.dist(e.x, e.y) < ELEVATOR_INTERACT_RADIUS);
      if (nearElevator && now >= this.elevatorCooldownUntil) {
        if (!prompt) { prompt = `E키로 [${nearElevator.label}] 탑승 (사보타지 중에만 이용 가능)`; actionType = "e"; }
        if (this.consumeAction(this.eKey, "e")) {
          const target = ELEVATORS.find((e) => e.id === nearElevator.pairId);
          if (target) {
            this.elevatorCooldownUntil = now + ELEVATOR_COOLDOWN_MS;
            playElevatorRide();
            this.cameras.main.flash(180, 200, 220, 255);
            this.myPlayer.setPosition(target.x, target.y);
            (this.myPlayer.body as Phaser.Physics.Arcade.Body).reset(target.x, target.y);
            this.gm.sendMove(target.x, target.y);
          }
        }
      }
    }

    // 비상통로 — 정전 사보타지가 진행 중일 때만 열리는 게이트(엘리베이터와 별개 쿨다운).
    // 평소엔 gm.blackoutActive가 false라 이 블록 전체가 그냥 건너뛰어져서 프롬프트도 뜨지 않는다.
    if (alive && !this.hidden && this.gm.blackoutActive) {
      const nearGate = EMERGENCY_PASSAGE_GATES.find(
        (g) => this.dist(g.x, g.y) < EMERGENCY_PASSAGE_INTERACT_RADIUS
      );
      if (nearGate && now >= this.emergencyPassageCooldownUntil) {
        if (!prompt) { prompt = `F키로 [${nearGate.label}] 통과`; actionType = "f"; }
        if (this.consumeAction(this.fKey, "f")) {
          const target = EMERGENCY_PASSAGE_GATES.find((g) => g.id === nearGate.pairId);
          if (target) {
            this.emergencyPassageCooldownUntil = now + EMERGENCY_PASSAGE_COOLDOWN_MS;
            playElevatorRide();
            this.cameras.main.flash(180, 34, 211, 238);
            this.myPlayer.setPosition(target.x, target.y);
            (this.myPlayer.body as Phaser.Physics.Arcade.Body).reset(target.x, target.y);
            this.gm.sendMove(target.x, target.y);
          }
        }
      }
    }

    if (alive && !this.sabotageMenuOpen) {
      if (!this.hidden) {
        const nearHide = HIDE_SPOTS.find((h) => this.dist(h.x, h.y) < HIDE_INTERACT_RADIUS);
        if (nearHide) {
          if (!prompt) { prompt = `H키로 [${nearHide.label}]에 숨기`; actionType = "h"; }
          if (this.consumeAction(this.hKey, "h")) { this.hidden = true; this.gm.setHidden(true); }
        }
      } else {
        prompt = "H키로 숨기 해제";
        actionType = "h";
        if (this.consumeAction(this.hKey, "h")) { this.hidden = false; this.gm.setHidden(false); }
      }

      if (this.gm.blackoutActive && this.dist(PRAYER_ROOM.x, PRAYER_ROOM.y) < PRAYER_ROOM.radius) {
        // 버그 수정: 이미 참여한 사람에게도 계속 "연타하세요" 프롬프트가 떠서, 자기가
        // 이미 기여했는지 알 수 없었다. 참여 여부에 따라 문구를 다르게 보여준다.
        if (this.gm.hasContributedToBlackout) {
          if (!prompt) { prompt = "🙏 이미 함께 기도했습니다 — 다른 사람을 기다려주세요"; actionType = "space"; }
        } else {
          if (!prompt) { prompt = "스페이스바로 함께 기도 참여!"; actionType = "space"; }
          if (this.consumeAction(this.spaceKey, "space")) this.gm.progressBlackout();
        }
      }
    }

    // 터치 기기에서는 이 캔버스 텍스트를 아예 띄우지 않는다 — 같은 정보는
    // MobileControls가 하단 액션 버튼으로 이미 보여주고 있어서, 화면 상단에 키보드
    // 안내 문구가 겹쳐 뜨는 문제(PC 전용 텍스트가 모바일 화면 위에 계속 보이던 버그)였다.
    if (!this.isTouch) this.promptText.setText(prompt);

    if (prompt !== this.lastEmittedPrompt || actionType !== this.lastEmittedActionType) {
      this.lastEmittedPrompt = prompt;
      this.lastEmittedActionType = actionType;
      this.game.events.emit("mobile-prompt", { label: prompt, type: actionType });
    }
  }
}