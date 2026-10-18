import { describe, expect, it } from 'vitest';
import { param } from '../model/params';
import { newSong } from '../model/song';
import { SongStore } from './store';

describe('SongStore', () => {
  it('accepts terse recipes that return the assigned value', () => {
    // Regression: immer throws when a recipe mutates *and* returns a value,
    // which every `(d) => (d.x = v)` handler does.
    const store = new SongStore(newSong());
    store.update((s) => (s.acids[0]!.current = 1));
    store.update((s) => param('acid.0.cutoff').set(s, 0.9));
    expect(store.get().acids[0]!.current).toBe(1);
    expect(store.get().acids[0]!.params.cutoff).toBe(0.9);
  });

  it('produces a new song object and notifies subscribers', () => {
    const store = new SongStore(newSong());
    const before = store.get();
    let calls = 0;
    store.subscribe(() => calls++);
    store.update((s) => (s.bpm = 140));
    expect(store.get()).not.toBe(before);
    expect(before.bpm).toBe(125);
    expect(calls).toBe(1);
  });
});
