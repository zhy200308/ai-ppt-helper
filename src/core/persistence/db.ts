import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Deck } from '../schema/types';

interface PptDB extends DBSchema {
  decks: {
    key: string;
    value: Deck;
    indexes: { 'by-updatedAt': number };
  };
  meta: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<PptDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PptDB>('ai-ppt-helper', 1, {
      upgrade(db) {
        const decks = db.createObjectStore('decks', { keyPath: 'meta.id' });
        decks.createIndex('by-updatedAt', 'meta.updatedAt');
        db.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
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
