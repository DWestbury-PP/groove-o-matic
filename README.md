# groove-o-matic

A browser groove box in the spirit of the late-'90s software rack: an acid
bass synth and a drum machine, knobs you can twist live, and a pattern
sequencer that turns noodling into tracks. No install, no samples to
license: every sound is synthesized in the browser.

It's built for casual users: open it, pick a demo, and start twisting knobs.

## Features (v0.1)

- **AS-1 acid synth**: anti-aliased saw/square oscillator into a resonant
  ladder filter, with accent, slide, and drive. Runs in an AudioWorklet.
- **DM-9 drum machine**: eight synthesized voices (kick, snare, toms, rim,
  clap, closed/open hat with choke), each with level, tune, and decay.
- **Pattern sequencer**: eight pattern slots per device, 1–16 steps each.
  Patterns cue at the bar boundary, devices can run different lengths
  (polymeter), and there's global swing.
- **Key-locked editing**: the piano roll shows only notes in the chosen
  key and scale, so you can't place a wrong note.
- **Randomize**: a 🎲 button per device that generates idiomatic patterns
  (in key for the synth, four-on-the-floor-ish for the drums).
- **Live play**: on-screen keys and pads, or the computer keyboard.
- **Demos**: three genre archetypes (Acid House, Warehouse Techno, Big Beat
  Breaks), each with main, variation, and breakdown patterns.
- **Autosave**: work is kept in your browser between visits.

### Controls

| Key | Action |
| --- | --- |
| `Space` | Play / stop |
| `A`–`K` (with `W E T Y U` as black keys) | Play the acid synth |
| `Z` / `X` | Keyboard octave down / up |
| `1`–`8` | Drum pads |
| Knobs | Drag vertically, scroll, `Shift` for fine control, double-click to reset |

## Development

Requires Node 20.19+ or 22.12+.

```sh
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + lint + tests
npm run build    # static bundle in dist/
```

See [docs/architecture.md](docs/architecture.md) for how it fits together and
[docs/roadmap.md](docs/roadmap.md) for what's next.

## A note on names

The instruments are *inspired by* classic hardware and software, the same
way the hardware clone market is. Everything here has its own name and
design, every sound is synthesized from scratch, and the demo patterns are
original genre archetypes rather than recreations of specific records.

## License

MIT
