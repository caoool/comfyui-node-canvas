import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/helper': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/helper/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
