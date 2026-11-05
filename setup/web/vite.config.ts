import { defineConfig } from "vite";

// Względne ścieżki: ten sam build serwuje agama-web-server (--web-ui-dir) i shrimp-setup.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", assetsInlineLimit: 0, target: "es2022" },
  // Tłumaczenia leżą w i18n/ obok katalogu aplikacji.
  server: { fs: { allow: ["../.."] } },
});
