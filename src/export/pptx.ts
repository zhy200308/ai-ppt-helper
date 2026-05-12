// PPTX export using pptxgenjs. Produces files compatible with PowerPoint, Keynote (via import), and WPS.
// Coords are converted from deck-space px (1920x1080) to inches.

import PptxGenJS from 'pptxgenjs';
import type {
  Block, Deck, ShapeBlock, TextBlock, ImageBlock, ChartBlock, TableBlock,
  ListBlock, DividerBlock, VideoBlock, EmbedBlock, ConnectorBlock,
  ProgressBlock, KpiCardBlock, GalleryBlock, MathBlock, AudioBlock, BadgeBlock, InkBlock,
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
      addBlockToSlide(s, block, sx, sy, deck, slide);
    }
  }

  const filename = sanitizeFilename(deck.meta.title || 'deck') + '.pptx';
  await pptx.writeFile({ fileName: filename });
}

function addBlockToSlide(slide: any, block: Block, sx: number, sy: number, deck: Deck, parentSlide?: import('../core/schema/types').Slide) {
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
      addChartBlock(slide, block, { x, y, w, h }, deck);
      break;
    case 'table':
      addTableBlock(slide, block, { x, y, w, h }, deck);
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
    case 'progress':
      addProgressBlock(slide, block, { x, y, w, h });
      break;
    case 'kpi':
      addKpiBlock(slide, block, { x, y, w, h });
      break;
    case 'gallery':
      addGalleryBlock(slide, block, { x, y, w, h });
      break;
    case 'math':
      addMathBlock(slide, block, { x, y, w, h });
      break;
    case 'audio':
      addAudioBlock(slide, block, { x, y, w, h });
      break;
    case 'badge':
      addBadgeBlock(slide, block, { x, y, w, h });
      break;
    case 'ink':
      addInkBlock(slide, block, sx, sy);
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
    ? `Web: ${block.src}`
    : block.kind === 'mermaid'
      ? 'Mermaid diagram'
      : block.kind === 'math'
        ? 'Formula'
        : 'HTML embed';
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

function addChartBlock(slide: any, block: ChartBlock, geo: any, deck: Deck) {
  const resolved = resolveChart(block, deck);
  const data = resolved.series.map((s) => ({
    name: s.name,
    labels: resolved.categories ?? s.data.map((_, i) => `${i + 1}`),
    values: s.data,
  }));
  const chartType =
    block.chart === 'bar' ? 'bar' :
    block.chart === 'line' ? 'line' :
    block.chart === 'pie' ? 'pie' :
    block.chart === 'area' ? 'area' :
    'scatter';
  if (!data.length) {
    slide.addText('Chart data unavailable', { ...geo, color: '64748B', align: 'center', valign: 'middle', fill: { color: 'F8FAFC' }, line: { color: 'CBD5E1' } });
    return;
  }
  slide.addChart(chartType, data, { ...geo });
}

function addTableBlock(slide: any, block: TableBlock, geo: any, deck: Deck) {
  const cells = resolveTable(block, deck);
  const rows = cells.map((row, ri) => row.map((cell) => ({
    text: cell,
    options: {
      bold: (block.headerRow && ri === 0),
      fill: { color: (block.headerRow && ri === 0) ? 'F1F5F9' : 'FFFFFF' },
    },
  })));
  if (!rows.length) {
    slide.addText('Table data unavailable', { ...geo, color: '64748B', align: 'center', valign: 'middle', fill: { color: 'F8FAFC' }, line: { color: 'CBD5E1' } });
    return;
  }
  slide.addTable(rows, { ...geo, fontSize: 12, border: { type: 'solid', color: 'CBD5E1', pt: 0.5 } });
}

function resolveChart(block: ChartBlock, deck: Deck): { series: { name: string; data: number[] }[]; categories?: string[] } {
  if (!block.dataRef) return { series: block.series, categories: block.categories };
  const table = deck.dataTables?.[block.dataRef.tableId];
  if (!table) return { series: block.series, categories: block.categories };
  const yKeys = block.dataRef.yColumns?.length
    ? block.dataRef.yColumns
    : table.columns.filter((c) => c.type === 'number' && c.key !== block.dataRef!.xColumn).map((c) => c.key);
  return {
    categories: table.rows.map((r) => String(r[block.dataRef!.xColumn] ?? '')),
    series: yKeys.map((key) => ({
      name: table.columns.find((c) => c.key === key)?.label ?? key,
      data: table.rows.map((r) => Number(r[key] ?? 0)),
    })),
  };
}

function resolveTable(block: TableBlock, deck: Deck): string[][] {
  if (!block.dataRef) return block.cells;
  const table = deck.dataTables?.[block.dataRef.tableId];
  if (!table) return block.cells;
  const cols = block.dataRef.columns?.length ? block.dataRef.columns : table.columns.map((c) => c.key);
  return [
    cols.map((key) => table.columns.find((c) => c.key === key)?.label ?? key),
    ...table.rows.map((row) => cols.map((key) => String(row[key] ?? ''))),
  ];
}

function addProgressBlock(slide: any, block: ProgressBlock, geo: any) {
  const value = Math.max(0, Math.min(1, block.value || 0));
  const barH = Math.min(geo.h, Math.max(0.08, (block.thickness ?? 18) / 144));
  const barY = geo.y + (geo.h - barH) / 2;
  slide.addShape('roundRect', { x: geo.x, y: barY, w: geo.w, h: barH, fill: { color: stripHash(block.trackColor ?? '#E2E8F0') }, line: { color: stripHash(block.trackColor ?? '#E2E8F0') } });
  slide.addShape('roundRect', { x: geo.x, y: barY, w: geo.w * value, h: barH, fill: { color: stripHash(block.color ?? '#4F46E5') }, line: { color: stripHash(block.color ?? '#4F46E5') } });
  if (block.label || block.showValue) {
    slide.addText(`${block.label ?? ''}${block.showValue ? ` ${Math.round(value * 100)}%` : ''}`.trim(), { ...geo, y: geo.y, h: Math.max(0.25, geo.h / 3), fontSize: 12, color: stripHash(block.color ?? '#0F172A') });
  }
}

function addKpiBlock(slide: any, block: KpiCardBlock, geo: any) {
  slide.addShape('roundRect', { ...geo, fill: { color: 'F8FAFC' }, line: { color: 'CBD5E1', width: 1 } });
  slide.addText(block.value, { x: geo.x + 0.12, y: geo.y + 0.12, w: geo.w - 0.24, h: geo.h * 0.38, bold: true, fontSize: 26, color: stripHash(block.color ?? '#0F172A'), margin: 0 });
  slide.addText(block.label, { x: geo.x + 0.12, y: geo.y + geo.h * 0.5, w: geo.w - 0.24, h: geo.h * 0.22, fontSize: 12, color: '64748B', margin: 0 });
  if (block.delta || block.sub) slide.addText([block.delta, block.sub].filter(Boolean).join('  '), { x: geo.x + 0.12, y: geo.y + geo.h * 0.74, w: geo.w - 0.24, h: geo.h * 0.2, fontSize: 10, color: block.deltaTone === 'down' ? 'DC2626' : block.deltaTone === 'up' ? '16A34A' : '64748B', margin: 0 });
}

function addGalleryBlock(slide: any, block: GalleryBlock, geo: any) {
  const cols = Math.max(1, Math.min(6, block.columns ?? Math.ceil(Math.sqrt(block.images.length || 1))));
  const gap = (block.gap ?? 12) / 144;
  const rows = Math.ceil((block.images.length || 1) / cols);
  const cellW = (geo.w - gap * (cols - 1)) / cols;
  const cellH = (geo.h - gap * (rows - 1)) / rows;
  block.images.forEach((img, i) => {
    const x = geo.x + (i % cols) * (cellW + gap);
    const y = geo.y + Math.floor(i / cols) * (cellH + gap);
    if (img.src?.startsWith('data:')) slide.addImage({ x, y, w: cellW, h: cellH, data: img.src, sizing: { type: 'cover', w: cellW, h: cellH } });
    else if (img.src) slide.addImage({ x, y, w: cellW, h: cellH, path: img.src, sizing: { type: 'cover', w: cellW, h: cellH } });
  });
}

function addMathBlock(slide: any, block: MathBlock, geo: any) {
  slide.addText(block.latex, { ...geo, fontFace: 'Cambria Math', fontSize: (block.fontSize ?? (block.display ? 34 : 24)) * 0.75, color: stripHash(block.color ?? '#0F172A'), align: block.display ? 'center' : 'left', valign: 'middle' });
}

function addAudioBlock(slide: any, block: AudioBlock, geo: any) {
  if (block.src?.startsWith('data:')) slide.addMedia({ ...geo, type: 'audio', data: block.src });
  else if (block.src) slide.addMedia({ ...geo, type: 'audio', path: block.src });
  slide.addText(block.caption ?? 'Audio', { ...geo, align: 'center', valign: 'middle', color: '64748B', fill: { color: 'F8FAFC' }, line: { color: 'CBD5E1' } });
}

function addBadgeBlock(slide: any, block: BadgeBlock, geo: any) {
  const fill = block.variant === 'outline' ? 'FFFFFF' : stripHash(block.color ?? '#EEF2FF');
  const line = stripHash(block.color ?? '#4F46E5');
  slide.addShape('roundRect', { ...geo, fill: { color: fill }, line: { color: line, width: block.variant === 'solid' ? 0 : 1 } });
  slide.addText(block.text, { ...geo, align: 'center', valign: 'middle', bold: true, fontSize: 11, color: stripHash(block.textColor ?? (block.variant === 'solid' ? '#FFFFFF' : block.color ?? '#4F46E5')) });
}

function addInkBlock(slide: any, block: InkBlock, sx: number, sy: number) {
  for (const stroke of block.strokes) {
    const pts = stroke.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const x = (block.x + Math.min(a.x, b.x)) * sx;
      const y = (block.y + Math.min(a.y, b.y)) * sy;
      const w = Math.max(0.01, Math.abs(b.x - a.x) * sx);
      const h = Math.max(0.01, Math.abs(b.y - a.y) * sy);
      slide.addShape('line', { x, y, w, h, flipH: b.x < a.x, flipV: b.y < a.y, line: { color: stripHash(stroke.color), width: stroke.width * 0.4 } });
    }
  }
}

function stripHash(c: string): string {
  if (!c) return '000000';
  if (c.startsWith('#')) return c.slice(1);
  return c;
}

function sanitizeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
