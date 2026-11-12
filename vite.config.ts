import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 相簿資料由 server.js 提供（先執行 npm run server）
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  css: {
    postcss: "./postcss.config.js", // 明确指定 PostCSS 配置
  },
});
