// Lightweight color helpers — WCAG contrast, hex/rgb conversion, generated
// palettes from a primary color. Used by AI tools to derive a theme from
// a single primary input.

export interface RGB { r: number; g: number; b: number; }

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = parseInt(full, 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0));
  else if (max === G) h = ((B - R) / d + 2);
  else h = ((R - G) / d + 4);
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) { r1 = c; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = c; }
  else if (hp < 3) { g1 = c; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = l - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

function relLuminance({ r, g, b }: RGB): number {
  const trans = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * trans(r) + 0.7152 * trans(g) + 0.0722 * trans(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(hexToRgb(a));
  const lb = relLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Pick whichever of #FFFFFF or #0F172A has the better contrast against bg.
export function bestForeground(bg: string): string {
  return contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#0F172A') ? '#FFFFFF' : '#0F172A';
}

export interface DerivedPalette {
  primary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
}

// Build a WCAG-aware palette from a single primary color. The accent is a
// complementary hue; background/text pair is forced to AA contrast (>= 4.5).
export function derivePalette(primary: string, theme: 'light' | 'dark' = 'light'): DerivedPalette {
  const hsl = rgbToHsl(hexToRgb(primary));
  const accentHsl = { h: (hsl.h + 180) % 360, s: Math.min(0.85, hsl.s * 1.05), l: hsl.l };
  const accent = rgbToHex(hslToRgb(accentHsl.h, accentHsl.s, accentHsl.l));
  const background = theme === 'light' ? '#FFFFFF' : '#0F172A';
  let text = bestForeground(background);
  if (contrastRatio(background, text) < 4.5) text = theme === 'light' ? '#0F172A' : '#FFFFFF';
  const mutedHsl = rgbToHsl(hexToRgb(text));
  const muted = rgbToHex(hslToRgb(mutedHsl.h, Math.max(0, mutedHsl.s - 0.1), theme === 'light' ? 0.45 : 0.7));
  return { primary, accent, background, text, muted };
}

// Best-effort heading/body font pairing. We avoid downloading fonts —
// rely on system & web-safe stacks.
export interface FontPair { heading: string; body: string; }

export function suggestFontPair(prompt: string): FontPair {
  const p = prompt.toLowerCase();
  if (/chinese|中文|zh|商务|科技|tech/.test(p)) {
    return {
      heading: '"PingFang SC", "Microsoft YaHei", Inter, sans-serif',
      body: '"PingFang SC", "Microsoft YaHei", Inter, sans-serif',
    };
  }
  if (/serif|衬线|经典|elegant|publishing/.test(p)) {
    return { heading: 'Georgia, "Source Han Serif SC", serif', body: 'Georgia, serif' };
  }
  if (/code|developer|hack|tech/.test(p)) {
    return { heading: '"JetBrains Mono", Consolas, monospace', body: 'Inter, sans-serif' };
  }
  if (/playful|fun|kid|儿童/.test(p)) {
    return { heading: '"Comic Sans MS", "Marker Felt", sans-serif', body: 'Inter, sans-serif' };
  }
  return { heading: 'Inter, "PingFang SC", sans-serif', body: 'Inter, "PingFang SC", sans-serif' };
}
