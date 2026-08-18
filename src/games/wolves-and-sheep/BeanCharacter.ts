import Phaser from "phaser";
import { playKill } from "./soundManager";
import { ensureCosmeticTexture, findHat, findPet } from "./cosmetics";

/** createBeanSprite에 넘기는 코스메틱 — 어디서 오든(PlayerState, EquippedCosmetics) undefined를 허용한다. */
export interface BeanCosmetics {
  hat?: string | null;
  pet?: string | null;
}

/**
 * 플레이어마다 배정되는 파스텔 팔레트. 역할(양/늑대)과는 무관하며 id를 해시해서 정하기 때문에
 * 별도 네트워크 동기화 없이도 모든 클라이언트에서 항상 같은 사람 = 같은 색으로 보인다.
 * (자기 자신의 역할을 색으로 드러내지 않기 위해 일부러 역할과 분리했다 — 그건 RoleRevealOverlay가 담당)
 */
const BEAN_PALETTE = [
  0xff8fa3, // 코랄 핑크
  0x74c0fc, // 하늘색
  0xb197fc, // 라벤더
  0xffa94d, // 복숭아 오렌지
  0x63e6be, // 민트
  0xffe066, // 레몬 옐로우
  0x69db7c, // 풀잎 그린
  0xe599f7, // 오키드 퍼플
  0xffc9c9, // 블러시
  0x91a7ff, // 페리윙클
];

export function colorForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return BEAN_PALETTE[hash % BEAN_PALETTE.length];
}

export const BODY_W = 34;
export const BODY_H = 44;

/** 걷기 애니메이션 한 사이클을 이루는 정적 프레임 개수. */
export const WALK_FRAME_COUNT = 4;
/** 프레임 하나를 유지하는 시간(ms). 약 8.3fps — 콩 캐릭터 특성상 이 정도가 또렷하고 귀엽다. */
const WALK_FRAME_MS = 120;

/**
 * "bean-walk-0"~"bean-walk-3" 4장의 정적 텍스처를 (세션당 1회) 미리 구워둔다.
 * 예전엔 컨테이너 전체를 매 프레임 스케일만 조절해 스쿼시&스트레치를 흉내냈는데,
 * 그러면 아무리 타이밍을 조절해도 "다리가 바뀐다"는 느낌은 나지 않았다.
 * 지금은 몸통 높이(스쿼시)와 두 발의 좌우 위치를 프레임마다 다르게 구워서,
 * applyWalkAnim이 이 4장을 순서대로 갈아끼우기만 해도 실제로 다리가 앞뒤로 움직이는 것처럼 보인다.
 */
function ensureBeanWalkFrames(scene: Phaser.Scene) {
  if (scene.textures.exists("bean-walk-0")) return;
  const radius = { tl: 14, tr: 14, bl: 17, br: 17 };
  // squash: 1보다 크면 눌린(착지) 상태, 작으면 늘어난(밀어내는) 상태.
  // footShift: 두 발이 좌우로 벌어지는 정도 — 오른쪽 발이 앞이면 양수, 왼쪽 발이 앞이면 음수.
  const frames = [
    { squash: 1.05, footShift: 0 }, // 0: 착지 — 두 발 가지런히
    { squash: 0.97, footShift: 5 }, // 1: 오른발이 앞으로 나가며 몸이 늘어남
    { squash: 1.05, footShift: 0 }, // 2: 다시 착지
    { squash: 0.97, footShift: -5 }, // 3: 왼발이 앞으로 나가며 몸이 늘어남
  ];

  frames.forEach((f, i) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const h = BODY_H * f.squash;
    const yOff = BODY_H - h; // 발 위치(캔버스 바닥)는 고정한 채 몸통 윗부분만 눌리거나 늘어나게
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(2, yOff + 2, BODY_W - 4, h - 4, radius);
    g.lineStyle(3, 0x1c1e30, 1);
    g.strokeRoundedRect(2, yOff + 2, BODY_W - 4, h - 4, radius);
    g.fillStyle(0x1c1e30, 1);
    g.fillEllipse(11 + f.footShift, BODY_H - 5, 7, 5);
    g.fillEllipse(BODY_W - 11 - f.footShift, BODY_H - 5, 7, 5);
    g.generateTexture(`bean-walk-${i}`, BODY_W, BODY_H);
    g.destroy();
  });
}

/** bean-body / bean-visor 텍스처를 (한 게임 세션당 1회) 생성한다. Graphics로 그려서 별도 이미지 에셋이 필요 없다. */
export function ensureBeanTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("bean-body")) return;

  // ---- 몸통: 흰색으로 그려두고 실제 색은 스프라이트에서 setTint로 입힌다 ----
  const body = scene.make.graphics({ x: 0, y: 0 }, false);
  const radius = { tl: 14, tr: 14, bl: 17, br: 17 };
  body.fillStyle(0xffffff, 1);
  body.fillRoundedRect(2, 2, BODY_W - 4, BODY_H - 4, radius);
  body.lineStyle(3, 0x1c1e30, 1);
  body.strokeRoundedRect(2, 2, BODY_W - 4, BODY_H - 4, radius);
  // 작은 발 두 개 (Among Us류 콩 캐릭터 특유의 귀여움 포인트)
  body.fillStyle(0x1c1e30, 1);
  body.fillEllipse(11, BODY_H - 5, 7, 5);
  body.fillEllipse(BODY_W - 11, BODY_H - 5, 7, 5);
  body.generateTexture("bean-body", BODY_W, BODY_H);
  body.destroy();

  // ---- 바이저(눈) ----
  const VW = 22;
  const VH = 15;
  const visor = scene.make.graphics({ x: 0, y: 0 }, false);
  visor.fillStyle(0xcdeeff, 1);
  visor.fillRoundedRect(0, 0, VW, VH, 7);
  visor.lineStyle(2, 0x1c1e30, 1);
  visor.strokeRoundedRect(0, 0, VW, VH, 7);
  visor.fillStyle(0xffffff, 0.9);
  visor.fillEllipse(VW * 0.28, VH * 0.32, 5, 3.5);
  visor.generateTexture("bean-visor", VW, VH);
  visor.destroy();
}

/** 킬 이펙트용 작은 원형 파티클 텍스처를 (한 세션당 1회) 생성한다. */
function ensureFxTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("fx-spark")) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture("fx-spark", 8, 8);
  g.destroy();
}

/** 발밑 그림자용 부드러운 타원 텍스처를 (세션당 1회) 굽는다.
 *  단순 fillEllipse로는 가장자리가 딱딱하게 잘려서, 캔버스 라디얼 그라디언트로
 *  중심은 진하고 가장자리로 갈수록 옅어지게 만든다 — lightMask와 같은 접근. */
function ensureShadowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists("bean-shadow")) return;
  const w = 40, h = 18;
  const canvasTex = scene.textures.createCanvas("bean-shadow", w, h);
  const ctx = canvasTex!.getContext();
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, "rgba(10,10,20,0.42)");
  grad.addColorStop(0.7, "rgba(10,10,20,0.28)");
  grad.addColorStop(1, "rgba(10,10,20,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  canvasTex!.refresh();
}

/** 캐릭터 발밑에 붙는 그림자 이미지를 만들어 반환한다(컨테이너에 직접 add하지 않음 —
 *  호출부에서 body보다 먼저 넣어야 캐릭터 뒤/아래에 깔린다). */
function createShadow(scene: Phaser.Scene): Phaser.GameObjects.Image {
  ensureShadowTexture(scene);
  return scene.add.image(0, BODY_H / 2 - 6, "bean-shadow").setOrigin(0.5, 0.5);
}

/** 발걸음 먼지 파티클용 작은 텍스처를 (세션당 1회) 생성한다. */
function ensureDustTexture(scene: Phaser.Scene) {
  if (scene.textures.exists("fx-dust")) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xd8d0c0, 1);
  g.fillCircle(3, 3, 3);
  g.generateTexture("fx-dust", 6, 6);
  g.destroy();
}

/** 이동 중 발밑에서 아주 살짝 피어오르는 흙먼지 파티클. MainScene에서 이동 중에만,
 *  너무 잦지 않게(예: 스텝 주기마다) 호출해서 쓴다 — 매 프레임 호출하면 과해진다. */
export function spawnFootstepDust(scene: Phaser.Scene, x: number, y: number) {
  ensureDustTexture(scene);
  const emitter = scene.add
    .particles(x, y, "fx-dust", {
      lifespan: 340,
      speed: { min: 8, max: 28 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.45, end: 0 },
      gravityY: -6,
      emitting: false,
    })
    .setDepth(4);
  emitter.explode(3, x, y);
  scene.time.delayedCall(360, () => emitter.destroy());
}

/** 킬 이펙트 중심 아이콘용 "임팩트 스타" 텍스처를 (세션당 1회) 생성한다.
 *  이모지(💥)는 OS/브라우저마다 그림이 달라 통일감이 깨지므로, MapIcons.ts와 같은
 *  방식(Graphics로 직접 그려 굽기)으로 대체한다 — 8방향으로 뾰족한 별 + 흰 하이라이트. */
function ensureImpactStarTexture(scene: Phaser.Scene) {
  if (scene.textures.exists("fx-impact-star")) return;
  const W = 52, H = 52;
  const cx = W / 2, cy = H / 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const drawStar = (points: number, outerR: number, innerR: number, color: number, alpha: number) => {
    g.fillStyle(color, alpha);
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  };

  drawStar(8, 24, 9, 0xff6b6b, 1);
  drawStar(8, 16, 6, 0xffe066, 1);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx, cy, 5);

  g.generateTexture("fx-impact-star", W, H);
  g.destroy();
}

/** visor(눈)를 짧게 찌그러뜨렸다 되돌리는 것으로 눈 깜빡임을 표현하고, 스스로 다음 깜빡임을 예약한다.
 *  scene이 전환되거나 캐릭터가 파괴되면(visor.active === false) 예약을 멈춰 누수 없이 정리된다.
 *  3단계 최적화: 캐릭터가 화면 밖(컨테이너 invisible)이면 트윈을 아예 만들지 않고 다음 주기만
 *  다시 예약한다 — 안 보이는 눈을 깜빡이려고 트윈을 생성/계산할 이유가 없다. delayedCall 자체는
 *  타이머라 비용이 거의 없으므로 계속 재예약해도 괜찮다(다시 화면에 들어오면 곧바로 재개됨). */
function scheduleBlink(scene: Phaser.Scene, visor: Phaser.GameObjects.Image) {
  const delay = 2200 + Math.random() * 3200;
  scene.time.delayedCall(delay, () => {
    if (!visor.active) return;
    if (visor.parentContainer && !visor.parentContainer.visible) {
      scheduleBlink(scene, visor);
      return;
    }
    scene.tweens.add({
      targets: visor,
      scaleY: 0.15,
      duration: 70,
      yoyo: true,
      ease: "Quad.easeInOut",
      onComplete: () => scheduleBlink(scene, visor),
    });
  });
}

/**
 * [3단계] 화면 밖으로 나간 캐릭터의 부가 연출(눈 깜빡임 트윈, 펫 둥실 트윈)을 일시정지/재개한다.
 * MainScene이 카메라 뷰포트 진입/이탈 "순간"에만 호출한다(매 프레임 호출 아님 — 그러면 의미가 없다).
 * 위치 보간이나 걷기 애니메이션과는 무관하게, 컨테이너 안의 모든 자식(body/visor/hat/pet)에 걸린
 * 트윈을 찾아 pause/resume만 한다. 진행 중이던 트윈(예: 깜빡이는 중)은 그 상태 그대로 멈췄다가
 * 재개 시 이어서 끝난다 — 매번 처음부터 다시 만드는 것보다 싸다.
 */
export function setBeanVisualActive(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  active: boolean
) {
  container.list.forEach((child) => {
    const tweens = scene.tweens.getTweensOf(child as Phaser.GameObjects.GameObject);
    tweens.forEach((tw) => (active ? tw.resume() : tw.pause()));
  });
}

/** 모자를 visor 위(콩의 정수리)에 얹는다. hat.id가 "none"이면 아무것도 그리지 않는다. */
function attachHat(scene: Phaser.Scene, container: Phaser.GameObjects.Container, hatId: string | null | undefined) {
  const hat = findHat(hatId);
  if (hat.id === "none") return;
  const key = ensureCosmeticTexture(scene, hat);
  const img = scene.add.image(6, -22, key).setRotation(Phaser.Math.DegToRad(-8)).setOrigin(0.5, 1);
  container.add(img);
}

/** 펫을 콩 옆(발치)에 딸린 작은 동반자로 붙인다. 펫은 body/visor와 별도로 살짝 둥실거린다. */
function attachPet(scene: Phaser.Scene, container: Phaser.GameObjects.Container, petId: string | null | undefined) {
  const pet = findPet(petId);
  if (pet.id === "none") return;
  const key = ensureCosmeticTexture(scene, pet);
  const img = scene.add.image(BODY_W / 2 + 8, BODY_H / 2 - 2, key).setOrigin(0.5, 0.5);
  container.add(img);
  scene.tweens.add({
    targets: img,
    y: img.y - 5,
    duration: 900 + Math.random() * 300,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

/** 살아있는 플레이어용 콩 캐릭터. body(색상)+visor(고정색) 두 겹으로 구성된 컨테이너를 반환한다.
 *  visor는 일정 간격으로 스스로 눈을 깜빡여(scheduleBlink) 가만히 서 있을 때도 살아있는 느낌을 준다.
 *  cosmetics를 넘기면 장착한 모자/펫도 함께 그린다(장착 안 했으면 기존과 동일한 모습). */
export function createBeanSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  id: string,
  cosmetics?: BeanCosmetics
): Phaser.GameObjects.Container {
  ensureBeanTextures(scene);
  ensureBeanWalkFrames(scene);
  const shadow = createShadow(scene);
  const body = scene.add.image(0, 0, "bean-body").setTint(colorForId(id));
  const visor = scene.add.image(6, -9, "bean-visor").setRotation(Phaser.Math.DegToRad(-8));
  visor.setOrigin(0.5, 0.5);
  scheduleBlink(scene, visor);
  const container = scene.add.container(x, y, [shadow, body, visor]);
  container.setSize(BODY_W, BODY_H);
  if (cosmetics?.hat) attachHat(scene, container, cosmetics.hat);
  if (cosmetics?.pet) attachPet(scene, container, cosmetics.pet);
  return container;
}

/** 사망자용 유령 스프라이트. 옅고 반투명하며 위아래로 둥실둥실 떠다니는 트윈이 내장되어 있다.
 *  주의: 트윈은 컨테이너의 "월드 좌표"가 아니라 안쪽 body 이미지의 "로컬 y"만 움직인다 —
 *  그래야 유령이 실제로 이동할 때(MainScene에서 매 프레임 container.setPosition 호출) 이 둥실둥실
 *  효과와 서로 값을 덮어쓰며 충돌하지 않는다.
 *  주의: 이건 "죽은 나 자신"이 계속 조종해서 돌아다니는 유령 아바타 전용이다(MainScene의
 *  myBean). 다른 사람에게 보이는, 죽은 자리에 남는 시신 표시는 createBodyMarker를 쓴다.
 *  id를 넘기면 본인 고유색(콩 캐릭터와 같은 팔레트)을 옅게 유지한다 — createBodyMarker의
 *  "죽은 사람 색 십자가"와 같은 논리로, 유령 상태에서도 누구인지 옅게나마 구분이 된다.
 *  id가 없으면 예전과 같은 고정 하늘색으로 그린다(하위 호환). */
export function createGhostSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  id?: string
): Phaser.GameObjects.Container {
  ensureBeanTextures(scene);
  ensureBeanWalkFrames(scene);
  const tint = id ? colorForId(id) : 0xe4ecff;
  const body = scene.add.image(0, 0, "bean-body").setTint(tint).setAlpha(0.55);
  const container = scene.add.container(x, y, [body]);
  scene.tweens.add({
    targets: body,
    y: -8,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  return container;
}

const CROSS_W = 26;
const CROSS_H = 40;

/** grave-cross 텍스처를 (세션당 1회) 구워둔다. 세로/가로 막대를 겹쳐 그린 단순한 십자가 모양이며,
 *  흰색으로 그려두고 실제 색은 bean-body와 동일하게 스프라이트에서 setTint로 입힌다. */
function ensureCrossTexture(scene: Phaser.Scene) {
  if (scene.textures.exists("grave-cross")) return;
  const barW = 8;
  const hBarY = CROSS_H * 0.26; // 가로 막대를 위쪽 1/3 지점에 둬서 라틴 십자가 비율을 흉내낸다
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(CROSS_W / 2 - barW / 2, 0, barW, CROSS_H, 3);
  g.fillRoundedRect(0, hBarY, CROSS_W, barW, 3);
  g.lineStyle(2.5, 0x1c1e30, 1);
  g.strokeRoundedRect(CROSS_W / 2 - barW / 2, 0, barW, CROSS_H, 3);
  g.strokeRoundedRect(0, hBarY, CROSS_W, barW, 3);
  g.generateTexture("grave-cross", CROSS_W, CROSS_H);
  g.destroy();
}

/** 다른 사람에게 보이는 "시신 표시" — 죽은 자리에 그 사람의 고유 색(콩 캐릭터와 같은 팔레트)으로
 *  물든 십자가가 남는다. 유령(createGhostSprite)과 달리 그 자리에 고정되어 있고 떠다니지 않는다 —
 *  실제 무덤 표식처럼, 누가 여기서 죽었는지 색으로 알아볼 수 있게 하기 위해서다. */
export function createBodyMarker(scene: Phaser.Scene, x: number, y: number, id: string): Phaser.GameObjects.Container {
  ensureCrossTexture(scene);
  const cross = scene.add.image(0, 0, "grave-cross").setTint(colorForId(id));
  const container = scene.add.container(x, y, [cross]);
  return container;
}

/**
 * 컨테이너 안에서 "몸통" 이미지(bean-body 또는 bean-walk-*)를 찾는다.
 * 컨테이너 맨 앞(인덱스 0)에 내 캐릭터 선택 링(circle)이 들어갈 수 있어서
 * list[0]이 항상 body라고 가정하면 안 된다 — 링은 텍스처가 없는 Shape라서
 * body.texture.key 접근 시 "Cannot read properties of undefined" 크래시가 났다.
 */
function findBodyImage(container: Phaser.GameObjects.Container): Phaser.GameObjects.Image | undefined {
  for (const child of container.list) {
    if (child instanceof Phaser.GameObjects.Image) {
      const key = child.texture?.key ?? "";
      if (key === "bean-body" || key.startsWith("bean-walk-")) {
        return child;
      }
    }
  }
  return undefined;
}

/**
 * 매 프레임 호출: 이동 중이면 4프레임 걷기 텍스처(bean-walk-0~3)를 순서대로 갈아끼워
 * 실제로 다리가 움직이는 것처럼 보이게 하고, 여기에 살짝 좌우 기울임을 더해 생동감을 준다.
 * 정지 중에는 원래의 "숨쉬기" 스케일 트윈으로 되돌아간다.
 * facing이 -1이면 좌우로 뒤집는다(container scaleX 부호로 처리 — 프레임 자체는 좌우대칭이라 안전하다).
 */
export function applyWalkAnim(
  container: Phaser.GameObjects.Container,
  moving: boolean,
  facing: 1 | -1,
  time: number,
  opts?: { skipBreathe?: boolean }
) {
  const body = findBodyImage(container);
  if (moving) {
    const frameIdx = Math.floor(time / WALK_FRAME_MS) % WALK_FRAME_COUNT;
    const key = `bean-walk-${frameIdx}`;
    if (body && body.texture.key !== key && body.scene.textures.exists(key)) {
      body.setTexture(key);
    }
    container.setScale(facing, 1);
    container.rotation = Math.sin((time / 110) * 0.6) * 0.05;
  } else {
    if (body && body.texture.key !== "bean-body") body.setTexture("bean-body");
    if (opts?.skipBreathe) {
      // [3단계] 저사양 모드: sin() 계산과 매 프레임 setScale 호출을 아낀다.
      // 정지 캐릭터가 완전히 멈춰 보이는 정도는 저사양 기기에서는 체감 손실이 적다.
      container.setScale(facing, 1);
    } else {
      // 가만히 서 있을 때도 완전히 정지해 보이지 않도록 아주 미세한 "숨쉬기" 스케일을 준다.
      const breathe = 1 + Math.sin(time / 500) * 0.015;
      container.setScale(facing, breathe);
    }
    container.rotation = Phaser.Math.Linear(container.rotation, 0, 0.25);
  }
}

/** 처치 순간 죽은 자리에서 터지는 이펙트 (이모지 팝 + 실제 파티클 이미터 파편 + 킬 사운드).
 *  예전엔 파편을 원 6개를 개별 트윈으로 흩뿌리는 방식이었는데, Phaser 파티클 이미터로
 *  교체해 개수/속도/색상 분포가 자연스럽고 한 번에 정리도 깔끔하다. */
export function spawnKillPoof(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts?: { particleCount?: number; skipShake?: boolean }
) {
  ensureFxTextures(scene);
  ensureImpactStarTexture(scene);
  // [3단계] 저사양 모드에서는 MainScene이 particleCount를 절반(18→9)으로 줄여서 넘기고,
  // 체감 효과가 적은 카메라 shake는 skipShake로 아예 생략한다.
  const particleCount = opts?.particleCount ?? 18;

  // 이모지(💥) 대신 직접 그린 별 텍스처 — OS/브라우저마다 이모지 모양이 달라 통일감이
  // 깨지던 문제를 해결한다(MapIcons.ts와 같은 "Graphics로 굽기" 방식).
  const burst = scene.add.image(x, y - 12, "fx-impact-star").setOrigin(0.5).setDepth(20).setScale(0.5);
  scene.tweens.add({
    targets: burst,
    scale: { from: 0.5, to: 1.15 },
    alpha: { from: 1, to: 0 },
    angle: { from: -12, to: 12 },
    y: y - 34,
    duration: 480,
    ease: "Cubic.easeOut",
    onComplete: () => burst.destroy(),
  });

  const emitter = scene.add
    .particles(x, y, "fx-spark", {
      lifespan: 500,
      speed: { min: 80, max: 240 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff8fa3, 0xffe066, 0xffffff, 0xff6b6b],
      blendMode: "ADD",
      emitting: false,
    })
    .setDepth(20);
  emitter.explode(particleCount, x, y);
  scene.time.delayedCall(520, () => emitter.destroy());

  if (!opts?.skipShake) {
    scene.cameras.main.shake(160, 0.006);
  }
  playKill();
}