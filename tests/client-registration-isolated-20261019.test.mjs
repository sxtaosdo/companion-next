// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createProjectConnectionsProvider } from '../src/adapters/project-connections';
// This suite never invokes a client executable, home discovery, HTTP, or a listener.
// Four JSON writers run their real default fs parser/writer against explicit Temp paths.
// Codex uses a fictional execFile ledger: it tests adapter control flow, NOT the CLI parser.
const hostDirectory = resolve('..', 'cocos-mcp', 'mcp', 'dist', 'companion');
const bundlePath = join(hostDirectory, 'companion-daemon.js');
const mapPath = bundlePath + '.map';
const expectedBundleSha = '103ea371f13b784d7ec0263ae4714906a8ea67ebc4ddc7e0ac9c7cc5439b801c';
const expectedMapSha = '64828d458dd0f327bfc65cf607f1271966258fc50da51c41a4bba28a19d92b0e';
const sourceHashes = {
    codex: 'ca451af9431f0cda32fa762946fa4094289233b44bdd203b51a42a37859cf648',
    cursor: 'db8edad6e720179ffce119180d60e6f096118ae5ed9daf748421701be0e6aeb5',
    trae: '85c5ce19838d74a66c90ba1958a56ec12c7301345f7a8f8295ffc775d8eec178',
    kiro: '69978e84a1205e5d256bf75d7517d342aa0c309b39ea88e66eb4326b891c162c',
    vscode: '251ccf873751d71ebec4ca92c0138ccd9db46d61348d8913f196b9cec7f4d66c',
};
const jsonTargets = ['cursor', 'trae', 'kiro', 'vscode'];
const artifactRoot = join(tmpdir(), 'companion-client-registration-isolated-20261019');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const modules = {};
const evidence = [];
let fixtureRoot = '', sequence = 0, hostHttpSource = '';
const id = '0123456789abcdef';
function writer(target) {
    return modules[target][`configure${target === 'vscode' ? 'Vscode' : target[0].toUpperCase() + target.slice(1)}Mcp`];
}
const codex = () => modules.codex.configureCodexMcp;
const stableName = () => modules.codex.stableMcpName('Fictional isolated project', id);
async function fixture(target) {
    const home = join(fixtureRoot, `case-${sequence++}`, 'fictional-home');
    const projectPath = join(home, 'projects', 'fictional-project');
    const creatorAiPath = join(home, 'bin', 'fictional-creator-ai');
    const configPath = join(home, '.isolated-' + target, 'mcp.json');
    await mkdir(dirname(creatorAiPath), { recursive: true });
    await writeFile(creatorAiPath, 'not executable; access check only\n');
    await mkdir(dirname(configPath), { recursive: true });
    const input = { projectId: id, projectName: 'Fictional isolated project', projectPath, creatorAiPath, configPath };
    return { home, input, configPath };
}
const seed = () => ({ fictionalPreference: { keep: true }, mcpServers: { unrelated: { command: 'fictional-other', args: ['keep'] } } });
const seedText = () => JSON.stringify(seed(), null, 2) + '\n';
describe.skipIf(!existsSync(bundlePath) || !existsSync(mapPath))('installed client registration: isolated fs, no real client execution', () => {
    beforeAll(async () => {
        expect(sha(await readFile(bundlePath)), 'installed daemon changed; re-review before rebinding').toBe(expectedBundleSha);
        const rawMap = await readFile(mapPath);
        expect(sha(rawMap), 'installed source map changed; re-review before rebinding').toBe(expectedMapSha);
        const map = JSON.parse(rawMap.toString('utf8'));
        await mkdir(artifactRoot, { recursive: true });
        fixtureRoot = await mkdtemp(join(artifactRoot, 'fixture-'));
        const extracted = join(fixtureRoot, 'reviewed-host-sources');
        await mkdir(extracted);
        await writeFile(join(extracted, 'package.json'), '{"type":"module"}\n');
        for (const target of Object.keys(sourceHashes)) {
            const matches = map.sources.flatMap((name, i) => name.endsWith('/' + target + '-configurator.ts') ? [i] : []);
            expect(matches).toHaveLength(1);
            const source = map.sourcesContent[matches[0]];
            expect(sha(source)).toBe(sourceHashes[target]);
            // Type erasure only: unchanged imports resolve to the other extracted modules.
            const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
            await writeFile(join(extracted, target + '-configurator.js'), output);
        }
        for (const target of Object.keys(sourceHashes)) {
            modules[target] = await import(/* @vite-ignore */ pathToFileURL(join(extracted, target + '-configurator.js')).href);
        }
        const httpIndex = map.sources.findIndex(name => name.endsWith('/companion/http-server.ts'));
        expect(httpIndex).toBeGreaterThanOrEqual(0);
        hostHttpSource = map.sourcesContent[httpIndex];
    });
    afterAll(async () => {
        if (!fixtureRoot)
            return;
        try {
            // Outside it.fails: an unrelated early exception must not count as a reproduced gap.
            const partial = evidence.filter(item => item.case === 'partial-write-injected-EIO');
            expect(partial).toHaveLength(4);
            expect(new Set(partial.map(item => item.target))).toEqual(new Set(jsonTargets));
            expect(partial.every(item => item.originalRestored === false)).toBe(true);
            const addFailure = evidence.filter(item => item.case === 'add-fail-after-remove');
            expect(addFailure).toHaveLength(1);
            expect(addFailure[0]).toMatchObject({ target: 'codex', originalTransportRestored: false });
            await writeFile(join(artifactRoot, 'evidence.json'), JSON.stringify({
                schema: 'isolated-client-registration-20261019', bundleSha256: expectedBundleSha, mapSha256: expectedMapSha,
                sourceSha256: sourceHashes, jsonIo: 'real parser/default fs writer at explicit synthetic Temp paths',
                codexIo: 'injected fictional exec ledger only; real CLI/config parser NOT exercised',
                faultInjection: 'writeText writes a partial synthetic file then throws EIO; no real filesystem/device fault',
                knownHostGaps: ['JSON write has no rollback after partial I/O', 'Codex legacy remove followed by add rejection has no rollback'],
                noNetwork: true, noListener: true, noRealClientConfig: true, cases: evidence,
            }, null, 2) + '\n');
        } finally {
            const absolute = resolve(fixtureRoot), allowed = resolve(artifactRoot) + sep;
            if (!absolute.startsWith(allowed) || !absolute.split(sep).at(-1).startsWith('fixture-'))
                throw new Error('unsafe fixture cleanup');
            await rm(absolute, { recursive: true, force: true });
        }
    });
    it('uses only explicit synthetic path algorithms; a status-only HTTP API is not present', () => {
        const home = join(fixtureRoot, 'path-only-home'), projectPath = join(home, 'project');
        expect(modules.cursor.cursorMcpConfigPath(home)).toBe(join(home, '.cursor', 'mcp.json'));
        expect(modules.trae.traeMcpConfigPath(home)).toBe(join(home, '.trae', 'mcp.json'));
        expect(modules.kiro.kiroMcpConfigPath(home)).toBe(join(home, '.kiro', 'settings', 'mcp.json'));
        const vscodePath = modules.vscode.vscodeMcpConfigPath;
        expect(vscodePath({ home, projectPath })).toBe(join(projectPath, '.vscode', 'mcp.json'));
        expect(vscodePath({ home })).toBe(join(home, '.vscode', 'mcp.json'));
        // These assertions document inspected installed routes; no GET or POST is sent.
        expect(hostHttpSource).toContain('if (mcpRegister && request.method === "POST")');
        expect(hostHttpSource).toContain('if (tail === "mcp/register" && method === "POST")');
        expect(hostHttpSource).not.toMatch(/(?:mcpRegister|tail === "mcp\/(?:register|status)").{0,80}(?:method === "GET"|request.method === "GET")/);
    });
    it.each(jsonTargets)('%s: real JSON fs write preserves unrelated data and is idempotent', async (target) => {
        const { input, configPath } = await fixture(target);
        await writeFile(configPath, seedText());
        const first = await writer(target)(input);
        expect(first).toMatchObject({ name: stableName(), projectId: id, changed: true, configPath });
        const disk = JSON.parse(await readFile(configPath, 'utf8'));
        expect(disk.fictionalPreference).toEqual(seed().fictionalPreference);
        expect(disk.mcpServers.unrelated).toEqual(seed().mcpServers.unrelated);
        expect(disk.mcpServers[stableName()]).toEqual({ command: input.creatorAiPath, args: ['mcp', '--project', id] });
        const before = await readFile(configPath);
        expect((await writer(target)(input)).changed).toBe(false);
        expect(await readFile(configPath)).toEqual(before);
        evidence.push({ target, case: 'real-write-and-idempotence', preserved: true, changed: [true, false], fileSha256: sha(before) });
    });
    it.each(jsonTargets)('%s: real conflicting config rejects without changing any bytes', async (target) => {
        const { input, configPath } = await fixture(target);
        const value = { ...seed(), mcpServers: { ...seed().mcpServers, [stableName()]: { command: 'fictional-foreign', args: ['foreign'] } } };
        const before = JSON.stringify(value, null, 3) + '\n';
        await writeFile(configPath, before);
        await expect(writer(target)(input)).rejects.toThrow();
        expect(await readFile(configPath, 'utf8')).toBe(before);
        evidence.push({ target, case: 'conflict', unchanged: true, fileSha256: sha(before) });
    });
    it.each(jsonTargets)('%s: invalid JSON and pre-write filesystem failure preserve original bytes', async (target) => {
        const { input, configPath } = await fixture(target);
        const invalid = '{ fictional malformed config\n';
        await writeFile(configPath, invalid);
        await expect(writer(target)(input)).rejects.toThrow();
        expect(await readFile(configPath, 'utf8')).toBe(invalid);
        await writeFile(configPath, seedText());
        const noCommand = { ...input, creatorAiPath: join(dirname(input.creatorAiPath), 'absent-fictional-command') };
        await expect(writer(target)(noCommand)).rejects.toThrow();
        expect(await readFile(configPath, 'utf8')).toBe(seedText());
        evidence.push({ target, case: 'invalid-and-before-write-failure', unchanged: true });
    });
    it.each(jsonTargets)('%s: real installed writer receipt is accepted by Next via injected transport only', async (target) => {
        const { input, configPath } = await fixture(target);
        const transport = vi.fn(async (path, init) => {
            expect(path).toBe(`/api/projects/${id}/mcp/register`);
            expect(init.method).toBe('POST');
            expect(init.body).toBe(JSON.stringify({ target }));
            const receipt = await writer(target)(input);
            return new Response(JSON.stringify({ target, ...receipt }), { headers: { 'Content-Type': 'application/json' } });
        });
        const api = createProjectConnectionsProvider({ fetch: transport });
        const request = { kind: 'client', projectId: id, target };
        const reply = await api.run(request);
        await api.waitForIdle();
        expect(reply.key).toBe(JSON.stringify(request));
        expect(JSON.parse(reply.text)).toMatchObject({ target, changed: true });
        expect(transport).toHaveBeenCalledTimes(1);
        expect(existsSync(configPath)).toBe(true);
        evidence.push({ target, case: 'Next-receipt-contract', transport: 'injected; zero HTTP', accepted: true });
    });
    // Expected failures encode desired guarantees, not acceptance. They must be revisited
    // only after an authorized host fix; this task does not change the installed writer.
    it.fails.each(jsonTargets)('KNOWN HOST GAP %s: partial write failure would restore the original bytes', async (target) => {
        const { input, configPath } = await fixture(target);
        const before = seedText();
        await writeFile(configPath, before);
        await expect(writer(target)(input, { writeText: async (path, text) => {
                expect(path).toBe(configPath);
                await writeFile(path, text.slice(0, 19));
                throw Object.assign(new Error('fictional injected partial write'), { code: 'EIO' });
            } })).rejects.toThrow('fictional injected partial write');
        const after = await readFile(configPath, 'utf8');
        evidence.push({ target, case: 'partial-write-injected-EIO', originalRestored: after === before, beforeSha256: sha(before), afterSha256: sha(after) });
        expect(after).toBe(before);
    });
    function codexLedger(input, mode) {
        const name = stableName(), old = { command: 'fictional-node', args: ['fictional-mcp-server.js', `${input.projectPath}/temp/creator-ai-bridge/connection.json`] };
        const foreign = { command: 'fictional-foreign', args: ['foreign'] };
        const entries = new Map([['unrelated', { command: 'fictional-other', args: ['keep'] }]]);
        if (mode !== 'ok')
            entries.set(name, mode === 'conflict' ? foreign : old);
        let wrote = false;
        const exec = vi.fn(async (_file, args) => {
            expect(_file).toBe('FICTIONAL-CODEX-NOT-EXECUTED');
            expect(args[0]).toBe('mcp');
            const action = args[1], key = args[2];
            if (action === 'get') {
                const entry = entries.get(key);
                if (!entry)
                    throw new Error('fictional absent entry');
                return { stdout: JSON.stringify({ transport: mode === 'verify-fail' && wrote ? foreign : entry }), stderr: '' };
            }
            if (action === 'remove') {
                entries.delete(key);
                return { stdout: '', stderr: '' };
            }
            if (action === 'add') {
                if (mode === 'add-fail' && args[4] === input.creatorAiPath)
                    throw new Error('fictional add failure');
                entries.set(key, { command: args[4], args: args.slice(5) });
                wrote = true;
                return { stdout: '', stderr: '' };
            }
            throw new Error('unexpected fictional CLI operation');
        });
        return { entries, exec, old };
    }
    it('Codex: injected CLI control flow supports new/no-op and rejects foreign conflicts', async () => {
        const { input } = await fixture('codex'), c = { ...input, codexPath: 'FICTIONAL-CODEX-NOT-EXECUTED' };
        const ledger = codexLedger(input, 'ok');
        expect((await codex()(c, { execFile: ledger.exec })).changed).toBe(true);
        expect((await codex()(c, { execFile: ledger.exec })).changed).toBe(false);
        expect(ledger.entries.get('unrelated')).toEqual({ command: 'fictional-other', args: ['keep'] });
        const conflict = codexLedger(input, 'conflict'), before = [...conflict.entries];
        await expect(codex()(c, { execFile: conflict.exec })).rejects.toThrow();
        expect([...conflict.entries]).toEqual(before);
        evidence.push({ target: 'codex', case: 'new-noop-conflict', cli: 'fictional exec only', preserved: true });
    });
    it('Codex: verification failure restores legacy transport with injected CLI control flow', async () => {
        const { input } = await fixture('codex'), ledger = codexLedger(input, 'verify-fail');
        await expect(codex()({ ...input, codexPath: 'FICTIONAL-CODEX-NOT-EXECUTED' }, { execFile: ledger.exec })).rejects.toThrow();
        expect(ledger.entries.get(stableName())).toEqual(ledger.old);
        evidence.push({ target: 'codex', case: 'verify-fail-rollback', cli: 'fictional exec only', originalTransportRestored: true });
    });
    it.fails('KNOWN HOST GAP Codex: add rejection after legacy remove would restore the old transport', async () => {
        const { input } = await fixture('codex'), ledger = codexLedger(input, 'add-fail');
        await expect(codex()({ ...input, codexPath: 'FICTIONAL-CODEX-NOT-EXECUTED' }, { execFile: ledger.exec })).rejects.toThrow('fictional add failure');
        const restored = JSON.stringify(ledger.entries.get(stableName())) === JSON.stringify(ledger.old);
        evidence.push({ target: 'codex', case: 'add-fail-after-remove', cli: 'fictional exec only', originalTransportRestored: restored });
        expect(ledger.entries.get(stableName())).toEqual(ledger.old);
    });
});
