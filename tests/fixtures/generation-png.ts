// Only built-in Node WebCrypto is used by the test runtime; no package dependency.
const cryptoModule = 'node:crypto'
const { webcrypto } = await import(cryptoModule) as { webcrypto: Crypto }
export const testCrypto = webcrypto
// Genuine zlib-compressed transparent RGBA fixtures, not production-generated assets.
const fixtures: Record<number, string> = {
  16: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEklEQVR4nGNgGAWjYBSMAggAAAQQAAFVN1rQAAAAAElFTkSuQmCC',
  32: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAYAAAB3AH1ZAAAAF0lEQVR4nGNgGAWjYBSMglEwCkbBSAcACBAAAQaEndAAAAAASUVORK5CYII=',
}
export function pngBytes(width = 16, height = 16) {
  if (!fixtures[width] || height !== 16) throw new Error('Unsupported test fixture')
  return Uint8Array.from(atob(fixtures[width]), (char) => char.charCodeAt(0))
}
export function localFile(bytes = pngBytes(), name = 'result.png') {
  return { name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer }
}
