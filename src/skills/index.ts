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
];

// Parse a chat message; if it starts with "/<skill> ..." return the
// skill name and the remaining argument string.
export function parseSlash(message: string): { skill: string; args: string } | null {
  const m = message.match(/^\s*\/([\w-]+)\s*(.*)$/s);
  if (!m) return null;
  return { skill: m[1], args: m[2] };
}
