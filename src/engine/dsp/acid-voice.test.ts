import { describe, expect, it } from 'vitest';
import { AcidVoice, type AcidVoiceParams } from './acid-voice';

const SR = 48000;
const BLOCK = 128;

const params = (over: Partial<AcidVoiceParams> = {}): AcidVoiceParams => ({
  tune: 0,
  cutoff: 0.4,
  resonance: 0.7,
  envMod: 0.6,
  decay: 0.4,
  accent: 0.6,
  drive: 0.2,
  waveform: 0,
  ...over,
});

/** Render `seconds` of audio into one buffer. */
const render = (voice: AcidVoice, seconds: number, p: AcidVoiceParams, from = 0): Float32Array => {
  const blocks = Math.ceil((seconds * SR) / BLOCK);
  const out = new Float32Array(blocks * BLOCK);
  for (let b = 0; b < blocks; b++) voice.render(out.subarray(b * BLOCK, (b + 1) * BLOCK), from + b * BLOCK, p);
  return out;
};

const rms = (buf: Float32Array, from = 0, to = buf.length): number => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += buf[i]! * buf[i]!;
  return Math.sqrt(sum / Math.max(1, to - from));
};

describe('AcidVoice', () => {
  it('is silent with no notes', () => {
    const out = render(new AcidVoice(SR), 0.1, params());
    expect(rms(out)).toBe(0);
  });

  it('sounds after note-on and falls silent after note-off', () => {
    const v = new AcidVoice(SR);
    v.schedule({ frame: 0, type: 'on', midi: 45, accent: false });
    v.schedule({ frame: SR * 0.1, type: 'off' });
    const out = render(v, 0.3, params());
    expect(rms(out, 0, SR * 0.1)).toBeGreaterThan(0.02);
    expect(rms(out, SR * 0.2, SR * 0.3)).toBeLessThan(0.001);
  });

  it('stays finite and bounded across extreme settings', () => {
    for (const p of [
      params({ cutoff: 1, resonance: 1, envMod: 1, accent: 1, drive: 1 }),
      params({ cutoff: 0, resonance: 1, envMod: 0, drive: 0 }),
      params({ cutoff: 1, resonance: 0, waveform: 1, tune: 24 }),
    ]) {
      const v = new AcidVoice(SR);
      for (let i = 0; i < 8; i++) v.schedule({ frame: i * 6000, type: 'on', midi: 24 + i * 7, accent: i % 2 === 0 });
      const out = render(v, 1, p);
      for (const s of out) {
        expect(Number.isFinite(s)).toBe(true);
        expect(Math.abs(s)).toBeLessThan(2);
      }
    }
  });

  it('accent makes a note louder', () => {
    const level = (accent: boolean) => {
      const v = new AcidVoice(SR);
      v.schedule({ frame: 0, type: 'on', midi: 45, accent });
      return rms(render(v, 0.1, params({ drive: 0 })));
    };
    expect(level(true)).toBeGreaterThan(level(false) * 1.2);
  });

  it('glide changes pitch without retriggering the filter envelope', () => {
    // With envMod up and a short decay, a retrigger would produce a fresh bright
    // burst; a glide should stay as dark as the decayed tail.
    const p = params({ envMod: 1, decay: 0, cutoff: 0.1, resonance: 0.2, drive: 0 });
    const tailLevel = (type: 'on' | 'glide') => {
      const v = new AcidVoice(SR);
      v.schedule({ frame: 0, type: 'on', midi: 45, accent: false });
      v.schedule({ frame: SR * 0.5, type, midi: 45, accent: false });
      const out = render(v, 0.6, p);
      // High-frequency content right after the event: first difference RMS.
      const d = new Float32Array(SR * 0.03);
      for (let i = 0; i < d.length; i++) d[i] = out[SR * 0.5 + i + 1]! - out[SR * 0.5 + i]!;
      return rms(d);
    };
    expect(tailLevel('on')).toBeGreaterThan(tailLevel('glide') * 1.5);
  });

  it('applies events at the right sample', () => {
    const v = new AcidVoice(SR);
    v.schedule({ frame: 1000, type: 'on', midi: 45, accent: false });
    const out = render(v, 0.05, params());
    expect(rms(out, 0, 1000)).toBe(0);
    expect(rms(out, 1000, 2000)).toBeGreaterThan(0);
  });

  it('kill silences immediately and drops pending events', () => {
    const v = new AcidVoice(SR);
    v.schedule({ frame: 0, type: 'on', midi: 45, accent: false });
    v.schedule({ frame: 20000, type: 'on', midi: 45, accent: false });
    render(v, 0.05, params());
    v.schedule({ frame: 2400, type: 'kill' });
    expect(v.pendingEvents).toBe(1);
    const out = render(v, 0.5, params(), 2400);
    expect(rms(out, BLOCK * 4)).toBeLessThan(0.001);
  });
});
