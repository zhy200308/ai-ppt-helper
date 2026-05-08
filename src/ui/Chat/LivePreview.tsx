import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import { ThumbnailRender } from '../LeftPanel/ThumbnailRender';

// Tracks which slide most recently received a mutation and renders a
// large preview of it inside the chat sidebar. When the AI is running
// populate_slide, this panel becomes the user's progress display.

export function LivePreview() {
  const slides = useDeckStore((s) => s.deck.slides);
  const past = useDeckStore((s) => s.history.past);
  const [focusId, setFocusId] = useState<string | null>(slides[0]?.id ?? null);
  const lastVersion = useRef(past.length);

  useEffect(() => {
    if (past.length <= lastVersion.current) return;
    lastVersion.current = past.length;
    // Heuristic: jump focus to the slide whose updatedAt-ish proxy is
    // newest. Since we don't track per-slide ts, bias to the active
    // slide first, otherwise fall through to the last slide.
    const sel = useDeckStore.getState().selection.slideId;
    setFocusId(sel ?? slides[slides.length - 1]?.id ?? null);
  }, [past.length, slides]);

  const slide = slides.find((s) => s.id === focusId) ?? slides[0];
  if (!slide) return null;
  const idx = slides.findIndex((s) => s.id === slide.id);

  return (
    <div className="live-preview">
      <div className="live-preview-header">
        <Eye size={11}/> 第 {idx + 1} / {slides.length} 页
      </div>
      <div className="live-preview-body">
        <ThumbnailRender slide={slide} />
      </div>
    </div>
  );
}
