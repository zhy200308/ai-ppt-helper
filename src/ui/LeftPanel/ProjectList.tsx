import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, FilePlus2 } from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import { listDecks, deleteDeckById, setMeta } from '../../core/persistence/db';
import type { Deck } from '../../core/schema/types';

export function ProjectList({ onClose }: { onClose: () => void }) {
  const activeId = useDeckStore((s) => s.deck.meta.id);
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const newDeck = useDeckStore((s) => s.newDeck);
  const [decks, setDecks] = useState<Deck[]>([]);

  const refresh = useCallback(async () => {
    const all = await listDecks();
    setDecks(all);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const pick = async (deck: Deck) => {
    loadDeck(deck);
    await setMeta('last-deck-id', deck.meta.id);
    onClose();
  };

  const remove = async (id: string) => {
    if (id === activeId && decks.length === 1) return; // never delete the only one
    await deleteDeckById(id);
    await refresh();
  };

  const create = () => {
    newDeck('Untitled Presentation');
    onClose();
  };

  return (
    <div className="project-list-overlay">
      <div className="project-list-header">
        <span><FilePlus2 size={12}/> 项目历史 ({decks.length})</span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <button className="icon-btn xs" onClick={create} title="新建项目"><Plus size={12}/></button>
          <button className="icon-btn xs" onClick={onClose} title="返回幻灯片列表"><ChevronLeft size={12}/></button>
        </span>
      </div>
      {decks.length === 0 ? (
        <div className="empty-hint" style={{ margin: 12 }}>暂无项目，点击 + 创建</div>
      ) : (
        decks.map((d) => (
          <div
            key={d.meta.id}
            className={`project-row ${d.meta.id === activeId ? 'active' : ''}`}
            onClick={() => pick(d)}
          >
            <div className="project-row-info">
              <div className="project-row-title">{d.meta.title || '未命名项目'}</div>
              <div className="project-row-meta">
                {d.slides.length} 页 · {new Date(d.meta.updatedAt).toLocaleString()}
              </div>
            </div>
            <button
              className="icon-btn xs danger"
              onClick={(e) => { e.stopPropagation(); remove(d.meta.id); }}
              title="删除"
              disabled={d.meta.id === activeId && decks.length === 1}
            >
              <Trash2 size={11}/>
            </button>
          </div>
        ))
      )}
    </div>
  );
}
