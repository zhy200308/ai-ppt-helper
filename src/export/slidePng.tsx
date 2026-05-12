// Render a slide to a PNG data URL by mounting a temporary off-screen
// React tree, then painting it via SVG foreignObject. Handles theme +
// background. Used by both PDF and PNG exports for fidelity.

import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { CSSProperties } from 'react';
import type { Slide, ThemeSpec } from '../core/schema/types';
import { BlockRenderer } from '../canvas/renderers/BlockRenderer';

export interface RenderSlideToPngOptions {
  sourceWidth: number;
  sourceHeight: number;
  outputWidth?: number;
  outputHeight?: number;
}

export async function renderSlideToPng(slide: Slide, options: RenderSlideToPngOptions, theme: ThemeSpec): Promise<Uint8Array> {
  const sourceWidth = options.sourceWidth;
  const sourceHeight = options.sourceHeight;
  const outputWidth = options.outputWidth ?? sourceWidth;
  const outputHeight = options.outputHeight ?? sourceHeight;
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = `${sourceWidth}px`;
  host.style.height = `${sourceHeight}px`;
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.overflow = 'hidden';
  host.style.zIndex = '-1';
  host.style.contain = 'layout paint size style';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(
        <div
          style={{
            position: 'relative',
            width: sourceWidth,
            height: sourceHeight,
            overflow: 'hidden',
            ...slideBackgroundStyle(slide, theme),
          }}
        >
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
    await waitForRenderSettled(host);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sourceWidth}" height="${sourceHeight}" viewBox="0 0 ${sourceWidth} ${sourceHeight}">
      <foreignObject x="0" y="0" width="${sourceWidth}" height="${sourceHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${sourceWidth}px;height:${sourceHeight}px;overflow:hidden">
          ${host.innerHTML}
        </div>
      </foreignObject>
    </svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = fallbackBackgroundColor(slide, theme);
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(img, 0, 0, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Failed to render slide PNG')), 'image/png');
    });
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    root.unmount();
    host.remove();
  }
}

function slideBackgroundStyle(slide: Slide, theme: ThemeSpec): CSSProperties {
  const bg = slide.background ?? {};
  const fallback = bg.color ?? theme.backgroundColor ?? '#fff';
  if (bg.image) {
    return {
      backgroundImage: `url(${bg.image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: fallback,
    };
  }
  if (bg.gradient) {
    const stops = bg.gradient.stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`).join(', ');
    return {
      background:
        bg.gradient.type === 'linear'
          ? `linear-gradient(${bg.gradient.angle ?? 0}deg, ${stops})`
          : `radial-gradient(circle, ${stops})`,
    };
  }
  return { backgroundColor: fallback };
}

function fallbackBackgroundColor(slide: Slide, theme: ThemeSpec): string {
  return slide.background?.color ?? slide.background?.gradient?.stops[0]?.color ?? theme.backgroundColor ?? '#fff';
}

async function waitForRenderSettled(host: HTMLElement): Promise<void> {
  await document.fonts?.ready.catch(() => undefined);
  await waitForImages(host);
  await nextFrame();
  await nextFrame();
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function waitForImages(host: HTMLElement): Promise<void> {
  const images = Array.from(host.querySelectorAll('img'));
  await Promise.all(images.map(async (img) => {
    if (!img.complete) {
      await new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }
    await img.decode?.().catch(() => undefined);
  }));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
