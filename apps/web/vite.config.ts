import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// URL 與 import.meta.url 在 ESNext + DOM lib 下不需要 @types/node
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    watch: {
      // Docker volumes 在某些 OS 不會觸發原生 fs event，polling workaround
      usePolling: true,
      interval: 300,
    },
  },
});
