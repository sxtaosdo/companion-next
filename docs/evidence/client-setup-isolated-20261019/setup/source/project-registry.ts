import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { ProjectRecord } from "./types.js";

interface RegistryFile {
  version: 1;
  projects: ProjectRecord[];
}

/** 持久化管理 Companion 已注册工程列表。 */
export class ProjectRegistry {
  /** @param filePath 工程注册表 JSON 文件路径 */
  constructor(private readonly filePath: string) {}

  /** 列出全部已注册工程。 */
  async list(): Promise<ProjectRecord[]> {
    return (await this.read()).projects;
  }

  /** 按工程 ID 查找记录。 */
  async get(id: string): Promise<ProjectRecord | undefined> {
    return (await this.list()).find((project) => project.id === id);
  }

  /** 将工程路径解析为规范路径后注册；已存在则直接返回。 */
  async add(
    projectPath: string,
    options: Pick<ProjectRecord, "requiredCreatorVersion" | "creatorExecutable"> = {},
  ): Promise<ProjectRecord> {
    const canonicalPath = await realpath(projectPath);
    const id = projectId(canonicalPath);
    const data = await this.read();
    const existing = data.projects.find((project) => project.id === id);
    if (existing) return existing;

    const record: ProjectRecord = {
      id,
      name: basename(canonicalPath),
      path: canonicalPath,
      connectionPath: join(canonicalPath, "temp", "creator-ai-bridge", "connection.json"),
      ...options,
    };
    data.projects.push(record);
    await this.write(data);
    return record;
  }

  /** 按 ID 移除工程记录；不存在时返回 false。 */
  async remove(id: string): Promise<boolean> {
    const data = await this.read();
    const projects = data.projects.filter((project) => project.id !== id);
    if (projects.length === data.projects.length) return false;
    await this.write({ version: 1, projects });
    return true;
  }

  private async read(): Promise<RegistryFile> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<RegistryFile>;
      if (parsed.version !== 1 || !Array.isArray(parsed.projects)) throw new Error("Invalid project registry");
      return { version: 1, projects: parsed.projects };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, projects: [] };
      throw error;
    }
  }

  private async write(data: RegistryFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, this.filePath);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

/** 由规范工程路径生成稳定的短工程 ID。 */
export function projectId(canonicalPath: string): string {
  return createHash("sha256").update(canonicalPath).digest("hex").slice(0, 16);
}
