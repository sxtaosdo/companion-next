import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import type { Stats } from "node:fs";
import { join } from "node:path";

export class ConfigFileSecurityFault extends Error {
  readonly code = "MCP_CONFIG_SECURITY_UNVERIFIED";
  constructor() { super("MCP_CONFIG_SECURITY_UNVERIFIED"); }
}
export interface ConfigFileSecuritySnapshot {
  readonly identity: string;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  /** Windows Owner/Group/DACL only. Never include in diagnostics. */
  readonly windowsOgd?: string;
}
export interface ConfigFileSecurityOps {
  snapshot(path: string): Promise<ConfigFileSecuritySnapshot>;
  prepareEmptyStage(path: string, snapshot: ConfigFileSecuritySnapshot): Promise<void>;
  matches(path: string, snapshot: ConfigFileSecuritySnapshot): Promise<boolean>;
}
function regular(stat: Stats): void {
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new ConfigFileSecurityFault();
}
function identity(stat: Stats): string {
  return JSON.stringify([stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.mode, stat.uid, stat.gid]);
}

// Fixed code, private JSON stdin/stdout; paths/descriptors never enter command arguments.
// SACL is intentionally outside this contract. No audit privilege is requested.
const ACL_SCRIPT = String.raw`$ErrorActionPreference='Stop'
$request=[Console]::In.ReadToEnd()|ConvertFrom-Json
$sections=[System.Security.AccessControl.AccessControlSections]::Owner -bor [System.Security.AccessControl.AccessControlSections]::Group -bor [System.Security.AccessControl.AccessControlSections]::Access
function Read-Ogd([string]$path) {
  $item=Get-Item -LiteralPath $path -Force
  if($item.PSIsContainer -or (($item.Attributes -band (-bnot 160)) -ne 0)) {throw 'unsupported-file'}
  $streams=@(Get-Item -LiteralPath $path -Stream '*')
  if($streams.Count -ne 1 -or $streams[0].Stream -ne ':$DATA') {throw 'unsupported-streams'}
  return (Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm($sections)
}
if($request.operation -eq 'snapshot') {
  @{sddl=(Read-Ogd $request.path)}|ConvertTo-Json -Compress
} elseif($request.operation -eq 'prepare') {
  $null=Read-Ogd $request.path
  if((Get-Item -LiteralPath $request.path -Force).Length -ne 0) {throw 'stage-not-empty'}
  $acl=Get-Acl -LiteralPath $request.path
  $acl.SetSecurityDescriptorSddlForm([string]$request.sddl,$sections)
  Set-Acl -LiteralPath $request.path -AclObject $acl
  if((Read-Ogd $request.path) -cne [string]$request.sddl) {throw 'security-mismatch'}
  @{ok=$true}|ConvertTo-Json -Compress
} else {throw 'unsupported-operation'}`;

async function windowsAcl(request: { operation: "snapshot" | "prepare"; path: string; sddl?: string }): Promise<{ sddl?: string; ok?: boolean }> {
  return await new Promise((resolve, reject) => {
    const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT ?? "C:/Windows";
    const child = spawn(join(systemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe"),
      ["-NoProfile", "-NonInteractive", "-Command", ACL_SCRIPT],
      { windowsHide: true, shell: false, env: { SystemRoot: systemRoot, WINDIR: systemRoot }, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let bytes = 0, failed = false;
    const fail = () => { failed = true; child.kill(); };
    const timer = setTimeout(fail, 10_000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stdout.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 32_768) fail(); else if (!failed) chunks.push(chunk); });
    child.stderr.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 32_768) fail(); });
    child.once("close", code => {
      clearTimeout(timer);
      if (failed || code !== 0) { reject(new ConfigFileSecurityFault()); return; }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (request.operation === "snapshot" ? typeof parsed.sddl !== "string" || !parsed.sddl : parsed.ok !== true) throw new Error();
        resolve(parsed);
      } catch { reject(new ConfigFileSecurityFault()); }
    });
    // Escape each non-ASCII UTF-16 code unit, including surrogate pairs. JSON then
    // survives PowerShell's inherited stdin code page without changing any code page.
    const input = JSON.stringify(request).replace(/[\u0080-\uffff]/g,
      character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
    child.stdin.end(input);
  });
}

/** Preserve POSIX mode/uid/gid or Windows O/G/D, not full file/SACL semantics. */
export const configFileSecurity: ConfigFileSecurityOps = {
  async snapshot(path) {
    const before = await lstat(path); regular(before);
    const windowsOgd = process.platform === "win32" ? (await windowsAcl({ operation: "snapshot", path })).sddl! : undefined;
    const after = await lstat(path); regular(after);
    if (identity(before) !== identity(after)) throw new ConfigFileSecurityFault();
    return { identity: identity(after), mode: after.mode & 0o7777, uid: after.uid, gid: after.gid,
      ...(windowsOgd === undefined ? {} : { windowsOgd }) };
  },
  async prepareEmptyStage(path, original) {
    const before = await lstat(path); regular(before);
    if (before.size !== 0) throw new ConfigFileSecurityFault();
    if (process.platform === "win32") {
      if (!original.windowsOgd) throw new ConfigFileSecurityFault();
      await windowsAcl({ operation: "prepare", path, sddl: original.windowsOgd });
    }
    const after = await lstat(path); regular(after);
    if (before.dev !== after.dev || before.ino !== after.ino || after.size !== 0
      || (process.platform !== "win32" && ((after.mode & 0o7777) !== original.mode || after.uid !== original.uid || after.gid !== original.gid))) throw new ConfigFileSecurityFault();
  },
  async matches(path, expected) {
    const actual = await this.snapshot(path);
    return actual.identity === expected.identity && actual.windowsOgd === expected.windowsOgd;
  },
};
