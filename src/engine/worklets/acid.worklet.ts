// AudioWorklet shell around AcidVoice. Knobs arrive as AudioParams (smoothed
// on the main thread with setTargetAtTime); notes arrive as timestamped port
// messages and are converted to frames for sample-accurate playback.

import { AcidVoice } from '../dsp/acid-voice';
import { ACID_PARAM_NAMES, type AcidMessage } from '../acid-messages';

declare const sampleRate: number;
declare const currentFrame: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

class AcidProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return ACID_PARAM_NAMES.map((name) => ({
      name,
      defaultValue: name === 'tune' || name === 'waveform' ? 0 : 0.5,
      minValue: name === 'tune' ? -24 : 0,
      maxValue: name === 'tune' ? 24 : 1,
      automationRate: 'k-rate',
    }));
  }

  private readonly voice = new AcidVoice(sampleRate);

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<AcidMessage>) => {
      const m = e.data;
      const frame = Math.round(m.time * sampleRate);
      if (m.type === 'on' || m.type === 'glide') this.voice.schedule({ frame, type: m.type, midi: m.midi, accent: m.accent });
      else this.voice.schedule({ frame, type: m.type });
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const channels = outputs[0];
    const out = channels?.[0];
    if (!channels || !out) return true;
    const p = (name: string): number => parameters[name]?.[0] ?? 0;
    this.voice.render(out, currentFrame, {
      tune: p('tune'),
      cutoff: p('cutoff'),
      resonance: p('resonance'),
      envMod: p('envMod'),
      decay: p('decay'),
      accent: p('accent'),
      drive: p('drive'),
      waveform: p('waveform'),
    });
    for (let c = 1; c < channels.length; c++) channels[c]!.set(out);
    return true;
  }
}

registerProcessor('acid-voice', AcidProcessor);
