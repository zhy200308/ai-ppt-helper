import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize, Clock, MousePointer2, StickyNote } from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import { BlockRenderer } from '../../canvas/renderers/BlockRenderer';

export function Presenter({ onClose }: { onClose: () => void }) {
  const deck = useDeckStore((s) => s.deck);
  const [idx, setIdx] = useState(() => Math.max(0, deck.slides.findIndex((s) => s.id === useDeckStore.getState().selection.slideId)));
  const [showNotes, setShowNotes] = useState(false);
  const [laserOn, setLaserOn] = useState(false);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const stageRef = useRef<HTMLDivElement>(null);

  const slide = deck.slides[idx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setIdx((i) => Math.min(deck.slides.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Home') setIdx(0);
      else if (e.key === 'End') setIdx(deck.slides.length - 1);
      else if (e.key.toLowerCase() === 'n') setShowNotes((v) => !v);
      else if (e.key.toLowerCase() === 'l') setLaserOn((v) => !v);
      else if (e.key.toLowerCase() === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deck.slides.length, onClose]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-fit slide to viewport
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () => {
      const sx = window.innerWidth / deck.meta.width;
      const sy = (window.innerHeight - 80) / deck.meta.height;
      setScale(Math.min(sx, sy));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [deck.meta.width, deck.meta.height]);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!laserOn || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setLaser({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const time = useMemo(() => {
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [elapsed]);

  if (!slide) return null;

  return (
    <div className="presenter">
      <div className="presenter-stage" ref={stageRef} onMouseMove={onMouseMove}>
        <div
          className="presenter-canvas"
          style={{
            width: deck.meta.width,
            height: deck.meta.height,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            position: 'relative',
            background: slide.background?.color ?? '#fff',
            boxShadow: '0 12px 60px rgba(0,0,0,0.4)',
          }}
        >
          {[...slide.blocks]
            .sort((a, b) => a.z - b.z)
            .map((block) => (
              <div
                key={block.id}
                style={{
                  position: 'absolute',
                  left: block.x,
                  top: block.y,
                  width: block.w,
                  height: block.h,
                  transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
                  opacity: block.opacity ?? 1,
                  visibility: block.hidden ? 'hidden' : 'visible',
                }}
              >
                <BlockRenderer block={block} presenting />
              </div>
            ))}
        </div>
        {laser && laserOn && (
          <div
            className="presenter-laser"
            style={{ left: laser.x - 10, top: laser.y - 10 }}
          />
        )}
      </div>

      {showNotes && slide.notes && (
        <div className="presenter-notes">
          <div className="presenter-notes-title">演讲者备注</div>
          <pre>{slide.notes}</pre>
        </div>
      )}

      <div className="presenter-toolbar">
        <button className="icon-btn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          <ChevronLeft size={16}/>
        </button>
        <span className="presenter-counter">{idx + 1} / {deck.slides.length}</span>
        <button className="icon-btn" onClick={() => setIdx((i) => Math.min(deck.slides.length - 1, i + 1))} disabled={idx === deck.slides.length - 1}>
          <ChevronRight size={16}/>
        </button>
        <span className="sep"/>
        <button className={`icon-btn ${laserOn ? 'active' : ''}`} onClick={() => setLaserOn((v) => !v)} title="激光笔 (L)">
          <MousePointer2 size={14}/>
        </button>
        <button className={`icon-btn ${showNotes ? 'active' : ''}`} onClick={() => setShowNotes((v) => !v)} title="备注 (N)">
          <StickyNote size={14}/>
        </button>
        <button className="icon-btn" onClick={toggleFullscreen} title="全屏 (F)">
          <Maximize size={14}/>
        </button>
        <span className="presenter-time"><Clock size={11}/> {time}</span>
        <button className="icon-btn" onClick={onClose} title="退出 (Esc)">
          <X size={14}/>
        </button>
      </div>
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen?.();
  }
}
