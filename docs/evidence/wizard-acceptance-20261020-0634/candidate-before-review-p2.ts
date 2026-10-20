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

function matchesTargetTransport(text: string, target: { command: string; args: string[] }): boolean {
  const transport = parsedTransport(text);
  if (!transport || transport.args.length !== target.args.length) return false;
  const samePath = (left: string, right: string) => process.platform === "win32"
    ? left.replace(/\\/g, "/").toLowerCase() === right.replace(/\\/g, "/").toLowerCase()
    : left === right;
  return samePath(transport.command, target.command)
    && transport.args.every((item, index) => process.platform === "win32" && index === 0
      ? samePath(item, target.args[index]!) : item === target.args[index]);
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

export type CodexRecoveryState = "unchanged" | "restored" | "removed" | "conflict" | "unknown" | "restore-failed";

/** Stable, non-secret evidence. CLI output/configuration is deliberately not attached. */
export class CodexConfigurationFault extends Error {
  readonly code = "CODEX_MCP_CONFIGURATION_FAILED";
  constructor(readonly stage: "read" | "remove" | "add" | "verify", readonly recovery: CodexRecoveryState) {
    super(`Codex MCP 配置失败；阶段=${stage}；恢复状态=${recovery}`);
    this.name = "CodexConfigurationFault";
  }
}

type Entry = { state: "absent" } | { state: "unknown" } | { state: "present"; text: string };

/** Only an explicit missing-entry error proves absence; a CLI failure does not. */
function isMissingEntry(error: unknown, name: string): boolean {
  const value = error as { code?: unknown; message?: unknown; stderr?: unknown } | null;
  if (value?.code !== 1) return false;
  const text = typeof value.stderr === "string" && value.stderr.trim() ? value.stderr : value.message;
  if (typeof text !== "string") return false;
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const missing = (line: string) => line === `No MCP server named '${name}' found.`
    || line === `error: No MCP server named '${name}' found.`
    || line === `Error: No MCP server named '${name}' found.`;
  return lines.some(missing) && lines.every(line => missing(line)
    || line.startsWith('WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir '));
}

/** These defaults are reproducible by `mcp add -- command args`. Reject extra settings
 * rather than migrate/drop them or mistake an externally edited entry for our write. */
function reproducibleTransport(text: string, name: string): { command: string; args: string[] } | undefined {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const defaults = new Set(["name", "transport", "enabled", "disabled_reason", "startup_timeout_sec", "tool_timeout_sec", "enabled_tools", "disabled_tools"]);
    if (Object.keys(value).some(key => !defaults.has(key))) return;
    if (value.name !== undefined && value.name !== name) return;
    if (value.enabled !== undefined && value.enabled !== true) return;
    for (const key of ["disabled_reason", "startup_timeout_sec", "tool_timeout_sec"]) if (value[key] !== undefined && value[key] !== null) return;
    for (const key of ["enabled_tools", "disabled_tools"]) if (value[key] !== undefined && value[key] !== null) return;
    const transport = value.transport as Record<string, unknown>;
    if (!transport || typeof transport !== "object" || Array.isArray(transport)) return;
    if (Object.keys(transport).some(key => !["type", "command", "args", "env", "env_vars", "cwd"].includes(key))) return;
    if (transport.type !== undefined && transport.type !== "stdio") return;
    if (transport.cwd !== undefined && transport.cwd !== null) return;
    if (transport.env !== undefined && transport.env !== null && !(typeof transport.env === "object" && !Array.isArray(transport.env) && Object.keys(transport.env).length === 0)) return;
    if (transport.env_vars !== undefined && !(Array.isArray(transport.env_vars) && transport.env_vars.length === 0)) return;
    return parsedTransport(text);
  } catch { return; }
}

/**
 * Configure through the supported CLI. Each failed mutation is read back before
 * recovery; ambiguous/foreign entries are preserved. The CLI offers no CAS, so
 * these read guards cannot make a concurrent writer between read/write atomic.
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
  const target = process.platform === "win32"
    ? { command: process.execPath, args: [input.creatorAiPath, "mcp", "--project", input.projectId] }
    : { command: input.creatorAiPath, args: ["mcp", "--project", input.projectId] };
  const result = { name, ...target, projectId: input.projectId };
  const read = async (): Promise<Entry> => {
    try { return { state: "present", text: (await execFile(codexPath, ["mcp", "get", name, "--json"])).stdout }; }
    catch (error) { return isMissingEntry(error, name) ? { state: "absent" } : { state: "unknown" }; }
  };
  const initial = await read();
  if (initial.state === "unknown") throw new CodexConfigurationFault("read", "unknown");
  if (initial.state === "present" && reproducibleTransport(initial.text, name) && matchesTargetTransport(initial.text, target)) return { ...result, changed: false };
  const previous = initial.state === "present"
    ? legacyForProject(initial.text, input.projectPath)
      ?? (process.platform === "win32" && matchesManagedConfig(initial.text, input.creatorAiPath, input.projectId)
        ? reproducibleTransport(initial.text, name) : undefined)
    : undefined;
  if (initial.state === "present" && (!previous || !reproducibleTransport(initial.text, name))) {
    throw new CodexConfigurationFault("read", "conflict");
  }
  const sameTransport = (entry: Entry, expected: { command: string; args: string[] }) => {
    if (entry.state !== "present") return false;
    const actual = reproducibleTransport(entry.text, name);
    return actual?.command === expected.command && JSON.stringify(actual.args) === JSON.stringify(expected.args);
  };
  const add = (transport: { command: string; args: string[] }) => execFile(codexPath, ["mcp", "add", name, "--", transport.command, ...transport.args]);
  let mutationIssued = false, targetAddIssued = false;
  const recover = async (): Promise<CodexRecoveryState> => {
    let current = await read();
    if (current.state === "unknown") return "unknown";
    if (previous && sameTransport(current, previous)) return "unchanged";
    if (current.state === "present") {
      if (!targetAddIssued || !sameTransport(current, target)) return "conflict";
      // Recheck the entire entry, including non-transport metadata, before removal.
      const confirmed = await read();
      if (confirmed.state === "unknown") return "unknown";
      if (confirmed.state !== "present" || confirmed.text !== current.text) return "conflict";
      try { await execFile(codexPath, ["mcp", "remove", name]); } catch { /* mutation may have happened: read it */ }
      current = await read();
      if (current.state === "unknown") return "unknown";
      if (previous && sameTransport(current, previous)) return "restored";
      if (current.state === "present") return sameTransport(current, target) ? "restore-failed" : "conflict";
    }
    if (!previous) return "removed";
    // Absence must still be observed just before attempting the one restoration.
    const empty = await read();
    if (empty.state === "unknown") return "unknown";
    if (empty.state !== "absent") return sameTransport(empty, previous) ? "restored" : "conflict";
    try { await add(previous); } catch { /* a reported failure may have written the original */ }
    const restored = await read();
    if (restored.state === "unknown") return "unknown";
    if (sameTransport(restored, previous)) return "restored";
    return restored.state === "absent" ? "restore-failed" : "conflict";
  };
  let stage: "remove" | "add" | "verify" = previous ? "remove" : "add";
  try {
    const confirmed = await read();
    if (initial.state === "present") {
      if (confirmed.state !== "present" || confirmed.text !== initial.text) throw new CodexConfigurationFault(stage, confirmed.state === "unknown" ? "unknown" : "conflict");
      mutationIssued = true;
      await execFile(codexPath, ["mcp", "remove", name]);
      const empty = await read();
      if (empty.state !== "absent") throw new CodexConfigurationFault(stage, empty.state === "unknown" ? "unknown" : "conflict");
    } else if (confirmed.state !== "absent") {
      throw new CodexConfigurationFault(stage, confirmed.state === "unknown" ? "unknown" : "conflict");
    }
    stage = "add";
    mutationIssued = true; targetAddIssued = true;
    await add(target);
    stage = "verify";
    const verified = await read();
    if (!sameTransport(verified, target)) throw new CodexConfigurationFault(stage, verified.state === "unknown" ? "unknown" : "conflict");
  } catch (error) {
    if (!mutationIssued) throw error instanceof CodexConfigurationFault ? error : new CodexConfigurationFault(stage, "unknown");
    throw new CodexConfigurationFault(stage, await recover());
  }
  return { ...result, changed: true };
}
