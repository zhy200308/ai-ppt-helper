import { useEffect, useRef } from 'react';

export interface PointerDragHandlers {
  onStart?: (ev: PointerEvent) => void;
  onMove: (delta: { dx: number; dy: number }, ev: PointerEvent) => void;
  onEnd?: (ev: PointerEvent) => void;
  onCancel?: () => void;
}

// A small helper that abstracts pointerdown→pointermove→pointerup tracking
// with rAF-throttled deltas, capture, and Escape cancellation.
export function bindPointerDrag(target: Element | Window, handlers: PointerDragHandlers): () => void {
  let active = false;
  let startX = 0;
  let startY = 0;
  let pending: { dx: number; dy: number; ev: PointerEvent } | null = null;
  let raf = 0;
  let pointerId = -1;

  const onDown = (ev: Event) => {
    const pe = ev as PointerEvent;
    if (pe.button !== 0 && pe.pointerType === 'mouse') return;
    active = true;
    pointerId = pe.pointerId;
    startX = pe.clientX;
    startY = pe.clientY;
    (target as Element).setPointerCapture?.(pointerId);
    handlers.onStart?.(pe);
  };
  const onMove = (ev: Event) => {
    if (!active) return;
    const pe = ev as PointerEvent;
    pending = { dx: pe.clientX - startX, dy: pe.clientY - startY, ev: pe };
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (pending) {
          handlers.onMove({ dx: pending.dx, dy: pending.dy }, pending.ev);
          pending = null;
        }
      });
    }
  };
  const onUp = (ev: Event) => {
    if (!active) return;
    const pe = ev as PointerEvent;
    active = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      if (pending) {
        handlers.onMove({ dx: pending.dx, dy: pending.dy }, pending.ev);
        pending = null;
      }
    }
    (target as Element).releasePointerCapture?.(pointerId);
    handlers.onEnd?.(pe);
  };
  const onKey = (ev: Event) => {
    const ke = ev as KeyboardEvent;
    if (active && ke.key === 'Escape') {
      active = false;
      handlers.onCancel?.();
    }
  };

  target.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);

  return () => {
    target.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKey);
    if (raf) cancelAnimationFrame(raf);
  };
}

export function usePointerDrag(
  ref: React.RefObject<Element | null>,
  handlers: PointerDragHandlers,
  enabled = true,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  useEffect(() => {
    if (!enabled || !ref.current) return;
    return bindPointerDrag(ref.current, {
      onStart: (e) => handlersRef.current.onStart?.(e),
      onMove: (d, e) => handlersRef.current.onMove(d, e),
      onEnd: (e) => handlersRef.current.onEnd?.(e),
      onCancel: () => handlersRef.current.onCancel?.(),
    });
  }, [ref, enabled]);
}
