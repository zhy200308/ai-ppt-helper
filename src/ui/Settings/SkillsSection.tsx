import { useCallback, useEffect, useState } from 'react';
import { Upload, Trash2, RefreshCw, Wrench } from 'lucide-react';
import {
  importSkillFromMarkdown, importSkillFromZip, saveUserSkill, deleteUserSkill,
  loadAllSkills, type SkillPackage,
} from '../../skills';

export function SkillsSection() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillPackage[]>([]);

  const refresh = useCallback(async () => {
    setErr(null);
    setSkills(await loadAllSkills());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleZip = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      await saveUserSkill(await importSkillFromZip(f));
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const handleMd = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      await saveUserSkill(await importSkillFromMarkdown(f));
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const toggle = async (s: SkillPackage, enabled: boolean) => {
    if (s.meta.source !== 'user') return;
    setBusy(true);
    try {
      await saveUserSkill({ ...s, enabled, meta: { ...s.meta, updatedAt: Date.now() } });
      await refresh();
    } finally { setBusy(false); }
  };

  const remove = async (name: string) => {
    setBusy(true);
    try {
      await deleteUserSkill(name);
      await refresh();
    } finally { setBusy(false); }
  };

  return (
    <section className="settings-content">
      <h3><Wrench size={14}/> 技能 (slash commands)</h3>
      <p className="hint">
        在对话框里输入 <code>/skill-name 你的指令</code> 调用对应技能。
        每个技能等同一段额外的 system prompt，会与当前会话拼接。
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="btn-sm btn-primary">
          <Upload size={11}/> 导入 zip
          <input type="file" accept=".zip,application/zip" disabled={busy}
            style={{ display: 'none' }}
            onChange={(e) => void handleZip(e.target.files?.[0])}/>
        </label>
        <label className="btn-sm">
          <Upload size={11}/> 导入 md
          <input type="file" accept=".md,text/markdown" disabled={busy}
            style={{ display: 'none' }}
            onChange={(e) => void handleMd(e.target.files?.[0])}/>
        </label>
        <button className="btn-sm" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw size={11}/> 刷新
        </button>
      </div>
      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="provider-list">
        {skills.length === 0 ? (
          <div className="empty-hint">暂无技能</div>
        ) : (
          skills.map((s) => (
            <div key={s.meta.name} className="provider-card">
              <div className="provider-header" style={{ cursor: 'default' }}>
                <div className="provider-info">
                  <span className="provider-name">{s.meta.title}</span>
                  <span className="badge-active" style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)' }}>
                    {s.meta.source}
                  </span>
                  <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>/{s.meta.name}</code>
                </div>
              </div>
              <div className="provider-body">
                {s.meta.description && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>{s.meta.description}</div>
                )}
                <div className="row">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => void toggle(s, e.target.checked)}
                      disabled={busy || s.meta.source !== 'user'}
                    />
                    启用
                  </label>
                  {s.meta.source === 'user' && (
                    <button className="btn-sm btn-danger" onClick={() => void remove(s.meta.name)} disabled={busy}>
                      <Trash2 size={11}/> 删除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
