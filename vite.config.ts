import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Map GEMINI_API_KEY from environment to the API_KEY constant used in code
    'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.API_KEY)
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    // Ensure the index.html is correctly transformed
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000
  }
});