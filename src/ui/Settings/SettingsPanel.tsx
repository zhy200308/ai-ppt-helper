import { useEffect, useState } from 'react';
import { X, Server, Globe, Paintbrush } from 'lucide-react';
import { useSettingsStore } from '../../core/store/settings';
import { ProvidersSection } from './ProvidersSection';
import { ProxySection } from './ProxySection';
import { ThemesSection } from './ThemesSection';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'providers' | 'proxy' | 'themes';

export function SettingsPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('providers');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Subscribe to ensure the persist middleware is hydrated (no-op render).
  useSettingsStore((s) => s.activeProvider);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>设置</h2>
          <button className="icon-btn" onClick={onClose}><X size={16}/></button>
        </header>
        <div className="settings-body">
          <nav className="settings-nav">
            <button className={tab === 'providers' ? 'active' : ''} onClick={() => setTab('providers')}>
              <Server size={14}/> AI 服务
            </button>
            <button className={tab === 'themes' ? 'active' : ''} onClick={() => setTab('themes')}>
              <Paintbrush size={14}/> 主题模板
            </button>
            <button className={tab === 'proxy' ? 'active' : ''} onClick={() => setTab('proxy')}>
              <Globe size={14}/> 网络代理
            </button>
          </nav>
          <main className="settings-main">
            {tab === 'providers' && <ProvidersSection />}
            {tab === 'themes' && <ThemesSection />}
            {tab === 'proxy' && <ProxySection />}
          </main>
        </div>
      </div>
    </div>
  );
}
