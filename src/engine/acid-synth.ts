// Main-thread handle for one AS-1 voice: the worklet node plus its channel gain.

import { ACID_PARAM_NAMES, type AcidMessage } from './acid-messages';
import { tuneToSemitones, type AcidDevice } from '../model/song';

export class AcidSynth {
  readonly output: GainNode;
  private readonly node: AudioWorkletNode;
  /** Live keyboard notes held, most recent last (mono, last-note priority). */
  private liveKeys: number[] = [];

  constructor(private readonly ctx: AudioContext) {
    this.node = new AudioWorkletNode(ctx, 'acid-voice', { numberOfInputs: 0, outputChannelCount: [1] });
    this.output = ctx.createGain();
    this.node.connect(this.output);
  }

  send(message: AcidMessage): void {
    this.node.port.postMessage(message);
  }

  sync(device: AcidDevice): void {
    const now = this.ctx.currentTime;
    const p = device.params;
    const values: Record<(typeof ACID_PARAM_NAMES)[number], number> = {
      tune: tuneToSemitones(p.tune),
      cutoff: p.cutoff,
      resonance: p.resonance,
      envMod: p.envMod,
      decay: p.decay,
      accent: p.accent,
      drive: p.drive,
      waveform: p.waveform === 'square' ? 1 : 0,
    };
    for (const name of ACID_PARAM_NAMES) {
      const param = this.node.parameters.get(name);
      if (!param) continue;
      if (name === 'tune' || name === 'waveform') param.setValueAtTime(values[name], now);
      else param.setTargetAtTime(values[name], now, 0.008);
    }
    // Make-up gain balances the voice against the drum bus (measured in-browser).
    const gain = device.mute ? 0 : p.volume * p.volume * 2.4;
    this.output.gain.setTargetAtTime(gain, now, 0.01);
  }

  liveOn(midi: number, accent = false): void {
    const time = this.ctx.currentTime;
    this.liveKeys = this.liveKeys.filter((k) => k !== midi);
    this.liveKeys.push(midi);
    this.send({ type: this.liveKeys.length > 1 ? 'glide' : 'on', time, midi, accent });
  }

  liveOff(midi: number): void {
    const time = this.ctx.currentTime;
    this.liveKeys = this.liveKeys.filter((k) => k !== midi);
    const prev = this.liveKeys[this.liveKeys.length - 1];
    if (prev === undefined) this.send({ type: 'off', time });
    else this.send({ type: 'glide', time, midi: prev, accent: false });
  }

  kill(): void {
    this.liveKeys = [];
    this.send({ type: 'kill', time: this.ctx.currentTime });
  }
}
