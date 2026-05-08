import { useEffect } from 'react';
import { useDeckStore } from '../../core/store/deck';
import { createImageBlock, createTextBlock } from '../../core/schema/factory';

// Listens at the document level for dragdrop and paste of images / text,
// then injects them as blocks on the active slide. Pointer location is
// converted to deck space via the supplied resolver.
export function useDropPaste(
  containerRef: React.RefObject<HTMLElement | null>,
  toDeck: (clientX: number, clientY: number) => { x: number; y: number },
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const hasFile = Array.from(e.dataTransfer.items).some((it) => it.kind === 'file');
      if (hasFile) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      const { x, y } = toDeck(e.clientX, e.clientY);
      const slideId = useDeckStore.getState().selection.slideId;
      if (!slideId) return;
      let dx = 0;
      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.type.startsWith('image/')) {
          const url = await fileToDataUrl(file);
          const dim = await imageDim(url);
          const w = Math.min(900, dim.w);
          const scale = w / dim.w;
          useDeckStore.getState().addBlock(
            slideId,
            createImageBlock({ src: url, x: x + dx, y, w, h: Math.round(dim.h * scale) }),
          );
          dx += 32;
        }
      }
    };

    const onPaste = async (e: ClipboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const slideId = useDeckStore.getState().selection.slideId;
      if (!slideId) return;
      const center = toDeck(window.innerWidth / 2, window.innerHeight / 2);
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const url = await fileToDataUrl(file);
          const dim = await imageDim(url);
          const w = Math.min(900, dim.w);
          const scale = w / dim.w;
          useDeckStore.getState().addBlock(
            slideId,
            createImageBlock({ src: url, x: center.x - w / 2, y: center.y - dim.h * scale / 2, w, h: Math.round(dim.h * scale) }),
          );
        } else if (item.type === 'text/plain') {
          item.getAsString((text) => {
            if (!text.trim()) return;
            useDeckStore.getState().addBlock(
              slideId,
              createTextBlock({
                runs: [{ text }],
                x: center.x - 600,
                y: center.y - 60,
                w: 1200,
                h: 120,
              }),
            );
          });
        }
      }
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
    };
  }, [containerRef, toDeck]);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function imageDim(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 800, h: 500 });
    img.src = src;
  });
}
