// Render a slide to a PNG data URL by mounting a temporary off-screen
// React tree, then painting it via SVG foreignObject. Handles theme +
// background. Used by both PDF and PNG exports for fidelity.

import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Slide, ThemeSpec } from '../core/schema/types';
import { BlockRenderer } from '../canvas/renderers/BlockRenderer';

export async function renderSlideToPng(slide: Slide, w: number, h: number, _theme: ThemeSpec): Promise<Uint8Array> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = `${w}px`;
  host.style.height = `${h}px`;
  host.style.background = slide.background?.color ?? '#fff';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  try {
    const root = createRoot(host);
    flushSync(() => {
      root.render(
        <div style={{ position: 'relative', width: w, height: h }}>
          {[...slide.blocks].sort((a, b) => a.z - b.z).map((b) => (
            <div
              key={b.id}
              style={{
                position: 'absolute',
                left: b.x, top: b.y, width: b.w, height: b.h,
                transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                opacity: b.opacity ?? 1,
                visibility: b.hidden ? 'hidden' : 'visible',
              }}
            >
              <BlockRenderer block={b} presenting />
            </div>
          ))}
        </div>,
      );
    });
    // Allow lazy renderers (mermaid, KaTeX, ECharts) one tick to settle.
    await new Promise((r) => setTimeout(r, 80));

    const html = host.innerHTML;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;background:${slide.background?.color ?? '#fff'}">${html}</div>
      </foreignObject>
    </svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = slide.background?.color ?? '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png')!);
    const buf = new Uint8Array(await blob.arrayBuffer());

    root.unmount();
    return buf;
  } finally {
    host.remove();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
