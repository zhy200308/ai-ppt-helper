// PDF export. We render each slide off-screen to PNG via the browser's
// SVG foreignObject path, then embed into a vector PDF page sized to the
// deck's logical dimensions. Result opens cleanly in Acrobat / Preview.

import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { Deck, Slide } from '../core/schema/types';
import { renderSlideToPng } from './slidePng';
import { useAuditStore } from './audit';

export async function exportPdf(deck: Deck): Promise<void> {
  const audit = useAuditStore.getState();
  const pdf = await PDFDocument.create();
  pdf.setTitle(deck.meta.title);
  if (deck.meta.author) pdf.setAuthor(deck.meta.author);
  pdf.setCreator('ai-ppt-helper');

  const helv = await pdf.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const png = await renderSlideToPng(slide, deck.meta.width, deck.meta.height, deck.theme);
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([deck.meta.width, deck.meta.height]);
    page.drawImage(image, { x: 0, y: 0, width: deck.meta.width, height: deck.meta.height });
    if (audit.watermark.enabled && audit.watermark.text) {
      drawWatermark(page, helv, audit.watermark.text, deck.meta.width, deck.meta.height, audit.watermark.opacity, audit.watermark.angle);
    }
    if (slide.notes) {
      const np = pdf.addPage([deck.meta.width, deck.meta.height]);
      np.drawText(`Slide ${i + 1} — Speaker Notes`, { x: 60, y: deck.meta.height - 80, size: 28, font: helv });
      np.drawText(slide.notes.slice(0, 4000), {
        x: 60, y: deck.meta.height - 140, size: 16, font: helv, lineHeight: 22,
        maxWidth: deck.meta.width - 120,
      });
    }
  }

  // pdf-lib does NOT ship a built-in encryption module. We document this
  // limitation and offer the password as a hint for downstream tooling.
  if (audit.pdfPassword.enabled && audit.pdfPassword.password) {
    pdf.setKeywords([`password-hint:${audit.pdfPassword.password.slice(0, 0)}`]);
    console.warn('PDF password requested — pdf-lib does not encrypt; route through a desktop sidecar for true encryption.');
  }

  const bytes = await pdf.save();
  download(bytes, sanitize(deck.meta.title || 'deck') + '.pdf', 'application/pdf');
}

function drawWatermark(page: any, font: any, text: string, w: number, h: number, opacity: number, angle: number) {
  const fontSize = Math.max(48, Math.round(Math.min(w, h) / 10));
  const stepX = fontSize * 8;
  const stepY = fontSize * 4;
  for (let y = -stepY; y < h + stepY; y += stepY) {
    for (let x = -stepX; x < w + stepX; x += stepX) {
      page.drawText(text, {
        x, y,
        size: fontSize,
        font,
        color: rgb(0.06, 0.09, 0.16),
        opacity,
        rotate: degrees(angle),
      });
    }
  }
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
