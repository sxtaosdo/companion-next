import { describe, expect, it, vi } from 'vitest'
import { buildProjectCliCopy, CliCopyError } from '../src/domain/cli-use-copy'
import {
  buildCliAgentPromptWithCommands,
  buildCliSkillInstallPrompt,
} from '../src/domain/legacy-v148-cli-use-copy'
import legacySource from '../src/domain/legacy-v148-cli-use-copy.ts?raw'

const sample = { id: 'cocos-project_01.full-id', name: '中文工程', path: 'D:\\Cocos Projects\\中文工程' }
const errorText = '工程登记信息不符合安全复制要求，请检查工程 ID、名称和绝对本地路径。'

function expectInvalid(project: unknown): void {
  try {
    buildProjectCliCopy(project)
    expect.fail('Expected invalid project to be rejected')
  } catch (error) {
    expect(error).toBeInstanceOf(CliCopyError)
    expect((error as CliCopyError).message).toBe(errorText)
    expect((error as CliCopyError).code).toBe('invalid-project')
    expect((error as CliCopyError).name).toBe('CliCopyError')
    expect((error as Error).cause).toBeUndefined()
  }
}

describe('the two real v148 project-bound CLI copy texts', () => {
  it('keeps the original source byte-for-byte, including its CRLF source endings', async () => {
    const cryptoModule = 'node:crypto'
    const { createHash } = await import(cryptoModule)
    expect(createHash('sha256').update(legacySource, 'utf8').digest('hex'))
      .toBe('a1dbbaa6e151f073b5a76318ada5606e5d378078d55415f6696f291645186899')
    expect(legacySource).toContain('\r\n')
  })

  it.each([
    sample,
    { id: 'A', name: ' 项目 "双引号" 与 \'单引号\' ', path: '/Users/test/Cocos Projects/项目 "一"' },
    { id: 'a'.repeat(128), name: '项目'.repeat(128), path: `/${'p'.repeat(4095)}` },
    { id: 'Project.2-3_4', name: 'Win game', path: "C:\\Dev\\Player's \"Test\" Game" },
    { id: '0-project', name: '斜杠工程', path: 'c:/Cocos Projects/中文工程' },
  ])('matches both complete original functions exactly for $id', project => {
    const result = buildProjectCliCopy(project)
    expect(Object.keys(result)).toEqual(['agentPrompt', 'skillPrompt'])
    expect(result).toEqual({
      agentPrompt: buildCliAgentPromptWithCommands(project),
      skillPrompt: buildCliSkillInstallPrompt(project),
    })
    for (const text of Object.values(result)) {
      expect(text).not.toContain('\r')
      expect(text).toContain(project.id)
      expect(text).toContain(project.name)
      expect(text).toContain(project.path)
      expect(text).not.toContain('…')
    }
    expect(result.agentPrompt.endsWith('```')).toBe(true)
    expect(result.skillPrompt.split('\n').filter(line => /^[1-9]\. /.test(line))).toHaveLength(9)
    expect(result.skillPrompt.endsWith('只有目标位置存在会显著改变结果的歧义时才向我提一个简短问题。')).toBe(true)
  })

  it('inserts only the exact complete validated ID in the four command lines', () => {
    const project = { ...sample, id: `project-${'1234567890'.repeat(11)}-tail` }
    const { agentPrompt, skillPrompt } = buildProjectCliCopy(project)
    expect(agentPrompt.split('```bash\n')[1]).toBe([
      'creator-ai doctor --json',
      `creator-ai project resolve --project ${project.id} --json`,
      `creator-ai creator info --project ${project.id} --json`,
      `creator-ai scene tree --project ${project.id} --json`,
      '```',
    ].join('\n'))
    expect(skillPrompt).toContain(`- projectId：${project.id}\n`)
    expect(agentPrompt.match(/--project /g)).toHaveLength(3)
  })

  it('keeps quoted/spaced and command-looking metadata inert, outside generated commands', () => {
    const project = {
      ...sample,
      name: ' 项目 "quoted" \'single\' ; echo METADATA_ONLY | other & text ',
      path: '/projects/$(echo METADATA_ONLY)/game \'one\' "two"',
    }
    const result = buildProjectCliCopy(project)
    expect(result.agentPrompt).toBe(buildCliAgentPromptWithCommands(project))
    expect(result.skillPrompt).toBe(buildCliSkillInstallPrompt(project))
    const commandBlock = result.agentPrompt.split('```bash\n')[1]!
    expect(commandBlock).not.toContain('METADATA_ONLY')
    expect(commandBlock).not.toContain(project.path)
    expect(commandBlock).not.toContain(project.name)
  })

  it('is deterministic, does not mutate or read unrelated fields, and returns only text', () => {
    const secretGetter = vi.fn(() => { throw new Error('synthetic-private-value') })
    const project = Object.freeze(Object.defineProperty({ ...sample }, 'token', { get: secretGetter }))
    const first = buildProjectCliCopy(project)
    expect(buildProjectCliCopy(project)).toEqual(first)
    expect(first).not.toBe(buildProjectCliCopy(project))
    expect(secretGetter).not.toHaveBeenCalled()
    expect(Object.values(first).every(value => typeof value === 'string')).toBe(true)
    expect(JSON.stringify(first)).not.toContain('synthetic-private-value')
    expect(project.id).toBe(sample.id)
  })

  it('contains Skill installation instructions as text without writing files or invoking browser APIs', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected-network'))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const result = buildProjectCliCopy(sample)
    expect(result.skillPrompt).toContain('`.cursor/skills/`')
    expect(result.skillPrompt).toContain('`.codex/skills/` 或 `.agents/skills/`')
    expect(result.skillPrompt).toContain('不要为此注册 MCP')
    expect(result.skillPrompt).toContain('不要修改游戏功能代码，也不要提交或推送本次变更。')
    expect(fetch).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    // The preserved module has no imports, runtime execution, filesystem or clipboard APIs.
    expect(legacySource).not.toMatch(/^\s*import\b|\b(?:require|fetch|eval)\s*\(|\bnavigator\.|\bwindow\./m)
  })
})

describe('safe project metadata validation', () => {
  it.each([null, undefined, [], 'project', 1, true, {}, { id: sample.id }, { ...sample, id: null },
    { ...sample, name: 1 }, { ...sample, path: {} }])('rejects malformed input %#', expectInvalid)

  it.each([
    '', ' ', '-flag', '_prefix', '.prefix', 'x'.repeat(129), '项目', 'id with space',
    'id;echo PSEUDO_COMMAND', 'id&&echo PSEUDO_COMMAND', 'id|echo PSEUDO_COMMAND',
    '$(echo PSEUDO_COMMAND)', '`echo PSEUDO_COMMAND`', 'id --project other',
    'id/other', 'id\\other', "id'quoted", 'id"quoted', 'id\n', 'id\r', 'id\r\n',
    'id\u2028', 'id\u2029', 'id\u202e', 'id\u2066',
  ])('rejects the complete unsafe ID %# without trimming or shortening', id => expectInvalid({ ...sample, id }))

  it.each([
    '', ' ', 'game', './game', '../game', '~/game', 'C:game', 'C:', '\\game',
    'https://example.invalid/game', 'file:///C:/game', 'ssh://host/game', 'data:text/plain,game',
    '\\\\host\\share\\game', '//host/share/game', '\\\\?\\C:\\game', '\\\\.\\C:\\game',
    '\\??\\C:\\game', '/??/C:/game', '/\\?\\C:\\game', '/dev/null', '/dev',
    'C:\\NUL', 'C:\\CON.txt', 'C:\\projects\\LPT1', 'C:\\projects\\game:stream',
    `/${'p'.repeat(4096)}`,
  ])('rejects a non-local, relative, device or over-budget path %#', path => expectInvalid({ ...sample, path }))

  it.each(['', ' ', '\t', 'n'.repeat(257)])('rejects an empty or over-budget name %#', name => expectInvalid({ ...sample, name }))

  const forbidden = [
    '\u0000', '\u0001', '\t', '\n', '\r', '\u001b', '\u007f', '\u0085', '\u009f',
    '\u00ad', '\u200b', '\u200e', '\u200f', '\u2028', '\u2029', '\u202a', '\u202b',
    '\u202c', '\u202d', '\u202e', '\u2066', '\u2067', '\u2068', '\u2069', '\ufeff',
    '\ud800', '\udfff', '`', '```', '<', '>', '[', ']',
  ]
  it.each(forbidden)('rejects display-boundary characters in both name and path %#', character => {
    expectInvalid({ ...sample, name: `safe${character}unsafe` })
    expectInvalid({ ...sample, path: `/project/safe${character}unsafe` })
  })

  it('rejects multiline pseudo-commands and forged Markdown without returning partial copy text', () => {
    for (const metadata of ['game\ncreator-ai creator start --project other', 'game\r\n```bash\necho PSEUDO_COMMAND\n```',
      '[project](https://example.invalid)', '<img src=x onerror=alert(1)>']) {
      expectInvalid({ ...sample, name: metadata })
      expectInvalid({ ...sample, path: `/project/${metadata}` })
    }
  })

  it('accepts ordinary Unicode, whitespace, quotes and Windows backslashes unchanged', () => {
    const project = { id: 'A0._-Z', name: '项目 🚀 é "double" \'single\'', path: 'E:\\测试 工程\\中文路径' }
    expect(buildProjectCliCopy(project)).toEqual({
      agentPrompt: buildCliAgentPromptWithCommands(project),
      skillPrompt: buildCliSkillInstallPrompt(project),
    })
  })

  it('does not call metadata accessors or accept inherited project fields', () => {
    const getter = vi.fn(() => sample.id)
    expectInvalid(Object.defineProperty({ name: sample.name, path: sample.path }, 'id', { get: getter }))
    expect(getter).not.toHaveBeenCalled()
    expectInvalid(Object.create(sample))
  })

  it('sanitizes exceptions raised by malformed inputs', () => {
    expectInvalid(new Proxy(sample, { getOwnPropertyDescriptor() { throw new Error('synthetic-secret-url-and-path') } }))
  })
})
