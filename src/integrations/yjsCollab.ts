// Y.js-backed CollabProvider. Mirrors the deck JSON into a Y.Map keyed by
// "deck", forwards immer patches as updates, and exposes awareness for
// peer cursors. Activated via window.__COLLAB__ at boot:
//
//   import { activateYjsCollab } from './integrations/yjsCollab';
//   activateYjsCollab({ url: 'wss://yroom.example.com', room: 'deck-42' });
//
// We dynamic-import yjs / y-websocket so the main bundle stays small.

import type { CollabIdentity, CollabProvider } from './collab';

export interface YjsCollabOptions {
  url: string;
  room: string;
  identity?: CollabIdentity;
}

export async function activateYjsCollab(opts: YjsCollabOptions): Promise<CollabProvider> {
  const Y = await import(/* @vite-ignore */ 'yjs');
  const { WebsocketProvider } = await import(/* @vite-ignore */ 'y-websocket');

  const doc = new Y.Doc();
  const wsProvider = new WebsocketProvider(opts.url, opts.room, doc);
  const root = doc.getMap<unknown>('deck');
  const remoteListeners = new Set<(patch: unknown) => void>();
  const awarenessListeners = new Set<(peers: any[]) => void>();

  let identity = opts.identity;
  const awareness = wsProvider.awareness;
  if (identity) {
    awareness.setLocalStateField('user', { id: identity.id, name: identity.name, color: identity.color });
  }

  awareness.on('change', () => {
    const peers: any[] = [];
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === doc.clientID) return;
      const u = state.user as CollabIdentity | undefined;
      if (!u) return;
      peers.push({ id: u.id, name: u.name, color: u.color, cursor: state.cursor });
    });
    awarenessListeners.forEach((l) => l(peers));
  });

  root.observeDeep((_, transaction) => {
    if (transaction.origin === 'local') return;
    const snapshot = root.get('snapshot');
    if (snapshot) remoteListeners.forEach((l) => l(snapshot));
  });

  const provider: CollabProvider = {
    connect(roomId: string, who: CollabIdentity) {
      identity = who;
      awareness.setLocalStateField('user', { id: who.id, name: who.name, color: who.color });
      void roomId;
    },
    disconnect() {
      wsProvider.destroy();
      doc.destroy();
    },
    applyLocalPatch(patch: unknown) {
      doc.transact(() => {
        root.set('snapshot', patch);
      }, 'local');
    },
    onRemotePatch(cb) {
      remoteListeners.add(cb);
      const snapshot = root.get('snapshot');
      if (snapshot) cb(snapshot);
      return () => remoteListeners.delete(cb);
    },
    onAwarenessChange(cb) {
      awarenessListeners.add(cb as any);
      return () => awarenessListeners.delete(cb as any);
    },
    setLocalCursor(cursor) {
      awareness.setLocalStateField('cursor', cursor);
    },
  };

  (globalThis as any).__COLLAB__ = provider;
  return provider;
}
