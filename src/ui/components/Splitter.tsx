import { useCallback, useEffect, useRef } from 'react';

interface Props {
  side: 'left' | 'right';
  width: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
}

// Vertical splitter — drag to resize the adjacent pane.
// `side` indicates which pane the splitter sits on the outer edge of.
export function Splitter({ side, width, min = 160, max = 600, onChange }: Props) {
  const startX = useRef(0);
  const startW = useRef(width);
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = 'col-resize';
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      const next = side === 'left' ? startW.current + dx : startW.current - dx;
      onChange(Math.max(min, Math.min(max, next)));
    },
    [side, min, max, onChange],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    document.body.style.cursor = '';
  }, []);

  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  return (
    <div
      className={`splitter splitter-${side}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onChange(side === 'left' ? 240 : 280)}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
    />
  );
}
