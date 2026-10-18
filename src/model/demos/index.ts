// Demo songs: genre archetypes with original lines, written to pull casual
// users in. Each has three patterns per device (main / variation / breakdown)
// so switching patterns live is part of the first experience.

import { parseAcidPattern, parseDrumPattern, type DrumNotation } from '../notation';
import {
  newSong,
  type AcidParams,
  type DrumParams,
  type DrumVoice,
  type DrumVoiceParams,
  type ScaleName,
  type Song,
} from '../song';

interface DemoSpec {
  id: string;
  name: string;
  blurb: string;
  bpm: number;
  swing: number;
  acid: { params: Partial<AcidParams>; root: number; scale: ScaleName; patterns: string[] };
  drums: {
    params?: Partial<Omit<DrumParams, 'voices'>>;
    voices?: Partial<Record<DrumVoice, Partial<DrumVoiceParams>>>;
    patterns: DrumNotation[];
  };
}

export interface Demo {
  id: string;
  name: string;
  blurb: string;
  build(): Song;
}

const build = (spec: DemoSpec): Song => {
  const song = newSong();
  song.name = spec.name;
  song.bpm = spec.bpm;
  song.swing = spec.swing;
  const acid = song.acids[0]!;
  Object.assign(acid.params, spec.acid.params);
  acid.root = spec.acid.root;
  acid.scale = spec.acid.scale;
  spec.acid.patterns.forEach((p, i) => (acid.patterns[i] = parseAcidPattern(p)));
  const drums = song.drums[0]!;
  Object.assign(drums.params, spec.drums.params ?? {});
  for (const [voice, v] of Object.entries(spec.drums.voices ?? {}))
    Object.assign(drums.params.voices[voice as DrumVoice], v);
  spec.drums.patterns.forEach((p, i) => (drums.patterns[i] = parseDrumPattern(p)));
  return song;
};

const SPECS: DemoSpec[] = [
  {
    id: 'acid-house-88',
    name: "Acid House '88",
    blurb: 'Squelchy saw line, four-on-the-floor, a little shuffle. Sweep the Cutoff.',
    bpm: 122,
    swing: 0.15,
    acid: {
      params: { cutoff: 0.3, resonance: 0.78, envMod: 0.6, decay: 0.45, accent: 0.7, drive: 0.25, waveform: 'saw' },
      root: 9,
      scale: 'minor',
      patterns: [
        'Av Av! A Av~ G Av C^! Av . Av~ A Av G! . E~ G',
        'Av . A! Av~ Av C^ . A~ G Av! D^~ C^ Av . A! Av',
        'Av~ A~ G . . . Av~ C^ . . E~ G~ A . . .',
      ],
    },
    drums: {
      voices: { oh: { decay: 0.4 }, cp: { level: 0.7 } },
      patterns: [
        {
          bd: 'x... x... x... x...',
          cp: '.... x... .... x...',
          ch: 'xx.x xx.x xx.x xx.x',
          oh: '..x. ..x. ..x. ..x.',
          accent: 'x... x... x... x...',
        },
        {
          bd: 'x... x... x... x.x.',
          cp: '.... x... .... x...',
          sd: '.... .... .... ..xx',
          rs: '...x ..x. ...x .x..',
          ch: 'xx.x xx.x xx.x xx.x',
          oh: '..x. ..x. ..x. ..x.',
          accent: 'x... x... x... x...',
        },
        {
          cp: '.... x... .... x...',
          ch: 'x.x. x.x. x.x. x.xx',
          oh: '..x. ..x. ..x. ..x.',
        },
      ],
    },
  },
  {
    id: 'warehouse-techno',
    name: 'Warehouse Techno',
    blurb: 'Driving square-wave acid, heavy drive, relentless hats. Crank the Reso.',
    bpm: 132,
    swing: 0,
    acid: {
      params: {
        cutoff: 0.22,
        resonance: 0.85,
        envMod: 0.7,
        decay: 0.3,
        accent: 0.8,
        drive: 0.55,
        volume: 0.7,
        waveform: 'square',
      },
      root: 0,
      scale: 'phrygian',
      patterns: [
        'Cv Cv! C Cv~ Cv C^! Cv . Cv~ C Cv D#! Cv . C~ Cv',
        'Cv C! Cv C#~ Cv . G Cv! Cv C^ Cv~ C Cv . D#^! Cv',
        'Cv . . . Cv . . . Cv . . . C~ C^ . .',
      ],
    },
    drums: {
      voices: { bd: { decay: 0.6, tune: 0.4 }, ch: { decay: 0.35 }, rs: { level: 0.6 } },
      patterns: [
        {
          bd: 'x... x... x... x...',
          rs: '..x. .x.. ..x. ...x',
          cp: '.... .... .... x...',
          ch: 'xx.x xx.x xx.x xx.x',
          oh: '..x. ..x. ..x. ..x.',
          accent: 'x.x. x.x. x.x. x.x.',
        },
        {
          bd: 'x... x... x... x...',
          rs: '..x. .x.. ..x. ...x',
          lt: '...x .... ..x. ....',
          ht: '.... ..x. .... .x..',
          cp: '.... x... .... x...',
          ch: 'xx.x xx.x xx.x xx.x',
          oh: '..x. ..x. ..x. ..x.',
          accent: 'x.x. x.x. x.x. x.x.',
        },
        {
          bd: 'x... .... x... ....',
          rs: '..x. .x.. ..x. ...x',
          ch: 'xxxx xxxx xxxx xxxx',
          accent: 'x... x... x... x...',
        },
      ],
    },
  },
  {
    id: 'big-beat-breaks',
    name: 'Big Beat Breaks',
    blurb: 'Swung breakbeat, fat distorted bass in E. Push the Drive.',
    bpm: 104,
    swing: 0.35,
    acid: {
      params: {
        cutoff: 0.42,
        resonance: 0.55,
        envMod: 0.45,
        decay: 0.6,
        accent: 0.6,
        drive: 0.75,
        volume: 0.7,
        waveform: 'saw',
      },
      root: 4,
      scale: 'minorPentatonic',
      patterns: [
        'Ev . Ev! . . Ev Gv~ Ev . . Bv! . D~ Ev . .',
        'Ev Ev! . Ev E~ Ev . . Ev . G! . A~ G E .',
        'Ev~ E . . . . . . Bv~ B . . . . . .',
      ],
    },
    drums: {
      voices: { bd: { decay: 0.7, tune: 0.35 }, sd: { tune: 0.35, decay: 0.65, level: 0.85 } },
      patterns: [
        {
          bd: 'x.x. ..x. ..x. ....',
          sd: '.... x... .x.. x...',
          ch: 'x.x. x.x. x.x. x.x.',
          oh: '.... .... .... ..x.',
          accent: 'x... x... .... x...',
        },
        {
          bd: 'x.x. ..x. x.x. ..x.',
          sd: '.... x..x .x.. x.xx',
          cp: '.... x... .... x...',
          ch: 'xxxx xxxx xxxx xx.x',
          oh: '.... .... .... ..x.',
          accent: 'x... x... .... x...',
        },
        {
          bd: 'x... .... x... ....',
          sd: '.... .... .... x...',
          ch: 'x.x. x.x. x.x. x.x.',
        },
      ],
    },
  },
];

export const DEMOS: Demo[] = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  blurb: spec.blurb,
  build: () => build(spec),
}));
