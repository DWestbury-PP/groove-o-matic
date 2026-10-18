import { useEffect, useRef, useState } from 'react';
import { ACID_KNOBS } from '../model/params';
import { randomAcidPattern } from '../model/random';
import {
  ACID_BASE_MIDI,
  editorRows,
  inKey,
  emptyAcidPattern,
  noteName,
  type AcidDevice,
  type AcidStep,
  type ScaleName,
} from '../model/song';
import { engine, powerOn, useAudio } from '../state/audio';
import { store, useSong } from '../state/store';
import { MuteButton, PatternBar } from './common';
import { ParamKnob } from './Knob';

const SCALE_LABELS: Record<ScaleName, string> = {
  chromatic: 'Chromatic',
  minor: 'Minor',
  phrygian: 'Phrygian',
  dorian: 'Dorian',
  major: 'Major',
  minorPentatonic: 'Minor Pent.',
};

/** QWERTY piano: A row = white keys, W row = black keys, C..C. */
const KEY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
};
const BLACK = new Set([1, 3, 6, 8, 10]);

const isTyping = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;

export function AcidPanel({ index }: { index: number }) {
  const device = useSong((s) => s.acids[index]!);
  const pattern = device.patterns[device.current]!;
  const playPos = useAudio((s) =>
    s.playhead?.acid[index]?.pattern === device.current ? s.playhead.acid[index]!.pos : undefined,
  );
  const [kbOctave, setKbOctave] = useState(0);
  const [held, setHeld] = useState<Set<number>>(() => new Set());
  // MIDI note each held key started, so octave changes can't strand a note.
  const pressed = useRef(new Map<number, number>());

  const editStep = (i: number, fn: (s: AcidStep) => void) =>
    store.update((s) => fn(s.acids[index]!.patterns[s.acids[index]!.current]!.steps[i]!));
  const editDevice = (fn: (d: AcidDevice) => void) =>
    store.update((s) => fn(s.acids[index]!));

  const noteOn = (key: number) => {
    if (pressed.current.has(key)) return;
    const midi = ACID_BASE_MIDI + key + 12 * kbOctave;
    pressed.current.set(key, midi);
    void powerOn().then(() => pressed.current.get(key) === midi && engine()?.liveNoteOn(index, midi));
    setHeld((h) => new Set(h).add(key));
  };
  const noteOff = (key: number) => {
    const midi = pressed.current.get(key);
    if (midi === undefined) return;
    pressed.current.delete(key);
    engine()?.liveNoteOff(index, midi);
    setHeld((h) => {
      const n = new Set(h);
      n.delete(key);
      return n;
    });
  };

  // The computer keyboard plays the first acid unit.
  useEffect(() => {
    if (index !== 0) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') setKbOctave((o) => Math.max(-1, o - 1));
      else if (k === 'x') setKbOctave((o) => Math.min(1, o + 1));
      const key = KEY_MAP[k];
      if (key !== undefined) noteOn(key);
    };
    const up = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.key.toLowerCase()];
      if (key !== undefined) noteOff(key);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const rows = editorRows(device.root, device.scale, pattern);
  const inScale = (note: number) => inKey(device.root, device.scale, note);
  const cols = Array.from({ length: 16 }, (_, i) => i);
  const colClass = (i: number) =>
    ['col', i >= pattern.length && 'is-off', i === playPos && 'is-now', i % 4 === 0 && 'is-beat'].filter(Boolean).join(' ');

  return (
    <section className="device acid" aria-label={`${device.name} acid synth`}>
      <header className="device-head">
        <div className="device-title">
          <span className="device-name">{device.name}</span>
          <span className="device-kind">Acid Synth</span>
        </div>
        <div className="device-controls">
          <div className="segmented" role="group" aria-label="Waveform">
            {(['saw', 'square'] as const).map((w) => (
              <button
                key={w}
                className={device.params.waveform === w ? 'is-on' : ''}
                aria-pressed={device.params.waveform === w}
                onClick={() => editDevice((d) => (d.params.waveform = w))}
              >
                {w === 'saw' ? '⩘ Saw' : '⊓ Square'}
              </button>
            ))}
          </div>
          <label className="select">
            Key
            <select value={device.root} onChange={(e) => editDevice((d) => (d.root = Number(e.target.value)))}>
              {Array.from({ length: 12 }, (_, n) => (
                <option key={n} value={n}>
                  {noteName(n)}
                </option>
              ))}
            </select>
            <select
              aria-label="Scale" value={device.scale} onChange={(e) => editDevice((d) => (d.scale = e.target.value as ScaleName))}>
              {Object.entries(SCALE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <MuteButton mute={device.mute} onToggle={() => editDevice((d) => (d.mute = !d.mute))} />
        </div>
      </header>

      <div className="knob-row">
        {ACID_KNOBS.map((k) => (
          <ParamKnob key={k.key} id={`acid.${index}.${k.key}`} size={k.key === 'cutoff' || k.key === 'resonance' ? 'lg' : 'md'} />
        ))}
      </div>

      <PatternBar
        kind="acid"
        device={index}
        current={device.current}
        length={pattern.length}
        onSelect={(i) => editDevice((d) => (d.current = i))}
        onLength={(n) => editDevice((d) => (d.patterns[d.current]!.length = n))}
        onRandom={() => editDevice((d) => (d.patterns[d.current] = randomAcidPattern(d.root, d.scale)))}
        onClear={() => editDevice((d) => (d.patterns[d.current] = emptyAcidPattern()))}
        isEmpty={(i) => !device.patterns[i]!.steps.some((s) => s.gate)}
      />

      <div className="roll" role="grid" aria-label="Note steps">
        {rows.map((note) => (
          <div className={`roll-row${BLACK.has(note % 12) ? ' is-black' : ''}${inScale(note) ? '' : ' is-offscale'}`} key={note} role="row">
            <div className="row-label">{noteName(note)}{note === 12 ? '↑' : ''}</div>
            {cols.map((i) => {
              const s = pattern.steps[i]!;
              const on = s.gate && s.note === note;
              return (
                <button
                  key={i}
                  role="gridcell"
                  aria-label={`Step ${i + 1} ${noteName(note)}`}
                  aria-pressed={on}
                  className={`${colClass(i)} cell${on ? ' is-on' : ''}${on && s.accent ? ' is-accent' : ''}${on && s.slide ? ' is-slide' : ''}`}
                  onClick={() =>
                    editStep(i, (st) => {
                      if (st.gate && st.note === note) st.gate = false;
                      else Object.assign(st, { gate: true, note });
                    })
                  }
                />
              );
            })}
          </div>
        ))}
        <div className="roll-row mod-row">
          <div className="row-label">Oct</div>
          {cols.map((i) => {
            const s = pattern.steps[i]!;
            return (
              <button
                key={i}
                className={`${colClass(i)} mod${s.octave !== 0 ? ' is-on' : ''}`}
                aria-label={`Step ${i + 1} octave`}
                onClick={() => editStep(i, (st) => (st.octave = st.octave === 0 ? 1 : st.octave === 1 ? -1 : 0))}
              >
                {s.octave === 1 ? '↑' : s.octave === -1 ? '↓' : ''}
              </button>
            );
          })}
        </div>
        {(['accent', 'slide'] as const).map((flag) => (
          <div className="roll-row mod-row" key={flag}>
            <div className="row-label">{flag === 'accent' ? 'Acc' : 'Slide'}</div>
            {cols.map((i) => {
              const s = pattern.steps[i]!;
              return (
                <button
                  key={i}
                  className={`${colClass(i)} mod mod-${flag}${s[flag] ? ' is-on' : ''}`}
                  aria-pressed={s[flag]}
                  aria-label={`Step ${i + 1} ${flag}`}
                  onClick={() => editStep(i, (st) => (st[flag] = !st[flag]))}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="keyboard-wrap">
        <div className="kb-octave" role="group" aria-label="Keyboard octave">
          <button onClick={() => setKbOctave((o) => Math.max(-1, o - 1))} aria-label="Octave down" title="Octave down (Z)">−</button>
          <span>Oct {kbOctave > 0 ? `+${kbOctave}` : kbOctave}</span>
          <button onClick={() => setKbOctave((o) => Math.min(1, o + 1))} aria-label="Octave up" title="Octave up (X)">+</button>
        </div>
        <div className="keyboard" aria-label="Play keys">
          {Array.from({ length: 13 }, (_, key) => (
            <button
              key={key}
              className={`key${BLACK.has(key % 12) ? ' is-black' : ''}${inScale(key) ? ' is-scale' : ''}${held.has(key) ? ' is-down' : ''}`}
              aria-label={`Play ${noteName(key)}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                noteOn(key);
              }}
              onPointerUp={() => noteOff(key)}
              onPointerCancel={() => noteOff(key)}
            >
              <span>{Object.keys(KEY_MAP).find((k) => KEY_MAP[k] === key)?.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
