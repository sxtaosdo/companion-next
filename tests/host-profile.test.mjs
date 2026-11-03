import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadHostProfile, coreStartupEnvironment } from '../scripts/host-profile.mjs';
test('first local setup is explicit and later launches never downgrade account mode', () => {
  const root = mkdtempSync(join(tmpdir(), 'companion-profile-')), file = join(root, 'host.json');
  try {
    assert.equal(loadHostProfile(file, { create: true }).authMode, 'local-auto');
    const value = JSON.parse(readFileSync(file)); value.authMode = 'account'; writeFileSync(file, JSON.stringify(value));
    assert.equal(loadHostProfile(file, { create: true }).authMode, 'account');
    value.authMode = 'anything'; writeFileSync(file, JSON.stringify(value));
    assert.throws(() => loadHostProfile(file), /HOST_PROFILE_INVALID/);
  } finally { rmSync(root, { recursive: true }); }
});
test('core startup needs no optional Windows resource binding and strips inherited generation', () => {
  const before = { CREATOR_AI_ICONS_MODE: 'generation', CREATOR_AI_ICONS_ENDPOINT: 'https://unapproved.example', DEBUG: 'test', WEKNORA_API_KEY: 'fixture' };
  const env = coreStartupEnvironment(before, { authMode: 'local-auto' });
  assert.equal(env.COMPANION_AUTH_MODE, 'local-auto'); assert.equal(env.CREATOR_AI_ICONS_MODE, undefined); assert.equal(env.DEBUG, undefined);
  assert.equal(before.CREATOR_AI_ICONS_MODE, 'generation');
  assert.throws(() => coreStartupEnvironment({ CREATOR_AI_DAEMON_URL: 'http://remote' }, { authMode: 'local-auto' }), /UNEXPECTED_DAEMON_URL/);
});
