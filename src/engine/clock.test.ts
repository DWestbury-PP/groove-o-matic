import { describe, expect, it } from 'vitest';
import { StepClock, stepDuration } from './clock';

describe('StepClock', () => {
  it('emits straight 16ths at tempo', () => {
    const c = new StepClock();
    c.start(1);
    const events = c.collect(1 + 1.0, 120, 0);
    // 120 BPM -> 0.125 s per 16th -> 8 steps in one second
    expect(events.map((e) => e.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(events[3]!.time).toBeCloseTo(1 + 3 * 0.125);
    expect(events.every((e) => Math.abs(e.duration - 0.125) < 1e-9)).toBe(true);
  });

  it('is incremental across calls without gaps or repeats', () => {
    const c = new StepClock();
    c.start(0);
    const a = c.collect(0.3, 120, 0);
    const b = c.collect(0.6, 120, 0);
    expect([...a, ...b].map((e) => e.step)).toEqual([0, 1, 2, 3, 4]);
  });

  it('swing delays odd steps and keeps the pair length constant', () => {
    const c = new StepClock();
    c.start(0);
    const [s0, s1, s2] = c.collect(0.3, 120, 1);
    const dur = stepDuration(120);
    expect(s1!.time).toBeCloseTo(dur * 1.5);
    expect(s0!.duration + s1!.duration).toBeCloseTo(2 * dur);
    expect(s2!.time).toBeCloseTo(2 * dur);
  });

  it('picks up tempo changes on the next step', () => {
    const c = new StepClock();
    c.start(0);
    c.collect(0.01, 120, 0); // step 0 at 120
    const [s1] = c.collect(10, 60, 0);
    expect(s1!.time).toBeCloseTo(0.125);
    expect(s1!.duration).toBeCloseTo(0.25);
  });
});
