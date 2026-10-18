import { useEffect, useRef } from 'react';
import { DEMOS } from '../model/demos';
import { BPM_MAX, BPM_MIN, newSong } from '../model/song';
import { stop, togglePlay, useAudio } from '../state/audio';
import { store, useSong } from '../state/store';
import { ParamKnob } from './Knob';

export function Transport() {
  const playing = useAudio((s) => s.playing);
  const bpm = useSong((s) => s.bpm);
  const name = useSong((s) => s.name);
  const setBpm = (v: number) => store.update((s) => (s.bpm = Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, v)))));

  return (
    <div className="transport">
      <div className="brand">
        groove<span>-o-</span>matic
      </div>
      <button
        className={`play${playing ? ' is-playing' : ''}`}
        onClick={togglePlay}
        aria-label={playing ? 'Stop' : 'Play'}
        title="Play / Stop (Space)"
      >
        {playing ? '■' : '▶'}
      </button>
      <div className="bpm" title="Tempo: type, use arrows, or scroll">
        <button onClick={() => setBpm(bpm - 1)} aria-label="Tempo down">
          −
        </button>
        <input
          type="number"
          min={BPM_MIN}
          max={BPM_MAX}
          value={bpm}
          aria-label="Tempo (BPM)"
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= BPM_MIN && v <= BPM_MAX) setBpm(v);
          }}
        />
        <span className="bpm-unit">BPM</span>
        <button onClick={() => setBpm(bpm + 1)} aria-label="Tempo up">
          +
        </button>
      </div>
      <ParamKnob id="song.swing" size="sm" />
      <ParamKnob id="master.volume" size="sm" />
      <Meter />
      <input
        className="song-name"
        value={name}
        aria-label="Song name"
        maxLength={64}
        onChange={(e) => store.update((s) => (s.name = e.target.value))}
      />
      <select
        className="demo-picker"
        value=""
        aria-label="Load a demo"
        onChange={(e) => {
          const demo = DEMOS.find((d) => d.id === e.target.value);
          if (demo) store.set(demo.build());
        }}
      >
        <option value="" disabled>
          Load demo…
        </option>
        {DEMOS.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        className="action"
        onClick={() => {
          stop();
          store.set(newSong());
        }}
      >
        New
      </button>
    </div>
  );
}

/** Master output level (peak) meter. */
function Meter() {
  const engine = useAudio((s) => s.engine);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx2d = el?.getContext('2d');
    if (!engine || !el || !ctx2d) return;
    const buf = new Float32Array(engine.analyser.fftSize);
    let peak = 0;
    let raf = 0;
    const draw = () => {
      engine.analyser.getFloatTimeDomainData(buf);
      let p = 0;
      for (const v of buf) p = Math.max(p, Math.abs(v));
      peak = Math.max(p, peak * 0.92);
      const db = 20 * Math.log10(peak + 1e-6);
      const frac = Math.max(0, Math.min(1, (db + 48) / 48));
      const styles = getComputedStyle(el);
      ctx2d.clearRect(0, 0, el.width, el.height);
      ctx2d.fillStyle = styles.getPropertyValue('--meter-bg');
      ctx2d.fillRect(0, 0, el.width, el.height);
      ctx2d.fillStyle = styles.getPropertyValue(frac > 47 / 48 ? '--meter-hot' : '--meter-fill');
      ctx2d.fillRect(0, 0, el.width * frac, el.height);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return <canvas ref={canvas} className="meter" width={120} height={10} aria-hidden />;
}
