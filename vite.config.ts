import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Mantém o bundle inicial abaixo de 500 kB e separa bibliotecas que
    // só são usadas em telas carregadas sob demanda (gráficos, Supabase, UI).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/](recharts|d3-|victory|decimal\.js)/.test(id)) return 'charts';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@radix-ui') || id.includes('vaul') || id.includes('cmdk')) return 'ui-vendor';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/](date-fns|lodash)[\\/]/.test(id)) return 'date-utils';
        },
      },
    },
  },
}));
