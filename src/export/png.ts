// Per-slide PNG export — uses the shared off-screen renderer.

import type { Deck } from '../core/schema/types';
import { renderSlideToPng } from './slidePng';

export async function exportPng(deck: Deck): Promise<void> {
  const slides = deck.slides.filter((s) => !s.hidden);
  if (!slides.length) throw new Error('No visible slides to export.');
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const png = await renderSlideToPng(slide, {
      sourceWidth: deck.meta.width,
      sourceHeight: deck.meta.height,
    }, deck.theme);
    const blob = new Blob([new Uint8Array(png)], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slide-${i + 1}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
