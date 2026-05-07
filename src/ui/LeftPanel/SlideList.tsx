import { memo, useState } from 'react';
import { Plus, Copy, Trash2, GripVertical } from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import type { Slide } from '../../core/schema/types';
import { ThumbnailRender } from './ThumbnailRender';

export function SlideList() {
  const slides = useDeckStore((s) => s.deck.slides);
  const activeId = useDeckStore((s) => s.selection.slideId);
  const selectSlide = useDeckStore((s) => s.selectSlide);
  const addSlide = useDeckStore((s) => s.addSlide);
  const duplicateSlide = useDeckStore((s) => s.duplicateSlide);
  const removeSlide = useDeckStore((s) => s.removeSlide);
  const reorderSlides = useDeckStore((s) => s.reorderSlides);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  return (
    <div className="slide-list">
      <div className="slide-list-header">
        <span>幻灯片 ({slides.length})</span>
        <button className="icon-btn" onClick={() => addSlide()} title="添加幻灯片">
          <Plus size={14} />
        </button>
      </div>
      <div className="slide-list-body">
        {slides.map((s, i) => (
          <SlideThumb
            key={s.id}
            index={i}
            slide={s}
            active={s.id === activeId}
            onSelect={() => selectSlide(s.id)}
            onDuplicate={() => duplicateSlide(s.id)}
            onRemove={() => removeSlide(s.id)}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== i) reorderSlides(dragIdx, i);
              setDragIdx(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface ThumbProps {
  index: number;
  slide: Slide;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

const SlideThumb = memo(function SlideThumb({ index, slide, active, onSelect, onDuplicate, onRemove, onDragStart, onDragOver, onDrop }: ThumbProps) {
  return (
    <div
      className={`slide-thumb ${active ? 'active' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
    >
      <div className="thumb-index">
        <GripVertical size={11} />
        {index + 1}
      </div>
      <div className="thumb-canvas">
        <ThumbnailRender slide={slide} />
      </div>
      <div className="thumb-actions">
        <button
          className="icon-btn xs"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          title="复制"
        >
          <Copy size={11} />
        </button>
        <button
          className="icon-btn xs danger"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="删除"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
});
