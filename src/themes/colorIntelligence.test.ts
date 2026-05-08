import { describe, it, expect } from 'vitest';
import { contrastRatio, derivePalette, bestForeground, hexToRgb, rgbToHex, suggestFontPair } from './colorIntelligence';

describe('color intelligence', () => {
  it('hexToRgb / rgbToHex round-trip', () => {
    expect(rgbToHex(hexToRgb('#4F46E5'))).toBe('#4F46E5');
    expect(rgbToHex(hexToRgb('#fff'))).toBe('#FFFFFF');
  });

  it('contrastRatio black-white = 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('bestForeground picks black on light bg', () => {
    expect(bestForeground('#FFFFFF')).toBe('#0F172A');
    expect(bestForeground('#0B1220')).toBe('#FFFFFF');
  });

  it('derivePalette returns AA contrast in light mode', () => {
    const p = derivePalette('#4F46E5', 'light');
    expect(contrastRatio(p.text, p.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('derivePalette returns AA contrast in dark mode', () => {
    const p = derivePalette('#4F46E5', 'dark');
    expect(contrastRatio(p.text, p.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('suggestFontPair picks Chinese-friendly stack', () => {
    const p = suggestFontPair('商务科技');
    expect(p.heading).toMatch(/PingFang|YaHei/);
  });
});
