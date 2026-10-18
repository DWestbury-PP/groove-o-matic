import { useEffect, useState } from 'react';
import { DEMOS } from '../model/demos';
import { newSong } from '../model/song';
import { play, powerOn, togglePlay } from '../state/audio';
import { hasRestoredSong, store, useSong } from '../state/store';
import { AcidPanel } from './AcidPanel';
import { DrumPanel } from './DrumPanel';
import { Transport } from './Transport';

export function App() {
  const [started, setStarted] = useState(false);
  const acidCount = useSong((s) => s.acids.length);
  const drumCount = useSong((s) => s.drums.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !started) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started]);

  return (
    <div className="app">
      <Transport />
      <main className="rack">
        {Array.from({ length: acidCount }, (_, i) => (
          <AcidPanel key={`acid-${i}`} index={i} />
        ))}
        {Array.from({ length: drumCount }, (_, i) => (
          <DrumPanel key={`drums-${i}`} index={i} />
        ))}
      </main>
      <footer className="help">
        <span><kbd>Space</kbd> play/stop</span>
        <span><kbd>A</kbd>–<kbd>K</kbd> play the acid synth, <kbd>Z</kbd>/<kbd>X</kbd> octave</span>
        <span><kbd>1</kbd>–<kbd>8</kbd> drum pads</span>
        <span>Knobs: drag, scroll, <kbd>Shift</kbd> for fine, double-click to reset</span>
      </footer>
      {!started && <StartScreen onStart={() => setStarted(true)} />}
    </div>
  );
}

function StartScreen({ onStart }: { onStart(): void }) {
  const [error, setError] = useState<string>();
  const start = async (load?: () => void, autoplay = true) => {
    try {
      load?.();
      await powerOn();
      if (autoplay) await play();
      onStart();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="start" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <div className="start-card">
        <h1 id="start-title">
          groove<span>-o-</span>matic
        </h1>
        <p className="tagline">An acid synth and a drum machine in your browser. Pick a groove and start twisting knobs.</p>
        <div className="demo-cards">
          {DEMOS.map((d) => (
            <button key={d.id} className="demo-card" onClick={() => start(() => store.set(d.build()))}>
              <span className="demo-name">▶ {d.name}</span>
              <span className="demo-blurb">{d.blurb}</span>
            </button>
          ))}
        </div>
        <div className="start-actions">
          {hasRestoredSong && (
            <button className="action" onClick={() => start(undefined, false)}>
              Continue “{store.get().name}”
            </button>
          )}
          <button className="action" onClick={() => start(() => store.set(newSong()), false)}>
            Start with an empty rack
          </button>
        </div>
        {error && <p className="error">Couldn’t start audio: {error}</p>}
      </div>
    </div>
  );
}
