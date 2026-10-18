// Compact text notation for authoring patterns (demos, tests).
//
// Acid: space-separated tokens, one per step.
//   "."           rest
//   "C" "D#" "Bb" note (C..B; "C^" + octave up reaches the top key)
//   suffixes:     "^" octave up, "v" octave down, "!" accent, "~" slide
//   e.g. "Av Av! . C^~ D^ ."
//
// Drums: one string per voice, "x" hit, "X" hit + accent, "." rest; spaces ignored.
//   e.g. { bd: "x... x... x... x...", accent: "x... .... x... ...." }

import {
  DRUM_VOICES,
  emptyAcidStep,
  emptyDrumPattern,
  type AcidPattern,
  type AcidStep,
  type DrumPattern,
  type DrumVoice,
} from './song';

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const parseAcidStep = (token: string): AcidStep => {
  if (token === '.') return emptyAcidStep();
  const m = /^([A-G])([#b]?)([\^v!~]*)$/.exec(token);
  if (!m) throw new Error(`Bad acid token "${token}"`);
  const [, letter, accidental, mods] = m as unknown as [string, string, string, string];
  let note = NOTE_INDEX[letter]! + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  let octave: -1 | 0 | 1 = mods.includes('^') ? 1 : mods.includes('v') ? -1 : 0;
  // Fold Cb / B# into the 0..12 key range.
  if (note < 0) {
    note += 12;
    octave = (octave - 1) as -1 | 0 | 1;
  }
  return { gate: true, note, octave, accent: mods.includes('!'), slide: mods.includes('~') };
};

export const parseAcidPattern = (text: string): AcidPattern => {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length < 1 || tokens.length > 16) throw new Error(`Acid pattern needs 1..16 steps, got ${tokens.length}`);
  const steps = tokens.map(parseAcidStep);
  while (steps.length < 16) steps.push(emptyAcidStep());
  return { length: tokens.length, steps };
};

export type DrumNotation = Partial<Record<DrumVoice | 'accent', string>> & { length?: number };

export const parseDrumPattern = (spec: DrumNotation): DrumPattern => {
  const pattern = emptyDrumPattern();
  pattern.length = spec.length ?? 16;
  const parseRow = (row: string, onHit: (i: number, accent: boolean) => void): void => {
    const cells = row.replace(/\s+/g, '');
    if (cells.length > 16) throw new Error(`Drum row longer than 16 steps: "${row}"`);
    [...cells].forEach((c, i) => {
      if (c === 'x' || c === 'X') onHit(i, c === 'X');
      else if (c !== '.') throw new Error(`Bad drum cell "${c}" in "${row}"`);
    });
  };
  for (const voice of DRUM_VOICES) {
    const row = spec[voice];
    if (row)
      parseRow(row, (i, accent) => {
        pattern.tracks[voice][i] = true;
        if (accent) pattern.accent[i] = true;
      });
  }
  if (spec.accent) parseRow(spec.accent, (i) => (pattern.accent[i] = true));
  return pattern;
};
