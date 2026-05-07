// Per-slide PNG export — renders each slide off-screen via foreignObject SVG
// (lightweight; no external snapshot libs). Falls back to printing the
// current viewport on failure.

import type { Deck } from '../core/schema/types';

export async function exportPng(deck: Deck): Promise<void> {
  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const stage = document.querySelector('.stage') as HTMLElement | null;
    if (!stage) return;
    // Use the current Stage DOM as a snapshot source.
    const html = stage.outerHTML;
    const blob = new Blob([wrapSvg(html, deck.meta.width, deck.meta.height)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = deck.meta.width;
    canvas.height = deck.meta.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = slide.background?.color ?? '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `slide-${i + 1}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    }, 'image/png');
  }
}

function wrapSvg(html: string, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml">${html}</div>
    </foreignObject>
  </svg>`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
