import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyManifest, verifyProductBuild } from '../scripts/task-preflight.mjs';

const head = 'a'.repeat(40), sha = value => createHash('sha256').update(value).digest('hex');
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'companion-preflight-'));
  writeFileSync(join(root, 'owned.txt'), 'source'); writeFileSync(join(root, 'protected.txt'), 'original');
  const manifest = { schemaVersion: 1, task: 'gate-test', owner: 'reviewer', expectedHead: head, scope: ['owned.txt'], parallelOwners: [{ owner: 'other', scope: ['other.txt'] }], files: [{ path: 'owned.txt', role: 'source', sha256: sha('source') }, { path: 'protected.txt', role: 'protected', sha256: sha('original') }] };
  try { run(root, manifest); } finally { assert.equal(resolve(dirname(root)), resolve(tmpdir())); assert.ok(root.includes('companion-preflight-')); rmSync(root, { recursive: true, force: true }); }
}
test('declared source and protected hashes pass and report their limited coverage', () => fixture((root, m) => {
  const result = verifyManifest(m, root, head); assert.equal(result.files.length, 2); assert.match(result.coverage, /Declared paths/);
}));
test('protected dirty edit fails instead of being overwritten', () => fixture((root, m) => {
  writeFileSync(join(root, 'protected.txt'), 'external edit'); assert.throws(() => verifyManifest(m, root, head), /FILE_BASELINE_MISMATCH/);
  assert.equal(m.files[1].sha256, sha('original'));
}));
test('a moved Git baseline blocks the task', () => fixture((root, m) => assert.throws(() => verifyManifest(m, root, 'b'.repeat(40)), /HEAD_BASELINE_MISMATCH/)));
test('overlapping owners and parent-directory claims are rejected', () => fixture((root, m) => {
  m.parallelOwners[0].scope = ['owned.txt']; assert.throws(() => verifyManifest(m, root, head), /OVERLAPPING_OWNER_SCOPE/);
  m.parallelOwners[0].scope = ['OWNED.TXT']; assert.throws(() => verifyManifest(m, root, head), /OVERLAPPING_OWNER_SCOPE/);
  m.scope = ['src']; m.parallelOwners[0].scope = ['src/views']; assert.throws(() => verifyManifest(m, root, head), /OVERLAPPING_OWNER_SCOPE/);
}));
test('scope traversal and an unclaimed source are rejected', () => fixture((root, m) => {
  m.scope = ['../other']; assert.throws(() => verifyManifest(m, root, head), /INVALID_SCOPE_PATH/);
  m.scope = ['another.txt']; assert.throws(() => verifyManifest(m, root, head), /SOURCE_OUTSIDE_OWNER_SCOPE/);
}));
test('artifact and evidence hashes remain separate from source claims', () => fixture((root, m) => {
  writeFileSync(join(root, 'artifact.txt'), 'bundle'); writeFileSync(join(root, 'evidence.json'), '{}');
  m.files.push({ path: 'artifact.txt', role: 'artifact', sha256: sha('bundle') }, { path: 'evidence.json', role: 'evidence', sha256: sha('{}') });
  assert.equal(verifyManifest(m, root, head).files.length, 4);
  writeFileSync(join(root, 'artifact.txt'), 'different bundle'); assert.throws(() => verifyManifest(m, root, head), /FILE_BASELINE_MISMATCH/);
}));
test('missing file and expected absence are distinguished', () => fixture((root, m) => {
  m.files.push({ path: 'future.txt', role: 'source', sha256: null }); m.scope.push('future.txt');
  assert.equal(verifyManifest(m, root, head).files.at(-1).sha256, null);
  writeFileSync(join(root, 'future.txt'), 'parallel creation'); assert.throws(() => verifyManifest(m, root, head), /FILE_BASELINE_MISMATCH/);
}));
test('artifact evidence cannot claim an absent file as verified', () => fixture((root, m) => {
  m.files.push({ path: 'not-produced.json', role: 'evidence', sha256: null });
  assert.throws(() => verifyManifest(m, root, head), /ARTIFACT_EVIDENCE_MUST_EXIST/);
}));

function productFixture() {
  const entry = Buffer.from('offline candidate, never executed'), packaged = Buffer.from(JSON.stringify({ name: 'test-host', version: '0.3.156', private: true }));
  const manifest = { schemaVersion: 'companion-product-build-v1', product: { name: 'Creator AI Companion', version: '0.3.156' }, build: { id: 'test-build', sourceRevision: head, packageName: 'test-host', packageVersion: '0.3.156', packageSha256: sha(packaged) }, entrySha256: sha(entry) };
  return { entry, packaged, manifest, expected: { entrySha256: sha(entry), packageSha256: sha(packaged), version: '0.3.156', sourceRevision: head } };
}
test('delivery consumes the strict product version shape and exact packaged bytes', () => {
  const f = productFixture(); assert.equal(verifyProductBuild(f.manifest, f.entry, f.packaged, f.expected).product.version, '0.3.156');
});
test('delivery rejects each extra audit field even when artifact hashes are self-consistent', () => {
  for (const key of ['sourceInputSha256', 'baseHostVersion', 'baselineEntrySha256', 'sourceRevisionMeaning']) {
    const f = productFixture(); f.manifest.build[key] = 'audit belongs elsewhere';
    assert.throws(() => verifyProductBuild(f.manifest, f.entry, f.packaged, f.expected), /PRODUCT_BUILD_STRICT_KEYS_REJECTED/, key);
  }
  const f = productFixture(); f.manifest.audit = {};
  assert.throws(() => verifyProductBuild(f.manifest, f.entry, f.packaged, f.expected), /PRODUCT_BUILD_STRICT_KEYS_REJECTED/);
});
test('delivery rejects changed entry and package bytes, not just manifest syntax', () => {
  const f = productFixture();
  assert.throws(() => verifyProductBuild(f.manifest, Buffer.from('other entry'), f.packaged, f.expected), /DELIVERY_ENTRY_IDENTITY_MISMATCH/);
  assert.throws(() => verifyProductBuild(f.manifest, f.entry, Buffer.from('{}'), f.expected), /HOST_PACKAGE_SCHEMA_REJECTED/);
  const other = Buffer.from(JSON.stringify({ name: 'test-host', version: '0.3.155' }));
  assert.throws(() => verifyProductBuild(f.manifest, f.entry, other, f.expected), /DELIVERY_PACKAGE_IDENTITY_MISMATCH/);
});
test('delivery rejects a valid-shaped artifact for the wrong declared release', () => {
  const f = productFixture(); f.expected.version = '0.3.155';
  assert.throws(() => verifyProductBuild(f.manifest, f.entry, f.packaged, f.expected), /DELIVERY_EXPECTATION_MISMATCH/);
});
