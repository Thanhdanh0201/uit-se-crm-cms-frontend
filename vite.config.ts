import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'

// Backend chưa bật CORS: proxy /api để cùng origin, cookie access_token tự gửi.
export default defineConfig({
  // Vitest không cần plugin React Router (plugin này đòi file routes).
  plugins: [!process.env.VITEST && reactRouter()],
  server: {
    proxy: { '/api': 'http://localhost:5179' },
    // Cho phép mở dev server qua Cloudflare Tunnel (demo tạm). Vite mặc định chặn host lạ.
    allowedHosts: ['.trycloudflare.com'],
  },
})
