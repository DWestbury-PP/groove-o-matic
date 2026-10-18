// Musical randomizers: "happy accident" generators for casual users.
// They are biased toward idiomatic acid and dance-floor grooves rather
// than uniform noise, so most rolls sound usable.

import {
  DRUM_VOICES,
  STEPS,
  keyNotes,
  emptyDrumPattern,
  type AcidPattern,
  type AcidStep,
  type DrumPattern,
  type DrumVoice,
  type ScaleName,
} from './song';

export type Rng = () => number;

/** Small deterministic PRNG (mulberry32) so tests and shared seeds are reproducible. */
export const seededRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;

export const randomAcidPattern = (root: number, scale: ScaleName, rng: Rng = Math.random): AcidPattern => {
  const notes = keyNotes(root, scale);
  const steps: AcidStep[] = [];
  for (let i = 0; i < STEPS; i++) {
    const onBeat = i % 4 === 0;
    const gate = rng() < (onBeat ? 0.85 : 0.6);
    // The root dominates; other scale tones color the line.
    const note = rng() < 0.45 ? root : pick(rng, notes);
    const r = rng();
    const octave: -1 | 0 | 1 = r < 0.4 ? -1 : r < 0.85 ? 0 : 1;
    steps.push({ gate, note, octave, accent: gate && rng() < 0.28, slide: gate && rng() < 0.22 });
  }
  return { length: STEPS, steps };
};

/** Per-step hit probabilities for a four-on-the-floor-ish feel. */
const DRUM_ODDS: Record<DrumVoice, (i: number) => number> = {
  bd: (i) => (i % 4 === 0 ? 0.92 : i % 2 === 0 ? 0.08 : 0.06),
  sd: (i) => (i === 4 || i === 12 ? 0.55 : i % 2 === 1 ? 0.07 : 0.04),
  lt: (i) => (i % 2 === 1 ? 0.06 : 0.03),
  ht: (i) => (i % 2 === 1 ? 0.06 : 0.03),
  rs: (i) => (i % 4 === 3 ? 0.25 : 0.06),
  cp: (i) => (i === 4 || i === 12 ? 0.7 : 0.03),
  ch: (i) => (i % 4 === 2 ? 0.1 : 0.7),
  oh: (i) => (i % 4 === 2 ? 0.8 : 0.02),
};

export const randomDrumPattern = (rng: Rng = Math.random): DrumPattern => {
  const pattern = emptyDrumPattern();
  for (const voice of DRUM_VOICES) {
    for (let i = 0; i < STEPS; i++) pattern.tracks[voice][i] = rng() < DRUM_ODDS[voice](i);
  }
  // Open hats choke closed hats on the same step.
  for (let i = 0; i < STEPS; i++) if (pattern.tracks.oh[i]) pattern.tracks.ch[i] = false;
  for (let i = 0; i < STEPS; i++) pattern.accent[i] = i % 4 === 0 ? rng() < 0.6 : rng() < 0.12;
  return pattern;
};
