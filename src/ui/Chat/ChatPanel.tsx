import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Square, X, AtSign, Sparkles } from 'lucide-react';
import { useDeckStore, useSelectedBlocks, useActiveSlide } from '../../core/store/deck';
import { runChat, type ChatSessionMessage } from '../../ai/orchestrator';
import { extractFile, type ExtractedFile } from '../../utils/files';

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatSessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const slide = useActiveSlide();
  const selected = useSelectedBlocks();
  const [includeContext, setIncludeContext] = useState(true);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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
    let toolLog: string[] = [];

    await runChat({
      history: next.filter((m) => m.id !== assistant.id),
      signal: ac.signal,
      onTextDelta: (d) => {
        buffer += d;
        setMessages((cur) => updateAssistant(cur, assistant.id, { text: buffer, status: 'streaming' }));
      },
      onToolCall: (name, _input) => {
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

  return (
    <aside className="chat-panel">
      <header className="chat-header">
        <span><Sparkles size={14}/> AI 对话</span>
        <button className="icon-btn" onClick={onClose}><X size={14}/></button>
      </header>

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
          placeholder="描述你想要的 PPT…  (Cmd/Ctrl+Enter 发送)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        {busy ? (
          <button className="icon-btn danger" onClick={cancel} title="停止"><Square size={14}/></button>
        ) : (
          <button className="icon-btn primary" onClick={sendMessage} title="发送"><Send size={14}/></button>
        )}
      </div>
    </aside>
  );
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
