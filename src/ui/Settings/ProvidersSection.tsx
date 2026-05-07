import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Trash2, RefreshCw, Loader2, Eye, EyeOff, Lock, Wifi, ChevronRight,
} from 'lucide-react';
import { useSettingsStore } from '../../core/store/settings';
import {
  isFieldEditable,
  isOfficialProvider,
  isRelayProvider,
  RELAY_TEMPLATES,
} from '../../ai/types';
import type { AIProvider, ProviderConfig, ProviderHealth } from '../../ai/types';
import { AIService } from '../../ai/service';
import { useBackdropClose } from '../components/useBackdropClose';

export function ProvidersSection() {
  const providers = useSettingsStore((s) => s.providers);
  const proxy = useSettingsStore((s) => s.proxyConfig);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const setActiveProvider = useSettingsStore((s) => s.setActiveProvider);
  const updateProvider = useSettingsStore((s) => s.updateProvider);
  const removeProvider = useSettingsStore((s) => s.removeProvider);
  const addProvider = useSettingsStore((s) => s.addProvider);
  const providerHealth = useSettingsStore((s) => s.providerHealth);
  const setProviderHealth = useSettingsStore((s) => s.setProviderHealth);
  const [expanded, setExpanded] = useState<string | null>(activeProvider);
  const [adding, setAdding] = useState<'claude-relay' | 'openai-relay' | null>(null);

  const officialEntries = Object.entries(providers).filter(([, c]) => isOfficialProvider(c.provider));
  const relayEntries = Object.entries(providers).filter(([, c]) => isRelayProvider(c.provider));

  // Auto-test the active provider periodically
  useEffect(() => {
    const cfg = providers[activeProvider];
    if (!cfg?.apiKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const svc = new AIService(cfg, proxy);
      const r = await svc.testConnection();
      if (cancelled) return;
      setProviderHealth(activeProvider, mapHealth(r));
    };
    timer = setTimeout(run, 600);
    const i = setInterval(run, 120_000);
    return () => { cancelled = true; clearTimeout(timer); clearInterval(i); };
  }, [activeProvider, providers, proxy, setProviderHealth]);

  return (
    <section className="settings-content">
      <div className="settings-row">
        <h3>AI 服务配置</h3>
      </div>

      <div className="provider-group-label">官方服务</div>
      <div className="provider-list">
        {officialEntries.map(([key, cfg]) => (
          <ProviderCard
            key={key}
            providerKey={key}
            config={cfg}
            health={providerHealth[key]}
            isActive={key === activeProvider}
            isExpanded={expanded === key}
            onToggle={() => setExpanded(expanded === key ? null : key)}
            onSetActive={() => setActiveProvider(key)}
            onUpdate={(patch) => updateProvider(key, patch)}
            onRemove={undefined}
            onTest={async () => {
              setProviderHealth(key, { status: 'unknown', latencyMs: null, lastChecked: Date.now() });
              const r = await new AIService(cfg, proxy).testConnection();
              setProviderHealth(key, mapHealth(r));
            }}
          />
        ))}
      </div>

      <div className="provider-group-label" style={{ marginTop: 18 }}>
        中转站
        <span className="provider-group-actions">
          <button className="btn-sm" onClick={() => setAdding('claude-relay')}>
            <Plus size={11}/> Claude 中转
          </button>
          <button className="btn-sm" onClick={() => setAdding('openai-relay')}>
            <Plus size={11}/> OpenAI 中转
          </button>
        </span>
      </div>
      <div className="provider-list">
        {relayEntries.length === 0 && (
          <div className="empty-hint">点击上方按钮添加中转站</div>
        )}
        {relayEntries.map(([key, cfg]) => (
          <ProviderCard
            key={key}
            providerKey={key}
            config={cfg}
            health={providerHealth[key]}
            isActive={key === activeProvider}
            isExpanded={expanded === key}
            onToggle={() => setExpanded(expanded === key ? null : key)}
            onSetActive={() => setActiveProvider(key)}
            onUpdate={(patch) => updateProvider(key, patch)}
            onRemove={() => removeProvider(key)}
            onTest={async () => {
              setProviderHealth(key, { status: 'unknown', latencyMs: null, lastChecked: Date.now() });
              const r = await new AIService(cfg, proxy).testConnection();
              setProviderHealth(key, mapHealth(r));
            }}
          />
        ))}
      </div>

      {adding && (
        <AddRelayDialog
          kind={adding}
          onClose={() => setAdding(null)}
          onAdd={(key, cfg) => {
            addProvider(key, cfg);
            setActiveProvider(key);
            setAdding(null);
          }}
        />
      )}
    </section>
  );
}

function mapHealth(r: { ok: boolean; latencyMs: number; errorMessage?: string; model?: string }): ProviderHealth {
  return {
    status: r.ok
      ? r.latencyMs < 1500 ? 'healthy' : r.latencyMs < 3000 ? 'slow' : 'degraded'
      : 'down',
    latencyMs: r.latencyMs,
    lastChecked: Date.now(),
    errorMessage: r.errorMessage,
    model: r.model,
  };
}

function ProviderCard({
  config, health, isActive, isExpanded, onToggle, onSetActive, onUpdate, onRemove, onTest,
}: {
  providerKey: string;
  config: ProviderConfig;
  health?: ProviderHealth;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSetActive: () => void;
  onUpdate: (p: Partial<ProviderConfig>) => void;
  onRemove?: () => void;
  onTest: () => Promise<void>;
}) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const canUrl = isFieldEditable(config.provider, 'baseUrl');
  const canAuth = isFieldEditable(config.provider, 'authStyle');

  return (
    <div className={`provider-card ${isActive ? 'active' : ''}`}>
      <div className="provider-header" onClick={onToggle}>
        <div className="provider-info">
          <span className="provider-name">{config.label}</span>
          {!canUrl && <Lock size={9}/>}
          {isActive && <span className="badge-active">当前</span>}
          {health && <HealthDot h={health}/>}
          {config.apiKey && !health && <Wifi size={11}/>}
        </div>
        <ChevronRight size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : '', transition: 'transform .2s' }}/>
      </div>
      {isExpanded && (
        <div className="provider-body">
          <Field label="API Key">
            <div className="input-with-icon">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => onUpdate({ apiKey: e.target.value })}
                placeholder="sk-..."
              />
              <button className="icon-btn" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff size={12}/> : <Eye size={12}/>}
              </button>
            </div>
          </Field>
          <Field label={<>Base URL {!canUrl && <Lock size={10}/>}</>}>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => canUrl && onUpdate({ baseUrl: e.target.value })}
              disabled={!canUrl}
            />
          </Field>
          <Field label="模型">
            <input value={config.model} onChange={(e) => onUpdate({ model: e.target.value })}/>
          </Field>
          <Field label={<>鉴权方式 {!canAuth && <Lock size={10}/>}</>}>
            <select
              value={config.authStyle}
              onChange={(e) => canAuth && onUpdate({ authStyle: e.target.value as any })}
              disabled={!canAuth}
            >
              <option value="x-api-key">x-api-key (Anthropic / lanyiapi)</option>
              <option value="bearer">Bearer (OpenAI / AnyRouter)</option>
              <option value="api-key-param">URL 参数 (Gemini)</option>
            </select>
          </Field>
          <div className="row">
            <Field label="温度" inline>
              <input
                type="number" min="0" max="2" step="0.1"
                value={config.temperature ?? 0.7}
                onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
              />
            </Field>
            <Field label="最大 Tokens" inline>
              <input
                type="number" min="1" max="200000" step="100"
                value={config.maxTokens ?? ''}
                onChange={(e) =>
                  onUpdate({ maxTokens: e.target.value ? parseInt(e.target.value, 10) : undefined })
                }
                placeholder="不限制"
              />
            </Field>
          </div>
          {health?.status === 'down' && health.errorMessage && (
            <div className="form-error">{health.errorMessage}</div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            {!isActive && <button className="btn-sm btn-primary" onClick={onSetActive}>设为默认</button>}
            <button
              className="btn-sm"
              disabled={testing || !config.apiKey}
              onClick={async () => {
                setTesting(true);
                await onTest();
                setTesting(false);
              }}
            >
              {testing ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} 测试连接
            </button>
            {onRemove && (
              <button className="btn-sm btn-danger" onClick={onRemove}>
                <Trash2 size={11}/> 删除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthDot({ h }: { h: ProviderHealth }) {
  const color =
    h.status === 'healthy' ? '#10B981' :
    h.status === 'slow' ? '#F59E0B' :
    h.status === 'degraded' ? '#F97316' :
    h.status === 'down' ? '#EF4444' : '#94A3B8';
  return (
    <span title={`${h.status} ${h.latencyMs ?? ''}ms`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }}/>
      {h.latencyMs != null ? `${h.latencyMs}ms` : ''}
    </span>
  );
}

function Field({ label, children, inline }: { label: React.ReactNode; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={`field ${inline ? 'inline' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function AddRelayDialog({
  kind, onClose, onAdd,
}: { kind: 'claude-relay' | 'openai-relay'; onClose: () => void; onAdd: (key: string, cfg: ProviderConfig) => void }) {
  const tpl = RELAY_TEMPLATES[kind];
  const [label, setLabel] = useState(tpl.label ?? '');
  const [baseUrl, setBaseUrl] = useState(tpl.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(tpl.model ?? '');
  const [authStyle, setAuthStyle] = useState(tpl.authStyle ?? 'x-api-key');
  const guard = useBackdropClose(onClose);

  const submit = useCallback(() => {
    if (!baseUrl || !apiKey) return;
    let host = 'relay';
    try { host = new URL(baseUrl).hostname.replace(/\./g, '_'); } catch {}
    const key = `${kind}_${host}_${Date.now().toString(36)}`;
    onAdd(key, {
      provider: kind as AIProvider,
      label: label || tpl.label!,
      apiKey,
      baseUrl,
      model,
      protocol: tpl.protocol!,
      authStyle,
      temperature: 0.7,
      enabled: true,
    });
  }, [kind, baseUrl, apiKey, label, model, authStyle, onAdd, tpl]);

  return (
    <div className="modal-backdrop" {...guard}>
      <div className="dialog" onPointerDown={(e) => e.stopPropagation()}>
        <header><h3>添加 {tpl.label}</h3></header>
        <div className="dialog-body">
          <p className="hint">{tpl.description}</p>
          <Field label="名称"><input value={label} onChange={(e) => setLabel(e.target.value)}/></Field>
          <Field label="Base URL">
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..."/>
          </Field>
          <Field label="API Key">
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..."/>
          </Field>
          <Field label="模型"><input value={model} onChange={(e) => setModel(e.target.value)}/></Field>
          {kind === 'claude-relay' && (
            <Field label="鉴权方式">
              <select value={authStyle} onChange={(e) => setAuthStyle(e.target.value as any)}>
                <option value="x-api-key">x-api-key</option>
                <option value="bearer">Bearer</option>
              </select>
            </Field>
          )}
        </div>
        <footer className="dialog-footer">
          <button className="btn-sm" onClick={onClose}>取消</button>
          <button className="btn-sm btn-primary" onClick={submit} disabled={!baseUrl || !apiKey}>
            <Plus size={12}/> 添加
          </button>
        </footer>
      </div>
    </div>
  );
}
