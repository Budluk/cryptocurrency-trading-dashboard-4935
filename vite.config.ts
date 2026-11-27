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
          // Helpers gerados pelo Rollup (ex.: interop default) precisam de um
          // chunk próprio; se ficarem em "charts", react-vendor passa a
          // importar de charts e charts importa React de volta (ciclo/TDZ).
          if (id.includes('commonjsHelpers')) return 'vendor-helpers';
          if (!id.includes('node_modules')) return;
          // decimal.js e os helpers do Rollup ficam fora do chunk de gráficos:
          // incluí-los aqui cria uma dependência circular com react-vendor
          // (react-vendor -> charts -> react-vendor) e quebra a inicialização
          // do React em produção ("Cannot access 'P' before initialization").
          if (/[\\/](recharts|d3-|victory)/.test(id)) return 'charts';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@radix-ui') || id.includes('vaul') || id.includes('cmdk')) return 'ui-vendor';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/](date-fns|lodash)[\\/]/.test(id)) return 'date-utils';
        },
      },
    },
  },
}));
