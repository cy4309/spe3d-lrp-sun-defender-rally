import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 本機 `npm run dev` 時 hostname `api` 不存在；docker compose 的 web 服務請設 VITE_DEV_PROXY_TARGET=http://api:8000
const apiProxyTarget =
  process.env.VITE_DEV_PROXY_TARGET?.trim() || "http://127.0.0.1:8000";

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
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        // 讓後端 public_image_url 能組出 https://{ngrok}/img/...
        xfwd: true,
      },
      "/img": {
        target: apiProxyTarget,
        changeOrigin: true,
        xfwd: true,
      },
      "/docs": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/openapi.json": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/tools": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
    watch: {
      // Docker volumes 在某些 OS 不會觸發原生 fs event，polling workaround
      usePolling: true,
      interval: 300,
    },
  },
});
