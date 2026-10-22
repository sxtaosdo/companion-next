import { execFile } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join, win32 } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BASE = 'http://127.0.0.1:32180';
export const NEXT = BASE + '/next/index.html#/overview';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = resolve(root, '../cocos-mcp/mcp');
export class StartupError extends Error { constructor(code) { super(code); this.code = code; } }
export const LOCAL_STARTUP_CONFIG = join(root, 'companion-start.local.json');
// This allowlist is the Owner-approved machine binding, not a generation default.
export const APPROVED_STARTUP_CONFIG = Object.freeze({
  CREATOR_AI_ICONS_STUDIO_ROOT: 'D:/code/shidai3/P9000/ai-game-studio',
  CREATOR_AI_ICONS_PYTHON: 'C:/ai/ComfyUI/py/python.exe',
  CREATOR_AI_ICONS_NODE: 'C:/Program Files/nodejs/node.exe',
  CREATOR_AI_ICONS_CLI: 'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js',
  CREATOR_AI_ICONS_STORE: 'D:/CompanionData/art-task-store-v1',
  CREATOR_AI_ICONS_MODE: 'offline_import_only',
});
export function validateStartupConfiguration(value) {
  const expected = Object.keys(APPROVED_STARTUP_CONFIG);
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== expected.length
    || Reflect.ownKeys(value).some(key => !expected.includes(key))) throw new StartupError('LOCAL_CONFIG_KEYS_INVALID');
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') throw new StartupError('LOCAL_CONFIG_VALUE_INVALID');
    if (key !== 'CREATOR_AI_ICONS_MODE' && (!/^[A-Za-z]:[\\/]/.test(descriptor.value) || !win32.isAbsolute(descriptor.value))) throw new StartupError('LOCAL_CONFIG_PATH_INVALID');
    if (descriptor.value !== APPROVED_STARTUP_CONFIG[key]) throw new StartupError(key === 'CREATOR_AI_ICONS_MODE' ? 'LOCAL_CONFIG_MODE_INVALID' : 'LOCAL_CONFIG_BINDING_NOT_APPROVED');
  }
  return Object.freeze({ ...value });
}
export function loadStartupConfiguration(file = LOCAL_STARTUP_CONFIG) {
  let stat, raw, text;
  try { stat = lstatSync(file); }
  catch (error) { throw new StartupError(error?.code === 'ENOENT' ? 'LOCAL_CONFIG_MISSING' : 'LOCAL_CONFIG_UNREADABLE'); }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024) throw new StartupError('LOCAL_CONFIG_FILE_INVALID');
  try { text = readFileSync(file, 'utf8'); raw = JSON.parse(text); }
  catch { throw new StartupError('LOCAL_CONFIG_JSON_INVALID'); }
  const binding = validateStartupConfiguration(raw);
  // The schema is flat with string values. Repeated JSON keys must not silently replace an approved field.
  const keys = [...text.matchAll(/("(?:\\.|[^"\\])*")\s*:/g)].map(match => JSON.parse(match[1]));
  if (keys.length !== Object.keys(binding).length || new Set(keys).size !== keys.length) throw new StartupError('LOCAL_CONFIG_KEYS_INVALID');
  return binding;
}

export function startupEnvironment(env = process.env, configuration) {
  if (env.CREATOR_AI_DAEMON_URL && env.CREATOR_AI_DAEMON_URL !== BASE) throw new StartupError('UNEXPECTED_DAEMON_URL');
  if (Boolean(env.CREATOR_AI_DAEMON_URL) !== Boolean(env.CREATOR_AI_DAEMON_TOKEN)) throw new StartupError('INCOMPLETE_DAEMON_OVERRIDE');
  const binding = validateStartupConfiguration(configuration ?? loadStartupConfiguration());
  const value = { ...env };
  // Remove every inherited icon setting before applying the exact approved offline binding.
  // Windows environment names are case-insensitive; unknown future icon settings also fail closed.
  for (const key of Object.keys(value)) if (key.toUpperCase().startsWith('CREATOR_AI_ICONS_')) delete value[key];
  Object.assign(value, binding);
  // These are the existing host bindings, scoped to this child process only.
  value.CREATOR_AI_OWNER_PYTHON ??= 'C:/Users/33272/miniconda3/python.exe';
  value.CREATOR_AI_OWNER_BRIDGE_ROOT ??= root;
  value.CREATOR_AI_OWNER_REVIEW_ROOT ??= resolve(root, '../public-image-review');
  value.CREATOR_AI_OWNER_CACHE ??= join(env.TEMP ?? env.TMP ?? root, 'companion-owner-host-implementation-20261018', 'directed-acceptance-cache');
  const reader = 'D:/services/weknora/cli/private/pilot-recovery-reader.dpapi';
  if (!value.COMPANION_KNOWLEDGE_CREDENTIAL_FILE && existsSync(reader)) value.COMPANION_KNOWLEDGE_CREDENTIAL_FILE = reader;
  // Prevent debug logging of the one-time authentication URL. No secrets are persisted by this helper.
  delete value.DEBUG; delete value.PWDEBUG;
  delete value.WEKNORA_API_KEY; delete value.KNOWLEDGE_SYNC_API_KEY;
  return value;
}
function officialStart(env) {
  return new Promise((done, reject) => {
    execFile(process.execPath, [join(host, 'dist/companion/creator-ai.js'), 'daemon', 'start'],
      { cwd: host, env, windowsHide: true, timeout: 65_000, maxBuffer: 1024 * 1024 },
      error => error ? reject(new StartupError('OFFICIAL_START_UNCONFIRMED')) : done());
  });
}
export async function openNext(client, createBrowser) {
  if (client.baseUrl !== BASE) throw new StartupError('UNEXPECTED_DAEMON_URL');
  let browser;
  try {
    browser = await createBrowser();
    const context = await browser.newContext({ viewport: { width: 1384, height: 1000 }, serviceWorkers: 'block' });
    const session = await client.request('POST', '/v1/ui/session', {}, AbortSignal.timeout(10_000));
    const ticket = new URL(session?.url);
    if (ticket.origin !== BASE || ticket.pathname !== '/auth' || !ticket.searchParams.get('code') || ticket.username || ticket.password || ticket.hash) throw new StartupError('INVALID_UI_TICKET');
    // Consume authentication through the original handler without rendering its old '/' UI.
    const auth = await context.request.get(ticket.href, { maxRedirects: 0, timeout: 10_000 });
    if (auth.status() !== 302 || auth.headers().location !== '/') throw new StartupError('UI_AUTH_FAILED');
    const index = await context.request.get(BASE + '/next/index.html', { timeout: 10_000 });
    if (index.status() !== 200) throw new StartupError('NEXT_NOT_DEPLOYED');
    const page = await context.newPage();
    const response = await page.goto(NEXT, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!response || response.status() !== 200 || new URL(page.url()).origin !== BASE || new URL(page.url()).pathname !== '/next/index.html') throw new StartupError('NEXT_OPEN_FAILED');
    return { browser, page };
  } catch (error) {
    await browser?.close().catch(() => {});
    throw error instanceof StartupError ? error : new StartupError('UI_OPEN_FAILED');
  }
}
export async function discoverBounded(discover, timeoutMs = 10_000) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(discover), new Promise((_, reject) => { timer = setTimeout(() => reject(new StartupError('DISCOVERY_UNCONFIRMED')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
export async function waitForOwnedBrowser(browser) {
  const finish = () => { void browser.close().catch(() => {}); };
  process.once('SIGINT', finish); process.once('SIGTERM', finish);
  try { if (browser.isConnected()) await new Promise(done => browser.once('disconnected', done)); }
  finally { process.removeListener('SIGINT', finish); process.removeListener('SIGTERM', finish); }
}
export async function startCompanion({ noBrowser = false } = {}, deps) {
  let lateReady = false;
  try { await deps.start(); }
  catch (error) {
    if (!(error instanceof StartupError) || error.code !== 'OFFICIAL_START_UNCONFIRMED') throw error;
    // Observe only: the single official start may have completed after its own wait.
    lateReady = true;
  }
  const client = await discoverBounded(deps.discover);
  if (client.baseUrl !== BASE) throw new StartupError('UNEXPECTED_DAEMON_URL');
  // Page polling can change the read-only snapshot generation after startup.
  // Re-observe only that specific race; never start again or replay a mutation.
  const deadline = Date.now() + 10_000;
  let status;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { status = await client.request('GET', '/v1/daemon/inflight', undefined, AbortSignal.timeout(Math.max(1, deadline - Date.now()))); break; }
    catch (error) {
      if (error?.status !== 409 || error?.code !== 'DAEMON_GENERATION_CHANGED' || attempt === 4 || Date.now() >= deadline) throw error;
      await new Promise(done => setTimeout(done, Math.min(100, Math.max(1, deadline - Date.now()))));
    }
  }
  if (status?.phase !== 'OPEN' || !Number.isSafeInteger(status?.identity?.pid) || status.identity.pid <= 0) throw new StartupError('DAEMON_NOT_READY');
  if (noBrowser) return { url: NEXT, pid: status.identity.pid, lateReady };
  return { url: NEXT, pid: status.identity.pid, lateReady, ...await openNext(client, deps.createBrowser) };
}
export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log('npm start [-- --no-browser]\nStarts/reuses the installed Companion and opens only Companion Next. Closing the new browser window does not stop the daemon.'); return; }
  if (args.some(arg => arg !== '--no-browser')) throw new StartupError('UNKNOWN_OPTION');
  const env = startupEnvironment();
  console.log('Project-local offline resource configuration loaded. New daemon processes use it; an already running daemon keeps its configuration until an approved maintenance restart.');
  delete process.env.DEBUG; delete process.env.PWDEBUG;
  const { CompanionApiClient } = await import(pathToFileURL(join(host, 'dist/companion-api-client.js')).href);
  const result = await startCompanion({ noBrowser: args.includes('--no-browser') }, {
    start: () => officialStart(env), discover: () => CompanionApiClient.discover(),
    createBrowser: async () => {
      const { chromium } = createRequire(join(host, 'package.json'))('playwright');
      const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
      if (!executablePath) throw new StartupError('EDGE_NOT_FOUND');
      const browserEnv = { ...env };
      for (const name of ['CREATOR_AI_DAEMON_TOKEN', 'COMPANION_KNOWLEDGE_CREDENTIAL_FILE', 'WEKNORA_API_KEY', 'KNOWLEDGE_SYNC_API_KEY']) delete browserEnv[name];
      return chromium.launch({ executablePath, headless: false, env: browserEnv });
    },
  });
  if (result.lateReady) console.log('Official CLI did not confirm startup; the authenticated daemon is now OPEN. No second start was issued.');
  console.log('Companion Next ready (PID ' + result.pid + '): ' + result.url);
  if (result.browser) {
    console.log('Opened a separate Edge window. Close that window to finish this command; the Companion service remains running.');
    await waitForOwnedBrowser(result.browser);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Do not echo CLI output, credentials, auth tickets or Playwright request diagnostics.
    if (error instanceof StartupError && error.code.startsWith('LOCAL_CONFIG_')) console.error('Check companion-start.local.json against companion-start.example.json; only the six approved offline bindings are accepted.');
    console.error('Companion Next startup failed [' + (error instanceof StartupError ? error.code : 'LOCAL_START_FAILED') + ']. No restart or retry was issued; a timed-out daemon may still be starting.');
    process.exitCode = 1;
  });
}
