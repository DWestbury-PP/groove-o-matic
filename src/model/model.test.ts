import { describe, expect, it } from 'vitest';
import { DEMOS } from './demos';
import { parseAcidPattern, parseAcidStep, parseDrumPattern } from './notation';
import { isParamId, param } from './params';
import { randomAcidPattern, randomDrumPattern, seededRng } from './random';
import { songFromJson } from './serialize';
import { DRUM_VOICES, acidStepMidi, editorRows, inKey, keyNotes, newSong } from './song';

describe('notation', () => {
  it('parses notes, octaves and flags', () => {
    expect(parseAcidStep('A')).toEqual({ gate: true, note: 9, octave: 0, accent: false, slide: false });
    expect(parseAcidStep('D#^!~')).toEqual({ gate: true, note: 3, octave: 1, accent: true, slide: true });
    expect(parseAcidStep('Bbv')).toMatchObject({ note: 10, octave: -1 });
    expect(parseAcidStep('.')).toMatchObject({ gate: false });
    expect(acidStepMidi(parseAcidStep('Cb'))).toBe(35);
  });

  it('rejects junk', () => {
    expect(() => parseAcidStep('H')).toThrow();
    expect(() => parseAcidPattern(Array(17).fill('C').join(' '))).toThrow();
    expect(() => parseDrumPattern({ bd: 'x?..' })).toThrow();
  });

  it('pads short acid patterns and records their length', () => {
    const p = parseAcidPattern('C D E');
    expect(p.length).toBe(3);
    expect(p.steps).toHaveLength(16);
  });

  it('marks drum accents from capitals and the accent row', () => {
    const p = parseDrumPattern({ bd: 'X... x...', accent: '.... ....x' });
    expect(p.tracks.bd.slice(0, 5)).toEqual([true, false, false, false, true]);
    expect(p.accent[0]).toBe(true);
    expect(p.accent[4]).toBe(false);
    expect(p.accent[8]).toBe(true);
  });
});

describe('keys', () => {
  it('lists in-key notes across C..C', () => {
    expect(keyNotes(9, 'minor')).toEqual([0, 2, 4, 5, 7, 9, 11, 12]);
    expect(keyNotes(0, 'minorPentatonic')).toEqual([0, 3, 5, 7, 10, 12]);
  });

  it('shows off-key notes that are already in use', () => {
    const p = parseAcidPattern('C# A');
    expect(editorRows(9, 'minor', p)).toEqual([12, 11, 9, 7, 5, 4, 2, 1, 0]);
  });
});

describe('randomizers', () => {
  it('are deterministic for a seed', () => {
    expect(randomAcidPattern(9, 'minor', seededRng(7))).toEqual(randomAcidPattern(9, 'minor', seededRng(7)));
    expect(randomDrumPattern(seededRng(7))).toEqual(randomDrumPattern(seededRng(7)));
  });

  it('keep acid notes in key', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = randomAcidPattern(4, 'minorPentatonic', seededRng(seed));
      for (const s of p.steps) expect(inKey(4, 'minorPentatonic', s.note)).toBe(true);
    }
  });

  it('never stack open and closed hats on one step', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = randomDrumPattern(seededRng(seed));
      p.tracks.oh.forEach((oh, i) => expect(oh && p.tracks.ch[i]).toBe(false));
    }
  });
});

describe('params', () => {
  it('resolves and writes bound values', () => {
    const song = newSong();
    param('acid.0.cutoff').set(song, 0.9);
    expect(song.acids[0]!.params.cutoff).toBe(0.9);
    param('drums.0.oh.decay').set(song, 2);
    expect(song.drums[0]!.params.voices.oh.decay).toBe(1);
    expect(param('acid.0.tune').format(0.5 + 3 / 24)).toBe('+3');
  });

  it('rejects unknown ids', () => {
    expect(isParamId('acid.0.waveform')).toBe(false);
    expect(isParamId('drums.0.zz.level')).toBe(false);
    expect(() => param('nope')).toThrow();
  });
});

describe('serialize', () => {
  it('round-trips a demo song', () => {
    const song = DEMOS[0]!.build();
    expect(songFromJson(JSON.parse(JSON.stringify(song)))).toEqual(song);
  });

  it('repairs malformed input instead of throwing', () => {
    const s = songFromJson({ bpm: 9999, swing: 'x', acids: [{ params: { cutoff: -3 }, patterns: [{ steps: [{ note: 99, gate: true }] }] }] });
    expect(s.bpm).toBe(200);
    expect(s.swing).toBe(0);
    expect(s.acids[0]!.params.cutoff).toBe(0);
    expect(s.acids[0]!.patterns[0]!.steps[0]).toMatchObject({ gate: true, note: 12 });
    expect(s.drums).toHaveLength(1);
    expect(songFromJson(null)).toEqual(newSong());
  });
});

describe('demos', () => {
  it.each(DEMOS.map((d) => [d.name, d] as const))('%s builds a playable song', (_, demo) => {
    const song = demo.build();
    const acid = song.acids[0]!;
    expect(acid.patterns[0]!.steps.some((s) => s.gate)).toBe(true);
    expect(DRUM_VOICES.some((v) => song.drums[0]!.patterns[0]!.tracks[v].some(Boolean))).toBe(true);
    // Every demo note sits in the declared key, so nothing shows as off-key.
    for (const p of acid.patterns) for (const s of p.steps) if (s.gate) expect(inKey(acid.root, acid.scale, s.note)).toBe(true);
  });
});
