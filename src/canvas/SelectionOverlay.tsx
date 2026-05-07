import { useCallback, useRef } from 'react';
import { useDeckStore } from '../core/store/deck';
import type { Block, ID, Slide } from '../core/schema/types';
import { computeSnap, blockToRect, type SnapGuide } from './interactions/snap';
import { rectsBoundingBox } from '../utils/math';

const HANDLE_SIZE = 10;
const ROTATE_HANDLE_OFFSET = 28;

type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const ALL_HANDLES: Direction[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Props {
  slide: Slide;
  selectedIds: ID[];
  zoom: number;
  deckWidth: number;
  deckHeight: number;
  onSetGuides: (guides: SnapGuide[]) => void;
}

export function SelectionOverlay({ slide, selectedIds, zoom, deckWidth, deckHeight, onSetGuides }: Props) {
  const updateBlocks = useDeckStore((s) => s.updateBlocks);

  const selected = slide.blocks.filter((b) => selectedIds.includes(b.id));
  if (selected.length === 0) return null;

  const bbox = rectsBoundingBox(selected.map(blockToRect));
  const isSingle = selected.length === 1;
  const single = selected[0];

  return (
    <>
      <div
        data-overlay-handle
        style={{
          position: 'absolute',
          left: bbox.x,
          top: bbox.y,
          width: bbox.w,
          height: bbox.h,
          border: `${1.5 / zoom}px solid #4F46E5`,
          pointerEvents: 'none',
        }}
      />
      {ALL_HANDLES.map((dir) => (
        <ResizeHandle
          key={dir}
          dir={dir}
          bbox={bbox}
          zoom={zoom}
          slide={slide}
          selected={selected}
          deckWidth={deckWidth}
          deckHeight={deckHeight}
          onSetGuides={onSetGuides}
          updateBlocks={updateBlocks}
        />
      ))}
      {isSingle && (
        <RotateHandle
          bbox={bbox}
          block={single}
          zoom={zoom}
          updateBlocks={updateBlocks}
          slideId={slide.id}
        />
      )}
    </>
  );
}

function ResizeHandle({
  dir,
  bbox,
  zoom,
  slide,
  selected,
  deckWidth,
  deckHeight,
  onSetGuides,
  updateBlocks,
}: {
  dir: Direction;
  bbox: { x: number; y: number; w: number; h: number };
  zoom: number;
  slide: Slide;
  selected: Block[];
  deckWidth: number;
  deckHeight: number;
  onSetGuides: (guides: SnapGuide[]) => void;
  updateBlocks: ReturnType<typeof useDeckStore.getState>['updateBlocks'];
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const startClient = { x: e.clientX, y: e.clientY };
      const orig = selected.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
      const refs = slide.blocks.filter((b) => !selected.some((s) => s.id === b.id)).map(blockToRect);
      const startBbox = { ...bbox };
      ref.current?.setPointerCapture(e.pointerId);
      let raf = 0;
      let pending: PointerEvent | null = null;

      const onMove = (ev: PointerEvent) => {
        pending = ev;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!pending) return;
          const dx = (pending.clientX - startClient.x) / zoom;
          const dy = (pending.clientY - startClient.y) / zoom;
          const next = applyResize(startBbox, dir, dx, dy, pending.shiftKey, pending.altKey);
          // Snap on the corresponding moving edges.
          const snap = computeSnap(next, refs, {
            threshold: 6,
            deckWidth,
            deckHeight,
          });
          const finalRect = pending.shiftKey
            ? next
            : applySnapToResize(next, dir, snap.dx, snap.dy);
          // Project bbox transform to each selected block.
          const updates = orig.map((b) => {
            const rx = startBbox.w === 0 ? 0 : (b.x - startBbox.x) / startBbox.w;
            const ry = startBbox.h === 0 ? 0 : (b.y - startBbox.y) / startBbox.h;
            const rw = startBbox.w === 0 ? 0 : b.w / startBbox.w;
            const rh = startBbox.h === 0 ? 0 : b.h / startBbox.h;
            return {
              id: b.id,
              patch: {
                x: Math.round(finalRect.x + rx * finalRect.w),
                y: Math.round(finalRect.y + ry * finalRect.h),
                w: Math.max(8, Math.round(rw * finalRect.w)),
                h: Math.max(8, Math.round(rh * finalRect.h)),
              },
            };
          });
          updateBlocks(slide.id, updates, { transient: true });
          onSetGuides(pending.shiftKey ? [] : snap.guides);
          pending = null;
        });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (raf) cancelAnimationFrame(raf);
        // Commit final position into history.
        const finalUpdates = orig.map((b) => {
          const cur = useDeckStore.getState().deck.slides
            .find((s) => s.id === slide.id)
            ?.blocks.find((x) => x.id === b.id);
          if (!cur) return null;
          return { id: b.id, patch: { x: cur.x, y: cur.y, w: cur.w, h: cur.h } };
        }).filter(Boolean) as { id: ID; patch: any }[];
        if (finalUpdates.length) updateBlocks(slide.id, finalUpdates);
        onSetGuides([]);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [bbox, dir, slide, selected, zoom, updateBlocks, onSetGuides, deckWidth, deckHeight],
  );

  const pos = handlePosition(dir, bbox);
  return (
    <div
      ref={ref}
      data-overlay-handle
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: pos.x - HANDLE_SIZE / (2 * zoom),
        top: pos.y - HANDLE_SIZE / (2 * zoom),
        width: HANDLE_SIZE / zoom,
        height: HANDLE_SIZE / zoom,
        background: '#fff',
        border: `${1.5 / zoom}px solid #4F46E5`,
        cursor: cursorFor(dir),
        zIndex: 10,
      }}
    />
  );
}

function RotateHandle({
  bbox,
  block,
  zoom,
  updateBlocks,
  slideId,
}: {
  bbox: { x: number; y: number; w: number; h: number };
  block: Block;
  zoom: number;
  updateBlocks: ReturnType<typeof useDeckStore.getState>['updateBlocks'];
  slideId: ID;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const cx = bbox.x + bbox.w / 2;
      const cy = bbox.y + bbox.h / 2;
      const startRotation = block.rotation ?? 0;
      const startAngle = Math.atan2(e.clientY - 0, e.clientX - 0); // overwritten below
      // Use the click point in deck space.
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const initialClient = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const initialAngle = Math.atan2(initialClient.y, initialClient.x);
      void startAngle;
      void initialAngle;
      void cx;
      void cy;
      ref.current?.setPointerCapture(e.pointerId);

      const stageEl = (e.currentTarget as HTMLElement).closest('.stage') as HTMLElement;
      const stageRect = stageEl.getBoundingClientRect();
      const centerClientX = stageRect.left + (cx * zoom) + (stageEl.offsetLeft - stageRect.left + stageRect.left);
      void centerClientX;
      // Simpler: track angle from event.clientX/Y to the bbox center transformed to client.
      const stageMatrix = (() => {
        const s = stageEl.getBoundingClientRect();
        return {
          left: s.left,
          top: s.top,
        };
      })();
      const centerClient = {
        x: stageMatrix.left + cx * zoom,
        y: stageMatrix.top + cy * zoom,
      };
      const startA = Math.atan2(e.clientY - centerClient.y, e.clientX - centerClient.x);

      let raf = 0;
      let pending: PointerEvent | null = null;
      const onMove = (ev: PointerEvent) => {
        pending = ev;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!pending) return;
          const a = Math.atan2(pending.clientY - centerClient.y, pending.clientX - centerClient.x);
          let deg = startRotation + ((a - startA) * 180) / Math.PI;
          if (pending.shiftKey) deg = Math.round(deg / 15) * 15;
          updateBlocks(slideId, [{ id: block.id, patch: { rotation: deg } }], { transient: true });
          pending = null;
        });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (raf) cancelAnimationFrame(raf);
        const cur = useDeckStore.getState().deck.slides.find((s) => s.id === slideId)?.blocks.find((x) => x.id === block.id);
        if (cur) updateBlocks(slideId, [{ id: block.id, patch: { rotation: cur.rotation } }]);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [bbox, block.id, block.rotation, slideId, zoom, updateBlocks],
  );

  return (
    <div
      ref={ref}
      data-overlay-handle
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: bbox.x + bbox.w / 2 - HANDLE_SIZE / (2 * zoom),
        top: bbox.y - ROTATE_HANDLE_OFFSET / zoom - HANDLE_SIZE / (2 * zoom),
        width: HANDLE_SIZE / zoom,
        height: HANDLE_SIZE / zoom,
        borderRadius: '50%',
        background: '#fff',
        border: `${1.5 / zoom}px solid #4F46E5`,
        cursor: 'grab',
        zIndex: 10,
      }}
    />
  );
}

function handlePosition(dir: Direction, b: { x: number; y: number; w: number; h: number }) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  switch (dir) {
    case 'n': return { x: cx, y: y0 };
    case 's': return { x: cx, y: y1 };
    case 'e': return { x: x1, y: cy };
    case 'w': return { x: x0, y: cy };
    case 'nw': return { x: x0, y: y0 };
    case 'ne': return { x: x1, y: y0 };
    case 'sw': return { x: x0, y: y1 };
    case 'se': return { x: x1, y: y1 };
  }
}

function cursorFor(dir: Direction): string {
  switch (dir) {
    case 'n': case 's': return 'ns-resize';
    case 'e': case 'w': return 'ew-resize';
    case 'nw': case 'se': return 'nwse-resize';
    case 'ne': case 'sw': return 'nesw-resize';
  }
}

function applyResize(
  start: { x: number; y: number; w: number; h: number },
  dir: Direction,
  dx: number,
  dy: number,
  proportional: boolean,
  fromCenter: boolean,
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = start;
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;
  if (dir.includes('e')) nw = w + dx;
  if (dir.includes('w')) {
    nw = w - dx;
    nx = x + dx;
  }
  if (dir.includes('s')) nh = h + dy;
  if (dir.includes('n')) {
    nh = h - dy;
    ny = y + dy;
  }
  if (proportional && w > 0 && h > 0) {
    const ratio = w / h;
    if (Math.abs(nw - w) > Math.abs(nh - h)) nh = nw / ratio;
    else nw = nh * ratio;
    if (dir.includes('w')) nx = x + (w - nw);
    if (dir.includes('n')) ny = y + (h - nh);
  }
  if (fromCenter) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    nx = cx - nw / 2;
    ny = cy - nh / 2;
  }
  if (nw < 8) nw = 8;
  if (nh < 8) nh = 8;
  return { x: nx, y: ny, w: nw, h: nh };
}

function applySnapToResize(
  rect: { x: number; y: number; w: number; h: number },
  dir: Direction,
  dx: number,
  dy: number,
) {
  let { x, y, w, h } = rect;
  if (dx !== 0) {
    if (dir.includes('e')) w += dx;
    else if (dir.includes('w')) {
      x += dx;
      w -= dx;
    }
  }
  if (dy !== 0) {
    if (dir.includes('s')) h += dy;
    else if (dir.includes('n')) {
      y += dy;
      h -= dy;
    }
  }
  return { x, y, w: Math.max(8, w), h: Math.max(8, h) };
}
