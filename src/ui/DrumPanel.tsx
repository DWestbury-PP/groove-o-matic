import { useEffect, useState } from 'react';
import { DRUM_VOICE_KNOBS } from '../model/params';
import { randomDrumPattern } from '../model/random';
import { DRUM_VOICES, DRUM_VOICE_LABELS, emptyDrumPattern, type DrumDevice, type DrumVoice } from '../model/song';
import { engine, powerOn, useAudio } from '../state/audio';
import { store, useSong } from '../state/store';
import { MuteButton, PatternBar } from './common';
import { ParamKnob } from './Knob';

const isTyping = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;

export function DrumPanel({ index }: { index: number }) {
  const device = useSong((s) => s.drums[index]!);
  const pattern = device.patterns[device.current]!;
  const playPos = useAudio((s) =>
    s.playhead?.drums[index]?.pattern === device.current ? s.playhead.drums[index]!.pos : undefined,
  );
  const [flash, setFlash] = useState<DrumVoice | undefined>();

  const editDevice = (fn: (d: DrumDevice) => void) => store.update((s) => fn(s.drums[index]!));
  const editPattern = (fn: (p: DrumDevice['patterns'][number]) => void) =>
    editDevice((d) => fn(d.patterns[d.current]!));

  const hit = (voice: DrumVoice) => {
    void powerOn().then(() => engine()?.triggerDrum(index, voice, true));
    setFlash(voice);
    setTimeout(() => setFlash((f) => (f === voice ? undefined : f)), 120);
  };

  // Number keys 1..8 play the pads of the first drum unit.
  useEffect(() => {
    if (index !== 0) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      const voice = DRUM_VOICES[Number(e.key) - 1];
      if (voice && /^[1-8]$/.test(e.key)) hit(voice);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const cols = Array.from({ length: 16 }, (_, i) => i);
  const colClass = (i: number) =>
    ['col', i >= pattern.length && 'is-off', i === playPos && 'is-now', i % 4 === 0 && 'is-beat'].filter(Boolean).join(' ');

  return (
    <section className="device drums" aria-label={`${device.name} drum machine`}>
      <header className="device-head">
        <div className="device-title">
          <span className="device-name">{device.name}</span>
          <span className="device-kind">Drum Machine</span>
        </div>
        <div className="device-controls">
          <ParamKnob id={`drums.${index}.accent`} size="sm" />
          <ParamKnob id={`drums.${index}.volume`} size="sm" />
          <MuteButton mute={device.mute} onToggle={() => editDevice((d) => (d.mute = !d.mute))} />
        </div>
      </header>

      <PatternBar
        kind="drums"
        device={index}
        current={device.current}
        length={pattern.length}
        onSelect={(i) => editDevice((d) => (d.current = i))}
        onLength={(n) => editPattern((p) => (p.length = n))}
        onRandom={() => editDevice((d) => (d.patterns[d.current] = randomDrumPattern()))}
        onClear={() => editDevice((d) => (d.patterns[d.current] = emptyDrumPattern()))}
        isEmpty={(i) => !DRUM_VOICES.some((v) => device.patterns[i]!.tracks[v].some(Boolean))}
      />

      <div className="drum-grid" role="grid" aria-label="Drum steps">
        {DRUM_VOICES.map((voice, vi) => (
          <div className="drum-row" key={voice} role="row">
            <button
              className={`pad${flash === voice ? ' is-hit' : ''}`}
              onPointerDown={() => hit(voice)}
              title={`Play ${DRUM_VOICE_LABELS[voice]} (key ${vi + 1})`}
            >
              <span className="pad-key">{vi + 1}</span>
              {DRUM_VOICE_LABELS[voice]}
            </button>
            <div className="voice-knobs">
              {DRUM_VOICE_KNOBS.map((k) => (
                <ParamKnob key={k.key} id={`drums.${index}.${voice}.${k.key}`} size="sm" />
              ))}
            </div>
            <div className="steps">
              {cols.map((i) => {
                const on = pattern.tracks[voice][i]!;
                return (
                  <button
                    key={i}
                    role="gridcell"
                    aria-pressed={on}
                    aria-label={`${DRUM_VOICE_LABELS[voice]} step ${i + 1}`}
                    className={`${colClass(i)} cell${on ? ' is-on' : ''}${on && pattern.accent[i] ? ' is-accent' : ''}`}
                    onClick={() => editPattern((p) => (p.tracks[voice][i] = !p.tracks[voice][i]))}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="drum-row accent-row" role="row">
          <div className="pad pad-static">Accent</div>
          <div className="voice-knobs" />
          <div className="steps">
            {cols.map((i) => (
              <button
                key={i}
                role="gridcell"
                aria-pressed={pattern.accent[i]}
                aria-label={`Accent step ${i + 1}`}
                className={`${colClass(i)} cell mod-accent${pattern.accent[i] ? ' is-on' : ''}`}
                onClick={() => editPattern((p) => (p.accent[i] = !p.accent[i]))}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
