// PPTX export using pptxgenjs. Produces files compatible with PowerPoint, Keynote (via import), and WPS.
// Coords are converted from deck-space px (1920x1080) to inches.

import PptxGenJS from 'pptxgenjs';
import type {
  Block, Deck, ShapeBlock, TextBlock, ImageBlock, ChartBlock, TableBlock,
  ListBlock, DividerBlock, VideoBlock, EmbedBlock, ConnectorBlock,
} from '../core/schema/types';
import { resolveEndpoint } from '../canvas/connectorAnchor';

const SLIDE_W_INCH = 13.333; // 16:9 widescreen
const SLIDE_H_INCH = 7.5;

export async function exportPptx(deck: Deck): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = deck.meta.title;
  if (deck.meta.author) pptx.author = deck.meta.author;

  const sx = SLIDE_W_INCH / deck.meta.width;
  const sy = SLIDE_H_INCH / deck.meta.height;

  for (const slide of deck.slides) {
    const s = pptx.addSlide();
    if (slide.background?.color) {
      s.background = { color: stripHash(slide.background.color) };
    }
    if (slide.notes) s.addNotes(slide.notes);
    const sorted = [...slide.blocks].sort((a, b) => a.z - b.z);
    for (const block of sorted) {
      if (block.hidden) continue;
      addBlockToSlide(s, block, sx, sy, slide);
    }
  }

  const filename = sanitizeFilename(deck.meta.title || 'deck') + '.pptx';
  await pptx.writeFile({ fileName: filename });
}

function addBlockToSlide(slide: any, block: Block, sx: number, sy: number, parentSlide?: import('../core/schema/types').Slide) {
  const x = block.x * sx;
  const y = block.y * sy;
  const w = block.w * sx;
  const h = block.h * sy;

  switch (block.type) {
    case 'text':
      addTextBlock(slide, block, { x, y, w, h });
      break;
    case 'shape':
      addShapeBlock(slide, block, { x, y, w, h });
      break;
    case 'image':
      addImageBlock(slide, block, { x, y, w, h });
      break;
    case 'chart':
      addChartBlock(slide, block, { x, y, w, h });
      break;
    case 'table':
      addTableBlock(slide, block, { x, y, w, h });
      break;
    case 'code':
      slide.addText(block.code, {
        x, y, w, h,
        fontFace: 'Consolas',
        fontSize: 14,
        color: block.theme === 'light' ? '0F172A' : 'E2E8F0',
        fill: { color: block.theme === 'light' ? 'F8FAFC' : '0F172A' },
        valign: 'top',
      });
      break;
    case 'icon':
      slide.addText(block.iconName, { x, y, w, h, align: 'center', valign: 'middle' });
      break;
    case 'list':
      addListBlock(slide, block, { x, y, w, h });
      break;
    case 'divider':
      addDividerBlock(slide, block, { x, y, w, h });
      break;
    case 'video':
      addVideoBlock(slide, block, { x, y, w, h });
      break;
    case 'embed':
      addEmbedBlock(slide, block, { x, y, w, h });
      break;
    case 'connector':
      if (parentSlide) addConnectorBlock(slide, block, sx, sy, parentSlide);
      break;
  }
}

function addListBlock(slide: any, block: ListBlock, geo: any) {
  const text = block.items.map((item) => ({
    text: item.text,
    options: {
      bullet: block.ordered
        ? { type: 'number' as const, indent: (item.level || 0) * 20 }
        : { indent: (item.level || 0) * 20 },
      color: stripHash(block.color ?? '#0F172A'),
      fontSize: (block.fontSize ?? 28) * 0.75,
      fontFace: block.fontFamily,
    },
  }));
  slide.addText(text, {
    ...geo,
    valign: 'top',
    paraSpaceAfter: 6,
  });
}

function addDividerBlock(slide: any, block: DividerBlock, geo: any) {
  slide.addShape('line', {
    ...geo,
    line: {
      color: stripHash(block.color ?? '#CBD5E1'),
      width: block.thickness ?? 2,
      dashType: block.style === 'dashed' ? 'dash' : block.style === 'dotted' ? 'sysDot' : 'solid',
    },
  });
}

function addVideoBlock(slide: any, block: VideoBlock, geo: any) {
  if (!block.src) return;
  const isData = block.src.startsWith('data:');
  if (isData) {
    slide.addMedia({ ...geo, type: 'video', data: block.src });
  } else {
    slide.addMedia({ ...geo, type: 'video', path: block.src });
  }
}

function addEmbedBlock(slide: any, block: EmbedBlock, geo: any) {
  // PPTX has no live iframes / mermaid; render a placeholder card with the
  // source url so the user can recognize it after import.
  const label = block.kind === 'iframe'
    ? `🌐 ${block.src}`
    : block.kind === 'mermaid'
      ? '📊 Mermaid 图表'
      : block.kind === 'math'
        ? '∑ 公式'
        : 'HTML';
  slide.addText([
    { text: label, options: { bold: true, fontSize: 16, color: '4F46E5' } },
    { text: '\n' + (block.fallback ?? ''), options: { fontSize: 12, color: '64748B' } },
  ], {
    ...geo,
    fill: { color: 'F1F5F9' },
    line: { color: 'CBD5E1', width: 1, dashType: 'dash' },
    valign: 'middle',
    align: 'center',
    margin: 12,
  });
}

function addConnectorBlock(slide: any, block: ConnectorBlock, sx: number, sy: number, parentSlide: import('../core/schema/types').Slide) {
  const start = resolveEndpoint(block.start, parentSlide);
  const end = resolveEndpoint(block.end, parentSlide);
  // PPTX line shape uses a bounding rect + flipH/flipV. Use the actual span.
  const x = Math.min(start.x, end.x) * sx;
  const y = Math.min(start.y, end.y) * sy;
  const w = Math.max(8, Math.abs(end.x - start.x) * sx);
  const h = Math.max(8, Math.abs(end.y - start.y) * sy);
  const flipH = end.x < start.x;
  const flipV = end.y < start.y;
  const dash = block.strokeDash === 'dashed' ? 'dash' : block.strokeDash === 'dotted' ? 'sysDot' : 'solid';
  slide.addShape(block.arrowEnd ? 'line' : 'line', {
    x, y, w, h,
    flipH, flipV,
    line: {
      color: stripHash(block.color ?? '#475569'),
      width: block.strokeWidth ?? 2,
      dashType: dash,
      beginArrowType: block.arrowStart ? 'triangle' : 'none',
      endArrowType: block.arrowEnd ? 'triangle' : 'none',
    },
  });
}

function addTextBlock(slide: any, block: TextBlock, geo: any) {
  const text = block.runs.map((r) => ({
    text: r.text,
    options: {
      bold: r.bold,
      italic: r.italic,
      underline: r.underline ? { style: 'sng' } : undefined,
      strike: r.strike,
      color: stripHash(r.color ?? block.color ?? '#0F172A'),
      fontSize: (r.fontSize ?? block.fontSize ?? 24) * 0.75, // px → pt
      fontFace: r.fontFamily ?? block.fontFamily,
      hyperlink: r.link ? { url: r.link } : undefined,
    },
  }));
  slide.addText(text, {
    ...geo,
    align: block.align ?? 'left',
    valign: block.vAlign === 'middle' ? 'middle' : block.vAlign === 'bottom' ? 'bottom' : 'top',
    fill: block.background ? { color: stripHash(block.background) } : undefined,
    rotate: block.rotation ?? 0,
    margin: block.padding ?? 0,
  });
}

function addShapeBlock(slide: any, block: ShapeBlock, geo: any) {
  const shapeType = mapShape(block.shape);
  const opts: any = {
    ...geo,
    fill: block.gradient ? undefined : { color: stripHash(block.fill ?? '#4F46E5') },
    line: block.stroke
      ? { color: stripHash(block.stroke), width: block.strokeWidth ?? 1, dashType: block.strokeDash === 'dashed' ? 'dash' : block.strokeDash === 'dotted' ? 'sysDot' : undefined }
      : undefined,
    rotate: block.rotation ?? 0,
  };
  if (block.shape === 'rounded-rectangle' && block.cornerRadius) {
    opts.rectRadius = (block.cornerRadius / Math.min(block.w, block.h)) * 0.5;
  }
  slide.addShape(shapeType, opts);
}

function mapShape(s: ShapeBlock['shape']): any {
  switch (s) {
    case 'rectangle': return 'rect';
    case 'rounded-rectangle': return 'roundRect';
    case 'ellipse': return 'ellipse';
    case 'triangle': return 'triangle';
    case 'line': return 'line';
    case 'arrow': return 'rightArrow';
    case 'star': return 'star5';
    case 'polygon': return 'pentagon';
    default: return 'rect';
  }
}

function addImageBlock(slide: any, block: ImageBlock, geo: any) {
  if (!block.src) return;
  if (block.src.startsWith('data:')) {
    slide.addImage({ ...geo, data: block.src, sizing: { type: block.fit === 'contain' ? 'contain' : 'cover', w: geo.w, h: geo.h } });
  } else {
    slide.addImage({ ...geo, path: block.src, sizing: { type: block.fit === 'contain' ? 'contain' : 'cover', w: geo.w, h: geo.h } });
  }
}

function addChartBlock(slide: any, block: ChartBlock, geo: any) {
  const data = block.series.map((s) => ({
    name: s.name,
    labels: block.categories ?? s.data.map((_, i) => `${i + 1}`),
    values: s.data,
  }));
  const chartType =
    block.chart === 'bar' ? 'bar' :
    block.chart === 'line' ? 'line' :
    block.chart === 'pie' ? 'pie' :
    block.chart === 'area' ? 'area' :
    'scatter';
  slide.addChart(chartType, data, { ...geo });
}

function addTableBlock(slide: any, block: TableBlock, geo: any) {
  const rows = block.cells.map((row, ri) => row.map((cell) => ({
    text: cell,
    options: {
      bold: (block.headerRow && ri === 0),
      fill: { color: (block.headerRow && ri === 0) ? 'F1F5F9' : 'FFFFFF' },
    },
  })));
  slide.addTable(rows, { ...geo, fontSize: 12, border: { type: 'solid', color: 'CBD5E1', pt: 0.5 } });
}

function stripHash(c: string): string {
  if (!c) return '000000';
  if (c.startsWith('#')) return c.slice(1);
  return c;
}

function sanitizeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
