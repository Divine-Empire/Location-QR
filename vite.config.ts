import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/google-drive': {
        target: 'https://lh3.googleusercontent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/google-drive/, '')
      },
      '/gdrive-uc': {
        target: 'https://drive.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gdrive-uc/, '')
      }
    }
  }
})
