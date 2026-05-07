// Glue layer: takes a chat session, calls the active provider, parses tool
// calls, and dispatches them to the deck store. Returns a stream of UI events.

import { useDeckStore } from '../core/store/deck';
import { useSettingsStore } from '../core/store/settings';
import {
  createDeck, createTextBlock, newId, createSlide,
} from '../core/schema/factory';
import type { Block, Slide } from '../core/schema/types';
import { AIService, type ChatMessage, type StreamEvent } from './service';
import { ALL_TOOLS } from './tools';

const SYSTEM_PROMPT = `You are an industrial-grade AI PowerPoint co-pilot. You design slides like
a senior product designer: bold typography, restrained palettes, tasteful spacing.

Conventions:
- Always prefer calling a tool over describing an action in plain text.
- Use \`generate_deck\` for new decks; \`add_slide\` to extend; \`edit_block\` /
  \`rewrite_text\` for fine-grained edits; \`set_theme\` to alter visual identity.
- Slides must be concise. Cover slides have a single clear title and subtitle.
  Body slides should have <= 6 bullets, each <= 14 words.
- When the user @-mentions a slide or block (e.g. \`@slide:3\` or \`@block:abc\`),
  treat that selection as the operand.

Output should be in the same language the user uses.`;

export interface ChatSessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  attachments?: { name: string; mime: string; previewText?: string }[];
  contextRefs?: { kind: 'slide' | 'block'; id: string; label: string }[];
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
    if (m.attachments?.length) {
      const parts = m.attachments.map((a) => `[Attachment: ${a.name}${a.previewText ? `\n${a.previewText.slice(0, 4000)}` : ''}]`).join('\n\n');
      content = `${content}\n\n${parts}`;
    }
    if (m.contextRefs?.length) {
      const refs = m.contextRefs.map((r) => `[${r.kind}:${r.id}]`).join(' ');
      content = `${refs} ${content}`;
    }
    out.push({ role: m.role, content });
  }
  return out;
}

// ============================================================
//  Tool dispatcher
// ============================================================

function applyTool(name: string, input: any): string {
  const store = useDeckStore.getState();
  switch (name) {
    case 'generate_deck':
      return doGenerateDeck(input);
    case 'add_slide':
      return doAddSlide(input);
    case 'edit_block':
      return doEditBlock(input);
    case 'rewrite_text':
      return doRewriteText(input);
    case 'set_theme':
      return doSetTheme(input);
    default:
      return `Unknown tool: ${name}`;
  }
  void store;
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

function buildSlideFromSpec(spec: any, theme: { primaryColor: string; accentColor: string; backgroundColor: string; textColor: string; mutedColor: string; fontFamilyHeading: string; fontFamilyBody: string }): Slide {
  const slide = createSlide({
    id: newId('sld'),
    layout: spec.layout,
    background: { color: theme.backgroundColor },
    notes: spec.notes ?? '',
    blocks: [],
  });
  const H = 1080;
  const layout = spec.layout || 'bullet';

  if (layout === 'cover') {
    slide.blocks.push({
      id: newId('blk'), type: 'shape', shape: 'rectangle',
      z: 0, x: 0, y: 0, w: 16, h: H, fill: theme.primaryColor,
    });
    slide.blocks.push(createTextBlock({
      id: newId('blk'), x: 160, y: 380, w: 1600, h: 200,
      runs: [{ text: spec.title, bold: true }],
      fontSize: 96, color: theme.textColor, fontFamily: theme.fontFamilyHeading,
    }));
    if (spec.subtitle) {
      slide.blocks.push(createTextBlock({
        id: newId('blk'), x: 160, y: 600, w: 1600, h: 100,
        runs: [{ text: spec.subtitle }],
        fontSize: 36, color: theme.mutedColor, fontFamily: theme.fontFamilyBody,
      }));
    }
    return slide;
  }

  // generic: title + body/bullets
  slide.blocks.push(createTextBlock({
    id: newId('blk'), x: 160, y: 120, w: 1600, h: 120,
    runs: [{ text: spec.title, bold: true }],
    fontSize: 56, color: theme.textColor, fontFamily: theme.fontFamilyHeading,
  }));
  slide.blocks.push({
    id: newId('blk'), type: 'shape', shape: 'rectangle',
    z: 0, x: 160, y: 240, w: 120, h: 6, fill: theme.accentColor,
  });

  if (Array.isArray(spec.bullets) && spec.bullets.length) {
    const startY = 320;
    const lineH = 84;
    for (let i = 0; i < spec.bullets.length; i++) {
      slide.blocks.push(createTextBlock({
        id: newId('blk'),
        x: 200, y: startY + i * lineH, w: 1520, h: lineH - 8,
        runs: [{ text: `•  ${spec.bullets[i]}` }],
        fontSize: 36, color: theme.textColor, fontFamily: theme.fontFamilyBody,
        align: 'left', vAlign: 'middle',
      }));
    }
  } else if (spec.body) {
    slide.blocks.push(createTextBlock({
      id: newId('blk'), x: 200, y: 320, w: 1520, h: 600,
      runs: [{ text: String(spec.body) }],
      fontSize: 32, color: theme.textColor,
      fontFamily: theme.fontFamilyBody,
      align: 'left', vAlign: 'top',
    }));
  }
  return slide;
}

// ============================================================
//  Main run loop with tool round-tripping
// ============================================================

export async function runChat(opts: {
  history: ChatSessionMessage[];
  signal: AbortSignal;
  onTextDelta: (delta: string) => void;
  onToolCall: (name: string, input: any) => void;
  onToolResult: (name: string, result: string) => void;
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

  // Up to 3 tool round-trips per user turn to converge.
  for (let round = 0; round < 3; round++) {
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
      ...pendingToolCalls.map((t) => {
        opts.onToolCall(t.name, t.input);
        const r = applyTool(t.name, t.input);
        opts.onToolResult(t.name, r);
        return { role: 'tool' as const, content: r, toolCallId: t.id };
      }),
    ];
  }
}
