import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

/** Non-secret, explicit machine bindings. Optional generation configuration is separate. */
export function loadHostProfile(file, { create = false, nodeHost = process.execPath } = {}) {
  if (create && !existsSync(file)) {
    try { writeFileSync(file, JSON.stringify({ schemaVersion: 1, authMode: 'local-auto', nodeHost }, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('HOST_PROFILE_INVALID');
  const text = readFileSync(file, 'utf8'), value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1
    || !['local-auto', 'account'].includes(value.authMode)
    || Object.keys(value).some(key => !['schemaVersion', 'authMode', 'nodeHost'].includes(key))
    || typeof value.nodeHost !== 'string' || !isAbsolute(value.nodeHost) || !existsSync(value.nodeHost)) throw new Error('HOST_PROFILE_INVALID');
  const keys = [...text.matchAll(/("(?:\\.|[^"\\])*")\s*:/g)].map(match => JSON.parse(match[1]));
  if (keys.length !== 3 || new Set(keys).size !== 3) throw new Error('HOST_PROFILE_INVALID');
  return Object.freeze(value);
}

export function coreStartupEnvironment(env, profile) {
  if (!['local-auto', 'account'].includes(profile?.authMode)) throw new Error('HOST_PROFILE_INVALID');
  if (env.CREATOR_AI_DAEMON_URL && env.CREATOR_AI_DAEMON_URL !== 'http://127.0.0.1:32180') throw new Error('UNEXPECTED_DAEMON_URL');
  if (Boolean(env.CREATOR_AI_DAEMON_URL) !== Boolean(env.CREATOR_AI_DAEMON_TOKEN)) throw new Error('INCOMPLETE_DAEMON_OVERRIDE');
  const value = { ...env };
  for (const key of Object.keys(value)) {
    if (key.toUpperCase().startsWith('CREATOR_AI_ICONS_') || ['DEBUG', 'PWDEBUG', 'WEKNORA_API_KEY', 'KNOWLEDGE_SYNC_API_KEY'].includes(key.toUpperCase())) delete value[key];
  }
  value.COMPANION_AUTH_MODE = profile.authMode;
  value.CREATOR_AI_LOCAL_MODEL_LOOPBACK_ONLY = '1';
  return value;
}
