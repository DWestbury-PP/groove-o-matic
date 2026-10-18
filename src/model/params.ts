// Stable parameter IDs for every continuous control.
//
// Knobs bind to an ID rather than to a song path, so future skins, MIDI
// learn and knob automation can all target the same contract:
//   acid.<i>.<cutoff|resonance|...>
//   drums.<i>.<voice>.<level|tune|decay>   drums.<i>.<accent|volume>
//   song.swing   master.volume

import {
  DRUM_VOICES,
  defaultAcidParams,
  defaultDrumParams,
  tuneToSemitones,
  type AcidParams,
  type DrumVoice,
  type DrumVoiceParams,
  type Song,
} from './song';

export interface ParamBinding {
  id: string;
  label: string;
  defaultValue: number;
  get(song: Song): number;
  set(song: Song, value: number): void;
  format(value: number): string;
}

type AcidKnob = Exclude<keyof AcidParams, 'waveform'>;

const pct = (v: number): string => `${Math.round(v * 100)}`;

export const ACID_KNOBS: { key: AcidKnob; label: string; format?: (v: number) => string }[] = [
  {
    key: 'tune',
    label: 'Tune',
    format: (v) => {
      const s = tuneToSemitones(v);
      return s > 0 ? `+${s}` : `${s}`;
    },
  },
  { key: 'cutoff', label: 'Cutoff' },
  { key: 'resonance', label: 'Reso' },
  { key: 'envMod', label: 'Env Mod' },
  { key: 'decay', label: 'Decay' },
  { key: 'accent', label: 'Accent' },
  { key: 'drive', label: 'Drive' },
  { key: 'volume', label: 'Volume' },
];

export const DRUM_VOICE_KNOBS: { key: keyof DrumVoiceParams; label: string }[] = [
  { key: 'level', label: 'Level' },
  { key: 'tune', label: 'Tune' },
  { key: 'decay', label: 'Decay' },
];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const resolve = (id: string): ParamBinding | undefined => {
  const parts = id.split('.');
  const [scope, a, b, c] = parts;

  if (id === 'song.swing')
    return {
      id,
      label: 'Swing',
      defaultValue: 0,
      get: (s) => s.swing,
      set: (s, v) => (s.swing = clamp01(v)),
      format: pct,
    };
  if (id === 'master.volume')
    return {
      id,
      label: 'Master',
      defaultValue: 0.8,
      get: (s) => s.master.volume,
      set: (s, v) => (s.master.volume = clamp01(v)),
      format: pct,
    };

  if (scope === 'acid' && parts.length === 3) {
    const i = Number(a);
    const knob = ACID_KNOBS.find((k) => k.key === b);
    if (!knob || !Number.isInteger(i)) return undefined;
    return {
      id,
      label: knob.label,
      defaultValue: defaultAcidParams()[knob.key],
      get: (s) => s.acids[i]?.params[knob.key] ?? 0,
      set: (s, v) => {
        const d = s.acids[i];
        if (d) d.params[knob.key] = clamp01(v);
      },
      format: knob.format ?? pct,
    };
  }

  if (scope === 'drums') {
    const i = Number(a);
    if (!Number.isInteger(i)) return undefined;
    if (parts.length === 3 && (b === 'accent' || b === 'volume')) {
      const key = b;
      return {
        id,
        label: key === 'accent' ? 'Accent' : 'Volume',
        defaultValue: defaultDrumParams()[key],
        get: (s) => s.drums[i]?.params[key] ?? 0,
        set: (s, v) => {
          const d = s.drums[i];
          if (d) d.params[key] = clamp01(v);
        },
        format: pct,
      };
    }
    if (parts.length === 4 && (DRUM_VOICES as readonly string[]).includes(b!)) {
      const voice = b as DrumVoice;
      const knob = DRUM_VOICE_KNOBS.find((k) => k.key === c);
      if (!knob) return undefined;
      return {
        id,
        label: knob.label,
        defaultValue: defaultDrumParams().voices[voice][knob.key],
        get: (s) => s.drums[i]?.params.voices[voice][knob.key] ?? 0,
        set: (s, v) => {
          const d = s.drums[i];
          if (d) d.params.voices[voice][knob.key] = clamp01(v);
        },
        format: pct,
      };
    }
  }
  return undefined;
};

const cache = new Map<string, ParamBinding>();

export const param = (id: string): ParamBinding => {
  let binding = cache.get(id);
  if (!binding) {
    binding = resolve(id);
    if (!binding) throw new Error(`Unknown parameter "${id}"`);
    cache.set(id, binding);
  }
  return binding;
};

export const isParamId = (id: string): boolean => resolve(id) !== undefined;
