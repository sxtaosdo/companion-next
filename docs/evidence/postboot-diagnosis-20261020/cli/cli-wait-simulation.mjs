import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const path = 'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js';
const bundle = await readFile(path, 'utf8');
const begin = bundle.indexOf('async function startDaemonAndDiscover()');
const end = bundle.indexOf('\nasync function resolveCompanionClient', begin);
if (begin < 0 || end < 0) throw Error('source not found');
const original = bundle.slice(begin, end);
async function simulate(readyAt, childAlive = true, proposedBudget = false, probeDuration = 0) {
  let now = 0, spawns = 0, kills = 0, polls = 0;
  const source = (proposedBudget ? original.replace('Date.now() + 8e3', 'Date.now() + 30e3') : original)
    .replace('import.meta.url', JSON.stringify('file:///C:/fixture-only/creator-ai.js'));
  const context = vm.createContext({
    Date: { now: () => now },
    DEFAULT_COMPANION_DAEMON_PORT: 32180,
    listTcpListeners: async () => [], resolve4: () => 'fixture-only-daemon.js', dirname3: x => x, fileURLToPath: x => x,
    readLocatorPid: async () => spawns && now >= readyAt ? 88 : 77,
    spawn3: () => { spawns++; return { pid: 88, unref() {}, kill() { kills++; } }; }, process: { execPath: 'fixture-node' },
    sleep: async ms => { now += ms; }, processAlive: pid => pid === 88 && childAlive,
    describeImmediateDaemonExit: async () => 'fixture child exited',
    CompanionApiClient: { discover: async () => { polls++; if (now < readyAt) throw Error('fetch failed'); return { status: async () => { now += probeDuration; return { phase: 'OPEN' }; } }; } },
  });
  let outcome;
  try { await vm.runInContext(source + '\nstartDaemonAndDiscover()', context); outcome = 'ready'; }
  catch (e) { outcome = e.message; }
  return { readyAt: Number.isFinite(readyAt) ? readyAt : 'never', proposedBudget, probeDuration, now, outcome, spawns, kills, polls };
}
const rows = [await simulate(13769.405), await simulate(Infinity), await simulate(0), await simulate(0, false), await simulate(13769.405, true, true), await simulate(0, true, false, 10000)];
if (!rows[0].outcome.includes('within 8 seconds') || rows[0].now !== 8000 || rows[0].kills !== 0 || !rows[1].outcome.includes('within 8 seconds') || rows[1].now !== 8000 || rows[2].outcome !== 'ready' || rows[2].now !== 100 || rows[3].outcome !== 'fixture child exited' || rows[3].now !== 100 || rows[4].outcome !== 'ready' || rows[4].now !== 13800 || rows[5].outcome !== 'ready' || rows[5].now !== 10100 || rows.some(x => x.spawns !== 1 || x.kills !== 0)) throw Error('unexpected simulation result');
await writeFile(new URL('./cli-wait-results.json', import.meta.url), JSON.stringify({ sourcePath: path, sha256: createHash('sha256').update(bundle).digest('hex'), functionSha256: createHash('sha256').update(original).digest('hex'), note: 'Actual installed function evaluated with fake process/clock/discovery. No daemon/process/network started. 30s row is only a proposed-budget experiment, not a product change.', rows }, null, 2));
console.log(JSON.stringify(rows));


