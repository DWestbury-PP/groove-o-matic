/** Main thread -> acid worklet messages. `time` is AudioContext time in seconds. */
export type AcidMessage =
  | { type: 'on'; time: number; midi: number; accent: boolean }
  | { type: 'glide'; time: number; midi: number; accent: boolean }
  | { type: 'off'; time: number }
  | { type: 'kill'; time: number };

/** AudioParams exposed by the acid worklet (knob values, except tune in semitones). */
export const ACID_PARAM_NAMES = ['tune', 'cutoff', 'resonance', 'envMod', 'decay', 'accent', 'drive', 'waveform'] as const;
