import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Deck } from '../schema/types';

export interface ChatSession {
  id: string;
  deckId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: unknown[]; // ChatSessionMessage shape lives in orchestrator; stored opaque here
}

export interface DeckSnapshot {
  id: string;
  deckId: string;
  ts: number;
  label: string;
  trigger: 'manual' | 'auto' | 'ai';
  // Full deck state at the time of snapshot. Cheaper than streaming
  // patches per slide and keeps recovery O(1).
  deck: Deck;
}

interface PptDB extends DBSchema {
  decks: {
    key: string;
    value: Deck;
    indexes: { 'by-updatedAt': number };
  };
  chatSessions: {
    key: string;
    value: ChatSession;
    indexes: { 'by-deck': string; 'by-updatedAt': number };
  };
  snapshots: {
    key: string;
    value: DeckSnapshot;
    indexes: { 'by-deck': string; 'by-ts': number };
  };
  meta: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<PptDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PptDB>('ai-ppt-helper', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const decks = db.createObjectStore('decks', { keyPath: 'meta.id' });
          decks.createIndex('by-updatedAt', 'meta.updatedAt');
          db.createObjectStore('meta');
        }
        if (oldVersion < 2) {
          const chats = db.createObjectStore('chatSessions', { keyPath: 'id' });
          chats.createIndex('by-deck', 'deckId');
          chats.createIndex('by-updatedAt', 'updatedAt');
        }
        if (oldVersion < 3) {
          const snaps = db.createObjectStore('snapshots', { keyPath: 'id' });
          snaps.createIndex('by-deck', 'deckId');
          snaps.createIndex('by-ts', 'ts');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  const db = await getDB();
  await db.put('chatSessions', session);
}

export async function loadChatSession(id: string): Promise<ChatSession | undefined> {
  const db = await getDB();
  return db.get('chatSessions', id);
}

export async function listChatSessionsByDeck(deckId: string): Promise<ChatSession[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('chatSessions', 'by-deck', deckId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteChatSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('chatSessions', id);
}

const SNAPSHOT_KEEP = 50;

export async function saveSnapshot(snap: DeckSnapshot): Promise<void> {
  const db = await getDB();
  await db.put('snapshots', snap);
  // Trim old per-deck snapshots beyond SNAPSHOT_KEEP.
  const all = await db.getAllFromIndex('snapshots', 'by-deck', snap.deckId);
  if (all.length > SNAPSHOT_KEEP) {
    const sorted = all.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < sorted.length - SNAPSHOT_KEEP; i++) {
      await db.delete('snapshots', sorted[i].id);
    }
  }
}

export async function listSnapshots(deckId: string): Promise<DeckSnapshot[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('snapshots', 'by-deck', deckId);
  return all.sort((a, b) => b.ts - a.ts);
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('snapshots', id);
}

export async function saveDeck(deck: Deck): Promise<void> {
  const db = await getDB();
  await db.put('decks', deck);
}

export async function loadDeck(id: string): Promise<Deck | undefined> {
  const db = await getDB();
  return db.get('decks', id);
}

export async function listDecks(): Promise<Deck[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('decks', 'by-updatedAt');
  return all.reverse();
}

export async function deleteDeckById(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('decks', id);
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('meta', key) as Promise<T | undefined>;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', value, key);
}
