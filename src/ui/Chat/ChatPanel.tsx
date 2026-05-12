import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, Paperclip, Square, X, AtSign, Sparkles, Check, Clock, Plus, Trash2, ChevronLeft, Eye, EyeOff,
} from 'lucide-react';
import { useDeckStore, useSelectedBlocks, useActiveSlide } from '../../core/store/deck';
import type { Block, Deck, Slide } from '../../core/schema/types';
import { runChat, type ChatSessionMessage } from '../../ai/orchestrator';
import { buildChatContextSnapshot, type ChatContextRef, type ChatContextScope, type ChatContextSnapshot } from '../../ai/contextSerializer';
import { extractFile, type ExtractedFile } from '../../utils/files';
import { isMac } from '../components/useBackdropClose';
import { LivePreview } from './LivePreview';
import {
  deleteChatSession,
  listChatSessionsByDeck,
  loadChatSession,
  saveChatSession,
  type ChatSession,
} from '../../core/persistence/db';

const CONFIRM_TIMEOUT_MS = 3000;
const PERSIST_DEBOUNCE_MS = 600;

function newSessionId() {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const deckId = useDeckStore((s) => s.deck.meta.id);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>('新对话');
  const [messages, setMessages] = useState<ChatSessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<ChatSession[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slide = useActiveSlide();
  const selected = useSelectedBlocks();
  const [contextScope, setContextScope] = useState<ChatContextScope>('slide');
  const deck = useDeckStore((s) => s.deck);
  const contextPreview = useMemo(() => buildContextPreview(deck, slide, selected, contextScope), [deck, slide, selected, contextScope]);
  const macConfirm = isMac();
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bootstrap: pick latest session for this deck, or start a fresh one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessions = await listChatSessionsByDeck(deckId);
      if (cancelled) return;
      setHistoryList(sessions);
      if (sessions.length > 0) {
        const latest = sessions[0];
        setSessionId(latest.id);
        setSessionTitle(latest.title);
        setMessages(latest.messages as ChatSessionMessage[]);
      } else {
        setSessionId(newSessionId());
        setSessionTitle('新对话');
        setMessages([]);
      }
    })();
    return () => { cancelled = true; };
  }, [deckId]);

  // Persist current session debounced.
  useEffect(() => {
    if (!sessionId) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      const title = messages.length > 0
        ? deriveTitle(messages, sessionTitle)
        : sessionTitle;
      if (title !== sessionTitle) setSessionTitle(title);
      const session: ChatSession = {
        id: sessionId,
        deckId,
        title,
        createdAt: messages[0]?.ts ?? Date.now(),
        updatedAt: Date.now(),
        messages,
      };
      await saveChatSession(session);
      const fresh = await listChatSessionsByDeck(deckId);
      setHistoryList(fresh);
    }, PERSIST_DEBOUNCE_MS);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
  }, [messages, sessionId, sessionTitle, deckId]);

  // Smart auto-scroll: only pin to bottom while user is near bottom.
  // Lets users scroll up to read history without being yanked back down.
  const stickToBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottom.current = distance < 60;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!stickToBottom.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  const sendUserText = useCallback(async (text: string, opts?: { choiceResponse?: { id: string; label: string; reply: string }; skipContext?: boolean }) => {
    if (!text.trim() && files.length === 0 && !opts?.choiceResponse) return;
    if (busy) return;

    const snapshot = opts?.skipContext ? null : buildChatContextSnapshot({
      scope: contextScope,
      deck: useDeckStore.getState().deck,
      activeSlideId: slide?.id ?? null,
      selectedBlockIds: selected.map((b) => b.id),
    });

    const userMsg: ChatSessionMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
      attachments: opts?.skipContext ? [] : files.map((f) => ({
        name: f.name,
        mime: f.mime,
        previewText: f.previewText,
        dataUrl: f.dataUrl,
      })),
      contextRefs: snapshot?.refs ?? [],
      contextSnapshot: snapshot ?? undefined,
      contextText: snapshot?.text,
      choiceResponse: opts?.choiceResponse,
      ts: Date.now(),
      status: 'done',
    };
    const assistant: ChatSessionMessage = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      text: '',
      ts: Date.now(),
      status: 'streaming',
    };
    const next = [...messages, userMsg, assistant];
    setMessages(next);
    setInput('');
    setFiles([]);
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;

    let buffer = '';

    try {
      await runChat({
        history: next.filter((m) => m.id !== assistant.id),
        signal: ac.signal,
        onTextDelta: (d) => {
          buffer += d;
          setMessages((cur) => updateAssistant(cur, assistant.id, { text: buffer, status: 'streaming' }));
        },
        onToolCall: (id, name, input) => {
          setMessages((cur) => updateAssistant(cur, assistant.id, {
            toolEvents: [
              ...((cur.find((m) => m.id === assistant.id)?.toolEvents) ?? []),
              { id, name, input, status: 'running', ts: Date.now() },
            ],
          }));
        },
        onToolResult: (id, _name, result) => {
          setMessages((cur) => updateAssistant(cur, assistant.id, {
            toolEvents: ((cur.find((m) => m.id === assistant.id)?.toolEvents) ?? []).map((t) =>
              t.id === id ? { ...t, result, status: result.startsWith('Error') || result.includes('failed') ? 'error' : 'done' } : t,
            ),
          }));
        },
        onUserChoiceRequest: (id, question, detail, choices, allowCustom) => {
          setMessages((cur) => updateAssistant(cur, assistant.id, {
            status: 'waiting_choice',
            choiceRequest: { id, question, detail, choices, allowCustom },
          }));
        },
        onError: (msg) => {
          setMessages((cur) => updateAssistant(cur, assistant.id, { text: msg, status: 'error', error: msg }));
        },
      });
      setMessages((cur) => cur.map((m) =>
        m.id === assistant.id && m.status !== 'error' && m.status !== 'waiting_choice' ? { ...m, status: 'done' } : m,
      ));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((cur) => updateAssistant(cur, assistant.id, { text: msg, status: 'error', error: msg }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [busy, contextScope, files, messages, selected, slide]);

  const sendMessage = useCallback(async () => {
    await sendUserText(input);
  }, [input, sendUserText]);

  const chooseOption = useCallback((assistantId: string, choice: { id: string; label: string; reply: string }) => {
    setMessages((cur) => updateAssistant(cur, assistantId, {
      choiceRequest: cur.find((m) => m.id === assistantId)?.choiceRequest
        ? { ...cur.find((m) => m.id === assistantId)!.choiceRequest!, answered: true }
        : undefined,
    }));
    void sendUserText(choice.reply, { choiceResponse: choice, skipContext: true });
  }, [sendUserText]);


  const triggerSend = useCallback(() => {
    if (busy) return;
    if (!input.trim() && files.length === 0) return;
    if (!macConfirm) {
      sendMessage();
      return;
    }
    if (confirmingSend) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingSend(false);
      sendMessage();
      return;
    }
    setConfirmingSend(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmingSend(false), CONFIRM_TIMEOUT_MS);
  }, [busy, input, files.length, macConfirm, confirmingSend, sendMessage]);

  const handleFiles = useCallback(async (list: FileList | null) => {
    if (!list) return;
    const out: ExtractedFile[] = [];
    for (const f of Array.from(list)) {
      out.push(await extractFile(f));
    }
    setFiles((cur) => [...cur, ...out]);
  }, []);

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages((cur) => cur.map((m) => m.status === 'streaming' ? { ...m, status: 'done' } : m));
  };

  const startNewSession = () => {
    setSessionId(newSessionId());
    setSessionTitle('新对话');
    setMessages([]);
    setShowHistory(false);
  };

  const switchSession = async (id: string) => {
    const s = await loadChatSession(id);
    if (!s) return;
    setSessionId(s.id);
    setSessionTitle(s.title);
    setMessages(s.messages as ChatSessionMessage[]);
    setShowHistory(false);
  };

  const removeSession = async (id: string) => {
    await deleteChatSession(id);
    const fresh = await listChatSessionsByDeck(deckId);
    setHistoryList(fresh);
    if (id === sessionId) {
      if (fresh.length > 0) await switchSession(fresh[0].id);
      else startNewSession();
    }
  };

  return (
    <aside className="chat-panel">
      <header className="chat-header">
        {showHistory ? (
          <>
            <button className="icon-btn" onClick={() => setShowHistory(false)} title="返回当前对话">
              <ChevronLeft size={14}/>
            </button>
            <span><Clock size={14}/> 对话历史 ({historyList.length})</span>
            <button className="icon-btn" onClick={onClose}><X size={14}/></button>
          </>
        ) : (
          <>
            <span title={sessionTitle}><Sparkles size={14}/> {truncate(sessionTitle, 22)}</span>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <button className="icon-btn" onClick={() => setShowPreview((v) => !v)} title="切换预览面板">
                {showPreview ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
              <button className="icon-btn" onClick={() => setShowHistory(true)} title="历史会话">
                <Clock size={14}/>
              </button>
              <button className="icon-btn" onClick={startNewSession} title="新建会话">
                <Plus size={14}/>
              </button>
              <button className="icon-btn" onClick={onClose} title="关闭">
                <X size={14}/>
              </button>
            </span>
          </>
        )}
      </header>

      {showHistory ? (
        <HistoryList
          sessions={historyList}
          activeId={sessionId}
          onPick={switchSession}
          onRemove={removeSession}
          onNew={startNewSession}
        />
      ) : (
        <>
          {showPreview && messages.length > 0 && <LivePreview />}
          <div className="chat-body" ref={scrollRef}>
            {messages.length === 0 && <Empty />}
            {messages.map((m) => <MessageBubble key={m.id} msg={m} onChoose={chooseOption} />)}
          </div>

          <div className="chat-context">
            <div className="context-scope-row">
              <span className="context-label"><AtSign size={11}/> 携带上下文</span>
              <button className={contextScope === 'none' ? 'ctx-scope active' : 'ctx-scope'} onClick={() => setContextScope('none')}>不携带</button>
              <button
                className={contextScope === 'selection' ? 'ctx-scope active' : 'ctx-scope'}
                onClick={() => setContextScope('selection')}
                disabled={!slide || selected.length === 0}
              >
                选中组件
              </button>
              <button
                className={contextScope === 'slide' ? 'ctx-scope active' : 'ctx-scope'}
                onClick={() => setContextScope('slide')}
                disabled={!slide}
              >
                当前页
              </button>
              <button className={contextScope === 'deck' ? 'ctx-scope active' : 'ctx-scope'} onClick={() => setContextScope('deck')}>整份 PPT</button>
            </div>
            {contextPreview.length > 0 && (
              <div className="context-preview">
                {contextPreview.map((item) => <span className="ctx-chip" key={item}>{item}</span>)}
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="chat-files">
              {files.map((f, i) => (
                <span key={i} className="file-chip">
                  {f.name}
                  <button onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>
                    <X size={10}/>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="chat-input">
            <label className="icon-btn" title="附加文件">
              <Paperclip size={14}/>
              <input
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
            <textarea
              rows={2}
              placeholder={macConfirm
                ? '描述你想要的 PPT…  (Enter 触发，再次 Enter 发送 / Shift+Enter 换行)'
                : '描述你想要的 PPT…  (Enter 发送 / Shift+Enter 换行)'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  triggerSend();
                } else if (e.key === 'Escape' && confirmingSend) {
                  setConfirmingSend(false);
                  if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                }
              }}
            />
            {busy ? (
              <button className="icon-btn danger" onClick={cancel} title="停止"><Square size={14}/></button>
            ) : confirmingSend ? (
              <button
                className="icon-btn primary confirm-send"
                onClick={() => { setConfirmingSend(false); if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); sendMessage(); }}
                title="再次点击确认发送 (Esc 取消)"
              >
                <Check size={14}/>
              </button>
            ) : (
              <button className="icon-btn primary" onClick={triggerSend} title={macConfirm ? '点击后再次确认发送' : '发送'}>
                <Send size={14}/>
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function buildContextPreview(deck: Deck, slide: Slide | null, selected: Block[], scope: ChatContextScope): string[] {
  if (scope === 'none') return [];
  if (scope === 'deck') return [`整份 PPT · ${deck.slides.length} 页`, '较大，可能更慢'];
  if (!slide) return [];
  const slideIndex = deck.slides.findIndex((s) => s.id === slide.id) + 1;
  if (scope === 'slide') return [`第 ${slideIndex} 页`, `${slide.blocks.length} 组件`];
  return selected.map((b) => `${b.type}:${b.id.slice(0, 6)}`);
}

function HistoryList({
  sessions, activeId, onPick, onRemove, onNew,
}: {
  sessions: ChatSession[];
  activeId: string | null;
  onPick: (id: string) => void;
  onRemove: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="chat-history-overlay" style={{ position: 'static', flex: 1 }}>
      <button
        className="btn-sm btn-primary"
        onClick={onNew}
        style={{ margin: 12 }}
      >
        <Plus size={12}/> 新建对话
      </button>
      {sessions.length === 0 ? (
        <div className="empty-hint" style={{ margin: 12 }}>暂无历史会话</div>
      ) : (
        sessions.map((s) => (
          <div
            key={s.id}
            className={`chat-row ${s.id === activeId ? 'active' : ''}`}
            onClick={() => onPick(s.id)}
          >
            <div className="chat-row-info">
              <div className="chat-row-title">{s.title || '未命名对话'}</div>
              <div className="chat-row-meta">
                {(s.messages as ChatSessionMessage[]).length} 条 · {timeAgo(s.updatedAt)}
              </div>
            </div>
            <button
              className="icon-btn xs danger"
              onClick={(e) => { e.stopPropagation(); onRemove(s.id); }}
              title="删除"
            >
              <Trash2 size={11}/>
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function deriveTitle(messages: ChatSessionMessage[], fallback: string): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.text.trim());
  if (firstUser) return truncate(firstUser.text.replace(/\s+/g, ' ').trim(), 40);
  return fallback;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  return `${d}天前`;
}

function updateAssistant(messages: ChatSessionMessage[], id: string, patch: Partial<ChatSessionMessage>): ChatSessionMessage[] {
  return messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

function MessageBubble({ msg, onChoose }: { msg: ChatSessionMessage; onChoose: (assistantId: string, choice: { id: string; label: string; reply: string }) => void }) {
  const [showAttach, setShowAttach] = useState(false);
  const hasText = !!msg.text || msg.status === 'streaming';
  const hasTools = (msg.toolEvents?.length ?? 0) > 0;
  const hasContext = !!msg.contextSnapshot || !!msg.contextText?.trim() || (msg.contextRefs?.length ?? 0) > 0;
  const carriedCount = (msg.attachments?.length ?? 0) + (hasContext ? 1 : 0);

  return (
    <div className={`bubble ${msg.role} ${msg.status ?? ''}`}>
      {hasText && (
        <div className="bubble-text">
          {msg.text || (msg.status === 'streaming' && !hasTools ? <span className="dot-dot-dot"/> : '')}
        </div>
      )}
      {msg.choiceRequest && (
        <ChoiceCard msg={msg} onChoose={onChoose} />
      )}
      {msg.choiceResponse && (
        <div className="choice-response">已选择：{msg.choiceResponse.label}</div>
      )}
      {hasTools && (
        <ToolTimeline events={msg.toolEvents!} streaming={msg.status === 'streaming'} />
      )}
      {carriedCount > 0 && (
        <CarriedFooter
          contextSnapshot={msg.contextSnapshot}
          contextText={msg.contextText}
          attachments={msg.attachments ?? []}
          refs={msg.contextRefs ?? []}
          expanded={showAttach}
          onToggle={() => setShowAttach((v) => !v)}
        />
      )}
    </div>
  );
}

function ChoiceCard({ msg, onChoose }: { msg: ChatSessionMessage; onChoose: (assistantId: string, choice: { id: string; label: string; reply: string }) => void }) {
  const req = msg.choiceRequest!;
  const [custom, setCustom] = useState('');
  return (
    <div className={`choice-card ${req.answered ? 'answered' : ''}`}>
      <div className="choice-title">{req.question}</div>
      {req.detail && <div className="choice-detail">{req.detail}</div>}
      <div className="choice-options">
        {req.choices.map((choice) => (
          <button
            key={choice.id}
            className="choice-option"
            disabled={req.answered}
            onClick={() => onChoose(msg.id, { id: choice.id, label: choice.label, reply: choice.reply })}
          >
            <strong>{choice.label}</strong>
            {choice.description && <span>{choice.description}</span>}
          </button>
        ))}
      </div>
      {req.allowCustom && !req.answered && (
        <div className="choice-custom">
          <textarea rows={2} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="自定义回复内容…" />
          <button
            className="btn-sm btn-primary"
            disabled={!custom.trim()}
            onClick={() => onChoose(msg.id, { id: 'custom', label: '自定义', reply: custom.trim() })}
          >
            使用自定义回复
          </button>
        </div>
      )}
    </div>
  );
}

function ToolTimeline({ events, streaming }: { events: import('../../ai/orchestrator').ToolEvent[]; streaming: boolean }) {
  const [open, setOpen] = useState(streaming);
  const running = events.filter((e) => e.status === 'running').length;
  const done = events.filter((e) => e.status === 'done').length;
  const errored = events.filter((e) => e.status === 'error').length;
  return (
    <div className={`tool-timeline ${open ? 'open' : ''}`}>
      <button className="tool-timeline-header" onClick={() => setOpen((v) => !v)}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span>AI 操作 · {events.length}</span>
        {running > 0 && <span className="dot running" title="进行中"/>}
        {done > 0 && <span style={{ color: '#10B981' }}>✓ {done}</span>}
        {errored > 0 && <span style={{ color: '#EF4444' }}>✗ {errored}</span>}
      </button>
      {open && (
        <ul className="tool-timeline-list">
          {events.map((e) => (
            <li key={e.id} className={`tool-event ${e.status}`}>
              <span className="tool-event-icon">
                {e.status === 'running' ? '⋯' : e.status === 'error' ? '✗' : '✓'}
              </span>
              <code className="tool-event-name">{e.name}</code>
              {e.result && <span className="tool-event-result" title={e.result}>{truncate(e.result, 60)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CarriedFooter({
  contextSnapshot, contextText, attachments, refs, expanded, onToggle,
}: {
  contextSnapshot?: ChatContextSnapshot;
  contextText?: string;
  attachments: import('../../ai/orchestrator').ChatSessionAttachment[];
  refs: ChatContextRef[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasContext = !!contextSnapshot || !!contextText?.trim() || refs.length > 0;
  const total = attachments.length + (hasContext ? 1 : 0);
  const contextLabel = contextSnapshot?.label ?? (refs.length > 0 ? `${refs.length} 引用` : '旧版上下文');
  return (
    <div className={`bubble-carry ${expanded ? 'open' : ''}`}>
      <button className="bubble-carry-summary" onClick={onToggle}>
        <span className="caret">{expanded ? '▾' : '▸'}</span>
        携带内容 · {attachments.length > 0 && <span>{attachments.length} 文件</span>}
        {attachments.length > 0 && hasContext && <span>·</span>}
        {hasContext && <span>{contextLabel}{contextSnapshot?.truncated ? ' · 已截断' : ''}</span>}
        {total === 0 && <span>无</span>}
      </button>
      {expanded && (
        <div className="bubble-carry-body">
          {hasContext && (
            <div className="carry-section">
              <div className="carry-label">上下文</div>
              <div className="carry-context-meta">
                {contextSnapshot && <span>范围: {contextScopeLabel(contextSnapshot.scope)}</span>}
                {contextSnapshot && <span>大小: {contextSnapshot.charCount} 字符</span>}
                {contextSnapshot?.truncated && <span>已截断</span>}
              </div>
              {refs.length > 0 && (
                <div className="carry-chips">
                  {refs.map((r) => (
                    <span key={r.kind + r.id} className="ctx-chip">@{r.label}</span>
                  ))}
                </div>
              )}
              {(contextSnapshot?.text || contextText) && (
                <pre className="carry-context-preview">
                  {(contextSnapshot?.text ?? contextText ?? '').slice(0, 1000)}
                  {(contextSnapshot?.text ?? contextText ?? '').length > 1000 ? '\n…(预览已截断)' : ''}
                </pre>
              )}
            </div>
          )}
          {attachments.length > 0 && (
            <div className="carry-section">
              <div className="carry-label">附件</div>
              <ul className="carry-files">
                {attachments.map((a, i) => (
                  <CarriedFile key={i} a={a} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function contextScopeLabel(scope: ChatContextSnapshot['scope']): string {
  if (scope === 'deck') return '整份 PPT';
  if (scope === 'slide') return '当前页';
  return '选中组件';
}

function CarriedFile({ a }: { a: import('../../ai/orchestrator').ChatSessionAttachment }) {
  const [open, setOpen] = useState(false);
  const isImage = a.mime?.startsWith('image/') && a.dataUrl;
  return (
    <li className="carry-file">
      <button className="carry-file-head" onClick={() => setOpen((v) => !v)}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span className="carry-file-name">{a.name}</span>
        <span className="carry-file-mime">{a.mime || 'binary'}</span>
      </button>
      {open && (
        <div className="carry-file-body">
          {isImage ? (
            <img src={a.dataUrl} alt={a.name} style={{ maxWidth: '100%', borderRadius: 4, display: 'block' }}/>
          ) : a.previewText ? (
            <pre>{a.previewText.slice(0, 4000)}{a.previewText.length > 4000 ? '\n…(已截断)' : ''}</pre>
          ) : a.dataUrl ? (
            <a href={a.dataUrl} download={a.name} target="_blank" rel="noreferrer">下载</a>
          ) : (
            <span style={{ color: '#94A3B8', fontSize: 11 }}>(无可预览内容)</span>
          )}
        </div>
      )}
    </li>
  );
}

function Empty() {
  return (
    <div className="chat-empty">
      <Sparkles size={28}/>
      <h4>用一句话生成一份 PPT</h4>
      <p>例如:</p>
      <div className="chat-suggestions">
        <span>"做一份 8 页的产品发布会 PPT，主题：AI 写作助手 v2"</span>
        <span>"把当前选中的标题改成更有冲击力的版本"</span>
        <span>"按主色 #4F46E5、无衬线字体重新设计主题"</span>
      </div>
    </div>
  );
}
