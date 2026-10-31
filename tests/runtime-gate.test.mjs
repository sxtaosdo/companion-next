import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRoot, verifyRuntime } from '../scripts/runtime-gate.mjs';

const gate = resolve(projectRoot, 'scripts/runtime-gate.mjs');
const node22 = process.env.COMPANION_GATE_TEST_NODE22 ?? process.execPath;
const node25 = process.env.COMPANION_GATE_TEST_NODE25;
const run = (node, ...args) => spawnSync(node, [gate, ...args], { encoding: 'utf8', timeout: 15000, windowsHide: true });

test('frontend admission follows the declared 22.12+ within 22 contract', () => {
  for (const version of ['22.12.0', '22.23.3']) assert.doesNotThrow(() => verifyRuntime('frontend', version, '127'));
  for (const version of ['20.20.0', '22.11.9', '24.1.0', '25.2.1']) assert.throws(() => verifyRuntime('frontend', version, '141'), /FRONTEND_REQUIRES/);
});
test('host requires both its version and native ABI', () => {
  assert.doesNotThrow(() => verifyRuntime('host-start', '25.2.1', '141'));
  assert.throws(() => verifyRuntime('host-start', '22.23.3', '127'), /HOST_START_REQUIRES/);
  assert.throws(() => verifyRuntime('host-start', '25.2.1', '127'), /HOST_START_REQUIRES/);
});
test('unknown lane cannot launch a child', () => assert.throws(() => verifyRuntime('anything', '22.23.3', '127'), /UNKNOWN_RUNTIME_LANE/));
test('real Node22 proceeds using the verified executable, with lock evidence', () => {
  const result = run(node22, 'frontend', '--', '--eval', 'console.log(JSON.stringify({marker:"SAFE_GATE_CHILD",execPath:process.execPath,node:process.version}))');
  assert.equal(result.status, 0, result.stderr);
  const child = JSON.parse(result.stdout.trim()), receipt = JSON.parse(result.stderr.trim());
  assert.equal(child.marker, 'SAFE_GATE_CHILD');
  assert.equal(child.execPath, receipt.execPath);
  assert.match(child.node, /^v22\./);
  assert.match(receipt.lockSha256, /^[a-f0-9]{64}$/);
  assert.equal(receipt.lockfileVersion, 3);
});
test('child failure remains failure', () => assert.equal(run(node22, 'frontend', '--', '--eval', 'process.exitCode=7').status, 7));
test('real Node22 is blocked from host-start before child execution', () => {
  const result = run(node22, 'host-start', '--', '--eval', 'console.log("MUST_NOT_RUN")');
  assert.equal(result.status, 1); assert.doesNotMatch(result.stdout, /MUST_NOT_RUN/); assert.match(result.stderr, /HOST_START_REQUIRES/);
});
test('real Node25 rejects frontend before the child, while host check stays read-only', () => {
  assert.ok(node25, 'Set COMPANION_GATE_TEST_NODE25 to the existing host executable; no silent skip.');
  const blocked = run(node25, 'frontend', '--', '--eval', 'console.log("MUST_NOT_RUN")');
  assert.equal(blocked.status, 1); assert.doesNotMatch(blocked.stdout, /MUST_NOT_RUN/); assert.match(blocked.stderr, /FRONTEND_REQUIRES/);
  const allowed = run(node25, 'host-start', '--check');
  assert.equal(allowed.status, 0, allowed.stderr); assert.equal(JSON.parse(allowed.stdout).modulesAbi, '141');
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
