import { useState } from 'react';
import {
  Undo2, Redo2, Plus, Type, Square, Image as ImgIcon, BarChart3, Table2,
  Play, Download, Settings as SettingsIcon, MessageSquare, Save,
  List, Minus, Video, Code2, Link2, ChevronDown,
  TrendingUp, Images, Sigma, Volume2, BadgeCheck,
} from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import {
  createAudioBlock, createBadgeBlock, createConnectorBlock, createDividerBlock,
  createEmbedBlock, createGalleryBlock, createImageBlock, createKpiCardBlock,
  createListBlock, createMathBlock, createProgressBlock, createShapeBlock,
  createTextBlock, createVideoBlock, newId,
} from '../../core/schema/factory';
import { useI18n } from '../../i18n';
import { useEffect, useRef } from 'react';

interface Props {
  onToggleSettings: () => void;
  onToggleChat: () => void;
}

type InsertKind =
  | 'text' | 'shape' | 'image' | 'chart' | 'table'
  | 'list-bullet' | 'list-number' | 'divider' | 'video' | 'embed' | 'code' | 'connector'
  | 'progress' | 'kpi' | 'gallery' | 'math' | 'audio' | 'badge';

function InsertMore({ onInsert }: { onInsert: (k: InsertKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button className="icon-btn" title="更多组件" onClick={() => setOpen((v) => !v)}>
        <Plus size={14}/>
      </button>
      {open && (
        <div className="insert-menu">
          <button onClick={() => { onInsert('list-number'); setOpen(false); }}><List size={12}/> 有序列表</button>
          <button onClick={() => { onInsert('progress'); setOpen(false); }}><TrendingUp size={12}/> 进度条</button>
          <button onClick={() => { onInsert('kpi'); setOpen(false); }}><BarChart3 size={12}/> KPI 卡片</button>
          <button onClick={() => { onInsert('gallery'); setOpen(false); }}><Images size={12}/> 图片画廊</button>
          <button onClick={() => { onInsert('math'); setOpen(false); }}><Sigma size={12}/> 数学公式</button>
          <button onClick={() => { onInsert('audio'); setOpen(false); }}><Volume2 size={12}/> 音频</button>
          <button onClick={() => { onInsert('badge'); setOpen(false); }}><BadgeCheck size={12}/> 徽标</button>
          <button onClick={() => { onInsert('connector'); setOpen(false); }}><Link2 size={12}/> 连接线</button>
          <button onClick={() => { onInsert('video'); setOpen(false); }}><Video size={12}/> 视频</button>
          <button onClick={() => { onInsert('embed'); setOpen(false); }}><Link2 size={12}/> 嵌入网页</button>
          <button onClick={() => { onInsert('code'); setOpen(false); }}><Code2 size={12}/> 代码块</button>
        </div>
      )}
    </div>
  );
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

  const insert = (kind: InsertKind) => {
    if (!slideId) return;
    if (kind === 'text') addBlock(slideId, createTextBlock());
    else if (kind === 'shape') addBlock(slideId, createShapeBlock());
    else if (kind === 'image') addBlock(slideId, createImageBlock());
    else if (kind === 'list-bullet') addBlock(slideId, createListBlock({ ordered: false }));
    else if (kind === 'list-number') addBlock(slideId, createListBlock({ ordered: true }));
    else if (kind === 'divider') addBlock(slideId, createDividerBlock());
    else if (kind === 'video') addBlock(slideId, createVideoBlock());
    else if (kind === 'embed') addBlock(slideId, createEmbedBlock());
    else if (kind === 'connector') addBlock(slideId, createConnectorBlock());
    else if (kind === 'progress') addBlock(slideId, createProgressBlock());
    else if (kind === 'kpi') addBlock(slideId, createKpiCardBlock());
    else if (kind === 'gallery') addBlock(slideId, createGalleryBlock());
    else if (kind === 'math') addBlock(slideId, createMathBlock());
    else if (kind === 'audio') addBlock(slideId, createAudioBlock());
    else if (kind === 'badge') addBlock(slideId, createBadgeBlock());
    else if (kind === 'chart') addBlock(slideId, {
      id: newId('blk'),
      type: 'chart', chart: 'bar', z: 1, x: 300, y: 200, w: 800, h: 500,
      series: [{ name: 'Series A', data: [12, 19, 7, 15, 20] }], categories: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
    } as any);
    else if (kind === 'code') addBlock(slideId, {
      id: newId('blk'), type: 'code', z: 1, x: 240, y: 220, w: 1440, h: 600,
      language: 'typescript',
      theme: 'dark',
      code: '// Edit me\nconst greet = (name: string) => `Hello, ${name}!`;\nconsole.log(greet("AI PPT"));',
    } as any);
    else if (kind === 'table') addBlock(slideId, {
      id: newId('blk'),
      type: 'table', rows: 3, cols: 3, headerRow: true, z: 1, x: 300, y: 200, w: 800, h: 400,
      cells: [['标题', '描述', '值'], ['一', '示例', '10'], ['二', '示例', '20']],
    } as any);
  };

  const handleExportPptx = async () => {
    setExporting(true);
    try {
      const { exportPptx } = await import('../../export/pptx');
      await exportPptx(useDeckStore.getState().deck);
    } finally { setExporting(false); }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { exportPdf } = await import('../../export/pdf');
      await exportPdf(useDeckStore.getState().deck);
    } finally { setExporting(false); }
  };

  const handleExportPng = async () => {
    setExporting(true);
    try {
      const { exportPng } = await import('../../export/png');
      await exportPng(useDeckStore.getState().deck);
    } finally { setExporting(false); }
  };

  const handleExportPreviewZip = async () => {
    setExporting(true);
    try {
      const { exportPreviewZip } = await import('../../export/previewZip');
      await exportPreviewZip(useDeckStore.getState().deck);
    } finally { setExporting(false); }
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
        <button className="icon-btn" title="无序列表" onClick={() => insert('list-bullet')}><List size={14}/></button>
        <button className="icon-btn" title="分隔线" onClick={() => insert('divider')}><Minus size={14}/></button>
        <button className="icon-btn" title="图表" onClick={() => insert('chart')}><BarChart3 size={14}/></button>
        <button className="icon-btn" title="表格" onClick={() => insert('table')}><Table2 size={14}/></button>
        <InsertMore onInsert={insert} />
        <ChevronDown size={11} style={{ opacity: 0.4 }}/>
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
        <button className="btn-sm" onClick={handleExportPdf} disabled={exporting}>PDF</button>
        <button className="btn-sm" onClick={handleExportPng} disabled={exporting}>PNG</button>
        <button className="btn-sm" onClick={handleExportPreviewZip} disabled={exporting}>预览ZIP</button>
        <LangSwitcher />
        <button className="icon-btn" onClick={onToggleSettings} title="设置"><SettingsIcon size={14}/></button>
      </div>
    </div>
  );
}

function LangSwitcher() {
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  return (
    <button
      className="btn-sm"
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      title="Language / 语言"
      style={{ fontVariant: 'small-caps' }}
    >
      {locale === 'zh' ? 'EN' : '中文'}
    </button>
  );
}
