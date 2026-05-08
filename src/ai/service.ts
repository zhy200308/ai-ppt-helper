import type { ProviderConfig, ProxyConfig } from './types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: { id: string; name: string; arguments: string }[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolSpec[];
  stream?: boolean;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_input_delta' | 'done' | 'error' | 'usage' | 'thinking';
  text?: string;
  toolName?: string;
  toolId?: string;
  toolInputDelta?: string;
  toolInput?: unknown;
  error?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface TestConnectionResult {
  ok: boolean;
  latencyMs: number;
  errorMessage?: string;
  model?: string;
}

const DEFAULT_TEST_PROMPT = 'ping';

export class AIService {
  config: ProviderConfig;
  proxy?: ProxyConfig;
  constructor(config: ProviderConfig, proxy?: ProxyConfig) {
    this.config = config;
    this.proxy = proxy;
  }

  // -------- Connection test --------
  async testConnection(): Promise<TestConnectionResult> {
    const start = performance.now();
    try {
      const res = await this.chatOnce({
        messages: [{ role: 'user', content: DEFAULT_TEST_PROMPT }],
        maxTokens: 8,
      });
      return {
        ok: true,
        latencyMs: Math.round(performance.now() - start),
        model: res.model,
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        errorMessage: errorMessage(e),
      };
    }
  }

  // -------- Non-streaming single response (test / batch fallback) --------
  async chatOnce(req: ChatRequest): Promise<{ text: string; model?: string }> {
    const events: StreamEvent[] = [];
    for await (const ev of this.chat({ ...req, stream: false })) events.push(ev);
    const text = events.filter((e) => e.type === 'text').map((e) => e.text).join('');
    return { text, model: this.config.model };
  }

  // -------- Streaming chat — protocol-aware --------
  async *chat(req: ChatRequest): AsyncGenerator<StreamEvent> {
    switch (this.config.protocol) {
      case 'anthropic':
        yield* this.chatAnthropic(req);
        return;
      case 'openai':
        yield* this.chatOpenAI(req);
        return;
      case 'gemini':
        yield* this.chatGemini(req);
        return;
    }
  }

  // ============================================================
  // Anthropic /v1/messages
  // ============================================================
  private async *chatAnthropic(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const url = joinUrl(this.config.baseUrl, '/v1/messages');
    const system = req.messages.find((m) => m.role === 'system')?.content;
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
          };
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length) {
          return {
            role: 'assistant' as const,
            content: [
              ...(m.content ? [{ type: 'text', text: m.content }] : []),
              ...m.toolCalls.map((t) => ({
                type: 'tool_use',
                id: t.id,
                name: t.name,
                input: safeParseJson(t.arguments),
              })),
            ],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });
    const body: any = {
      model: this.config.model,
      max_tokens: req.maxTokens ?? this.config.maxTokens ?? 8192,
      messages,
      stream: req.stream !== false,
    };
    if (system) {
      // Tag the system prompt as cacheable so repeated turns hit the cache.
      body.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
    }
    if (req.temperature !== undefined) body.temperature = req.temperature;
    else if (this.config.temperature !== undefined) body.temperature = this.config.temperature;
    if (req.tools?.length) {
      body.tools = req.tools.map((t, i) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
        // Cache the longest-prefix tool definitions only (last entry).
        ...(i === (req.tools!.length - 1) ? { cache_control: { type: 'ephemeral' } } : {}),
      }));
    }
    // Extended thinking: opt-in via config.maxTokens > 8k. We expose
    // streamed thinking_delta events via the existing parseAnthropicStream.
    if ((req.maxTokens ?? this.config.maxTokens ?? 0) >= 16000) {
      body.thinking = { type: 'enabled', budget_tokens: 8000 };
    }
    const headers = this.buildHeaders('anthropic');
    const resp = await this.fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await safeRead(resp)}`);
    if (req.stream === false) {
      const data = await resp.json();
      for (const block of data.content ?? []) {
        if (block.type === 'text') yield { type: 'text', text: block.text };
        else if (block.type === 'tool_use')
          yield { type: 'tool_use', toolName: block.name, toolId: block.id, toolInput: block.input };
      }
      yield { type: 'usage', usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens } };
      yield { type: 'done' };
      return;
    }
    yield* parseAnthropicStream(resp.body!);
  }

  // ============================================================
  // OpenAI /chat/completions
  // ============================================================
  private async *chatOpenAI(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const url = joinUrl(this.config.baseUrl, '/chat/completions');
    const messages = req.messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((t) => ({
            id: t.id,
            type: 'function',
            function: { name: t.name, arguments: t.arguments },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });
    const body: any = {
      model: this.config.model,
      messages,
      stream: req.stream !== false,
    };
    if (req.maxTokens ?? this.config.maxTokens) body.max_tokens = req.maxTokens ?? this.config.maxTokens;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    else if (this.config.temperature !== undefined) body.temperature = this.config.temperature;
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }
    const headers = this.buildHeaders('openai');
    const resp = await this.fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await safeRead(resp)}`);
    if (req.stream === false) {
      const data = await resp.json();
      const choice = data.choices?.[0];
      if (choice?.message?.content) yield { type: 'text', text: choice.message.content };
      for (const tc of choice?.message?.tool_calls ?? []) {
        yield {
          type: 'tool_use',
          toolName: tc.function.name,
          toolId: tc.id,
          toolInput: safeParseJson(tc.function.arguments),
        };
      }
      yield { type: 'usage', usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens } };
      yield { type: 'done' };
      return;
    }
    yield* parseOpenAIStream(resp.body!);
  }

  // ============================================================
  // Gemini /v1beta/models/<model>:streamGenerateContent
  // ============================================================
  private async *chatGemini(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const path = req.stream !== false
      ? `/models/${this.config.model}:streamGenerateContent`
      : `/models/${this.config.model}:generateContent`;
    const url = joinUrl(this.config.baseUrl, path) +
      (this.config.authStyle === 'api-key-param' ? `?key=${encodeURIComponent(this.config.apiKey)}` : '');
    const contents: any[] = [];
    let systemInstruction: string | undefined;
    for (const m of req.messages) {
      if (m.role === 'system') {
        systemInstruction = (systemInstruction ? systemInstruction + '\n' : '') + m.content;
        continue;
      }
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }
    const body: any = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? this.config.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? this.config.maxTokens ?? 2048,
      },
    };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
    const headers = this.buildHeaders('gemini');
    const resp = await this.fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await safeRead(resp)}`);
    if (req.stream === false) {
      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
      if (text) yield { type: 'text', text };
      yield { type: 'done' };
      return;
    }
    yield* parseGeminiStream(resp.body!);
  }

  private buildHeaders(kind: 'anthropic' | 'openai' | 'gemini'): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (kind === 'anthropic') {
      if (this.config.authStyle === 'bearer') h['authorization'] = `Bearer ${this.config.apiKey}`;
      else h['x-api-key'] = this.config.apiKey;
      h['anthropic-version'] = '2023-06-01';
      // dangerous-direct-browser allows browser fetch to Anthropic.
      h['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (kind === 'openai') {
      h['authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (kind === 'gemini') {
      // key in URL; nothing else.
    }
    return h;
  }

  // The sidecar (when present) routes through the user proxy. Otherwise direct.
  private async fetch(url: string, init: RequestInit): Promise<Response> {
    const sidecar = (globalThis as any).__SIDECAR__ as undefined | { fetch: typeof fetch };
    if (sidecar?.fetch && this.proxy?.enabled) {
      return sidecar.fetch(url, init);
    }
    return fetch(url, init);
  }
}

// ============================================================
//  Stream parsers
// ============================================================

async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event?: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event: string | undefined;
      const dataLines: string[] = [];
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) yield { event, data: dataLines.join('\n') };
    }
  }
}

async function* parseAnthropicStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const toolBuf: Record<string, { name?: string; id?: string; input: string }> = {};
  for await (const { event, data } of readSSE(body)) {
    if (data === '[DONE]') break;
    let parsed: any;
    try { parsed = JSON.parse(data); } catch { continue; }
    const t = event ?? parsed.type;
    if (t === 'content_block_start') {
      const cb = parsed.content_block;
      if (cb?.type === 'tool_use') {
        toolBuf[parsed.index] = { name: cb.name, id: cb.id, input: '' };
        yield { type: 'tool_use', toolName: cb.name, toolId: cb.id };
      }
    } else if (t === 'content_block_delta') {
      const delta = parsed.delta;
      if (delta?.type === 'text_delta') yield { type: 'text', text: delta.text };
      else if (delta?.type === 'thinking_delta') yield { type: 'thinking', text: delta.thinking };
      else if (delta?.type === 'input_json_delta') {
        const buf = toolBuf[parsed.index];
        if (buf) {
          buf.input += delta.partial_json ?? '';
          yield { type: 'tool_input_delta', toolId: buf.id, toolInputDelta: delta.partial_json ?? '' };
        }
      }
    } else if (t === 'content_block_stop') {
      const buf = toolBuf[parsed.index];
      if (buf) {
        yield { type: 'tool_use', toolName: buf.name, toolId: buf.id, toolInput: safeParseJson(buf.input) };
      }
    } else if (t === 'message_delta') {
      if (parsed.usage) {
        yield { type: 'usage', usage: { outputTokens: parsed.usage.output_tokens } };
      }
    } else if (t === 'message_stop') {
      yield { type: 'done' };
    } else if (t === 'error') {
      yield { type: 'error', error: parsed.error?.message ?? 'Unknown error' };
    }
  }
}

async function* parseOpenAIStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const toolBuf: Record<string, { name?: string; id?: string; input: string }> = {};
  for await (const { data } of readSSE(body)) {
    if (data === '[DONE]') {
      yield { type: 'done' };
      return;
    }
    let parsed: any;
    try { parsed = JSON.parse(data); } catch { continue; }
    const choice = parsed.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta;
    if (delta?.content) yield { type: 'text', text: delta.content };
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = String(tc.index ?? 0);
        const buf = toolBuf[idx] ?? (toolBuf[idx] = { input: '' });
        if (tc.id) buf.id = tc.id;
        if (tc.function?.name) buf.name = tc.function.name;
        if (tc.function?.arguments) {
          buf.input += tc.function.arguments;
          yield { type: 'tool_input_delta', toolId: buf.id, toolInputDelta: tc.function.arguments };
        }
      }
    }
    if (choice.finish_reason) {
      for (const buf of Object.values(toolBuf)) {
        yield { type: 'tool_use', toolName: buf.name, toolId: buf.id, toolInput: safeParseJson(buf.input) };
      }
      if (parsed.usage) {
        yield {
          type: 'usage',
          usage: { inputTokens: parsed.usage.prompt_tokens, outputTokens: parsed.usage.completion_tokens },
        };
      }
    }
  }
  yield { type: 'done' };
}

async function* parseGeminiStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // Gemini stream uses NDJSON or array chunks. Try to extract JSON objects.
    let depth = 0;
    let start = -1;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          const chunk = buf.slice(start, i + 1);
          try {
            const parsed = JSON.parse(chunk);
            const text = parsed.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
            if (text) yield { type: 'text', text };
          } catch { /* ignore */ }
          buf = buf.slice(i + 1);
          i = -1;
          start = -1;
          depth = 0;
        }
      }
    }
  }
  yield { type: 'done' };
}

// ============================================================
//  Helpers
// ============================================================
function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return b + p;
}

function safeParseJson(s: string | undefined): unknown {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

async function safeRead(resp: Response): Promise<string> {
  try {
    const t = await resp.text();
    return t.slice(0, 500);
  } catch { return ''; }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// ============================================================
//  System proxy detection (sidecar-only; degrades gracefully)
// ============================================================
export async function detectSystemProxy(): Promise<{ httpProxy?: string; httpsProxy?: string } | null> {
  const sidecar = (globalThis as any).__SIDECAR__ as undefined | { detectProxy?: () => Promise<any> };
  if (sidecar?.detectProxy) return sidecar.detectProxy();
  return null;
}

export function parseProxyUrl(url: string): { mode: 'http' | 'socks5'; host?: string; port?: number; username?: string; password?: string } {
  try {
    const u = new URL(url);
    return {
      mode: u.protocol.startsWith('socks') ? 'socks5' : 'http',
      host: u.hostname,
      port: u.port ? Number(u.port) : undefined,
      username: u.username || undefined,
      password: u.password || undefined,
    };
  } catch {
    return { mode: 'http' };
  }
}
