// Browser-side PPTX template parser. Extracts the master theme palette,
// font families and slide background. Output feeds into our ThemeSpec
// so AI-generated decks can match an uploaded company template.
//
// Heavy parsing happens lazily: jszip + DOMParser. No XML schema validation;
// we tolerate missing tags rather than throwing.

import JSZip from 'jszip';
import type { ImportedTheme } from '../core/store/settings';

export interface PptxTheme extends ImportedTheme {
  // Carry through original color slots in case downstream renderers want them.
  colorScheme: Record<string, string>;
}

export async function parsePptxTheme(file: File): Promise<PptxTheme> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const themeFile = Object.keys(zip.files).find((p) => /^ppt\/theme\/theme1\.xml$/i.test(p));
  if (!themeFile) throw new Error('theme1.xml 未找到，是否上传了真实的 .pptx 文件？');
  const xml = await zip.files[themeFile].async('text');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const colors = extractColorScheme(doc);
  const fonts = extractFonts(doc);

  const id = `pptx_${Date.now().toString(36)}`;
  return {
    id,
    name: file.name.replace(/\.pptx$/i, '') || 'PPTX 主题',
    primaryColor: colors.accent1 ?? '#4F46E5',
    accentColor: colors.accent2 ?? '#06B6D4',
    backgroundColor: colors.bg1 ?? '#FFFFFF',
    textColor: colors.tx1 ?? '#0F172A',
    mutedColor: colors.tx2 ?? '#64748B',
    fontFamilyHeading: fonts.major ?? 'Inter, sans-serif',
    fontFamilyBody: fonts.minor ?? 'Inter, sans-serif',
    source: 'pptx',
    importedAt: Date.now(),
    colorScheme: colors,
  };
}

const COLOR_SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'] as const;

function extractColorScheme(doc: Document): Record<string, string> {
  const out: Record<string, string> = {};
  const ns = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  for (const slot of COLOR_SLOTS) {
    const el = doc.getElementsByTagNameNS(ns, slot)[0];
    if (!el) continue;
    const srgb = el.getElementsByTagNameNS(ns, 'srgbClr')[0];
    const sys = el.getElementsByTagNameNS(ns, 'sysClr')[0];
    let hex: string | null = null;
    if (srgb) hex = '#' + srgb.getAttribute('val');
    else if (sys) hex = sys.getAttribute('lastClr') ? '#' + sys.getAttribute('lastClr') : null;
    if (hex) out[slot] = hex;
  }
  // Conventional aliases
  if (out.lt1) out.bg1 = out.lt1;
  if (out.dk1) out.tx1 = out.dk1;
  if (out.dk2) out.tx2 = out.dk2;
  return out;
}

function extractFonts(doc: Document): { major?: string; minor?: string } {
  const ns = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const major = doc.getElementsByTagNameNS(ns, 'majorFont')[0];
  const minor = doc.getElementsByTagNameNS(ns, 'minorFont')[0];
  const pickLatin = (parent?: Element) => {
    if (!parent) return undefined;
    const latin = parent.getElementsByTagNameNS(ns, 'latin')[0];
    return latin?.getAttribute('typeface') || undefined;
  };
  return { major: pickLatin(major), minor: pickLatin(minor) };
}
