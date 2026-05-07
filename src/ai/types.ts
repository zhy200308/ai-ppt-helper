// AI provider types — modeled after the uploaded settings file but trimmed for
// the web build. Extend with additional providers as protocols are added.

export type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'qwen'
  | 'doubao'
  | 'claude-relay'
  | 'openai-relay';

export type AIProtocol = 'anthropic' | 'openai' | 'gemini';

export type AuthStyle = 'bearer' | 'x-api-key' | 'api-key-param';

export interface ProviderConfig {
  provider: AIProvider;
  label: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  protocol: AIProtocol;
  authStyle: AuthStyle;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
}

export interface ProviderHealth {
  status: 'healthy' | 'slow' | 'degraded' | 'down' | 'unknown';
  latencyMs: number | null;
  lastChecked: number;
  errorMessage?: string;
  model?: string;
}

export interface ProxyConfig {
  enabled: boolean;
  mode: 'system' | 'http' | 'socks5' | 'pac';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  pacUrl?: string;
}

export const OFFICIAL_PROVIDERS: AIProvider[] = [
  'anthropic',
  'openai',
  'gemini',
  'deepseek',
  'qwen',
  'doubao',
];

export const RELAY_PROVIDERS: AIProvider[] = ['claude-relay', 'openai-relay'];

export function isOfficialProvider(p: AIProvider) {
  return OFFICIAL_PROVIDERS.includes(p);
}

export function isRelayProvider(p: AIProvider) {
  return RELAY_PROVIDERS.includes(p);
}

export function isFieldEditable(provider: AIProvider, _field: 'baseUrl' | 'authStyle' | 'protocol'): boolean {
  if (isRelayProvider(provider)) return true;
  return false;
}

export const RELAY_TEMPLATES: Record<
  'claude-relay' | 'openai-relay',
  Partial<ProviderConfig> & { description?: string }
> = {
  'claude-relay': {
    label: 'Claude 中转站',
    baseUrl: 'https://lanyiapi.com',
    model: 'claude-sonnet-4-5-20250929',
    protocol: 'anthropic',
    authStyle: 'x-api-key',
    description: '兼容 Anthropic 协议的中转站 (lanyiapi / AnyRouter / Claude Code 等)',
  },
  'openai-relay': {
    label: 'OpenAI 中转站',
    baseUrl: 'https://your-relay.com/v1',
    model: 'gpt-4o',
    protocol: 'openai',
    authStyle: 'bearer',
    description: '兼容 OpenAI Chat Completions 协议的中转站',
  },
};

export const DEFAULT_PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5-20250929',
    protocol: 'anthropic',
    authStyle: 'x-api-key',
    temperature: 0.7,
    enabled: true,
  },
  openai: {
    provider: 'openai',
    label: 'OpenAI',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    protocol: 'openai',
    authStyle: 'bearer',
    temperature: 0.7,
    enabled: true,
  },
  gemini: {
    provider: 'gemini',
    label: 'Google Gemini',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
    protocol: 'gemini',
    authStyle: 'api-key-param',
    temperature: 0.7,
    enabled: true,
  },
  deepseek: {
    provider: 'deepseek',
    label: 'DeepSeek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    protocol: 'openai',
    authStyle: 'bearer',
    temperature: 0.7,
    enabled: true,
  },
};
