// User-installable skills. Each skill is a self-contained markdown
// instruction (with optional zip bundle) the AI can invoke via the
// chat slash-command surface or as a regular tool.
//
// Persisted in IndexedDB (separate store) so they survive reloads.

import JSZip from 'jszip';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface SkillMeta {
  name: string; // unique slug, e.g. "summarize-doc"
  title: string;
  description: string;
  source: 'builtin' | 'user';
  version?: string;
  updatedAt: number;
}

export interface SkillPackage {
  meta: SkillMeta;
  systemPrompt: string;
  // Optional auxiliary text resources, keyed by relative path.
  files: Record<string, string>;
  enabled: boolean;
}

interface SkillDB extends DBSchema {
  skills: { key: string; value: SkillPackage; indexes: { 'by-updatedAt': number } };
}

let dbP: Promise<IDBPDatabase<SkillDB>> | null = null;
function db() {
  if (!dbP) {
    dbP = openDB<SkillDB>('ai-ppt-skills', 1, {
      upgrade(d) {
        const s = d.createObjectStore('skills', { keyPath: 'meta.name' });
        s.createIndex('by-updatedAt', 'meta.updatedAt');
      },
    });
  }
  return dbP;
}

export async function saveUserSkill(pkg: SkillPackage): Promise<void> {
  const d = await db();
  await d.put('skills', { ...pkg, meta: { ...pkg.meta, source: 'user' } });
}

export async function deleteUserSkill(name: string): Promise<void> {
  const d = await db();
  await d.delete('skills', name);
}

export async function loadAllSkills(): Promise<SkillPackage[]> {
  const d = await db();
  const userSkills = await d.getAll('skills');
  return [...BUILTIN_SKILLS, ...userSkills];
}

export async function loadSkill(name: string): Promise<SkillPackage | undefined> {
  const builtin = BUILTIN_SKILLS.find((s) => s.meta.name === name);
  if (builtin) return builtin;
  const d = await db();
  return d.get('skills', name);
}

export async function importSkillFromMarkdown(file: File): Promise<SkillPackage> {
  const text = await file.text();
  const meta = parseFrontMatter(text);
  const name = meta.name ?? slugify(file.name.replace(/\.md$/i, ''));
  return {
    meta: {
      name,
      title: meta.title ?? name,
      description: meta.description ?? '',
      source: 'user',
      updatedAt: Date.now(),
      version: meta.version,
    },
    systemPrompt: stripFrontMatter(text),
    files: {},
    enabled: true,
  };
}

export async function importSkillFromZip(file: File): Promise<SkillPackage> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  let manifestText = '';
  const files: Record<string, string> = {};
  for (const path of Object.keys(zip.files)) {
    const f = zip.files[path];
    if (f.dir) continue;
    if (/(skill\.md|README\.md|prompt\.md)$/i.test(path) && !manifestText) {
      manifestText = await f.async('text');
    } else if (/\.(md|txt|json|yaml|yml)$/i.test(path)) {
      files[path] = await f.async('text');
    }
  }
  if (!manifestText) throw new Error('zip 中找不到 skill.md / README.md / prompt.md');
  const meta = parseFrontMatter(manifestText);
  const name = meta.name ?? slugify(file.name.replace(/\.zip$/i, ''));
  return {
    meta: {
      name,
      title: meta.title ?? name,
      description: meta.description ?? '',
      source: 'user',
      updatedAt: Date.now(),
      version: meta.version,
    },
    systemPrompt: stripFrontMatter(manifestText),
    files,
    enabled: true,
  };
}

function parseFrontMatter(text: string): Record<string, string> {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end < 0) return {};
  const body = text.slice(4, end);
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return out;
}

function stripFrontMatter(text: string): string {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  return end >= 0 ? text.slice(end + 4).trimStart() : text;
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Built-in skills shipped with the app — light, focused presets.
const PPT_OPTIMIZATION_SKILLS: Array<{ name: string; title: string; description: string; systemPrompt: string }> = [
  ['polish', '页面美化', '把当前页优化为更高级、更有设计感的商务幻灯片', 'Redesign the target slide with stronger visual hierarchy, spacing, alignment, contrast, and tasteful decorative elements. Prefer polish_slide, distribute_blocks, style_block, set_slide_background, insert_design_element, and insert_connector. Preserve the user\'s core meaning and avoid adding text inside images.'],
  ['exec', '高管汇报', '把内容升级为管理层可快速决策的表达', 'Make the slide executive-ready: conclusion-first title, quantified evidence, clear risk/opportunity/action, and minimal jargon. Prefer rewrite_text and speaker notes.'],
  ['chart', '图表叙事', '把数据变成有结论、有重点的图表页', 'Turn data into insight-led charts. Always create_data_table before charts/tables, then insert_chart_from_table or style_chart. Add a takeaway headline and highlight one main insight.'],
  ['storyline', '叙事主线', '重组整份 PPT 的故事线和章节推进', 'Improve the deck narrative arc: context → tension → insight → recommendation → action. Use outline_deck/add_slide/populate_slide only where needed, and ask before broad restructuring.'],
  ['brand', '品牌统一', '按品牌色、字体、版式统一整份 PPT', 'Harmonize colors, typography, backgrounds, icon style, and spacing across the deck. Use derive_theme or set_theme after asking for confirmation when applying broad changes.'],
  ['dense', '减密拆页', '把拥挤页面拆分或简化，让信息更清晰', 'Reduce visual density. Keep one message per slide, split overloaded content when necessary, and prefer short parallel bullets. Ask before deleting or splitting content.'],
  ['speaker', '演讲备注', '生成简洁自然的演讲者备注', 'Create concise speaker notes that explain the slide verbally without duplicating slide text. Keep notes practical for live delivery.'],
  ['critique', '设计审查', '只审查不修改，指出版式、遮挡、导出和叙事问题', 'Audit the target deck or slide without mutating it unless asked. Check storyline, visual hierarchy, text overflow, occlusion, contrast, chart/table clarity, image text risk, and PPTX export risk.'],
  ['executive-summary', '高管摘要', '把内容压缩成管理层可快速决策的摘要', 'Prioritize strategic implications, decisions, risks, and next actions. Keep slides concise and executive-ready.'],
  ['storyline', '叙事主线优化', '重组整份 PPT 的故事线和章节推进', 'Improve the deck narrative arc: context → tension → insight → recommendation → action. Use add_slide/edit tools only where needed.'],
  ['slide-title-polish', '结论式标题', '把页面标题改为带观点的 assertion headline', 'Rewrite slide titles as concise assertion headlines that state the takeaway, not the topic. Use rewrite_text on title blocks.'],
  ['one-message-per-slide', '一页一重点', '拆解信息过载页面，让每页只表达一个重点', 'Ensure each slide communicates one primary message. If a slide is overloaded, ask before splitting or deleting content.'],
  ['consulting-style', '咨询风格结构化', '按 MECE 和咨询汇报方式优化结构', 'Use MECE grouping, parallel wording, clear action titles, and clean evidence hierarchy.'],
  ['investor-pitch', '融资路演优化', '优化为投资人路演叙事', 'Shape content around problem, market, solution, traction, business model, moat, team, and ask. Keep claims investor-grade.'],
  ['sales-deck', '销售材料优化', '优化为客户销售型材料', 'Focus on buyer pain, differentiated value, proof, objection handling, and next step. Reduce internal jargon.'],
  ['training-deck', '培训课件优化', '优化为教学和培训课件', 'Sequence concepts from simple to advanced. Add examples, checkpoints, and speaker notes when useful.'],
  ['data-story', '数据故事化', '把数据转换成清晰图表叙事', 'Turn data into insight-led slides. Use create_data_table before charts/tables and make the takeaway explicit.'],
  ['chart-cleanup', '图表清理', '清理图表表达、标签和重点', 'Simplify charts: clear title, minimal series, meaningful labels, and one highlighted insight. Use data-table workflow.'],
  ['visual-hierarchy', '视觉层级优化', '优化字号、间距、强调和阅读顺序', 'Improve visual hierarchy with scale, whitespace, contrast, and alignment. Prefer move_resize_block/style_block.'],
  ['layout-balance', '版式平衡', '调整页面组件布局和平衡', 'Balance slide composition. Align edges, avoid crowding, preserve margins, and use move_resize_block/reorder_block.'],
  ['theme-harmonize', '主题统一', '统一整份 PPT 的颜色和字体', 'Harmonize colors and typography across the deck. Use ask_user_choice before applying a new theme.'],
  ['iconography', '图标系统优化', '为页面增加克制一致的图标表达', 'Use restrained, consistent icons only when they clarify meaning. Avoid decoration overload.'],
  ['image-brief', '无文字图片提示词', '为 PPT 生成无文字可编辑友好的图片提示词', 'Create image prompts that explicitly forbid text, letters, numbers, logos, labels, signage, captions, and watermarks.'],
  ['speaker-notes', '演讲者备注', '生成简洁演讲者备注', 'Add concise speaker notes that explain key talking points without duplicating slide text.'],
  ['agenda-outline', '议程结构', '生成更清晰的章节和议程结构', 'Create or improve agenda/section flow with clear progression and 3-6 meaningful sections.'],
  ['localize-cn-en', '中英双语润色', '进行中文/英文双语本地化和表达润色', 'Localize between Chinese and English while preserving numbers, names, units, and business meaning. Use rewrite_text.'],
  ['reduce-text', '减少文字', '压缩页面文字量，提高可读性', 'Aggressively reduce text while preserving meaning. Prefer concise bullets <= 14 words and remove redundancy.'],
  ['final-review', '最终质量检查', '检查整份 PPT 的结构、视觉和可导出性', 'Review the deck for storyline, consistency, overflow, contrast, image text risk, data-table usage, and export risks. Propose fixes before broad mutations.'],
].map(([name, title, description, systemPrompt]) => ({ name, title, description, systemPrompt }));

export const BUILTIN_SKILLS: SkillPackage[] = [
  {
    meta: {
      name: 'summarize',
      title: '提炼要点',
      description: '把上传文件或选区文本压缩成 5 条精炼要点，放到当前幻灯片',
      source: 'builtin',
      updatedAt: 0,
    },
    enabled: true,
    files: {},
    systemPrompt: `Reduce the user input to AT MOST 5 punchy bullets, each <= 14 words.
Use \`add_slide\` (layout=bullet) or \`edit_block\` to write them onto the deck.`,
  },
  {
    meta: {
      name: 'translate',
      title: '翻译',
      description: '把当前幻灯片或选区翻译为指定语言（默认英文）',
      source: 'builtin',
      updatedAt: 0,
    },
    enabled: true,
    files: {},
    systemPrompt: `Translate the referenced text. Preserve numbers, names, units. Default target = English unless user states otherwise. Use \`rewrite_text\` to apply.`,
  },
  {
    meta: {
      name: 'tone',
      title: '调整语气',
      description: '把选中文本改写为更专业 / 更口语 / 更激励的语气',
      source: 'builtin',
      updatedAt: 0,
    },
    enabled: true,
    files: {},
    systemPrompt: `Rewrite the referenced text in the requested tone (default: senior product designer pitching to executives). Use \`rewrite_text\`.`,
  },
  ...PPT_OPTIMIZATION_SKILLS.map((s) => ({
    meta: {
      name: s.name,
      title: s.title,
      description: s.description,
      source: 'builtin' as const,
      updatedAt: 0,
    },
    enabled: true,
    files: {},
    systemPrompt: `${s.systemPrompt}\nPrefer typed PPT tools (rewrite_text, move_resize_block, style_block, reorder_block, delete_blocks) over broad edit_block. Use ask_user_choice before destructive or broad visual changes. Keep generated images text-free.`,
  })),
];

// Parse a chat message; if it starts with "/<skill> ..." return the
// skill name and the remaining argument string.
export function parseSlash(message: string): { skill: string; args: string } | null {
  const m = message.match(/^\s*\/([\w-]+)\s*(.*)$/s);
  if (!m) return null;
  return { skill: m[1], args: m[2] };
}
