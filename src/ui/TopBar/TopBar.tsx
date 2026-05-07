import { useState } from 'react';
import {
  Undo2, Redo2, Plus, Type, Square, Image as ImgIcon, BarChart3, Table2,
  Play, Download, Settings as SettingsIcon, MessageSquare, Save,
} from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import { createImageBlock, createShapeBlock, createTextBlock } from '../../core/schema/factory';
import { exportPptx } from '../../export/pptx';
import { exportPng } from '../../export/png';

interface Props {
  onToggleSettings: () => void;
  onToggleChat: () => void;
}

export function TopBar({ onToggleSettings, onToggleChat }: Props) {
  const undo = useDeckStore((s) => s.undo);
  const redo = useDeckStore((s) => s.redo);
  const past = useDeckStore((s) => s.history.past.length);
  const future = useDeckStore((s) => s.history.future.length);
  const slideId = useDeckStore((s) => s.selection.slideId);
  const addBlock = useDeckStore((s) => s.addBlock);
  const setPresenting = useDeckStore((s) => s.setPresenting);
  const presenting = useDeckStore((s) => s.presenting);
  const dirty = useDeckStore((s) => s.dirty);
  const setZoom = useDeckStore((s) => s.setZoom);
  const zoom = useDeckStore((s) => s.zoom);
  const title = useDeckStore((s) => s.deck.meta.title);
  const setDeckTitle = useDeckStore((s) => s.setDeckTitle);
  const [exporting, setExporting] = useState(false);

  const insert = (kind: 'text' | 'shape' | 'image' | 'chart' | 'table') => {
    if (!slideId) return;
    if (kind === 'text') addBlock(slideId, createTextBlock());
    else if (kind === 'shape') addBlock(slideId, createShapeBlock());
    else if (kind === 'image') addBlock(slideId, createImageBlock());
    else if (kind === 'chart') addBlock(slideId, {
      id: `blk_${Math.random().toString(36).slice(2, 12)}`,
      type: 'chart', chart: 'bar', z: 1, x: 300, y: 200, w: 800, h: 500,
      series: [{ name: 'Series A', data: [12, 19, 7, 15, 20] }], categories: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
    } as any);
    else if (kind === 'table') addBlock(slideId, {
      id: `blk_${Math.random().toString(36).slice(2, 12)}`,
      type: 'table', rows: 3, cols: 3, headerRow: true, z: 1, x: 300, y: 200, w: 800, h: 400,
      cells: [['标题', '描述', '值'], ['一', '示例', '10'], ['二', '示例', '20']],
    } as any);
  };

  const handleExportPptx = async () => {
    setExporting(true);
    try { await exportPptx(useDeckStore.getState().deck); }
    finally { setExporting(false); }
  };

  return (
    <div className="topbar">
      <div className="topbar-section">
        <input
          className="deck-title"
          value={title}
          onChange={(e) => setDeckTitle(e.target.value)}
        />
        <span className="dirty-badge">{dirty ? '未保存' : <><Save size={11}/> 已保存</>}</span>
      </div>

      <div className="topbar-section">
        <button className="icon-btn" onClick={undo} disabled={past === 0} title="撤销 (Cmd+Z)">
          <Undo2 size={14} />
        </button>
        <button className="icon-btn" onClick={redo} disabled={future === 0} title="重做 (Cmd+Shift+Z)">
          <Redo2 size={14} />
        </button>
        <span className="sep" />
        <button className="icon-btn" title="文本 (T)" onClick={() => insert('text')}><Type size={14}/></button>
        <button className="icon-btn" title="形状 (R)" onClick={() => insert('shape')}><Square size={14}/></button>
        <button className="icon-btn" title="图片" onClick={() => insert('image')}><ImgIcon size={14}/></button>
        <button className="icon-btn" title="图表" onClick={() => insert('chart')}><BarChart3 size={14}/></button>
        <button className="icon-btn" title="表格" onClick={() => insert('table')}><Table2 size={14}/></button>
        <span className="sep" />
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" onClick={() => setZoom(zoom / 1.2)} title="缩小">−</button>
        <button className="icon-btn" onClick={() => setZoom(0.5)} title="100%">⤢</button>
        <button className="icon-btn" onClick={() => setZoom(zoom * 1.2)} title="放大">+</button>
      </div>

      <div className="topbar-section">
        <button className="btn-sm" onClick={onToggleChat} title="对话生成">
          <MessageSquare size={14}/> 对话
        </button>
        <button className="btn-sm" onClick={() => setPresenting(!presenting)}>
          <Play size={14}/> {presenting ? '退出' : '演示'}
        </button>
        <button className="btn-sm btn-primary" onClick={handleExportPptx} disabled={exporting}>
          <Download size={14}/> {exporting ? '导出中…' : '导出 PPTX'}
        </button>
        <button className="btn-sm" onClick={() => exportPng(useDeckStore.getState().deck)}>
          <Plus size={14}/> PNG
        </button>
        <button className="icon-btn" onClick={onToggleSettings} title="设置"><SettingsIcon size={14}/></button>
      </div>
    </div>
  );
}
