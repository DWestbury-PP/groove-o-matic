// Loading untrusted song JSON (local autosave now; shared URLs and files later).
// Anything malformed is repaired toward defaults rather than crashing the app.

import {
  DRUM_VOICES,
  PATTERN_SLOTS,
  SCALES,
  SONG_VERSION,
  STEPS,
  BPM_MAX,
  BPM_MIN,
  newAcid,
  newDrums,
  newSong,
  type AcidDevice,
  type AcidPattern,
  type DrumDevice,
  type DrumPattern,
  type ScaleName,
  type Song,
} from './song';

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const bool = (v: unknown): boolean => v === true;
const unit = (v: unknown, fallback: number): number => num(v, 0, 1, fallback);
const len = (v: unknown): number => Math.round(num(v, 1, STEPS, STEPS));

const acidPattern = (raw: unknown, fallback: AcidPattern): AcidPattern => {
  if (!isObj(raw) || !Array.isArray(raw.steps)) return fallback;
  const steps = fallback.steps.map((def, i) => {
    const s = (raw.steps as unknown[])[i];
    if (!isObj(s)) return def;
    const octave = s.octave === 1 || s.octave === -1 ? s.octave : 0;
    return {
      gate: bool(s.gate),
      note: Math.round(num(s.note, 0, 12, 0)),
      octave,
      accent: bool(s.accent),
      slide: bool(s.slide),
    } as const;
  });
  return { length: len(raw.length), steps };
};

const drumPattern = (raw: unknown, fallback: DrumPattern): DrumPattern => {
  if (!isObj(raw)) return fallback;
  const row = (v: unknown): boolean[] => Array.from({ length: STEPS }, (_, i) => Array.isArray(v) && bool(v[i]));
  const tracks = isObj(raw.tracks) ? raw.tracks : {};
  return {
    length: len(raw.length),
    tracks: Object.fromEntries(DRUM_VOICES.map((v) => [v, row(tracks[v])])) as DrumPattern['tracks'],
    accent: row(raw.accent),
  };
};

const slot = (v: unknown): number => Math.round(num(v, 0, PATTERN_SLOTS - 1, 0));

const acidDevice = (raw: unknown, i: number): AcidDevice => {
  const d = newAcid(`AS-${i + 1}`);
  if (!isObj(raw)) return d;
  const p = isObj(raw.params) ? raw.params : {};
  const def = d.params;
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 32) : d.name,
    params: {
      tune: unit(p.tune, def.tune),
      cutoff: unit(p.cutoff, def.cutoff),
      resonance: unit(p.resonance, def.resonance),
      envMod: unit(p.envMod, def.envMod),
      decay: unit(p.decay, def.decay),
      accent: unit(p.accent, def.accent),
      drive: unit(p.drive, def.drive),
      volume: unit(p.volume, def.volume),
      waveform: p.waveform === 'square' ? 'square' : 'saw',
    },
    patterns: d.patterns.map((fb, j) => acidPattern(Array.isArray(raw.patterns) ? raw.patterns[j] : undefined, fb)),
    current: slot(raw.current),
    root: Math.round(num(raw.root, 0, 11, d.root)),
    scale: typeof raw.scale === 'string' && raw.scale in SCALES ? (raw.scale as ScaleName) : d.scale,
    mute: bool(raw.mute),
  };
};

const drumDevice = (raw: unknown, i: number): DrumDevice => {
  const d = newDrums(`DM-${9 + i}`);
  if (!isObj(raw)) return d;
  const p = isObj(raw.params) ? raw.params : {};
  const voices = isObj(p.voices) ? p.voices : {};
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 32) : d.name,
    params: {
      voices: Object.fromEntries(
        DRUM_VOICES.map((v) => {
          const rv = isObj(voices[v]) ? (voices[v] as Json) : {};
          const def = d.params.voices[v];
          return [
            v,
            { level: unit(rv.level, def.level), tune: unit(rv.tune, def.tune), decay: unit(rv.decay, def.decay) },
          ];
        }),
      ) as DrumDevice['params']['voices'],
      accent: unit(p.accent, d.params.accent),
      volume: unit(p.volume, d.params.volume),
    },
    patterns: d.patterns.map((fb, j) => drumPattern(Array.isArray(raw.patterns) ? raw.patterns[j] : undefined, fb)),
    current: slot(raw.current),
    mute: bool(raw.mute),
  };
};

export const songFromJson = (raw: unknown): Song => {
  const base = newSong();
  if (!isObj(raw)) return base;
  const acids = Array.isArray(raw.acids) && raw.acids.length > 0 ? raw.acids.slice(0, 4) : [undefined];
  const drums = Array.isArray(raw.drums) && raw.drums.length > 0 ? raw.drums.slice(0, 4) : [undefined];
  return {
    version: SONG_VERSION,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 64) : base.name,
    bpm: Math.round(num(raw.bpm, BPM_MIN, BPM_MAX, base.bpm)),
    swing: unit(raw.swing, base.swing),
    master: { volume: unit(isObj(raw.master) ? raw.master.volume : undefined, base.master.volume) },
    acids: acids.map(acidDevice),
    drums: drums.map(drumDevice),
  };
};
