import { useState } from 'react';
import { Database, Plus, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useDeckStore, useSelectedBlocks, useActiveSlide } from '../../core/store/deck';
import type { Block, ChartBlock, ImageBlock, ShapeBlock, TableBlock, TextBlock, ProgressBlock, KpiCardBlock, BadgeBlock, MathBlock, GalleryBlock } from '../../core/schema/types';
import { NumberField } from '../components/NumberField';
import { ColorField } from '../components/ColorField';
import { AlignTools } from './AlignTools';
import { DataTablesPanel } from './DataTablesPanel';

export function RightPanel() {
  const slide = useActiveSlide();
  const selected = useSelectedBlocks();
  const updateBlock = useDeckStore((s) => s.updateBlock);
  const removeBlocks = useDeckStore((s) => s.removeBlocks);
  const reorderBlock = useDeckStore((s) => s.reorderBlock);
  const [showData, setShowData] = useState(false);

  if (!slide) return <div className="right-panel"><div className="empty-hint">无幻灯片</div></div>;
  if (showData) {
    return <div className="right-panel"><DataTablesPanel onClose={() => setShowData(false)}/></div>;
  }
  if (selected.length === 0) {
    return (
      <div className="right-panel">
        <div className="panel-section" style={{ paddingTop: 0 }}>
          <button className="btn-sm" onClick={() => setShowData(true)}>
            <Database size={11}/> 管理数据表
          </button>
        </div>
        <SlideProps />
      </div>
    );
  }
  if (selected.length > 1) {
    return (
      <div className="right-panel">
        <div className="panel-section">
          <div className="panel-title">已选择 {selected.length} 个对象</div>
          <button className="btn-sm btn-danger" onClick={() => removeBlocks(slide.id, selected.map((b) => b.id))}>
            删除全部
          </button>
        </div>
        <AlignTools slideId={slide.id} blockIds={selected.map((b) => b.id)} />
      </div>
    );
  }

  const block = selected[0];
  return (
    <div className="right-panel">
      <CommonProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)} />
      {block.type === 'text' && <TextProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)} />}
      {block.type === 'shape' && <ShapeProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)} />}
      {block.type === 'image' && <ImageProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)} />}
      {block.type === 'chart' && <ChartProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)} onOpenTables={() => setShowData(true)}/>}
      {block.type === 'table' && <TableProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)} onOpenTables={() => setShowData(true)}/>}
      {block.type === 'progress' && <ProgressProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)}/>}
      {block.type === 'kpi' && <KpiProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)}/>}
      {block.type === 'badge' && <BadgeProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)}/>}
      {block.type === 'math' && <MathProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)}/>}
      {block.type === 'gallery' && <GalleryProps block={block} onChange={(p) => updateBlock(slide.id, block.id, p)}/>}

      <div className="panel-section">
        <div className="panel-title">层级</div>
        <div className="row">
          <button className="btn-sm" onClick={() => reorderBlock(slide.id, block.id, 'top')}>置顶</button>
          <button className="btn-sm" onClick={() => reorderBlock(slide.id, block.id, 'up')}>上移</button>
          <button className="btn-sm" onClick={() => reorderBlock(slide.id, block.id, 'down')}>下移</button>
          <button className="btn-sm" onClick={() => reorderBlock(slide.id, block.id, 'bottom')}>置底</button>
        </div>
      </div>

      <div className="panel-section">
        <button className="btn-sm btn-danger" onClick={() => removeBlocks(slide.id, [block.id])}>
          删除
        </button>
      </div>
    </div>
  );
}

function SlideProps() {
  const slide = useActiveSlide()!;
  const setSlideBackground = useDeckStore((s) => s.setSlideBackground);
  return (
    <div className="panel-section">
      <div className="panel-title">幻灯片属性</div>
      <ColorField
        label="背景颜色"
        value={slide.background?.color ?? '#FFFFFF'}
        onChange={(v) => setSlideBackground(slide.id, { ...slide.background, color: v })}
      />
      <p className="panel-hint">提示: 选中元素以查看其属性</p>
    </div>
  );
}

function CommonProps({ block, onChange }: { block: Block; onChange: (p: Partial<Block>) => void }) {
  return (
    <div className="panel-section">
      <div className="panel-title">位置 / 大小</div>
      <div className="row">
        <NumberField label="X" value={block.x} onChange={(v) => onChange({ x: v } as Partial<Block>)} />
        <NumberField label="Y" value={block.y} onChange={(v) => onChange({ y: v } as Partial<Block>)} />
      </div>
      <div className="row">
        <NumberField label="W" value={block.w} onChange={(v) => onChange({ w: Math.max(8, v) } as Partial<Block>)} />
        <NumberField label="H" value={block.h} onChange={(v) => onChange({ h: Math.max(8, v) } as Partial<Block>)} />
      </div>
      <div className="row">
        <NumberField label="旋转" value={block.rotation ?? 0} onChange={(v) => onChange({ rotation: v } as Partial<Block>)} />
        <NumberField label="不透明" value={block.opacity ?? 1} step={0.05} min={0} max={1} onChange={(v) => onChange({ opacity: v } as Partial<Block>)} />
      </div>
    </div>
  );
}

function TextProps({ block, onChange }: { block: TextBlock; onChange: (p: Partial<TextBlock>) => void }) {
  const text = block.runs.map((r) => r.text).join('');
  return (
    <div className="panel-section">
      <div className="panel-title">文本</div>
      <textarea
        className="input-text"
        rows={4}
        value={text}
        onChange={(e) => onChange({ runs: [{ text: e.target.value }] })}
        placeholder="输入文字"
      />
      <div className="row">
        <NumberField label="字号" value={block.fontSize ?? 32} onChange={(v) => onChange({ fontSize: v })} />
        <NumberField label="行高" value={block.lineHeight ?? 1.3} step={0.05} onChange={(v) => onChange({ lineHeight: v })} />
      </div>
      <ColorField label="颜色" value={block.color ?? '#000'} onChange={(v) => onChange({ color: v })} />
      <div className="row">
        {(['left', 'center', 'right', 'justify'] as const).map((a) => (
          <button
            key={a}
            className={`btn-sm ${block.align === a ? 'active' : ''}`}
            onClick={() => onChange({ align: a })}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShapeProps({ block, onChange }: { block: ShapeBlock; onChange: (p: Partial<ShapeBlock>) => void }) {
  return (
    <div className="panel-section">
      <div className="panel-title">形状</div>
      <ColorField label="填充" value={block.fill ?? '#4F46E5'} onChange={(v) => onChange({ fill: v })} />
      <ColorField label="描边" value={block.stroke ?? '#000000'} onChange={(v) => onChange({ stroke: v })} />
      <div className="row">
        <NumberField label="描边宽度" value={block.strokeWidth ?? 0} onChange={(v) => onChange({ strokeWidth: v })} />
        <NumberField label="圆角" value={block.cornerRadius ?? 0} onChange={(v) => onChange({ cornerRadius: v })} />
      </div>
    </div>
  );
}

function ImageProps({ block, onChange }: { block: ImageBlock; onChange: (p: Partial<ImageBlock>) => void }) {
  const filter = block.filter ?? {};
  return (
    <div className="panel-section">
      <div className="panel-title">图片</div>
      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => onChange({ src: reader.result as string });
          reader.readAsDataURL(f);
        }}
      />
      <div className="row" style={{ marginTop: 8 }}>
        {(['cover', 'contain', 'fill'] as const).map((f) => (
          <button
            key={f}
            className={`btn-sm ${block.fit === f ? 'active' : ''}`}
            onClick={() => onChange({ fit: f })}
          >
            {f}
          </button>
        ))}
      </div>
      <NumberField label="圆角" value={block.cornerRadius ?? 0} onChange={(v) => onChange({ cornerRadius: v })} />
      <div className="panel-title" style={{ marginTop: 12 }}>滤镜</div>
      <div className="row">
        <NumberField label="亮度" step={0.05} min={0} max={3} value={filter.brightness ?? 1} onChange={(v) => onChange({ filter: { ...filter, brightness: v } })} />
        <NumberField label="对比" step={0.05} min={0} max={3} value={filter.contrast ?? 1} onChange={(v) => onChange({ filter: { ...filter, contrast: v } })} />
      </div>
      <div className="row">
        <NumberField label="饱和" step={0.05} min={0} max={3} value={filter.saturate ?? 1} onChange={(v) => onChange({ filter: { ...filter, saturate: v } })} />
        <NumberField label="模糊" step={0.5} min={0} max={20} value={filter.blur ?? 0} onChange={(v) => onChange({ filter: { ...filter, blur: v } })} />
      </div>
      <button
        className="btn-sm"
        style={{ marginTop: 6 }}
        onClick={() => onChange({ filter: undefined })}
      >
        重置滤镜
      </button>
    </div>
  );
}

function ChartProps({ block, onChange, onOpenTables }: { block: ChartBlock; onChange: (p: Partial<ChartBlock>) => void; onOpenTables: () => void }) {
  const tables = useDeckStore(useShallow((s) => s.deck.dataTables ?? {}));
  const ref = block.dataRef;
  const ids = Object.keys(tables);
  const tbl = ref ? tables[ref.tableId] : undefined;
  const categories = block.categories?.length ? block.categories : ['Q1', 'Q2', 'Q3', 'Q4'];
  const series = block.series?.length ? block.series : [{ name: 'Series A', data: categories.map(() => 0) }];

  const updateInlineCell = (seriesIndex: number, categoryIndex: number, value: number) => {
    onChange({
      series: series.map((s, si) => si === seriesIndex
        ? { ...s, data: categories.map((_, ci) => ci === categoryIndex ? value : (s.data[ci] ?? 0)) }
        : { ...s, data: categories.map((_, ci) => s.data[ci] ?? 0) }),
      categories,
    });
  };

  const updateCategory = (index: number, value: string) => {
    onChange({ categories: categories.map((c, i) => i === index ? value : c) });
  };

  const addCategory = () => {
    onChange({
      categories: [...categories, `类别 ${categories.length + 1}`],
      series: series.map((s) => ({ ...s, data: [...s.data, 0] })),
    });
  };

  const removeCategory = (index: number) => {
    const nextCategories = categories.filter((_, i) => i !== index);
    onChange({
      categories: nextCategories,
      series: series.map((s) => ({ ...s, data: s.data.filter((_, i) => i !== index) })),
    });
  };

  const addSeries = () => {
    onChange({
      categories,
      series: [...series, { name: `Series ${series.length + 1}`, data: categories.map(() => 0) }],
    });
  };

  const removeSeries = (index: number) => {
    const next = series.filter((_, i) => i !== index);
    onChange({ series: next.length ? next : [{ name: 'Series A', data: categories.map(() => 0) }], categories });
  };

  const createDataTableFromInline = () => {
    const id = `dt_${Date.now().toString(36)}`;
    const columns = [
      { key: 'category', label: '类别', type: 'string' as const },
      ...series.map((s, i) => ({ key: `series_${i + 1}`, label: s.name || `系列 ${i + 1}`, type: 'number' as const })),
    ];
    const rows = categories.map((category, ci) => {
      const row: Record<string, string | number> = { category };
      series.forEach((s, si) => { row[`series_${si + 1}`] = s.data[ci] ?? 0; });
      return row;
    });
    useDeckStore.getState().upsertDataTable({ id, name: '柱状图数据', columns, rows, updatedAt: Date.now(), source: 'chart-inline' });
    onChange({ dataRef: { tableId: id, xColumn: 'category' } });
  };

  return (
    <div className="panel-section">
      <div className="panel-title">图表类型</div>
      <div className="row">
        {(['bar', 'line', 'pie', 'area', 'scatter'] as const).map((c) => (
          <button key={c} className={`btn-sm ${block.chart === c ? 'active' : ''}`} onClick={() => onChange({ chart: c })}>{c}</button>
        ))}
      </div>
      <div className="panel-title" style={{ marginTop: 12 }}>数据来源</div>
      {ids.length === 0 ? (
        <div className="empty-hint" style={{ fontSize: 12 }}>
          先在数据表面板创建一个 →
          <button className="btn-sm" onClick={onOpenTables} style={{ marginLeft: 6 }}>管理数据表</button>
        </div>
      ) : (
        <>
          <label className="field">
            <span className="field-label">引用数据表</span>
            <select
              value={ref?.tableId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) { onChange({ dataRef: undefined } as any); return; }
                const t = tables[id];
                const xCol = t.columns.find((c) => c.type !== 'number')?.key ?? t.columns[0]?.key ?? '';
                onChange({ dataRef: { tableId: id, xColumn: xCol } });
              }}
            >
              <option value="">— 不引用 (使用内联数据) —</option>
              {ids.map((id) => <option key={id} value={id}>{tables[id].name}</option>)}
            </select>
          </label>
          {tbl && ref && (
            <>
              <label className="field">
                <span className="field-label">X 轴列</span>
                <select value={ref.xColumn} onChange={(e) => onChange({ dataRef: { ...ref, xColumn: e.target.value } })}>
                  {tbl.columns.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.type})</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Y 列 (留空 = 全部数值列)</span>
                <input
                  value={ref.yColumns?.join(',') ?? ''}
                  onChange={(e) => {
                    const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    onChange({ dataRef: { ...ref, yColumns: arr.length ? arr : undefined } });
                  }}
                  placeholder="value, profit"
                />
              </label>
              <button className="btn-sm" onClick={onOpenTables}>编辑数据 →</button>
            </>
          )}
        </>
      )}

      {!ref && (
        <div className="inline-chart-editor">
          <div className="panel-title" style={{ marginTop: 12 }}>内联行列数据</div>
          <div className="row">
            <button className="btn-sm" onClick={addCategory}><Plus size={10}/> 行</button>
            <button className="btn-sm" onClick={addSeries}><Plus size={10}/> 系列列</button>
            <button className="btn-sm" onClick={createDataTableFromInline}>转为数据表</button>
          </div>
          <div className="dt-grid-wrap chart-grid-wrap">
            <table className="dt-grid">
              <thead>
                <tr>
                  <th>类别</th>
                  {series.map((s, si) => (
                    <th key={si}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          value={s.name}
                          onChange={(e) => onChange({ series: series.map((item, i) => i === si ? { ...item, name: e.target.value } : item), categories })}
                          style={{ minWidth: 70 }}
                        />
                        <button className="icon-btn xs danger" onClick={() => removeSeries(si)} title="删除系列"><Trash2 size={9}/></button>
                      </div>
                    </th>
                  ))}
                  <th className="dt-addcol" />
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, ci) => (
                  <tr key={ci}>
                    <td>
                      <input value={cat} onChange={(e) => updateCategory(ci, e.target.value)} />
                    </td>
                    {series.map((s, si) => (
                      <td key={si}>
                        <input
                          type="number"
                          value={s.data[ci] ?? 0}
                          onChange={(e) => updateInlineCell(si, ci, Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0)}
                        />
                      </td>
                    ))}
                    <td className="dt-rownum">
                      <button className="icon-btn xs danger" onClick={() => removeCategory(ci)} title="删除行"><Trash2 size={9}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TableProps({ block, onChange, onOpenTables }: { block: TableBlock; onChange: (p: Partial<TableBlock>) => void; onOpenTables: () => void }) {
  const tables = useDeckStore(useShallow((s) => s.deck.dataTables ?? {}));
  const ref = block.dataRef;
  const ids = Object.keys(tables);
  return (
    <div className="panel-section">
      <div className="panel-title">表格</div>
      <label className="checkbox-row">
        <input type="checkbox" checked={!!block.headerRow} onChange={(e) => onChange({ headerRow: e.target.checked })}/>
        首行作为表头
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={!!block.headerCol} onChange={(e) => onChange({ headerCol: e.target.checked })}/>
        首列作为表头
      </label>
      <div className="panel-title" style={{ marginTop: 12 }}>数据来源</div>
      {ids.length === 0 ? (
        <button className="btn-sm" onClick={onOpenTables}>管理数据表 →</button>
      ) : (
        <label className="field">
          <span className="field-label">引用数据表</span>
          <select
            value={ref?.tableId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) { onChange({ dataRef: undefined } as any); return; }
              onChange({ dataRef: { tableId: id } });
            }}
          >
            <option value="">— 不引用 (内联数据，可双击编辑) —</option>
            {ids.map((id) => <option key={id} value={id}>{tables[id].name}</option>)}
          </select>
        </label>
      )}
      {ref && <button className="btn-sm" onClick={onOpenTables}>编辑数据 →</button>}
      {!ref && <p className="panel-hint">提示：在画布上双击单元格直接编辑内容</p>}
    </div>
  );
}

function ProgressProps({ block, onChange }: { block: ProgressBlock; onChange: (p: Partial<ProgressBlock>) => void }) {
  return (
    <div className="panel-section">
      <div className="panel-title">进度条</div>
      <label className="field">
        <span className="field-label">标签</span>
        <input value={block.label ?? ''} onChange={(e) => onChange({ label: e.target.value })}/>
      </label>
      <NumberField label="值 (0-1)" step={0.01} min={0} max={1} value={block.value} onChange={(v) => onChange({ value: v })}/>
      <NumberField label="厚度" value={block.thickness ?? 12} onChange={(v) => onChange({ thickness: v })}/>
      <ColorField label="主色" value={block.color ?? '#4F46E5'} onChange={(v) => onChange({ color: v })}/>
      <ColorField label="轨道" value={block.trackColor ?? '#E2E8F0'} onChange={(v) => onChange({ trackColor: v })}/>
      <label className="checkbox-row">
        <input type="checkbox" checked={!!block.showValue} onChange={(e) => onChange({ showValue: e.target.checked })}/>
        显示百分比
      </label>
    </div>
  );
}

function KpiProps({ block, onChange }: { block: KpiCardBlock; onChange: (p: Partial<KpiCardBlock>) => void }) {
  return (
    <div className="panel-section">
      <div className="panel-title">KPI 卡片</div>
      <label className="field">
        <span className="field-label">标签</span>
        <input value={block.label} onChange={(e) => onChange({ label: e.target.value })}/>
      </label>
      <label className="field">
        <span className="field-label">数值</span>
        <input value={block.value} onChange={(e) => onChange({ value: e.target.value })}/>
      </label>
      <label className="field">
        <span className="field-label">变化</span>
        <input value={block.delta ?? ''} onChange={(e) => onChange({ delta: e.target.value })} placeholder="+18%"/>
      </label>
      <label className="field">
        <span className="field-label">变化方向</span>
        <select value={block.deltaTone ?? 'neutral'} onChange={(e) => onChange({ deltaTone: e.target.value as any })}>
          <option value="up">上升</option>
          <option value="down">下降</option>
          <option value="neutral">中性</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">副标题</span>
        <input value={block.sub ?? ''} onChange={(e) => onChange({ sub: e.target.value })}/>
      </label>
      <ColorField label="数值颜色" value={block.color ?? '#0F172A'} onChange={(v) => onChange({ color: v })}/>
    </div>
  );
}

function BadgeProps({ block, onChange }: { block: BadgeBlock; onChange: (p: Partial<BadgeBlock>) => void }) {
  return (
    <div className="panel-section">
      <div className="panel-title">徽标</div>
      <label className="field">
        <span className="field-label">文字</span>
        <input value={block.text} onChange={(e) => onChange({ text: e.target.value })}/>
      </label>
      <div className="row">
        {(['solid', 'soft', 'outline'] as const).map((v) => (
          <button key={v} className={`btn-sm ${(block.variant ?? 'solid') === v ? 'active' : ''}`} onClick={() => onChange({ variant: v })}>{v}</button>
        ))}
      </div>
      <ColorField label="主色" value={block.color ?? '#4F46E5'} onChange={(v) => onChange({ color: v })}/>
      <ColorField label="文字色" value={block.textColor ?? '#FFFFFF'} onChange={(v) => onChange({ textColor: v })}/>
    </div>
  );
}

function MathProps({ block, onChange }: { block: MathBlock; onChange: (p: Partial<MathBlock>) => void }) {
  return (
    <div className="panel-section">
      <div className="panel-title">公式 (LaTeX)</div>
      <textarea
        className="input-text"
        rows={4}
        value={block.latex}
        onChange={(e) => onChange({ latex: e.target.value })}
        spellCheck={false}
        style={{ fontFamily: 'monospace' }}
      />
      <NumberField label="字号" value={block.fontSize ?? 36} onChange={(v) => onChange({ fontSize: v })}/>
      <ColorField label="颜色" value={block.color ?? '#0F172A'} onChange={(v) => onChange({ color: v })}/>
      <label className="checkbox-row">
        <input type="checkbox" checked={block.display !== false} onChange={(e) => onChange({ display: e.target.checked })}/>
        居中显示模式
      </label>
    </div>
  );
}

function GalleryProps({ block, onChange }: { block: GalleryBlock; onChange: (p: Partial<GalleryBlock>) => void }) {
  return (
    <div className="panel-section">
      <div className="panel-title">图片画廊 ({block.images.length})</div>
      <NumberField label="列数" min={1} max={6} value={block.columns ?? 3} onChange={(v) => onChange({ columns: Math.max(1, Math.min(6, Math.round(v))) })}/>
      <NumberField label="间距" min={0} max={64} value={block.gap ?? 16} onChange={(v) => onChange({ gap: v })}/>
      <NumberField label="圆角" min={0} max={32} value={block.cornerRadius ?? 8} onChange={(v) => onChange({ cornerRadius: v })}/>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          const imgs = await Promise.all(files.map((f) => new Promise<{ src: string }>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve({ src: r.result as string });
            r.readAsDataURL(f);
          })));
          onChange({ images: [...block.images, ...imgs] });
        }}
      />
      {block.images.length > 0 && (
        <button className="btn-sm btn-danger" onClick={() => onChange({ images: [] })}>清空图片</button>
      )}
    </div>
  );
}
