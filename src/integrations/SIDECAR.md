# Tauri / Electron sidecar contract

The web build is fully functional offline (with the exception of LLM and
image-generation calls which need network). When packaged into a desktop
shell, the host injects an object on `globalThis.__SIDECAR__` that conforms
to the `Sidecar` interface defined in `src/integrations/sidecar.ts`.

## Required (already consumed by the web build)

| Method                    | Used by                           | Notes |
|---------------------------|-----------------------------------|-------|
| `fetch(input, init)`      | `AIService` (when `proxy.enabled`)| Routes the LLM HTTP call through the user's configured system / SOCKS / HTTP proxy. Same shape as `fetch` global. |
| `detectProxy()`           | `ProxySection`                    | Returns `{ httpProxy?, httpsProxy? }` strings sourced from the OS. |

## Optional (graceful degradation if missing)

| Method                          | Use case                           |
|---------------------------------|------------------------------------|
| `openPath(path)`                | "Reveal in Finder" after export    |
| `saveFile(name, bytes)`         | Save PPTX/PDF without browser dialog |
| `pickFile({ extensions })`      | Native file picker for theme imports |
| `renderPptxToImages(pptxBytes)` | High-fidelity PPTX preview using OS PowerPoint engine |

## Tauri quickstart (canonical)

```rust
// src-tauri/src/main.rs (excerpt)
#[tauri::command]
async fn detect_proxy() -> Result<ProxyInfo, String> { ... }

#[tauri::command]
async fn forward_fetch(url: String, init: serde_json::Value) -> Result<...> { ... }

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![detect_proxy, forward_fetch, /* ... */])
    .setup(|app| {
      // Inject the JS shim into every window so __SIDECAR__ is available.
      app.get_window("main").unwrap().eval(SIDECAR_SHIM_JS)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running");
}
```

The JS shim wraps each `invoke()` call in the shape required by
`Sidecar`. The exact shim is intentionally not vendored here so that a
future Tauri release can ship its own version without forking.

## Why this is a stub today

Implementing the Rust side requires:
1. A Tauri toolchain on the build host (Rust + platform SDKs).
2. Code-signing certificates per platform.
3. Distinct packaging pipelines for macOS / Windows / Linux.

These are out of scope for the web codebase. The contract above is
sufficient for any team implementing the desktop wrapper to do so without
needing to modify the web bundle: simply expose `__SIDECAR__` and the
existing code paths light up.
