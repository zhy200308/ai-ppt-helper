// 14 industrial-grade slide layouts. All produce blocks in deck space
// (1920×1080). Typography scale and spacing follow an 8-pt grid.

import { newId } from '../core/schema/factory';
import type { Block } from '../core/schema/types';
import type { LayoutContext, LayoutTemplate as Tpl, SlideContent } from './types';
type LayoutTemplate = Tpl;
export type { LayoutTemplate };
import { bestForeground, contrastRatio } from '../themes/colorIntelligence';

const PAD_X = 160;        // outer horizontal margin
const PAD_Y = 120;        // outer vertical margin
const TITLE_BAR_H = 6;    // accent bar under titles

// ----- helpers ---------------------------------------------------------

function id() { return newId('blk'); }

function safeText(b: Partial<Block>): Block {
  return { id: id(), z: 1, ...b } as Block;
}

function ensureTitleColor(theme: LayoutContext['theme']): string {
  // Pick the higher-contrast option between theme.textColor and the
  // best fallback.
  const fg = theme.textColor;
  if (contrastRatio(fg, theme.backgroundColor) >= 4.5) return fg;
  return bestForeground(theme.backgroundColor);
}

function titleBlock(text: string, x: number, y: number, w: number, h: number, theme: LayoutContext['theme'], size = 72): Block {
  return safeText({
    type: 'text', x, y, w, h,
    runs: [{ text, bold: true }],
    fontSize: size, fontFamily: theme.fontFamilyHeading,
    color: ensureTitleColor(theme), align: 'left', vAlign: 'top',
  });
}

function eyebrow(text: string, x: number, y: number, w: number, theme: LayoutContext['theme']): Block {
  return safeText({
    type: 'text', x, y, w, h: 36,
    runs: [{ text: text.toUpperCase(), bold: true }],
    fontSize: 18, fontFamily: theme.fontFamilyBody,
    color: theme.primaryColor,
    align: 'left', vAlign: 'top', letterSpacing: 4,
  });
}

function subtitleBlock(text: string, x: number, y: number, w: number, theme: LayoutContext['theme']): Block {
  return safeText({
    type: 'text', x, y, w, h: 80,
    runs: [{ text }],
    fontSize: 28, fontFamily: theme.fontFamilyBody,
    color: theme.mutedColor, align: 'left', vAlign: 'top',
  });
}

function accentBar(x: number, y: number, theme: LayoutContext['theme'], w = 96): Block {
  return safeText({
    type: 'shape', shape: 'rectangle', x, y, w, h: TITLE_BAR_H,
    fill: theme.accentColor, z: 0,
  } as any);
}

function listBlock(items: string[], ordered: boolean, x: number, y: number, w: number, h: number, theme: LayoutContext['theme']): Block {
  return safeText({
    type: 'list',
    x, y, w, h,
    ordered,
    items: items.map((t) => ({ text: t, level: 0 })),
    fontSize: 32,
    color: theme.textColor,
    bulletColor: theme.primaryColor,
    fontFamily: theme.fontFamilyBody,
    lineHeight: 1.5,
  } as any);
}

function bodyBlock(text: string, x: number, y: number, w: number, h: number, theme: LayoutContext['theme']): Block {
  return safeText({
    type: 'text', x, y, w, h,
    runs: [{ text }],
    fontSize: 28, fontFamily: theme.fontFamilyBody,
    color: theme.textColor, align: 'left', vAlign: 'top', lineHeight: 1.5,
  });
}

// ----- 14 templates ----------------------------------------------------

const coverBold: LayoutTemplate = {
  key: 'cover-bold',
  name: 'Cover · 大字粗体',
  expects: ['title', 'subtitle'],
  build(c, { theme, height }) {
    const blocks: Block[] = [];
    blocks.push(safeText({
      type: 'shape', shape: 'rectangle', x: 0, y: 0, w: 12, h: height,
      fill: theme.primaryColor, z: 0,
    } as any));
    if (c.eyebrow) blocks.push(eyebrow(c.eyebrow, PAD_X, 360, 1600, theme));
    blocks.push(titleBlock(c.title ?? 'Title', PAD_X, 410, 1600, 200, theme, 96));
    if (c.subtitle) {
      blocks.push(subtitleBlock(c.subtitle, PAD_X, 640, 1600, theme));
    }
    return blocks;
  },
};

const coverImage: LayoutTemplate = {
  key: 'cover-image',
  name: 'Cover · 全图',
  expects: ['title', 'subtitle', 'image'],
  build(c, { theme, width, height }) {
    const blocks: Block[] = [];
    if (c.image?.src) {
      blocks.push(safeText({
        type: 'image', x: 0, y: 0, w: width, h: height,
        src: c.image.src, fit: 'cover', z: 0,
      } as any));
    } else {
      blocks.push(safeText({
        type: 'shape', shape: 'rectangle', x: 0, y: 0, w: width, h: height,
        fill: theme.primaryColor, z: 0,
        gradient: { type: 'linear', angle: 135, stops: [
          { offset: 0, color: theme.primaryColor },
          { offset: 1, color: theme.accentColor },
        ] },
      } as any));
    }
    // Dark overlay for legibility.
    blocks.push(safeText({
      type: 'shape', shape: 'rectangle', x: 0, y: height - 480, w: width, h: 480,
      fill: 'rgba(0,0,0,0.55)', z: 1,
    } as any));
    blocks.push(titleBlock(c.title ?? 'Title', PAD_X, height - 360, 1600, 200, { ...theme, textColor: '#FFFFFF' }, 96));
    if (c.subtitle) {
      blocks.push(safeText({
        type: 'text', x: PAD_X, y: height - 160, w: 1600, h: 80,
        runs: [{ text: c.subtitle }],
        fontSize: 28, color: '#E2E8F0', fontFamily: theme.fontFamilyBody, align: 'left', vAlign: 'top',
      }));
    }
    return blocks;
  },
};

const agenda: LayoutTemplate = {
  key: 'agenda',
  name: 'Agenda · 议程',
  expects: ['title', 'bullets'],
  build(c, { theme }) {
    const blocks: Block[] = [];
    blocks.push(eyebrow(c.eyebrow ?? '议程', PAD_X, PAD_Y, 1600, theme));
    blocks.push(titleBlock(c.title ?? 'Agenda', PAD_X, PAD_Y + 50, 1600, 120, theme, 64));
    blocks.push(accentBar(PAD_X, PAD_Y + 200, theme));
    const items = (c.bullets ?? []).slice(0, 6);
    items.forEach((t, i) => {
      const y = 320 + i * 100;
      blocks.push(safeText({
        type: 'text', x: PAD_X, y, w: 80, h: 80,
        runs: [{ text: String(i + 1).padStart(2, '0'), bold: true }],
        fontSize: 48, color: theme.primaryColor, fontFamily: theme.fontFamilyHeading, align: 'left',
      }));
      blocks.push(safeText({
        type: 'text', x: PAD_X + 100, y, w: 1500, h: 80,
        runs: [{ text: t }],
        fontSize: 32, color: theme.textColor, fontFamily: theme.fontFamilyBody, vAlign: 'middle',
      }));
    });
    return blocks;
  },
};

const sectionDivider: LayoutTemplate = {
  key: 'section-divider',
  name: 'Section · 分节页',
  expects: ['title', 'subtitle'],
  build(c, { theme, width, height }) {
    const blocks: Block[] = [];
    blocks.push(safeText({
      type: 'shape', shape: 'rectangle', x: 0, y: 0, w: width, h: height,
      fill: theme.primaryColor, z: 0,
    } as any));
    blocks.push(safeText({
      type: 'text', x: PAD_X, y: height / 2 - 100, w: width - PAD_X * 2, h: 60,
      runs: [{ text: (c.eyebrow ?? 'SECTION').toUpperCase(), bold: true }],
      fontSize: 22, color: '#FFFFFF', fontFamily: theme.fontFamilyBody,
      align: 'left', letterSpacing: 6,
    }));
    blocks.push(safeText({
      type: 'text', x: PAD_X, y: height / 2 - 30, w: width - PAD_X * 2, h: 200,
      runs: [{ text: c.title ?? 'Section title', bold: true }],
      fontSize: 120, color: '#FFFFFF', fontFamily: theme.fontFamilyHeading, align: 'left',
    }));
    return blocks;
  },
};

const bullet: LayoutTemplate = {
  key: 'bullet',
  name: 'Bullet · 标准条目',
  expects: ['title', 'bullets'],
  build(c, { theme }) {
    const blocks: Block[] = [];
    blocks.push(titleBlock(c.title ?? 'Title', PAD_X, PAD_Y, 1600, 120, theme, 64));
    blocks.push(accentBar(PAD_X, PAD_Y + 130, theme));
    const items = c.bullets ?? [];
    if (items.length) {
      blocks.push(listBlock(items, !!c.numbered, PAD_X, 320, 1600, 700, theme));
    } else if (c.body) {
      blocks.push(bodyBlock(c.body, PAD_X, 320, 1600, 700, theme));
    }
    return blocks;
  },
};

const twoColumn: LayoutTemplate = {
  key: 'two-column-text',
  name: 'Two columns · 双栏要点',
  expects: ['title', 'bullets'],
  build(c, { theme }) {
    const blocks: Block[] = [];
    blocks.push(titleBlock(c.title ?? 'Title', PAD_X, PAD_Y, 1600, 120, theme, 60));
    blocks.push(accentBar(PAD_X, PAD_Y + 130, theme));
    const items = c.bullets ?? [];
    const half = Math.ceil(items.length / 2);
    blocks.push(listBlock(items.slice(0, half), false, PAD_X, 300, 760, 720, theme));
    blocks.push(listBlock(items.slice(half), false, PAD_X + 800, 300, 760, 720, theme));
    return blocks;
  },
};

const imageLeft: LayoutTemplate = {
  key: 'image-left',
  name: 'Image · 图左文右',
  expects: ['title', 'bullets', 'image'],
  build(c, { theme, height }) {
    const blocks: Block[] = [];
    if (c.image?.src) {
      blocks.push(safeText({ type: 'image', x: 0, y: 0, w: 880, h: height, src: c.image.src, fit: 'cover', z: 0 } as any));
    } else {
      blocks.push(safeText({ type: 'shape', shape: 'rectangle', x: 0, y: 0, w: 880, h: height,
        fill: theme.primaryColor, z: 0 } as any));
    }
    blocks.push(titleBlock(c.title ?? 'Title', 940, PAD_Y, 880, 200, theme, 56));
    blocks.push(accentBar(940, PAD_Y + 200, theme));
    const items = c.bullets ?? [];
    if (items.length) {
      blocks.push(listBlock(items, false, 940, 360, 880, 600, theme));
    } else if (c.body) {
      blocks.push(bodyBlock(c.body, 940, 360, 880, 600, theme));
    }
    return blocks;
  },
};

const imageRight: LayoutTemplate = {
  key: 'image-right',
  name: 'Image · 文左图右',
  expects: ['title', 'bullets', 'image'],
  build(c, { theme, width, height }) {
    const blocks: Block[] = [];
    if (c.image?.src) {
      blocks.push(safeText({ type: 'image', x: width - 880, y: 0, w: 880, h: height, src: c.image.src, fit: 'cover', z: 0 } as any));
    } else {
      blocks.push(safeText({ type: 'shape', shape: 'rectangle', x: width - 880, y: 0, w: 880, h: height,
        fill: theme.accentColor, z: 0 } as any));
    }
    blocks.push(titleBlock(c.title ?? 'Title', PAD_X, PAD_Y, 800, 200, theme, 56));
    blocks.push(accentBar(PAD_X, PAD_Y + 200, theme));
    const items = c.bullets ?? [];
    if (items.length) blocks.push(listBlock(items, false, PAD_X, 360, 800, 600, theme));
    else if (c.body) blocks.push(bodyBlock(c.body, PAD_X, 360, 800, 600, theme));
    return blocks;
  },
};

const kpiTrio: LayoutTemplate = {
  key: 'kpi-trio',
  name: 'KPI · 三栏数据',
  expects: ['title', 'stats'],
  build(c, { theme, width }) {
    const blocks: Block[] = [];
    blocks.push(titleBlock(c.title ?? 'Title', PAD_X, PAD_Y, 1600, 100, theme, 56));
    blocks.push(accentBar(PAD_X, PAD_Y + 110, theme));
    const stats = (c.stats ?? []).slice(0, 3);
    const colW = (width - PAD_X * 2 - 40 * (stats.length - 1)) / Math.max(1, stats.length);
    stats.forEach((s, i) => {
      const x = PAD_X + i * (colW + 40);
      const y = 340;
      blocks.push(safeText({
        type: 'shape', shape: 'rounded-rectangle',
        x, y, w: colW, h: 460, fill: theme.backgroundColor,
        cornerRadius: 16, stroke: theme.mutedColor, strokeWidth: 1, z: 0,
      } as any));
      blocks.push(safeText({
        type: 'text', x: x + 24, y: y + 32, w: colW - 48, h: 36,
        runs: [{ text: s.label.toUpperCase(), bold: true }],
        fontSize: 18, color: theme.primaryColor, letterSpacing: 4, fontFamily: theme.fontFamilyBody,
      }));
      blocks.push(safeText({
        type: 'text', x: x + 24, y: y + 90, w: colW - 48, h: 220,
        runs: [{ text: s.value, bold: true }],
        fontSize: 120, color: theme.textColor, fontFamily: theme.fontFamilyHeading,
      }));
      if (s.sub) {
        blocks.push(safeText({
          type: 'text', x: x + 24, y: y + 350, w: colW - 48, h: 80,
          runs: [{ text: s.sub }],
          fontSize: 22, color: theme.mutedColor, fontFamily: theme.fontFamilyBody,
        }));
      }
    });
    return blocks;
  },
};

const comparison: LayoutTemplate = {
  key: 'comparison',
  name: 'Comparison · 对比',
  expects: ['title', 'comparison'],
  build(c, { theme }) {
    const blocks: Block[] = [];
    blocks.push(titleBlock(c.title ?? 'Comparison', PAD_X, PAD_Y, 1600, 100, theme, 56));
    blocks.push(accentBar(PAD_X, PAD_Y + 110, theme));
    const left = c.comparison?.left ?? { title: 'Option A', bullets: [] };
    const right = c.comparison?.right ?? { title: 'Option B', bullets: [] };
    const colW = 760;
    const ys = 280;
    [{ d: left, x: PAD_X, color: theme.primaryColor }, { d: right, x: PAD_X + colW + 40, color: theme.accentColor }].forEach(({ d, x, color }) => {
      blocks.push(safeText({
        type: 'shape', shape: 'rounded-rectangle',
        x, y: ys, w: colW, h: 700, fill: theme.backgroundColor,
        cornerRadius: 16, stroke: color, strokeWidth: 2, z: 0,
      } as any));
      blocks.push(safeText({
        type: 'text', x: x + 24, y: ys + 24, w: colW - 48, h: 80,
        runs: [{ text: d.title, bold: true }],
        fontSize: 36, color, fontFamily: theme.fontFamilyHeading,
      }));
      blocks.push(listBlock(d.bullets ?? [], false, x + 24, ys + 120, colW - 48, 540, theme));
    });
    return blocks;
  },
};

const timelineH: LayoutTemplate = {
  key: 'timeline-h',
  name: 'Timeline · 横向时间线',
  expects: ['title', 'timeline'],
  build(c, { theme, width }) {
    const blocks: Block[] = [];
    blocks.push(titleBlock(c.title ?? 'Timeline', PAD_X, PAD_Y, 1600, 100, theme, 56));
    blocks.push(accentBar(PAD_X, PAD_Y + 110, theme));
    const items = (c.timeline ?? []).slice(0, 5);
    if (items.length === 0) return blocks;
    const startY = 540;
    blocks.push(safeText({
      type: 'shape', shape: 'rectangle',
      x: PAD_X, y: startY, w: width - PAD_X * 2, h: 4,
      fill: theme.mutedColor, z: 0,
    } as any));
    const span = width - PAD_X * 2;
    const step = span / (items.length - 1 || 1);
    items.forEach((it, i) => {
      const cx = PAD_X + step * i;
      blocks.push(safeText({
        type: 'shape', shape: 'ellipse',
        x: cx - 14, y: startY - 12, w: 28, h: 28,
        fill: theme.primaryColor, z: 1,
      } as any));
      blocks.push(safeText({
        type: 'text', x: cx - 140, y: startY - 110, w: 280, h: 60,
        runs: [{ text: it.ts, bold: true }],
        fontSize: 22, color: theme.primaryColor, align: 'center', fontFamily: theme.fontFamilyBody,
      }));
      blocks.push(safeText({
        type: 'text', x: cx - 140, y: startY + 40, w: 280, h: 70,
        runs: [{ text: it.title, bold: true }],
        fontSize: 24, color: theme.textColor, align: 'center', fontFamily: theme.fontFamilyHeading,
      }));
      if (it.body) {
        blocks.push(safeText({
          type: 'text', x: cx - 160, y: startY + 110, w: 320, h: 120,
          runs: [{ text: it.body }],
          fontSize: 18, color: theme.mutedColor, align: 'center', fontFamily: theme.fontFamilyBody,
        }));
      }
    });
    return blocks;
  },
};

const stepsVertical: LayoutTemplate = {
  key: 'steps-vertical',
  name: 'Steps · 步骤',
  expects: ['title', 'steps'],
  build(c, { theme }) {
    const blocks: Block[] = [];
    blocks.push(titleBlock(c.title ?? 'Steps', PAD_X, PAD_Y, 1600, 100, theme, 56));
    blocks.push(accentBar(PAD_X, PAD_Y + 110, theme));
    const items = (c.steps ?? []).slice(0, 5);
    items.forEach((s, i) => {
      const y = 280 + i * 130;
      blocks.push(safeText({
        type: 'shape', shape: 'ellipse', x: PAD_X, y, w: 80, h: 80,
        fill: theme.primaryColor, z: 0,
      } as any));
      blocks.push(safeText({
        type: 'text', x: PAD_X, y, w: 80, h: 80,
        runs: [{ text: String(i + 1), bold: true }],
        fontSize: 36, color: '#FFFFFF', align: 'center', vAlign: 'middle', fontFamily: theme.fontFamilyHeading,
      }));
      blocks.push(safeText({
        type: 'text', x: PAD_X + 110, y, w: 1480, h: 50,
        runs: [{ text: s.title, bold: true }],
        fontSize: 28, color: theme.textColor, fontFamily: theme.fontFamilyHeading,
      }));
      if (s.body) {
        blocks.push(safeText({
          type: 'text', x: PAD_X + 110, y: y + 50, w: 1480, h: 60,
          runs: [{ text: s.body }],
          fontSize: 20, color: theme.mutedColor, fontFamily: theme.fontFamilyBody, lineHeight: 1.4,
        }));
      }
    });
    return blocks;
  },
};

const quote: LayoutTemplate = {
  key: 'quote',
  name: 'Quote · 引言',
  expects: ['quote'],
  build(c, { theme, width, height }) {
    const blocks: Block[] = [];
    const q = c.quote ?? { text: 'A great quote.' };
    blocks.push(safeText({
      type: 'text', x: PAD_X, y: 200, w: width - PAD_X * 2, h: 100,
      runs: [{ text: '“', bold: true }],
      fontSize: 200, color: theme.primaryColor, fontFamily: theme.fontFamilyHeading, align: 'center',
    }));
    blocks.push(safeText({
      type: 'text', x: PAD_X, y: 380, w: width - PAD_X * 2, h: 320,
      runs: [{ text: q.text, italic: true }],
      fontSize: 56, color: theme.textColor, fontFamily: theme.fontFamilyHeading,
      align: 'center', lineHeight: 1.4,
    }));
    if (q.author) {
      blocks.push(safeText({
        type: 'text', x: PAD_X, y: height - 220, w: width - PAD_X * 2, h: 60,
        runs: [{ text: `— ${q.author}`, bold: true }],
        fontSize: 28, color: theme.primaryColor, fontFamily: theme.fontFamilyBody, align: 'center',
      }));
    }
    if (q.role) {
      blocks.push(safeText({
        type: 'text', x: PAD_X, y: height - 160, w: width - PAD_X * 2, h: 40,
        runs: [{ text: q.role }],
        fontSize: 20, color: theme.mutedColor, fontFamily: theme.fontFamilyBody, align: 'center',
      }));
    }
    return blocks;
  },
};

const closing: LayoutTemplate = {
  key: 'closing',
  name: 'Closing · 结尾',
  expects: ['title', 'subtitle'],
  build(c, { theme, width, height }) {
    const blocks: Block[] = [];
    blocks.push(safeText({
      type: 'shape', shape: 'rectangle', x: 0, y: 0, w: width, h: height,
      fill: theme.backgroundColor, z: 0,
      gradient: { type: 'radial', stops: [
        { offset: 0, color: theme.primaryColor },
        { offset: 1, color: theme.backgroundColor },
      ] },
    } as any));
    blocks.push(safeText({
      type: 'text', x: PAD_X, y: height / 2 - 120, w: width - PAD_X * 2, h: 160,
      runs: [{ text: c.title ?? '感谢聆听', bold: true }],
      fontSize: 120, color: theme.textColor, fontFamily: theme.fontFamilyHeading,
      align: 'center', vAlign: 'middle',
    }));
    if (c.subtitle) {
      blocks.push(safeText({
        type: 'text', x: PAD_X, y: height / 2 + 80, w: width - PAD_X * 2, h: 60,
        runs: [{ text: c.subtitle }],
        fontSize: 32, color: theme.mutedColor, fontFamily: theme.fontFamilyBody, align: 'center',
      }));
    }
    return blocks;
  },
};

export const LAYOUT_REGISTRY: Record<string, LayoutTemplate> = {
  'cover-bold': coverBold,
  'cover-image': coverImage,
  'agenda': agenda,
  'section-divider': sectionDivider,
  'bullet': bullet,
  'two-column-text': twoColumn,
  'image-left': imageLeft,
  'image-right': imageRight,
  'kpi-trio': kpiTrio,
  'comparison': comparison,
  'timeline-h': timelineH,
  'steps-vertical': stepsVertical,
  'quote': quote,
  'closing': closing,
};

// Run a template, defaulting to bullet if the requested layout is unknown.
export function buildLayout(content: SlideContent, ctx: LayoutContext): Block[] {
  const t = LAYOUT_REGISTRY[content.layout] ?? LAYOUT_REGISTRY['bullet'];
  return t.build(content, ctx);
}
