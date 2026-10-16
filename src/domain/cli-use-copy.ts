import {
  buildCliAgentPromptWithCommands,
  buildCliSkillInstallPrompt,
} from './legacy-v148-cli-use-copy'
import type { CliCopyProject } from './legacy-v148-cli-use-copy'

const failureText = '工程登记信息不符合安全复制要求，请检查工程 ID、名称和绝对本地路径。'

/** Fixed local text only: no raw metadata, exception cause, path or credential is retained. */
export class CliCopyError extends Error {
  readonly code = 'invalid-project'
  constructor() {
    super(failureText)
    this.name = 'CliCopyError'
  }
}

// Includes C0/C1, bidi/zero-width formatting, Unicode line separators and lone surrogates.
// Backticks, links and HTML delimiters cannot escape the legacy prompt's text boundaries.
const unsafeMetadata = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}`<>\[\]]/u
const projectIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const windowsDriveRoot = /^[A-Za-z]:[\\/]/
const windowsDeviceSegment = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i

/** Only own data fields are projected; accessors and unrelated fields are not evaluated. */
function ownString(project: object, key: keyof CliCopyProject, max: number): string {
  const field = Object.getOwnPropertyDescriptor(project, key)
  if (!field || !('value' in field) || typeof field.value !== 'string') throw new CliCopyError()
  const value = field.value
  if (!value.trim() || value.length > max || unsafeMetadata.test(value)) throw new CliCopyError()
  return value
}

/** Lexical validation only: never resolve a path, query the filesystem or infer a machine. */
function isAbsoluteLocalPath(value: string): boolean {
  if (windowsDriveRoot.test(value)) {
    const rest = value.slice(3)
    // No drive-relative path, NTFS alternate stream or DOS device-name alias.
    return !rest.includes(':') && !rest.split(/[\\/]/).some(segment => windowsDeviceSegment.test(segment))
  }
  // UNC/network and Windows device namespaces are not local POSIX project paths.
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return false
  if (/^\/(?:\?\?)(?:[\\/]|$)/.test(value) || /^\/dev(?:\/|$)/.test(value)) return false
  return true
}

/** The only UI entry point. Builds the two actual v148 panel texts; performs no external action. */
export function buildProjectCliCopy(project: unknown): { agentPrompt: string; skillPrompt: string } {
  try {
    if (!project || typeof project !== 'object' || Array.isArray(project)) throw new CliCopyError()
    const id = ownString(project, 'id', 128)
    // Require the entire value, including the final character; JS "$" alone permits a final LF.
    if (projectIdPattern.exec(id)?.[0] !== id) throw new CliCopyError()
    const name = ownString(project, 'name', 256)
    const path = ownString(project, 'path', 4096)
    if (!isAbsoluteLocalPath(path)) throw new CliCopyError()
    const checked: CliCopyProject = { id, name, path }
    return {
      agentPrompt: buildCliAgentPromptWithCommands(checked),
      skillPrompt: buildCliSkillInstallPrompt(checked),
    }
  } catch {
    // Even a hostile Proxy must not leak a caller-provided exception message to the UI.
    throw new CliCopyError()
  }
}
