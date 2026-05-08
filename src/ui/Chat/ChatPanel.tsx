import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Send, Paperclip, Square, X, AtSign, Sparkles, Check, Clock, Plus, Trash2, ChevronLeft, Eye, EyeOff,
} from 'lucide-react';
import { useDeckStore, useSelectedBlocks, useActiveSlide } from '../../core/store/deck';
import { runChat, type ChatSessionMessage } from '../../ai/orchestrator';
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
  const [includeContext, setIncludeContext] = useState(true);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() && files.length === 0) return;
    if (busy) return;

    const ctxRefs: ChatSessionMessage['contextRefs'] = [];
    if (includeContext && slide) {
      ctxRefs.push({ kind: 'slide', id: slide.id, label: `slide ${useDeckStore.getState().deck.slides.findIndex((s) => s.id === slide.id) + 1}` });
      for (const b of selected) {
        ctxRefs.push({ kind: 'block', id: b.id, label: `${b.type} ${b.id.slice(0, 6)}` });
      }
    }

    const userMsg: ChatSessionMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: input,
      attachments: files.map((f) => ({ name: f.name, mime: f.mime, previewText: f.previewText ?? f.dataUrl ?? '' })),
      contextRefs: ctxRefs,
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
    const toolLog: string[] = [];

    await runChat({
      history: next.filter((m) => m.id !== assistant.id),
      signal: ac.signal,
      onTextDelta: (d) => {
        buffer += d;
        setMessages((cur) => updateAssistant(cur, assistant.id, { text: buffer, status: 'streaming' }));
      },
      onToolCall: (name) => {
        toolLog.push(`▸ ${name}`);
        setMessages((cur) => updateAssistant(cur, assistant.id, {
          text: [buffer, '', toolLog.join('\n')].filter(Boolean).join('\n'),
        }));
      },
      onToolResult: (name, result) => {
        toolLog[toolLog.length - 1] = `✓ ${name}: ${result}`;
        setMessages((cur) => updateAssistant(cur, assistant.id, {
          text: [buffer, '', toolLog.join('\n')].filter(Boolean).join('\n'),
        }));
      },
      onError: (msg) => {
        setMessages((cur) => updateAssistant(cur, assistant.id, { text: msg, status: 'error', error: msg }));
      },
    });

    setMessages((cur) => updateAssistant(cur, assistant.id, { status: 'done' }));
    setBusy(false);
    abortRef.current = null;
  }, [input, files, busy, messages, slide, selected, includeContext]);

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
            {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
          </div>

          <div className="chat-context">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
              />
              <AtSign size={11}/>
              携带上下文
              {slide && <span className="ctx-chip">slide {useDeckStore.getState().deck.slides.findIndex((s) => s.id === slide.id) + 1}</span>}
              {selected.map((b) => (
                <span className="ctx-chip" key={b.id}>{b.type}:{b.id.slice(0, 6)}</span>
              ))}
            </label>
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
              placeholder={macConfirm ? '描述你想要的 PPT…  (Cmd+Enter 触发，再次确认发送)' : '描述你想要的 PPT…  (Ctrl+Enter 发送)'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
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

function MessageBubble({ msg }: { msg: ChatSessionMessage }) {
  return (
    <div className={`bubble ${msg.role} ${msg.status ?? ''}`}>
      {msg.role === 'user' && msg.contextRefs && msg.contextRefs.length > 0 && (
        <div className="bubble-refs">
          {msg.contextRefs.map((r) => (
            <span key={r.kind + r.id} className="ctx-chip mini">@{r.label}</span>
          ))}
        </div>
      )}
      <div className="bubble-text">
        {msg.text || (msg.status === 'streaming' ? <span className="dot-dot-dot"/> : '')}
      </div>
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="bubble-attachments">
          {msg.attachments.map((a, i) => (
            <span key={i} className="file-chip mini">{a.name}</span>
          ))}
        </div>
      )}
    </div>
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
