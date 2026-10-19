// C:/Users/33272/AppData/Local/Temp/next-setup-options-isolated-20261019/source/setup-service.ts
import { randomUUID } from "node:crypto";

// C:/Users/33272/AppData/Local/Temp/next-setup-options-isolated-20261019/source/dashboard-errors.ts
var DashboardFault = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "DashboardFault";
  }
  retryable = false;
};

// C:/Users/33272/AppData/Local/Temp/next-setup-options-isolated-20261019/source/setup-service.ts
var SETUP_OPTIONS_CAPABILITIES = Object.freeze({
  optionsContractVersion: 1,
  strictOptions: true,
  reusePolicy: "same-effective-options"
});
var SetupOptionsFault = class extends Error {
  constructor(code, httpStatus, activeOperationId, effectiveOptions) {
    super(code === "SETUP_OPTIONS_CONFLICT" ? "Active setup uses different effective options" : "Invalid setup path or options");
    this.code = code;
    this.httpStatus = httpStatus;
    this.activeOperationId = activeOperationId;
    this.name = "SetupOptionsFault";
    if (effectiveOptions) this.effectiveOptions = Object.freeze({ ...effectiveOptions });
  }
  effectiveOptions;
};
function validPath(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 32768 && !/[\u0000-\u001f\u007f]/u.test(value);
}
function normalizeOptions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some((key) => !["startCreator", "configureCodex", "codexPath"].includes(key)) || input.startCreator !== void 0 && typeof input.startCreator !== "boolean" || input.configureCodex !== void 0 && typeof input.configureCodex !== "boolean") {
    throw new SetupOptionsFault("SETUP_OPTIONS_INVALID", 400);
  }
  const startCreator = input.startCreator ?? true;
  const configureCodex = input.configureCodex ?? true;
  if (configureCodex && input.codexPath !== void 0 && !validPath(input.codexPath)) throw new SetupOptionsFault("SETUP_OPTIONS_INVALID", 400);
  return Object.freeze({
    startCreator,
    configureCodex,
    ...configureCodex && input.codexPath !== void 0 ? { codexPath: input.codexPath.trim() } : {}
  });
}
var SetupService = class {
  /** @param dependencies 注册、安装 Bridge、启停 Creator 与配置 Codex 等外部能力 */
  constructor(dependencies) {
    this.dependencies = dependencies;
  }
  operations = /* @__PURE__ */ new Map();
  activeByPath = /* @__PURE__ */ new Map();
  /** 启动（或复用）指定工程路径的异步配置操作并立即返回进度对象。 */
  start(projectPath, options = {}) {
    if (!validPath(projectPath)) throw new SetupOptionsFault("SETUP_OPTIONS_INVALID", 400);
    const path = projectPath.trim();
    const effectiveOptions = normalizeOptions(options);
    const activeId = this.activeByPath.get(path);
    if (activeId) {
      const active = this.require(activeId);
      if (JSON.stringify(active.effectiveOptions) !== JSON.stringify(effectiveOptions)) {
        throw new SetupOptionsFault("SETUP_OPTIONS_CONFLICT", 409, activeId, active.effectiveOptions);
      }
      return { ...active, reused: true };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const operation = {
      id: randomUUID(),
      projectPath: path,
      stage: "registering",
      startedAt: now,
      updatedAt: now,
      optionsContractVersion: 1,
      effectiveOptions
    };
    this.operations.set(operation.id, operation);
    this.activeByPath.set(path, operation.id);
    void this.run(operation.id);
    return { ...this.require(operation.id), reused: false };
  }
  /** Return an isolated snapshot of the current task and its original options. */
  get(id) {
    const operation = this.operations.get(id);
    return operation ? structuredClone(operation) : void 0;
  }
  /** Internal recovery barrier; an unfinished setup can still mutate editor/configuration state. */
  hasActiveOperations() {
    return this.activeByPath.size > 0;
  }
  require(id) {
    const operation = this.operations.get(id);
    if (!operation) throw new Error(`Unknown setup operation: ${id}`);
    return structuredClone(operation);
  }
  update(id, patch) {
    const current = this.operations.get(id);
    if (!current) return;
    this.operations.set(id, { ...current, ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  /** 按阶段顺序执行配置流水线并更新操作状态。 */
  async run(id) {
    const initial = this.operations.get(id);
    const options = initial.effectiveOptions;
    try {
      const project = await this.dependencies.addProject(initial.projectPath);
      this.update(id, { projectId: project.id, projectName: project.name, stage: "installing-bridge" });
      const bridge = await this.dependencies.installBridge(project);
      this.update(id, { bridge, stage: !options.startCreator ? "configuring-codex" : "opening-dashboard" });
      if (options.startCreator) {
        const runtime = await this.dependencies.startCreator(project.id);
        if (runtime.state !== "ready") throw new Error(runtime.lastError ?? `Creator did not become ready: ${runtime.state}`);
        this.update(id, { runtime, stage: "configuring-codex" });
      }
      if (options.configureCodex) {
        const codex = await this.dependencies.configureCodex(project, options.codexPath);
        this.update(id, { mcpName: codex.name, stage: "verifying" });
      }
      if (options.startCreator) await this.dependencies.verify(project.id);
      this.update(id, { stage: "complete" });
    } catch (error) {
      this.update(id, {
        stage: "failed",
        error: error instanceof Error ? error.message : String(error),
        ...error instanceof DashboardFault ? { errorCode: error.code } : {}
      });
    } finally {
      this.activeByPath.delete(initial.projectPath);
    }
  }
};

// C:/Users/33272/AppData/Local/Temp/next-setup-options-isolated-20261019/source/project-registry.ts
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
var ProjectRegistry = class {
  /** @param filePath 工程注册表 JSON 文件路径 */
  constructor(filePath) {
    this.filePath = filePath;
  }
  /** 列出全部已注册工程。 */
  async list() {
    return (await this.read()).projects;
  }
  /** 按工程 ID 查找记录。 */
  async get(id) {
    return (await this.list()).find((project) => project.id === id);
  }
  /** 将工程路径解析为规范路径后注册；已存在则直接返回。 */
  async add(projectPath, options = {}) {
    const canonicalPath = await realpath(projectPath);
    const id = projectId(canonicalPath);
    const data = await this.read();
    const existing = data.projects.find((project) => project.id === id);
    if (existing) return existing;
    const record = {
      id,
      name: basename(canonicalPath),
      path: canonicalPath,
      connectionPath: join(canonicalPath, "temp", "creator-ai-bridge", "connection.json"),
      ...options
    };
    data.projects.push(record);
    await this.write(data);
    return record;
  }
  /** 按 ID 移除工程记录；不存在时返回 false。 */
  async remove(id) {
    const data = await this.read();
    const projects = data.projects.filter((project) => project.id !== id);
    if (projects.length === data.projects.length) return false;
    await this.write({ version: 1, projects });
    return true;
  }
  async read() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      if (parsed.version !== 1 || !Array.isArray(parsed.projects)) throw new Error("Invalid project registry");
      return { version: 1, projects: parsed.projects };
    } catch (error) {
      if (error.code === "ENOENT") return { version: 1, projects: [] };
      throw error;
    }
  }
  async write(data) {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 448 });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(data, null, 2)}
`, { mode: 384 });
      await rename(temporary, this.filePath);
    } finally {
      await rm(temporary, { force: true });
    }
  }
};
function projectId(canonicalPath) {
  return createHash("sha256").update(canonicalPath).digest("hex").slice(0, 16);
}

// C:/Users/33272/AppData/Local/Temp/next-setup-options-isolated-20261019/source/bridge-installer.ts
import { createHash as createHash2 } from "node:crypto";
import { cp, mkdir as mkdir2, readFile as readFile2, readdir, rename as rename2, rm as rm2, stat, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname2, join as join2, relative } from "node:path";
var BridgeInstaller = class {
  /** @param bundlePath 内置 Bridge 扩展包路径 @param registryPath 受管安装登记文件路径 */
  constructor(bundlePath, registryPath) {
    this.bundlePath = bundlePath;
    this.registryPath = registryPath;
  }
  /**
   * 安装或更新工程内的 creator-ai-bridge 扩展。
   * 已由 Companion 管理且未遭手工改动的安装可安全覆盖；未登记但可识别为本扩展的目录会接管并更新。
   */
  async install(project) {
    const packageJson = JSON.parse(await readFile2(join2(this.bundlePath, "package.json"), "utf8"));
    if (typeof packageJson.version !== "string" || !packageJson.version) throw new Error("Bridge bundle has no version");
    const sourceFiles = await hashTree(this.bundlePath);
    const targetPath = join2(project.path, "extensions", "creator-ai-bridge");
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
            installedAt: (/* @__PURE__ */ new Date()).toISOString(),
            files: sourceFiles
          });
          await this.writeRegistry(registry);
          return { status: "current", version: packageJson.version, targetPath };
        }
      } else {
        if (!containsFiles(currentFiles, managed.files)) {
          throw new Error("Bridge \u6269\u5C55\u542B\u6709\u624B\u5DE5\u4FEE\u6539\uFF0CCompanion \u4E0D\u4F1A\u8986\u76D6\uFF1B\u8BF7\u6062\u590D\u540E\u91CD\u8BD5\uFF0C\u6216\u5220\u9664 extensions/creator-ai-bridge \u540E\u91CD\u65B0\u63A5\u5165");
        }
        if (managed.version === packageJson.version && containsFiles(currentFiles, sourceFiles)) {
          return { status: "current", version: packageJson.version, targetPath };
        }
      }
    }
    await mkdir2(dirname2(targetPath), { recursive: true });
    const staging = `${targetPath}.companion-${process.pid}`;
    const backup = `${targetPath}.backup-${process.pid}`;
    await rm2(staging, { recursive: true, force: true });
    await cp(this.bundlePath, staging, { recursive: true, errorOnExist: true });
    let backedUp = false;
    try {
      if (targetExists) {
        await rename2(targetPath, backup);
        backedUp = true;
        await cp(backup, targetPath, { recursive: true });
        await cp(staging, targetPath, { recursive: true, force: true });
        await rm2(staging, { recursive: true, force: true });
      } else {
        await rename2(staging, targetPath);
      }
      if (backedUp) await rm2(backup, { recursive: true, force: true });
    } catch (error) {
      await rm2(staging, { recursive: true, force: true });
      if (backedUp) {
        await rm2(targetPath, { recursive: true, force: true });
        await rename2(backup, targetPath);
      }
      throw error;
    }
    const install = {
      projectId: project.id,
      version: packageJson.version,
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      files: sourceFiles
    };
    registry.installs = [...registry.installs.filter((item) => item.projectId !== project.id), install];
    await this.writeRegistry(registry);
    return { status: targetExists ? "updated" : "installed", version: packageJson.version, targetPath };
  }
  async readRegistry() {
    try {
      const parsed = JSON.parse(await readFile2(this.registryPath, "utf8"));
      if (parsed.version !== 1 || !Array.isArray(parsed.installs)) throw new Error("Invalid managed Bridge registry");
      return { version: 1, installs: parsed.installs };
    } catch (error) {
      if (error.code === "ENOENT") return { version: 1, installs: [] };
      throw error;
    }
  }
  async writeRegistry(value) {
    await mkdir2(dirname2(this.registryPath), { recursive: true, mode: 448 });
    const temporary = `${this.registryPath}.${process.pid}.tmp`;
    await writeFile2(temporary, `${JSON.stringify(value, null, 2)}
`, { mode: 384 });
    await rename2(temporary, this.registryPath);
  }
};
async function hashTree(root) {
  const files = {};
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join2(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files[relative(root, path)] = createHash2("sha256").update(await readFile2(path)).digest("hex");
    }
  }
  await visit(root);
  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}
function containsFiles(actual, expected) {
  return Object.entries(expected).every(([path, hash]) => actual[path] === hash);
}
export {
  BridgeInstaller,
  ProjectRegistry,
  SetupOptionsFault,
  SetupService
};
