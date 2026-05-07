// Smart snap-line engine. Given moving rects and reference rects, return
// adjusted positions and the active guide lines for overlay drawing.

import type { Block } from '../../core/schema/types';

export type GuideAxis = 'x' | 'y';

export interface SnapGuide {
  axis: GuideAxis;
  position: number; // deck-space coordinate
  start: number;
  end: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

export interface SnapOptions {
  threshold: number; // px in deck-space
  deckWidth: number;
  deckHeight: number;
}

interface RectGeo {
  x: number;
  y: number;
  w: number;
  h: number;
}

function edges(r: RectGeo): { xs: number[]; ys: number[] } {
  return {
    xs: [r.x, r.x + r.w / 2, r.x + r.w],
    ys: [r.y, r.y + r.h / 2, r.y + r.h],
  };
}

export function computeSnap(
  moving: RectGeo,
  refs: RectGeo[],
  options: SnapOptions,
): SnapResult {
  const out: SnapResult = { dx: 0, dy: 0, guides: [] };
  const { threshold, deckWidth, deckHeight } = options;
  const me = edges(moving);

  // Include canvas edges and centers as snap targets.
  const canvasXs = [0, deckWidth / 2, deckWidth];
  const canvasYs = [0, deckHeight / 2, deckHeight];

  type BestX = { delta: number; pos: number; sourceY0: number; sourceY1: number };
  type BestY = { delta: number; pos: number; sourceX0: number; sourceX1: number };
  let bestX: BestX | null = null;
  let bestY: BestY | null = null;

  const considerX = (target: number, refY0: number, refY1: number) => {
    for (const v of me.xs) {
      const delta = target - v;
      if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
        bestX = { delta, pos: target, sourceY0: refY0, sourceY1: refY1 };
      }
    }
  };
  const considerY = (target: number, refX0: number, refX1: number) => {
    for (const v of me.ys) {
      const delta = target - v;
      if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
        bestY = { delta, pos: target, sourceX0: refX0, sourceX1: refX1 };
      }
    }
  };

  for (const x of canvasXs) considerX(x, 0, deckHeight);
  for (const y of canvasYs) considerY(y, 0, deckWidth);

  for (const r of refs) {
    const re = edges(r);
    for (const x of re.xs) considerX(x, Math.min(r.y, moving.y), Math.max(r.y + r.h, moving.y + moving.h));
    for (const y of re.ys) considerY(y, Math.min(r.x, moving.x), Math.max(r.x + r.w, moving.x + moving.w));
  }

  const bX = bestX as BestX | null;
  if (bX) {
    out.dx = bX.delta;
    out.guides.push({ axis: 'x', position: bX.pos, start: bX.sourceY0, end: bX.sourceY1 });
  }
  const bY = bestY as BestY | null;
  if (bY) {
    out.dy = bY.delta;
    out.guides.push({ axis: 'y', position: bY.pos, start: bY.sourceX0, end: bY.sourceX1 });
  }
  return out;
}

export function blockToRect(b: Block): RectGeo {
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}
