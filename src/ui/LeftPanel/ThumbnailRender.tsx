import { memo } from 'react';
import { useDeckStore } from '../../core/store/deck';
import { BlockRenderer } from '../../canvas/renderers/BlockRenderer';
import type { Slide } from '../../core/schema/types';

interface Props {
  slide: Slide;
}

export const ThumbnailRender = memo(function ThumbnailRender({ slide }: Props) {
  const deck = useDeckStore((s) => s.deck);
  const targetW = 200;
  const scale = targetW / deck.meta.width;
  const targetH = deck.meta.height * scale;
  const bg = slide.background?.color ?? '#fff';

  return (
    <div className="thumb-frame" style={{ width: targetW, height: targetH, background: bg }}>
      <div
        style={{
          width: deck.meta.width,
          height: deck.meta.height,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          position: 'relative',
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
                pointerEvents: 'none',
              }}
            >
              <BlockRenderer block={block} presenting />
            </div>
          ))}
      </div>
    </div>
  );
});
