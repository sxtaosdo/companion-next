import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, writeFile, readFile, readdir, rm, symlink, link } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { assertCandidatePath, createCandidateDirectory, inspectAssetReferences, inspectStaticCandidate, verifyStaticCandidate } from '../scripts/prepare-companion-static.mjs'

const roots = []
const icon = await readFile(new URL('../src/assets/legacy-v148/about-icon.svg', import.meta.url))
const favicon = await readFile(new URL('../public/favicon.svg', import.meta.url))
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function temporary() {
  const base = resolve('.test-artifacts/static-tests')
  await mkdir(base, { recursive: true })
  const directory = await mkdtemp(join(base, 'case-'))
  roots.push(directory)
  return directory
}
function content() {
  return {
    'next/index.html': Buffer.from('<script type="module" src="./assets/main.js"></script><link href="./assets/main.css" rel="stylesheet">'),
    'next/assets/main.js': Buffer.from('const icon = new URL("icon.svg", import.meta.url).href; const api="/api/projects";'),
    'next/assets/main.css': Buffer.from('.x{background:url(data:image/svg+xml;base64,AAAA)}.y{filter:url(#local)}'),
    'next/assets/icon.svg': icon,
    'next/favicon.svg': favicon,
  }
}
async function fixture(values = content()) {
  const root = await temporary()
  await mkdir(join(root, 'next/assets'), { recursive: true })
  for (const [path, bytes] of Object.entries(values)) await writeFile(join(root, path), bytes)
  return join(root, 'next')
}
function manifest(inspected) {
  return { schemaVersion: 1, kind: 'companion-static-additions', status: 'offline-candidate-not-deployed', build: { base: './', mode: 'companion-readonly', entry: '/next/index.html#/projects' }, pathPolicy: { prefix: 'next/', existingTarget: 'must-be-absent', overwrite: false, symlinks: false, hardlinks: false, manifestDeployed: false }, ...inspected }
}

test('relative assets resolve inside next while root API address remains unchanged', () => {
  const refs = inspectAssetReferences(content())
  assert.equal(refs.length, 3)
  assert.ok(refs.every(ref => ref.to.startsWith('next/')))
  assert.ok(!refs.some(ref => ref.to.includes('api')))
  assert.equal(new URL('./assets/main.js', 'http://127.0.0.1:1234/next/index.html#/projects').pathname, '/next/assets/main.js')
})
for (const path of ['next/index.html', 'next/favicon.svg', 'next/assets/icon-hash.svg', 'next/assets/main-1.css']) {
  test(`permits bounded path ${path}`, () => assert.equal(assertCandidatePath(path), path))
}
for (const path of ['/next/index.html', '../next/index.html', 'next/../index.html', 'next//index.html', 'next/./index.html', 'next\\index.html', 'C:/next/index.html', '//server/next/index.html', 'next/assets/main.js:stream', 'next/assets/%2e%2e.js', 'next/assets/main.js?x', 'next/assets/main.js#x', 'next/assets/.env', 'next/assets/main.js.map', 'next/another.html', 'next/assets/config.json', 'next/assets/CON.js', 'next/assets/a..b.js']) {
  test(`rejects unsafe or out-of-scope path ${path}`, () => assert.throws(() => assertCandidatePath(path)))
}
for (const reference of ['/assets/main.js', 'https://example.test/main.js', '//example.test/main.js', 'data:text/javascript,x', '../main.js', './assets/missing.js', './assets/%6dain.js']) {
  test(`rejects invalid HTML asset ${reference}`, () => {
    const values = content(); values['next/index.html'] = Buffer.from(`<script type="module" src="${reference}"></script><link href="./assets/main.css">`)
    assert.throws(() => inspectAssetReferences(values))
  })
}
test('rejects base element and root-relative JS and CSS resources', () => {
  for (const [path, value] of [['next/index.html', '<base href="/">'], ['next/assets/main.js', 'const x="/assets/icon.svg"'], ['next/assets/main.css', '.x{background:url(/assets/icon.svg)}']]) {
    const values = content(); values[path] = Buffer.from(value)
    assert.throws(() => inspectAssetReferences(values))
  }
})
for (const [kind, path, value] of [
  ['unquoted extra script', 'next/index.html', '<script src=https://example.test/remote.js></script>'],
  ['inline script', 'next/index.html', '<script>fetch("https://example.test")</script>'],
  ['inline event', 'next/index.html', '<div onclick="fetch(\'https://example.test\')"></div>'],
  ['meta redirect', 'next/index.html', '<meta http-equiv="refresh" content="0;url=https://example.test">'],
  ['preload source set', 'next/index.html', '<link rel="preload" as="image" imagesrcset="https://example.test/a.png 1x">'],
  ['CSS import', 'next/assets/main.css', '@import "https://example.test/style.css";'],
  ['bare JS import', 'next/assets/main.js', 'import "https://example.test/remote.js";'],
  ['escaped root asset', 'next/assets/main.js', 'const escape="\\x2fassets/icon.svg";'],
]) {
  test(`rejects ${kind}`, () => {
    const values = content(); values[path] = Buffer.concat([values[path], Buffer.from(value)])
    assert.throws(() => inspectAssetReferences(values))
  })
}
test('rejects orphan output or import.meta URL outside the candidate', () => {
  const values = content(); values['next/assets/orphan.png'] = Buffer.from('image')
  assert.throws(() => inspectAssetReferences(values), /Unreferenced/)
  delete values['next/assets/orphan.png']; values['next/assets/main.js'] = Buffer.from('const x=new URL("../../icon.svg",import.meta.url)')
  assert.throws(() => inspectAssetReferences(values))
})
test('creates once and rejects existing empty or occupied directory without changing bytes', async () => {
  const root = await temporary()
  const made = await createCandidateDirectory(root, 'candidate')
  await assert.rejects(createCandidateDirectory(root, 'candidate'), { code: 'EEXIST' })
  await writeFile(join(made, 'keep'), 'protected')
  await assert.rejects(createCandidateDirectory(root, 'candidate'), { code: 'EEXIST' })
  assert.equal(await readFile(join(made, 'keep'), 'utf8'), 'protected')
  await assert.rejects(createCandidateDirectory(root, '../escaped'))
})
test('hashes exact bytes and verifies sorted complete manifest', async () => {
  const next = await fixture()
  const inspected = await inspectStaticCandidate(next)
  assert.equal(inspected.files.length, 5)
  assert.deepEqual(inspected.files.map(file => file.path), inspected.files.map(file => file.path).sort((a, b) => a.localeCompare(b)))
  const bytes = await readFile(join(next, 'assets/main.js'))
  const entry = inspected.files.find(file => file.path === 'next/assets/main.js')
  assert.equal(entry.size, bytes.length)
  assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'))
  assert.deepEqual(await verifyStaticCandidate(next, manifest(inspected)), inspected)
})
for (const alteration of ['modify', 'missing', 'extra', 'duplicate-manifest', 'unsafe-policy']) {
  test(`manifest recheck rejects ${alteration}`, async () => {
    const next = await fixture()
    const expected = manifest(await inspectStaticCandidate(next))
    if (alteration === 'modify') await writeFile(join(next, 'favicon.svg'), '<svg><!--changed--></svg>')
    if (alteration === 'missing') await rm(join(next, 'favicon.svg'))
    if (alteration === 'extra') await writeFile(join(next, 'assets/extra.png'), 'unexpected')
    if (alteration === 'duplicate-manifest') expected.files.push(expected.files[0])
    if (alteration === 'unsafe-policy') expected.pathPolicy.overwrite = true
    await assert.rejects(verifyStaticCandidate(next, expected))
  })
}
test('rejects extra directory and case-insensitive asset collision', async t => {
  const next = await fixture()
  await mkdir(join(next, 'other'))
  await assert.rejects(inspectStaticCandidate(next), /Unexpected directory/)
  await rm(join(next, 'other'), { recursive: true })
  await writeFile(join(next, 'assets/ICON.svg'), icon)
  if ((await readdir(join(next, 'assets'))).filter(name => name.toLowerCase() === 'icon.svg').length !== 2) { t.skip('Filesystem cannot represent case-colliding files'); return }
  await assert.rejects(inspectStaticCandidate(next), /Case-insensitive|Unreferenced/)
})
test('rejects changed SVG instead of treating external SVG href as a verified asset', async () => {
  const next = await fixture()
  await writeFile(join(next, 'assets/icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.test/x.png"/></svg>')
  await assert.rejects(inspectStaticCandidate(next), /SVG differs/)
})
for (const kind of ['file', 'dangling', 'directory', 'root', 'ancestor']) {
  test(`rejects ${kind} symlink`, async t => {
    const next = await fixture(); const other = await temporary()
    let target = next
    try {
      if (kind === 'file' || kind === 'dangling') await symlink(join(other, kind === 'file' ? 'keep' : 'missing'), join(next, 'assets/linked.js'))
      if (kind === 'file') await writeFile(join(other, 'keep'), 'private')
      if (kind === 'directory') await symlink(other, join(next, 'other'), 'junction')
      if (kind === 'root') { target = join(other, 'next'); await symlink(next, target, 'junction') }
      if (kind === 'ancestor') { await symlink(resolve(next, '..'), join(other, 'parent'), 'junction'); target = join(other, 'parent/next') }
    } catch (error) { if (error.code === 'EPERM') { t.skip('Host does not allow this symlink fixture'); return } throw error }
    await assert.rejects(inspectStaticCandidate(target), /[Ss]ymlink|ancestor/)
  })
}
test('rejects hard-linked output', async () => {
  const next = await fixture(); const other = await temporary()
  await link(join(next, 'favicon.svg'), join(other, 'link.svg'))
  await assert.rejects(inspectStaticCandidate(next), /hard-linked/)
})
test('refuses symlink parent and pre-existing dangling candidate', async t => {
  const root = await temporary(); const other = await temporary()
  try { await symlink(other, join(root, 'parent'), 'junction'); await symlink(join(other, 'absent'), join(root, 'candidate'), 'junction') }
  catch (error) { if (error.code === 'EPERM') { t.skip('Host does not allow this symlink fixture'); return } throw error }
  await assert.rejects(createCandidateDirectory(join(root, 'parent'), 'new'), /ancestor/)
  await assert.rejects(createCandidateDirectory(root, 'candidate'), { code: 'EEXIST' })
})
