/**
 * 「양과 늑대」 사운드 매니저 — 모든 효과음을 Web Audio API 오실레이터/노이즈로 직접 합성한다.
 * 프로젝트에 사운드 에셋(.mp3/.wav/.ogg)이 전혀 없어서, 외부 파일을 추가하지 않고도
 * 발소리·미션 성공/실패·킬·회의 소집·투표·추방·승패 등의 피드백을 낼 수 있게 했다.
 *
 * 예전에는 PhaserGame.tsx 안에 사보타지 경고음 하나만 이런 방식으로 합성돼 있었는데,
 * 여기로 옮기고 다른 SFX들도 같은 AudioContext/유틸을 공유하도록 통합했다(컨텍스트를
 * 여러 개 만들면 브라우저 오디오 컨텍스트 개수 제한에 걸릴 수 있어 싱글턴으로 관리).
 */

/** Web Audio API 오실레이터 파형 타입 — 전역 OscillatorType 대신 로컬 선언 */
type OscType = "sine" | "square" | "sawtooth" | "triangle" | "custom";

let audioCtx: AudioContext | null = null;
let lastFootstepAt = 0;
// 6-7: 유령 상태일 때 전체 사운드가 "먹먹하게" 들리도록 모든 SFX를 이 로우패스 필터를
// 거쳐 destination으로 내보낸다. 평소(살아있을 때)는 20kHz로 열어둬 사실상 필터링하지 않는다.
let masterGain: GainNode | null = null;
let masterFilter: BiquadFilterNode | null = null;

function getMasterOutput(ctx: AudioContext): AudioNode {
  if (!masterGain || !masterFilter) {
    masterGain = ctx.createGain();
    masterFilter = ctx.createBiquadFilter();
    masterFilter.type = "lowpass";
    masterFilter.frequency.value = 20000;
    masterGain.connect(masterFilter);
    masterFilter.connect(ctx.destination);
  }
  return masterGain;
}

/** 유령(사망) 상태 전환 시 호출 — 로우패스 컷오프를 부드럽게 낮추거나(유령) 원복한다(생존).
 * 급격한 값 변경은 클릭 노이즈가 나므로 0.35초에 걸쳐 램프한다. */
export function setGhostAudioMode(active: boolean) {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    getMasterOutput(ctx);
    if (!masterFilter) return;
    const now = ctx.currentTime;
    masterFilter.frequency.cancelScheduledValues(now);
    masterFilter.frequency.setValueAtTime(masterFilter.frequency.value, now);
    masterFilter.frequency.linearRampToValueAtTime(active ? 650 : 20000, now + 0.35);
  });
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!audioCtx) audioCtx = new AudioCtxClass();
  // 브라우저 자동재생 정책상 컨텍스트가 suspended 상태일 수 있음 — 이미 사용자가 게임에
  // 진입/조작한 뒤라 대부분 바로 resume되지만, 혹시 몰라 한 번 시도해준다.
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** 짧은 순음 하나(오실레이터 + 게인 램프)를 재생한다. 클릭 노이즈 방지를 위해 항상 짧게 램프업 후 지수 감쇠시킨다. */
function tone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  peakGain: number,
  type: OscType = "square"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(getMasterOutput(ctx));
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/** 주파수가 짧게 미끄러지는(슬라이드) 톤 — "삐용~" 류 효과에 사용 */
function sweep(
  ctx: AudioContext,
  fromFreq: number,
  toFreq: number,
  startTime: number,
  duration: number,
  peakGain: number,
  type: OscType = "sine"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), startTime + duration);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(getMasterOutput(ctx));
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/** 짧은 화이트노이즈 버스트 — 발소리/타격음처럼 "톡" 치는 질감에 사용 */
function noiseBurst(ctx: AudioContext, startTime: number, duration: number, peakGain: number, filterFreq = 1200) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peakGain, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterOutput(ctx));
  src.start(startTime);
  src.stop(startTime + duration + 0.02);
}

/** 오디오 재생 실패는 게임 진행에 영향을 주면 안 되므로 조용히 무시한다. */
function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // no-op
  }
}

/** 이동 중 재생하는 발소리. 매 프레임 호출해도 되도록 내부적으로 250ms 스로틀을 건다. */
export function playFootstep() {
  safe(() => {
    const now = Date.now();
    if (now - lastFootstepAt < 250) return;
    lastFootstepAt = now;
    const ctx = getCtx();
    if (!ctx) return;
    noiseBurst(ctx, ctx.currentTime, 0.05, 0.05, 900 + Math.random() * 300);
  });
}

/** 미니게임 성공 — 밝게 올라가는 2음 차임 */
export function playTaskSuccess() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    tone(ctx, 660, now, 0.12, 0.12, "triangle");
    tone(ctx, 990, now + 0.1, 0.18, 0.12, "triangle");
  });
}

/** 미니게임 실패/취소 — 짧게 미끄러지는 저음 */
export function playTaskFail() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    sweep(ctx, 320, 140, ctx.currentTime, 0.22, 0.1, "sawtooth");
  });
}

/** 처치 순간 — 둔탁한 타격 노이즈 + 낮게 떨어지는 스윕 */
export function playKill() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    noiseBurst(ctx, now, 0.08, 0.18, 500);
    sweep(ctx, 220, 60, now + 0.02, 0.3, 0.14, "sawtooth");
  });
}

/** 시신 신고 / 긴급 회의 소집 — 종소리 느낌의 2연타 */
export function playMeetingCall() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    tone(ctx, 520, now, 0.3, 0.14, "sine");
    tone(ctx, 520, now + 0.32, 0.3, 0.12, "sine");
  });
}

/** 투표 클릭 — 아주 짧은 UI 틱음 */
export function playVoteCast() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    tone(ctx, 800, ctx.currentTime, 0.05, 0.07, "square");
  });
}

/**
 * [Phase 1] 범용 UI 클릭음 — 능력 사용(보호/조사/기도 대상 선택), 코스메틱 장착처럼
 * "선택을 확정"하는 메뉴 조작에 공통으로 붙이는 아주 짧고 가벼운 틱음.
 * playVoteCast보다 한 톤 낮고 부드러워 투표처럼 무겁게 느껴지지 않는다.
 */
export function playUiClick() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    tone(ctx, 660, ctx.currentTime, 0.045, 0.05, "square");
  });
}

/** [Phase 1] 패널 접기/펼치기(미니맵 확대, 설정/코스메틱 아코디언) 공용 토글음. */
export function playPanelToggle(open: boolean) {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    tone(ctx, open ? 720 : 520, ctx.currentTime, 0.06, 0.05, "sine");
  });
}

/** 회의 결과 공개 — 추방이면 낮게 떨어지는 톤, 무효표면 중립음 */
export function playEjectResult(ejected: boolean) {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    if (ejected) sweep(ctx, 500, 90, ctx.currentTime, 0.6, 0.15, "sawtooth");
    else tone(ctx, 440, ctx.currentTime, 0.25, 0.1, "sine");
  });
}

/** [6-4] 시신을 처음 발견하는 순간의 긴장 스팅어 — 짧은 노이즈 임팩트 + 낮게 가라앉는 스윕.
 * playMeetingCall(종소리, 신고/소집 확정 시)과는 구분되는, "지금 뭔가 잘못됐다"는 즉각 반응이다. */
export function playBodyDiscovered() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    noiseBurst(ctx, now, 0.06, 0.16, 700);
    sweep(ctx, 260, 90, now + 0.03, 0.35, 0.12, "sine");
  });
}

/** 엘리베이터 탑승 — 위로 솟구쳤다 안착하는 느낌의 상승 스윕 + 도착 차임.
 * 양/늑대 모두 쓰는 이동 수단이라 킬/사보타지처럼 위협적이지 않고 경쾌하게 설계했다. */
export function playElevatorRide() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    sweep(ctx, 260, 920, now, 0.18, 0.12, "sine");
    tone(ctx, 740, now + 0.16, 0.14, 0.1, "triangle");
  });
}

/** 승리 — 밝은 3음 아르페지오 */
export function playWin() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => tone(ctx, f, now + i * 0.14, 0.22, 0.13, "triangle"));
  });
}

/** 패배 — 어둡게 가라앉는 하강 스윕 */
export function playLose() {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    sweep(ctx, 300, 80, ctx.currentTime, 0.7, 0.13, "sawtooth");
  });
}

/**
 * 사보타지 발동/해제 경고음 (정전·원자로·문 잠금 공통).
 * - "start": 높은 음(880Hz) 2연타 — 위급 상황을 알리는 경고음
 * - "end": 낮은 음(440Hz) 1회 — 상황 종료를 알리는 안정음
 */
export function playSabotageAlarm(type: "start" | "end") {
  safe(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (type === "start") {
      tone(ctx, 880, now, 0.12, 0.15, "square");
      tone(ctx, 880, now + 0.16, 0.12, 0.15, "square");
    } else {
      tone(ctx, 440, now, 0.18, 0.12, "square");
    }
  });
}