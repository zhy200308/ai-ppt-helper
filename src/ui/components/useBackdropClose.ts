import { useCallback, useRef } from 'react';

// Modal-backdrop close that ignores accidental closes when the user
// starts a drag (e.g. selecting text inside an input) inside the modal
// and releases the pointer outside it.
//
// Usage:
//   const guard = useBackdropClose(onClose);
//   <div className="modal-backdrop" {...guard}> ... </div>
export function useBackdropClose(onClose: () => void) {
  const downOnBackdrop = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    downOnBackdrop.current = e.target === e.currentTarget;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (downOnBackdrop.current && e.target === e.currentTarget) {
        onClose();
      }
      downOnBackdrop.current = false;
    },
    [onClose],
  );

  return { onPointerDown, onPointerUp };
}

// Detect Mac so we can require a confirmation tap for destructive or
// "send"-style actions where Cmd-key adjacency is easy to mis-hit.
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform;
  if (platform) return /mac/i.test(platform);
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
}
