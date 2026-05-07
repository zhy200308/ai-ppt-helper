import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ProviderConfig,
  ProviderHealth,
  ProxyConfig,
} from '../../ai/types';
import { DEFAULT_PROVIDERS } from '../../ai/types';

export interface SettingsState {
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
  providerHealth: Record<string, ProviderHealth>;
  proxyConfig: ProxyConfig;

  // theme registry — keyed by id
  customThemes: Record<string, ImportedTheme>;
  activeThemeId: string | null;
}

export interface ImportedTheme {
  id: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
  fontFamilyHeading: string;
  fontFamilyBody: string;
  source: 'pptx' | 'zip' | 'manual';
  importedAt: number;
}

export interface SettingsActions {
  setActiveProvider: (k: string) => void;
  updateProvider: (k: string, patch: Partial<ProviderConfig>) => void;
  addProvider: (k: string, config: ProviderConfig) => void;
  removeProvider: (k: string) => void;
  setProviderHealth: (k: string, h: ProviderHealth) => void;
  setProxyConfig: (c: ProxyConfig) => void;

  addTheme: (theme: ImportedTheme) => void;
  removeTheme: (id: string) => void;
  setActiveTheme: (id: string | null) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      activeProvider: 'anthropic',
      providers: { ...DEFAULT_PROVIDERS },
      providerHealth: {},
      proxyConfig: { enabled: false, mode: 'system' },
      customThemes: {},
      activeThemeId: null,

      setActiveProvider: (k) => set({ activeProvider: k }),
      updateProvider: (k, patch) =>
        set((s) => ({ providers: { ...s.providers, [k]: { ...s.providers[k], ...patch } } })),
      addProvider: (k, config) => set((s) => ({ providers: { ...s.providers, [k]: config } })),
      removeProvider: (k) =>
        set((s) => {
          const next = { ...s.providers };
          delete next[k];
          const nextHealth = { ...s.providerHealth };
          delete nextHealth[k];
          const nextActive = s.activeProvider === k ? Object.keys(next)[0] ?? '' : s.activeProvider;
          return { providers: next, providerHealth: nextHealth, activeProvider: nextActive };
        }),
      setProviderHealth: (k, h) =>
        set((s) => ({ providerHealth: { ...s.providerHealth, [k]: h } })),
      setProxyConfig: (c) => set({ proxyConfig: c }),

      addTheme: (theme) =>
        set((s) => ({ customThemes: { ...s.customThemes, [theme.id]: theme } })),
      removeTheme: (id) =>
        set((s) => {
          const next = { ...s.customThemes };
          delete next[id];
          return {
            customThemes: next,
            activeThemeId: s.activeThemeId === id ? null : s.activeThemeId,
          };
        }),
      setActiveTheme: (id) => set({ activeThemeId: id }),
    }),
    {
      name: 'ai-ppt-settings',
      version: 1,
      // do not persist transient health.
      partialize: (s) => ({
        activeProvider: s.activeProvider,
        providers: s.providers,
        proxyConfig: s.proxyConfig,
        customThemes: s.customThemes,
        activeThemeId: s.activeThemeId,
      }),
    },
  ),
);
