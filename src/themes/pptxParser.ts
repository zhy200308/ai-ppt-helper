// Browser-side PPTX template parser. Extracts the master theme palette,
// font families and slide background. Output feeds into our ThemeSpec
// so AI-generated decks can match an uploaded company template.
//
// Heavy parsing happens lazily: jszip + DOMParser. No XML schema validation;
// we tolerate missing tags rather than throwing.

import JSZip from 'jszip';
import type { ImportedTheme } from '../core/store/settings';

export interface PlaceholderRect {
  // Normalized to 1920×1080 deck space.
  type: string;          // "title" | "body" | "ctrTitle" | "subTitle" | "pic" | ...
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PptxLayout {
  name: string;          // e.g. "Title and Content"
  type: string;          // OOXML layout type, e.g. "obj" | "title" | "twoObj"
  background?: string;
  placeholders: PlaceholderRect[];
}

export interface PptxTheme extends ImportedTheme {
  // Carry through original color slots in case downstream renderers want them.
  colorScheme: Record<string, string>;
  // 0..N slide layouts extracted from ppt/slideLayouts/. Useful as design
  // hints for the layout engine when generating slides for this theme.
  layouts: PptxLayout[];
}

// PowerPoint EMU: 914 400 per inch; standard widescreen is 12192000 × 6858000 EMU.
const EMU_PER_INCH = 914_400;
const PPTX_DECK_W_EMU = 12_192_000;
const PPTX_DECK_H_EMU = 6_858_000;
const DECK_W_PX = 1920;
const DECK_H_PX = 1080;

export async function parsePptxTheme(file: File): Promise<PptxTheme> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const themeFile = Object.keys(zip.files).find((p) => /^ppt\/theme\/theme1\.xml$/i.test(p));
  if (!themeFile) throw new Error('theme1.xml 未找到，是否上传了真实的 .pptx 文件？');
  const xml = await zip.files[themeFile].async('text');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const colors = extractColorScheme(doc);
  const fonts = extractFonts(doc);
  const layouts = await extractLayouts(zip);

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
    layouts,
  };
}

async function extractLayouts(zip: JSZip): Promise<PptxLayout[]> {
  const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const layoutPaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(p))
    .sort();
  const layouts: PptxLayout[] = [];
  for (const path of layoutPaths) {
    try {
      const xml = await zip.files[path].async('text');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const root = doc.documentElement;
      const type = root.getAttribute('type') ?? 'obj';
      const sldLayout = doc.getElementsByTagNameNS(NS_P, 'cSld')[0];
      const name = sldLayout?.getAttribute('name') ?? path.split('/').pop() ?? 'layout';
      const placeholders: PlaceholderRect[] = [];
      const sps = doc.getElementsByTagNameNS(NS_P, 'sp');
      for (let i = 0; i < sps.length; i++) {
        const sp = sps[i];
        const ph = sp.getElementsByTagNameNS(NS_P, 'ph')[0];
        if (!ph) continue;
        const phType = ph.getAttribute('type') ?? 'body';
        const xfrm = sp.getElementsByTagNameNS(NS_A, 'xfrm')[0];
        if (!xfrm) continue;
        const off = xfrm.getElementsByTagNameNS(NS_A, 'off')[0];
        const ext = xfrm.getElementsByTagNameNS(NS_A, 'ext')[0];
        if (!off || !ext) continue;
        const xEMU = parseInt(off.getAttribute('x') ?? '0', 10);
        const yEMU = parseInt(off.getAttribute('y') ?? '0', 10);
        const cxEMU = parseInt(ext.getAttribute('cx') ?? '0', 10);
        const cyEMU = parseInt(ext.getAttribute('cy') ?? '0', 10);
        if (cxEMU <= 0 || cyEMU <= 0) continue;
        placeholders.push({
          type: phType,
          x: Math.round((xEMU / PPTX_DECK_W_EMU) * DECK_W_PX),
          y: Math.round((yEMU / PPTX_DECK_H_EMU) * DECK_H_PX),
          w: Math.round((cxEMU / PPTX_DECK_W_EMU) * DECK_W_PX),
          h: Math.round((cyEMU / PPTX_DECK_H_EMU) * DECK_H_PX),
        });
      }
      const bgFill = doc.getElementsByTagNameNS(NS_A, 'bgFillStyleLst')[0];
      const srgb = bgFill?.getElementsByTagNameNS(NS_A, 'srgbClr')[0];
      const background = srgb ? '#' + srgb.getAttribute('val') : undefined;
      layouts.push({ name, type, background, placeholders });
    } catch {
      // Skip malformed layout files; partial parsing is fine.
    }
  }
  return layouts;
}

// Suppress unused-warning on the inch constant we keep for future use.
void EMU_PER_INCH;

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
