import { useEffect } from 'react';
import { useDeckStore } from '../store/deck';
import { createShapeBlock, createTextBlock } from '../schema/factory';

const isInputTarget = (t: EventTarget | null) => {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export function useGlobalHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isInputTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const store = useDeckStore.getState();
      const slideId = store.selection.slideId;
      const blockIds = store.selection.blockIds;

      // Undo / Redo
      if (meta && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        store.undo();
        return;
      }
      if (meta && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        store.redo();
        return;
      }

      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && slideId && blockIds.length) {
        e.preventDefault();
        store.removeBlocks(slideId, blockIds);
        return;
      }

      // Duplicate
      if (meta && e.key.toLowerCase() === 'd' && slideId && blockIds.length) {
        e.preventDefault();
        const slide = store.deck.slides.find((s) => s.id === slideId);
        if (!slide) return;
        const newIds: string[] = [];
        store.mutate('Duplicate blocks', (draft) => {
          const s = draft.slides.find((x) => x.id === slideId);
          if (!s) return;
          for (const id of blockIds) {
            const b = s.blocks.find((x) => x.id === id);
            if (!b) continue;
            const copy = JSON.parse(JSON.stringify(b));
            copy.id = `blk_${Math.random().toString(36).slice(2, 12)}`;
            copy.x += 24;
            copy.y += 24;
            copy.z = (s.blocks[s.blocks.length - 1]?.z ?? 0) + 1;
            s.blocks.push(copy);
            newIds.push(copy.id);
          }
        });
        store.selectBlocks(slideId, newIds);
        return;
      }

      // Select all
      if (meta && e.key.toLowerCase() === 'a' && slideId) {
        e.preventDefault();
        const slide = store.deck.slides.find((s) => s.id === slideId);
        if (slide) store.selectBlocks(slideId, slide.blocks.map((b) => b.id));
        return;
      }

      // Arrow nudges
      if (slideId && blockIds.length && (e.key.startsWith('Arrow'))) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (dx || dy) {
          e.preventDefault();
          store.mutate('Nudge', (draft) => {
            const s = draft.slides.find((x) => x.id === slideId);
            if (!s) return;
            for (const id of blockIds) {
              const b = s.blocks.find((x) => x.id === id);
              if (b) {
                b.x += dx;
                b.y += dy;
              }
            }
          });
          return;
        }
      }

      // Zoom shortcuts
      if (meta && (e.key === '0')) {
        e.preventDefault();
        store.setZoom(0.5);
        return;
      }
      if (meta && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        store.setZoom(store.zoom * 1.2);
        return;
      }
      if (meta && e.key === '-') {
        e.preventDefault();
        store.setZoom(store.zoom / 1.2);
        return;
      }

      // Quick add
      if (e.key === 't' && !meta && slideId) {
        e.preventDefault();
        store.addBlock(slideId, createTextBlock());
        return;
      }
      if (e.key === 'r' && !meta && slideId) {
        e.preventDefault();
        store.addBlock(slideId, createShapeBlock());
        return;
      }

      // Layer order
      if (meta && e.shiftKey && e.key === ']' && slideId && blockIds.length) {
        e.preventDefault();
        for (const id of blockIds) store.reorderBlock(slideId, id, 'top');
        return;
      }
      if (meta && e.shiftKey && e.key === '[' && slideId && blockIds.length) {
        e.preventDefault();
        for (const id of blockIds) store.reorderBlock(slideId, id, 'bottom');
        return;
      }

      if (e.key === 'Escape') {
        store.clearSelection();
        store.setPresenting(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
