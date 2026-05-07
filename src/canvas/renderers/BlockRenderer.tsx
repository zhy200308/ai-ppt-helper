import { memo } from 'react';
import type {
  Block,
  ChartBlock,
  CodeBlock,
  IconBlock,
  ImageBlock,
  ShapeBlock,
  TableBlock,
  TextBlock,
} from '../../core/schema/types';

interface Props {
  block: Block;
  presenting?: boolean;
}

export const BlockRenderer = memo(function BlockRenderer({ block }: Props) {
  switch (block.type) {
    case 'text': return <TextRender block={block} />;
    case 'shape': return <ShapeRender block={block} />;
    case 'image': return <ImageRender block={block} />;
    case 'chart': return <ChartRender block={block} />;
    case 'table': return <TableRender block={block} />;
    case 'code': return <CodeRender block={block} />;
    case 'icon': return <IconRender block={block} />;
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
  // Use SVG for geometry-heavy shapes.
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={baseStyle}>
      {block.shape === 'triangle' && (
        <polygon points="50,5 95,95 5,95" fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
      )}
      {block.shape === 'star' && (
        <polygon
          points="50,5 61,38 95,38 67,58 78,90 50,70 22,90 33,58 5,38 39,38"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
      )}
      {block.shape === 'line' && (
        <line x1="0" y1="50" x2="100" y2="50" stroke={stroke ?? '#000'} strokeWidth={sw || 2} strokeDasharray={dash} />
      )}
      {block.shape === 'arrow' && (
        <g>
          <line x1="0" y1="50" x2="85" y2="50" stroke={stroke ?? '#000'} strokeWidth={sw || 2} strokeDasharray={dash} />
          <polygon points="100,50 80,40 80,60" fill={stroke ?? '#000'} />
        </g>
      )}
      {block.shape === 'polygon' && (
        <polygon points="50,5 95,30 80,90 20,90 5,30" fill={fill} stroke={stroke} strokeWidth={sw} />
      )}
    </svg>
  );
}

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

function gradientToCss(g: NonNullable<ShapeBlock['gradient']>): string {
  const stops = g.stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`).join(', ');
  if (g.type === 'linear') return `linear-gradient(${g.angle ?? 0}deg, ${stops})`;
  return `radial-gradient(circle, ${stops})`;
}
