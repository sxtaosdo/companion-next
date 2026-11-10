import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRoot, verifyRuntime } from '../scripts/runtime-gate.mjs';

const gate = resolve(projectRoot, 'scripts/runtime-gate.mjs');
const run = (...args) => spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', timeout: 15000, windowsHide: true });

test('frontend and host require the installed Node 26 baseline', () => {
  for (const lane of ['frontend', 'host-start']) {
    for (const version of ['26.13.0', '26.14.1']) assert.doesNotThrow(() => verifyRuntime(lane, version, '147'));
    for (const version of ['22.23.3', '25.9.0', '26.12.9', '27.0.0']) {
      assert.throws(() => verifyRuntime(lane, version, '147'), /REQUIRES_NODE_26/);
    }
  }
  assert.throws(() => verifyRuntime('host-start', '26.13.0', '141'), /HOST_START_REQUIRES/);
  assert.throws(() => verifyRuntime('anything', '26.13.0', '147'), /UNKNOWN_RUNTIME_LANE/);
});
test('the local Node executes a child and produces lock evidence', () => {
  const result = run('frontend', '--', '--eval', 'console.log(JSON.stringify({execPath:process.execPath,node:process.version}))');
  assert.equal(result.status, 0, result.stderr);
  const child = JSON.parse(result.stdout.trim()), receipt = JSON.parse(result.stderr.trim());
  assert.equal(child.execPath, process.execPath);
  assert.equal(child.execPath, receipt.execPath);
  assert.equal(child.node, process.version);
  assert.match(receipt.lockSha256, /^[a-f0-9]{64}$/);
  assert.equal(receipt.lockfileVersion, 3);
});
test('child failure remains failure', () => assert.equal(run('frontend', '--', '--eval', 'process.exitCode=7').status, 7));
test('the host check verifies the same Node and ABI without starting a service', () => {
  const allowed = run('host-start', '--check');
  assert.equal(allowed.status, 0, allowed.stderr);
  const receipt = JSON.parse(allowed.stdout);
  assert.equal(receipt.execPath, process.execPath);
  assert.equal(receipt.modulesAbi, '147');
});
test('all package test/watch/build entries gate first; start uses the separate lane', () => {
  const { scripts } = JSON.parse(readFileSync(resolve(projectRoot, 'package.json')));
  for (const [name, command] of Object.entries(scripts)) {
    if (name === 'test' || name.startsWith('test:') || name === 'build' || name.startsWith('build:')) {
      assert.match(command, /^node scripts\/runtime-gate\.mjs frontend -- /, name);
      for (const part of command.split(' && ')) assert.match(part, /^node scripts\/runtime-gate\.mjs frontend -- /, name);
    }
  }
  assert.equal(scripts.start, 'node scripts/runtime-gate.mjs host-start -- scripts/start-companion.mjs');
});
