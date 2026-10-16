import { describe, expect, it } from 'vitest'
import help from '../src/domain/legacy-v148-help.json'
import { CHANGELOG, CHANGELOG_ENTRIES, mergeChangelogWithinWindow } from '../src/domain/legacy-v148-changelog'
import type { ChangelogEntry } from '../src/domain/legacy-v148-changelog'

// Regression fingerprints cover every character in each statically extracted body.
// These are content checks, not a replacement for the verified v148 source manifest.
function contentFingerprint(value: string): string {
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < value.length; index++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(value.charCodeAt(index))) * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}

const topicBaselines = {
  profiler: [4, '5a2196f9b1976c3f'],
  playtest: [4, '9aa2c9b00dda84d1'],
  animation: [4, '47e58fee8aa49189'],
  projects: [14, 'da2c70a75adc3c50'],
  cli: [14, '15d53ed87087015b'],
  mcp: [19, 'f11e6761bbe0779a'],
  scene: [4, 'c92b0646f0525ff9'],
  assets: [4, 'e243bd991c709b6b'],
  ui: [4, '0077acc2dda9f07b'],
  tools: [4, '89cf69909dafa3e0'],
  'knowledge-can': [7, '4b40df49f158d7ad'],
  'knowledge-cannot': [6, '24375dce80ddf3e1'],
  models: [3, '768153fb2c4b15c9'],
} as const

const codeBlocks = (topic: keyof typeof help) => help[topic].filter(block => block.kind === 'code').map(block => block.text)

// Kept explicitly as a complete string so truncating the nine-step Skill prompt is visible.
const completeSkillPrompt = "你正在一个已接入 Creator AI MCP 的 Cocos Creator 项目中。请不要只提供教程或示例，直接为当前项目创建一个可被当前 Agent 自动发现和复用的项目专用 Skill。\n\n要求：\n1. 先阅读当前仓库的 AGENTS.md、README、package.json、已有 Skill 和关键目录，并通过本工程的 Creator AI MCP 确认绑定的 projectId、Creator/Bridge 状态及可用工具；不要操作其他工程。\n2. 识别当前运行环境（Cursor、Codex 或其他兼容 Agent）实际支持的项目级 Skill 目录与格式，优先使用该环境的项目级共享目录；不要凭空猜路径。若环境支持通用 Agent Skills，使用“<skill-name>/SKILL.md”结构。\n3. 根据工程中重复出现且有项目特性的工作流，归纳 2～4 个真实触发示例，再确定一个最值得复用的 Skill。Skill 名称使用 64 字符以内的小写字母、数字和连字符。\n4. SKILL.md 的 YAML frontmatter 只保留 name 和 description；description 同时写清“做什么”和“什么情况下触发”。正文使用简洁的命令式步骤，只保留 Agent 不容易自行推断的项目知识。\n5. Skill 必须要求执行前核对目标工程和真实 db://assets/... 场景；修改 Scene、Prefab、Meta 时只能使用 Creator AI MCP 的安全接口，遵守 revision/hash、保存后回读、Undo/回滚和验证要求，禁止直接改写序列化文件。\n6. 仅在确有重复价值时创建 scripts/、references/ 或 assets/；不要创建 README、安装指南、更新日志等额外文件。脚本必须实际运行测试。\n7. 若同名 Skill 已存在，先读取并做最小增量更新，不得覆盖无关内容。不要修改游戏功能代码，也不要提交或推送本次变更。\n8. 创建后运行当前环境可用的 Skill 校验器；若没有校验器，至少检查目录名、frontmatter、引用路径和触发描述，并用一个真实示例做只读演练。\n9. 最后汇报：Skill 路径、适用场景、触发示例、生成的资源、校验结果，以及在当前 Agent 中自动触发和显式调用各一个示例。\n\n现在开始检查当前工程并生成 Skill；只有目标位置或工作流存在会显著改变结果的歧义时才向我提一个简短问题。"

describe('complete, inert v148 help content', () => {
  it('retains all thirteen original topics and every extracted body character', () => {
    expect(Object.keys(help)).toEqual(Object.keys(topicBaselines))
    expect(Object.values(help).flat()).toHaveLength(91)
    for (const [topic, [count, fingerprint]] of Object.entries(topicBaselines)) {
      const blocks = help[topic as keyof typeof help]
      expect(blocks, topic).toHaveLength(count)
      expect(contentFingerprint(JSON.stringify(blocks)), topic).toBe(fingerprint)
    }
  })

  it('stores only plain text blocks, with no executable markup or copied controls', () => {
    const executableMarkup = /<\/?(?:script|iframe|object|embed|img|svg|style|link|meta|button|input|select|textarea|form|a|div|section|span|p|h[1-6]|li|ul|ol|pre|code)(?:\s|\/?>)/i
    for (const block of Object.values(help).flat()) {
      expect(Object.keys(block)).toEqual(['kind', 'text'])
      expect(['heading', 'paragraph', 'item', 'code', 'note']).toContain(block.kind)
      expect(block.text.trim()).not.toBe('')
      expect(block.text).not.toMatch(executableMarkup)
      expect(block.text).not.toMatch(/(?:javascript:|on(?:click|load|error)\s*=|data-copy-code|data-code-wrap|data-tip=)/i)
      expect(block.text).not.toContain('\r')
    }
    // Literal placeholders are part of the original commands, not DOM nodes.
    expect(codeBlocks('mcp')[0]).toBe('codex mcp add <name> -- creator-ai mcp --project <projectId>')
    expect(codeBlocks('animation')[0]).toContain('<写入具体要求>')
  })

  it('keeps all ten full prompt/code blocks and the exact multiline CLI template', () => {
    expect(Object.values(help).flat().filter(block => block.kind === 'code')).toHaveLength(10)
    expect(codeBlocks('cli')).toEqual([
      'creator-ai setup "/absolute/path/to/cocos-project"',
      'creator-ai doctor --json\ncreator-ai project resolve --project <projectId-or-absolute-path> --json\ncreator-ai creator info --project <projectId> --json\ncreator-ai scene tree --project <projectId> --json',
    ])
    expect(codeBlocks('mcp')[1]).toBe(completeSkillPrompt)
    expect(completeSkillPrompt.split('\n').filter(line => /^[1-9]\. /.test(line))).toHaveLength(9)
    expect(codeBlocks('profiler')).toEqual(['请检查当前工程的卡顿原因、运行时报错和渲染批次问题，并给出修复建议。请按复现步骤试玩后采集一次性能证据；修改后再采集一次，说明前后的变化。'])
    expect(codeBlocks('playtest')).toEqual(['请按真实操作路径查看当前工程，记录截图和错误。试玩结果目前不能当作通过。确认 Web Mobile 构建已完成且产物没有变化后，再检查构建能否正常打开，并汇报构建验收结果。'])
    expect(codeBlocks('animation')).toEqual(['请检查 Preview 和目标动画组件是否可用，然后对目标节点执行这项操作：<写入具体要求>。记录操作结果；如果当前工程不支持，请说明原因。'])
    expect(codeBlocks('scene')).toEqual(['请读取目标场景或 Prefab，完成这项最小修改：<写入具体要求>。保存后重新读取并确认结果；不要直接编辑 .scene、.prefab 或 .meta 文件。'])
    expect(codeBlocks('assets')).toEqual(['请检查目标资源及其依赖：<写入具体范围>。如需修改脚本，只做必要改动；等待编译完成后检查错误，并汇报可以确认的结果。'])
    expect(codeBlocks('ui')).toEqual(['请先查询当前 Creator 版本的 UI 布局和坐标规则，再读取现有界面和可用字体。按这个要求制作界面：<写入具体要求或参考图路径>。一次创建完整层级，保存后检查是否超出画布，并截取编辑器或 Preview 图片确认结果。'])
  })

  it('preserves all six original data-tip explanations and their safety boundaries', () => {
    for (const topic of ['profiler', 'playtest', 'animation', 'scene', 'assets', 'ui'] as const) {
      expect(help[topic].filter(block => block.kind === 'note'), topic).toHaveLength(1)
    }
    expect(help.playtest.find(block => block.kind === 'note')?.text).toContain('步骤成功时调用记为成功并保留报告，但这不是验收通过')
    expect(help.animation.find(block => block.kind === 'note')?.text).toContain('Spine 未启用模块时返回不支持，输入模拟需要可用 Preview')
    expect(help.scene.find(block => block.kind === 'note')?.text).toContain('batch_execute 的 atomic 模式仅支持同一文档的补丁')
    expect(help.assets.find(block => block.kind === 'note')?.text).toContain('删除资源或执行编辑器脚本需要满足额外权限与确认条件')
    expect(help.ui.find(block => block.kind === 'note')?.text).toContain('参考图登记后仍需用编辑器截图确认实际显示')
  })

  it('describes dynamic tool presets without inventing a catalog or live permissions', () => {
    const text = help.tools.map(block => block.text).join('\n')
    expect(text).toContain('已连接的 MCP 客户端需重连后生效')
    expect(text).toContain('工具范围不会提升 Creator 权限')
    expect(text).toContain('当前新前端尚未接入工具动态目录与工具预设管理')
    expect(text).not.toContain('加载中')
    expect(text).not.toContain('Creator 权限：未连接')
    expect(codeBlocks('tools')).toEqual([])
  })
})

describe('complete v148 changelog and Beijing calendar-day grouping', () => {
  it('retains all original releases and changes, starting with 0.3.148', () => {
    expect(CHANGELOG_ENTRIES).toHaveLength(114)
    expect(CHANGELOG_ENTRIES.reduce((total, entry) => total + entry.changes.length, 0)).toBe(201)
    expect(contentFingerprint(JSON.stringify(CHANGELOG_ENTRIES))).toBe('b32171edeb956850')
    expect(CHANGELOG_ENTRIES[0]?.version).toBe('0.3.148')
    expect(CHANGELOG_ENTRIES[0]?.updatedAt).toBe('2026-10-12T06:44:36.677Z')
    expect(CHANGELOG_ENTRIES.at(-1)?.version).toBe('0.2.0')
    expect(CHANGELOG).toHaveLength(27)
    expect(CHANGELOG[0]?.version).toBe('0.3.148')
    expect(CHANGELOG.reduce((total, entry) => total + entry.changes.length, 0)).toBe(201)
  })

  it('merges the same Beijing day and separates updates one second across local midnight', () => {
    const entries: ChangelogEntry[] = [
      { version: 'day-12-newest', updatedAt: '2026-10-12T15:59:59Z', changes: ['A'] },
      { version: 'day-12-earliest', updatedAt: '2026-10-11T16:00:00Z', changes: ['B'] },
      { version: 'day-11-newest', updatedAt: '2026-10-11T15:59:59Z', changes: ['C'] },
      { version: 'day-11-earliest', updatedAt: '2026-10-10T16:00:00Z', changes: ['D'] },
    ]
    const expected = [
      { version: 'day-12-newest', updatedAt: '2026-10-12T15:59:59Z', changes: ['A', 'B'] },
      { version: 'day-11-newest', updatedAt: '2026-10-11T15:59:59Z', changes: ['C', 'D'] },
    ]
    expect(mergeChangelogWithinWindow(entries)).toEqual(expected)
    // The legacy rolling-window parameter cannot change the calendar-day contract.
    expect(mergeChangelogWithinWindow(entries, 1)).toEqual(expected)
  })

  it('recognizes equivalent offset dates and never mutates input records or changes arrays', () => {
    const entries: ChangelogEntry[] = [
      { version: 'newest', updatedAt: '2026-10-12T09:00:00+08:00', changes: ['new'] },
      { version: 'older', updatedAt: '2026-10-11T17:00:00Z', changes: ['old'] },
    ]
    const before = JSON.stringify(entries)
    for (const entry of entries) { Object.freeze(entry.changes); Object.freeze(entry) }
    Object.freeze(entries)
    const merged = mergeChangelogWithinWindow(entries)
    expect(merged).toEqual([{ version: 'newest', updatedAt: '2026-10-12T09:00:00+08:00', changes: ['new', 'old'] }])
    expect(JSON.stringify(entries)).toBe(before)
    expect(merged[0]).not.toBe(entries[0])
    expect(merged[0]?.changes).not.toBe(entries[0]?.changes)
    merged[0]!.changes.push('independent display-only change')
    expect(JSON.stringify(entries)).toBe(before)
  })

  it('does not merge invalid timestamps or reverse-ordered entries as if they were confirmed same-day history', () => {
    const entries: ChangelogEntry[] = [
      { version: 'unknown', updatedAt: 'unknown', changes: ['A'] },
      { version: 'earlier', updatedAt: '2026-10-12T01:00:00Z', changes: ['B'] },
      { version: 'later', updatedAt: '2026-10-12T02:00:00Z', changes: ['C'] },
    ]
    expect(mergeChangelogWithinWindow(entries)).toEqual(entries)
  })
})
