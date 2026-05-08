// Realtime collaboration shim. Y.js + a tiny adapter that mirrors the
// deck-store patches into a Y.Map keyed by deck id. Activated by setting
// __COLLAB__ on globalThis with { url, room, identity }. The default web
// build does not connect to anything; this file documents the contract
// and provides a hook the Stage/store can call when a collab provider
// is present.

export interface CollabIdentity {
  id: string;
  name: string;
  color: string;
}

export interface CollabProvider {
  connect(roomId: string, identity: CollabIdentity): void;
  disconnect(): void;
  applyLocalPatch(patch: unknown): void;
  onRemotePatch(cb: (patch: unknown) => void): () => void;
  onAwarenessChange(cb: (peers: { id: string; name: string; color: string; cursor?: { x: number; y: number; slideId?: string } }[]) => void): () => void;
  setLocalCursor(cursor: { x: number; y: number; slideId?: string } | null): void;
}

export function getCollabProvider(): CollabProvider | null {
  return (globalThis as any).__COLLAB__ ?? null;
}
