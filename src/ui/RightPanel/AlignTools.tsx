import {
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
} from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import type { Block, ID } from '../../core/schema/types';

type AlignKind = 'left' | 'h-center' | 'right' | 'top' | 'v-center' | 'bottom';
type DistributeKind = 'h' | 'v';

export function AlignTools({ slideId, blockIds }: { slideId: ID; blockIds: ID[] }) {
  const updateBlocks = useDeckStore((s) => s.updateBlocks);
  const deck = useDeckStore((s) => s.deck);
  if (blockIds.length < 2) return null;

  const slide = deck.slides.find((s) => s.id === slideId);
  if (!slide) return null;
  const blocks = slide.blocks.filter((b) => blockIds.includes(b.id));
  if (blocks.length < 2) return null;

  const align = (kind: AlignKind) => {
    const updates = computeAlign(blocks, kind);
    updateBlocks(slideId, updates);
  };
  const distribute = (kind: DistributeKind) => {
    if (blocks.length < 3) return;
    const updates = computeDistribute(blocks, kind);
    updateBlocks(slideId, updates);
  };

  return (
    <div className="panel-section">
      <div className="panel-title">对齐 / 分布</div>
      <div className="row">
        <button className="icon-btn" title="左对齐" onClick={() => align('left')}><AlignStartVertical size={14}/></button>
        <button className="icon-btn" title="水平居中" onClick={() => align('h-center')}><AlignCenterVertical size={14}/></button>
        <button className="icon-btn" title="右对齐" onClick={() => align('right')}><AlignEndVertical size={14}/></button>
        <button className="icon-btn" title="顶对齐" onClick={() => align('top')}><AlignStartHorizontal size={14}/></button>
        <button className="icon-btn" title="垂直居中" onClick={() => align('v-center')}><AlignCenterHorizontal size={14}/></button>
        <button className="icon-btn" title="底对齐" onClick={() => align('bottom')}><AlignEndHorizontal size={14}/></button>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button
          className="icon-btn"
          title="水平等距分布 (≥3)"
          onClick={() => distribute('h')}
          disabled={blocks.length < 3}
        >
          <AlignHorizontalDistributeCenter size={14}/>
        </button>
        <button
          className="icon-btn"
          title="垂直等距分布 (≥3)"
          onClick={() => distribute('v')}
          disabled={blocks.length < 3}
        >
          <AlignVerticalDistributeCenter size={14}/>
        </button>
      </div>
    </div>
  );
}

function computeAlign(blocks: Block[], kind: AlignKind): { id: ID; patch: Partial<Block> }[] {
  const minX = Math.min(...blocks.map((b) => b.x));
  const maxX = Math.max(...blocks.map((b) => b.x + b.w));
  const minY = Math.min(...blocks.map((b) => b.y));
  const maxY = Math.max(...blocks.map((b) => b.y + b.h));
  return blocks.map((b) => {
    const patch: Partial<Block> = {};
    if (kind === 'left') patch.x = minX;
    else if (kind === 'right') patch.x = maxX - b.w;
    else if (kind === 'h-center') patch.x = Math.round((minX + maxX) / 2 - b.w / 2);
    else if (kind === 'top') patch.y = minY;
    else if (kind === 'bottom') patch.y = maxY - b.h;
    else if (kind === 'v-center') patch.y = Math.round((minY + maxY) / 2 - b.h / 2);
    return { id: b.id, patch };
  });
}

function computeDistribute(blocks: Block[], kind: DistributeKind): { id: ID; patch: Partial<Block> }[] {
  if (kind === 'h') {
    const sorted = [...blocks].sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = (last.x + last.w / 2) - (first.x + first.w / 2);
    const step = totalSpan / (sorted.length - 1);
    return sorted.map((b, i) => ({
      id: b.id,
      patch: { x: Math.round((first.x + first.w / 2) + step * i - b.w / 2) },
    }));
  }
  const sorted = [...blocks].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpan = (last.y + last.h / 2) - (first.y + first.h / 2);
  const step = totalSpan / (sorted.length - 1);
  return sorted.map((b, i) => ({
    id: b.id,
    patch: { y: Math.round((first.y + first.h / 2) + step * i - b.h / 2) },
  }));
}
