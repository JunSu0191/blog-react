import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (
            id.includes("/@tiptap/") ||
            id.includes("/prosemirror-") ||
            id.includes("/orderedmap/")
          ) {
            return "editor";
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "react-core";
          }

          if (id.includes("/react-router/") || id.includes("/react-router-dom/")) {
            return "router";
          }

          if (id.includes("/@tanstack/react-query/")) {
            return "react-query";
          }

          if (id.includes("/axios/")) {
            return "http";
          }

          if (id.includes("/tus-js-client/")) {
            return "upload";
          }

          return "vendor";
        },
      },
    },
  },
});
