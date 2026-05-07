export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const round = (v: number, p = 1) => {
  const m = Math.pow(10, p);
  return Math.round(v * m) / m;
};

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;

export interface Point {
  x: number;
  y: number;
}

export interface RectGeo {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectCenter(r: RectGeo): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rectsBoundingBox(rects: RectGeo[]): RectGeo {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function pointInRect(p: Point, r: RectGeo): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function rectsIntersect(a: RectGeo, b: RectGeo): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function rectContains(outer: RectGeo, inner: RectGeo): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function rotatePoint(p: Point, center: Point, deg: number): Point {
  const r = deg2rad(deg);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}
