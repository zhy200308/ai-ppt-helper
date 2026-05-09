import { useState } from 'react';
import { Database, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDeckStore } from '../../core/store/deck';
import { createDataTable } from '../../core/schema/factory';

// Spreadsheet-lite editor for deck-level data tables. Charts and tables
// with `dataRef` pull live from these. Embedded into the right pane via
// a button when no block is selected.
export function DataTablesPanel({ onClose }: { onClose: () => void }) {
  const tables = useDeckStore((s) => s.deck.dataTables ?? {});
  const upsert = useDeckStore((s) => s.upsertDataTable);
  const remove = useDeckStore((s) => s.removeDataTable);
  const setName = useDeckStore((s) => s.setDataTableName);
  const setCell = useDeckStore((s) => s.setDataTableCell);
  const addRow = useDeckStore((s) => s.addDataTableRow);
  const removeRow = useDeckStore((s) => s.removeDataTableRow);
  const addColumn = useDeckStore((s) => s.addDataTableColumn);
  const removeColumn = useDeckStore((s) => s.removeDataTableColumn);
  const ids = Object.keys(tables);
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const t = activeId ? tables[activeId] : null;

  const create = () => {
    const tbl = createDataTable();
    upsert(tbl);
    setActiveId(tbl.id);
  };

  const removeT = (id: string) => {
    if (!window.confirm('删除此数据表？关联的图表/表格会回退到内联数据。')) return;
    remove(id);
    if (activeId === id) {
      const remaining = Object.keys(tables).filter((x) => x !== id);
      setActiveId(remaining[0] ?? null);
    }
  };

  return (
    <div className="dt-panel">
      <header className="dt-header">
        <button className="icon-btn xs" onClick={onClose} title="返回属性"><ChevronLeft size={12}/></button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
          <Database size={12}/> 数据表 ({ids.length})
        </span>
        <button className="icon-btn xs" onClick={create} title="新建数据表"><Plus size={12}/></button>
      </header>

      <div className="dt-list">
        {ids.length === 0 && <div className="empty-hint">还没有数据表 — 点 +</div>}
        {ids.map((id) => (
          <div
            key={id}
            className={`dt-row ${activeId === id ? 'active' : ''}`}
            onClick={() => setActiveId(id)}
          >
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tables[id].name} · {tables[id].rows.length}×{tables[id].columns.length}
            </div>
            <button className="icon-btn xs danger" onClick={(e) => { e.stopPropagation(); removeT(id); }}>
              <Trash2 size={11}/>
            </button>
          </div>
        ))}
      </div>

      {t && (
        <div className="dt-editor">
          <input
            className="dt-name"
            value={t.name}
            onChange={(e) => setName(t.id, e.target.value)}
          />
          <code className="dt-id">id: {t.id}</code>
          <div className="dt-grid-wrap">
            <table className="dt-grid">
              <thead>
                <tr>
                  <th className="dt-rownum"/>
                  {t.columns.map((c) => (
                    <th key={c.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{c.label}</span>
                        <span style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase' }}>{c.type}</span>
                        <button
                          className="icon-btn xs danger"
                          onClick={() => removeColumn(t.id, c.key)}
                          title={`删除列 ${c.label}`}
                        >
                          <Trash2 size={9}/>
                        </button>
                      </div>
                      <div style={{ fontSize: 9, color: '#94A3B8' }}>{c.key}</div>
                    </th>
                  ))}
                  <th className="dt-addcol">
                    <button
                      className="btn-sm"
                      onClick={() => {
                        const label = window.prompt('新列名');
                        if (!label) return;
                        const key = label.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 24) || 'col';
                        const type = window.prompt('类型 (string / number / date)', 'string') as 'string' | 'number' | 'date';
                        addColumn(t.id, { key, label, type: type === 'number' || type === 'date' ? type : 'string' });
                      }}
                      title="添加列"
                      style={{ width: '100%' }}
                    >
                      <Plus size={10}/> 列
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className="dt-rownum">
                      {ri + 1}
                      <button
                        className="icon-btn xs danger"
                        onClick={() => removeRow(t.id, ri)}
                        title="删除行"
                      >
                        <Trash2 size={9}/>
                      </button>
                    </td>
                    {t.columns.map((c) => {
                      const v = row[c.key];
                      return (
                        <td key={c.key}>
                          <input
                            value={String(v ?? '')}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next: string | number = c.type === 'number' && raw !== ''
                                ? (Number.isFinite(parseFloat(raw)) ? parseFloat(raw) : 0)
                                : raw;
                              setCell(t.id, ri, c.key, next);
                            }}
                            type={c.type === 'number' ? 'number' : 'text'}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td colSpan={t.columns.length + 2}>
                    <button className="btn-sm" onClick={() => addRow(t.id)}>
                      <Plus size={10}/> 行
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="dt-hint">
            <ChevronRight size={10}/> 选中图表 / 表格 block 可在属性中绑定到此表
          </p>
        </div>
      )}
    </div>
  );
}
