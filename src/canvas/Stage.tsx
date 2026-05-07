import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeckStore, useActiveSlide } from '../core/store/deck';
import type { Block, ID, Slide } from '../core/schema/types';
import { BlockRenderer } from './renderers/BlockRenderer';
import { SelectionOverlay } from './SelectionOverlay';
import { computeSnap, blockToRect, type SnapGuide } from './interactions/snap';
import { bindPointerDrag } from './interactions/usePointerDrag';
import { rectsBoundingBox, rectsIntersect, clamp } from '../utils/math';

const SNAP_THRESHOLD = 6;

export function Stage() {
  const slide = useActiveSlide();
  const deck = useDeckStore((s) => s.deck);
  const zoom = useDeckStore((s) => s.zoom);
  const pan = useDeckStore((s) => s.pan);
  const setZoom = useDeckStore((s) => s.setZoom);
  const setPan = useDeckStore((s) => s.setPan);
  const selection = useDeckStore((s) => s.selection);
  const selectBlocks = useDeckStore((s) => s.selectBlocks);
  const clearSelection = useDeckStore((s) => s.clearSelection);
  const updateBlocks = useDeckStore((s) => s.updateBlocks);
  const presenting = useDeckStore((s) => s.presenting);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Auto-fit on first mount and on container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const fit = Math.min((rect.width - 80) / deck.meta.width, (rect.height - 80) / deck.meta.height);
      setZoom(clamp(fit, 0.05, 4));
      setPan({
        x: (rect.width - deck.meta.width * fit) / 2,
        y: (rect.height - deck.meta.height * fit) / 2,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.meta.width, deck.meta.height]);

  // Wheel: zoom (with Ctrl/Cmd), or pan otherwise
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0015);
        const next = clamp(zoom * factor, 0.05, 4);
        // anchor zoom at cursor
        const dx = cx - pan.x;
        const dy = cy - pan.y;
        setPan({ x: cx - dx * (next / zoom), y: cy - dy * (next / zoom) });
        setZoom(next);
      } else {
        e.preventDefault();
        setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, pan, setZoom, setPan]);

  // Convert client coords → deck-space
  const clientToDeck = useCallback(
    (cx: number, cy: number) => {
      const rect = containerRef.current!.getBoundingClientRect();
      return {
        x: (cx - rect.left - pan.x) / zoom,
        y: (cy - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom],
  );

  // Marquee selection on empty-canvas drag
  useEffect(() => {
    if (presenting) return;
    const el = stageRef.current;
    if (!el) return;
    let startDeck: { x: number; y: number } | null = null;
    return bindPointerDrag(el, {
      onStart: (e) => {
        startDeck = null;
        const target = e.target as HTMLElement;
        if (target.dataset.blockHit || target.closest('[data-block-hit]') || target.closest('[data-overlay-handle]')) {
          // Block / handle clicked — handled by their own drag bindings.
          return;
        }
        if (!e.shiftKey) clearSelection();
        startDeck = clientToDeck(e.clientX, e.clientY);
        setMarquee({ x: startDeck.x, y: startDeck.y, w: 0, h: 0 });
      },
      onMove: (_, e) => {
        if (!startDeck) return;
        const cur = clientToDeck(e.clientX, e.clientY);
        const x = Math.min(startDeck.x, cur.x);
        const y = Math.min(startDeck.y, cur.y);
        const w = Math.abs(cur.x - startDeck.x);
        const h = Math.abs(cur.y - startDeck.y);
        setMarquee({ x, y, w, h });
      },
      onEnd: () => {
        if (!startDeck) return;
        startDeck = null;
        if (!marquee || !slide) {
          setMarquee(null);
          return;
        }
        if (marquee.w > 4 && marquee.h > 4) {
          const hit = slide.blocks.filter((b) => rectsIntersect(marquee, blockToRect(b))).map((b) => b.id);
          if (hit.length) selectBlocks(slide.id, hit);
        }
        setMarquee(null);
      },
      onCancel: () => { startDeck = null; setMarquee(null); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientToDeck, presenting, marquee?.x, marquee?.y, marquee?.w, marquee?.h, slide?.id]);

  // Block-level pointer down: select + start drag
  const onBlockPointerDown = useCallback(
    (e: React.PointerEvent, block: Block) => {
      if (!slide || presenting) return;
      e.stopPropagation();
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const alreadySelected = selection.blockIds.includes(block.id);
      if (!alreadySelected || additive) {
        selectBlocks(slide.id, [block.id], { additive });
      }
      // Start moving — use bindPointerDrag-ish manual loop here.
      const startClient = { x: e.clientX, y: e.clientY };
      const movingIds = additive || alreadySelected
        ? Array.from(new Set([...selection.blockIds, block.id]))
        : [block.id];
      const startGeoms: Record<ID, { x: number; y: number }> = {};
      const refs: Block[] = [];
      for (const b of slide.blocks) {
        if (movingIds.includes(b.id)) startGeoms[b.id] = { x: b.x, y: b.y };
        else refs.push(b);
      }
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      let raf = 0;
      let pending: PointerEvent | null = null;

      const onMove = (ev: PointerEvent) => {
        pending = ev;
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            if (!pending) return;
            const dxc = (pending.clientX - startClient.x) / zoom;
            const dyc = (pending.clientY - startClient.y) / zoom;
            // Compute bounding box of moving blocks
            const movingRects = movingIds.map((id) => {
              const orig = startGeoms[id];
              const blk = slide.blocks.find((x) => x.id === id)!;
              return { x: orig.x + dxc, y: orig.y + dyc, w: blk.w, h: blk.h };
            });
            const bbox = rectsBoundingBox(movingRects);
            const snap = computeSnap(bbox, refs.map(blockToRect), {
              threshold: SNAP_THRESHOLD,
              deckWidth: deck.meta.width,
              deckHeight: deck.meta.height,
            });
            const finalDx = pending.shiftKey ? dxc : dxc + snap.dx;
            const finalDy = pending.shiftKey ? dyc : dyc + snap.dy;
            updateBlocks(
              slide.id,
              movingIds.map((id) => ({
                id,
                patch: {
                  x: Math.round(startGeoms[id].x + finalDx),
                  y: Math.round(startGeoms[id].y + finalDy),
                },
              })),
              { transient: true },
            );
            setGuides(pending.shiftKey ? [] : snap.guides);
            pending = null;
          });
        }
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (raf) cancelAnimationFrame(raf);
        // Commit a non-transient mutation snapshot for undo.
        const final = movingIds.map((id) => {
          const b = useDeckStore.getState().deck.slides.find((s) => s.id === slide.id)?.blocks.find((x) => x.id === id);
          return b ? { id, patch: { x: b.x, y: b.y } } : null;
        }).filter(Boolean) as { id: ID; patch: any }[];
        if (final.length) {
          // Reset to original first (so undo lands on original positions), then apply final.
          // Since transient mutations didn't push history, we just push one final entry now.
          updateBlocks(slide.id, final);
        }
        setGuides([]);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [slide, presenting, selection, selectBlocks, updateBlocks, zoom, deck.meta.width, deck.meta.height],
  );

  if (!slide) return <div className="stage-empty">No slides</div>;

  const slideStyle = backgroundStyle(slide);

  return (
    <div ref={containerRef} className="stage-container">
      <div
        ref={stageRef}
        className="stage"
        style={{
          width: deck.meta.width,
          height: deck.meta.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          ...slideStyle,
        }}
      >
        {[...slide.blocks]
          .sort((a, b) => a.z - b.z)
          .map((block) => (
            <div
              key={block.id}
              data-block-hit
              data-block-id={block.id}
              onPointerDown={(e) => onBlockPointerDown(e, block)}
              style={{
                position: 'absolute',
                left: block.x,
                top: block.y,
                width: block.w,
                height: block.h,
                transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
                opacity: block.opacity ?? 1,
                cursor: presenting ? 'default' : 'move',
                userSelect: 'none',
                pointerEvents: block.hidden ? 'none' : 'auto',
                visibility: block.hidden ? 'hidden' : 'visible',
                outline: selection.blockIds.includes(block.id) && !presenting ? '2px solid #4F46E5' : undefined,
                outlineOffset: -1,
              }}
            >
              <BlockRenderer block={block} presenting={presenting} />
            </div>
          ))}

        {!presenting && (
          <SelectionOverlay
            slide={slide}
            selectedIds={selection.blockIds}
            zoom={zoom}
            deckWidth={deck.meta.width}
            deckHeight={deck.meta.height}
            onSetGuides={setGuides}
          />
        )}

        {!presenting && guides.map((g, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              background: '#F472B6',
              pointerEvents: 'none',
              ...(g.axis === 'x'
                ? { left: g.position - 0.5 / zoom, top: g.start, width: 1 / zoom, height: g.end - g.start }
                : { top: g.position - 0.5 / zoom, left: g.start, height: 1 / zoom, width: g.end - g.start }),
            }}
          />
        ))}

        {marquee && (
          <div
            style={{
              position: 'absolute',
              left: marquee.x,
              top: marquee.y,
              width: marquee.w,
              height: marquee.h,
              border: `${1 / zoom}px solid #4F46E5`,
              background: 'rgba(79, 70, 229, 0.08)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}

function backgroundStyle(slide: Slide): React.CSSProperties {
  const bg = slide.background ?? {};
  if (bg.image) {
    return {
      backgroundImage: `url(${bg.image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: bg.color,
    };
  }
  if (bg.gradient) {
    const stops = bg.gradient.stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`).join(', ');
    return {
      background:
        bg.gradient.type === 'linear'
          ? `linear-gradient(${bg.gradient.angle ?? 0}deg, ${stops})`
          : `radial-gradient(circle, ${stops})`,
    };
  }
  return { backgroundColor: bg.color ?? '#fff' };
}
