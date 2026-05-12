import type { Block, Deck, Slide } from '../core/schema/types';
import { renderSlideToPng } from '../export/slidePng';

export interface VisualIssue {
  slideId: string;
  blockId?: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export interface SlideVisualPreview {
  slideId: string;
  pngDataUrl: string;
  blocks: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
    text?: string;
  }>;
  issues: VisualIssue[];
}

export async function buildSlideVisualPreview(deck: Deck, slide: Slide, maxWidth = 960): Promise<SlideVisualPreview> {
  const scale = Math.min(1, maxWidth / deck.meta.width);
  const width = Math.round(deck.meta.width * scale);
  const height = Math.round(deck.meta.height * scale);
  const png = await renderSlideToPng(slide, {
    sourceWidth: deck.meta.width,
    sourceHeight: deck.meta.height,
    outputWidth: width,
    outputHeight: height,
  }, deck.theme);
  const pngDataUrl = `data:image/png;base64,${uint8ToBase64(png)}`;
  return {
    slideId: slide.id,
    pngDataUrl,
    blocks: slide.blocks.filter((b) => !b.hidden).map(summarizeBlock),
    issues: detectStaticVisualIssues(slide),
  };
}

export async function buildDeckVisualPreviews(deck: Deck, maxWidth = 960): Promise<SlideVisualPreview[]> {
  const slides = deck.slides.filter((s) => !s.hidden);
  const previews: SlideVisualPreview[] = [];
  for (const slide of slides) previews.push(await buildSlideVisualPreview(deck, slide, maxWidth));
  return previews;
}

function summarizeBlock(block: Block): SlideVisualPreview['blocks'][number] {
  return {
    id: block.id,
    type: block.type,
    x: Math.round(block.x),
    y: Math.round(block.y),
    w: Math.round(block.w),
    h: Math.round(block.h),
    z: block.z,
    text: extractBlockText(block).slice(0, 240) || undefined,
  };
}

function detectStaticVisualIssues(slide: Slide): VisualIssue[] {
  const issues: VisualIssue[] = [];
  const visible = slide.blocks.filter((b) => !b.hidden && (b.opacity ?? 1) > 0.05);
  for (const block of visible) {
    if (isTextLike(block)) {
      const text = extractBlockText(block);
      const fontSize = 'fontSize' in block && typeof block.fontSize === 'number' ? block.fontSize : 24;
      const projectedArea = text.length * fontSize * 0.65 * fontSize * 1.25;
      const boxArea = Math.max(1, block.w * block.h);
      if (projectedArea > boxArea * 1.15) {
        issues.push({ slideId: slide.id, blockId: block.id, severity: 'warn', message: '文本可能被裁剪或溢出' });
      }
      for (const top of visible) {
        if (top.id === block.id || top.z <= block.z || (top.opacity ?? 1) < 0.25) continue;
        const ratio = overlapRatio(block, top);
        if (ratio > 0.08 && isOccluding(top)) {
          issues.push({ slideId: slide.id, blockId: block.id, severity: ratio > 0.25 ? 'error' : 'warn', message: `文本可能被上层 ${top.type} 遮挡 (${Math.round(ratio * 100)}%)` });
        }
      }
    }
  }
  return issues;
}

function isTextLike(block: Block): boolean {
  return block.type === 'text' || block.type === 'list' || block.type === 'kpi' || block.type === 'badge' || block.type === 'math';
}

function isOccluding(block: Block): boolean {
  return block.type !== 'connector' && block.type !== 'divider' && block.type !== 'audio';
}

function extractBlockText(block: Block): string {
  switch (block.type) {
    case 'text': return block.runs.map((r) => r.text).join('');
    case 'list': return block.items.map((i) => i.text).join('\n');
    case 'kpi': return [block.value, block.label, block.delta, block.sub].filter(Boolean).join(' ');
    case 'badge': return block.text;
    case 'math': return block.latex;
    case 'table': return block.cells.flat().join(' ');
    case 'chart': return block.series.map((s) => s.name).join(' ');
    default: return '';
  }
}

function overlapRatio(a: Block, b: Block): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const overlap = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return overlap / Math.max(1, a.w * a.h);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
