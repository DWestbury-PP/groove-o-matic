// Turns patterns into timed note events. Pure logic: no Web Audio, so the
// 303-style gate/slide/pattern-cue semantics are unit-testable.
//
// Semantics:
//   - Each device counts its own steps, so different pattern lengths phase
//     against each other (polymeter).
//   - Selecting a pattern while playing cues it; it starts at the device's
//     next pattern boundary.
//   - A gated step with slide holds its gate into the next step, which then
//     glides instead of retriggering. A rest after a held slide closes the gate.

import type { AcidMessage } from './acid-messages';
import { DRUM_VOICES, acidStepMidi, type AcidDevice, type AcidStep, type DrumDevice, type DrumVoice } from '../model/song';

/** Gate length as a fraction of the step. */
export const GATE_FRACTION = 0.55;

export interface DrumHit {
  voice: DrumVoice;
  time: number;
  accent: boolean;
}

export class AcidTrack {
  pos = 0;
  playing = 0;
  private held = false;

  reset(): void {
    this.pos = 0;
    this.held = false;
  }

  /** Advance one step; returns the worklet messages for it. */
  step(device: AcidDevice, time: number, duration: number): AcidMessage[] {
    if (this.pos === 0) this.playing = device.current;
    const pattern = device.patterns[this.playing]!;
    const length = Math.max(1, Math.min(pattern.length, pattern.steps.length));
    const step = pattern.steps[this.pos]!;
    const nextPos = this.pos + 1 >= length ? 0 : this.pos + 1;
    this.pos = nextPos;

    const messages: AcidMessage[] = [];
    if (!step.gate || device.mute) {
      if (this.held) messages.push({ type: 'off', time });
      this.held = false;
      return messages;
    }
    const midi = acidStepMidi(step);
    messages.push({ type: this.held ? 'glide' : 'on', time, midi, accent: step.accent });
    const next: AcidStep | undefined = pattern.steps[nextPos];
    this.held = step.slide && next?.gate === true;
    if (!this.held) messages.push({ type: 'off', time: time + duration * GATE_FRACTION });
    return messages;
  }
}

export class DrumTrack {
  pos = 0;
  playing = 0;

  reset(): void {
    this.pos = 0;
  }

  step(device: DrumDevice, time: number): DrumHit[] {
    if (this.pos === 0) this.playing = device.current;
    const pattern = device.patterns[this.playing]!;
    const length = Math.max(1, Math.min(pattern.length, pattern.accent.length));
    const i = this.pos;
    this.pos = i + 1 >= length ? 0 : i + 1;
    if (device.mute) return [];
    const accent = pattern.accent[i] === true;
    return DRUM_VOICES.filter((v) => pattern.tracks[v][i]).map((voice) => ({ voice, time, accent }));
  }
}
