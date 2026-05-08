// Quality pass over a freshly built slide. Catches:
// - blocks bleeding past canvas
// - large text overflowing its frame (heuristic: chars*fontSize > area)
// - illegal contrast between text color and slide background
// - excessive overlap of non-decoration blocks
//
// Returns mutated copies of the blocks plus a list of warnings the
// orchestrator can surface in the chat panel.

import type { Block, Slide, ThemeSpec } from '../core/schema/types';
import { contrastRatio, bestForeground } from '../themes/colorIntelligence';

export interface ValidationIssue {
  severity: 'info' | 'warn' | 'error';
  blockId?: string;
  message: string;
}

export interface ValidationResult {
  blocks: Block[];
  issues: ValidationIssue[];
}

export function validateSlide(slide: Slide, theme: ThemeSpec, deckW: number, deckH: number): ValidationResult {
  const issues: ValidationIssue[] = [];
  const blocks = slide.blocks.map((b) => ({ ...b }));
  const bg = slide.background?.color ?? theme.backgroundColor;

  for (const b of blocks) {
    // 1. Clamp to canvas — push back inside while preserving size.
    if (b.x < 0) b.x = 0;
    if (b.y < 0) b.y = 0;
    if (b.x + b.w > deckW) b.x = Math.max(0, deckW - b.w);
    if (b.y + b.h > deckH) b.y = Math.max(0, deckH - b.h);
    if (b.w > deckW) b.w = deckW;
    if (b.h > deckH) b.h = deckH;

    // 2. Text contrast — bump to AA fallback.
    if (b.type === 'text') {
      const c = b.color ?? theme.textColor;
      const ratio = contrastRatio(c, bg);
      if (ratio < 4.5) {
        const fixed = bestForeground(bg);
        b.color = fixed;
        issues.push({
          severity: 'info',
          blockId: b.id,
          message: `文本对比度 ${ratio.toFixed(2)} < 4.5（AA），已自动改为 ${fixed}`,
        });
      }
    }

    // 3. Text overflow heuristic (chars * size² > area * factor).
    if (b.type === 'text') {
      const size = b.fontSize ?? 32;
      const text = b.runs.map((r) => r.text).join('');
      const area = b.w * b.h;
      const projected = text.length * size * (b.lineHeight ?? 1.3);
      if (projected > area * 1.6) {
        issues.push({
          severity: 'warn',
          blockId: b.id,
          message: '文本可能溢出，请缩小字号或扩大文本框',
        });
      }
    }
  }

  // 4. Heavy overlap among non-z=0 blocks (decoration is z=0).
  const content = blocks.filter((b) => (b.z ?? 1) > 0 && !(b.type === 'shape' && b.z === 0));
  for (let i = 0; i < content.length; i++) {
    for (let j = i + 1; j < content.length; j++) {
      const a = content[i];
      const c = content[j];
      const overlap = rectOverlap(a, c);
      const minArea = Math.min(a.w * a.h, c.w * c.h);
      if (minArea > 0 && overlap / minArea > 0.6) {
        issues.push({
          severity: 'warn',
          blockId: a.id,
          message: `与 ${c.id.slice(0, 6)} 严重重叠（${Math.round((overlap / minArea) * 100)}%）`,
        });
      }
    }
  }

  return { blocks, issues };
}

function rectOverlap(a: Block, b: Block): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
}
