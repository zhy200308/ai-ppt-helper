import JSZip from 'jszip';
import type { Deck } from '../core/schema/types';
import { renderSlideToPng } from './slidePng';

export async function exportPreviewZip(deck: Deck, maxWidth = 960): Promise<void> {
  const zip = new JSZip();
  const slides = deck.slides.filter((s) => !s.hidden);
  const scale = Math.min(1, maxWidth / deck.meta.width);
  const width = Math.round(deck.meta.width * scale);
  const height = Math.round(deck.meta.height * scale);

  for (let i = 0; i < slides.length; i++) {
    const png = await renderSlideToPng(slides[i], {
      sourceWidth: deck.meta.width,
      sourceHeight: deck.meta.height,
      outputWidth: width,
      outputHeight: height,
    }, deck.theme);
    zip.file(`preview/slide-${String(i + 1).padStart(2, '0')}.png`, png);
  }

  zip.file('preview/manifest.json', JSON.stringify({
    title: deck.meta.title,
    width,
    height,
    slideCount: slides.length,
    generatedAt: new Date().toISOString(),
  }, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(deck.meta.title || 'deck')}-preview.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
