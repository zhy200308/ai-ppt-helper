// Tauri / Electron sidecar integration shim. The web build runs without
// it; when packaged in a desktop shell the host injects an object on
// window.__SIDECAR__ that conforms to this interface. The AIService and
// detectSystemProxy already check for this object.

export interface Sidecar {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  detectProxy(): Promise<{ httpProxy?: string; httpsProxy?: string } | null>;
  // Optional capabilities — the desktop build adds these progressively.
  openPath?(path: string): Promise<void>;
  saveFile?(name: string, bytes: Uint8Array): Promise<string>;
  pickFile?(filters?: { extensions: string[] }): Promise<File | null>;
  renderPptxToImages?(pptxBytes: Uint8Array): Promise<Uint8Array[]>;
}

export function getSidecar(): Sidecar | null {
  return (globalThis as any).__SIDECAR__ ?? null;
}

export function isDesktop(): boolean {
  return !!getSidecar();
}
