import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from './deck';
import { createTextBlock, createShapeBlock } from '../schema/factory';

beforeEach(() => {
  useDeckStore.getState().newDeck('Test');
});

describe('deck store', () => {
  it('initializes with one slide and selection', () => {
    const s = useDeckStore.getState();
    expect(s.deck.slides.length).toBe(1);
    expect(s.selection.slideId).toBe(s.deck.slides[0].id);
  });

  it('add / remove / duplicate slide', () => {
    const id = useDeckStore.getState().addSlide();
    expect(useDeckStore.getState().deck.slides.length).toBe(2);
    const dupId = useDeckStore.getState().duplicateSlide(id);
    expect(dupId).not.toBeNull();
    expect(useDeckStore.getState().deck.slides.length).toBe(3);
    useDeckStore.getState().removeSlide(id);
    expect(useDeckStore.getState().deck.slides.length).toBe(2);
  });

  it('reorder slides preserves count', () => {
    useDeckStore.getState().addSlide();
    useDeckStore.getState().addSlide();
    const before = useDeckStore.getState().deck.slides.map((x) => x.id);
    useDeckStore.getState().reorderSlides(0, 2);
    const after = useDeckStore.getState().deck.slides.map((x) => x.id);
    expect(after.length).toBe(before.length);
    expect(new Set(after)).toEqual(new Set(before));
    expect(after[2]).toBe(before[0]);
  });

  it('add block + undo + redo round-trips', () => {
    const slideId = useDeckStore.getState().selection.slideId!;
    const block = createTextBlock();
    useDeckStore.getState().addBlock(slideId, block);
    expect(useDeckStore.getState().deck.slides[0].blocks.some((b) => b.id === block.id)).toBe(true);
    useDeckStore.getState().undo();
    expect(useDeckStore.getState().deck.slides[0].blocks.some((b) => b.id === block.id)).toBe(false);
    useDeckStore.getState().redo();
    expect(useDeckStore.getState().deck.slides[0].blocks.some((b) => b.id === block.id)).toBe(true);
  });

  it('updateBlocks transient does not push history', () => {
    const slideId = useDeckStore.getState().selection.slideId!;
    const block = createShapeBlock();
    useDeckStore.getState().addBlock(slideId, block);
    const beforeLen = useDeckStore.getState().history.past.length;
    useDeckStore.getState().updateBlocks(slideId, [{ id: block.id, patch: { x: 999 } }], { transient: true });
    expect(useDeckStore.getState().history.past.length).toBe(beforeLen);
    expect(useDeckStore.getState().deck.slides[0].blocks.find((b) => b.id === block.id)?.x).toBe(999);
  });

  it('multi-select then deselect', () => {
    const slideId = useDeckStore.getState().selection.slideId!;
    const a = createTextBlock();
    const b = createShapeBlock();
    useDeckStore.getState().addBlock(slideId, a);
    useDeckStore.getState().addBlock(slideId, b);
    useDeckStore.getState().selectBlocks(slideId, [a.id, b.id]);
    expect(useDeckStore.getState().selection.blockIds.length).toBe(2);
    useDeckStore.getState().clearSelection();
    expect(useDeckStore.getState().selection.blockIds.length).toBe(0);
  });

  it('reorder layer puts block on top', () => {
    const slideId = useDeckStore.getState().selection.slideId!;
    const a = createTextBlock();
    const b = createShapeBlock();
    useDeckStore.getState().addBlock(slideId, a);
    useDeckStore.getState().addBlock(slideId, b);
    useDeckStore.getState().reorderBlock(slideId, a.id, 'top');
    const slide = useDeckStore.getState().deck.slides[0];
    const aZ = slide.blocks.find((x) => x.id === a.id)!.z;
    const bZ = slide.blocks.find((x) => x.id === b.id)!.z;
    expect(aZ).toBeGreaterThan(bZ);
  });
});
