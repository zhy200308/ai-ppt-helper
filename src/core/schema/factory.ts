import { nanoid } from 'nanoid';
import type {
  Block,
  Deck,
  ImageBlock,
  ShapeBlock,
  Slide,
  TextBlock,
  ThemeSpec,
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
