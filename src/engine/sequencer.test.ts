import { describe, expect, it } from 'vitest';
import { parseAcidPattern, parseDrumPattern } from '../model/notation';
import { newAcid, newDrums } from '../model/song';
import { AcidTrack, DrumTrack, GATE_FRACTION } from './sequencer';

const acidWith = (...patterns: string[]) => {
  const d = newAcid('t');
  patterns.forEach((p, i) => (d.patterns[i] = parseAcidPattern(p)));
  return d;
};

describe('AcidTrack', () => {
  it('plays gated steps with a gate-length note-off', () => {
    const t = new AcidTrack();
    const msgs = t.step(acidWith('C! .'), 1, 0.1);
    expect(msgs).toEqual([
      { type: 'on', time: 1, midi: 36, accent: true },
      { type: 'off', time: 1 + 0.1 * GATE_FRACTION },
    ]);
    expect(t.step(acidWith('C! .'), 1.1, 0.1)).toEqual([]);
  });

  it('slide holds the gate and glides into the next note', () => {
    const d = acidWith('C~ G^ .');
    const t = new AcidTrack();
    expect(t.step(d, 0, 0.1)).toEqual([{ type: 'on', time: 0, midi: 36, accent: false }]);
    expect(t.step(d, 0.1, 0.1)).toEqual([
      { type: 'glide', time: 0.1, midi: 55, accent: false },
      { type: 'off', time: 0.1 + 0.1 * GATE_FRACTION },
    ]);
  });

  it('slide into a rest closes the gate on the rest', () => {
    // Slide followed by a rest: no hold, so a normal note-off.
    const d = acidWith('C~ . C');
    const t = new AcidTrack();
    expect(t.step(d, 0, 0.1).map((m) => m.type)).toEqual(['on', 'off']);
    expect(t.step(d, 0.1, 0.1)).toEqual([]);
  });

  it('wraps at pattern length and slides across the loop point', () => {
    const d = acidWith('C D~');
    const t = new AcidTrack();
    t.step(d, 0, 0.1);
    expect(t.step(d, 0.1, 0.1).map((m) => m.type)).toEqual(['on']);
    expect(t.step(d, 0.2, 0.1)[0]).toMatchObject({ type: 'glide', midi: 36 });
  });

  it('cues pattern changes until the pattern boundary', () => {
    const d = acidWith('C C', 'D D');
    const t = new AcidTrack();
    t.step(d, 0, 0.1);
    d.current = 1;
    expect(t.step(d, 0.1, 0.1)[0]).toMatchObject({ midi: 36 });
    expect(t.playing).toBe(0);
    expect(t.step(d, 0.2, 0.1)[0]).toMatchObject({ midi: 38 });
    expect(t.playing).toBe(1);
  });

  it('mute silences and releases a held slide', () => {
    const d = acidWith('C~ C');
    const t = new AcidTrack();
    t.step(d, 0, 0.1);
    d.mute = true;
    expect(t.step(d, 0.1, 0.1)).toEqual([{ type: 'off', time: 0.1 }]);
  });
});

describe('DrumTrack', () => {
  it('emits hits with step accents and wraps at length', () => {
    const d = newDrums('t');
    d.patterns[0] = parseDrumPattern({ bd: 'X.x', ch: 'xx.', length: 3 });
    const t = new DrumTrack();
    expect(t.step(d, 0)).toEqual([
      { voice: 'bd', time: 0, accent: true },
      { voice: 'ch', time: 0, accent: true },
    ]);
    expect(t.step(d, 1)).toEqual([{ voice: 'ch', time: 1, accent: false }]);
    expect(t.step(d, 2)).toEqual([{ voice: 'bd', time: 2, accent: false }]);
    expect(t.step(d, 3)[0]).toMatchObject({ voice: 'bd', accent: true });
  });
});
