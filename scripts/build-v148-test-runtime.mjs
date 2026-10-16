/** Explicit local validation build. No installation, listening, credential/config reads or deployment. */
import { build } from 'esbuild'
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
const root=resolve('.test-artifacts/v148-host-runtime'),reference=resolve('.test-artifacts/v148-host-reference')
const manifestBytes=await readFile(join(reference,'manifest.json'))
if(createHash('sha256').update(manifestBytes).digest('hex')!=='67d41a82763bdcf029f730375937faca33ad5e4e5e00b526e7b3b9e22ae5d9b5')throw new Error('Reference manifest differs from the verified archive')
const manifest=JSON.parse(manifestBytes.toString('utf8'))
if(manifest.sourceHEAD!=='f6dcac804fb9ad806e8094594c7820a71cfab7b8'||manifest.sourceFileCount!==100)throw new Error('Unexpected reference identity')
for(const file of manifest.sourceFiles){if(!file.file.startsWith('mcp/')||file.file.split('/').some(part=>part==='..'||part===''))throw new Error('Invalid manifest path');const data=await readFile(join(root,file.file));if(data.length!==file.size||createHash('sha256').update(data).digest('hex')!==file.sha256)throw new Error('Runtime source differs from verified manifest')}
const expected={zod:'4.4.3','@modelcontextprotocol/sdk':'1.30.0','better-sqlite3':'12.11.1'}
for(const [name,version] of Object.entries(expected)){const pkg=JSON.parse(await readFile(join(root,'node_modules',name,'package.json'),'utf8'));if(pkg.version!==version)throw new Error('Unexpected runtime dependency version')}
await copyFile(resolve('host/v148-runtime-binder.ts'),join(root,'mcp/src/companion/v148-runtime-binder.ts'))
await mkdir(join(root,'built'),{recursive:true})
const entry=join(root,'mcp/src/companion/http-validation-entry.ts')
await writeFile(entry,`export { createV148IsolatedHost } from './v148-runtime-binder.js'\nexport { KnowledgeAdapter, KnowledgeFault } from './knowledge-adapter.js'\nexport { BridgeFault } from '../errors.js'\n`)
await build({entryPoints:[entry],outfile:join(root,'built/v148-host.mjs'),platform:'node',target:'node24',format:'esm',bundle:true,packages:'external',sourcemap:false,logLevel:'warning'})
for(const [input,output] of [['src/adapters/companion-browser.ts','companion-browser.mjs'],['src/adapters/knowledge-read.ts','knowledge-read.mjs']])await build({entryPoints:[resolve(input)],outfile:join(root,'built',output),platform:'node',target:'node24',format:'esm',bundle:true,sourcemap:false,logLevel:'warning'})
console.log('Verified original 100-file source and three locked runtime roots; transpiled original HTTP binder and current read clients. No server started.')
