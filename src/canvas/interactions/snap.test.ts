import { describe, it, expect } from 'vitest';
import { computeSnap } from './snap';

const opts = { threshold: 6, deckWidth: 1920, deckHeight: 1080 };

describe('snap engine', () => {
  it('snaps to canvas center', () => {
    // moving rect with center at 956, target canvas center 960 → dx=4
    const r = computeSnap({ x: 906, y: 0, w: 100, h: 100 }, [], opts);
    expect(r.dx).toBe(4);
    expect(r.guides.some((g) => g.axis === 'x' && g.position === 960)).toBe(true);
  });

  it('snaps to canvas left edge', () => {
    const r = computeSnap({ x: 3, y: 100, w: 100, h: 100 }, [], opts);
    expect(r.dx).toBe(-3);
  });

  it('does not snap if outside threshold', () => {
    const r = computeSnap({ x: 800, y: 800, w: 100, h: 100 }, [], opts);
    expect(r.dx).toBe(0);
  });

  it('snaps to a sibling left edge', () => {
    const r = computeSnap({ x: 305, y: 0, w: 100, h: 100 }, [{ x: 300, y: 200, w: 100, h: 100 }], opts);
    // movingRect.x = 305, sibling.x = 300 → delta = -5
    expect(r.dx).toBe(-5);
  });
});
