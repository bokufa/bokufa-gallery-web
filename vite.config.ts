import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.bokufa.art',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '/api'),
      }
    }
  }
});
