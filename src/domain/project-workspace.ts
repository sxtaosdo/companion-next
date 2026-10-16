/** Demo/legacy snapshots are available only outside dedicated Companion hosts.
 * A registered real reader also closes the sample surface in dev/test builds. */
export function allowsLegacyWorkspace(mode: string, hasCompanionProvider: boolean): boolean {
  return !hasCompanionProvider && !['companion-workspace', 'companion-readonly', 'companion-config-editor', 'companion-knowledge-chat'].includes(mode)
}
