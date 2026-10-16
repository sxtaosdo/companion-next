/** 「使用 CLI」弹窗中按工程生成的可复制文本。 */

export type CliCopyProject = {
  id: string;
  name: string;
  path: string;
};

/** 将工程名写入 YAML 双引号标量。 */
function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** 绑定当前工程的检查命令。 */
export function buildCliCommands(project: CliCopyProject): string {
  return [
    "creator-ai doctor --json",
    `creator-ai project resolve --project ${project.id} --json`,
    `creator-ai creator info --project ${project.id} --json`,
    `creator-ai scene tree --project ${project.id} --json`,
  ].join("\n");
}

/** 绑定当前工程的短任务提示词。 */
export function buildCliAgentPrompt(project: CliCopyProject): string {
  return [
    `使用 creator-ai CLI 操作 Cocos Creator 工程“${project.name}”。`,
    `目标 projectId：${project.id}`,
    `工程绝对路径：${project.path}`,
    "先执行 doctor、project resolve、creator info 和 scene tree，并核对返回的 projectId 与工程路径。",
    "后续优先使用 creator-ai 语义命令；所有命令添加 --json，并同时检查退出码和 status。",
    "写入前读取最新 revision/hash，写入后保存并重新读取验证；禁止直接修改 .scene、.prefab 或 .meta。",
    "不要猜测当前目录、最近工程，也不要操作其他 Creator 工程。",
  ].join("\n");
}

/** Agent 提示词 + 文末检查命令，供「使用 CLI」弹板一键复制。 */
export function buildCliAgentPromptWithCommands(project: CliCopyProject): string {
  return [
    buildCliAgentPrompt(project),
    "",
    "建议先执行：",
    "```bash",
    buildCliCommands(project),
    "```",
  ].join("\n");
}

/** 绑定当前工程的 CLI 使用说明 SKILL.md。 */
export function buildCliSkillMarkdown(project: CliCopyProject): string {
  const flag = `--project ${project.id}`;
  return `---
name: creator-ai
description: Use creator-ai CLI to inspect and safely modify the Cocos Creator project ${yamlQuote(project.name)} (projectId ${project.id}) without guessing the active Creator instance.
---

# Creator AI Companion

Use the semantic \`creator-ai\` CLI for this Cocos Creator project. Do not register MCP unless it is already configured. Never guess another Creator instance.

- Project name: ${project.name}
- projectId: ${project.id}
- Absolute path: ${project.path}

## Required sequence

1. Run \`command -v creator-ai\` and \`creator-ai doctor --json\`.
2. Resolve this project with \`creator-ai project resolve ${flag} --json\`. Interactive \`setup\`, \`creator start\`, and \`creator restart\` must start or reuse the project through Cocos Dashboard.
3. Read \`project status\`, Creator project info, and the latest Scene or Prefab tree before any write, always with ${flag}.
4. Confirm the returned project path is \`${project.path}\` and the projectId is \`${project.id}\`. Before any full-control operation, confirm \`capabilityProfile\` is \`full-control\` in the returned Bridge state; never probe permissions by attempting \`execute_scene_script\` or \`execute_editor_script\`.
5. Use a semantic command for the write, with ${flag}, the latest revision/hash, required confirmation, policy/lease, and a stable \`operationId\`.
6. Save when required, then re-read through Creator and verify the new revision and real resource references. If the outcome is unknown, query/reconcile the operation; never replay a write blindly.

\`--project\` accepts only this exact \`projectId\` or this registered absolute path. Never route by the last opened Creator, the current working directory, or a guessed project name.

## CLI contract

- Discover commands with \`creator-ai tools list --json\` and \`creator-ai tools describe <tool-name> --json\`; prefer semantic \`<group> <action>\` commands. Use \`creator-ai tool call <mcp-tool-name>\` only as a compatibility fallback for a newly added tool.
- Choose at most one complex input source: \`--input '<json>'\`, \`--input-file <path>\`, or \`--input -\` for stdin. Simple flags override same-named top-level JSON fields.
- Prefer \`--json\`; stdout is one \`cocos-tool-result-v1\`, while diagnostics go to stderr. Exit codes are \`0\` success, \`1\` tool failure, \`2\` input/project error, \`3\` Daemon/Bridge unavailable, and \`4\` policy/lease/coordination refusal.
- Screenshot commands require \`--out <png>\` and return file evidence instead of base64 on stdout.
- Default tool scope is “All tools” (machine value \`full\`); the reduced scope is “Core tools” (\`core\`). Tool scope controls visibility only and never grants Creator permission. Use persistent CLI presets with \`tools preset show/use\`.

## Safety rules

- Never directly write \`.scene\`, \`.prefab\`, or \`.meta\`; all such changes must pass through Daemon, Bridge, and Creator serialization.
- Never launch an interactive Creator with \`CocosCreator --project\`. Check Dashboard/Bridge state first and reuse the matching open Creator. If no matching Creator is open, use \`creator-ai setup\` or \`creator-ai creator start ${flag}\`; when Dashboard automation cannot select the project, ask the user to select and start it in Dashboard while Companion waits for the matching PID. A controlled isolated \`--build\` subprocess is the only exception.
- Never expose or copy \`connection.json\`, its token, or temporary Bridge ports.
- Do not stop or restart Creator when Companion reports unsaved Scene or Prefab changes.
- Do not use delete, force-stop, script execution, or other destructive/full-control operations unless the user explicitly requests the exact action and all required confirmation guards are present.
- Read-only connection failures may rediscover and retry once. Writes must never auto-retry; use stable \`operationId\` lookup/reconciliation.
- \`execute_scene_script\` requires full-control capability and \`confirm: "EXECUTE_SCENE_SCRIPT"\`; \`execute_editor_script\` requires full-control capability and \`confirm: "EXECUTE_EDITOR_SCRIPT"\`.
- For UI, prefer semantic UI/Node/Prefab commands over raw \`execute-*\`; address nodes with NodeRef priority \`uuid\` > \`semanticKey\` > \`path\` > unique \`name\`.
- Preview, screenshot, playtest, Build Smoke, and Profiler browser automation must use Microsoft Edge.

## Copyable examples

\`\`\`bash
command -v creator-ai
creator-ai doctor --json
creator-ai project resolve ${flag} --json
creator-ai creator info ${flag} --json
creator-ai scene tree ${flag} --json
\`\`\`
`;
}

/** 让 Agent 把 CLI 使用说明 Skill 写入当前环境的项目级目录。 */
export function buildCliSkillInstallPrompt(project: CliCopyProject): string {
  return [
    `你正在可通过 creator-ai CLI 操作的 Cocos Creator 项目“${project.name}”中。请不要只提供教程或示例，直接为当前项目创建一个可被当前 Agent 自动发现和复用的 CLI 使用说明 Skill。`,
    "",
    "目标工程：",
    `- 名称：${project.name}`,
    `- projectId：${project.id}`,
    `- 绝对路径：${project.path}`,
    "",
    "要求：",
    "1. 识别当前运行环境（Cursor、Codex 或其他兼容 Agent）实际支持的项目级 Skill 目录与格式，优先使用该环境的项目级共享目录；不要凭空猜路径。Cursor 使用 `.cursor/skills/`，Codex 使用 `.codex/skills/` 或 `.agents/skills/`。若环境支持通用 Agent Skills，使用“<skill-name>/SKILL.md”结构。",
    "2. Skill 名称使用 creator-ai。YAML frontmatter 只保留 name 和 description；description 写清用 creator-ai CLI 操作上述工程，以及禁止猜测其他 Creator 实例。",
    "3. 正文必须绑定上述 projectId 与绝对路径；所有 creator-ai 命令带 `--project <projectId> --json`。先执行 doctor、project resolve、creator info 和 scene tree，再写入。",
    "4. 修改 Scene、Prefab、Meta 时只能使用 creator-ai 语义命令，遵守 revision/hash、保存后回读、Undo/回滚和验证要求，禁止直接改写序列化文件。交互式 Creator 必须经 Cocos Dashboard。",
    "5. 不要为此注册 MCP，除非用户已经配置；本 Skill 走 CLI。不要猜测当前目录或最近工程，也不要操作其他 Creator 工程。",
    "6. 若同名 Skill 已存在，先读取并做最小增量更新，不得覆盖无关内容。不要修改游戏功能代码，也不要提交或推送本次变更。",
    "7. 仅在确有重复价值时创建 scripts/、references/ 或 assets/；不要创建 README、安装指南、更新日志等额外文件。",
    "8. 创建后运行当前环境可用的 Skill 校验器；若没有校验器，至少检查目录名、frontmatter、引用路径和触发描述。",
    "9. 最后汇报：Skill 路径、适用场景、触发示例、校验结果，以及在当前 Agent 中自动触发和显式调用各一个示例。",
    "",
    "现在开始检查当前工程并写入 CLI 使用说明 Skill；只有目标位置存在会显著改变结果的歧义时才向我提一个简短问题。",
  ].join("\n");
}
