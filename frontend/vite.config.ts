import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发服务器端口固定 3010；/api 代理到后端 4010。
// 生产环境由 nginx 容器代理 /api，前端代码始终使用相对路径。
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3010,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4010',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3010,
    strictPort: true,
  },
});
