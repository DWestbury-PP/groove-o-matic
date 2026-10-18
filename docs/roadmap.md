# Roadmap

## v0.1: core loop (this release)
One acid synth and one drum machine, transport with tempo, swing, and master
volume, 8 pattern slots per device, key-locked piano roll, randomizers,
live keys and pads, three demos, and autosave.

## v0.2: the full rack
- A second acid synth and a second drum machine. The model and engine
  already take arrays of devices, so this is mostly layout.
- Song mode: arrange pattern changes into a track.
- Sends: tempo-synced echo and convolution reverb (using generated impulse
  responses), plus a master compressor amount.
- Copy and paste patterns; transpose and shift a pattern.

## v0.3: share and mod
- Share a song as a URL: compressed JSON in the URL fragment, loaded through
  `songFromJson`.
- WAV export via OfflineAudioContext.
- **Skins and mods** as a zip of a manifest, assets, and samples.
  - Skin layouts bind controls to parameter IDs.
  - Theming overrides the CSS tokens.
  - Sample packs can replace drum voices.
  - The stock look will ship in the same format, so it doubles as the
    reference skin.
- Publish the skin format as an open spec.

## v0.4: depth
- Web MIDI: hardware controllers, with MIDI learn on parameter IDs.
- Knob automation recorded into patterns.
- A larger demo library and a mutate mode (small random changes, not full
  re-rolls).

## Later / if it's a hit
- Mobile layout.
- A backend for a community song and skin gallery. If it grows into
  several services, run them with Docker Compose.
