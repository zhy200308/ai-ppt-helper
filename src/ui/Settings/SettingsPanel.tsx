import { useEffect, useState } from 'react';
import { X, Server, Globe, Paintbrush, Wrench } from 'lucide-react';
import { useSettingsStore } from '../../core/store/settings';
import { ProvidersSection } from './ProvidersSection';
import { ProxySection } from './ProxySection';
import { ThemesSection } from './ThemesSection';
import { SkillsSection } from './SkillsSection';
import { useBackdropClose } from '../components/useBackdropClose';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'providers' | 'proxy' | 'themes' | 'skills';

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
  const guard = useBackdropClose(onClose);

  if (!open) return null;
  return (
    <div className="modal-backdrop" {...guard}>
      <div className="settings-modal" onPointerDown={(e) => e.stopPropagation()}>
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
            <button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>
              <Wrench size={14}/> 技能
            </button>
            <button className={tab === 'proxy' ? 'active' : ''} onClick={() => setTab('proxy')}>
              <Globe size={14}/> 网络代理
            </button>
          </nav>
          <main className="settings-main">
            {tab === 'providers' && <ProvidersSection />}
            {tab === 'themes' && <ThemesSection />}
            {tab === 'skills' && <SkillsSection />}
            {tab === 'proxy' && <ProxySection />}
          </main>
        </div>
      </div>
    </div>
  );
}
