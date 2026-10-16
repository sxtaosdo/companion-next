/** Explicit offline semantic checks. No emit, installation, service or runtime module execution. */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = join(repository, '.test-artifacts/v148-host-runtime')
const reference = join(repository, '.test-artifacts/v148-host-reference')
const digest = data => createHash('sha256').update(data).digest('hex')
const referenceBytes = await readFile(join(reference, 'manifest.json'))
if (digest(referenceBytes) !== '67d41a82763bdcf029f730375937faca33ad5e4e5e00b526e7b3b9e22ae5d9b5') throw new Error('Original manifest changed')
for (const file of JSON.parse(referenceBytes).sourceFiles) {
  if (!file.file.startsWith('mcp/') || file.file.split('/').some(part => part === '..' || part === '')) throw new Error('Invalid reference path')
  const bytes = await readFile(join(root, file.file))
  if (bytes.length !== file.size || digest(bytes) !== file.sha256) throw new Error('Original runtime source changed')
}
const binder = join(root, 'mcp/src/companion/v148-runtime-binder.ts')
if (digest(await readFile(binder)) !== digest(await readFile(join(repository, 'host/v148-runtime-binder.ts')))) throw new Error('Runtime binder differs from current source')
const before = JSON.parse(await readFile(join(root, 'PACKAGE-LOCK-BEFORE-TYPES.json'), 'utf8'))
const current = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))
const original = JSON.parse(await readFile(join(reference, 'source/mcp/package-lock.json'), 'utf8'))
const versions = { typescript: '5.9.3', '@types/node': '24.13.3', '@types/better-sqlite3': '7.6.13', 'undici-types': '7.18.2' }
const added = Object.keys(current.packages).filter(path => path && !before.packages[path])
if (added.length !== 4 || added.some(path => !Object.hasOwn(versions, path.replace(/^node_modules\//, '')))) throw new Error('Unexpected added package')
for (const [path, item] of Object.entries(before.packages)) if (path && JSON.stringify(item) !== JSON.stringify(current.packages[path])) throw new Error('Existing package metadata changed')
for (const [name, version] of Object.entries(versions)) {
  const path = `node_modules/${name}`, locked = current.packages[path]
  const installed = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8'))
  if (installed.version !== version || locked.version !== version || locked.integrity !== original.packages[path].integrity || !locked.resolved.startsWith('https://registry.npmjs.org/')) throw new Error('Locked type package differs')
}
const ts = (await import(pathToFileURL(join(root, 'node_modules/typescript/lib/typescript.js')).href)).default
const configFile = join(root, 'mcp/tsconfig.build.json')
const config = ts.readConfigFile(configFile, ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configFile), {}, configFile)
if (config.error || parsed.errors.length) throw new Error('Original build configuration is invalid')
const results = []
for (const [scope, roots] of [['binder-import-graph', [binder]], ['provided-host-source-closure', parsed.fileNames]]) {
  const program = ts.createProgram(roots, { ...parsed.options, noEmit: true })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  results.push({
    scope, rootCount: roots.length,
    sourceFiles: program.getSourceFiles().filter(file => !file.isDeclarationFile).map(file => relative(root, file.fileName)),
    totalDiagnostics: diagnostics.length,
    diagnostics: diagnostics.map(item => ({
      code: item.code, file: item.file ? relative(root, item.file.fileName) : null,
      line: item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start).line + 1 : null,
      message: ts.flattenDiagnosticMessageText(item.messageText, '\n').replaceAll(root, '<isolated-runtime>').replaceAll(repository, '<companion-next>'),
    })),
  })
}
const evidence = {
  timestamp: new Date().toISOString(), compilerVersion: ts.version, originalBuildOptions: true,
  configFilePath: 'mcp/tsconfig.build.json', noEmit: true,
  addedPackages: added.map(path => ({ path, version: current.packages[path].version, integrity: current.packages[path].integrity })),
  existing128PackageMetadataUnchanged: true, registry: 'https://registry.npmjs.org', ignoreScripts: true,
  results,
}
await writeFile(join(root, 'TYPECHECK-APPROVED.json'), `${JSON.stringify(evidence, null, 2)}\n`)
console.log(JSON.stringify(results.map(({ scope, sourceFiles, totalDiagnostics }) => ({ scope, sourceFiles: sourceFiles.length, totalDiagnostics })), null, 2))
// A broader-closure failure stays a failure; do not hide it behind a successful binder check.
if (results.some(result => result.totalDiagnostics)) process.exitCode = 1
