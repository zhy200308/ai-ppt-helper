import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import { enablePatches, produceWithPatches, applyPatches, type Patch as ImmerPatch } from 'immer';
import type { Block, DataTable, Deck, ID, Selection, Slide, ThemeSpec } from '../schema/types';
import { createDeck, createSlide, newId } from '../schema/factory';

enablePatches();

const HISTORY_LIMIT = 200;

interface HistoryEntry {
  redo: ImmerPatch[];
  undo: ImmerPatch[];
  label: string;
  ts: number;
}

export interface DeckSliceState {
  deck: Deck;
  selection: Selection;
  history: {
    past: HistoryEntry[];
    future: HistoryEntry[];
  };
  // viewport
  zoom: number;
  pan: { x: number; y: number };
  // ephemeral UI state
  marqueeRect: { x: number; y: number; w: number; h: number } | null;
  presenting: boolean;
  dirty: boolean;
}

export interface DeckSliceActions {
  // history-aware mutation
  mutate: (label: string, recipe: (draft: Deck) => void, options?: { transient?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  // selection
  selectSlide: (slideId: ID | null) => void;
  selectBlocks: (slideId: ID, blockIds: ID[], opts?: { additive?: boolean }) => void;
  clearSelection: () => void;
  // slides
  addSlide: (after?: ID) => ID;
  duplicateSlide: (slideId: ID) => ID | null;
  removeSlide: (slideId: ID) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  setSlideBackground: (slideId: ID, bg: Slide['background']) => void;
  // blocks
  addBlock: (slideId: ID, block: Block) => void;
  removeBlocks: (slideId: ID, blockIds: ID[]) => void;
  updateBlock: (slideId: ID, blockId: ID, patch: Partial<Block>, options?: { transient?: boolean }) => void;
  updateBlocks: (slideId: ID, updates: { id: ID; patch: Partial<Block> }[], options?: { transient?: boolean }) => void;
  reorderBlock: (slideId: ID, blockId: ID, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  // theme & meta
  setTheme: (theme: Partial<ThemeSpec>) => void;
  setDeckTitle: (title: string) => void;
  // data tables (for chart / table dataRef)
  upsertDataTable: (table: DataTable) => void;
  removeDataTable: (id: ID) => void;
  setDataTableName: (id: ID, name: string) => void;
  setDataTableCell: (id: ID, rowIdx: number, colKey: string, value: string | number) => void;
  addDataTableRow: (id: ID, row?: Record<string, string | number>) => void;
  removeDataTableRow: (id: ID, rowIdx: number) => void;
  addDataTableColumn: (id: ID, col: { key: string; label: string; type: 'string' | 'number' | 'date' }) => void;
  removeDataTableColumn: (id: ID, key: string) => void;
  // viewport
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setMarquee: (rect: DeckSliceState['marqueeRect']) => void;
  setPresenting: (v: boolean) => void;
  // bulk
  loadDeck: (deck: Deck) => void;
  newDeck: (title?: string) => void;
  // mark clean (after autosave)
  markSaved: () => void;
}

export type DeckStore = DeckSliceState & DeckSliceActions;

const initialDeck = createDeck();

export const useDeckStore = create<DeckStore>()(
  subscribeWithSelector((set, get) => ({
    deck: initialDeck,
    selection: { slideId: initialDeck.slides[0]?.id ?? null, blockIds: [] },
    history: { past: [], future: [] },
    zoom: 0.5,
    pan: { x: 0, y: 0 },
    marqueeRect: null,
    presenting: false,
    dirty: false,

    mutate: (label, recipe, options) => {
      const state = get();
      const [next, patches, inverse] = produceWithPatches(state.deck, (draft) => {
        recipe(draft);
        draft.meta.updatedAt = Date.now();
      });
      if (patches.length === 0) return;
      if (options?.transient) {
        set({ deck: next as Deck, dirty: true });
        return;
      }
      const entry: HistoryEntry = { redo: patches, undo: inverse, label, ts: Date.now() };
      const past = [...state.history.past, entry];
      if (past.length > HISTORY_LIMIT) past.shift();
      set({
        deck: next as Deck,
        history: { past, future: [] },
        dirty: true,
      });
    },

    undo: () => {
      const { history, deck } = get();
      const last = history.past[history.past.length - 1];
      if (!last) return;
      const next = applyPatches(deck, last.undo);
      set({
        deck: next,
        history: {
          past: history.past.slice(0, -1),
          future: [last, ...history.future],
        },
        dirty: true,
      });
    },

    redo: () => {
      const { history, deck } = get();
      const head = history.future[0];
      if (!head) return;
      const next = applyPatches(deck, head.redo);
      set({
        deck: next,
        history: {
          past: [...history.past, head],
          future: history.future.slice(1),
        },
        dirty: true,
      });
    },

    selectSlide: (slideId) =>
      set((s) => ({ selection: { slideId, blockIds: slideId === s.selection.slideId ? s.selection.blockIds : [] } })),

    selectBlocks: (slideId, blockIds, opts) =>
      set((s) => {
        const same = slideId === s.selection.slideId;
        const next = opts?.additive && same
          ? Array.from(new Set([...s.selection.blockIds, ...blockIds]))
          : blockIds;
        return { selection: { slideId, blockIds: next } };
      }),

    clearSelection: () => set((s) => ({ selection: { slideId: s.selection.slideId, blockIds: [] } })),

    addSlide: (after) => {
      const id = newId('sld');
      get().mutate('Add slide', (draft) => {
        const slide = createSlide({ id });
        const idx = after ? draft.slides.findIndex((s) => s.id === after) : draft.slides.length - 1;
        const insertAt = idx >= 0 ? idx + 1 : draft.slides.length;
        draft.slides.splice(insertAt, 0, slide);
      });
      set({ selection: { slideId: id, blockIds: [] } });
      return id;
    },

    duplicateSlide: (slideId) => {
      const { deck } = get();
      const orig = deck.slides.find((s) => s.id === slideId);
      if (!orig) return null;
      const newSlideId = newId('sld');
      get().mutate('Duplicate slide', (draft) => {
        const idx = draft.slides.findIndex((s) => s.id === slideId);
        const cloned: Slide = JSON.parse(JSON.stringify(orig));
        cloned.id = newSlideId;
        cloned.blocks = cloned.blocks.map((b) => ({ ...b, id: newId('blk') }));
        draft.slides.splice(idx + 1, 0, cloned);
      });
      set({ selection: { slideId: newSlideId, blockIds: [] } });
      return newSlideId;
    },

    removeSlide: (slideId) => {
      get().mutate('Remove slide', (draft) => {
        const idx = draft.slides.findIndex((s) => s.id === slideId);
        if (idx < 0) return;
        draft.slides.splice(idx, 1);
        if (draft.slides.length === 0) {
          draft.slides.push(createSlide());
        }
      });
      const slides = get().deck.slides;
      set({ selection: { slideId: slides[0]?.id ?? null, blockIds: [] } });
    },

    reorderSlides: (fromIndex, toIndex) => {
      get().mutate('Reorder slides', (draft) => {
        if (fromIndex < 0 || fromIndex >= draft.slides.length) return;
        const [moved] = draft.slides.splice(fromIndex, 1);
        const target = Math.max(0, Math.min(toIndex, draft.slides.length));
        draft.slides.splice(target, 0, moved);
      });
    },

    setSlideBackground: (slideId, bg) => {
      get().mutate('Change background', (draft) => {
        const s = draft.slides.find((x) => x.id === slideId);
        if (s) s.background = bg;
      });
    },

    addBlock: (slideId, block) => {
      get().mutate('Add block', (draft) => {
        const s = draft.slides.find((x) => x.id === slideId);
        if (!s) return;
        const maxZ = s.blocks.reduce((m, b) => Math.max(m, b.z), 0);
        s.blocks.push({ ...block, z: maxZ + 1 });
      });
      set({ selection: { slideId, blockIds: [block.id] } });
    },

    removeBlocks: (slideId, blockIds) => {
      get().mutate('Remove block(s)', (draft) => {
        const s = draft.slides.find((x) => x.id === slideId);
        if (!s) return;
        s.blocks = s.blocks.filter((b) => !blockIds.includes(b.id));
      });
      set((st) => ({
        selection: { slideId: st.selection.slideId, blockIds: st.selection.blockIds.filter((id) => !blockIds.includes(id)) },
      }));
    },

    updateBlock: (slideId, blockId, patch, options) => {
      get().mutate(
        'Edit block',
        (draft) => {
          const s = draft.slides.find((x) => x.id === slideId);
          if (!s) return;
          const b = s.blocks.find((x) => x.id === blockId);
          if (!b) return;
          Object.assign(b, patch);
        },
        options,
      );
    },

    updateBlocks: (slideId, updates, options) => {
      get().mutate(
        'Edit blocks',
        (draft) => {
          const s = draft.slides.find((x) => x.id === slideId);
          if (!s) return;
          for (const u of updates) {
            const b = s.blocks.find((x) => x.id === u.id);
            if (b) Object.assign(b, u.patch);
          }
        },
        options,
      );
    },

    reorderBlock: (slideId, blockId, direction) => {
      get().mutate('Reorder layer', (draft) => {
        const s = draft.slides.find((x) => x.id === slideId);
        if (!s) return;
        const sorted = [...s.blocks].sort((a, b) => a.z - b.z);
        const idx = sorted.findIndex((b) => b.id === blockId);
        if (idx < 0) return;
        let target = idx;
        if (direction === 'up') target = Math.min(sorted.length - 1, idx + 1);
        else if (direction === 'down') target = Math.max(0, idx - 1);
        else if (direction === 'top') target = sorted.length - 1;
        else if (direction === 'bottom') target = 0;
        if (target === idx) return;
        const [moved] = sorted.splice(idx, 1);
        sorted.splice(target, 0, moved);
        sorted.forEach((b, i) => {
          const real = s.blocks.find((x) => x.id === b.id);
          if (real) real.z = i + 1;
        });
      });
    },

    setTheme: (theme) => {
      get().mutate('Change theme', (draft) => {
        draft.theme = { ...draft.theme, ...theme };
      });
    },

    setDeckTitle: (title) => {
      get().mutate('Rename deck', (draft) => {
        draft.meta.title = title;
      });
    },

    upsertDataTable: (table) => {
      get().mutate('Upsert data table', (draft) => {
        if (!draft.dataTables) draft.dataTables = {};
        draft.dataTables[table.id] = { ...table, updatedAt: Date.now() };
      });
    },
    removeDataTable: (id) => {
      get().mutate('Remove data table', (draft) => {
        if (draft.dataTables) delete draft.dataTables[id];
      });
    },
    setDataTableName: (id, name) => {
      get().mutate('Rename data table', (draft) => {
        const t = draft.dataTables?.[id];
        if (t) { t.name = name; t.updatedAt = Date.now(); }
      });
    },
    setDataTableCell: (id, rowIdx, colKey, value) => {
      get().mutate('Edit data cell', (draft) => {
        const t = draft.dataTables?.[id];
        if (!t || !t.rows[rowIdx]) return;
        t.rows[rowIdx][colKey] = value;
        t.updatedAt = Date.now();
      });
    },
    addDataTableRow: (id, row) => {
      get().mutate('Add data row', (draft) => {
        const t = draft.dataTables?.[id];
        if (!t) return;
        const fresh: Record<string, string | number> = {};
        for (const c of t.columns) fresh[c.key] = row?.[c.key] ?? (c.type === 'number' ? 0 : '');
        t.rows.push(fresh);
        t.updatedAt = Date.now();
      });
    },
    removeDataTableRow: (id, rowIdx) => {
      get().mutate('Remove data row', (draft) => {
        const t = draft.dataTables?.[id];
        if (!t) return;
        t.rows.splice(rowIdx, 1);
        t.updatedAt = Date.now();
      });
    },
    addDataTableColumn: (id, col) => {
      get().mutate('Add data column', (draft) => {
        const t = draft.dataTables?.[id];
        if (!t) return;
        if (t.columns.some((c) => c.key === col.key)) return;
        t.columns.push(col);
        for (const r of t.rows) r[col.key] = col.type === 'number' ? 0 : '';
        t.updatedAt = Date.now();
      });
    },
    removeDataTableColumn: (id, key) => {
      get().mutate('Remove data column', (draft) => {
        const t = draft.dataTables?.[id];
        if (!t) return;
        t.columns = t.columns.filter((c) => c.key !== key);
        for (const r of t.rows) delete r[key];
        t.updatedAt = Date.now();
      });
    },

    setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(4, zoom)) }),
    setPan: (pan) => set({ pan }),
    setMarquee: (rect) => set({ marqueeRect: rect }),
    setPresenting: (v) => set({ presenting: v }),

    loadDeck: (deck) =>
      set({
        deck,
        selection: { slideId: deck.slides[0]?.id ?? null, blockIds: [] },
        history: { past: [], future: [] },
        dirty: false,
      }),

    newDeck: (title) => {
      const d = createDeck(title ?? 'Untitled Presentation');
      set({
        deck: d,
        selection: { slideId: d.slides[0]?.id ?? null, blockIds: [] },
        history: { past: [], future: [] },
        dirty: true,
      });
    },

    markSaved: () => set({ dirty: false }),
  })),
);

export function useActiveSlide(): Slide | null {
  return useDeckStore((s) => {
    const id = s.selection.slideId;
    return s.deck.slides.find((x) => x.id === id) ?? s.deck.slides[0] ?? null;
  });
}

export function useSelectedBlocks(): Block[] {
  return useDeckStore(
    useShallow((s) => {
      const slide = s.deck.slides.find((x) => x.id === s.selection.slideId);
      if (!slide) return [] as Block[];
      const ids = new Set(s.selection.blockIds);
      return slide.blocks.filter((b) => ids.has(b.id));
    }),
  );
}
