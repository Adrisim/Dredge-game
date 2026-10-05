import { defineConfig } from 'vite';

// Relative base so the build works from any static host / sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  server: { host: true },
});
