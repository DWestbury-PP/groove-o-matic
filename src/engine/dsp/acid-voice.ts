// Monophonic acid bass voice: the DSP core behind the AS-1.
//
// Signal path: polyBLEP saw/square -> 4-pole resonant ladder (2x oversampled,
// tanh-limited input, high-passed resonance feedback so the low end survives
// high resonance, as on the original diode ladder) -> VCA -> drive -> DC block.
//
// The character comes from how the envelopes interact:
//   - Filter env decay follows the Decay knob, except accented notes, which
//     always use a short decay.
//   - Accent adds VCA level and a smoothed "accent sweep" to the cutoff; it
//     charges up across consecutive accents for the classic rising wow.
//   - Slide holds the gate and glides pitch without retriggering envelopes.
//
// Pure TypeScript with no Web Audio dependency, so it is unit-testable and
// shared verbatim by the AudioWorklet shell.

export type AcidEvent =
  | { frame: number; type: 'on'; midi: number; accent: boolean }
  | { frame: number; type: 'glide'; midi: number; accent: boolean }
  | { frame: number; type: 'off' }
  | { frame: number; type: 'kill' };

export interface AcidVoiceParams {
  /** Semitone offset. */
  tune: number;
  /** Normalized 0..1 knob values. */
  cutoff: number;
  resonance: number;
  envMod: number;
  decay: number;
  accent: number;
  drive: number;
  /** 0 = saw, 1 = square. */
  waveform: number;
}

const TAU = Math.PI * 2;

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** One-pole smoothing coefficient for a time constant in seconds. */
const coef = (seconds: number, sr: number): number => 1 - Math.exp(-1 / Math.max(1e-6, seconds * sr));

const polyBlep = (t: number, dt: number): number => {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
};

export class AcidVoice {
  private readonly sr: number;
  private readonly events: AcidEvent[] = [];

  // Oscillator / pitch
  private phase = 0;
  private freq = 65.4;
  private targetFreq = 65.4;
  private gliding = false;
  private readonly glideCoef: number;

  // Envelopes
  private gate = false;
  private amp = 0;
  private sustain = 1;
  private fenv = 0;
  private accented = false;
  private accentSweep = 0;
  private readonly attackCoef: number;
  private readonly releaseCoef: number;
  private readonly sustainDecay: number;
  private readonly accentChargeCoef: number;

  // Filter (4 stages + feedback high-pass), DC blocker
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;
  private fbHp = 0;
  private readonly fbHpCoef: number;
  private dcX = 0;
  private dcY = 0;

  // Per-block parameter interpolation (k-rate params arrive once per block)
  private last: AcidVoiceParams | undefined;

  constructor(sampleRate: number) {
    this.sr = sampleRate;
    this.glideCoef = coef(0.018, sampleRate);
    this.attackCoef = coef(0.0015, sampleRate);
    this.releaseCoef = coef(0.006, sampleRate);
    this.sustainDecay = Math.exp(-1 / (3.5 * sampleRate));
    this.accentChargeCoef = coef(0.03, sampleRate);
    this.fbHpCoef = coef(1 / (TAU * 110), sampleRate * 2);
  }

  /** Queue an event; events may arrive out of order. */
  schedule(event: AcidEvent): void {
    if (event.type === 'kill') {
      this.events.length = 0;
    }
    let i = this.events.length;
    while (i > 0 && this.events[i - 1]!.frame > event.frame) i--;
    this.events.splice(i, 0, event);
  }

  get pendingEvents(): number {
    return this.events.length;
  }

  private apply(e: AcidEvent): void {
    switch (e.type) {
      case 'on':
        this.targetFreq = midiToHz(e.midi);
        this.freq = this.targetFreq;
        this.gliding = false;
        this.gate = true;
        this.sustain = 1;
        this.fenv = 1;
        this.accented = e.accent;
        break;
      case 'glide':
        this.targetFreq = midiToHz(e.midi);
        this.gliding = true;
        // A glide arriving at a released voice behaves like a fresh note.
        if (!this.gate) {
          this.gate = true;
          this.sustain = 1;
          this.fenv = 1;
        }
        this.accented = e.accent;
        break;
      case 'off':
        this.gate = false;
        break;
      case 'kill':
        this.gate = false;
        this.amp = 0;
        this.fenv = 0;
        this.accentSweep = 0;
        break;
    }
  }

  /**
   * Render one block. `frame0` is the absolute frame of out[0]; events whose
   * frame falls inside the block are applied sample-accurately.
   */
  render(out: Float32Array, frame0: number, params: AcidVoiceParams): void {
    const prev = this.last ?? params;
    this.last = { ...params };
    const n = out.length;
    const sr = this.sr;
    const fs2 = sr * 2;
    const tuneMul = Math.pow(2, params.tune / 12);
    const square = params.waveform >= 0.5;

    const normalDecay = 0.04 * Math.pow(15, params.decay);
    const normalCoef = Math.exp(-1 / (normalDecay * sr));
    const accentCoefEnv = Math.exp(-1 / (0.05 * sr));
    const accentAmt = params.accent;
    const drive = params.drive;
    const driveGain = 1 + 30 * drive * drive;
    const driveMix = Math.min(1, drive * 4);

    for (let i = 0; i < n; i++) {
      while (this.events.length > 0 && this.events[0]!.frame <= frame0 + i) this.apply(this.events.shift()!);

      const t = n > 1 ? i / (n - 1) : 1;
      const cutoff = prev.cutoff + (params.cutoff - prev.cutoff) * t;
      const resonance = prev.resonance + (params.resonance - prev.resonance) * t;
      const envMod = prev.envMod + (params.envMod - prev.envMod) * t;

      // Pitch
      if (this.gliding) this.freq += (this.targetFreq - this.freq) * this.glideCoef;
      const f = this.freq * tuneMul;
      const dt = f / sr;
      this.phase += dt;
      if (this.phase >= 1) this.phase -= 1;
      let osc: number;
      if (square) {
        osc = this.phase < 0.5 ? 1 : -1;
        osc += polyBlep(this.phase, dt);
        osc -= polyBlep((this.phase + 0.5) % 1, dt);
      } else {
        osc = 2 * this.phase - 1 - polyBlep(this.phase, dt);
      }

      // Envelopes
      this.fenv *= this.accented ? accentCoefEnv : normalCoef;
      const accentTarget = this.accented ? this.fenv * accentAmt : 0;
      this.accentSweep += (accentTarget - this.accentSweep) * this.accentChargeCoef;
      if (this.gate) this.sustain *= this.sustainDecay;
      const ampTarget = this.gate ? this.sustain * (this.accented ? 1 + accentAmt * 0.8 : 1) : 0;
      this.amp += (ampTarget - this.amp) * (this.gate ? this.attackCoef : this.releaseCoef);

      // Filter cutoff: knob base, plus env mod and accent sweep in octaves
      const base = 50 * Math.pow(2, cutoff * 6.6);
      const octaves = (0.3 + envMod * 4.2) * this.fenv + this.accentSweep * 2.6;
      const fc = Math.min(base * Math.pow(2, octaves), 0.45 * sr, 18000);
      const g = 1 - Math.exp((-TAU * fc) / fs2);
      const k = resonance * 4.3;

      // 2x oversampled ladder (zero-order-hold upsample)
      const input = osc * 0.9;
      for (let os = 0; os < 2; os++) {
        this.fbHp += (this.s3 - this.fbHp) * this.fbHpCoef;
        const x = Math.tanh(input - k * (this.s3 - this.fbHp));
        this.s0 += g * (x - this.s0);
        this.s1 += g * (this.s0 - this.s1);
        this.s2 += g * (this.s1 - this.s2);
        this.s3 += g * (this.s2 - this.s3);
      }

      let y = this.s3 * this.amp * 0.8;
      if (driveMix > 0) y += (Math.tanh(y * driveGain) * 0.45 - y) * driveMix;

      // DC blocker
      const dc = y - this.dcX + 0.995 * this.dcY;
      this.dcX = y;
      this.dcY = dc;
      out[i] = dc;
    }
  }
}
