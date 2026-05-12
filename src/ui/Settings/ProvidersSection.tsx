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
import type { AIProvider, AIProtocol, AuthStyle, ProviderConfig, ProviderHealth, ProxyConfig } from '../../ai/types';
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
  const replaceAIConfig = useSettingsStore((s) => s.replaceAIConfig);
  const providerHealth = useSettingsStore((s) => s.providerHealth);
  const setProviderHealth = useSettingsStore((s) => s.setProviderHealth);
  const [expanded, setExpanded] = useState<string | null>(activeProvider);
  const [adding, setAdding] = useState<'claude-relay' | 'openai-relay' | null>(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  const officialEntries = Object.entries(providers).filter(([, c]) => isOfficialProvider(c.provider));
  const relayEntries = Object.entries(providers).filter(([, c]) => isRelayProvider(c.provider));

  const openJsonMode = useCallback(() => {
    setJsonText(JSON.stringify(toEditableAIConfig({ activeProvider, providers, proxyConfig: proxy }), null, 2));
    setJsonError('');
    setJsonMode(true);
  }, [activeProvider, providers, proxy]);

  const saveJsonConfig = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      const normalized = normalizeAIConfig(parsed);
      replaceAIConfig(normalized);
      setExpanded(normalized.activeProvider);
      setJsonError('');
      setJsonMode(false);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  }, [jsonText, replaceAIConfig]);

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
        <button className="btn-sm" onClick={openJsonMode}>JSON 编辑</button>
      </div>

      {jsonMode ? (
        <div className="json-config-editor">
          <div className="hint">支持完整配置 JSON，也支持直接粘贴 ccswitch / Claude Code 风格的 {`{ "env": { "ANTHROPIC_AUTH_TOKEN": "...", "ANTHROPIC_BASE_URL": "...", "ANTHROPIC_MODEL": "..." } }`}。JSON 中可能包含 API Key，请勿外传。</div>
          <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
          {jsonError && <div className="form-error">{jsonError}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn-sm" onClick={() => setJsonMode(false)}>取消</button>
            <button className="btn-sm btn-primary" onClick={saveJsonConfig}>保存并转回表单</button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </section>
  );
}

function mapHealth(r: { ok: boolean; latencyMs: number; errorMessage?: string; model?: string; endpoint?: string }): ProviderHealth {
  return {
    status: r.ok
      ? r.latencyMs < 1500 ? 'healthy' : r.latencyMs < 3000 ? 'slow' : 'degraded'
      : 'down',
    latencyMs: r.latencyMs,
    lastChecked: Date.now(),
    errorMessage: r.errorMessage ? `${r.errorMessage}${r.endpoint ? `\n测试地址：${r.endpoint}` : ''}` : undefined,
    model: r.model,
    endpoint: r.endpoint,
  };
}

function toEditableAIConfig(config: { activeProvider: string; providers: Record<string, ProviderConfig>; proxyConfig: ProxyConfig }) {
  const providers = Object.fromEntries(
    Object.entries(config.providers).map(([key, provider]) => [key, {
      ...provider,
      env: {
        ANTHROPIC_AUTH_TOKEN: provider.apiKey,
        ANTHROPIC_BASE_URL: provider.baseUrl,
        ANTHROPIC_MODEL: provider.model,
        ...(provider.maxTokens ? { ANTHROPIC_MAX_TOKENS: String(provider.maxTokens) } : {}),
      },
    }]),
  );
  return { ...config, providers };
}

function normalizeAIConfig(raw: any): { activeProvider: string; providers: Record<string, ProviderConfig>; proxyConfig: ProxyConfig } {
  if (!raw || typeof raw !== 'object') throw new Error('JSON 顶层必须是对象');

  if (raw.env && !raw.providers) {
    const provider = normalizeClaudeCodeEnvProvider(raw, 'relay');
    return {
      activeProvider: provider.key,
      providers: { [provider.key]: provider.config },
      proxyConfig: normalizeProxy(raw.proxyConfig),
    };
  }

  if (!raw.providers || typeof raw.providers !== 'object' || Array.isArray(raw.providers)) throw new Error('providers 必须是对象，或直接粘贴 ccswitch 风格 { "env": { ... } } 配置');
  const providers: Record<string, ProviderConfig> = {};
  for (const [key, value] of Object.entries(raw.providers)) {
    if (!value || typeof value !== 'object') throw new Error(`providers.${key} 必须是对象`);
      const normalized = (value as any).env
      ? normalizeClaudeCodeEnvProvider(value, key)
      : { key, config: normalizeProviderObject(value, key) };
    providers[normalized.key] = normalized.config;
  }
  const keys = Object.keys(providers);
  if (!keys.length) throw new Error('至少需要一个 provider');
  const activeProvider = typeof raw.activeProvider === 'string' && providers[raw.activeProvider]
    ? raw.activeProvider
    : keys[0];
  return { activeProvider, providers, proxyConfig: normalizeProxy(raw.proxyConfig) };
}

function normalizeProviderObject(value: any, key: string): ProviderConfig {
  const provider = value.provider;
  if (!provider) throw new Error(`providers.${key}.provider 必填`);
  const config: ProviderConfig = {
    provider,
    label: String(value.label ?? key),
    apiKey: String(value.apiKey ?? ''),
    baseUrl: String(value.baseUrl ?? ''),
    model: String(value.model ?? ''),
    protocol: value.protocol,
    authStyle: value.authStyle,
    temperature: typeof value.temperature === 'number' ? value.temperature : undefined,
    maxTokens: typeof value.maxTokens === 'number' ? value.maxTokens : undefined,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
  };
  validateProvider(config, `providers.${key}`);
  return config;
}

function normalizeClaudeCodeEnvProvider(raw: any, fallbackKey: string): { key: string; config: ProviderConfig } {
  const env = raw.env;
  if (!env || typeof env !== 'object' || Array.isArray(env)) throw new Error(`${fallbackKey}.env 必须是对象`);
  const baseUrl = envString(env, 'ANTHROPIC_BASE_URL');
  const apiKey = envString(env, 'ANTHROPIC_AUTH_TOKEN') || envString(env, 'ANTHROPIC_API_KEY');
  const model = envString(env, 'ANTHROPIC_MODEL') || envString(env, 'ANTHROPIC_DEFAULT_SONNET_MODEL');
  if (!baseUrl) throw new Error(`${fallbackKey}.env.ANTHROPIC_BASE_URL 必填`);
  if (!model) throw new Error(`${fallbackKey}.env.ANTHROPIC_MODEL 必填`);
  if (apiKey === '<API_KEY>') throw new Error(`${fallbackKey}.env.ANTHROPIC_AUTH_TOKEN 仍是占位符，请替换为真实 API Key`);
  if (baseUrl === '<BASE_URL>') throw new Error(`${fallbackKey}.env.ANTHROPIC_BASE_URL 仍是占位符，请替换为真实地址`);

  const protocol = normalizeProtocol(raw.protocol, inferProtocol(baseUrl));
  const authStyle = normalizeAuthStyle(raw.authStyle, protocol === 'openai' ? 'bearer' : 'x-api-key');
  const label = String(raw.name ?? raw.label ?? inferProviderLabel(baseUrl));
  const provider = protocol === 'openai' ? 'openai-relay' : 'claude-relay';
  const key = makeProviderKey(fallbackKey, label, baseUrl);
  const maxTokensText = envString(env, 'ANTHROPIC_MAX_TOKENS');
  const maxTokens = maxTokensText ? Number(maxTokensText) : undefined;
  const config: ProviderConfig = {
    provider,
    label,
    apiKey,
    baseUrl,
    model,
    protocol,
    authStyle,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
    temperature: typeof raw.temperature === 'number' ? raw.temperature : 0.7,
    enabled: raw.enabled !== false,
  };
  validateProvider(config, fallbackKey);
  return { key, config };
}

function validateProvider(config: ProviderConfig, path: string) {
  if (!config.baseUrl) throw new Error(`${path}.baseUrl 必填`);
  if (!config.model) throw new Error(`${path}.model 必填`);
  if (!['anthropic', 'openai', 'gemini'].includes(config.protocol)) throw new Error(`${path}.protocol 无效`);
  if (!['bearer', 'x-api-key', 'api-key-param'].includes(config.authStyle)) throw new Error(`${path}.authStyle 无效`);
}

function envString(env: Record<string, unknown>, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProtocol(value: unknown, fallback: AIProtocol): AIProtocol {
  return value === 'anthropic' || value === 'openai' || value === 'gemini' ? value : fallback;
}

function normalizeAuthStyle(value: unknown, fallback: AuthStyle): AuthStyle {
  return value === 'bearer' || value === 'x-api-key' || value === 'api-key-param' ? value : fallback;
}

function inferProtocol(baseUrl: string): AIProtocol {
  const lower = baseUrl.toLowerCase();
  if (lower.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (lower.includes('openai.com') || lower.includes('deepseek.com') || lower.includes('dashscope.aliyuncs.com') || lower.includes('volces.com')) return 'openai';
  return 'anthropic';
}

function inferProviderLabel(baseUrl: string): string {
  const lower = baseUrl.toLowerCase();
  if (lower.includes('anthropic.com')) return 'Anthropic Claude';
  if (lower.includes('openai.com')) return 'OpenAI 中转站';
  if (lower.includes('deepseek.com')) return 'DeepSeek';
  if (lower.includes('bigmodel.cn')) return 'GLM 中转站';
  if (lower.includes('moonshot.cn') || lower.includes('moonshot.ai')) return 'Kimi 中转站';
  if (lower.includes('minimaxi.com')) return 'MiniMax 中转站';
  if (lower.includes('dashscope.aliyuncs.com')) return 'Qwen 中转站';
  return 'Claude 中转站';
}

function makeProviderKey(fallbackKey: string, label: string, baseUrl: string): string {
  if (fallbackKey && fallbackKey !== 'relay') return fallbackKey;
  let host = label || 'relay';
  try { host = new URL(baseUrl).hostname; } catch {}
  return `relay_${host.replace(/[^a-z0-9]+/gi, '_')}_${Date.now().toString(36)}`;
}

function normalizeProxy(raw: any): ProxyConfig {
  if (!raw || typeof raw !== 'object') return { enabled: false, mode: 'system' };
  const mode = ['system', 'http', 'socks5', 'pac'].includes(raw.mode) ? raw.mode : 'system';
  return {
    enabled: !!raw.enabled,
    mode,
    host: typeof raw.host === 'string' ? raw.host : undefined,
    port: typeof raw.port === 'number' ? raw.port : undefined,
    username: typeof raw.username === 'string' ? raw.username : undefined,
    password: typeof raw.password === 'string' ? raw.password : undefined,
    pacUrl: typeof raw.pacUrl === 'string' ? raw.pacUrl : undefined,
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
