import { useSettingsStore } from '../../core/store/settings';
import { useDeckStore } from '../../core/store/deck';
import { Trash2, Plus } from 'lucide-react';
import { DEFAULT_THEME } from '../../core/schema/factory';
import type { ImportedTheme } from '../../core/store/settings';

const PRESETS: ImportedTheme[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    primaryColor: '#4F46E5',
    accentColor: '#06B6D4',
    backgroundColor: '#FFFFFF',
    textColor: '#0F172A',
    mutedColor: '#64748B',
    fontFamilyHeading: DEFAULT_THEME.fontFamilyHeading,
    fontFamilyBody: DEFAULT_THEME.fontFamilyBody,
    source: 'manual',
    importedAt: 0,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    primaryColor: '#F97316',
    accentColor: '#EC4899',
    backgroundColor: '#FFFBEB',
    textColor: '#1F2937',
    mutedColor: '#92400E',
    fontFamilyHeading: 'Georgia, serif',
    fontFamilyBody: 'Inter, sans-serif',
    source: 'manual',
    importedAt: 0,
  },
  {
    id: 'forest',
    name: 'Forest',
    primaryColor: '#059669',
    accentColor: '#84CC16',
    backgroundColor: '#F0FDF4',
    textColor: '#064E3B',
    mutedColor: '#065F46',
    fontFamilyHeading: DEFAULT_THEME.fontFamilyHeading,
    fontFamilyBody: DEFAULT_THEME.fontFamilyBody,
    source: 'manual',
    importedAt: 0,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    primaryColor: '#A78BFA',
    accentColor: '#22D3EE',
    backgroundColor: '#0B1220',
    textColor: '#F1F5F9',
    mutedColor: '#94A3B8',
    fontFamilyHeading: DEFAULT_THEME.fontFamilyHeading,
    fontFamilyBody: DEFAULT_THEME.fontFamilyBody,
    source: 'manual',
    importedAt: 0,
  },
];

export function ThemesSection() {
  const customThemes = useSettingsStore((s) => s.customThemes);
  const activeId = useSettingsStore((s) => s.activeThemeId);
  const setActive = useSettingsStore((s) => s.setActiveTheme);
  const remove = useSettingsStore((s) => s.removeTheme);
  const setTheme = useDeckStore((s) => s.setTheme);

  const apply = (t: ImportedTheme) => {
    setActive(t.id);
    setTheme({
      name: t.name,
      primaryColor: t.primaryColor,
      accentColor: t.accentColor,
      backgroundColor: t.backgroundColor,
      textColor: t.textColor,
      mutedColor: t.mutedColor,
      fontFamilyHeading: t.fontFamilyHeading,
      fontFamilyBody: t.fontFamilyBody,
    });
  };

  return (
    <section className="settings-content">
      <h3>主题模板</h3>
      <p className="hint">主题决定颜色、字体与排版基调。AI 在生成 PPT 时会自动遵循当前主题。</p>

      <div className="provider-group-label">内置主题</div>
      <div className="theme-grid">
        {PRESETS.map((t) => (
          <ThemeCard key={t.id} theme={t} active={activeId === t.id} onApply={() => apply(t)} />
        ))}
      </div>

      <div className="provider-group-label" style={{ marginTop: 18 }}>
        自定义主题 <span style={{ color: '#94A3B8', fontSize: 12 }}>（{Object.keys(customThemes).length}）</span>
      </div>
      {Object.keys(customThemes).length === 0 ? (
        <div className="empty-hint">
          通过对话向 AI 描述风格（"科技蓝灰，无衬线，主色 #4F46E5"），AI 会创建并保存自定义主题。
        </div>
      ) : (
        <div className="theme-grid">
          {Object.values(customThemes).map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              active={activeId === t.id}
              onApply={() => apply(t)}
              onRemove={() => remove(t.id)}
            />
          ))}
        </div>
      )}

      <p className="hint" style={{ marginTop: 16 }}>
        <Plus size={11}/> 提示: PPTX 主题导入与 Brand Templates 整合 (Canva) 由桌面端 sidecar 提供，浏览器环境暂用预设/AI 生成。
      </p>
    </section>
  );
}

function ThemeCard({
  theme, active, onApply, onRemove,
}: { theme: ImportedTheme; active: boolean; onApply: () => void; onRemove?: () => void }) {
  return (
    <div className={`theme-card ${active ? 'active' : ''}`} onClick={onApply}>
      <div className="theme-preview" style={{ background: theme.backgroundColor }}>
        <div style={{
          height: '70%',
          background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
        }}/>
        <div style={{
          fontFamily: theme.fontFamilyHeading,
          color: theme.textColor,
          padding: '6px 8px',
          fontSize: 14,
          fontWeight: 600,
        }}>{theme.name}</div>
      </div>
      <div className="theme-meta">
        <span style={{ background: theme.primaryColor }}/>
        <span style={{ background: theme.accentColor }}/>
        <span style={{ background: theme.textColor }}/>
        {onRemove && (
          <button
            className="icon-btn xs danger"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <Trash2 size={10}/>
          </button>
        )}
      </div>
    </div>
  );
}
