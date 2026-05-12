import { resolveChartFromTable, resolveTableFromRef } from '../canvas/dataResolver';
import type { Block, ChartBlock, DataTable, Deck, Slide, TableBlock } from '../core/schema/types';

export type ChatContextScope = 'none' | 'deck' | 'slide' | 'selection';

export interface ChatContextRef {
  kind: 'deck' | 'slide' | 'block';
  id: string;
  label: string;
}

export interface ChatContextSnapshot {
  version: 1;
  scope: Exclude<ChatContextScope, 'none'>;
  label: string;
  text: string;
  refs: ChatContextRef[];
  truncated?: boolean;
  charCount: number;
}

export interface BuildChatContextOptions {
  scope: ChatContextScope;
  deck: Deck;
  activeSlideId: string | null;
  selectedBlockIds: string[];
}

const CONTEXT_LIMITS: Record<Exclude<ChatContextScope, 'none'>, number> = {
  deck: 24000,
  slide: 12000,
  selection: 8000,
};
const MAX_TEXT = 1600;
const MAX_TABLE_ROWS = 10;
const MAX_DECK_BLOCK_SNIPPETS = 8;

export function buildChatContextSnapshot(options: BuildChatContextOptions): ChatContextSnapshot | undefined {
  const { scope, deck, activeSlideId, selectedBlockIds } = options;
  if (scope === 'none') return undefined;
  if (scope === 'deck') return serializeDeckContext(deck);

  const slide = deck.slides.find((s) => s.id === activeSlideId) ?? deck.slides[0] ?? null;
  if (!slide) return undefined;
  const slideIndex = deck.slides.findIndex((s) => s.id === slide.id) + 1;

  if (scope === 'selection') {
    const ids = new Set(selectedBlockIds);
    const blocks = slide.blocks.filter((b) => ids.has(b.id));
    if (blocks.length === 0) return undefined;
    return serializeSelectionContext(deck, slide, slideIndex, blocks);
  }

  return serializeSlideContext(deck, slide, slideIndex);
}

export function serializeDeckContext(deck: Deck): ChatContextSnapshot {
  const lines = [
    '<PPT_CONTEXT scope="deck" version="1">',
    ...serializeDeckHeader(deck),
    `slide_count: ${deck.slides.length}`,
    '',
    'Slides:',
  ];

  deck.slides.forEach((slide, index) => {
    lines.push(...serializeSlideSummary(deck, slide, index + 1));
  });

  const tables = Object.values(deck.dataTables ?? {});
  if (tables.length > 0) {
    lines.push('', 'Data tables:');
    tables.forEach((table) => lines.push(...serializeDataTableSummary(table)));
  }

  lines.push('</PPT_CONTEXT>');
  return makeSnapshot('deck', `整份 PPT · ${deck.slides.length} 页`, [{ kind: 'deck', id: deck.meta.id, label: `整份 PPT · ${deck.slides.length} 页` }], lines, CONTEXT_LIMITS.deck);
}

export function serializeSlideContext(deck: Deck, slide: Slide, slideIndex: number): ChatContextSnapshot {
  const refs: ChatContextRef[] = [{ kind: 'slide', id: slide.id, label: `第 ${slideIndex} 页` }];
  const lines = [
    '<PPT_CONTEXT scope="slide" version="1">',
    ...serializeDeckHeader(deck),
    ...serializeSlideHeader(deck, slide, slideIndex),
    '',
    'Blocks:',
  ];

  sortBlocks(slide.blocks).forEach((block, index) => {
    refs.push({ kind: 'block', id: block.id, label: `第 ${slideIndex} 页 ${blockLabel(block)}` });
    lines.push(...serializeBlock(block, deck, slide.id, index + 1, false));
  });

  lines.push(...serializeReferencedTables(deck, slide.blocks));
  lines.push('</PPT_CONTEXT>');
  return makeSnapshot('slide', `第 ${slideIndex} 页 · ${slide.blocks.length} 组件`, refs, lines, CONTEXT_LIMITS.slide);
}

export function serializeSelectionContext(deck: Deck, slide: Slide, slideIndex: number, blocks: Block[]): ChatContextSnapshot {
  const sorted = sortBlocks(blocks);
  const refs: ChatContextRef[] = sorted.map((block) => ({ kind: 'block', id: block.id, label: `第 ${slideIndex} 页 ${blockLabel(block)}` }));
  const lines = [
    '<PPT_CONTEXT scope="selection" version="1">',
    ...serializeDeckHeader(deck),
    ...serializeSlideHeader(deck, slide, slideIndex),
    `selected_blocks: ${sorted.length}`,
    'instruction: Treat these selected blocks as the primary edit target unless the user explicitly asks for broader changes.',
    '',
    'Selected blocks:',
  ];

  sorted.forEach((block, index) => {
    lines.push(...serializeBlock(block, deck, slide.id, index + 1, false));
  });

  lines.push(...serializeReferencedTables(deck, sorted));
  lines.push('</PPT_CONTEXT>');
  return makeSnapshot('selection', `选中组件 · ${sorted.length} 个`, refs, lines, CONTEXT_LIMITS.selection);
}

function serializeDeckHeader(deck: Deck): string[] {
  const meta = deck.meta;
  const theme = deck.theme;
  return [
    `deck_id: ${meta.id}`,
    `deck_title: ${safeText(meta.title)}`,
    meta.description ? `deck_description: ${safeText(meta.description, 800)}` : '',
    `canvas: ${meta.width}x${meta.height}`,
    `theme: ${theme.name}; primary=${theme.primaryColor}; accent=${theme.accentColor}; background=${theme.backgroundColor}; text=${theme.textColor}; headingFont=${theme.fontFamilyHeading}; bodyFont=${theme.fontFamilyBody}`,
  ].filter(Boolean);
}

function serializeSlideHeader(deck: Deck, slide: Slide, slideIndex: number): string[] {
  return [
    `current_slide: ${slideIndex}/${deck.slides.length}`,
    `slide_id: ${slide.id}`,
    `slide_index: ${slideIndex}`,
    `layout: ${slide.layout ?? 'freeform'}`,
    `background: ${safeJson(slide.background ?? {})}`,
    slide.hidden ? 'slide_hidden: true' : '',
    slide.notes ? `notes: ${safeText(slide.notes)}` : 'notes: ',
    `block_count: ${slide.blocks.length}`,
  ].filter(Boolean);
}

function serializeSlideSummary(deck: Deck, slide: Slide, slideIndex: number): string[] {
  const title = findTitleText(slide);
  const textSnippets = sortBlocks(slide.blocks)
    .map(blockToPlainText)
    .filter(Boolean)
    .slice(0, MAX_DECK_BLOCK_SNIPPETS);
  const inventory = slide.blocks.reduce<Record<string, number>>((acc, block) => {
    acc[block.type] = (acc[block.type] ?? 0) + 1;
    return acc;
  }, {});
  return [
    `- slide ${slideIndex}/${deck.slides.length}: slide_id=${slide.id}; layout=${slide.layout ?? 'freeform'}; blocks=${slide.blocks.length}; inventory=${safeJson(inventory)}`,
    title ? `  title: ${safeText(title, 300)}` : '',
    slide.notes ? `  notes: ${safeText(slide.notes, 400)}` : '',
    textSnippets.length > 0 ? `  key_text: ${textSnippets.map((s) => safeText(s, 220)).join(' | ')}` : '',
  ].filter(Boolean);
}

function serializeBlock(block: Block, deck: Deck, slideId: string, ordinal: number, compact: boolean): string[] {
  const common = [
    `${ordinal}. block_id: ${block.id}`,
    `   slide_id: ${slideId}`,
    `   type: ${block.type}`,
    block.name ? `   name: ${safeText(block.name, 200)}` : '',
    `   rect: x=${block.x}, y=${block.y}, w=${block.w}, h=${block.h}, rotation=${block.rotation ?? 0}, z=${block.z}`,
    block.hidden || block.locked || block.opacity !== undefined ? `   flags: hidden=${!!block.hidden}, locked=${!!block.locked}, opacity=${block.opacity ?? 1}` : '',
  ].filter(Boolean);

  if (compact) return [...common, `   summary: ${safeText(blockToPlainText(block), 600)}`];
  return [...common, ...serializeBlockDetail(block, deck)];
}

function serializeBlockDetail(block: Block, deck: Deck): string[] {
  switch (block.type) {
    case 'text':
      return [
        `   text: ${safeText(block.runs.map((r) => r.text).join(''))}`,
        `   text_style: fontSize=${block.fontSize ?? ''}, fontFamily=${block.fontFamily ?? ''}, color=${block.color ?? ''}, align=${block.align ?? ''}, vAlign=${block.vAlign ?? ''}`,
        `   runs: ${safeJson(block.runs.map((r) => ({ text: safeText(r.text, 240), bold: r.bold, italic: r.italic, color: r.color, fontSize: r.fontSize, link: r.link })))}`,
      ];
    case 'shape':
      return [`   shape: ${block.shape}; fill=${block.fill ?? ''}; stroke=${block.stroke ?? ''}; strokeWidth=${block.strokeWidth ?? ''}; gradient=${safeJson(block.gradient ?? null)}`];
    case 'image':
      return [`   image: alt=${safeText(block.alt ?? '')}; fit=${block.fit ?? ''}; src=${summarizeAsset(block.src)}`];
    case 'chart':
      return serializeChartBlock(block, deck);
    case 'table':
      return serializeTableBlock(block, deck);
    case 'list':
      return [`   list: ordered=${block.ordered}; items=${safeJson(block.items.map((i) => ({ text: safeText(i.text, 240), level: i.level })))}`];
    case 'code':
      return [`   code: language=${block.language}; theme=${block.theme ?? ''}`, `   source: ${safeText(block.code)}`];
    case 'icon':
      return [`   icon: ${block.iconName}; color=${block.color ?? ''}; strokeWidth=${block.strokeWidth ?? ''}`];
    case 'kpi':
      return [`   kpi: label=${safeText(block.label)}; value=${safeText(block.value)}; delta=${safeText(block.delta ?? '')}; sub=${safeText(block.sub ?? '')}; tone=${block.deltaTone ?? ''}`];
    case 'progress':
      return [`   progress: value=${block.value}; label=${safeText(block.label ?? '')}; showValue=${!!block.showValue}; color=${block.color ?? ''}`];
    case 'gallery':
      return [`   gallery: images=${block.images.length}; captions=${safeJson(block.images.map((i) => safeText(i.caption ?? '', 200)))}`];
    case 'math':
      return [`   math: latex=${safeText(block.latex)}; display=${!!block.display}; fontSize=${block.fontSize ?? ''}`];
    case 'audio':
      return [`   audio: caption=${safeText(block.caption ?? '')}; src=${summarizeAsset(block.src)}; controls=${!!block.controls}; loop=${!!block.loop}`];
    case 'video':
      return [`   video: src=${summarizeAsset(block.src)}; poster=${summarizeAsset(block.poster ?? '')}; autoplay=${!!block.autoplay}; controls=${!!block.controls}`];
    case 'embed':
      return [`   embed: kind=${block.kind}; src=${summarizeAsset(block.src)}; fallback=${safeText(block.fallback ?? '')}`];
    case 'connector':
      return [`   connector: kind=${block.kind}; start=${safeJson(block.start)}; end=${safeJson(block.end)}; color=${block.color ?? ''}; arrowStart=${!!block.arrowStart}; arrowEnd=${!!block.arrowEnd}`];
    case 'divider':
      return [`   divider: color=${block.color ?? ''}; thickness=${block.thickness ?? ''}; style=${block.style ?? ''}`];
    case 'ink':
      return [`   ink: strokes=${block.strokes.length}; points=${block.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)}`];
    case 'badge':
      return [`   badge: text=${safeText(block.text)}; variant=${block.variant ?? ''}; color=${block.color ?? ''}; textColor=${block.textColor ?? ''}`];
  }
}

function serializeChartBlock(block: ChartBlock, deck: Deck): string[] {
  const resolved = resolveChartFromTable(block, deck);
  return [
    `   chart: ${block.chart}`,
    `   dataRef: ${safeJson(block.dataRef ?? null)}`,
    `   categories: ${safeJson(limitArray(resolved.categories, 24))}${resolved.categories.length > 24 ? `; omitted=${resolved.categories.length - 24}` : ''}`,
    `   series: ${safeJson(resolved.series.map((s) => ({ name: s.name, data: limitArray(s.data, 24), omitted: Math.max(0, s.data.length - 24) })))}`,
    `   options: ${safeJson(block.options ?? {})}`,
  ];
}

function serializeTableBlock(block: TableBlock, deck: Deck): string[] {
  const resolved = resolveTableFromRef(block, deck);
  const rows = resolved.cells.slice(0, MAX_TABLE_ROWS);
  return [
    `   table: rows=${resolved.rows}; cols=${resolved.cols}; headerRow=${resolved.headerRow}; headerCol=${resolved.headerCol}`,
    `   dataRef: ${safeJson(block.dataRef ?? null)}`,
    `   cells_showing: ${rows.length}/${resolved.cells.length}`,
    `   cells: ${safeJson(rows)}`,
    resolved.cells.length > rows.length ? `   omitted_rows: ${resolved.cells.length - rows.length}` : '',
  ].filter(Boolean);
}

function serializeReferencedTables(deck: Deck, blocks: Block[]): string[] {
  const tableIds = new Set<string>();
  blocks.forEach((block) => {
    if ((block.type === 'chart' || block.type === 'table') && block.dataRef?.tableId) tableIds.add(block.dataRef.tableId);
  });
  const tables = [...tableIds].map((id) => deck.dataTables?.[id]).filter(Boolean) as DataTable[];
  if (tables.length === 0) return [];
  return ['', 'Referenced data tables:', ...tables.flatMap(serializeDataTableSummary)];
}

function serializeDataTableSummary(table: DataTable): string[] {
  const rows = table.rows.slice(0, MAX_TABLE_ROWS);
  return [
    `- table_id=${table.id}; name=${safeText(table.name, 300)}; columns=${table.columns.length}; rows=${table.rows.length}; source=${table.source ?? ''}`,
    `  columns: ${table.columns.map((c) => `${c.key}:${c.label}:${c.type}`).join(', ')}`,
    rows.length > 0 ? `  sample_rows: ${safeJson(rows)}` : '',
    table.rows.length > rows.length ? `  omitted_rows: ${table.rows.length - rows.length}` : '',
  ].filter(Boolean);
}

function makeSnapshot(scope: Exclude<ChatContextScope, 'none'>, label: string, refs: ChatContextRef[], lines: string[], maxChars: number): ChatContextSnapshot {
  const raw = lines.join('\n');
  const { text, truncated } = clampContext(raw, maxChars);
  return { version: 1, scope, label, text, refs, truncated, charCount: text.length };
}

function clampContext(text: string, maxChars: number): { text: string; truncated?: boolean } {
  if (text.length <= maxChars) return { text };
  const suffix = '\n[Context truncated due to size limit]\n</PPT_CONTEXT>';
  return { text: text.slice(0, Math.max(0, maxChars - suffix.length)) + suffix, truncated: true };
}

function sortBlocks(blocks: Block[]): Block[] {
  return [...blocks].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
}

function findTitleText(slide: Slide): string {
  const textBlocks = slide.blocks.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text');
  const title = [...textBlocks].sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0))[0];
  return title ? blockToPlainText(title) : '';
}

function blockToPlainText(block: Block): string {
  switch (block.type) {
    case 'text': return block.runs.map((r) => r.text).join('');
    case 'list': return block.items.map((i) => i.text).join(' | ');
    case 'table': return block.cells.flat().join(' | ');
    case 'code': return block.code;
    case 'kpi': return [block.label, block.value, block.delta, block.sub].filter(Boolean).join(' | ');
    case 'progress': return [block.label, `${Math.round(block.value * 100)}%`].filter(Boolean).join(' | ');
    case 'badge': return block.text;
    case 'math': return block.latex;
    case 'image': return block.alt ?? '';
    case 'gallery': return block.images.map((i) => i.caption ?? '').filter(Boolean).join(' | ');
    case 'audio': return block.caption ?? '';
    case 'embed': return block.fallback ?? '';
    default: return '';
  }
}

function blockLabel(block: Block): string {
  if (block.name) return `${block.name} (${block.type})`;
  if (block.type === 'text') return `文本 ${block.id.slice(0, 6)}`;
  return `${block.type} ${block.id.slice(0, 6)}`;
}

function safeText(value: string, max = MAX_TEXT): string {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, (_key, val) => typeof val === 'string' ? safeText(val, 800) : val);
}

function summarizeAsset(src: string): string {
  if (!src) return '';
  if (src.startsWith('data:')) {
    const mime = src.slice(5, src.indexOf(';') > -1 ? src.indexOf(';') : 32);
    return `[data URL omitted, ${mime}, ${src.length} chars]`;
  }
  return safeText(src, 240);
}

function limitArray<T>(arr: T[], max: number): T[] {
  return arr.slice(0, max);
}
