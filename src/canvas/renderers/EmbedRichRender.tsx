import { memo, useEffect, useRef, useState } from 'react';
import type { EmbedBlock } from '../../core/schema/types';

// Renders mermaid / math / iframe / html embeds. mermaid + KaTeX are
// dynamically imported so they don't bloat the main bundle.
export const EmbedRichRender = memo(function EmbedRichRender({ block }: { block: EmbedBlock }) {
  if (block.kind === 'mermaid') return <MermaidView source={block.src} fallback={block.fallback} cornerRadius={block.cornerRadius}/>;
  if (block.kind === 'math') return <KaTeXView source={block.src} cornerRadius={block.cornerRadius}/>;
  if (block.kind === 'html') return <HtmlView source={block.src} cornerRadius={block.cornerRadius}/>;
  if (block.kind === 'iframe' && block.src) {
    return (
      <iframe
        src={block.src}
        title="embed"
        sandbox="allow-scripts allow-same-origin allow-popups"
        style={{ width: '100%', height: '100%', border: 0, borderRadius: block.cornerRadius, pointerEvents: 'none' }}
      />
    );
  }
  return (
    <div
      style={{
        width: '100%', height: '100%', background: '#F1F5F9', color: '#475569',
        padding: 12, boxSizing: 'border-box', fontFamily: 'monospace', fontSize: 13,
        whiteSpace: 'pre-wrap', overflow: 'auto', borderRadius: block.cornerRadius,
      }}
    >
      {block.fallback ?? `[${block.kind}] ${block.src}`}
    </div>
  );
});

function MermaidView({ source, fallback, cornerRadius }: { source: string; fallback?: string; cornerRadius?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
        const id = `mmd-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, source || fallback || 'graph TD; A-->B');
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [source, fallback]);
  if (error) {
    return <pre style={{ color: '#EF4444', padding: 8, fontSize: 12, overflow: 'auto' }}>{error}</pre>;
  }
  return (
    <div
      ref={ref}
      style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'auto', borderRadius: cornerRadius,
      }}
    />
  );
}

function KaTeXView({ source, cornerRadius }: { source: string; cornerRadius?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const katex = (await import('katex')).default;
        await import('katex/dist/katex.min.css');
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = katex.renderToString(source || 'E = mc^2', {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [source]);
  if (error) {
    return <pre style={{ color: '#EF4444', padding: 8, fontSize: 12 }}>{error}</pre>;
  }
  return (
    <div
      ref={ref}
      style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, padding: 8, boxSizing: 'border-box', borderRadius: cornerRadius,
      }}
    />
  );
}

function HtmlView({ source, cornerRadius }: { source: string; cornerRadius?: number }) {
  // Sandbox raw HTML inside an srcdoc iframe so styles/scripts cannot escape.
  return (
    <iframe
      title="embed-html"
      srcDoc={source}
      sandbox=""
      style={{ width: '100%', height: '100%', border: 0, borderRadius: cornerRadius, pointerEvents: 'none' }}
    />
  );
}
