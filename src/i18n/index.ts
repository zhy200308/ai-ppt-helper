// Minimal i18n. Strings are in the same file (no build step) so the
// runtime impact is zero. Anywhere we want translation, replace literals
// with t('key.path').

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'zh' | 'en';

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    'app.deck.untitled': 'Untitled Presentation',
    'app.dirty': '未保存',
    'app.saved': '已保存',
    'topbar.text': '文本',
    'topbar.shape': '形状',
    'topbar.image': '图片',
    'topbar.list': '无序列表',
    'topbar.divider': '分隔线',
    'topbar.chart': '图表',
    'topbar.table': '表格',
    'topbar.more': '更多组件',
    'topbar.chat': '对话',
    'topbar.present': '演示',
    'topbar.exit': '退出',
    'topbar.export.pptx': '导出 PPTX',
    'topbar.export.pdf': 'PDF',
    'topbar.export.png': 'PNG',
    'left.slides': '幻灯片',
    'left.add': '添加幻灯片',
    'left.duplicate': '复制',
    'left.remove': '删除',
    'left.projects': '项目历史',
    'left.history': '版本历史',
    'right.slide.props': '幻灯片属性',
    'right.bg.color': '背景颜色',
    'right.position': '位置 / 大小',
    'right.text': '文本',
    'right.shape': '形状',
    'right.image': '图片',
    'right.layer': '层级',
    'right.delete': '删除',
    'chat.title': 'AI 对话',
    'chat.new': '新建对话',
    'chat.history': '历史会话',
    'chat.send': '发送',
    'chat.confirmHint': '点击后再次确认发送',
    'chat.placeholder.mac': '描述你想要的 PPT…  (Cmd+Enter 触发，再次确认发送)',
    'chat.placeholder.other': '描述你想要的 PPT…  (Ctrl+Enter 发送)',
    'settings.title': '设置',
    'settings.providers': 'AI 服务',
    'settings.themes': '主题模板',
    'settings.skills': '技能',
    'settings.collab': '协同',
    'settings.audit': '导出审计',
    'settings.proxy': '网络代理',
    'lang.label': '语言',
    'lang.zh': '中文',
    'lang.en': 'English',
  },
  en: {
    'app.deck.untitled': 'Untitled Presentation',
    'app.dirty': 'unsaved',
    'app.saved': 'saved',
    'topbar.text': 'Text',
    'topbar.shape': 'Shape',
    'topbar.image': 'Image',
    'topbar.list': 'Bullet list',
    'topbar.divider': 'Divider',
    'topbar.chart': 'Chart',
    'topbar.table': 'Table',
    'topbar.more': 'More',
    'topbar.chat': 'Chat',
    'topbar.present': 'Present',
    'topbar.exit': 'Exit',
    'topbar.export.pptx': 'Export PPTX',
    'topbar.export.pdf': 'PDF',
    'topbar.export.png': 'PNG',
    'left.slides': 'Slides',
    'left.add': 'Add slide',
    'left.duplicate': 'Duplicate',
    'left.remove': 'Delete',
    'left.projects': 'Projects',
    'left.history': 'History',
    'right.slide.props': 'Slide',
    'right.bg.color': 'Background',
    'right.position': 'Position / size',
    'right.text': 'Text',
    'right.shape': 'Shape',
    'right.image': 'Image',
    'right.layer': 'Layer',
    'right.delete': 'Delete',
    'chat.title': 'AI Chat',
    'chat.new': 'New chat',
    'chat.history': 'History',
    'chat.send': 'Send',
    'chat.confirmHint': 'Click again to confirm send',
    'chat.placeholder.mac': 'Describe the deck you want…  (Cmd+Enter to trigger, click again to confirm)',
    'chat.placeholder.other': 'Describe the deck you want…  (Ctrl+Enter to send)',
    'settings.title': 'Settings',
    'settings.providers': 'AI Providers',
    'settings.themes': 'Themes',
    'settings.skills': 'Skills',
    'settings.collab': 'Collaboration',
    'settings.audit': 'Export Audit',
    'settings.proxy': 'Network Proxy',
    'lang.label': 'Language',
    'lang.zh': '中文',
    'lang.en': 'English',
  },
};

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      locale: detectInitialLocale(),
      setLocale: (l) => set({ locale: l }),
    }),
    { name: 'ai-ppt-i18n', version: 1 },
  ),
);

function detectInitialLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh';
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function t(key: string): string {
  const locale = useI18n.getState().locale;
  return messages[locale][key] ?? messages.zh[key] ?? key;
}

// React hook variant — re-renders on locale change.
export function useT() {
  const locale = useI18n((s) => s.locale);
  return (key: string): string => messages[locale][key] ?? messages.zh[key] ?? key;
}
