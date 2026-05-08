// React hook that wires the active CollabProvider into the deck store
// and reports the current pointer position as the local awareness cursor.
// Deliberately decoupled from the canvas; consumers feed pointer events.

import { useEffect } from 'react';
import { useDeckStore } from '../core/store/deck';
import { getCollabProvider } from './collab';

export function useCollabBinding() {
  useEffect(() => {
    const provider = getCollabProvider();
    if (!provider) return;
    const off1 = provider.onRemotePatch((patch) => {
      // Soft-merge: if the remote sends a snapshot, we replace the deck.
      // Real production code would translate Y events to immer patches.
      if (patch && typeof patch === 'object' && (patch as any).meta) {
        useDeckStore.getState().loadDeck(patch as any);
      }
    });
    return off1;
  }, []);
}

export function reportCollabCursor(x: number | null, y: number | null, slideId?: string) {
  const provider = getCollabProvider();
  if (!provider) return;
  if (x == null || y == null) provider.setLocalCursor(null);
  else provider.setLocalCursor({ x, y, slideId });
}
