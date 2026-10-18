import { PATTERN_SLOTS, STEPS } from '../model/song';
import { useAudio } from '../state/audio';

interface PatternBarProps {
  kind: 'acid' | 'drums';
  device: number;
  current: number;
  length: number;
  onSelect(slot: number): void;
  onLength(length: number): void;
  onRandom(): void;
  onClear(): void;
  isEmpty(slot: number): boolean;
}

/** Pattern slots (cue/select), length, and generator actions. */
export function PatternBar({ kind, device, current, length, onSelect, onLength, onRandom, onClear, isEmpty }: PatternBarProps) {
  const playing = useAudio((s) => s.playhead?.[kind][device]?.pattern);
  return (
    <div className="pattern-bar">
      <div className="slots" role="group" aria-label="Patterns">
        {Array.from({ length: PATTERN_SLOTS }, (_, i) => (
          <button
            key={i}
            className={[
              'slot',
              i === current && 'is-selected',
              i === playing && 'is-playing',
              i === current && playing !== undefined && i !== playing && 'is-cued',
              isEmpty(i) && 'is-empty',
            ]
              .filter(Boolean)
              .join(' ')}
            title={i === current && playing !== undefined && i !== playing ? 'Cued: starts at the end of this pattern' : `Pattern ${i + 1}`}
            onClick={() => onSelect(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <label className="length" title="Pattern length in steps">
        Len
        <input
          type="number"
          min={1}
          max={STEPS}
          value={length}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isInteger(v) && v >= 1 && v <= STEPS) onLength(v);
          }}
        />
      </label>
      <button className="action" onClick={onRandom} title="Generate a new pattern in this slot">
        🎲 Random
      </button>
      <button className="action" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

export function MuteButton({ mute, onToggle }: { mute: boolean; onToggle(): void }) {
  return (
    <button className={`toggle mute${mute ? ' is-on' : ''}`} aria-pressed={mute} onClick={onToggle}>
      Mute
    </button>
  );
}
