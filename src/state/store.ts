// Song store: immutable updates (immer), React subscription, local autosave.

import { produce } from 'immer';
import { useSyncExternalStore } from 'react';
import { songFromJson } from '../model/serialize';
import { newSong, type Song } from '../model/song';

const AUTOSAVE_KEY = 'groove-o-matic.song.v1';

type Listener = () => void;

export class SongStore {
  private song: Song;
  private readonly listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(initial: Song) {
    this.song = initial;
  }

  get = (): Song => this.song;

  set(song: Song): void {
    this.song = song;
    this.emit();
  }

  /**
   * Mutate a draft. The recipe's return value is ignored, so terse handlers like
   * `(s) => (s.bpm = 120)` are safe (immer throws if a recipe both mutates and returns).
   */
  update(recipe: (draft: Song) => unknown): void {
    this.set(
      produce(this.song, (draft) => {
        recipe(draft);
      }),
    );
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const l of this.listeners) l();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveLocal(this.song), 400);
  }
}

// Browser storage can be unavailable (private mode, blocked site data); the
// app must work without it.
export const loadLocal = (): Song | undefined => {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? songFromJson(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
};

const saveLocal = (song: Song): void => {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(song));
  } catch {
    // Autosave is a convenience; ignore failures.
  }
};

const restored = loadLocal();

/** True when the session opened with an autosaved song. */
export const hasRestoredSong = restored !== undefined;

export const store = new SongStore(restored ?? newSong());

export const useSong = <T>(select: (song: Song) => T): T =>
  useSyncExternalStore(store.subscribe, () => select(store.get()));
