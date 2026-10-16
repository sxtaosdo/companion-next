import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
  test: { css: { include: [/project-setup-theme\.css/] }, include: ['tests/**/*.test.ts'], environment: 'jsdom', restoreMocks: true, clearMocks: true },
  build: { chunkSizeWarningLimit: 1100, assetsInlineLimit: 0 },
})
