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
    // Objetivo: tirar libs pesadas do bundle inicial para que o
    // primeiro carregamento (login + dashboard) seja muito menor.
    // Cada chunk é cacheado separadamente pelo browser, então
    // navegar entre módulos só baixa o chunk daquele módulo.
    // ============================================================
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          // Núcleo React — sempre necessário, fica em chunk próprio (estável, longo cache)
          if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router')) {
            return 'react-vendor';
          }

          // Charts/visualização — pesado, usado só em dashboards/relatórios
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts-vendor';
          }

          // Flow builder — usado só no editor de automações de e-mail
          if (id.includes('@xyflow') || id.includes('reactflow')) {
            return 'flow-vendor';
          }

          // Editores ricos / drag-drop — usados só em telas específicas do builder
          if (
            id.includes('@dnd-kit') ||
            id.includes('@tiptap') ||
            id.includes('quill') ||
            id.includes('codemirror')
          ) {
            return 'editor-vendor';
          }

          // PDF / Excel / docs — usado só em exportações
          if (
            id.includes('jspdf') ||
            id.includes('html2canvas') ||
            id.includes('xlsx') ||
            id.includes('papaparse')
          ) {
            return 'export-vendor';
          }

          // Supabase SDK — em chunk próprio, compartilhado por toda a app
          if (id.includes('@supabase')) {
            return 'supabase-vendor';
          }

          // Radix UI / shadcn primitives — base do design system
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }

          // Form libs
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'form-vendor';
          }

          // Date/i18n
          if (id.includes('date-fns') || id.includes('dayjs')) {
            return 'date-vendor';
          }

          // Lucide icons — grande, carrega sob demanda
          if (id.includes('lucide-react')) {
            return 'icons-vendor';
          }

          // Animações
          if (id.includes('framer-motion')) {
            return 'motion-vendor';
          }

          // Resto das dependências de terceiros
          return 'vendor';
        },
      },
    },
    // Aumenta o limite do warning para 1000kb (chunks de vendor podem passar do default 500)
    chunkSizeWarningLimit: 1000,
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
