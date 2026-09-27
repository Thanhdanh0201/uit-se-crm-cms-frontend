import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend chưa bật CORS: proxy /api để cùng origin, cookie access_token tự gửi.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:5179' } },
})
