import { execFile as nodeExecFile } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { basename, delimiter, join } from "node:path";
import { promisify } from "node:util";

/** 写入 Codex 的 MCP 服务配置摘要。 */
export interface CodexMcpConfiguration {
  name: string;
  command: string;
  args: string[];
  projectId: string;
}

/** 可注入的 execFile 实现，便于测试。 */
export type ExecFile = (file: string, args: readonly string[]) => Promise<{ stdout: string; stderr: string }>;

const defaultExecFile: ExecFile = async (file, args) => {
  const result = await promisify(nodeExecFile)(file, [...args], { encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr };
};

/** 根据工程名与 ID 生成稳定的 Codex MCP 服务名称。 */
export function stableMcpName(projectName: string, projectId: string): string {
  const slug = projectName.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  return `cocos-creator-${slug}-${projectId.slice(0, 8).toLowerCase()}`;
}

/** 定位 Codex CLI 可执行文件（显式路径、PATH、常见应用内路径或 which）。 */
export async function findCodexCli(options: { explicitPath?: string; envPath?: string; localAppData?: string; execFile?: ExecFile } = {}): Promise<string> {
  if (options.explicitPath) {
    await access(options.explicitPath);
    return options.explicitPath;
  }
  const execFile = options.execFile ?? defaultExecFile;
  const executableNames = process.platform === "win32" ? ["codex.exe", "codex.cmd", "codex"] : ["codex"];
  const candidates = (options.envPath ?? process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .flatMap((dir) => executableNames.map((name) => join(dir, name)));
  candidates.push(
    "/Applications/ChatGPT.app/Contents/Resources/codex",
    "/Applications/Codex.app/Contents/Resources/codex",
  );
  if (process.platform === "win32") {
    const localAppData = options.localAppData ?? process.env.LOCALAPPDATA;
    if (localAppData) {
      const codexBin = join(localAppData, "OpenAI", "Codex", "bin");
      candidates.push(join(codexBin, "codex.exe"));
      try {
        const entries = await readdir(codexBin, { withFileTypes: true });
        candidates.push(...entries.filter((entry) => entry.isDirectory()).map((entry) => join(codexBin, entry.name, "codex.exe")));
      } catch { /* Codex Desktop is not installed in the standard location */ }
    }
  }
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* continue */ }
  }
  try {
    const locator = process.platform === "win32" ? "where.exe" : "/usr/bin/which";
    const { stdout } = await execFile(locator, ["codex"]);
    const found = stdout.split(/\r?\n/, 1)[0]?.trim();
    if (found) return found;
  } catch { /* report one stable error below */ }
  throw new Error("找不到 Codex CLI；请先安装 Codex，或通过 --codex 指定可执行文件");
}

function parsedTransport(text: string): { command: string; args: string[] } | undefined {
  try {
    const value = JSON.parse(text) as { transport?: { command?: unknown; args?: unknown } };
    const command = value.transport?.command;
    const args = value.transport?.args;
    if (typeof command === "string" && Array.isArray(args) && args.every((item): item is string => typeof item === "string")) {
      return { command, args };
    }
  } catch { /* older Codex versions may return human-readable text */ }
  return undefined;
}

function matchesManagedConfig(text: string, creatorAiPath: string, projectId: string): boolean {
  const transport = parsedTransport(text);
  if (transport) {
    return transport.command === creatorAiPath
      && transport.args.length === 3
      && transport.args[0] === "mcp"
      && transport.args[1] === "--project"
      && transport.args[2] === projectId;
  }
  return text.includes(creatorAiPath) && text.includes("mcp") && text.includes("--project") && text.includes(projectId)
    && !/connection\.json|token|ws:\/\//i.test(text);
}

function legacyForProject(text: string, projectPath?: string): { command: string; args: string[] } | undefined {
  if (!projectPath) return undefined;
  const transport = parsedTransport(text);
  if (transport) {
    const { command, args } = transport;
    const connectionPath = `${projectPath}/temp/creator-ai-bridge/connection.json`;
    if (args.includes(connectionPath) && args.some((item) => /mcp-server\.(?:cjs|mjs|js)$/.test(item))) return { command, args };
  }
  return undefined;
}

/**
 * 为指定工程在 Codex 中添加或迁移 Companion MCP 配置。
 * 已是受管配置则跳过；失败时回滚本次写入并尽量恢复可迁移的旧条目。
 */
export async function configureCodexMcp(input: {
  projectId: string;
  projectName?: string;
  projectPath?: string;
  creatorAiPath: string;
  codexPath?: string;
}, options: { execFile?: ExecFile } = {}): Promise<CodexMcpConfiguration & { changed: boolean }> {
  const execFile = options.execFile ?? defaultExecFile;
  const codexPath = input.codexPath ?? await findCodexCli({ execFile });
  const name = stableMcpName(input.projectName ?? basename(input.projectPath ?? "project"), input.projectId);
  let previous: { command: string; args: string[] } | undefined;
  let currentText: string | undefined;
  try { currentText = (await execFile(codexPath, ["mcp", "get", name, "--json"])).stdout; } catch { /* not installed */ }
  if (currentText !== undefined) {
    if (matchesManagedConfig(currentText, input.creatorAiPath, input.projectId)) {
      return { name, command: input.creatorAiPath, args: ["mcp", "--project", input.projectId], projectId: input.projectId, changed: false };
    }
    previous = legacyForProject(currentText, input.projectPath);
    if (!previous) throw new Error(`Codex 中已存在同名 MCP ${name}，但不是当前工程可迁移的旧配置；未覆盖`);
    await execFile(codexPath, ["mcp", "remove", name]);
  }

  await execFile(codexPath, ["mcp", "add", name, "--", input.creatorAiPath, "mcp", "--project", input.projectId]);
  try {
    const verified = await execFile(codexPath, ["mcp", "get", name, "--json"]);
    if (!matchesManagedConfig(verified.stdout, input.creatorAiPath, input.projectId)) throw new Error("回读内容与预期不一致");
  } catch (error) {
    // Only roll back the exact entry created by this invocation. Other MCP entries are never touched.
    try { await execFile(codexPath, ["mcp", "remove", name]); } catch { /* preserve the primary error */ }
    if (previous) {
      try { await execFile(codexPath, ["mcp", "add", name, "--", previous.command, ...previous.args]); } catch { /* preserve primary error */ }
    }
    throw new Error(`Codex MCP 配置回读失败：${error instanceof Error ? error.message : String(error)}`);
  }
  return { name, command: input.creatorAiPath, args: ["mcp", "--project", input.projectId], projectId: input.projectId, changed: true };
}
