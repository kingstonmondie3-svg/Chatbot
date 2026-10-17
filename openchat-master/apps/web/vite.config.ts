import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep heavy, independently-cacheable libraries in their own chunks so
        // the initial chat view downloads as little as possible.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          markdown: ["react-markdown", "remark-math", "rehype-katex", "rehype-highlight"],
          highlight: ["highlight.js"],
          mermaid: ["mermaid"],
        },
      },
    },
  },
});
