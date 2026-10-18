// The audio engine: owns the AudioContext, devices, mixer and transport.
// It reads the song through a getter at schedule time, so edits made while
// playing are heard on the very next step.

import acidWorkletUrl from './worklets/acid.worklet.ts?worker&url';
import { AcidSynth } from './acid-synth';
import { StepClock, Ticker } from './clock';
import { DrumMachine } from './drum-machine';
import { AcidTrack, DrumTrack } from './sequencer';
import type { DrumVoice, Song } from '../model/song';

const LOOKAHEAD_S = 0.12;

/**
 * Unity gain below 0.7 FS, then a smooth knee toward 0.95 FS. A WaveShaper maps
 * input -1..1 across the curve (and clamps beyond), so the curve spans exactly
 * that range; the ceiling leaves headroom for oversampling-filter overshoot.
 */
const SAFETY_CURVE = (() => {
  const curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= 0.7 ? a : 0.7 + 0.25 * Math.tanh((a - 0.7) / 0.25);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
})();
const TICK_MS = 25;

export interface Playhead {
  acid: { pos: number; pattern: number }[];
  drums: { pos: number; pattern: number }[];
}

interface QueuedPlayhead extends Playhead {
  time: number;
}

export class Engine {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private readonly masterIn: GainNode;
  private readonly masterGain: GainNode;
  private readonly acids: AcidSynth[];
  private readonly drums: DrumMachine[];
  private readonly acidTracks: AcidTrack[];
  private readonly drumTracks: DrumTrack[];
  private readonly clock = new StepClock();
  private readonly ticker = new Ticker(TICK_MS, () => this.schedule());
  private playheads: QueuedPlayhead[] = [];
  private current: Playhead | undefined;
  private _playing = false;

  private constructor(
    ctx: AudioContext,
    private readonly getSong: () => Song,
  ) {
    this.ctx = ctx;
    const song = getSong();

    // Master: glue compressor -> volume -> limiter -> soft clipper -> analyser -> out.
    // The compressor-based limiter has no lookahead, so the clipper catches transients.
    this.masterIn = ctx.createGain();
    const glue = new DynamicsCompressorNode(ctx, { threshold: -14, ratio: 2.5, knee: 8, attack: 0.01, release: 0.2 });
    this.masterGain = ctx.createGain();
    const limiter = new DynamicsCompressorNode(ctx, { threshold: -1.5, ratio: 20, knee: 0, attack: 0.002, release: 0.08 });
    const clipper = new WaveShaperNode(ctx, { curve: SAFETY_CURVE, oversample: '4x' });
    this.analyser = new AnalyserNode(ctx, { fftSize: 2048 });
    this.masterIn
      .connect(glue)
      .connect(this.masterGain)
      .connect(limiter)
      .connect(clipper)
      .connect(this.analyser)
      .connect(ctx.destination);

    this.acids = song.acids.map(() => {
      const synth = new AcidSynth(ctx);
      synth.output.connect(this.masterIn);
      return synth;
    });
    this.drums = song.drums.map(() => {
      const dm = new DrumMachine(ctx);
      dm.output.connect(this.masterIn);
      return dm;
    });
    this.acidTracks = song.acids.map(() => new AcidTrack());
    this.drumTracks = song.drums.map(() => new DrumTrack());
    this.sync(song);
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  static async create(getSong: () => Song): Promise<Engine> {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(acidWorkletUrl);
    await ctx.resume();
    return new Engine(ctx, getSong);
  }

  get playing(): boolean {
    return this._playing;
  }

  /** Push current knob values to the audio graph. */
  sync(song: Song): void {
    song.acids.forEach((d, i) => this.acids[i]?.sync(d));
    song.drums.forEach((d, i) => {
      const dm = this.drums[i];
      if (!dm) return;
      dm.setParams(d.params);
      const v = d.params.volume;
      dm.output.gain.setTargetAtTime(d.mute ? 0 : v * v, this.ctx.currentTime, 0.01);
    });
    const mv = song.master.volume;
    this.masterGain.gain.setTargetAtTime(mv * mv * 1.2, this.ctx.currentTime, 0.01);
  }

  play(): void {
    if (this._playing) return;
    void this.ctx.resume();
    this._playing = true;
    for (const t of this.acidTracks) t.reset();
    for (const t of this.drumTracks) t.reset();
    this.clock.start(this.ctx.currentTime + 0.05);
    this.schedule();
    this.ticker.start();
  }

  stop(): void {
    if (!this._playing) return;
    this._playing = false;
    this.ticker.stop();
    for (const a of this.acids) a.kill();
    for (const d of this.drums) d.cancelPending();
    this.playheads = [];
    this.current = undefined;
  }

  /** Latest playhead that has actually sounded; undefined when stopped. */
  playhead(): Playhead | undefined {
    const now = this.ctx.currentTime;
    while (this.playheads.length > 0 && this.playheads[0]!.time <= now) this.current = this.playheads.shift();
    return this.current;
  }

  liveNoteOn(device: number, midi: number): void {
    void this.ctx.resume();
    this.acids[device]?.liveOn(midi);
  }

  liveNoteOff(device: number, midi: number): void {
    this.acids[device]?.liveOff(midi);
  }

  triggerDrum(device: number, voice: DrumVoice, accent = false): void {
    void this.ctx.resume();
    this.drums[device]?.trigger(voice, this.ctx.currentTime, accent);
  }

  private schedule(): void {
    if (!this._playing) return;
    const song = this.getSong();
    const steps = this.clock.collect(this.ctx.currentTime + LOOKAHEAD_S, song.bpm, song.swing);
    for (const { time, duration } of steps) {
      song.acids.forEach((device, i) => {
        const track = this.acidTracks[i];
        const synth = this.acids[i];
        if (!track || !synth) return;
        for (const m of track.step(device, time, duration)) synth.send(m);
      });
      song.drums.forEach((device, i) => {
        const track = this.drumTracks[i];
        const dm = this.drums[i];
        if (!track || !dm) return;
        for (const hit of track.step(device, time)) dm.trigger(hit.voice, hit.time, hit.accent);
      });
      // Positions after stepping point one past the step that sounds at `time`.
      const back = (pos: number, len: number) => (pos - 1 + len) % len;
      this.playheads.push({
        time,
        acid: this.acidTracks.map((t, i) => {
          const pat = song.acids[i]!.patterns[t.playing]!;
          return { pos: back(t.pos, pat.length), pattern: t.playing };
        }),
        drums: this.drumTracks.map((t, i) => {
          const pat = song.drums[i]!.patterns[t.playing]!;
          return { pos: back(t.pos, pat.length), pattern: t.playing };
        }),
      });
    }
  }
}
