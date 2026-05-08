import { useDeckStore, useSelectedBlocks, useActiveSlide } from '../../core/store/deck';
import type { Block, ImageBlock, ShapeBlock, TextBlock } from '../../core/schema/types';
import { NumberField } from '../components/NumberField';
import { ColorField } from '../components/ColorField';
import { AlignTools } from './AlignTools';

export function RightPanel() {
  const slide = useActiveSlide();
  const selected = useSelectedBlocks();
  const updateBlock = useDeckStore((s) => s.updateBlock);
  const removeBlocks = useDeckStore((s) => s.removeBlocks);
  const reorderBlock = useDeckStore((s) => s.reorderBlock);

  if (!slide) return <div className="right-panel"><div className="empty-hint">无幻灯片</div></div>;
  if (selected.length === 0) {
    return (
      <div className="right-panel">
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
