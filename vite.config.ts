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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // CRITICAL: Ensure single React instance to prevent #300 errors
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  build: {
    sourcemap: mode !== 'production',
    // ============================================================
    // ONDA 6 — Performance: Bundle partitioning (manualChunks)
    // ⚠️ REGRESSÃO 2026-04-28: A versão anterior fatiava libs por
    // categoria (charts/flow/editor/etc) mas isso gerou tela em
    // branco em produção porque algumas libs do Radix/UI dependem
    // de outras em ordem de inicialização que o splitter quebrou.
    //
    // Estratégia segura agora: NÃO fatiar nada manualmente.
    // Deixar o Rollup decidir o split natural (que já é bom),
    // só aumentando o limite do warning. Os ganhos reais da Onda 6
    // vêm das outras 2 frentes (QueryClient + bootstrap RPC), que
    // continuam ativas e não tocam no carregamento de chunks.
    // ============================================================
    chunkSizeWarningLimit: 1500,
  },
  // Pré-bundle de libs grandes em dev para acelerar HMR/cold start
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      '@supabase/supabase-js',
    ],
  },
}));
