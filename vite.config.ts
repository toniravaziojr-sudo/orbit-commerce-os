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
  // Enable source maps for debugging minified errors
  build: {
    sourcemap: mode !== 'production',
  },
}));
