import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { ProjectRecord } from "./types.js";

interface ManagedInstall {
  projectId: string;
  version: string;
  installedAt: string;
  files: Record<string, string>;
}

interface InstallRegistry {
  version: 1;
  installs: ManagedInstall[];
}

/** Bridge 扩展安装/更新后的结果摘要。 */
export interface BridgeInstallResult {
  status: "installed" | "updated" | "current";
  version: string;
  targetPath: string;
}

/** 将内置 Bridge 扩展安全安装或更新到工程 `extensions` 目录。 */
export class BridgeInstaller {
  /** @param bundlePath 内置 Bridge 扩展包路径 @param registryPath 受管安装登记文件路径 */
  constructor(private readonly bundlePath: string, private readonly registryPath: string) {}

  /**
   * 安装或更新工程内的 creator-ai-bridge 扩展。
   * 已由 Companion 管理且未遭手工改动的安装可安全覆盖；未登记但可识别为本扩展的目录会接管并更新。
   */
  async install(project: ProjectRecord): Promise<BridgeInstallResult> {
    const packageJson = JSON.parse(await readFile(join(this.bundlePath, "package.json"), "utf8")) as { version?: unknown };
    if (typeof packageJson.version !== "string" || !packageJson.version) throw new Error("Bridge bundle has no version");
    const sourceFiles = await hashTree(this.bundlePath);
    const targetPath = join(project.path, "extensions", "creator-ai-bridge");
    const registry = await this.readRegistry();
    const managed = registry.installs.find((item) => item.projectId === project.id);
    const targetExists = await stat(targetPath).then((value) => value.isDirectory()).catch(() => false);

    if (targetExists) {
      const currentFiles = await hashTree(targetPath);
      if (!managed) {
        if (containsFiles(currentFiles, sourceFiles)) {
          registry.installs.push({
            projectId: project.id,
            version: packageJson.version,
            installedAt: new Date().toISOString(),
            files: sourceFiles,
          });
          await this.writeRegistry(registry);
          return { status: "current", version: packageJson.version, targetPath };
        }
        // extensions/creator-ai-bridge 为保留路径：未登记时一律接管并更新（含旧版 sync / 手工拷贝）。
      } else {
        if (!containsFiles(currentFiles, managed.files)) {
          throw new Error("Bridge 扩展含有手工修改，Companion 不会覆盖；请恢复后重试，或删除 extensions/creator-ai-bridge 后重新接入");
        }
        if (managed.version === packageJson.version && containsFiles(currentFiles, sourceFiles)) {
          return { status: "current", version: packageJson.version, targetPath };
        }
      }
    }

    await mkdir(dirname(targetPath), { recursive: true });
    const staging = `${targetPath}.companion-${process.pid}`;
    const backup = `${targetPath}.backup-${process.pid}`;
    await rm(staging, { recursive: true, force: true });
    await cp(this.bundlePath, staging, { recursive: true, errorOnExist: true });
    let backedUp = false;
    try {
      if (targetExists) {
        await rename(targetPath, backup);
        backedUp = true;
        await cp(backup, targetPath, { recursive: true });
        await cp(staging, targetPath, { recursive: true, force: true });
        await rm(staging, { recursive: true, force: true });
      } else {
        await rename(staging, targetPath);
      }
      if (backedUp) await rm(backup, { recursive: true, force: true });
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      if (backedUp) {
        await rm(targetPath, { recursive: true, force: true });
        await rename(backup, targetPath);
      }
      throw error;
    }

    const install: ManagedInstall = {
      projectId: project.id,
      version: packageJson.version,
      installedAt: new Date().toISOString(),
      files: sourceFiles,
    };
    registry.installs = [...registry.installs.filter((item) => item.projectId !== project.id), install];
    await this.writeRegistry(registry);
    return { status: targetExists ? "updated" : "installed", version: packageJson.version, targetPath };
  }

  private async readRegistry(): Promise<InstallRegistry> {
    try {
      const parsed = JSON.parse(await readFile(this.registryPath, "utf8")) as Partial<InstallRegistry>;
      if (parsed.version !== 1 || !Array.isArray(parsed.installs)) throw new Error("Invalid managed Bridge registry");
      return { version: 1, installs: parsed.installs };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, installs: [] };
      throw error;
    }
  }

  private async writeRegistry(value: InstallRegistry): Promise<void> {
    await mkdir(dirname(this.registryPath), { recursive: true, mode: 0o700 });
    const temporary = `${this.registryPath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.registryPath);
  }
}

async function hashTree(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files[relative(root, path)] = createHash("sha256").update(await readFile(path)).digest("hex");
    }
  }
  await visit(root);
  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}

function containsFiles(actual: Record<string, string>, expected: Record<string, string>): boolean {
  return Object.entries(expected).every(([path, hash]) => actual[path] === hash);
}
