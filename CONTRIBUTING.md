# Contributing to groove-o-matic

Thanks for wanting to make some noise. Contributions of any size are
welcome, from a single new groove to a whole new instrument.

## Quick start

```sh
npm install
npm run dev      # open the printed URL and click a demo
npm run check    # typecheck + lint + tests; must pass before a PR
```

## The easiest first contribution: a demo groove

Demos live in [`src/model/demos/index.ts`](src/model/demos/index.ts). They're
written in a compact text notation, so you don't need to touch any audio
code.

```ts
acid: {
  params: { cutoff: 0.3, resonance: 0.78, envMod: 0.6, decay: 0.45, waveform: 'saw' },
  root: 9,            // key: 0 = C ... 9 = A ... 11 = B
  scale: 'minor',     // chromatic | minor | phrygian | dorian | major | minorPentatonic
  patterns: [
    // one token per step: note name, or "." for a rest
    // ^ octave up, v octave down, ! accent, ~ slide into the next note
    'Av Av! A Av~ G Av C^! Av . Av~ A Av G! . E~ G',
  ],
},
drums: {
  patterns: [
    {
      bd: 'x... x... x... x...',   // x = hit, X = accented hit, . = rest
      cp: '.... x... .... x...',
      ch: 'xx.x xx.x xx.x xx.x',
      oh: '..x. ..x. ..x. ..x.',
    },
  ],
},
```

Voices: `bd` kick, `sd` snare, `lt`/`ht` toms, `rs` rim, `cp` clap,
`ch`/`oh` closed/open hat. Give each demo three patterns (main, variation,
breakdown) so people can switch between them live. The test suite checks
that every demo builds and that every note is in the declared key.

## Ground rules

- **Original material only.** Make demos *in the style of* a genre, not
  note-for-note recreations of specific records, and don't put artist or
  track names in demo names. Instruments keep their own names (AS-1, DM-9),
  so no trademarked hardware or product names. Samples must be your own or
  CC0.
- **Respect the layering:** `ui → state → engine → model`.
  - `model/` never touches browser APIs.
  - DSP and sequencing logic stay in plain TypeScript so they can be unit
    tested.
  - Worklet files are thin shells around that logic.
- **Every new knob gets a parameter ID** in `src/model/params.ts`.
- **Audio changes need ears and numbers.** Listen in a browser, and check
  levels. In `npm run dev` builds, `window.__groove` exposes
  `{ engine, store }` so you can tap nodes with an `AnalyserNode`. Nothing
  should push the master output past 0 dBFS.
- See [docs/architecture.md](docs/architecture.md) for how it all fits
  together, and [docs/roadmap.md](docs/roadmap.md) for what's planned.

## Pull requests

1. Branch from `main`, keep the PR focused on one thing, and describe what
   you changed and how you checked it.
2. CI runs typecheck, lint, tests, and build, and it must be green.
3. For sound changes, say what you listened to. A short clip is even
   better.

## Publishing (maintainers)

The public demo is hosted on [here.now](https://here.now). With
`HERENOW_API_KEY` set in `.env` (see `.env.example`; the file is
gitignored), run:

```sh
npm run publish:site
```

This builds the app and updates the same URL, which comes from
`herenow.json`. Files that haven't changed are skipped.
