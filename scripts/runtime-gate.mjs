import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function verifyRuntime(lane, version = process.versions.node, abi = process.versions.modules) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  if (!match) throw new Error('RUNTIME_VERSION_INVALID');
  const major = Number(match[1]), minor = Number(match[2]);
  if (lane === 'frontend') {
    if (major !== 22 || minor < 12) throw new Error('FRONTEND_REQUIRES_NODE_22_12_OR_NEWER_WITHIN_22');
  } else if (lane === 'host-start') {
    if (major !== 25 || String(abi) !== '141') throw new Error('HOST_START_REQUIRES_NODE_25_ABI_141');
  } else throw new Error('UNKNOWN_RUNTIME_LANE');
}

export function runtimeEvidence(root = projectRoot) {
  const packageBytes = readFileSync(resolve(root, 'package.json'));
  const lockBytes = readFileSync(resolve(root, 'package-lock.json'));
  const pkg = JSON.parse(packageBytes), lock = JSON.parse(lockBytes);
  if (lock.lockfileVersion !== 3 || lock.packages?.['']?.name !== pkg.name || lock.packages?.['']?.version !== pkg.version || lock.version !== pkg.version) {
    throw new Error('PACKAGE_LOCK_IDENTITY_MISMATCH');
  }
  for (const section of ['dependencies', 'devDependencies']) {
    const expected = pkg[section] ?? {}, locked = lock.packages[''][section] ?? {};
    if (JSON.stringify(Object.entries(expected).sort()) !== JSON.stringify(Object.entries(locked).sort())) throw new Error('PACKAGE_LOCK_DEPENDENCY_MISMATCH');
  }
  return { project: root, packageVersion: pkg.version, packageSha256: sha(packageBytes), lockSha256: sha(lockBytes), lockfileVersion: lock.lockfileVersion };
}

export function main(args = process.argv.slice(2)) {
  const [lane, mode, ...command] = args;
  const identity = { lane, execPath: process.execPath, nodeVersion: process.version, modulesAbi: process.versions.modules };
  try {
    verifyRuntime(lane);
    const evidence = { ...identity, ...runtimeEvidence(), gate: 'passed' };
    if (mode === '--check' && command.length === 0) { console.log(JSON.stringify(evidence)); return 0; }
    if (mode !== '--' || command.length === 0) throw new Error('USAGE: runtime-gate.mjs <frontend|host-start> <--check|-- node-arguments...>');
    console.error(JSON.stringify({ ...evidence, command }));
    // Use the verified executable. No shell, PATH fallback, installation or runtime switching.
    const child = spawnSync(process.execPath, command, { cwd: projectRoot, env: process.env, stdio: 'inherit', windowsHide: true });
    if (child.error) throw new Error(`CHILD_START_FAILED: ${child.error.code ?? child.error.message}`);
    if (child.signal) throw new Error(`CHILD_TERMINATED: ${child.signal}`);
    return child.status ?? 1;
  } catch (error) {
    console.error(JSON.stringify({ ...identity, gate: 'blocked', reason: error.message, checklist: 'docs/execution-checklist.md' }));
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = main();
