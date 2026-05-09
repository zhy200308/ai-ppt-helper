import { nanoid } from 'nanoid';
import type {
  AudioBlock,
  BadgeBlock,
  Block,
  ConnectorBlock,
  DataTable,
  Deck,
  DividerBlock,
  EmbedBlock,
  GalleryBlock,
  ImageBlock,
  KpiCardBlock,
  ListBlock,
  MathBlock,
  ProgressBlock,
  ShapeBlock,
  Slide,
  TextBlock,
  ThemeSpec,
  VideoBlock,
} from './types';

export const DEFAULT_THEME: ThemeSpec = {
  name: 'Aurora',
  primaryColor: '#4F46E5',
  accentColor: '#06B6D4',
  backgroundColor: '#FFFFFF',
  textColor: '#0F172A',
  mutedColor: '#64748B',
  fontFamilyHeading: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
  fontFamilyBody: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
  fontFamilyCode: 'JetBrains Mono, Consolas, monospace',
  borderRadius: 8,
};

export const DECK_SIZE = { width: 1920, height: 1080 } as const;

export function newId(prefix = ''): string {
  return prefix ? `${prefix}_${nanoid(10)}` : nanoid(12);
}

export function createTextBlock(partial: Partial<TextBlock> = {}): TextBlock {
  return {
    id: newId('blk'),
    type: 'text',
    z: 1,
    x: 200,
    y: 400,
    w: 1520,
    h: 200,
    runs: [{ text: 'Click to edit', fontSize: 56 }],
    align: 'left',
    vAlign: 'middle',
    fontSize: 56,
    color: '#0F172A',
    lineHeight: 1.3,
    ...partial,
  };
}

export function createShapeBlock(partial: Partial<ShapeBlock> = {}): ShapeBlock {
  return {
    id: newId('blk'),
    type: 'shape',
    shape: 'rectangle',
    z: 1,
    x: 300,
    y: 300,
    w: 400,
    h: 240,
    fill: '#4F46E5',
    cornerRadius: 12,
    ...partial,
  };
}

export function createListBlock(partial: Partial<ListBlock> = {}): ListBlock {
  return {
    id: newId('blk'),
    type: 'list',
    z: 1,
    x: 200,
    y: 300,
    w: 1200,
    h: 500,
    ordered: false,
    items: [
      { text: '第一点 — 概述要点', level: 0 },
      { text: '第二点 — 关键支撑', level: 0 },
      { text: '第三点 — 行动建议', level: 0 },
    ],
    fontSize: 32,
    color: '#0F172A',
    bulletColor: '#4F46E5',
    lineHeight: 1.5,
    ...partial,
  };
}

export function createDividerBlock(partial: Partial<DividerBlock> = {}): DividerBlock {
  return {
    id: newId('blk'),
    type: 'divider',
    z: 1,
    x: 200,
    y: 540,
    w: 1520,
    h: 4,
    color: '#CBD5E1',
    thickness: 2,
    style: 'solid',
    ...partial,
  };
}

export function createVideoBlock(partial: Partial<VideoBlock> = {}): VideoBlock {
  return {
    id: newId('blk'),
    type: 'video',
    z: 1,
    x: 300,
    y: 200,
    w: 1280,
    h: 720,
    src: '',
    controls: true,
    cornerRadius: 8,
    ...partial,
  };
}

export function createEmbedBlock(partial: Partial<EmbedBlock> = {}): EmbedBlock {
  return {
    id: newId('blk'),
    type: 'embed',
    z: 1,
    x: 300,
    y: 200,
    w: 1000,
    h: 600,
    src: '',
    kind: 'iframe',
    fallback: 'Iframe embed — set src to enable preview.',
    cornerRadius: 8,
    ...partial,
  };
}

export function createConnectorBlock(partial: Partial<ConnectorBlock> = {}): ConnectorBlock {
  return {
    id: newId('blk'),
    type: 'connector',
    kind: 'straight',
    z: 1,
    x: 200,
    y: 400,
    w: 600,
    h: 200,
    start: { x: 200, y: 500, edge: 'right' },
    end: { x: 800, y: 500, edge: 'left' },
    color: '#475569',
    strokeWidth: 3,
    arrowEnd: true,
    ...partial,
  };
}

export function createProgressBlock(partial: Partial<ProgressBlock> = {}): ProgressBlock {
  return {
    id: newId('blk'), type: 'progress', z: 1,
    x: 240, y: 480, w: 1440, h: 80,
    value: 0.65, label: '完成度', showValue: true,
    color: '#4F46E5', trackColor: '#E2E8F0', thickness: 12,
    ...partial,
  };
}

export function createKpiCardBlock(partial: Partial<KpiCardBlock> = {}): KpiCardBlock {
  return {
    id: newId('blk'), type: 'kpi', z: 1,
    x: 600, y: 380, w: 720, h: 360,
    label: '日活用户',
    value: '1.2M',
    delta: '+18%',
    deltaTone: 'up',
    sub: '环比上周',
    color: '#4F46E5',
    ...partial,
  };
}

export function createGalleryBlock(partial: Partial<GalleryBlock> = {}): GalleryBlock {
  return {
    id: newId('blk'), type: 'gallery', z: 1,
    x: 200, y: 220, w: 1520, h: 720,
    images: [], columns: 3, gap: 16, cornerRadius: 8,
    ...partial,
  };
}

export function createMathBlock(partial: Partial<MathBlock> = {}): MathBlock {
  return {
    id: newId('blk'), type: 'math', z: 1,
    x: 300, y: 400, w: 1320, h: 280,
    latex: 'E = mc^2',
    display: true,
    color: '#0F172A',
    fontSize: 48,
    ...partial,
  };
}

export function createAudioBlock(partial: Partial<AudioBlock> = {}): AudioBlock {
  return {
    id: newId('blk'), type: 'audio', z: 1,
    x: 400, y: 480, w: 1120, h: 80,
    src: '', controls: true, loop: false,
    ...partial,
  };
}

export function createBadgeBlock(partial: Partial<BadgeBlock> = {}): BadgeBlock {
  return {
    id: newId('blk'), type: 'badge', z: 1,
    x: 200, y: 200, w: 200, h: 48,
    text: 'NEW', variant: 'solid', color: '#4F46E5', textColor: '#FFFFFF',
    ...partial,
  };
}

export function createDataTable(partial: Partial<DataTable> = {}): DataTable {
  return {
    id: newId('dt'),
    name: '新数据表',
    columns: [
      { key: 'category', label: '类别', type: 'string' },
      { key: 'value', label: '数值', type: 'number' },
    ],
    rows: [
      { category: 'Q1', value: 120 },
      { category: 'Q2', value: 180 },
      { category: 'Q3', value: 150 },
      { category: 'Q4', value: 220 },
    ],
    updatedAt: Date.now(),
    ...partial,
  };
}

export function createImageBlock(partial: Partial<ImageBlock> = {}): ImageBlock {
  return {
    id: newId('blk'),
    type: 'image',
    z: 1,
    x: 300,
    y: 200,
    w: 800,
    h: 500,
    src: '',
    fit: 'cover',
    cornerRadius: 8,
    ...partial,
  };
}

export function createSlide(partial: Partial<Slide> = {}): Slide {
  return {
    id: newId('sld'),
    layout: 'blank',
    background: { color: '#FFFFFF' },
    blocks: [],
    notes: '',
    transition: { type: 'fade', duration: 300 },
    ...partial,
  };
}

export function createCoverSlide(theme: ThemeSpec, title: string, subtitle = ''): Slide {
  const blocks: Block[] = [
    {
      id: newId('blk'),
      type: 'shape',
      shape: 'rectangle',
      z: 0,
      x: 0,
      y: 0,
      w: 16,
      h: 1080,
      fill: theme.primaryColor,
    },
    {
      id: newId('blk'),
      type: 'text',
      z: 1,
      x: 160,
      y: 380,
      w: 1600,
      h: 180,
      runs: [{ text: title, bold: true }],
      fontSize: 96,
      color: theme.textColor,
      fontFamily: theme.fontFamilyHeading,
      align: 'left',
    },
    {
      id: newId('blk'),
      type: 'text',
      z: 1,
      x: 160,
      y: 580,
      w: 1600,
      h: 100,
      runs: [{ text: subtitle }],
      fontSize: 36,
      color: theme.mutedColor,
      fontFamily: theme.fontFamilyBody,
      align: 'left',
    },
  ];
  return createSlide({ layout: 'cover', blocks });
}

export function createDeck(title = 'Untitled Presentation'): Deck {
  const theme = { ...DEFAULT_THEME };
  return {
    meta: {
      id: newId('deck'),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      width: DECK_SIZE.width,
      height: DECK_SIZE.height,
    },
    theme,
    slides: [createCoverSlide(theme, title, 'AI-powered presentation')],
  };
}
