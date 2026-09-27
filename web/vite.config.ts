import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The playground consumes workspace packages as raw TypeScript sources
// (`main`/`exports` point at `src/*.ts`), so Vite must be allowed to
// transform them even though they live inside node_modules symlinks.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@mpg/core', '@mpg/instruments', '@mpg/react'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
