import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const license = readFileSync(new URL('./src/login/COOL-ADMIN-LICENSE.txt', import.meta.url), 'utf8')
export default defineConfig({
  plugins: [vue()], publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist-companion-login', emptyOutDir: false, assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    lib: { entry: new URL('./src/login-main.ts', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'), name: 'CompanionLogin', formats: ['iife'], fileName: () => 'login/login.js', cssFileName: 'login' },
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true, banner: `/*! Adapted login UI from Cool-admin Vue 8.x https://github.com/cool-team-official/cool-admin-vue/tree/8.x\n${license}\n*/`, assetFileNames: 'login/[name][extname]' } },
  },
})
