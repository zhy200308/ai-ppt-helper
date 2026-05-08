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
  meta: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<PptDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PptDB>('ai-ppt-helper', 2, {
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
