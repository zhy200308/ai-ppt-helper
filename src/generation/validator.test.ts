import { describe, it, expect } from 'vitest';
import { validateSlide } from './validator';
import { DEFAULT_THEME } from '../core/schema/factory';
import type { Slide } from '../core/schema/types';

const W = 1920, H = 1080;

describe('quality validator', () => {
  it('clamps blocks that bleed off-canvas', () => {
    const slide: Slide = {
      id: 'sld_1',
      blocks: [
        { id: 'blk_a', type: 'shape', shape: 'rectangle', z: 1, x: -100, y: -50, w: 200, h: 100, fill: '#000' } as any,
        { id: 'blk_b', type: 'shape', shape: 'rectangle', z: 1, x: 1900, y: 1050, w: 200, h: 200, fill: '#000' } as any,
      ],
    };
    const res = validateSlide(slide, DEFAULT_THEME, W, H);
    expect(res.blocks[0].x).toBe(0);
    expect(res.blocks[0].y).toBe(0);
    expect(res.blocks[1].x + res.blocks[1].w).toBeLessThanOrEqual(W);
    expect(res.blocks[1].y + res.blocks[1].h).toBeLessThanOrEqual(H);
  });

  it('promotes low-contrast text color to AA-safe', () => {
    const slide: Slide = {
      id: 'sld_1',
      background: { color: '#FFFFFF' },
      blocks: [
        { id: 'blk_t', type: 'text', z: 1, x: 0, y: 0, w: 100, h: 50,
          runs: [{ text: 'low contrast' }], color: '#FAFAFA', fontSize: 20 } as any,
      ],
    };
    const res = validateSlide(slide, { ...DEFAULT_THEME, backgroundColor: '#FFFFFF' }, W, H);
    expect((res.blocks[0] as any).color).not.toBe('#FAFAFA');
    expect(res.issues.some((i) => i.message.includes('对比度'))).toBe(true);
  });

  it('flags text overflow', () => {
    const slide: Slide = {
      id: 'sld_1',
      blocks: [
        { id: 'blk_t', type: 'text', z: 1, x: 0, y: 0, w: 100, h: 30,
          runs: [{ text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10) }],
          color: '#000', fontSize: 28 } as any,
      ],
    };
    const res = validateSlide(slide, DEFAULT_THEME, W, H);
    expect(res.issues.some((i) => i.message.includes('溢出'))).toBe(true);
  });
});
