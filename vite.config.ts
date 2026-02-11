
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // We prioritize GEMINI_API_KEY from the environment and map it to process.env.API_KEY
    // which is the standard variable used by the Gemini SDK in this application.
    'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.API_KEY || "")
  },
  optimizeDeps: {
    include: ["jspdf", "jspdf-autotable"]
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
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
