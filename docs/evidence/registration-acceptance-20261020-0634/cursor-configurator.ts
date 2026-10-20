import { access, mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { stableMcpName } from "./codex-configurator.js";
import { atomicConfigWrite, type AtomicConfigFileOps } from "./atomic-config-write.js";

/** 写入 Cursor 的 MCP 服务配置摘要。 */
export interface CursorMcpConfiguration {
  name: string;
  command: string;
  args: string[];
  projectId: string;
  configPath: string;
  changed: boolean;
}

interface CursorMcpServerEntry {
  command?: unknown;
  args?: unknown;
  type?: unknown;
  [key: string]: unknown;
}

interface CursorMcpFile {
  mcpServers?: Record<string, CursorMcpServerEntry>;
  [key: string]: unknown;
}

function isManagedEntry(entry: CursorMcpServerEntry | undefined, projectId: string): boolean {
  if (!entry || typeof entry.command !== "string" || !Array.isArray(entry.args)) return false;
  if (!entry.args.every((item): item is string => typeof item === "string")) return false;
  return entry.args.includes("mcp")
    && entry.args.includes("--project")
    && entry.args.includes(projectId)
    && !entry.args.some((item) => /connection\.json|token|ws:\/\//i.test(item));
}

function sameEntry(entry: CursorMcpServerEntry | undefined, command: string, args: string[]): boolean {
  if (!entry || typeof entry.command !== "string" || !Array.isArray(entry.args)) return false;
  if (entry.command !== command || entry.args.length !== args.length) return false;
  return entry.args.every((item, index) => item === args[index]);
}

/** 解析 Cursor 全局 MCP 配置文件路径（可用依赖注入覆盖，便于测试）。 */
export function cursorMcpConfigPath(home = homedir()): string {
  return join(home, ".cursor", "mcp.json");
}

/**
 * 为指定工程在 Cursor 全局 mcp.json 中添加或更新 Companion MCP 配置。
 * 已是受管配置则跳过；同名但非本工程受管条目则拒绝覆盖。
 */
export async function configureCursorMcp(input: {
  projectId: string;
  projectName?: string;
  projectPath?: string;
  creatorAiPath: string;
  configPath?: string;
}, options: {
  readText?: (path: string) => Promise<string>;
  writeText?: (path: string, content: string) => Promise<void>;
  ensureDir?: (path: string) => Promise<void>;
  accessPath?: (path: string) => Promise<void>;
  atomicFileOps?: AtomicConfigFileOps;
} = {}): Promise<CursorMcpConfiguration> {
  // A virtual read source must never be combined with the real filesystem writer.
  if (!!options.readText !== !!options.writeText) throw new Error("MCP_CONFIG_IO_INJECTION_MIXED");
  const readText = options.readText ?? (async (path) => readFile(path, "utf8"));
  const ensureDir = options.ensureDir ?? (async (path) => { await mkdir(path, { recursive: true }); });
  const accessPath = options.accessPath ?? (async (path) => { await access(path); });
  const configPath = input.configPath ?? cursorMcpConfigPath();
  const name = stableMcpName(input.projectName ?? basename(input.projectPath ?? "project"), input.projectId);
  const args = ["mcp", "--project", input.projectId];
  const command = input.creatorAiPath;

  await accessPath(command);

  let file: CursorMcpFile = {};
  let original: string | undefined;
  try {
    const text = await readText(configPath);
    original = text;
    if (text.trim()) {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`Cursor MCP 配置不是 JSON 对象：${configPath}`);
      }
      file = parsed as CursorMcpFile;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      if (error instanceof SyntaxError) throw new Error(`Cursor MCP 配置 JSON 无效：${configPath}`);
      throw error;
    }
  }

  const servers = { ...(file.mcpServers ?? {}) };
  const existing = servers[name];
  if (sameEntry(existing, command, args)) {
    return { name, command, args, projectId: input.projectId, configPath, changed: false };
  }
  if (existing && !isManagedEntry(existing, input.projectId)) {
    throw new Error(`Cursor 中已存在同名 MCP ${name}，但不是当前工程可迁移的配置；未覆盖`);
  }

  servers[name] = { command, args };
  const next: CursorMcpFile = { ...file, mcpServers: servers };
  await ensureDir(dirname(configPath));
  const nextText = `${JSON.stringify(next, null, 2)}\n`;
  // Backwards-compatible virtual read/write injection owns its commit semantics.
  // Production omits writeText and always uses staged, no-clobber filesystem I/O.
  if (options.writeText) await options.writeText(configPath, nextText);
  else await atomicConfigWrite(configPath, original, nextText, options.atomicFileOps);
  return { name, command, args, projectId: input.projectId, configPath, changed: true };
}
