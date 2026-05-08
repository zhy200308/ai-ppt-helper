import type { AnchorEdge, Block, ConnectorEndpoint, Slide } from '../core/schema/types';

// Resolve a connector endpoint's actual deck-space point. Anchored
// endpoints follow their target block's current geometry; free endpoints
// just return their stored x/y.
export function resolveEndpoint(ep: ConnectorEndpoint, slide: Slide): { x: number; y: number } {
  if (!ep.blockId) return { x: ep.x, y: ep.y };
  const target = slide.blocks.find((b) => b.id === ep.blockId);
  if (!target) return { x: ep.x, y: ep.y };
  return edgePoint(target, ep.edge ?? 'center');
}

export function edgePoint(b: Block, edge: AnchorEdge): { x: number; y: number } {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (edge) {
    case 'top': return { x: cx, y: b.y };
    case 'bottom': return { x: cx, y: b.y + b.h };
    case 'left': return { x: b.x, y: cy };
    case 'right': return { x: b.x + b.w, y: cy };
    default: return { x: cx, y: cy };
  }
}

// Choose the best edge of `target` based on a relative direction from
// the source point. Used by AI / paste flows to pick a sensible anchor.
export function chooseEdge(target: Block, fromX: number, fromY: number): AnchorEdge {
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const dx = fromX - cx;
  const dy = fromY - cy;
  if (Math.abs(dx) * target.h > Math.abs(dy) * target.w) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}
