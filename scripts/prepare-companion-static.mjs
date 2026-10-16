/** Offline, create-only candidate builder. This file never deploys or starts a server. */
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const allowedFile = /^next\/(?:index\.html|favicon\.svg|assets\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:js|css|svg|png|ico))$/
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
const originalSvgHashes = new Set([
  '09a1630732db59daab65a89c7636f7a5f2350c20052446c479306e61797b8228', // v148 about icon
  '7171f2df1f7fafc0c4f6d2ac7ebf833ba11b1083522c1e1f28af821b76d6c715', // existing Next favicon
])

export function assertCandidatePath(path) {
  if (typeof path !== 'string' || !allowedFile.test(path) || path.includes('..') || path.split('/').some(part => reserved.test(part))) {
    throw new Error(`Unsupported candidate path: ${String(path)}`)
  }
  return path
}

/** No mkdir-recursive through an existing symlink; no overwrite, including dangling links. */
export async function createCandidateDirectory(parent, name) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) || name.includes('..') || reserved.test(name)) throw new Error('Invalid candidate directory name')
  const absolute = resolve(parent)
  await assertOrdinaryAncestors(absolute)
  const destination = join(absolute, name)
  await mkdir(destination) // EEXIST is intentional. Never clean or merge an existing candidate.
  return destination
}

async function assertOrdinaryAncestors(absolute) {
  let cursor = absolute
  while (true) {
    const detail = await lstat(cursor)
    if (detail.isSymbolicLink() || !detail.isDirectory()) throw new Error('Candidate ancestor must be an ordinary directory')
    if (dirname(cursor) === cursor) break
    cursor = dirname(cursor)
  }
}

function resolveReference(owner, reference, files) {
  if (!reference || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(reference) || /[\\%?#\s\0]/.test(reference)) throw new Error(`Non-local asset reference in ${owner}`)
  const target = posix.normalize(posix.join(posix.dirname(owner), reference))
  assertCandidatePath(target)
  if (!files.has(target)) throw new Error(`Missing asset ${target} referenced by ${owner}`)
  return target
}

/** Checks the emitted Vite literal asset graph, not arbitrary JavaScript behavior or browser rendering. */
export function inspectAssetReferences(contents) {
  const files = new Set(Object.keys(contents))
  const references = []
  const add = (owner, value) => references.push({ from: owner, to: resolveReference(owner, value, files) })
  const html = contents['next/index.html']?.toString('utf8')
  if (!html) throw new Error('Missing index')
  // No resources/runScripts option: parsing cannot execute scripts or fetch resources.
  const dom = new JSDOM(html)
  try {
    const document = dom.window.document
    const scripts = [...document.querySelectorAll('script')]
    if (scripts.length !== 1 || scripts[0].getAttribute('type') !== 'module' || !scripts[0].hasAttribute('src') || scripts[0].textContent.trim()) throw new Error('Expected one external precompiled module and no inline script')
    const allowedAttributes = { HTML: ['lang'], HEAD: [], META: ['charset', 'name', 'content'], TITLE: [], BODY: [], DIV: ['id'], SCRIPT: ['type', 'src', 'crossorigin'], LINK: ['rel', 'href', 'crossorigin'] }
    for (const node of document.querySelectorAll('*')) {
      if (!Object.hasOwn(allowedAttributes, node.tagName)) throw new Error(`Unexpected static index element: ${node.tagName}`)
      for (const attribute of node.attributes) {
        if (!allowedAttributes[node.tagName].includes(attribute.name)) throw new Error(`Unexpected static index attribute: ${attribute.name}`)
        if (attribute.name === 'src' || attribute.name === 'href') add('next/index.html', attribute.value)
      }
      if (node.tagName === 'LINK' && node.getAttribute('rel') !== 'stylesheet') throw new Error('Unexpected static link relationship')
    }
  } finally { dom.window.close() }
  if (!references.some(ref => ref.to.endsWith('.js')) || !references.some(ref => ref.to.endsWith('.css'))) throw new Error('Missing JS/CSS entry references')
  for (const [path, data] of Object.entries(contents)) {
    if (path.endsWith('.js')) {
      const source = data.toString('utf8')
      const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      if (parsed.parseDiagnostics.length) throw new Error(`Invalid emitted JavaScript: ${path}`)
      const literal = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      const moduleReference = node => { if (!node || !literal(node)) throw new Error('Non-literal emitted module asset'); add(path, node.text) }
      function visit(node) {
        if (literal(node) && node.text.startsWith('/assets/')) throw new Error(`Root-relative asset in ${path}`)
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) moduleReference(node.moduleSpecifier)
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) moduleReference(node.arguments[0])
        if (ts.isNewExpression(node) && node.expression.getText(parsed) === 'URL' && node.arguments?.[1]?.getText(parsed) === 'import.meta.url') moduleReference(node.arguments[0])
        ts.forEachChild(node, visit)
      }
      visit(parsed)
    } else if (path.endsWith('.css')) {
      if (/@import\b/i.test(data.toString('utf8'))) throw new Error('Emitted CSS must be bundled, without @import')
      for (const match of data.toString('utf8').matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
        const value = (match[1] ?? match[2] ?? match[3]).trim()
        if (!value.startsWith('#') && !value.startsWith('data:')) add(path, value)
      }
    }
  }
  const reached = new Set(['next/index.html'])
  let changed = true
  while (changed) {
    changed = false
    for (const ref of references) if (reached.has(ref.from) && !reached.has(ref.to)) { reached.add(ref.to); changed = true }
  }
  for (const file of files) if (file !== 'next/favicon.svg' && !reached.has(file)) throw new Error(`Unreferenced emitted asset: ${file}`)
  return references.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
}

export async function inspectStaticCandidate(nextDirectory) {
  await assertOrdinaryAncestors(resolve(nextDirectory))
  const contents = Object.create(null)
  const entries = []
  const seen = new Set()
  async function visit(directory, prefix) {
    const details = await lstat(directory)
    if (!details.isDirectory() || details.isSymbolicLink()) throw new Error('Static directories must not be symlinks')
    for (const name of (await readdir(directory)).sort()) {
      const path = `${prefix}/${name}`
      const local = join(directory, name)
      const details = await lstat(local)
      if (details.isSymbolicLink()) throw new Error(`Symlink is not a static candidate: ${path}`)
      if (details.isDirectory()) {
        if (path !== 'next/assets') throw new Error(`Unexpected directory: ${path}`)
        await visit(local, path)
      } else {
        assertCandidatePath(path)
        if (!details.isFile() || details.nlink !== 1) throw new Error(`Static file must be ordinary and not hard-linked: ${path}`)
        if (details.size < 1 || details.size > 8 * 1024 * 1024) throw new Error(`Unexpected static file size: ${path}`)
        if (seen.has(path.toLowerCase())) throw new Error(`Case-insensitive path collision: ${path}`)
        seen.add(path.toLowerCase())
        const bytes = await readFile(local)
        if (path.endsWith('.svg') && !originalSvgHashes.has(sha256(bytes))) throw new Error(`SVG differs from the two reviewed original assets: ${path}`)
        contents[path] = bytes
        entries.push({ path, size: bytes.length, sha256: sha256(bytes) })
        if (entries.length > 64) throw new Error('Too many static candidate files')
      }
    }
  }
  await visit(resolve(nextDirectory), 'next')
  const references = inspectAssetReferences(contents)
  return { files: entries.sort((a, b) => a.path.localeCompare(b.path)), references }
}

/** Read-only recheck for a prepared candidate; no copy, install, rollback or deployment side effects. */
export async function verifyStaticCandidate(nextDirectory, manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.kind !== 'companion-static-additions' || manifest.status !== 'offline-candidate-not-deployed' || manifest.build?.base !== './' || manifest.build?.mode !== 'companion-readonly' || manifest.build?.entry !== '/next/index.html#/projects' || manifest.pathPolicy?.prefix !== 'next/' || manifest.pathPolicy?.existingTarget !== 'must-be-absent' || manifest.pathPolicy?.overwrite !== false || manifest.pathPolicy?.symlinks !== false || manifest.pathPolicy?.hardlinks !== false || manifest.pathPolicy?.manifestDeployed !== false || !Array.isArray(manifest.files)) throw new Error('Invalid static additions manifest policy')
  const expected = manifest.files.map(file => {
    assertCandidatePath(file.path)
    if (!Number.isSafeInteger(file.size) || file.size < 1 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid file evidence')
    return { path: file.path, size: file.size, sha256: file.sha256 }
  }).sort((a, b) => a.path.localeCompare(b.path))
  const actual = await inspectStaticCandidate(nextDirectory)
  if (JSON.stringify(expected) !== JSON.stringify(actual.files)) throw new Error('Candidate files differ from manifest')
  if (JSON.stringify(manifest.references) !== JSON.stringify(actual.references)) throw new Error('Candidate references differ from manifest')
  return actual
}

async function ordinaryChild(parent, name) {
  await assertOrdinaryAncestors(resolve(parent))
  const child = join(parent, name)
  try { await mkdir(child) } catch (error) { if (error.code !== 'EEXIST') throw error }
  const detail = await lstat(child)
  if (!detail.isDirectory() || detail.isSymbolicLink()) throw new Error('Candidate parent must be an ordinary directory')
  return child
}

export async function prepareStaticCandidate() {
  // Fixed repository-local output; no caller-selected deployment root or environment credentials.
  const artifacts = await ordinaryChild(repository, '.test-artifacts')
  const parent = await ordinaryChild(artifacts, 'companion-static')
  const pkg = JSON.parse(await readFile(join(repository, 'package.json'), 'utf8'))
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim()
  const sourceDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: repository, encoding: 'utf8' }).trim() !== ''
  const destination = await createCandidateDirectory(parent, `candidate-${randomUUID()}`)
  execFileSync(process.execPath, [join(repository, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'companion-readonly', '--base', './', '--outDir', join(destination, 'next')], { cwd: repository, stdio: 'inherit' })
  const inspected = await inspectStaticCandidate(join(destination, 'next'))
  const sourceCommitAfter = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim()
  const dirtyAfter = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: repository, encoding: 'utf8' }).trim() !== ''
  const manifest = {
    schemaVersion: 1, kind: 'companion-static-additions', frontendVersion: pkg.version, versionProvenance: pkg.companionVersion,
    sourceCommit, sourceCommitAfter, sourceDirty: sourceDirty || dirtyAfter || sourceCommit !== sourceCommitAfter, generatedAt: new Date().toISOString(),
    build: { mode: 'companion-readonly', base: './', entry: '/next/index.html#/projects' },
    status: 'offline-candidate-not-deployed',
    pathPolicy: { prefix: 'next/', existingTarget: 'must-be-absent', overwrite: false, symlinks: false, hardlinks: false, manifestDeployed: false },
    requiredPreflight: ['Explicit approval for the live webRoot next/ exception', 'Recheck current runtime identity and original deployment hashes; stop on drift', 'Verify target next/ is absent and every destination ancestor is not a link/reparse point', 'Verify all candidate bytes against this manifest before and after copying'],
    rollback: 'Only remove or move files introduced by this candidate whose hashes still match; stop on later edits. Never alter original files, credentials, process or deployment manifest.',
    ...inspected,
  }
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(destination, 'STATIC-ADDITIONS.json'), bytes, { flag: 'wx' })
  console.log(JSON.stringify({ candidate: destination, manifest: 'STATIC-ADDITIONS.json', manifestSha256: sha256(bytes), files: inspected.files.length, sourceDirty: manifest.sourceDirty, deployed: false }, null, 2))
  return destination
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('No output/deployment path arguments are accepted')
  await prepareStaticCandidate()
}
