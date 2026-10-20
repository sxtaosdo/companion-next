import { randomUUID } from "node:crypto";
import { link, open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { configFileSecurity, ConfigFileSecurityFault, type ConfigFileSecurityOps } from "./config-file-security.js";

/** Local fault seams; omitted operations always use the real filesystem. */
export interface AtomicConfigFileOps {
  writeStage?: (path: string, text: string) => Promise<void>;
  readText?: (path: string) => Promise<string>;
  move?: (from: string, to: string) => Promise<void>;
  link?: (from: string, to: string) => Promise<void>;
  remove?: (path: string) => Promise<void>;
  security?: ConfigFileSecurityOps;
}

/** No raw I/O error or configuration contents are included in diagnostics. */
export class ConfigWriteFault extends Error {
  constructor(readonly code: "MCP_CONFIG_WRITE_FAILED" | "MCP_CONFIG_CONFLICT" | "MCP_CONFIG_RECOVERY_REQUIRED" | "MCP_CONFIG_CLEANUP_REQUIRED" | "MCP_CONFIG_SECURITY_UNVERIFIED",
    readonly recoveryPath?: string, readonly artifactPath?: string) {
    super(code);
    this.name = "ConfigWriteFault";
  }
}

function missing(error: unknown): boolean { return (error as NodeJS.ErrnoException)?.code === "ENOENT"; }
function exists(error: unknown): boolean { return (error as NodeJS.ErrnoException)?.code === "EEXIST"; }
async function writeStage(path: string, text: string): Promise<void> {
  const file = await open(path, "r+");
  try { await file.writeFile(text, "utf8"); await file.sync(); }
  finally { await file.close(); }
}

/**
 * Publish only complete bytes and never overwrite a newly appeared destination.
 * Capturing an existing file creates a short absent-path window; Node fs has no
 * portable compare-and-swap replacement. Any captured newer version, rather than
 * the original snapshot, is restored with no-clobber link on failure.
 * This guards pathname replacement, not arbitrary in-place writes through an
 * already-open external handle. Recovery files are retained if restoration fails.
 */
export async function atomicConfigWrite(path: string, original: string | undefined, next: string, overrides: AtomicConfigFileOps = {}): Promise<void> {
  const read = overrides.readText ?? ((name: string) => readFile(name, "utf8"));
  const move = overrides.move ?? rename;
  const publish = overrides.link ?? link;
  const remove = overrides.remove ?? unlink;
  const security = overrides.security ?? configFileSecurity;
  const stage = join(dirname(path), `.${basename(path)}.companion-${randomUUID()}.stage`);
  const recovery = stage + ".recovery";
  const lockPath = join(dirname(path), `.${basename(path)}.companion-write.lock`);
  let lock: Awaited<ReturnType<typeof open>>;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (error) { throw new ConfigWriteFault(exists(error) ? "MCP_CONFIG_CONFLICT" : "MCP_CONFIG_WRITE_FAILED"); }
  let captured = false, captureAttempted = false, committed = false;
  let primary: ConfigWriteFault | undefined;
  const snapshot = async (name: string): Promise<string | undefined> => {
    try { return await read(name); } catch (error) { if (missing(error)) return undefined; throw error; }
  };
  const cleanup = async (name: string): Promise<boolean> => {
    try { await remove(name); return true; } catch (error) { return missing(error); }
  };
  try {
    const metadata = original === undefined ? undefined : await security.snapshot(path);
    const emptyStage = await open(stage, "wx", metadata?.mode ?? 0o600);
    await emptyStage.close();
    if (metadata) await security.prepareEmptyStage(stage, metadata);
    await (overrides.writeStage ?? writeStage)(stage, next);
    if (await read(stage) !== next) throw new ConfigWriteFault("MCP_CONFIG_WRITE_FAILED");
    if (await snapshot(path) !== original) throw new ConfigWriteFault("MCP_CONFIG_CONFLICT");
    if (metadata && !await security.matches(path, metadata)) throw new ConfigWriteFault("MCP_CONFIG_CONFLICT");
    if (original !== undefined) {
      captureAttempted = true;
      await move(path, recovery);
      captured = true;
      // A competing rename between the precheck and capture must not be lost.
      if (await read(recovery) !== original || metadata && !await security.matches(recovery, metadata)) throw new ConfigWriteFault("MCP_CONFIG_CONFLICT");
    }
    await publish(stage, path); // link() fails atomically if another writer created path.
    committed = true;
  } catch (error) {
    primary = error instanceof ConfigWriteFault ? error : new ConfigWriteFault(error instanceof ConfigFileSecurityFault ? error.code : exists(error) ? "MCP_CONFIG_CONFLICT" : "MCP_CONFIG_WRITE_FAILED");
    if (captureAttempted && !captured) {
      try { captured = await snapshot(recovery) !== undefined; }
      catch { primary = new ConfigWriteFault("MCP_CONFIG_RECOVERY_REQUIRED", recovery); }
    }
    if (captured) {
      try {
        // No blind rename/write fallback: preserve a concurrent target and recovery.
        await publish(recovery, path);
      } catch {
        primary = new ConfigWriteFault("MCP_CONFIG_RECOVERY_REQUIRED", recovery);
      }
    }
  } finally {
    // Remove only our private artifacts, never the live configuration pathname.
    const stageClean = await cleanup(stage);
    let recoveryClean = true;
    if (captured && primary?.code !== "MCP_CONFIG_RECOVERY_REQUIRED") recoveryClean = await cleanup(recovery);
    try { await lock.close(); } catch { /* Cleanup below still runs. */ }
    const lockClean = await cleanup(lockPath);
    // Cleanup problems must not replace a write/recovery failure.
    if (!stageClean || !recoveryClean || !lockClean) {
      primary = new ConfigWriteFault(primary?.code ?? "MCP_CONFIG_CLEANUP_REQUIRED", primary?.recoveryPath ?? (!recoveryClean ? recovery : undefined),
        !stageClean ? stage : !lockClean ? lockPath : undefined);
    }
  }
  if (primary) throw primary;
  if (!committed) throw new ConfigWriteFault("MCP_CONFIG_WRITE_FAILED");
}
