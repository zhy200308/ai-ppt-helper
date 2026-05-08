// Export-time audit options shared by PDF / PPTX / PNG flows.
// Persists to UI store so users don't re-enter on every export.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuditOptions {
  watermark: { enabled: boolean; text: string; opacity: number; angle: number };
  pdfPassword: { enabled: boolean; password: string };
  share: { enabled: boolean; expiresAt: number | null };
}

interface AuditState extends AuditOptions {
  setWatermark: (w: Partial<AuditOptions['watermark']>) => void;
  setPdfPassword: (p: Partial<AuditOptions['pdfPassword']>) => void;
  setShare: (s: Partial<AuditOptions['share']>) => void;
  reset: () => void;
}

const DEFAULT: AuditOptions = {
  watermark: { enabled: false, text: 'CONFIDENTIAL', opacity: 0.18, angle: -30 },
  pdfPassword: { enabled: false, password: '' },
  share: { enabled: false, expiresAt: null },
};

export const useAuditStore = create<AuditState>()(
  persist(
    (set) => ({
      ...DEFAULT,
      setWatermark: (w) => set((s) => ({ watermark: { ...s.watermark, ...w } })),
      setPdfPassword: (p) => set((s) => ({ pdfPassword: { ...s.pdfPassword, ...p } })),
      setShare: (sh) => set((s) => ({ share: { ...s.share, ...sh } })),
      reset: () => set({ ...DEFAULT }),
    }),
    { name: 'ai-ppt-audit', version: 1 },
  ),
);

// Build a watermark SVG data URL we can plaster on each export page.
export function watermarkSvg(text: string, w: number, h: number, opacity = 0.18, angle = -30): string {
  const safe = text.replace(/[<&>]/g, '');
  const fontSize = Math.max(48, Math.round(Math.min(w, h) / 8));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <pattern id="p" patternUnits="userSpaceOnUse" width="${fontSize * 8}" height="${fontSize * 4}">
        <text x="0" y="${fontSize}" font-family="Inter, sans-serif" font-size="${fontSize}" fill="#0F172A" fill-opacity="${opacity}" transform="rotate(${angle} ${fontSize * 4} ${fontSize * 2})">${safe}</text>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#p)"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Generate a share token — deterministic from deck id + expiresAt — that
// the host can later validate. Simulated client-side; production would
// sign on a server.
export async function makeShareToken(deckId: string, expiresAt: number): Promise<string> {
  const data = new TextEncoder().encode(`${deckId}|${expiresAt}|local`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash)).slice(0, 12);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c] ?? ''));
  return `${deckId}.${expiresAt.toString(36)}.${b64}`;
}
