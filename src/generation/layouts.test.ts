import { describe, it, expect } from 'vitest';
import { LAYOUT_REGISTRY, buildLayout, type LayoutTemplate } from './layouts';
import type { LayoutContext, LayoutKey, SlideContent } from './types';
import { DEFAULT_THEME, DECK_SIZE } from '../core/schema/factory';
import { LAYOUT_KEYS } from './types';

const ctx: LayoutContext = {
  theme: DEFAULT_THEME,
  width: DECK_SIZE.width,
  height: DECK_SIZE.height,
};

const SAMPLE: Record<LayoutKey, SlideContent> = {
  'cover-bold': { layout: 'cover-bold', title: '产品发布', subtitle: '2026 春季' },
  'cover-image': { layout: 'cover-image', title: 'AI 写作', subtitle: '让创意奔跑', image: { src: '' } },
  'agenda': { layout: 'agenda', title: '议程', bullets: ['现状', '机会', '产品', '路线图', '团队', 'Q&A'] },
  'section-divider': { layout: 'section-divider', title: '第二部分', eyebrow: 'PART 02' },
  'bullet': { layout: 'bullet', title: '关键洞察', bullets: ['用户增长 87%', '留存超过 60%', 'NPS 提升'] },
  'two-column-text': {
    layout: 'two-column-text', title: '优劣势',
    bullets: ['速度快', '成本低', '易扩展', '稳定性高', '生态丰富', '迁移容易'],
  },
  'image-left': { layout: 'image-left', title: '产品视觉', bullets: ['极简', '现代'], image: { src: '' } },
  'image-right': { layout: 'image-right', title: '设计语言', bullets: ['克制', '清晰'], image: { src: '' } },
  'kpi-trio': { layout: 'kpi-trio', title: '核心指标',
    stats: [
      { label: 'DAU', value: '1.2M', sub: '环比+18%' },
      { label: '留存', value: '62%', sub: 'D30 留存' },
      { label: 'NPS', value: '74', sub: '行业前 5%' },
    ],
  },
  'comparison': { layout: 'comparison', title: '方案对比',
    comparison: {
      left: { title: '方案 A', bullets: ['便宜', '稳定'] },
      right: { title: '方案 B', bullets: ['更快', '更新'] },
    },
  },
  'timeline-h': { layout: 'timeline-h', title: '路线图',
    timeline: [
      { ts: 'Q1', title: 'Beta', body: '内部试用' },
      { ts: 'Q2', title: 'GA', body: '公开发布' },
      { ts: 'Q3', title: 'V2', body: '海外' },
    ],
  },
  'steps-vertical': { layout: 'steps-vertical', title: '步骤',
    steps: [{ title: '注册' }, { title: '配置 API' }, { title: '生成首份 PPT' }],
  },
  'quote': { layout: 'quote', quote: { text: '设计是表达，不是装饰。', author: 'Massimo Vignelli', role: '设计师' } },
  'closing': { layout: 'closing', title: '感谢聆听', subtitle: 'Q&A' },
};

describe('layout engine', () => {
  it('exports all 14 templates', () => {
    expect(LAYOUT_KEYS.length).toBe(14);
    for (const k of LAYOUT_KEYS) {
      expect((LAYOUT_REGISTRY as Record<string, LayoutTemplate>)[k]).toBeDefined();
    }
  });

  for (const key of LAYOUT_KEYS) {
    it(`builds ${key} with valid blocks`, () => {
      const blocks = buildLayout(SAMPLE[key], ctx);
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) {
        expect(b.id).toMatch(/^blk/);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.w).toBeGreaterThan(0);
        expect(b.h).toBeGreaterThan(0);
        expect(b.x + b.w).toBeLessThanOrEqual(ctx.width + 1);
        expect(b.y + b.h).toBeLessThanOrEqual(ctx.height + 1);
      }
    });
  }

  it('falls back to bullet for unknown layout', () => {
    const blocks = buildLayout({ layout: 'nope' as any, title: 'T', bullets: ['a'] }, ctx);
    expect(blocks.some((b) => b.type === 'list')).toBe(true);
  });

  it('cover-bold produces brand stripe + title + subtitle', () => {
    const blocks = buildLayout(SAMPLE['cover-bold'], ctx);
    expect(blocks.some((b) => b.type === 'shape' && b.x === 0 && b.y === 0)).toBe(true);
    expect(blocks.filter((b) => b.type === 'text').length).toBeGreaterThanOrEqual(1);
  });

  it('kpi-trio produces 3 cards', () => {
    const blocks = buildLayout(SAMPLE['kpi-trio'], ctx);
    const cards = blocks.filter((b) => b.type === 'shape' && b.h === 460);
    expect(cards.length).toBe(3);
  });
});
