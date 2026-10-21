import {execFileSync} from 'node:child_process'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
let sourceBuild='unavailable'
try { const revision=execFileSync('git',['rev-parse','--short=8','HEAD'],{encoding:'utf8'}).trim();const dirty=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim();sourceBuild=revision+(dirty?'+working':'') } catch {}
export default defineConfig({
  define:{__COMPANION_BUILD_ID__:JSON.stringify(sourceBuild)},
  plugins: [vue()],
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
  test: { css: { include: [/project-setup-theme\.css/] }, include: ['tests/**/*.test.ts', 'tests/client-registration-isolated-20261019.test.mjs'], environment: 'jsdom', restoreMocks: true, clearMocks: true },
  build: { chunkSizeWarningLimit: 1100, assetsInlineLimit: 0 },
})
