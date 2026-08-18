/**
 * '바리새인을 찾아라' 전용 사운드 엔진.
 *
 * 외부 mp3/wav 파일을 두지 않고 Web Audio API 오실레이터로 직접 합성한다.
 * 교회 공동체 게임이라는 테마에 맞춰 종/차임 계열 음색을 기본으로 하고,
 * 바리새인 승리처럼 어두운 이벤트에는 낮은 톱니파 화음을 섞어 대비를 준다.
 *
 * 브라우저 오디오 정책상 AudioContext는 사용자 제스처(클릭) 안에서 최초 생성/resume
 * 되어야 하므로, 각 버튼 onClick 핸들러 초입에서 soundEngine.unlock()을 호출해두면
 * 이후 phase-change 등 비-클릭 이벤트로 발생하는 play() 호출도 정상적으로 소리가 난다.
 */

type SoundName =
  | "nightStart"
  | "nightStep"
  | "dayStart"
  | "voteStart"
  | "eliminate"
  | "save"
  | "tie"
  | "lastWords"
  | "winCitizen"
  | "winPharisee"
  | "reaction"
  | "click";

const MUTE_KEY = "pharisee_sound_muted";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;

  constructor() {
    try {
      this._muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this._muted = false;
    }
  }

  get muted() {
    return this._muted;
  }

  setMuted(v: boolean) {
    this._muted = v;
    try {
      localStorage.setItem(MUTE_KEY, v ? "1" : "0");
    } catch {
      /* 저장 실패해도 무음 처리 자체는 계속 동작해야 하므로 무시 */
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(v ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /** 사용자 제스처(버튼 클릭 등) 핸들러 안에서 호출할 것 */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : 0.9;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) this.unlock();
    return this.ctx;
  }

  /** 단일 톤. overtone을 주면 2배음을 살짝 얹어 종/차임 특유의 울림을 낸다. */
  private tone(
    freq: number,
    t0: number,
    dur: number,
    opts: { type?: "sine" | "square" | "sawtooth" | "triangle" | "custom"; peak?: number; overtone?: boolean } = {}
  ) {
    const ctx = this.ctx!;
    const peak = opts.peak ?? 0.22;

    const gain = ctx.createGain();
    gain.connect(this.masterGain!);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const osc = ctx.createOscillator();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);

    if (opts.overtone) {
      const gain2 = ctx.createGain();
      gain2.connect(this.masterGain!);
      gain2.gain.setValueAtTime(0, t0);
      gain2.gain.linearRampToValueAtTime(peak * 0.35, t0 + 0.015);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 2.01, t0); // 살짝 어긋난 2배음 = 종소리 특유의 맥놀이
      osc2.connect(gain2);
      osc2.start(t0);
      osc2.stop(t0 + dur * 0.6 + 0.05);
    }
  }

  /** 짧은 노이즈 버스트 — 승리 팡파레에 살짝 섞는 타악기성 질감 */
  private noiseBurst(t0: number, dur: number, peak = 0.12) {
    const ctx = this.ctx!;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(gain);
    gain.connect(this.masterGain!);
    src.start(t0);
  }

  play(name: SoundName) {
    if (this._muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime + 0.02;

    switch (name) {
      case "nightStart":
        // 낮은 타종 두 번 — 밤의 시작을 알리는 무거운 종소리
        this.tone(146.83, t, 1.6, { peak: 0.3, overtone: true }); // D3
        this.tone(110, t + 0.35, 1.9, { peak: 0.24, overtone: true }); // A2
        break;

      case "nightStep":
        // 밤 순서가 다음 직업으로 넘어갈 때 나는 아주 작은 유리종 소리 — 긴장감을 깨지 않을 정도로만
        this.tone(880, t, 0.35, { peak: 0.09, overtone: true });
        break;

      case "dayStart":
        // 밝은 상승 아르페지오 — 아침이 밝았음
        [523.25, 659.25, 783.99].forEach((f, i) =>
          this.tone(f, t + i * 0.09, 0.9, { peak: 0.2, overtone: true })
        );
        break;

      case "voteStart":
        // 짧은 클릭성 신호음 두 번 — 투표 시작 알림
        this.tone(880, t, 0.15, { type: "square", peak: 0.07 });
        this.tone(880, t + 0.18, 0.18, { type: "square", peak: 0.07 });
        break;

      case "eliminate":
        // 떨어지는 조종(弔鐘) — 출교/사망 알림
        this.tone(392, t, 0.5, { peak: 0.22, overtone: true });
        this.tone(261.63, t + 0.28, 1.3, { peak: 0.26, overtone: true });
        break;

      case "save":
        // 부드럽게 상승하는 하프 느낌 — 보호받아 생존
        [392, 493.88, 587.33, 783.99].forEach((f, i) =>
          this.tone(f, t + i * 0.07, 0.5, { peak: 0.13 })
        );
        break;

      case "tie":
        this.tone(440, t, 0.4, { peak: 0.14 });
        break;

      case "lastWords":
        this.tone(220, t, 1.1, { peak: 0.2, overtone: true });
        break;

      case "winCitizen":
        // 밝은 장조 팡파레
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone(f, t + i * 0.12, 1.0, { peak: 0.22, overtone: true })
        );
        this.noiseBurst(t, 0.25, 0.05);
        break;

      case "winPharisee":
        // 어둡고 낮은 화음 — 바리새인 승리
        [174.61, 207.65, 261.63].forEach((f) =>
          this.tone(f, t, 2.2, { type: "sawtooth", peak: 0.08 })
        );
        break;

      case "reaction":
        this.tone(1046.5, t, 0.12, { peak: 0.07 });
        break;

      case "click":
        this.tone(660, t, 0.08, { type: "square", peak: 0.05 });
        break;
    }
  }
}

/** 방 하나당 하나면 충분하므로 모듈 싱글턴으로 둔다 */
export const soundEngine = new SoundEngine();
export type { SoundName };