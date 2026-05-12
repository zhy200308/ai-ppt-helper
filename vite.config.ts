import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { defineConfig, type ViteDevServer } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

function aiDevProxyPlugin() {
  return {
    name: 'ai-dev-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__ai-proxy', (req, res) => {
        void proxyAiRequest(req, res);
      });
    },
  };
}

async function proxyAiRequest(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const target = req.headers['x-ai-proxy-target'];
  if (typeof target !== 'string') {
    res.statusCode = 400;
    res.end('missing x-ai-proxy-target');
    return;
  }

  const targetUrl = new URL(target);
  const headers = { ...req.headers };
  delete headers['x-ai-proxy-target'];
  delete headers.origin;
  delete headers.referer;
  headers.host = targetUrl.host;

  const transport = targetUrl.protocol === 'http:' ? httpRequest : httpsRequest;
  const proxyReq = transport(targetUrl, { method: req.method, headers }, (proxyRes) => {
    res.statusCode = proxyRes.statusCode ?? 502;
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined) res.setHeader(key, value);
    }
    setCorsHeaders(res);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    if (res.headersSent) return;
    setCorsHeaders(res);
    res.statusCode = 502;
    res.end(`AI proxy failed: ${error.message}`);
  });

  req.pipe(proxyReq);
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('access-control-allow-headers', '*');
}

export default defineConfig({
  plugins: [
    aiDevProxyPlugin(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Split heavy or rarely-loaded modules into their own chunks. Vite/
        // rolldown handles dynamic imports automatically; this only manages
        // shared vendor splits.
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) return 'vendor-state';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules/pdf-lib') || id.includes('node_modules/pptxgenjs') || id.includes('node_modules/jszip')) return 'vendor-export';
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) return 'vendor-echarts';
          if (id.includes('node_modules/mermaid')) return 'vendor-mermaid';
          if (id.includes('node_modules/katex')) return 'vendor-katex';
          if (id.includes('node_modules/idb')) return 'vendor-idb';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
