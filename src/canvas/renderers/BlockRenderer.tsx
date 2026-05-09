import { memo } from 'react';
import type {
  AudioBlock,
  BadgeBlock,
  Block,
  CodeBlock,
  ConnectorBlock,
  DividerBlock,
  GalleryBlock,
  IconBlock,
  ImageBlock,
  InkBlock,
  KpiCardBlock,
  ListBlock,
  MathBlock,
  ProgressBlock,
  ShapeBlock,
  TableBlock,
  TextBlock,
  VideoBlock,
} from '../../core/schema/types';
import { EChartsRender } from './EChartsRender';
import { EmbedRichRender } from './EmbedRichRender';
import { useActiveSlide, useDeckStore } from '../../core/store/deck';
import { resolveEndpoint } from '../connectorAnchor';
import { resolveTableFromRef } from '../dataResolver';
import { useEffect, useRef, useState } from 'react';

interface Props {
  block: Block;
  presenting?: boolean;
}

export const BlockRenderer = memo(function BlockRenderer({ block, presenting }: Props) {
  switch (block.type) {
    case 'text': return <TextRender block={block} />;
    case 'shape': return <ShapeRender block={block} />;
    case 'image': return <ImageRender block={block} />;
    case 'chart': return <EChartsRender block={block} />;
    case 'table': return <TableRender block={block} />;
    case 'code': return <CodeRender block={block} />;
    case 'icon': return <IconRender block={block} />;
    case 'list': return <ListRender block={block} />;
    case 'divider': return <DividerRender block={block} />;
    case 'video': return <VideoRender block={block} presenting={presenting} />;
    case 'embed': return <EmbedRichRender block={block} />;
    case 'connector': return <ConnectorRender block={block} />;
    case 'ink': return <InkRender block={block} />;
    case 'progress': return <ProgressRender block={block} />;
    case 'kpi': return <KpiCardRender block={block} />;
    case 'gallery': return <GalleryRender block={block} />;
    case 'math': return <MathRender block={block} />;
    case 'audio': return <AudioRender block={block} presenting={presenting} />;
    case 'badge': return <BadgeRender block={block} />;
    default: return null;
  }
});

function TextRender({ block }: { block: TextBlock }) {
  const align: React.CSSProperties['textAlign'] = block.align ?? 'left';
  const justify =
    block.vAlign === 'middle' ? 'center' : block.vAlign === 'bottom' ? 'flex-end' : 'flex-start';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        textAlign: align,
        fontFamily: block.fontFamily,
        fontSize: block.fontSize,
        color: block.color,
        background: block.background,
        lineHeight: block.lineHeight ?? 1.3,
        letterSpacing: block.letterSpacing,
        padding: block.padding ?? 0,
        boxSizing: 'border-box',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'hidden',
      }}
    >
      {block.runs.map((r, i) => (
        <span
          key={i}
          style={{
            fontWeight: r.bold ? 700 : undefined,
            fontStyle: r.italic ? 'italic' : undefined,
            textDecoration: [
              r.underline && 'underline',
              r.strike && 'line-through',
            ].filter(Boolean).join(' ') || undefined,
            color: r.color,
            fontSize: r.fontSize,
            fontFamily: r.fontFamily,
          }}
        >
          {r.text}
        </span>
      ))}
    </div>
  );
}

function ShapeRender({ block }: { block: ShapeBlock }) {
  const stroke = block.stroke;
  const sw = block.strokeWidth ?? 0;
  const fill = block.gradient
    ? gradientToCss(block.gradient)
    : block.fill ?? 'transparent';
  const dash =
    block.strokeDash === 'dashed' ? '8 6' :
    block.strokeDash === 'dotted' ? '2 6' : undefined;
  const shadow = block.shadow
    ? `${block.shadow.offsetX}px ${block.shadow.offsetY}px ${block.shadow.blur}px ${block.shadow.color}`
    : undefined;
  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    boxShadow: shadow,
  };

  if (block.shape === 'rectangle' || block.shape === 'rounded-rectangle') {
    return (
      <div
        style={{
          ...baseStyle,
          background: fill,
          borderRadius: block.cornerRadius ?? (block.shape === 'rounded-rectangle' ? 16 : 0),
          border: sw ? `${sw}px ${block.strokeDash === 'dashed' ? 'dashed' : block.strokeDash === 'dotted' ? 'dotted' : 'solid'} ${stroke ?? '#000'}` : undefined,
        }}
      />
    );
  }
  if (block.shape === 'ellipse') {
    return (
      <div
        style={{
          ...baseStyle,
          background: fill,
          borderRadius: '50%',
          border: sw ? `${sw}px solid ${stroke ?? '#000'}` : undefined,
        }}
      />
    );
  }
  // SVG for geometry-heavy shapes.
  const path = SHAPE_PATHS[block.shape];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={baseStyle}>
      {block.shape === 'line' && (
        <line x1="0" y1="50" x2="100" y2="50" stroke={stroke ?? '#000'} strokeWidth={sw || 2} strokeDasharray={dash} />
      )}
      {block.shape === 'arrow' && (
        <g>
          <line x1="0" y1="50" x2="85" y2="50" stroke={stroke ?? '#000'} strokeWidth={sw || 2} strokeDasharray={dash} />
          <polygon points="100,50 80,40 80,60" fill={stroke ?? '#000'} />
        </g>
      )}
      {path && (
        path.kind === 'polygon' ? (
          <polygon points={path.d} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
        ) : (
          <path d={path.d} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
        )
      )}
    </svg>
  );
}

// SVG path & polygon definitions used in 100x100 viewBox.
const SHAPE_PATHS: Partial<Record<ShapeBlock['shape'], { kind: 'polygon' | 'path'; d: string }>> = {
  triangle: { kind: 'polygon', d: '50,5 95,95 5,95' },
  star: { kind: 'polygon', d: '50,5 61,38 95,38 67,58 78,90 50,70 22,90 33,58 5,38 39,38' },
  polygon: { kind: 'polygon', d: '50,5 95,30 80,90 20,90 5,30' },
  pentagon: { kind: 'polygon', d: '50,5 97,40 79,95 21,95 3,40' },
  hexagon: { kind: 'polygon', d: '25,5 75,5 97,50 75,95 25,95 3,50' },
  octagon: { kind: 'polygon', d: '30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30' },
  parallelogram: { kind: 'polygon', d: '20,10 95,10 80,90 5,90' },
  trapezoid: { kind: 'polygon', d: '20,10 80,10 95,90 5,90' },
  rhombus: { kind: 'polygon', d: '50,5 95,50 50,95 5,50' },
  cross: { kind: 'polygon', d: '35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35' },
  chevron: { kind: 'polygon', d: '5,10 70,10 95,50 70,90 5,90 30,50' },
  heart: { kind: 'path', d: 'M50 90 C 5 60, 5 25, 30 15 C 42 10, 50 25, 50 30 C 50 25, 58 10, 70 15 C 95 25, 95 60, 50 90 Z' },
  cloud: { kind: 'path', d: 'M25 70 Q 5 70 10 50 Q 5 30 25 35 Q 30 15 50 25 Q 65 10 75 30 Q 95 30 90 50 Q 100 70 75 75 Q 60 90 40 80 Q 25 90 25 70 Z' },
  callout: { kind: 'polygon', d: '5,5 95,5 95,75 60,75 50,95 50,75 5,75' },
  'speech-bubble': { kind: 'path', d: 'M10 10 H 90 Q 95 10 95 15 V 65 Q 95 70 90 70 H 60 L 50 90 L 45 70 H 10 Q 5 70 5 65 V 15 Q 5 10 10 10 Z' },
};

function ImageRender({ block }: { block: ImageBlock }) {
  if (!block.src) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#F1F5F9',
          color: '#94A3B8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          borderRadius: block.cornerRadius,
        }}
      >
        Image placeholder
      </div>
    );
  }
  const filter = block.filter
    ? [
        block.filter.brightness !== undefined && `brightness(${block.filter.brightness})`,
        block.filter.contrast !== undefined && `contrast(${block.filter.contrast})`,
        block.filter.saturate !== undefined && `saturate(${block.filter.saturate})`,
        block.filter.blur !== undefined && `blur(${block.filter.blur}px)`,
      ].filter(Boolean).join(' ')
    : undefined;
  return (
    <img
      src={block.src}
      alt={block.alt ?? ''}
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: block.fit ?? 'cover',
        borderRadius: block.cornerRadius,
        filter,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    />
  );
}

function TableRender({ block }: { block: TableBlock }) {
  const deck = useDeckStore((s) => s.deck);
  const slideId = useDeckStore((s) => s.selection.slideId);
  const updateBlock = useDeckStore((s) => s.updateBlock);
  const resolved = resolveTableFromRef(block, deck);
  const isReadOnlyData = !!block.dataRef;

  const onCellCommit = (ri: number, ci: number, value: string) => {
    if (isReadOnlyData) return;
    if (!slideId) return;
    const next = resolved.cells.map((row) => row.slice());
    next[ri][ci] = value;
    updateBlock(slideId, block.id, { cells: next, rows: next.length, cols: next[0]?.length ?? 0 });
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          {resolved.cells.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const isHeader = (resolved.headerRow && ri === 0) || (resolved.headerCol && ci === 0);
                return (
                  <Cell
                    key={ci}
                    value={cell}
                    isHeader={isHeader}
                    readOnly={isReadOnlyData}
                    onCommit={(v) => onCellCommit(ri, ci, v)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {isReadOnlyData && (
        <div style={{
          position: 'absolute', bottom: 4, right: 8,
          fontSize: 10, color: '#94A3B8', background: 'rgba(255,255,255,0.85)',
          padding: '1px 6px', borderRadius: 3, pointerEvents: 'none',
        }}>
          🔗 引用数据表
        </div>
      )}
    </div>
  );
}

function Cell({ value, isHeader, readOnly, onCommit }: {
  value: string; isHeader: boolean; readOnly: boolean; onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  return (
    <td
      onDoubleClick={() => !readOnly && setEditing(true)}
      style={{
        border: '1px solid #CBD5E1',
        padding: 0,
        fontSize: 14,
        fontWeight: isHeader ? 600 : 400,
        background: isHeader ? '#F1F5F9' : undefined,
        cursor: readOnly ? 'default' : 'text',
        position: 'relative',
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); onCommit(draft); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); setEditing(false); onCommit(draft); }
            else if (e.key === 'Escape') { setEditing(false); setDraft(value); }
          }}
          style={{
            width: '100%', height: '100%', padding: 6, border: 'none',
            outline: '2px solid #4F46E5', font: 'inherit', background: '#fff',
          }}
        />
      ) : (
        <div style={{ padding: 6, minHeight: 20 }}>{value}</div>
      )}
    </td>
  );
}

function CodeRender({ block }: { block: CodeBlock }) {
  const dark = block.theme !== 'light';
  return (
    <pre
      style={{
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 16,
        boxSizing: 'border-box',
        background: dark ? '#0F172A' : '#F8FAFC',
        color: dark ? '#E2E8F0' : '#0F172A',
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: 14,
        borderRadius: 8,
        overflow: 'auto',
      }}
    >
      <code>{block.code}</code>
    </pre>
  );
}

function IconRender({ block }: { block: IconBlock }) {
  // Icons are referenced by name; we render a placeholder square for now.
  // Lucide dynamic-import would be plugged in here.
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: block.color ?? '#0F172A',
        fontSize: '50%',
      }}
    >
      ◇ {block.iconName}
    </div>
  );
}

function ListRender({ block }: { block: ListBlock }) {
  return (
    <ol
      style={{
        margin: 0,
        padding: 0,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        listStyle: 'none',
        fontSize: block.fontSize ?? 28,
        fontFamily: block.fontFamily,
        color: block.color ?? '#0F172A',
        lineHeight: block.lineHeight ?? 1.5,
        overflow: 'hidden',
      }}
    >
      {block.items.map((item, i) => {
        const indent = (item.level || 0) * 24;
        const marker = block.ordered
          ? `${siblingIndex(block.items, i)}.`
          : '•';
        return (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              paddingLeft: indent,
              marginBottom: 6,
            }}
          >
            <span style={{ color: block.bulletColor ?? block.color ?? '#4F46E5', minWidth: 18, fontWeight: block.ordered ? 600 : 400 }}>{marker}</span>
            <span style={{ flex: 1 }}>{item.text}</span>
          </li>
        );
      })}
    </ol>
  );
}

function siblingIndex(items: ListBlock['items'], i: number): number {
  let n = 0;
  const lvl = items[i].level || 0;
  for (let k = 0; k <= i; k++) {
    if ((items[k].level || 0) === lvl) n++;
    else if ((items[k].level || 0) < lvl) n = 0;
  }
  return n;
}

function DividerRender({ block }: { block: DividerBlock }) {
  const t = block.thickness ?? 2;
  const dash =
    block.style === 'dashed' ? '12 8' : block.style === 'dotted' ? '2 8' : undefined;
  return (
    <svg width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 100 ${Math.max(2, t)}`}>
      <line
        x1="0"
        x2="100"
        y1={t / 2}
        y2={t / 2}
        stroke={block.color ?? '#CBD5E1'}
        strokeWidth={t}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function VideoRender({ block, presenting }: { block: VideoBlock; presenting?: boolean }) {
  if (!block.src) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#0F172A', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, borderRadius: block.cornerRadius }}>
        Video placeholder
      </div>
    );
  }
  return (
    <video
      src={block.src}
      poster={block.poster}
      autoPlay={!!block.autoplay && presenting}
      loop={block.loop}
      controls={block.controls ?? presenting}
      muted={!!block.autoplay}
      playsInline
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: block.cornerRadius, pointerEvents: presenting ? 'auto' : 'none' }}
    />
  );
}

function ConnectorRender({ block }: { block: ConnectorBlock }) {
  const slide = useActiveSlide();
  const start = slide ? resolveEndpoint(block.start, slide) : block.start;
  const end = slide ? resolveEndpoint(block.end, slide) : block.end;
  // Coordinates are deck-space; the wrapper already positioned the block,
  // so we draw inside its local rect and convert start/end to local coords.
  const sx = start.x - block.x;
  const sy = start.y - block.y;
  const ex = end.x - block.x;
  const ey = end.y - block.y;
  const dash = block.strokeDash === 'dashed' ? '8 6' : block.strokeDash === 'dotted' ? '2 6' : undefined;
  let d: string;
  if (block.kind === 'straight') {
    d = `M ${sx} ${sy} L ${ex} ${ey}`;
  } else if (block.kind === 'elbow') {
    d = `M ${sx} ${sy} L ${ex} ${sy} L ${ex} ${ey}`;
  } else {
    const cx = (sx + ex) / 2;
    d = `M ${sx} ${sy} Q ${cx} ${sy} ${cx} ${(sy + ey) / 2} T ${ex} ${ey}`;
  }
  const stroke = block.color ?? '#475569';
  const w = block.strokeWidth ?? 2;
  return (
    <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <marker id={`m-end-${block.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke}/>
        </marker>
        <marker id={`m-start-${block.id}`} viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke}/>
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={w}
        strokeDasharray={dash}
        markerEnd={block.arrowEnd ? `url(#m-end-${block.id})` : undefined}
        markerStart={block.arrowStart ? `url(#m-start-${block.id})` : undefined}
      />
    </svg>
  );
}

function ProgressRender({ block }: { block: ProgressBlock }) {
  const v = Math.max(0, Math.min(1, block.value));
  const t = block.thickness ?? 12;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', gap: 8 }}>
      {(block.label || block.showValue) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          {block.label && <span style={{ fontSize: 18, color: '#0F172A' }}>{block.label}</span>}
          {block.showValue && <span style={{ fontSize: 22, fontWeight: 600, color: block.color ?? '#4F46E5' }}>{Math.round(v * 100)}%</span>}
        </div>
      )}
      <div style={{ width: '100%', height: t, background: block.trackColor ?? '#E2E8F0', borderRadius: t / 2, overflow: 'hidden' }}>
        <div style={{ width: `${v * 100}%`, height: '100%', background: block.color ?? '#4F46E5', transition: 'width .25s' }}/>
      </div>
    </div>
  );
}

function KpiCardRender({ block }: { block: KpiCardBlock }) {
  const tone = block.deltaTone ?? 'neutral';
  const deltaColor = tone === 'up' ? '#10B981' : tone === 'down' ? '#EF4444' : '#64748B';
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: 24, boxSizing: 'border-box',
      borderRadius: 16, background: '#fff', border: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
    }}>
      <div style={{ fontSize: 14, color: '#64748B', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>{block.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 96, lineHeight: 1, fontWeight: 700, color: block.color ?? '#0F172A' }}>{block.value}</div>
        {block.delta && (
          <div style={{ fontSize: 24, fontWeight: 600, color: deltaColor }}>
            {tone === 'up' ? '▲' : tone === 'down' ? '▼' : ''} {block.delta}
          </div>
        )}
      </div>
      {block.sub && <div style={{ fontSize: 16, color: '#94A3B8', marginTop: 12 }}>{block.sub}</div>}
    </div>
  );
}

function GalleryRender({ block }: { block: GalleryBlock }) {
  const cols = Math.max(1, Math.min(6, block.columns ?? 3));
  const gap = block.gap ?? 16;
  const r = block.cornerRadius ?? 8;
  if (block.images.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', borderRadius: r }}>
        Gallery — 添加图片
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gap, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {block.images.map((img, i) => (
        <div key={i} style={{ position: 'relative', borderRadius: r, overflow: 'hidden', background: '#E2E8F0' }}>
          {img.src && <img src={img.src} alt={img.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false}/>}
          {img.caption && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '6px 8px', fontSize: 12, color: '#fff',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
            }}>{img.caption}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function MathRender({ block }: { block: MathBlock }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const katex = (await import(/* @vite-ignore */ 'katex')).default;
        await import(/* @vite-ignore */ 'katex/dist/katex.min.css');
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = katex.renderToString(block.latex, {
          throwOnError: false,
          displayMode: block.display !== false,
        });
      } catch (e) {
        if (!cancelled) {
          const m = e instanceof Error ? e.message : String(e);
          setError(/cannot find|Failed to (resolve|fetch)/i.test(m)
            ? '未安装 katex' : m);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [block.latex, block.display]);
  if (error) return <div style={{ color: '#EF4444', padding: 8, fontSize: 12 }}>{error}</div>;
  return (
    <div
      ref={ref}
      style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: block.color ?? '#0F172A', fontSize: block.fontSize ?? 36,
      }}
    />
  );
}

function AudioRender({ block, presenting }: { block: AudioBlock; presenting?: boolean }) {
  if (!block.src) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', borderRadius: 8 }}>
        Audio — 设置 src 或选取文件
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
      <audio
        src={block.src}
        controls={block.controls ?? true}
        loop={block.loop}
        style={{ width: '100%', pointerEvents: presenting ? 'auto' : 'none' }}
      />
      {block.caption && <div style={{ fontSize: 12, color: '#64748B' }}>{block.caption}</div>}
    </div>
  );
}

function BadgeRender({ block }: { block: BadgeBlock }) {
  const variant = block.variant ?? 'solid';
  const baseColor = block.color ?? '#4F46E5';
  const styles: React.CSSProperties = {
    width: '100%', height: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
    borderRadius: 999, padding: '0 12px', boxSizing: 'border-box',
  };
  if (variant === 'solid') Object.assign(styles, { background: baseColor, color: block.textColor ?? '#fff' });
  else if (variant === 'soft') Object.assign(styles, { background: baseColor + '22', color: baseColor });
  else Object.assign(styles, { border: `2px solid ${baseColor}`, color: baseColor, background: 'transparent' });
  return <div style={styles}>{block.text}</div>;
}

function InkRender({ block }: { block: InkBlock }) {
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${block.w} ${block.h}`} preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
      {block.strokes.map((s, i) => {
        if (s.points.length < 2) return null;
        const d = s.points.map((p, j) => (j === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
        return (
          <path
            key={i}
            d={d}
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      })}
    </svg>
  );
}

function gradientToCss(g: NonNullable<ShapeBlock['gradient']>): string {
  const stops = g.stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`).join(', ');
  if (g.type === 'linear') return `linear-gradient(${g.angle ?? 0}deg, ${stops})`;
  return `radial-gradient(circle, ${stops})`;
}
