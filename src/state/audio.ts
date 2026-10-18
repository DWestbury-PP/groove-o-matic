// App-level audio state: the lazily created engine, transport and playhead.
// The engine can only start after a user gesture, so everything here is
// optional until `powerOn()` succeeds.

import { useSyncExternalStore } from 'react';
import { Engine, type Playhead } from '../engine/engine';
import { store } from './store';

type Listener = () => void;

interface AudioState {
  engine: Engine | undefined;
  playing: boolean;
  playhead: Playhead | undefined;
}

let state: AudioState = { engine: undefined, playing: false, playhead: undefined };
const listeners = new Set<Listener>();
const subscribe = (l: Listener): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const setState = (patch: Partial<AudioState>): void => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

let starting: Promise<Engine> | undefined;

export const powerOn = (): Promise<Engine> => {
  if (state.engine) return Promise.resolve(state.engine);
  starting ??= Engine.create(store.get).then((engine) => {
    store.subscribe(() => engine.sync(store.get()));
    setState({ engine });
    // Dev-only handle for live verification from the browser console.
    if (import.meta.env.DEV) Object.assign(window, { __groove: { engine, store } });
    requestAnimationFrame(pollPlayhead);
    return engine;
  });
  return starting;
};

const pollPlayhead = (): void => {
  const ph = state.engine?.playhead();
  if (ph !== state.playhead) setState({ playhead: ph });
  requestAnimationFrame(pollPlayhead);
};

export const play = async (): Promise<void> => {
  const engine = await powerOn();
  engine.play();
  setState({ playing: true });
};

export const stop = (): void => {
  state.engine?.stop();
  setState({ playing: false, playhead: undefined });
};

export const togglePlay = (): void => {
  if (state.playing) stop();
  else void play();
};

export const engine = (): Engine | undefined => state.engine;

export const useAudio = <T>(select: (s: AudioState) => T): T =>
  useSyncExternalStore(subscribe, () => select(state));
