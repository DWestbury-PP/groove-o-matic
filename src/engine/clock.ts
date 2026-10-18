// Lookahead step clock (the "tale of two clocks" pattern): a coarse timer
// wakes every ~25 ms and schedules every 16th-note step that falls inside the
// lookahead window at exact AudioContext times. Tempo and swing are read per
// step, so changes take effect on the next step without drift.

export interface StepEvent {
  /** Global 16th-note counter since play started. */
  step: number;
  /** AudioContext time the step sounds. */
  time: number;
  /** Time until the next step (swing-adjusted). */
  duration: number;
}

/** Swing delays odd 16ths by up to half a step (0 = straight, 1 = 75% shuffle). */
export const swingOffset = (step: number, stepDur: number, swing: number): number =>
  step % 2 === 1 ? swing * 0.5 * stepDur : 0;

export const stepDuration = (bpm: number): number => 60 / bpm / 4;

export class StepClock {
  private gridTime = 0;
  private step = 0;

  start(time: number): void {
    this.gridTime = time;
    this.step = 0;
  }

  /** Collect all steps sounding before `horizon`. */
  collect(horizon: number, bpm: number, swing: number): StepEvent[] {
    const events: StepEvent[] = [];
    for (;;) {
      const dur = stepDuration(bpm);
      const time = this.gridTime + swingOffset(this.step, dur, swing);
      if (time >= horizon) break;
      const nextTime = this.gridTime + dur + swingOffset(this.step + 1, dur, swing);
      events.push({ step: this.step, time, duration: nextTime - time });
      this.gridTime += dur;
      this.step++;
    }
    return events;
  }
}

/**
 * A timer that keeps ticking in background tabs (main-thread setInterval is
 * throttled to 1 Hz there, which would starve the scheduler).
 */
export class Ticker {
  private worker: Worker | undefined;

  constructor(
    private readonly intervalMs: number,
    private readonly onTick: () => void,
  ) {}

  start(): void {
    if (this.worker) return;
    const src = `let id; onmessage = (e) => { clearInterval(id); if (e.data > 0) id = setInterval(() => postMessage(0), e.data); };`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    this.worker = new Worker(url);
    URL.revokeObjectURL(url);
    this.worker.onmessage = () => this.onTick();
    this.worker.postMessage(this.intervalMs);
  }

  stop(): void {
    this.worker?.terminate();
    this.worker = undefined;
  }
}
