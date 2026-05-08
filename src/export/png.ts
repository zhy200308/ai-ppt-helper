// Per-slide PNG export — uses the shared off-screen renderer.

import type { Deck } from '../core/schema/types';
import { renderSlideToPng } from './slidePng';

export async function exportPng(deck: Deck): Promise<void> {
  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const png = await renderSlideToPng(slide, deck.meta.width, deck.meta.height, deck.theme);
    const blob = new Blob([new Uint8Array(png)], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slide-${i + 1}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
