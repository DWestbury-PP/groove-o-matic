// The song is the single source of truth: plain, JSON-serializable data.
// The engine reads it at schedule time; the UI renders it; demos, sharing
// and (later) skins all speak this format.

export const STEPS = 16;
export const PATTERN_SLOTS = 8;
export const SONG_VERSION = 1;

/** MIDI note played by key C at octave 0 (C2, ~65 Hz). */
export const ACID_BASE_MIDI = 36;

export type Waveform = 'saw' | 'square';

export interface AcidStep {
  gate: boolean;
  /** Semitones above C, 0..12 (the 13 keys C..C). */
  note: number;
  octave: -1 | 0 | 1;
  accent: boolean;
  /** Hold the gate and glide into the next step's note. */
  slide: boolean;
}

export interface AcidPattern {
  length: number;
  steps: AcidStep[];
}

/** All continuous params are normalized 0..1. */
export interface AcidParams {
  tune: number;
  cutoff: number;
  resonance: number;
  envMod: number;
  decay: number;
  accent: number;
  drive: number;
  volume: number;
  waveform: Waveform;
}

export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minorPentatonic: [0, 3, 5, 7, 10],
} as const satisfies Record<string, readonly number[]>;

export type ScaleName = keyof typeof SCALES;

export interface AcidDevice {
  name: string;
  params: AcidParams;
  patterns: AcidPattern[];
  /** Selected pattern: edited in the UI, cued to play at the next pattern boundary. */
  current: number;
  /** Key (0 = C .. 11 = B) and scale the editor and randomizer are locked to. */
  root: number;
  scale: ScaleName;
  mute: boolean;
}

export const DRUM_VOICES = ['bd', 'sd', 'lt', 'ht', 'rs', 'cp', 'ch', 'oh'] as const;
export type DrumVoice = (typeof DRUM_VOICES)[number];

export const DRUM_VOICE_LABELS: Record<DrumVoice, string> = {
  bd: 'Kick',
  sd: 'Snare',
  lt: 'Low Tom',
  ht: 'Hi Tom',
  rs: 'Rim',
  cp: 'Clap',
  ch: 'Closed Hat',
  oh: 'Open Hat',
};

export interface DrumPattern {
  length: number;
  tracks: Record<DrumVoice, boolean[]>;
  accent: boolean[];
}

export interface DrumVoiceParams {
  level: number;
  tune: number;
  decay: number;
}

export interface DrumParams {
  voices: Record<DrumVoice, DrumVoiceParams>;
  accent: number;
  volume: number;
}

export interface DrumDevice {
  name: string;
  params: DrumParams;
  patterns: DrumPattern[];
  current: number;
  mute: boolean;
}

export interface Song {
  version: typeof SONG_VERSION;
  name: string;
  bpm: number;
  /** 0 = straight, 1 = heavy shuffle (75%). */
  swing: number;
  master: { volume: number };
  acids: AcidDevice[];
  drums: DrumDevice[];
}

export const BPM_MIN = 60;
export const BPM_MAX = 200;

const filled = <T>(n: number, make: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => make(i));

export const emptyAcidStep = (): AcidStep => ({ gate: false, note: 0, octave: 0, accent: false, slide: false });

export const emptyAcidPattern = (): AcidPattern => ({ length: STEPS, steps: filled(STEPS, emptyAcidStep) });

export const emptyDrumPattern = (): DrumPattern => ({
  length: STEPS,
  tracks: Object.fromEntries(DRUM_VOICES.map((v) => [v, filled(STEPS, () => false)])) as Record<
    DrumVoice,
    boolean[]
  >,
  accent: filled(STEPS, () => false),
});

export const defaultAcidParams = (): AcidParams => ({
  tune: 0.5,
  cutoff: 0.35,
  resonance: 0.7,
  envMod: 0.55,
  decay: 0.4,
  accent: 0.6,
  drive: 0.2,
  volume: 0.75,
  waveform: 'saw',
});

export const defaultDrumParams = (): DrumParams => ({
  voices: Object.fromEntries(DRUM_VOICES.map((v) => [v, { level: 0.75, tune: 0.5, decay: 0.5 }])) as Record<
    DrumVoice,
    DrumVoiceParams
  >,
  accent: 0.5,
  volume: 0.8,
});

export const newAcid = (name: string): AcidDevice => ({
  name,
  params: defaultAcidParams(),
  patterns: filled(PATTERN_SLOTS, emptyAcidPattern),
  current: 0,
  root: 9,
  scale: 'minor',
  mute: false,
});

export const newDrums = (name: string): DrumDevice => ({
  name,
  params: defaultDrumParams(),
  patterns: filled(PATTERN_SLOTS, emptyDrumPattern),
  current: 0,
  mute: false,
});

export const newSong = (): Song => ({
  version: SONG_VERSION,
  name: 'Untitled',
  bpm: 125,
  swing: 0,
  master: { volume: 0.8 },
  acids: [newAcid('AS-1')],
  drums: [newDrums('DM-9')],
});

/** Tune knob (0..1) to semitones, ±12 around center. */
export const tuneToSemitones = (tune: number): number => Math.round((tune - 0.5) * 24);

export const acidStepMidi = (step: AcidStep): number => ACID_BASE_MIDI + step.note + 12 * step.octave;

export const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const noteName = (semitone: number): string => NOTE_NAMES[((semitone % 12) + 12) % 12]!;

export const inKey = (root: number, scale: ScaleName, note: number): boolean =>
  (SCALES[scale] as readonly number[]).includes((((note - root) % 12) + 12) % 12);

/** Keys C..C (0..12) that belong to the key. */
export const keyNotes = (root: number, scale: ScaleName): number[] =>
  Array.from({ length: 13 }, (_, n) => n).filter((n) => inKey(root, scale, n));

/** Rows the step editor shows, top to bottom: in-key notes plus any off-key notes already in use. */
export const editorRows = (root: number, scale: ScaleName, pattern: AcidPattern): number[] => {
  const rows = new Set<number>(keyNotes(root, scale));
  for (const s of pattern.steps) if (s.gate) rows.add(s.note);
  return [...rows].sort((a, b) => b - a);
};
