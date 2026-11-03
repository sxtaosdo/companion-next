import { execFile } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join, win32 } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {DEPENDENCIES} from '../../cocos-mcp/mcp/src/companion/dependency-contract.mjs';
import { loadHostProfile, coreStartupEnvironment } from './host-profile.mjs';

export const STARTUP_BUDGET_MS = 65_000;
export const READ_BUDGET_MS = 10_000;
export const BASE = DEPENDENCIES.daemon.origin;
export const NEXT = BASE + '/next/index.html#/overview';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = resolve(root, '../cocos-mcp/mcp');
export const DAEMON_ENTRY = join(host, DEPENDENCIES.daemon.entry);
export class StartupError extends Error { constructor(code, { stage, reason, exitCode, officialReason, officialExitCode } = {}) { super(code); this.code = code; if (stage) this.stage = stage; if (reason) this.reason = reason; if (Number.isSafeInteger(exitCode)) this.exitCode = exitCode; if (officialReason) this.officialReason = officialReason; if (Number.isSafeInteger(officialExitCode)) this.officialExitCode = officialExitCode; } }
export const LOCAL_STARTUP_CONFIG = join(root, 'companion-start.local.json');
export const LOCAL_HOST_PROFILE = join(root, 'companion-host.local.json');
// This allowlist is the Owner-approved machine binding, not a generation default.
export const APPROVED_STARTUP_CONFIG = Object.freeze({
  CREATOR_AI_ICONS_STUDIO_ROOT: 'D:/code/shidai3/P9000/ai-game-studio',
  CREATOR_AI_ICONS_PYTHON: 'C:/ai/ComfyUI/py/python.exe',
  CREATOR_AI_ICONS_NODE: 'C:/Program Files/nodejs/node.exe',
  CREATOR_AI_ICONS_CLI: 'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js',
  CREATOR_AI_ICONS_STORE: 'D:/CompanionData/art-task-store-v1',
  CREATOR_AI_ICONS_MODE: 'offline_import_only',
  CREATOR_AI_ICONS_ADOPTION_MANIFEST: 'D:/CompanionData/art-generation-acceptance-20261021/records/adoption-catalog.json',
});
// A separate, exact profile for the single Owner-approved local e2e acceptance.
// All other registered projects remain offline in the host adapter.
export const APPROVED_E2E_GENERATION_CONFIG = Object.freeze({
  ...APPROVED_STARTUP_CONFIG,
  CREATOR_AI_ICONS_MODE: 'generation',
  CREATOR_AI_ICONS_ENDPOINT: 'http://127.0.0.1:8188',
  CREATOR_AI_ICONS_LEASE: 'D:/CompanionData/art-generation-acceptance-20261021/generation-lease-20261023',
  CREATOR_AI_ICONS_GENERATION_PROJECT_IDS: '16ad921aa0fb06d6',
});
// Narrow Owner-approved ant toolbar scope; host validates three exact needs and references.
export const APPROVED_ANT_TOOLBAR_GENERATION_CONFIG = Object.freeze({...APPROVED_E2E_GENERATION_CONFIG,CREATOR_AI_ICONS_GENERATION_PROJECT_IDS:'04c4cde24ee76d83'});
export function validateStartupConfiguration(value) {
  const mode = value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'CREATOR_AI_ICONS_MODE') : undefined;
  const approved = mode && 'value' in mode && mode.value === 'generation' ? (Object.getOwnPropertyDescriptor(value,'CREATOR_AI_ICONS_GENERATION_PROJECT_IDS')?.value==='04c4cde24ee76d83'?APPROVED_ANT_TOOLBAR_GENERATION_CONFIG:APPROVED_E2E_GENERATION_CONFIG) : APPROVED_STARTUP_CONFIG;
  const expected = Object.keys(approved);
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== expected.length
    || Reflect.ownKeys(value).some(key => !expected.includes(key))) throw new StartupError('LOCAL_CONFIG_KEYS_INVALID');
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') throw new StartupError('LOCAL_CONFIG_VALUE_INVALID');
    if (!['CREATOR_AI_ICONS_MODE', 'CREATOR_AI_ICONS_ENDPOINT', 'CREATOR_AI_ICONS_GENERATION_PROJECT_IDS'].includes(key) && (!/^[A-Za-z]:[\\/]/.test(descriptor.value) || !win32.isAbsolute(descriptor.value))) throw new StartupError('LOCAL_CONFIG_PATH_INVALID');
    if (descriptor.value !== approved[key]) throw new StartupError(key === 'CREATOR_AI_ICONS_MODE' ? 'LOCAL_CONFIG_MODE_INVALID' : 'LOCAL_CONFIG_BINDING_NOT_APPROVED');
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
  // Remove every inherited icon setting before applying the selected exact approved binding.
  // Windows environment names are case-insensitive; unknown future icon settings also fail closed.
  for (const key of Object.keys(value)) if (key.toUpperCase().startsWith('CREATOR_AI_ICONS_') || key.toUpperCase() === 'CREATOR_AI_LOCAL_MODEL_LOOPBACK_ONLY') delete value[key];
  Object.assign(value, binding);
  // The existing model launcher may only bind loopback when started by Companion.
  value.CREATOR_AI_LOCAL_MODEL_LOOPBACK_ONLY = '1';
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
export function ensureAccountProvider(run = execFile) {
  return new Promise((done, reject) => {
    run(DEPENDENCIES.account.node,
      [DEPENDENCIES.account.entry, ...DEPENDENCIES.account.args],
      { cwd: DEPENDENCIES.account.cwd, windowsHide: true, timeout: 125_000, maxBuffer: 32 * 1024 },
      (error, stdout) => {
        if (error) { reject(new StartupError('ACCOUNT_PROVIDER_UNCONFIRMED')); return; }
        try { const value = JSON.parse(stdout); if (value.ready !== true || value.port !== DEPENDENCIES.account.port || !Number.isSafeInteger(value.pid) || value.pid <= 0) throw Error(); done(value); }
        catch { reject(new StartupError('ACCOUNT_PROVIDER_UNCONFIRMED')); }
      });
  });
}
export function officialStart(env, run = execFile) {
  return new Promise((done, reject) => {
    run(process.execPath, [join(host, 'dist/companion/creator-ai.js'), 'daemon', 'start', '--json'],
      { cwd: host, env, windowsHide: true, timeout: STARTUP_BUDGET_MS, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        // Decode the existing CLI protocol in memory; never retain or print output, URLs, tokens or stderr.
        let value;
        try { value = JSON.parse(stdout); } catch { /* A partial/missing response is not proof that a detached daemon failed. */ }
        const envelope = value?.schemaVersion === 'cocos-tool-result-v1';
        if (!error && envelope && value.status === 'PASSED' && value.tool === 'daemon_start') {
          const pid = value.data?.started === true ? value.data?.pid : undefined;
          if (pid !== undefined && (!Number.isSafeInteger(pid) || pid <= 0)) { reject(new StartupError('OFFICIAL_START_UNCONFIRMED', { stage: 'official-start', reason: 'cli-protocol' })); return; }
          done({ confirmed: true, ...(pid === undefined ? {} : { pid }) }); return;
        }
        const exitCode = Number.isSafeInteger(error?.code) ? error.code : undefined;
        const details = { stage: 'official-start', ...(exitCode === undefined ? {} : { exitCode }) };
        if (['ENOENT', 'EACCES', 'EPERM'].includes(error?.code)) { reject(new StartupError('OFFICIAL_START_FAILED', { ...details, reason: 'executable-unavailable' })); return; }
        const message = envelope && value.status === 'FAILED' && typeof value.error?.message === 'string' ? value.error.message : '';
        if (/DAEMON_PORT_OCCUPIED\b/.test(message)) { reject(new StartupError('OFFICIAL_START_PORT_OCCUPIED', { ...details, reason: 'port-occupied' })); return; }
        if (/daemon exited immediately/i.test(message)) { reject(new StartupError('OFFICIAL_START_FAILED', { ...details, reason: 'child-exited' })); return; }
        const reason = error?.killed || error?.signal || error?.code === 'ETIMEDOUT' ? 'cli-timeout'
          : /did not become ready within 8 seconds/.test(message) ? 'cli-readiness-deadline'
            : envelope && value.status === 'FAILED' ? 'cli-error' : 'cli-protocol';
        reject(new StartupError('OFFICIAL_START_UNCONFIRMED', { ...details, reason }));
      });
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
function validateReadySnapshot(status, expectedPid) {
  const identity = status?.identity;
  const sameEntry = typeof identity?.entryPath === 'string'
    && (process.platform === 'win32' ? win32.normalize(identity.entryPath).toLowerCase() === win32.normalize(DAEMON_ENTRY).toLowerCase() : resolve(identity.entryPath) === DAEMON_ENTRY);
  if (status?.schemaVersion !== 'companion-daemon-inflight-v1' || !Number.isSafeInteger(status.generation) || status.generation < 0
    || !Number.isSafeInteger(identity?.pid) || identity.pid <= 0 || !sameEntry
    || typeof identity.startupEpoch !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(identity.startupEpoch)
    || typeof identity.entrySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(identity.entrySha256)) throw new StartupError('DAEMON_IDENTITY_UNVERIFIED', { stage: 'health', reason: 'invalid-snapshot' });
  if (expectedPid !== undefined && identity.pid !== expectedPid) throw new StartupError('DAEMON_START_IDENTITY_CHANGED', { stage: 'health', reason: 'pid-mismatch' });
  if (status.phase !== 'OPEN') throw new StartupError('DAEMON_NOT_READY', { stage: 'health', reason: 'admission-not-open' });
}
function transientRead(error, stage) {
  if (error?.status === 409 && error?.code === 'DAEMON_GENERATION_CHANGED') return 'snapshot-generation-changed';
  if (error?.status === 408 || error?.status === 429 || error?.status >= 500) return 'health-temporarily-unavailable';
  const code = error?.cause?.code ?? error?.code;
  if (stage === 'discovery' && code === 'ENOENT') return 'locator-not-yet-present';
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(code)) return 'connection-not-yet-ready';
  return null;
}
/** One official start, then only existing authenticated discovery/health reads under a shared deadline. */
export async function waitForDaemonReadiness(discover, { timeoutMs = 10_000, pollMs = 100, now = Date.now, delay = ms => new Promise(done => setTimeout(done, ms)), expectedPid, once = false } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > STARTUP_BUDGET_MS || !Number.isFinite(pollMs) || pollMs < 1 || pollMs > 1000) throw new StartupError('READINESS_OPTIONS_INVALID');
  const deadline = now() + timeoutMs;
  let lastStage = 'discovery', lastReason = 'not-observed';
  let authRediscoveryUsed = false;
  while (now() < deadline) {
    let timer, stage = 'discovery';
    const remaining = Math.max(1, Math.min(READ_BUDGET_MS, deadline - now())), controller = new AbortController();
    try {
      const work = Promise.resolve().then(async () => {
        let client = await discover();
        if (controller.signal.aborted) throw new StartupError('DAEMON_READINESS_UNCONFIRMED', { stage, reason: 'deadline' });
        if (client?.baseUrl !== BASE) throw new StartupError('UNEXPECTED_DAEMON_URL', { stage, reason: 'unexpected-locator' });
        stage = 'health';
        // Reuse the installed authenticated request contract and keep the whole read cancellable.
        // Readiness identity is not a maintenance/drain proof and does not clear historical unknowns.
        let status;
        try { status = await client.request('GET', '/v1/daemon/inflight', undefined, controller.signal); }
        catch (error) {
          // The installed daemon listens before publishing its new locator. An old
          // locator can therefore authenticate against a new listener once. Reuse
          // secure discovery, but never replay a refusal with unchanged credentials.
          if (![401, 403].includes(error?.status) || authRediscoveryUsed || once
            || typeof client.apiToken !== 'string' || !client.apiToken) throw error;
          if (controller.signal.aborted || now() >= deadline) throw new StartupError('DAEMON_READINESS_UNCONFIRMED', { stage, reason: 'deadline' });
          authRediscoveryUsed = true;
          stage = 'discovery';
          let refreshed;
          try { refreshed = await discover(); }
          catch { throw new StartupError('DAEMON_AUTH_REJECTED', { stage, reason: 'credential-refresh-unconfirmed' }); }
          if (controller.signal.aborted || now() >= deadline) throw new StartupError('DAEMON_READINESS_UNCONFIRMED', { stage, reason: 'deadline' });
          if (refreshed?.baseUrl !== BASE) throw new StartupError('UNEXPECTED_DAEMON_URL', { stage, reason: 'unexpected-locator' });
          stage = 'health';
          if (typeof refreshed.apiToken !== 'string' || !refreshed.apiToken || refreshed.apiToken === client.apiToken) throw error;
          client = refreshed;
          status = await client.request('GET', '/v1/daemon/inflight', undefined, controller.signal);
        }
        if (controller.signal.aborted) throw new StartupError('DAEMON_READINESS_UNCONFIRMED', { stage, reason: 'deadline' });
        validateReadySnapshot(status, expectedPid);
        return { client, status };
      });
      return await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new StartupError('DAEMON_READINESS_UNCONFIRMED', { stage, reason: 'deadline' })); }, remaining); })]);
    } catch (error) {
      if (error instanceof StartupError) throw error;
      if (error?.status === 401 || error?.status === 403) throw new StartupError('DAEMON_AUTH_REJECTED', { stage, reason: 'authenticated-read-rejected' });
      const reason = transientRead(error, stage);
      if (!reason) throw new StartupError(stage === 'discovery' ? 'DAEMON_DISCOVERY_UNCONFIRMED' : 'DAEMON_IDENTITY_UNVERIFIED', { stage, reason: stage === 'discovery' ? 'locator-unreadable-or-invalid' : 'unrecognized-health-response' });
      lastStage = stage; lastReason = reason;
      if (once) break;
    } finally { clearTimeout(timer); }
    if (now() < deadline) await delay(Math.min(pollMs, Math.max(1, deadline - now())));
  }
  throw new StartupError('DAEMON_READINESS_UNCONFIRMED', { stage: lastStage, reason: lastReason });
}
export async function startCompanion({ noBrowser = false, feature = 'management' } = {}, deps) {
  if(!['management','workflow'].includes(feature))throw new StartupError('UNKNOWN_FEATURE');
  await deps.ensureAuth?.();
  // One budget owns both the official CLI call and subsequent read-only observation.
  // The CLI's detached child can outlive its internal 8s readiness deadline.
  const now = deps.readiness?.now ?? Date.now;
  const budgetMs = deps.readiness?.timeoutMs ?? STARTUP_BUDGET_MS;
  if (!Number.isFinite(budgetMs) || budgetMs < 1 || budgetMs > STARTUP_BUDGET_MS) throw new StartupError('READINESS_OPTIONS_INVALID');
  const deadline = now() + budgetMs;
  let startFailure, startReceipt;
  try { startReceipt = await deps.start(); }
  catch (error) {
    if (!(error instanceof StartupError) || !['OFFICIAL_START_UNCONFIRMED', 'OFFICIAL_START_FAILED', 'OFFICIAL_START_PORT_OCCUPIED'].includes(error.code)) throw error;
    startFailure = error;
  }
  let observed;
  try {
    const remaining = deadline - now();
    if (remaining <= 0) throw new StartupError('DAEMON_READINESS_UNCONFIRMED', { stage: 'official-start', reason: 'startup-budget-exhausted' });
    observed = await waitForDaemonReadiness(deps.discover, { ...deps.readiness, timeoutMs: remaining,
      expectedPid: startReceipt?.pid, once: !!startFailure && startFailure.code !== 'OFFICIAL_START_UNCONFIRMED' });
  } catch (error) {
    if (startFailure && startFailure.code !== 'OFFICIAL_START_UNCONFIRMED') throw startFailure;
    if (startFailure && error instanceof StartupError) throw new StartupError(error.code, {
      stage: error.stage, reason: error.reason,
      officialReason: ['cli-readiness-deadline', 'cli-timeout', 'cli-error', 'cli-protocol'].includes(startFailure.reason) ? startFailure.reason : 'cli-unconfirmed',
      officialExitCode: startFailure.exitCode,
    });
    throw error;
  }
  const { client, status } = observed, lateReady = !!startFailure;
  await deps.checkAuthMode?.(client);
  const receipt = { url: NEXT, pid: status.identity.pid, lateReady,
    ...(startFailure ? { officialReason: ['cli-readiness-deadline', 'cli-timeout', 'cli-error', 'cli-protocol'].includes(startFailure.reason) ? startFailure.reason : 'cli-unconfirmed' } : {}) };
  if(feature==='workflow'){
    if(typeof deps.checkWorkflow!=='function')throw new StartupError('WORKFLOW_DEPENDENCY_UNVERIFIED');
    // Explicit workflow readiness is read-only. It never grants permission to
    // start knowledge/model services or upgrades an executable trust binding.
    try{await deps.checkWorkflow();}catch(error){throw new StartupError('WORKFLOW_DEPENDENCY_NOT_READY',{stage:'workflow-preflight',reason:/^[A-Z_]+$/.test(error?.code??'')?error.code:'DEPENDENCY_UNCONFIRMED'});}
  }
  if (noBrowser) return receipt;
  return { ...receipt, ...await openNext(client, deps.createBrowser) };
}
export function startupFailureSummary(error) {
  const failure = error instanceof StartupError ? error : new StartupError('LOCAL_START_UNCONFIRMED');
  const state = /UNCONFIRMED|UNVERIFIED|IDENTITY_CHANGED/.test(failure.code) ? 'readiness unconfirmed' : 'startup failed';
  const details = [failure.stage && 'stage=' + failure.stage, failure.reason && 'reason=' + failure.reason, Number.isSafeInteger(failure.exitCode) && 'cliExit=' + failure.exitCode, failure.officialReason && 'officialReason=' + failure.officialReason, Number.isSafeInteger(failure.officialExitCode) && 'officialExit=' + failure.officialExitCode].filter(Boolean).join(', ');
  return `Companion Next ${state} [${failure.code}]${details ? ' (' + details + ')' : ''}. No restart or retry was issued; an unconfirmed daemon may still be starting.`;
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log('npm start [-- --no-browser] [--workflow]\nStarts/reuses account and Companion. --workflow also verifies the controlled executable and knowledge health; it does not start knowledge or model services. Closing the new browser window does not stop the daemon.'); return; }
  if (args.some(arg => !['--no-browser','--workflow'].includes(arg))) throw new StartupError('UNKNOWN_OPTION');
  const profile = loadHostProfile(LOCAL_HOST_PROFILE, { create: true });
  const env = existsSync(LOCAL_STARTUP_CONFIG)
    ? { ...startupEnvironment(), COMPANION_AUTH_MODE: profile.authMode }
    : coreStartupEnvironment(process.env, profile);
  console.log('Machine profile loaded (' + profile.authMode + '). Existing daemon identity is verified before reuse; optional resource services are not started.');
  delete process.env.DEBUG; delete process.env.PWDEBUG;
  const { CompanionApiClient } = await import(pathToFileURL(join(host, 'dist/companion-api-client.js')).href);
  const result = await startCompanion({ noBrowser: args.includes('--no-browser'),feature:args.includes('--workflow')?'workflow':'management' }, {
    checkWorkflow:async()=>{const {createSubmissionPreflight}=await import(pathToFileURL(join(host,'src/companion/workflow-operations/integration/submission-preflight.mjs')).href);await createSubmissionPreflight()();},
    ensureAuth: () => profile.authMode === 'account' ? ensureAccountProvider() : Promise.resolve(), start: () => officialStart(env), discover: () => CompanionApiClient.discover(),
    checkAuthMode: async client => {
      const config = await client.request('GET', '/api/auth/config', undefined, AbortSignal.timeout(5000));
      if (config?.authMode !== profile.authMode) throw new StartupError('HOST_AUTH_MODE_MISMATCH', { stage: 'auth-mode', reason: 'existing-daemon-requires-normal-maintenance' });
    },
    createBrowser: async () => {
      const { chromium } = createRequire(join(host, 'package.json'))('playwright');
      const browserEnv = { ...env };
      for (const name of ['CREATOR_AI_DAEMON_TOKEN', 'COMPANION_KNOWLEDGE_CREDENTIAL_FILE', 'WEKNORA_API_KEY', 'KNOWLEDGE_SYNC_API_KEY']) delete browserEnv[name];
      return chromium.launch({ channel: 'msedge', headless: false, env: browserEnv });
    },
  });
  if (result.lateReady) console.log('Official CLI did not confirm startup (' + result.officialReason + '); the authenticated daemon is now OPEN. No second start was issued.');
  console.log('Companion Next ready (PID ' + result.pid + '): ' + result.url);
  if (result.browser) {
    console.log('Opened a separate Edge window. Close that window to finish this command; the Companion service remains running.');
    await waitForOwnedBrowser(result.browser);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Do not echo CLI output, credentials, auth tickets or Playwright request diagnostics.
    if (error instanceof StartupError && error.code.startsWith('LOCAL_CONFIG_')) console.error('Check companion-start.local.json against companion-start.example.json; only the approved fixed offline or e2e generation bindings are accepted.');
    console.error(startupFailureSummary(error));
    process.exitCode = 1;
  });
}
