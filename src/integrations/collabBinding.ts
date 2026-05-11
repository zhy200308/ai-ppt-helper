// React hook that wires the active CollabProvider into the deck store
// and reports the current pointer position as the local awareness cursor.
// Deliberately decoupled from the canvas; consumers feed pointer events.

import { useEffect, useState } from 'react';
import { useDeckStore } from '../core/store/deck';
import { getCollabProvider } from './collab';

export interface CollabPeer {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number; slideId?: string };
}

export function useCollabBinding() {
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  useEffect(() => {
    const bind = () => {
      const provider = getCollabProvider();
      if (!provider) return undefined;
      const offPatch = provider.onRemotePatch((patch) => {
        if (patch && typeof patch === 'object' && (patch as any).meta) {
          useDeckStore.getState().loadDeck(patch as any);
        }
      });
      const offAwareness = provider.onAwarenessChange(setPeers);
      return () => {
        offPatch();
        offAwareness();
      };
    };
    let cleanup = bind();
    const onActivated = () => {
      cleanup?.();
      cleanup = bind();
    };
    window.addEventListener('collab:activated', onActivated);
    return () => {
      cleanup?.();
      window.removeEventListener('collab:activated', onActivated);
    };
  }, []);
  return peers;
}

export function reportCollabCursor(x: number | null, y: number | null, slideId?: string) {
  const provider = getCollabProvider();
  if (!provider) return;
  if (x == null || y == null) provider.setLocalCursor(null);
  else provider.setLocalCursor({ x, y, slideId });
}
