const COMMON_FONT_CANDIDATES = [
  'Microsoft YaHei',
  'SimHei',
  'SimSun',
  'DengXian',
  'KaiTi',
  'FangSong',
  'PingFang SC',
  'Hiragino Sans GB',
  'Noto Sans CJK SC',
  'Source Han Sans SC',
  'Arial',
  'Calibri',
  'Aptos',
  'Segoe UI',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Cambria',
  'Consolas',
];

let cachedFonts: string[] | null = null;

export async function getAvailableFonts(): Promise<string[]> {
  if (cachedFonts) return cachedFonts;
  if (typeof document === 'undefined') return COMMON_FONT_CANDIDATES;

  const fonts = new Set<string>();
  if ('fonts' in document) {
    await document.fonts.ready;
    for (const f of document.fonts as FontFaceSet) fonts.add(f.family.replace(/^['"]|['"]$/g, ''));
  }
  for (const family of COMMON_FONT_CANDIDATES) {
    if (isFontAvailable(family)) fonts.add(family);
  }
  cachedFonts = Array.from(fonts).sort((a, b) => a.localeCompare(b));
  return cachedFonts;
}

function isFontAvailable(family: string): boolean {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const text = 'mmmmmmmmmmlli中文字体测试';
  ctx.font = '72px monospace';
  const baseline = ctx.measureText(text).width;
  ctx.font = `72px "${family}", monospace`;
  return Math.abs(ctx.measureText(text).width - baseline) > 0.1;
}
