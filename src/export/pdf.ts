// PDF export. We render each slide off-screen to PNG via the browser's
// SVG foreignObject path, then embed into a vector PDF page sized to the
// deck's logical dimensions. Result opens cleanly in Acrobat / Preview.

import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { Deck, Slide } from '../core/schema/types';
import { renderSlideToPng } from './slidePng';

export async function exportPdf(deck: Deck): Promise<void> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(deck.meta.title);
  if (deck.meta.author) pdf.setAuthor(deck.meta.author);
  pdf.setCreator('ai-ppt-helper');

  // Embed a fallback font for any text annotations (notes page).
  const helv = await pdf.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const png = await renderSlideToPng(slide, deck.meta.width, deck.meta.height, deck.theme);
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([deck.meta.width, deck.meta.height]);
    page.drawImage(image, { x: 0, y: 0, width: deck.meta.width, height: deck.meta.height });
    if (slide.notes) {
      const np = pdf.addPage([deck.meta.width, deck.meta.height]);
      np.drawText(`Slide ${i + 1} — Speaker Notes`, {
        x: 60, y: deck.meta.height - 80, size: 28, font: helv,
      });
      np.drawText(slide.notes.slice(0, 4000), {
        x: 60, y: deck.meta.height - 140, size: 16, font: helv, lineHeight: 22,
        maxWidth: deck.meta.width - 120,
      });
    }
  }

  const bytes = await pdf.save();
  download(bytes, sanitize(deck.meta.title || 'deck') + '.pdf', 'application/pdf');
}

function sanitize(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

function download(data: Uint8Array, name: string, mime: string) {
  const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type { Slide };
