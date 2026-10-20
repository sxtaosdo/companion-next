// Opt-in offline contract check. Reads the explicitly selected installed source
// map; never imports the daemon entry, starts a listener, or reads real history.
import { readFile, writeFile, mkdir, mkdtemp, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
if (![2, 4].includes(args.length) || args[0] !== '--daemon' || (args.length === 4 && args[2] !== '--output') || !isAbsolute(args[1])) {
  throw new Error('Usage: node scripts/verify-installed-call-history.mjs --daemon <absolute daemon.js> [--output <empty directory>]')
}
const daemon = resolve(args[1])
const output = args[3] ? resolve(args[3]) : await mkdtemp(join(tmpdir(), 'companion-call-contract-'))
await mkdir(output, { recursive: true })
if ((await readdir(output)).length) throw new Error('Output must be an empty directory; nothing was replaced')
const write = (name, value) => writeFile(join(output, name), value, { flag: 'wx' })
const sha = value => createHash('sha256').update(value).digest('hex')
const mapBytes = await readFile(daemon + '.map')
const map = JSON.parse(mapBytes.toString('utf8'))
const sources = new Map()
for (let i = 0; i < map.sources.length; i++) {
  const name = map.sources[i].replaceAll('\\', '/').match(/\/mcp\/src\/(.+)$/)?.[1]
  if (name && typeof map.sourcesContent?.[i] === 'string') sources.set(name, map.sourcesContent[i])
}
const required = ['companion/call-history.ts', 'companion/tool-names.ts', 'companion/http-server.ts']
for (const name of required) if (!sources.has(name)) throw new Error('Installed map lacks required source: ' + name)
const require = createRequire(join(project, 'package.json'))
const { build, transform } = require('esbuild')
// Resolve only source-map content and Node builtins, with no workspace fallback.
await build({
  entryPoints: ['installed:companion/call-history.ts'], outfile: join(output, 'installed-call-history.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node20',
  plugins: [{ name: 'installed-map-only', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      if (args.path.startsWith('node:')) return { path: args.path, external: true }
      const name = args.path.startsWith('installed:') ? args.path.slice(10)
        : args.namespace === 'installed-map' && args.path.startsWith('.') ? posix.normalize(posix.join(posix.dirname(args.importer), args.path)).replace(/\.js$/, '.ts') : undefined
      if (!name || !sources.has(name)) throw new Error('Unproven installed import: ' + args.path)
      return { path: name, namespace: 'installed-map' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'installed-map' }, args => ({ contents: sources.get(args.path), loader: 'ts' }))
  } }],
})
const http = sources.get('companion/http-server.ts')
const start = http.indexOf('      if (url.pathname === "/api/calls/counts"')
const query = http.indexOf('return json(response, 200, this.calls.query', start)
const closing = query < 0 ? -1 : http.indexOf('\n      }', query)
if (start < 0 || closing < 0) throw new Error('Installed calls route projection unavailable')
const routeSource = http.slice(start, closing + 8)
const hostPackage = resolve(dirname(daemon), '../..', 'package.json')
const wrapper = `import {createRequire} from 'node:module';const {z}=createRequire(${JSON.stringify(hostPackage)})('zod');
export function route(calls,path){const url=new URL(path,'http://fixture.invalid'),request={method:'GET'},response={},json=(_r,status,body)=>({status,body});return (function(){
${routeSource}
}).call({calls});}`
await write('installed-call-routes.mjs', (await transform(wrapper, { loader: 'ts', format: 'esm', target: 'node20' })).code)
await write('installed-store-contract.test.ts', await readFile(join(project, 'tests/fixtures/installed-call-history-contract.template.ts.txt'), 'utf8'))
const aliases = {
  vitest: join(dirname(require.resolve('vitest/package.json')), 'dist/index.js'),
  pinia: join(dirname(require.resolve('pinia/package.json')), 'dist/pinia.mjs'),
  '@next/companion-browser-adapter': join(project, 'src/adapters/companion-browser.ts'),
  '@next/companion-browser-store': join(project, 'src/stores/companion-browser.ts'),
}
await write('vitest.config.mjs', 'export default ' + JSON.stringify({ root: output, resolve: { alias: aliases }, test: { environment: 'node', include: ['installed-store-contract.test.ts'], fileParallelism: false, maxWorkers: 1 } }) + '\n')
await write('source-proof.json', JSON.stringify({ installedJsSha256: sha(await readFile(daemon)), installedMapSha256: sha(mapBytes), routeProjectionSha256: sha(routeSource), sources: required.map(path => ({ path, sha256: sha(sources.get(path)) })), listenerStarted: false, productionHistoryRead: false, fullHttpAuthenticationTested: false }, null, 2) + '\n')
const result = spawnSync(process.execPath, [join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', '--config', join(output, 'vitest.config.mjs'), '--reporter=json', '--outputFile', join(output, 'results.json')], {
  cwd: project, stdio: 'inherit', env: { ...process.env, TEMP: output, TMP: output, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--no-experimental-webstorage'].filter(Boolean).join(' ') },
})
if (result.error) throw new Error('Offline test runner could not start', { cause: result.error })
process.exitCode = result.status ?? 1
