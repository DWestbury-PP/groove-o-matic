import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { param } from '../model/params';
import { store, useSong } from '../state/store';

interface KnobProps {
  value: number;
  onChange(value: number): void;
  label: string;
  defaultValue: number;
  format(value: number): string;
  size?: 'sm' | 'md' | 'lg';
}

const SWEEP = 270;
const SIZES = { sm: 34, md: 46, lg: 60 };

/**
 * Drag vertically (Shift = fine), wheel, arrow keys; double-click resets.
 * Drawn as SVG so skins can later restyle it with CSS tokens.
 */
export function Knob({ value, onChange, label, defaultValue, format, size = 'md' }: KnobProps) {
  const drag = useRef<{ y: number; v: number } | undefined>(undefined);
  const [active, setActive] = useState(false);
  const px = SIZES[size];
  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, v: value };
    setActive(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const range = e.shiftKey ? 800 : 180;
    onChange(clamp(d.v + (d.y - e.clientY) / range));
  };
  const onPointerUp = () => {
    drag.current = undefined;
    setActive(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.01 : 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp(value + step));
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp(value - step));
    else if (e.key === 'Home') onChange(0);
    else if (e.key === 'End') onChange(1);
    else return;
    e.preventDefault();
  };
  const wheelRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      // Non-passive so the page doesn't scroll while turning a knob.
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        onChange(clamp(value - Math.sign(e.deltaY) * (e.shiftKey ? 0.01 : 0.03)));
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    },
    [value, onChange],
  );

  const angle = -SWEEP / 2 + value * SWEEP;
  const r = 40;
  const arc = (from: number, to: number) => {
    const p = (a: number) => {
      const rad = ((a - 90) * Math.PI) / 180;
      return `${50 + r * Math.cos(rad)} ${50 + r * Math.sin(rad)}`;
    };
    const large = to - from > 180 ? 1 : 0;
    return `M ${p(from)} A ${r} ${r} 0 ${large} 1 ${p(to)}`;
  };

  return (
    <div className={`knob knob-${size}${active ? ' is-active' : ''}`}>
      <div
        ref={wheelRef}
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={format(value)}
        title={`${label}: ${format(value)} (double-click to reset)`}
        style={{ width: px, height: px }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onChange(defaultValue)}
        onKeyDown={onKeyDown}
      >
        <svg viewBox="0 0 100 100" width={px} height={px}>
          <path d={arc(-SWEEP / 2, SWEEP / 2)} className="knob-track" />
          {value > 0.001 && <path d={arc(-SWEEP / 2, angle)} className="knob-value" />}
          <circle cx="50" cy="50" r="30" className="knob-cap" />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="24"
            className="knob-pointer"
            transform={`rotate(${angle} 50 50)`}
          />
        </svg>
      </div>
      <div className="knob-label">{active ? format(value) : label}</div>
    </div>
  );
}

/** A knob bound to a stable parameter ID (see model/params.ts). */
export function ParamKnob({ id, size, label }: { id: string; size?: KnobProps['size']; label?: string }) {
  const binding = param(id);
  const value = useSong(binding.get);
  const onChange = useCallback((v: number) => store.update((s) => binding.set(s, v)), [binding]);
  return (
    <Knob
      value={value}
      onChange={onChange}
      label={label ?? binding.label}
      defaultValue={binding.defaultValue}
      format={binding.format}
      size={size}
    />
  );
}
