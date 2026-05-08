import { memo } from 'react';
import type {
  Block,
  ChartBlock,
  CodeBlock,
  ConnectorBlock,
  DividerBlock,
  EmbedBlock,
  IconBlock,
  ImageBlock,
  ListBlock,
  ShapeBlock,
  TableBlock,
  TextBlock,
  VideoBlock,
} from '../../core/schema/types';

interface Props {
  block: Block;
  presenting?: boolean;
}

export const BlockRenderer = memo(function BlockRenderer({ block, presenting }: Props) {
  switch (block.type) {
    case 'text': return <TextRender block={block} />;
    case 'shape': return <ShapeRender block={block} />;
    case 'image': return <ImageRender block={block} />;
    case 'chart': return <ChartRender block={block} />;
    case 'table': return <TableRender block={block} />;
    case 'code': return <CodeRender block={block} />;
    case 'icon': return <IconRender block={block} />;
    case 'list': return <ListRender block={block} />;
    case 'divider': return <DividerRender block={block} />;
    case 'video': return <VideoRender block={block} presenting={presenting} />;
    case 'embed': return <EmbedRender block={block} />;
    case 'connector': return <ConnectorRender block={block} />;
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

function ChartRender({ block }: { block: ChartBlock }) {
  // Lightweight inline SVG bar/line/pie. ECharts integration can replace later.
  const w = 100;
  const h = 100;
  if (block.chart === 'bar') {
    const flat = block.series.flatMap((s) => s.data);
    const max = Math.max(1, ...flat);
    const totalBars = flat.length;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        {flat.map((v, i) => {
          const bw = w / (totalBars * 1.4);
          const x = (i + 0.7) * (w / (totalBars + 1));
          const bh = (v / max) * (h - 10);
          return <rect key={i} x={x} y={h - bh - 5} width={bw} height={bh} fill="#4F46E5" />;
        })}
      </svg>
    );
  }
  if (block.chart === 'line') {
    const flat = block.series[0]?.data ?? [];
    const max = Math.max(1, ...flat);
    const points = flat.map((v, i) => `${(i / Math.max(1, flat.length - 1)) * w},${h - (v / max) * (h - 10) - 5}`).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <polyline points={points} fill="none" stroke="#4F46E5" strokeWidth={2} />
      </svg>
    );
  }
  if (block.chart === 'pie') {
    const flat = block.series[0]?.data ?? [];
    const total = flat.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        {flat.map((v, i) => {
          const start = acc / total;
          acc += v;
          const end = acc / total;
          const a0 = start * 2 * Math.PI - Math.PI / 2;
          const a1 = end * 2 * Math.PI - Math.PI / 2;
          const x0 = 50 + 45 * Math.cos(a0);
          const y0 = 50 + 45 * Math.sin(a0);
          const x1 = 50 + 45 * Math.cos(a1);
          const y1 = 50 + 45 * Math.sin(a1);
          const large = end - start > 0.5 ? 1 : 0;
          const colors = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
          return (
            <path
              key={i}
              d={`M50 50 L${x0} ${y0} A45 45 0 ${large} 1 ${x1} ${y1} Z`}
              fill={colors[i % colors.length]}
            />
          );
        })}
      </svg>
    );
  }
  return <div style={{ width: '100%', height: '100%', background: '#F1F5F9' }} />;
}

function TableRender({ block }: { block: TableBlock }) {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          {block.cells.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const isHeader = (block.headerRow && ri === 0) || (block.headerCol && ci === 0);
                return (
                  <td
                    key={ci}
                    style={{
                      border: '1px solid #CBD5E1',
                      padding: 6,
                      fontSize: 14,
                      fontWeight: isHeader ? 600 : 400,
                      background: isHeader ? '#F1F5F9' : undefined,
                    }}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function EmbedRender({ block }: { block: EmbedBlock }) {
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
        width: '100%',
        height: '100%',
        background: '#F1F5F9',
        color: '#475569',
        padding: 12,
        boxSizing: 'border-box',
        fontFamily: 'monospace',
        fontSize: 13,
        whiteSpace: 'pre-wrap',
        overflow: 'auto',
        borderRadius: block.cornerRadius,
      }}
    >
      {block.fallback ?? `[${block.kind}] ${block.src}`}
    </div>
  );
}

function ConnectorRender({ block }: { block: ConnectorBlock }) {
  // Coordinates are deck-space; the wrapper already positioned the block,
  // so we draw inside its local rect and convert start/end to local coords.
  const sx = block.start.x - block.x;
  const sy = block.start.y - block.y;
  const ex = block.end.x - block.x;
  const ey = block.end.y - block.y;
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

function gradientToCss(g: NonNullable<ShapeBlock['gradient']>): string {
  const stops = g.stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`).join(', ');
  if (g.type === 'linear') return `linear-gradient(${g.angle ?? 0}deg, ${stops})`;
  return `radial-gradient(circle, ${stops})`;
}
