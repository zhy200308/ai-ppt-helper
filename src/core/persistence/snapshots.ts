// Snapshot lifecycle: track significant store mutations and persist a
// fresh copy of the deck every N edits or every M minutes. Provides a
// React hook the App mounts once; the Timeline UI consumes the IDB store.

import { useEffect, useRef } from 'react';
import { useDeckStore } from '../store/deck';
import { saveSnapshot } from './db';

const EVERY_N_EDITS = 25;
const EVERY_MS = 5 * 60 * 1000;

export function useAutoSnapshots() {
  const editCount = useRef(0);
  const lastTs = useRef(Date.now());

  useEffect(() => {
    return useDeckStore.subscribe(
      (s) => s.history.past.length,
      async (past) => {
        editCount.current = past;
        const now = Date.now();
        const sinceN = past > 0 && past % EVERY_N_EDITS === 0;
        const sinceT = now - lastTs.current >= EVERY_MS;
        if (!sinceN && !sinceT) return;
        const deck = useDeckStore.getState().deck;
        await saveSnapshot({
          id: `snap_${deck.meta.id}_${now.toString(36)}`,
          deckId: deck.meta.id,
          ts: now,
          label: sinceN ? `自动 (${past} 步编辑)` : '自动 (定时)',
          trigger: 'auto',
          deck: structuredClone(deck),
        });
        lastTs.current = now;
      },
    );
  }, []);
}

export async function captureSnapshot(label: string, trigger: 'manual' | 'ai' = 'manual') {
  if (typeof indexedDB === 'undefined') return;
  const deck = useDeckStore.getState().deck;
  await saveSnapshot({
    id: `snap_${deck.meta.id}_${Date.now().toString(36)}`,
    deckId: deck.meta.id,
    ts: Date.now(),
    label,
    trigger,
    deck: structuredClone(deck),
  });
}
