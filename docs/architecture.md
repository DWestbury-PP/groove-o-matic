# Architecture

groove-o-matic is a static single-page app (TypeScript, React, Vite) with no
backend. Audio runs entirely in the browser on the Web Audio API.

```
src/
  model/    Song data model: pure, serializable, no browser APIs
  engine/   Audio engine: Web Audio graph, AudioWorklet DSP, scheduler
  state/    Song store (immer + autosave) and audio/transport state
  ui/       React components
```

Dependencies point one way: `ui → state → engine → model`. Nothing in
`model/` touches the browser, and the DSP and sequencing logic in `engine/`
is plain TypeScript, so all of it runs under Vitest in Node.

## The song is the source of truth

`model/song.ts` defines `Song`: tempo, swing, master settings, and arrays
of acid and drum devices. Each device holds its knob params (normalized
0..1), eight pattern slots, and the selected slot. It is plain JSON. The
same shape is used for autosave and the demos, and later for share URLs,
files, and skins.

- **Untrusted input** (autosave now, shared songs later) goes through
  `songFromJson` (`model/serialize.ts`). It clamps and repairs bad input
  instead of throwing.
- **Parameter IDs** (`model/params.ts`): every continuous control has a
  stable ID such as `acid.0.cutoff` or `drums.0.oh.decay`. Knobs bind to the
  ID rather than to a path in the song. This is the contract that MIDI
  learn, knob automation, and skins will target.
- **Notation** (`model/notation.ts`): a compact text format for writing
  patterns, e.g. `"Av Av! . C^~ D^"`. Demos and tests use it.

## Audio engine

```
AS-1 worklet ─▶ channel gain ─┐
                              ├─▶ glue comp ─▶ master ─▶ limiter ─▶ soft clip ─▶ analyser ─▶ out
DM-9 voices ─▶ voice gains ─▶ drum bus ─┘
```

### Scheduling

`engine/clock.ts` uses the lookahead pattern. A timer running in a Worker
(so it isn't throttled in background tabs) ticks every 25 ms. Each tick,
`StepClock` hands back every 16th-note step that falls in the next 120 ms,
stamped with its exact AudioContext time. Tempo and swing are re-read on
every step.

The engine reads the song through a getter at schedule time, so edits are
heard on the next step. There's no separate "playing copy" to keep in sync.

### Sequencing semantics

These live in `engine/sequencer.ts`, which is pure and unit-tested.

- **Independent step counters**: each device counts its own steps, so
  pattern lengths can differ (polymeter).
- **Pattern cueing**: selecting a slot while playing cues it, and it starts
  at that device's next pattern boundary.
- **Slide**: a slide on step N holds the gate into step N+1, which glides
  instead of retriggering. A rest releases a held gate.

### Acid voice

`engine/dsp/acid-voice.ts` is plain TypeScript; `worklets/acid.worklet.ts`
is a thin shell around it.

- **Oscillator**: polyBLEP saw/square.
- **Filter**: a 4-pole ladder, oversampled 2×, with a tanh-limited input.
  The resonance feedback is high-passed so the low end survives high
  resonance.
- **Envelopes**: the filter envelope's decay follows the Decay knob, except
  accented notes, which always decay fast. Accent also drives a smoothed
  "sweep" that builds across consecutive accents.
- **Messages**: notes arrive as timestamped port messages and are applied
  at sample accuracy. Knobs are k-rate AudioParams, interpolated across
  each block.

### Drum voices

`engine/drum-machine.ts` builds a short-lived node graph for each hit:

- **Kick**: pitch-swept sine plus a beater click.
- **Snare**: two tones plus noise.
- **Clap**: three noise bursts, then a tail.
- **Hats**: a cluster of six square waves plus noise. A closed hat chokes a
  ringing open hat.

On stop, hits already scheduled for the future are cancelled.

### Levels

Gain staging was measured in the browser across all demos:

- Acid and drum RMS land within a few dB of each other.
- Default mixes peak around −1 to −2 dBFS.
- With every level, resonance, drive, and accent maxed, output still stays
  below 0 dBFS. The compressor-based limiter has no lookahead, so the soft
  clipper after it (unity gain below 0.7 FS, ceiling 0.95 FS) catches
  transients.

## UI and state

- **Song store** (`state/store.ts`): updates are immutable (immer), React
  subscribes with `useSyncExternalStore`, and the song autosaves to
  `localStorage`. Storage failures are ignored, and the app works without
  it.
- **Audio state** (`state/audio.ts`): browsers only allow audio to start
  after a user gesture, so the engine is created when the user clicks
  something on the start screen. A requestAnimationFrame loop publishes the
  playhead, i.e. the step that has actually sounded rather than the one
  just scheduled.
- **Styling**: all colors are CSS custom properties on `:root`, and each
  device overrides `--accent`. Skins will build on these tokens.

## Verification

- **Unit tests** (`npm test`) cover the DSP (bounded output, accents,
  glide without retrigger, sample-accurate events), the clock and swing,
  sequencer semantics, notation, randomizers, params, serialization, the
  demos, and the store.
- **Browser checks**: in dev builds, `window.__groove` exposes `{ engine,
  store }` so levels and behavior can be checked in a real browser.
