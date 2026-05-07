import { useEffect, useRef } from 'react';
import { useDeckStore } from '../store/deck';
import { getMeta, loadDeck, saveDeck, setMeta } from './db';

const DEBOUNCE_MS = 600;
const LAST_DECK_KEY = 'last-deck-id';

export function useAutosave() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ready = useRef(false);

  // Bootstrap: try to restore the last deck
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lastId = await getMeta<string>(LAST_DECK_KEY);
      if (lastId) {
        const deck = await loadDeck(lastId);
        if (!cancelled && deck) {
          useDeckStore.getState().loadDeck(deck);
        }
      }
      ready.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  // Subscribe to deck changes; debounce a write.
  useEffect(() => {
    return useDeckStore.subscribe(
      (s) => s.deck,
      (deck) => {
        if (!ready.current) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
          await saveDeck(deck);
          await setMeta(LAST_DECK_KEY, deck.meta.id);
          useDeckStore.getState().markSaved();
        }, DEBOUNCE_MS);
      },
    );
  }, []);
}
