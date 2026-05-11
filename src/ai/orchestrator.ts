// Glue layer: takes a chat session, calls the active provider, parses tool
// calls, and dispatches them to the deck store. Returns a stream of UI events.

import { useDeckStore } from '../core/store/deck';
import { useSettingsStore } from '../core/store/settings';
import { createDeck, newId, createSlide } from '../core/schema/factory';
import type { Block, Slide } from '../core/schema/types';
import { AIService, type ChatMessage, type ChatAttachment, type StreamEvent } from './service';
import { ALL_TOOLS } from './tools';
import { derivePalette, suggestFontPair } from '../themes/colorIntelligence';
import { loadSkill, parseSlash } from '../skills';
import { buildLayout, LAYOUT_REGISTRY } from '../generation/layouts';
import { validateSlide } from '../generation/validator';
import { captureSnapshot } from '../core/persistence/snapshots';
import { DECK_SIZE } from '../core/schema/factory';
import type { LayoutKey, SlideContent } from '../generation/types';

const SYSTEM_PROMPT = `You are an industrial-grade AI PowerPoint co-pilot. You design slides like
a senior product designer: bold typography, restrained palettes, tasteful spacing.

# Workflow
Producing a brand new deck is a TWO-step process:
  1. Call \`outline_deck\` with slide titles + one-line goals + a layout key
     for each (NOT body content). The orchestrator builds skeleton slides
     IMMEDIATELY so the user sees the shape of the deck within ~1s.
  2. For EACH slide in the outline (in order), call \`populate_slide\` with
     the rich content for that layout. After your last populate_slide call,
     write a one-paragraph plaintext summary.

Always use \`outline_deck\` first when the user asks for a deck, even short
ones. Never call \`generate_deck\` unless the user explicitly says "do it
all in one go".

# Available layouts (pick the one that best matches the slide's role)
- cover-bold: brand-stripe + huge title + subtitle (use for slide 1)
- cover-image: full-bleed image cover with overlay text + subtitle
- agenda: numbered table of contents (3-6 bullets)
- section-divider: large section break between major topics
- bullet: title + 3-6 bullets
- two-column-text: title + two columns of bullets (when content has two parallel ideas)
- image-left / image-right: title + bullets/body alongside an image
- kpi-trio: 3 large numerical KPIs with labels and sub-captions
- comparison: side-by-side option-A vs option-B with bullets
- timeline-h: 3-5 milestones laid out horizontally
- steps-vertical: 3-5 ordered steps
- quote: pull-quote with author + role
- closing: thank-you / call-to-action (use for last slide)

# populate_slide content shape
Each layout consumes specific fields; provide ONLY the relevant ones:
- cover-bold / cover-image / closing: title + subtitle (+ optional eyebrow)
- agenda / bullet / two-column-text: bullets[] (each <= 14 words)
- image-left / image-right: bullets[] OR body, plus image.src if available
- kpi-trio: stats[] of {label, value, sub}; max 3 entries
- comparison: comparison.{left,right}.{title,bullets[]}
- timeline-h: timeline[] of {ts, title, body?}; max 5
- steps-vertical: steps[] of {title, body?}; max 5
- quote: quote.{text, author?, role?}

# Data → chart / table workflow (HARD RULE)
Whenever the user asks for a chart, pie, bar, line, or numeric table:
  1. FIRST call \`create_data_table\` to record the source data with named
     columns (key + label + type) and rows. Even if the user only said
     "make a pie of Q1-Q4 sales", you must store it as a data table.
  2. THEN call \`insert_chart_from_table\` (for charts) or
     \`insert_table_from_table\` (for tabular display) referencing the
     table id you just created. NEVER inline numeric series directly into
     a chart block — the user can edit the data table to drive the chart.
  3. The data table is the single source of truth; multiple charts/tables
     can reference the same id. Reuse ids when updating.

# Style discipline
- <= 6 bullets per body slide, each <= 14 words
- Use parallel structure across bullets (start with same part of speech)
- Numbers: write them out for impact ("87%" not "approximately 87 percent")
- When @slide:N or @block:abc references appear, they are the edit target
- The validator will clamp blocks to the canvas and fix contrast; do not
  worry about pixel coordinates

- For decorative backgrounds, icons, dividers, lines, and generated SVG visuals, call insert_design_element with exact x/y/w/h plus a layer placement. Use SVG code for generated visuals when possible so the frontend can parse it as an image block.
- Use layer.mode="bottom" for background decorations, "middle" for supporting visuals, "top" for foreground accents, or "above"/"below" with targetBlockId when positioning relative to a specific block.

Output should be in the same language as the user.`;

export interface ChatSessionAttachment {
  name: string;
  mime: string;
  // Either a text snippet (for text-like uploads) or a data URL (for
  // images / pdfs). Persisted with the session so reloads keep context.
  previewText?: string;
  dataUrl?: string;
}

export interface ToolEvent {
  id: string;          // toolCallId from the LLM, also used as key
  name: string;
  input?: unknown;
  result?: string;
  status: 'running' | 'done' | 'error';
  ts: number;
}

export interface ChatSessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  attachments?: ChatSessionAttachment[];
  contextRefs?: { kind: 'slide' | 'block'; id: string; label: string }[];
  // Tool calls executed while this assistant message was being streamed.
  // Rendered as a collapsible "活动" timeline below the text.
  toolEvents?: ToolEvent[];
  ts: number;
  status?: 'pending' | 'streaming' | 'done' | 'error';
  error?: string;
}

export interface ChatRunResult {
  cancel: () => void;
  done: Promise<void>;
}

export function buildChatHistory(session: ChatSessionMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const m of session) {
    if (m.role === 'system') continue;
    let content = m.text;
    if (m.contextRefs?.length) {
      const refs = m.contextRefs.map((r) => `[${r.kind}:${r.id}]`).join(' ');
      content = `${refs} ${content}`;
    }
    const attachments: ChatAttachment[] = [];
    for (const a of m.attachments ?? []) {
      if (a.dataUrl && a.mime.startsWith('image/')) {
        attachments.push({ kind: 'image', mediaType: a.mime, dataUrl: a.dataUrl });
      } else if (a.dataUrl && a.mime === 'application/pdf') {
        attachments.push({ kind: 'document', mediaType: a.mime, dataUrl: a.dataUrl, name: a.name });
      } else if (a.previewText) {
        attachments.push({ kind: 'text', name: a.name, mediaType: a.mime, text: a.previewText.slice(0, 12000) });
      } else if (a.dataUrl) {
        // Unknown binary — degrade to a name-only text marker.
        attachments.push({ kind: 'text', name: a.name, mediaType: a.mime, text: `[Binary attachment ${a.name}]` });
      }
    }
    out.push({ role: m.role, content, attachments: attachments.length ? attachments : undefined });
  }
  return out;
}

// ============================================================
//  Tool dispatcher
// ============================================================

async function applyTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'generate_deck':
      return doGenerateDeck(input);
    case 'outline_deck':
      return doOutlineDeck(input);
    case 'populate_slide':
      return doPopulateSlide(input);
    case 'add_slide':
      return doAddSlide(input);
    case 'edit_block':
      return doEditBlock(input);
    case 'rewrite_text':
      return doRewriteText(input);
    case 'set_theme':
      return doSetTheme(input);
    case 'derive_theme':
      return doDeriveTheme(input);
    case 'insert_design_element':
      return doInsertDesignElement(input);
    case 'generate_image':
      return doGenerateImage(input);
    case 'create_data_table':
      return doCreateDataTable(input);
    case 'insert_chart_from_table':
      return doInsertChartFromTable(input);
    case 'insert_table_from_table':
      return doInsertTableFromTable(input);
    default:
      return `Unknown tool: ${name}`;
  }
}

function doCreateDataTable(input: any): string {
  const id = input.id || `dt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const table = {
    id,
    name: input.name || 'AI Data',
    columns: input.columns ?? [],
    rows: input.rows ?? [],
    source: 'AI',
    updatedAt: Date.now(),
  };
  if (!table.columns.length) return 'create_data_table: columns required';
  useDeckStore.getState().upsertDataTable(table);
  return `data table ${id} (${table.rows.length} rows × ${table.columns.length} cols) saved`;
}

function doInsertChartFromTable(input: any): string {
  const { slide_id, table_id, chart, x_column, y_columns, x, y, w, h } = input;
  if (!slide_id || !table_id || !chart || !x_column) return 'missing required fields';
  const table = useDeckStore.getState().deck.dataTables?.[table_id];
  if (!table) return `data table ${table_id} not found — call create_data_table first`;
  useDeckStore.getState().addBlock(slide_id, {
    id: newId('blk'),
    type: 'chart',
    chart,
    z: 1,
    x: x ?? 240, y: y ?? 260, w: w ?? 1440, h: h ?? 700,
    series: [], categories: [],
    dataRef: { tableId: table_id, xColumn: x_column, yColumns: y_columns },
  } as any);
  return `chart bound to ${table_id} on slide ${slide_id}`;
}

function doInsertTableFromTable(input: any): string {
  const { slide_id, table_id, columns, x, y, w, h } = input;
  if (!slide_id || !table_id) return 'missing required fields';
  const table = useDeckStore.getState().deck.dataTables?.[table_id];
  if (!table) return `data table ${table_id} not found`;
  const cols = columns?.length ? columns : table.columns.map((c) => c.key);
  useDeckStore.getState().addBlock(slide_id, {
    id: newId('blk'),
    type: 'table',
    rows: table.rows.length + 1,
    cols: cols.length,
    cells: [
      cols.map((k: string) => table.columns.find((c) => c.key === k)?.label ?? k),
      ...table.rows.map((r) => cols.map((k: string) => String(r[k] ?? ''))),
    ],
    headerRow: true,
    z: 1,
    x: x ?? 240, y: y ?? 260, w: w ?? 1440, h: h ?? 700,
    dataRef: { tableId: table_id, columns: cols },
  } as any);
  return `table bound to ${table_id} on slide ${slide_id}`;
}

function doOutlineDeck(input: any): string {
  const slides = (input.slides ?? []) as any[];
  if (!slides.length) return 'no slides outlined';
  const fresh = createDeck(input.title || 'AI Generated Deck');
  fresh.slides = [];
  for (const sd of slides) {
    // Use the goal as a small subtitle so users see something coherent
    // immediately; populate_slide will overwrite later.
    const skeleton = buildSlideFromSpec({
      layout: sd.layout,
      title: sd.title,
      subtitle: sd.goal,
    }, fresh.theme);
    fresh.slides.push(skeleton);
  }
  useDeckStore.getState().loadDeck(fresh);
  const ids = fresh.slides.map((s) => s.id);
  // Snapshot the outline so the user can roll back to it.
  void captureSnapshot(`AI outline · ${fresh.slides.length} 页`, 'ai');
  return `outlined ${ids.length} slides; ids=${ids.join(',')}`;
}

function doPopulateSlide(input: any): string {
  const { slide_id, subtitle, bullets, body, notes } = input;
  if (!slide_id) return 'missing slide_id';
  const store = useDeckStore.getState();
  const orig = store.deck.slides.find((s) => s.id === slide_id);
  if (!orig) return `slide ${slide_id} not found`;
  let issues: string[] = [];
  store.mutate('Populate slide', (draft) => {
    const s = draft.slides.find((x) => x.id === slide_id);
    if (!s) return;
    const next = buildSlideFromSpec({
      layout: orig.layout,
      title: extractTitle(orig),
      subtitle, bullets, body, notes,
      // Pass through any of the rich content fields the model may emit:
      eyebrow: input.eyebrow,
      stats: input.stats,
      comparison: input.comparison,
      timeline: input.timeline,
      quote: input.quote,
      steps: input.steps,
      image: input.image,
      numbered: input.numbered,
    }, draft.theme);
    s.blocks = next.blocks;
    s.notes = notes ?? s.notes;
    // Quality validator pass: clamp, fix contrast, flag overflow.
    const v = validateSlide(s, draft.theme, draft.meta.width, draft.meta.height);
    s.blocks = v.blocks;
    issues = v.issues.filter((i) => i.severity !== 'info').map((i) => i.message);
  });
  return issues.length
    ? `populated ${slide_id}; issues: ${issues.join('; ')}`
    : `populated ${slide_id}`;
}

function extractTitle(slide: any): string {
  const titleBlock = slide.blocks?.find((b: any) => b.type === 'text');
  return titleBlock?.runs?.[0]?.text ?? 'Untitled';
}

function doDeriveTheme(input: any): string {
  const palette = derivePalette(input.primary, input.mode === 'dark' ? 'dark' : 'light');
  const fonts = suggestFontPair(input.vibe ?? '');
  const theme = {
    name: input.name,
    primaryColor: palette.primary,
    accentColor: palette.accent,
    backgroundColor: palette.background,
    textColor: palette.text,
    mutedColor: palette.muted,
    fontFamilyHeading: fonts.heading,
    fontFamilyBody: fonts.body,
  };
  useDeckStore.getState().setTheme(theme);
  const id = `derived_${Date.now().toString(36)}`;
  useSettingsStore.getState().addTheme({ id, ...theme, source: 'manual', importedAt: Date.now() });
  useSettingsStore.getState().setActiveTheme(id);
  return `derived theme ${theme.name} from ${input.primary}`;
}

function doInsertDesignElement(input: any): string {
  const { slide_id, kind, x, y, w, h } = input;
  if (!slide_id || !kind) return 'missing required fields';
  const base = {
    id: newId('blk'),
    z: 1,
    x: Number.isFinite(x) ? x : 240,
    y: Number.isFinite(y) ? y : 240,
    w: Math.max(1, Number.isFinite(w) ? w : 600),
    h: Math.max(1, Number.isFinite(h) ? h : 320),
    opacity: typeof input.opacity === 'number' ? input.opacity : undefined,
  };
  let block: Block;
  if (kind === 'svg') {
    const svg = sanitizeSvg(input.svg_code);
    if (!svg) return 'svg_code required for svg element';
    block = {
      ...base,
      type: 'image',
      src: svgToDataUrl(svg),
      alt: input.alt ?? 'AI generated SVG design element',
      fit: 'fill',
      cornerRadius: 0,
    } as Block;
  } else if (kind === 'icon') {
    block = {
      ...base,
      type: 'icon',
      iconName: input.icon_name ?? 'Sparkles',
      color: input.color ?? '#0F172A',
      strokeWidth: input.strokeWidth ?? 2,
    } as Block;
  } else if (kind === 'line') {
    block = {
      ...base,
      type: 'divider',
      color: input.color ?? '#CBD5E1',
      thickness: input.strokeWidth ?? Math.max(2, Math.min(base.h, 8)),
      style: input.style === 'dashed' || input.style === 'dotted' ? input.style : 'solid',
    } as Block;
  } else {
    block = {
      ...base,
      type: 'shape',
      shape: input.shape ?? 'rectangle',
      fill: input.fill ?? 'transparent',
      stroke: input.color,
      strokeWidth: input.strokeWidth ?? 0,
    } as Block;
  }
  useDeckStore.getState().addBlock(slide_id, block, { layer: input.layer });
  return `${kind} design element inserted on ${slide_id}`;
}

function sanitizeSvg(svg: unknown): string {
  if (typeof svg !== 'string') return '';
  const trimmed = svg.trim();
  if (!trimmed.startsWith('<svg') || !trimmed.includes('</svg>')) return '';
  return trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function doGenerateImage(input: any): Promise<string> {
  const { generateImage } = await import('./imageGen');
  try {
    const dataUrl = await generateImage(input.prompt, input.style);
    if (!dataUrl) return 'image generation unavailable for current provider';
    const slideId = input.slide_id;
    const w = input.w ?? 1200;
    const h = input.h ?? 700;
    const x = input.x ?? 360;
    const y = input.y ?? 190;
    useDeckStore.getState().addBlock(slideId, {
      id: newId('blk'),
      type: 'image',
      z: 1,
      x, y, w, h,
      src: dataUrl,
      fit: input.fit ?? 'cover',
      cornerRadius: input.cornerRadius ?? 8,
    } as any, { layer: input.layer });
    return `image inserted on ${slideId}`;
  } catch (e) {
    return `image generation failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function doGenerateDeck(input: any): string {
  const slides = (input.slides ?? []) as any[];
  if (!slides.length) return 'no slides generated';
  const deckTitle = input.title || 'AI Generated Deck';
  const fresh = createDeck(deckTitle);
  fresh.slides = []; // start clean
  for (const sd of slides) {
    fresh.slides.push(buildSlideFromSpec(sd, fresh.theme));
  }
  if (!fresh.slides.length) fresh.slides.push(createSlide());
  useDeckStore.getState().loadDeck(fresh);
  return `generated ${fresh.slides.length} slides`;
}

function doAddSlide(input: any): string {
  const store = useDeckStore.getState();
  const slide = buildSlideFromSpec(input, store.deck.theme);
  store.mutate('AI: add slide', (draft) => {
    const idx = typeof input.after_index === 'number' && input.after_index >= 0
      ? Math.min(input.after_index + 1, draft.slides.length)
      : draft.slides.length;
    draft.slides.splice(idx, 0, slide);
  });
  store.selectSlide(slide.id);
  return `added slide ${slide.id}`;
}

function doEditBlock(input: any): string {
  const { slide_id, block_id, patch } = input;
  if (!slide_id || !block_id || !patch) return 'missing fields';
  useDeckStore.getState().updateBlock(slide_id, block_id, patch);
  return 'edited';
}

function doRewriteText(input: any): string {
  const { slide_id, block_id, new_text } = input;
  if (!slide_id || !block_id || !new_text) return 'missing fields';
  useDeckStore.getState().updateBlock(slide_id, block_id, {
    runs: [{ text: String(new_text) }],
  } as Partial<Block>);
  return 'rewritten';
}

function doSetTheme(input: any): string {
  const store = useDeckStore.getState();
  const settings = useSettingsStore.getState();
  const theme = {
    name: input.name,
    primaryColor: input.primaryColor,
    accentColor: input.accentColor,
    backgroundColor: input.backgroundColor,
    textColor: input.textColor,
    mutedColor: input.mutedColor ?? '#64748B',
    fontFamilyHeading: input.fontFamilyHeading ?? store.deck.theme.fontFamilyHeading,
    fontFamilyBody: input.fontFamilyBody ?? store.deck.theme.fontFamilyBody,
  };
  store.setTheme(theme);
  const id = `ai_${Date.now().toString(36)}`;
  settings.addTheme({ id, ...theme, source: 'manual', importedAt: Date.now() });
  settings.setActiveTheme(id);
  return `theme ${theme.name} applied`;
}

function buildSlideFromSpec(spec: any, theme: { primaryColor: string; accentColor: string; backgroundColor: string; textColor: string; mutedColor: string; fontFamilyHeading: string; fontFamilyBody: string; name?: string }): Slide {
  const layoutKey: LayoutKey = LAYOUT_REGISTRY[spec.layout] ? spec.layout : 'bullet';
  const content: SlideContent = {
    layout: layoutKey,
    title: spec.title,
    eyebrow: spec.eyebrow,
    subtitle: spec.subtitle,
    body: spec.body,
    bullets: spec.bullets,
    numbered: !!spec.numbered,
    image: spec.image,
    stats: spec.stats,
    comparison: spec.comparison,
    timeline: spec.timeline,
    quote: spec.quote,
    steps: spec.steps,
    notes: spec.notes,
  };
  const themeFull: any = { name: theme.name ?? 'AI', ...theme };
  const blocks = buildLayout(content, {
    theme: themeFull,
    width: DECK_SIZE.width,
    height: DECK_SIZE.height,
  });
  return createSlide({
    id: newId('sld'),
    layout: layoutKey,
    background: { color: theme.backgroundColor },
    notes: spec.notes ?? '',
    blocks,
  });
}

// ============================================================
//  Main run loop with tool round-tripping
// ============================================================

export async function runChat(opts: {
  history: ChatSessionMessage[];
  signal: AbortSignal;
  onTextDelta: (delta: string) => void;
  onToolCall: (id: string, name: string, input: any) => void;
  onToolResult: (id: string, name: string, result: string) => void;
  onError: (msg: string) => void;
  onUsage?: (u: { inputTokens?: number; outputTokens?: number }) => void;
}): Promise<void> {
  const { activeProvider, providers, proxyConfig } = useSettingsStore.getState();
  const cfg = providers[activeProvider];
  if (!cfg || !cfg.apiKey) {
    opts.onError('未配置 AI 服务的 API Key。请先在 设置 → AI 服务 中填写。');
    return;
  }
  const svc = new AIService(cfg, proxyConfig);
  let messages = buildChatHistory(opts.history);

  // Detect a leading slash-command on the latest user message and inject
  // the matching skill's systemPrompt at the top of the system stack.
  const lastUser = [...opts.history].reverse().find((m) => m.role === 'user');
  if (lastUser) {
    const parsed = parseSlash(lastUser.text);
    if (parsed) {
      const skill = await loadSkill(parsed.skill);
      if (skill && skill.enabled) {
        messages = [
          { role: 'system', content: `[Skill: ${skill.meta.title}]\n${skill.systemPrompt}` },
          ...messages,
        ];
      }
    }
  }

  // Up to 12 tool round-trips per user turn — enough for outline + N populate calls.
  for (let round = 0; round < 12; round++) {
    const events: StreamEvent[] = [];
    let assistantText = '';
    const pendingToolCalls: { id: string; name: string; input: any }[] = [];

    try {
      for await (const ev of svc.chat({ messages, tools: ALL_TOOLS, stream: true, signal: opts.signal })) {
        events.push(ev);
        if (ev.type === 'text' && ev.text) {
          assistantText += ev.text;
          opts.onTextDelta(ev.text);
        } else if (ev.type === 'tool_use' && ev.toolInput !== undefined) {
          pendingToolCalls.push({ id: ev.toolId ?? `tc_${Math.random().toString(36).slice(2, 10)}`, name: ev.toolName!, input: ev.toolInput });
        } else if (ev.type === 'usage' && ev.usage) {
          opts.onUsage?.(ev.usage);
        } else if (ev.type === 'error') {
          opts.onError(ev.error ?? 'Unknown error');
          return;
        }
      }
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      opts.onError(e instanceof Error ? e.message : String(e));
      return;
    }

    if (pendingToolCalls.length === 0) return;

    // Append assistant turn (with tool_calls) and tool results to history, then loop.
    messages = [
      ...messages,
      {
        role: 'assistant',
        content: assistantText,
        toolCalls: pendingToolCalls.map((t) => ({
          id: t.id,
          name: t.name,
          arguments: JSON.stringify(t.input ?? {}),
        })),
      },
      ...await Promise.all(pendingToolCalls.map(async (t) => {
        opts.onToolCall(t.id, t.name, t.input);
        const r = await applyTool(t.name, t.input);
        opts.onToolResult(t.id, t.name, r);
        return { role: 'tool' as const, content: r, toolCallId: t.id };
      })),
    ];
  }
}
