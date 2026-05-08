import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize, Clock, MousePointer2, StickyNote, Pen, Eraser, Mic, Square } from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import { BlockRenderer } from '../../canvas/renderers/BlockRenderer';
import type { InkStroke } from '../../core/schema/types';
import { newId } from '../../core/schema/factory';

export function Presenter({ onClose }: { onClose: () => void }) {
  const deck = useDeckStore((s) => s.deck);
  const addBlock = useDeckStore((s) => s.addBlock);
  const mutate = useDeckStore((s) => s.mutate);
  const [idx, setIdx] = useState(() => Math.max(0, deck.slides.findIndex((s) => s.id === useDeckStore.getState().selection.slideId)));
  const [showNotes, setShowNotes] = useState(false);
  const [laserOn, setLaserOn] = useState(false);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [drawMode, setDrawMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const startedAt = useRef(Date.now());
  const stageRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentStroke = useRef<InkStroke | null>(null);
  const strokes = useRef<InkStroke[]>([]);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const mediaChunks = useRef<Blob[]>([]);

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
      else if (e.key.toLowerCase() === 'd') setDrawMode((v) => !v);
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

  const clientToDeck = useCallback((cx: number, cy: number) => {
    if (!stageRef.current) return { x: 0, y: 0 };
    const rect = stageRef.current.getBoundingClientRect();
    const cw = deck.meta.width * scale;
    const ch = deck.meta.height * scale;
    const ox = (rect.width - cw) / 2 + rect.left;
    const oy = (rect.height - ch) / 2 + rect.top;
    return { x: (cx - ox) / scale, y: (cy - oy) / scale };
  }, [deck.meta.width, deck.meta.height, scale]);

  const beginStroke = (e: React.PointerEvent) => {
    if (!drawMode) return;
    const p = clientToDeck(e.clientX, e.clientY);
    currentStroke.current = { color: '#EF4444', width: 4, points: [p] };
    repaint();
  };
  const extendStroke = (e: React.PointerEvent) => {
    if (!drawMode || !currentStroke.current) return;
    const p = clientToDeck(e.clientX, e.clientY);
    currentStroke.current.points.push(p);
    repaint();
  };
  const endStroke = () => {
    if (currentStroke.current && currentStroke.current.points.length > 1) {
      strokes.current.push(currentStroke.current);
    }
    currentStroke.current = null;
    repaint();
  };
  const repaint = () => {
    const cv = drawCanvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    cv.width = deck.meta.width;
    cv.height = deck.meta.height;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const all = [...strokes.current];
    if (currentStroke.current) all.push(currentStroke.current);
    for (const s of all) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      s.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  };
  const commitInk = () => {
    if (strokes.current.length === 0) return;
    // Compute bounding box.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes.current) {
      for (const p of s.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const x = Math.max(0, minX - 4);
    const y = Math.max(0, minY - 4);
    const w = Math.max(8, maxX - minX + 8);
    const h = Math.max(8, maxY - minY + 8);
    const localStrokes = strokes.current.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ x: p.x - x, y: p.y - y, pressure: p.pressure })),
    }));
    addBlock(slide.id, {
      id: newId('blk'), type: 'ink', z: 99, x, y, w, h, strokes: localStrokes,
    } as any);
    strokes.current = [];
    repaint();
  };
  const clearInk = () => { strokes.current = []; repaint(); };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaChunks.current = [];
      rec.ondataavailable = (e) => mediaChunks.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(mediaChunks.current, { type: rec.mimeType || 'audio/webm' });
        const dataUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(blob);
        });
        mutate('Attach audio', (draft) => {
          const s = draft.slides.find((x) => x.id === slide.id);
          if (s) s.audio = { src: dataUrl, mime: rec.mimeType, createdAt: Date.now() };
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRec.current = rec;
      setRecording(true);
    } catch (e) {
      alert('录音失败：' + (e instanceof Error ? e.message : String(e)));
    }
  };
  const stopRecording = () => {
    mediaRec.current?.stop();
    mediaRec.current = null;
    setRecording(false);
  };

  // Auto-play current slide audio when entering presenter view.
  useEffect(() => {
    if (!slide?.audio?.src) return;
    const a = new Audio(slide.audio.src);
    a.play().catch(() => { /* autoplay may be blocked; user can re-trigger */ });
    return () => { a.pause(); };
  }, [slide?.id, slide?.audio?.src]);

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
        {drawMode && (
          <canvas
            ref={drawCanvasRef}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: deck.meta.width * scale,
              height: deck.meta.height * scale,
              transform: 'translate(-50%, -50%)',
              cursor: 'crosshair',
              touchAction: 'none',
              zIndex: 10,
            }}
            onPointerDown={beginStroke}
            onPointerMove={extendStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
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
        <button className={`icon-btn ${drawMode ? 'active' : ''}`} onClick={() => { setDrawMode((v) => !v); setLaserOn(false); }} title="批注笔 (D)">
          <Pen size={14}/>
        </button>
        {drawMode && (
          <>
            <button className="icon-btn" onClick={commitInk} title="保存为批注">✓</button>
            <button className="icon-btn" onClick={clearInk} title="清除批注"><Eraser size={14}/></button>
          </>
        )}
        {!recording ? (
          <button className="icon-btn" onClick={startRecording} title="录制语音备注 (R)">
            <Mic size={14}/>
          </button>
        ) : (
          <button className="icon-btn active" onClick={stopRecording} title="停止录音">
            <Square size={14}/>
          </button>
        )}
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
