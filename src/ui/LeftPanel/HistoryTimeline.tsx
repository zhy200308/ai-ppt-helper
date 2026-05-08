import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, History, Trash2, RotateCcw, Bookmark } from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import { listSnapshots, deleteSnapshot, type DeckSnapshot } from '../../core/persistence/db';
import { captureSnapshot } from '../../core/persistence/snapshots';

export function HistoryTimeline({ onClose }: { onClose: () => void }) {
  const deckId = useDeckStore((s) => s.deck.meta.id);
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const [snaps, setSnaps] = useState<DeckSnapshot[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setSnaps(await listSnapshots(deckId));
  }, [deckId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const restore = (snap: DeckSnapshot) => {
    if (!window.confirm(`恢复到「${snap.label}」？当前未保存编辑会被覆盖。`)) return;
    loadDeck(snap.deck);
    onClose();
  };

  const remove = async (id: string) => {
    setBusy(true);
    try { await deleteSnapshot(id); await refresh(); } finally { setBusy(false); }
  };

  const snap = async () => {
    setBusy(true);
    try {
      const label = window.prompt('为快照命名', `手动 ${new Date().toLocaleTimeString()}`);
      if (label !== null) {
        await captureSnapshot(label || '手动快照', 'manual');
        await refresh();
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="project-list-overlay">
      <div className="project-list-header">
        <span><History size={12}/> 版本历史 ({snaps.length})</span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <button className="icon-btn xs" onClick={() => void snap()} title="保存当前版本" disabled={busy}>
            <Bookmark size={12}/>
          </button>
          <button className="icon-btn xs" onClick={onClose} title="返回幻灯片列表"><ChevronLeft size={12}/></button>
        </span>
      </div>
      {snaps.length === 0 ? (
        <div className="empty-hint" style={{ margin: 12 }}>暂无快照。系统每 25 步或 5 分钟自动存档；点书签按钮可手动保存当前版本。</div>
      ) : (
        snaps.map((s) => (
          <div key={s.id} className="project-row" onClick={() => restore(s)}>
            <div className="project-row-info">
              <div className="project-row-title">
                {s.label}
                <span className={`badge-active`} style={{
                  marginLeft: 8, fontSize: 9,
                  background: s.trigger === 'ai' ? '#A78BFA' : s.trigger === 'manual' ? '#10B981' : '#94A3B8',
                  color: '#fff',
                }}>
                  {s.trigger}
                </span>
              </div>
              <div className="project-row-meta">
                {s.deck.slides.length} 页 · {new Date(s.ts).toLocaleString()}
              </div>
            </div>
            <span style={{ display: 'inline-flex', gap: 2 }}>
              <button className="icon-btn xs" onClick={(e) => { e.stopPropagation(); restore(s); }} title="恢复"><RotateCcw size={11}/></button>
              <button className="icon-btn xs danger" onClick={(e) => { e.stopPropagation(); void remove(s.id); }} title="删除"><Trash2 size={11}/></button>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
