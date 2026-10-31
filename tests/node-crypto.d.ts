// This test suite only uses Node's Web Crypto implementation to provide the
// browser-compatible Crypto interface in jsdom. Keep this declaration narrow;
// do not treat it as a replacement for the complete Node.js type definitions.
declare module 'node:crypto' {
  export const webcrypto: Crypto
}