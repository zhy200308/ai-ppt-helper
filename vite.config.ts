import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

export default defineConfig({
  plugins: [
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
