// End-to-end smoke test for the deck generation pipeline. We bypass any
// real LLM by directly invoking the tool dispatchers the orchestrator
// would call after parsing tool_use events. This proves that, given a
// realistic JSON tool sequence, the layout engine + validator + store
// produce a usable deck. If this file ever turns red, the project is
// generating broken output.

import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../core/store/deck';
import { useSettingsStore } from '../core/store/settings';
import { runChat } from './orchestrator';
import { LAYOUT_KEYS } from '../generation/types';

// --- Mock AIService -----------------------------------------------------
// We patch globalThis.fetch to return canned SSE events so the orchestrator
// runs unmodified.

interface ScriptedTurn {
  text?: string;
  toolCalls?: { name: string; input: any }[];
}

function makeAnthropicSSE(turn: ScriptedTurn): string {
  const lines: string[] = [];
  if (turn.text) {
    lines.push(`event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text' } })}\n`);
    lines.push(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: turn.text } })}\n`);
    lines.push(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n`);
  }
  for (let i = 0; i < (turn.toolCalls?.length ?? 0); i++) {
    const tc = turn.toolCalls![i];
    const id = `toolu_${i}`;
    lines.push(`event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: i + 1, content_block: { type: 'tool_use', id, name: tc.name, input: {} } })}\n`);
    lines.push(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: i + 1, delta: { type: 'input_json_delta', partial_json: JSON.stringify(tc.input) } })}\n`);
    lines.push(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: i + 1 })}\n`);
  }
  lines.push(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n`);
  return lines.join('\n');
}

function sseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}


beforeEach(() => {
  useDeckStore.getState().newDeck('Mock Test');
  // Force the active provider to a known shape and inject a fake key.
  useSettingsStore.setState({
    activeProvider: 'anthropic',
    providers: {
      anthropic: {
        provider: 'anthropic', label: 'mock', apiKey: 'sk-test',
        baseUrl: 'http://mock.local', model: 'claude-mock',
        protocol: 'anthropic', authStyle: 'x-api-key',
        temperature: 0.5, enabled: true,
      },
    },
  } as any);
});

describe('AI deck generation end-to-end (mocked LLM)', () => {
  it('runs outline_deck → 6× populate_slide → final summary', async () => {
    // Turn 1: model emits one tool_use for outline_deck.
    // Turn 2..7: model emits tool_use for populate_slide, one per outlined slide.
    // Turn 8: model emits a final assistant text, no tool calls.
    const slidesPlan = [
      { layout: 'cover-bold', title: 'AI Co-pilot', goal: '点题' },
      { layout: 'agenda', title: 'Agenda', goal: '议程' },
      { layout: 'kpi-trio', title: '关键数据', goal: '展示三个核心 KPI' },
      { layout: 'comparison', title: '方案对比', goal: '横向对比' },
      { layout: 'timeline-h', title: '路线图', goal: '路线时间轴' },
      { layout: 'closing', title: '感谢', goal: '收尾' },
    ];

    const text = useDeckStore.getState();
    void text;

    // Build slide-id-aware populate calls. Since outline_deck loads a
    // fresh deck, ids will be created at that moment; we read them then.
    const turns: ScriptedTurn[] = [
      { text: '让我先列大纲。', toolCalls: [{
        name: 'outline_deck',
        input: { title: 'AI Co-pilot', slides: slidesPlan },
      }] },
    ];

    // The orchestrator runs at most 12 rounds. We feed turn 1 (outline),
    // then in subsequent turns we look at the *current* deck and emit one
    // populate_slide per id. We do this lazily inside the mock fetch.
    let calls = 0;
    let populateIdx = 0;
    (globalThis as any).fetch = async () => {
      calls++;
      if (calls === 1) {
        return sseResponse(makeAnthropicSSE(turns[0]));
      }
      const slides = useDeckStore.getState().deck.slides;
      if (populateIdx < slides.length) {
        const slide = slides[populateIdx];
        const layout = slide.layout!;
        let input: any = { slide_id: slide.id };
        if (layout === 'cover-bold' || layout === 'closing') {
          input = { ...input, subtitle: 'A live deck composed by tests' };
        } else if (layout === 'agenda') {
          input = { ...input, bullets: ['现状', '机会', '产品', '路线图', '团队', 'Q&A'] };
        } else if (layout === 'kpi-trio') {
          input = { ...input, stats: [
            { label: 'DAU', value: '1.2M', sub: '+18%' },
            { label: '留存', value: '62%', sub: 'D30' },
            { label: 'NPS', value: '74', sub: '行业前 5%' },
          ] };
        } else if (layout === 'comparison') {
          input = { ...input, comparison: {
            left: { title: '方案 A', bullets: ['便宜', '稳定'] },
            right: { title: '方案 B', bullets: ['更快', '更新'] },
          } };
        } else if (layout === 'timeline-h') {
          input = { ...input, timeline: [
            { ts: 'Q1', title: 'Beta' },
            { ts: 'Q2', title: 'GA' },
            { ts: 'Q3', title: 'V2' },
          ] };
        } else {
          input = { ...input, bullets: ['一', '二', '三'] };
        }
        populateIdx++;
        return sseResponse(makeAnthropicSSE({
          toolCalls: [{ name: 'populate_slide', input }],
        }));
      }
      // Final turn: text-only, no tools → orchestrator exits.
      return sseResponse(makeAnthropicSSE({
        text: '生成完成，共 6 页。',
      }));
    };

    const ac = new AbortController();
    let toolCalls: string[] = [];
    let buf = '';
    let errored: string | null = null;
    await runChat({
      history: [{
        id: 'u1', role: 'user', text: '生成一份 6 页关于 AI Co-pilot 的发布会 PPT', ts: Date.now(),
      }],
      signal: ac.signal,
      onTextDelta: (d) => { buf += d; },
      onToolCall: (n) => toolCalls.push(n),
      onToolResult: () => {},
      onError: (m) => { errored = m; },
    });

    expect(errored).toBe(null);
    // Should have emitted the outline + 6 populates.
    expect(toolCalls).toContain('outline_deck');
    expect(toolCalls.filter((x) => x === 'populate_slide').length).toBe(6);
    expect(buf).toContain('生成完成');

    const finalDeck = useDeckStore.getState().deck;
    expect(finalDeck.slides.length).toBe(6);
    // Every slide must have populated content; specifically more than just the
    // skeleton's title block (most layouts produce >= 4 blocks).
    for (const s of finalDeck.slides) {
      expect(s.blocks.length).toBeGreaterThanOrEqual(2);
      // No block should be off-canvas after the validator pass.
      for (const b of s.blocks) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(finalDeck.meta.width + 1);
      }
    }
    // Spot-check the kpi-trio slide has 3 large stat numbers.
    const kpi = finalDeck.slides.find((s) => s.layout === 'kpi-trio')!;
    const bigNums = kpi.blocks.filter((b) => b.type === 'text' && (b as any).fontSize >= 100);
    expect(bigNums.length).toBe(3);
    // Spot-check the comparison slide has two columns.
    const cmp = finalDeck.slides.find((s) => s.layout === 'comparison')!;
    const cards = cmp.blocks.filter((b) => b.type === 'shape' && (b as any).shape === 'rounded-rectangle');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});

// Sanity: the module exports remain stable.
describe('LayoutKey enumeration', () => {
  it('matches generation module', () => {
    expect(LAYOUT_KEYS.length).toBe(14);
  });
});
