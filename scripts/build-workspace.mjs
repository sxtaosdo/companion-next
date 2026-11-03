import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const args of [
  ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'],
  ['node_modules/vite/bin/vite.js', 'build', '--mode', 'companion-workspace', '--base', './', '--outDir', 'dist-companion-workspace'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.login.config.ts'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
// The host serves public login assets from /next/login, not a sibling directory.
cpSync(resolve(root, 'dist-companion-login/login'), resolve(root, 'dist-companion-workspace/login'), { recursive: true });
