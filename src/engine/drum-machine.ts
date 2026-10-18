// DM-9: synthesized drum voices built from Web Audio nodes per hit.
// No samples, so nothing to license; skins will later be able to swap any
// voice for a sample. Recipes follow the classic analog designs: pitch-swept
// sine kicks, tone+noise snares, burst claps, metallic square-cluster hats.

import { DRUM_VOICES, type DrumParams, type DrumVoice } from '../model/song';

interface Hit {
  sources: AudioScheduledSourceNode[];
  start: number;
}

/** Per-hit context: everything a voice recipe needs. */
interface VoiceCtx {
  ctx: AudioContext;
  t: number;
  vel: number;
  tune: number; // pitch multiplier
  decay: number; // 0..1
  out: AudioNode;
  noise: AudioBuffer;
  track(...sources: AudioScheduledSourceNode[]): void;
}

const HAT_RATIOS = [205.3, 304.4, 369.6, 522.7, 540, 800];

const env = (ctx: AudioContext, out: AudioNode, t: number, peak: number, tau: number, attack = 0.001): GainNode => {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0, t + attack, tau);
  g.connect(out);
  return g;
};

const noiseSource = (v: VoiceCtx, stopAt: number): AudioBufferSourceNode => {
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  src.start(v.t, Math.random());
  src.stop(stopAt);
  v.track(src);
  return src;
};

const tone = (v: VoiceCtx, type: OscillatorType, freq: number, stopAt: number): OscillatorNode => {
  const osc = v.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, v.t);
  osc.start(v.t);
  osc.stop(stopAt);
  v.track(osc);
  return osc;
};

const filter = (ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode => {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
};

const VOICES: Record<DrumVoice, (v: VoiceCtx) => void> = {
  bd: (v) => {
    const tau = 0.06 + v.decay * 0.35;
    const end = v.t + tau * 7;
    const f = 48 * v.tune;
    const osc = tone(v, 'sine', f * 4.5, end);
    osc.frequency.setTargetAtTime(f, v.t, 0.016);
    const shaper = v.ctx.createWaveShaper();
    shaper.curve = SOFT_CLIP;
    shaper.connect(env(v.ctx, v.out, v.t, v.vel * 1.1, tau, 0.0015));
    osc.connect(shaper);
    // Beater click
    const click = noiseSource(v, v.t + 0.02);
    click.connect(filter(v.ctx, 'highpass', 2500)).connect(env(v.ctx, v.out, v.t, v.vel * 0.35, 0.003));
  },
  sd: (v) => {
    const end = v.t + 0.6 + v.decay;
    for (const [f, amp] of [
      [180, 0.55],
      [330, 0.35],
    ] as const) {
      const osc = tone(v, 'triangle', f * 1.4 * v.tune, end);
      osc.frequency.setTargetAtTime(f * v.tune, v.t, 0.01);
      osc.connect(env(v.ctx, v.out, v.t, v.vel * amp, 0.045));
    }
    const n = noiseSource(v, end);
    n.connect(filter(v.ctx, 'highpass', 1800 * v.tune)).connect(
      env(v.ctx, v.out, v.t, v.vel * 0.6, 0.04 + v.decay * 0.14),
    );
  },
  lt: (v) => tom(v, 95),
  ht: (v) => tom(v, 150),
  rs: (v) => {
    const end = v.t + 0.1;
    const bp = filter(v.ctx, 'bandpass', 1700 * v.tune, 2);
    bp.connect(env(v.ctx, v.out, v.t, v.vel * 1.2, 0.008 + v.decay * 0.02));
    tone(v, 'triangle', 480 * v.tune, end).connect(bp);
    tone(v, 'square', 1650 * v.tune, end).connect(bp);
  },
  cp: (v) => {
    const tail = 0.05 + v.decay * 0.25;
    const end = v.t + 0.04 + tail * 7;
    const n = noiseSource(v, end);
    const g = v.ctx.createGain();
    const gain = g.gain;
    gain.setValueAtTime(0, v.t);
    // Three tight bursts, then the reverberant tail
    for (const offset of [0, 0.011, 0.022]) {
      gain.setValueAtTime(v.vel, v.t + offset);
      gain.setTargetAtTime(0.05 * v.vel, v.t + offset, 0.003);
    }
    gain.setValueAtTime(v.vel * 0.9, v.t + 0.032);
    gain.setTargetAtTime(0, v.t + 0.032, tail);
    n.connect(filter(v.ctx, 'bandpass', 1100 * v.tune, 1.2)).connect(g).connect(v.out);
  },
  ch: (v) => hat(v, 0.012 + v.decay * 0.05),
  oh: (v) => hat(v, 0.08 + v.decay * 0.45),
};

const tom = (v: VoiceCtx, base: number): void => {
  const tau = 0.08 + v.decay * 0.3;
  const end = v.t + tau * 7;
  const osc = tone(v, 'sine', base * 1.6 * v.tune, end);
  osc.frequency.setTargetAtTime(base * v.tune, v.t, 0.03);
  osc.connect(env(v.ctx, v.out, v.t, v.vel * 0.9, tau));
  noiseSource(v, v.t + 0.05)
    .connect(filter(v.ctx, 'bandpass', base * 8 * v.tune, 1))
    .connect(env(v.ctx, v.out, v.t, v.vel * 0.15, 0.01));
};

const hat = (v: VoiceCtx, tau: number): GainNode => {
  const end = v.t + tau * 8;
  const bp = filter(v.ctx, 'bandpass', 10000 * v.tune, 0.8);
  const hp = filter(v.ctx, 'highpass', 7000 * v.tune);
  const out = env(v.ctx, v.out, v.t, v.vel * 0.55, tau);
  bp.connect(hp).connect(out);
  for (const f of HAT_RATIOS) tone(v, 'square', f * 1.7 * v.tune, end).connect(bp);
  noiseSource(v, end)
    .connect(filter(v.ctx, 'highpass', 8000))
    .connect(env(v.ctx, v.out, v.t, v.vel * 0.25, tau * 0.8));
  return out;
};

const SOFT_CLIP = (() => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  return curve;
})();

const makeNoise = (ctx: AudioContext): AudioBuffer => {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
};

export class DrumMachine {
  /** Bus output; connect to a mixer channel. */
  readonly output: GainNode;
  private readonly voiceGains: Record<DrumVoice, GainNode>;
  private readonly noise: AudioBuffer;
  private hits: Hit[] = [];
  private openHat: GainNode | undefined;
  private params: DrumParams | undefined;

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain();
    this.noise = makeNoise(ctx);
    this.voiceGains = Object.fromEntries(
      DRUM_VOICES.map((v) => {
        const g = ctx.createGain();
        g.connect(this.output);
        return [v, g];
      }),
    ) as Record<DrumVoice, GainNode>;
  }

  setParams(params: DrumParams): void {
    this.params = params;
    const now = this.ctx.currentTime;
    for (const v of DRUM_VOICES) {
      const level = params.voices[v].level;
      this.voiceGains[v].gain.setTargetAtTime(level * level * 0.9, now, 0.01);
    }
  }

  trigger(voice: DrumVoice, time: number, accent: boolean): void {
    const p = this.params;
    if (!p) return;
    const vp = p.voices[voice];
    const t = Math.max(time, this.ctx.currentTime);
    // Each hit gets its own gain so a closed hat can choke a ringing open hat.
    const hitOut = this.ctx.createGain();
    hitOut.connect(this.voiceGains[voice]);
    const hit: Hit = { sources: [], start: t };
    VOICES[voice]({
      ctx: this.ctx,
      t,
      vel: accent ? 1 : 1 - 0.5 * p.accent,
      tune: Math.pow(2, (vp.tune - 0.5) * 1.2),
      decay: vp.decay,
      out: hitOut,
      noise: this.noise,
      track: (...s) => hit.sources.push(...s),
    });
    if (voice === 'ch' || voice === 'oh') {
      this.openHat?.gain.setTargetAtTime(0, t, 0.004);
      this.openHat = voice === 'oh' ? hitOut : undefined;
    }
    let live = hit.sources.length;
    for (const s of hit.sources) s.onended = () => --live === 0 && hitOut.disconnect();
    this.hits.push(hit);
    this.prune();
  }

  /** Cancel hits scheduled in the future (used on stop). */
  cancelPending(): void {
    const now = this.ctx.currentTime;
    for (const hit of this.hits) if (hit.start > now) for (const s of hit.sources) s.stop();
    this.hits = [];
    this.openHat = undefined;
  }

  private prune(): void {
    const cutoff = this.ctx.currentTime - 0.5;
    if (this.hits.length > 256) this.hits = this.hits.filter((h) => h.start > cutoff);
  }
}
