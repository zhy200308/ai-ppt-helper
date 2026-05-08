import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { TextBlock, TextRun } from '../core/schema/types';

interface Props {
  block: TextBlock;
  zoom: number;
  onCommit: (patch: Partial<TextBlock>) => void;
  onCancel: () => void;
}

// In-place editor backed by contentEditable. Serializes back to TextRun[]
// on commit, supporting bold / italic / underline / link / color / size.
export const TextEditor = memo(function TextEditor({ block, zoom, onCommit, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = runsToHtml(block.runs);
    // Place caret at end and focus.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.focus();
    setShowToolbar(true);
  }, [block.id]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const runs = htmlToRuns(el);
    onCommit({ runs });
  }, [onCommit]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!ref.current) return;
      const t = e.target as HTMLElement;
      if (ref.current.contains(t) || t.closest('.text-toolbar')) return;
      commit();
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [commit]);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    ref.current?.focus();
  };

  return (
    <>
      {showToolbar && (
        <div
          className="text-toolbar"
          style={{
            position: 'absolute',
            left: block.x,
            top: block.y - 44 / zoom,
            transformOrigin: '0 100%',
            transform: `scale(${1 / zoom})`,
            zIndex: 30,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onClick={() => exec('bold')} title="Bold (Cmd+B)"><Bold size={12}/></button>
          <button onClick={() => exec('italic')} title="Italic (Cmd+I)"><Italic size={12}/></button>
          <button onClick={() => exec('underline')} title="Underline (Cmd+U)"><Underline size={12}/></button>
          <span className="sep"/>
          <button onClick={() => exec('justifyLeft')} title="Align left"><AlignLeft size={12}/></button>
          <button onClick={() => exec('justifyCenter')} title="Align center"><AlignCenter size={12}/></button>
          <button onClick={() => exec('justifyRight')} title="Align right"><AlignRight size={12}/></button>
          <span className="sep"/>
          <input
            type="color"
            title="Text color"
            onChange={(e) => exec('foreColor', e.target.value)}
          />
          <button
            onClick={() => {
              const url = window.prompt('链接地址');
              if (url) exec('createLink', url);
            }}
            title="Insert link"
          >
            <LinkIcon size={12}/>
          </button>
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          outline: '2px solid #4F46E5',
          background: 'rgba(255,255,255,0.95)',
          textAlign: block.align,
          fontFamily: block.fontFamily,
          fontSize: block.fontSize,
          color: block.color,
          lineHeight: block.lineHeight ?? 1.3,
          letterSpacing: block.letterSpacing,
          padding: block.padding ?? 0,
          boxSizing: 'border-box',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'auto',
          cursor: 'text',
        }}
      />
    </>
  );
});

function runsToHtml(runs: TextRun[]): string {
  return runs.map((r) => {
    let html = escapeHtml(r.text);
    if (r.bold) html = `<b>${html}</b>`;
    if (r.italic) html = `<i>${html}</i>`;
    if (r.underline) html = `<u>${html}</u>`;
    if (r.strike) html = `<s>${html}</s>`;
    const styles: string[] = [];
    if (r.color) styles.push(`color:${r.color}`);
    if (r.fontSize) styles.push(`font-size:${r.fontSize}px`);
    if (r.fontFamily) styles.push(`font-family:${r.fontFamily}`);
    if (styles.length) html = `<span style="${styles.join(';')}">${html}</span>`;
    if (r.link) html = `<a href="${escapeHtml(r.link)}">${html}</a>`;
    return html;
  }).join('').replace(/\n/g, '<br>') || '<br>';
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface InheritedFmt {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  link?: string;
}

function htmlToRuns(root: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  walk(root, {}, runs);
  return runs.length ? runs : [{ text: '' }];
}

function walk(node: Node, fmt: InheritedFmt, runs: TextRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text) runs.push({ text, ...fmt } as TextRun);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') {
    runs.push({ text: '\n', ...fmt });
    return;
  }
  const next: InheritedFmt = { ...fmt };
  if (tag === 'b' || tag === 'strong') next.bold = true;
  else if (tag === 'i' || tag === 'em') next.italic = true;
  else if (tag === 'u') next.underline = true;
  else if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
  else if (tag === 'a') next.link = el.getAttribute('href') ?? undefined;
  const style = el.style;
  if (style.color) next.color = style.color;
  if (style.fontSize) next.fontSize = parseFloat(style.fontSize) || next.fontSize;
  if (style.fontFamily) next.fontFamily = style.fontFamily;
  if (style.fontWeight && parseInt(style.fontWeight, 10) >= 600) next.bold = true;
  if (style.fontStyle === 'italic') next.italic = true;
  if (style.textDecoration?.includes('underline')) next.underline = true;
  if (style.textDecoration?.includes('line-through')) next.strike = true;
  for (const child of Array.from(el.childNodes)) walk(child, next, runs);
  if (tag === 'div' || tag === 'p') runs.push({ text: '\n', ...fmt });
}
