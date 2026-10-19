import { randomUUID } from "node:crypto";
import type { BridgeInstallResult } from "./bridge-installer.js";
import { DashboardFault } from "./dashboard-errors.js";
import type { ProjectRecord, ProjectRuntimeStatus } from "./types.js";

/** 一键配置流水线所处阶段。 */
export type SetupStage = "registering" | "installing-bridge" | "opening-dashboard" | "waiting-bridge" | "configuring-codex" | "verifying" | "complete" | "failed";

/** 单次一键配置操作的进度快照。 */
export interface SetupOperation {
  optionsContractVersion: 1;
  effectiveOptions: EffectiveSetupOptions;
  id: string;
  projectPath: string;
  projectId?: string;
  projectName?: string;
  stage: SetupStage;
  startedAt: string;
  updatedAt: string;
  bridge?: BridgeInstallResult;
  runtime?: ProjectRuntimeStatus;
  mcpName?: string;
  error?: string;
  errorCode?: string;
}

/** 一键配置可选步骤开关。 */
export interface SetupOptions {
  startCreator?: boolean;
  configureCodex?: boolean;
  codexPath?: string;
}

/** Frozen, normalized choices used by one setup task. */
export type EffectiveSetupOptions = Readonly<{
  startCreator: boolean;
  configureCodex: boolean;
  codexPath?: string;
}>;

export const SETUP_OPTIONS_CAPABILITIES = Object.freeze({
  optionsContractVersion: 1 as const,
  strictOptions: true as const,
  reusePolicy: "same-effective-options" as const,
});

export class SetupOptionsFault extends Error {
  readonly effectiveOptions?: EffectiveSetupOptions;
  constructor(
    readonly code: "SETUP_OPTIONS_INVALID" | "SETUP_OPTIONS_CONFLICT",
    readonly httpStatus: 400 | 409,
    readonly activeOperationId?: string,
    effectiveOptions?: EffectiveSetupOptions,
  ) {
    super(code === "SETUP_OPTIONS_CONFLICT" ? "Active setup uses different effective options" : "Invalid setup path or options");
    this.name = "SetupOptionsFault";
    if (effectiveOptions) this.effectiveOptions = Object.freeze({ ...effectiveOptions });
  }
}

function validPath(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 32768 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function normalizeOptions(input: SetupOptions): EffectiveSetupOptions {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))
    || Object.keys(input).some(key => !["startCreator", "configureCodex", "codexPath"].includes(key))
    || (input.startCreator !== undefined && typeof input.startCreator !== "boolean")
    || (input.configureCodex !== undefined && typeof input.configureCodex !== "boolean")) {
    throw new SetupOptionsFault("SETUP_OPTIONS_INVALID", 400);
  }
  const startCreator = input.startCreator ?? true;
  const configureCodex = input.configureCodex ?? true;
  if (configureCodex && input.codexPath !== undefined && !validPath(input.codexPath)) throw new SetupOptionsFault("SETUP_OPTIONS_INVALID", 400);
  return Object.freeze({ startCreator, configureCodex,
    ...(configureCodex && input.codexPath !== undefined ? { codexPath: input.codexPath.trim() } : {}),
  });
}

/** SetupService dependencies; implementations perform all external actions. */
export interface SetupDependencies {
  addProject(path: string): Promise<ProjectRecord>;
  installBridge(project: ProjectRecord): Promise<BridgeInstallResult>;
  startCreator(projectId: string): Promise<ProjectRuntimeStatus>;
  configureCodex(project: ProjectRecord, codexPath?: string): Promise<{ name: string }>;
  verify(projectId: string): Promise<void>;
}

/** 编排工程注册、Bridge 安装、Creator 启动与 Codex MCP 配置的一键流程。 */
export class SetupService {
  private readonly operations = new Map<string, SetupOperation>();
  private readonly activeByPath = new Map<string, string>();

  /** @param dependencies 注册、安装 Bridge、启停 Creator 与配置 Codex 等外部能力 */
  constructor(private readonly dependencies: SetupDependencies) {}

  /** 启动（或复用）指定工程路径的异步配置操作并立即返回进度对象。 */
  start(projectPath: string, options: SetupOptions = {}): SetupOperation & { reused: boolean } {
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
    const now = new Date().toISOString();
    const operation: SetupOperation = { id: randomUUID(), projectPath: path, stage: "registering", startedAt: now, updatedAt: now,
      optionsContractVersion: 1, effectiveOptions };
    // Reserve synchronously before invoking even the first asynchronous dependency.
    this.operations.set(operation.id, operation);
    this.activeByPath.set(path, operation.id);
    void this.run(operation.id);
    return { ...this.require(operation.id), reused: false };
  }

  /** Return an isolated snapshot of the current task and its original options. */
  get(id: string): SetupOperation | undefined {
    const operation = this.operations.get(id);
    return operation ? structuredClone(operation) : undefined;
  }

  /** Internal recovery barrier; an unfinished setup can still mutate editor/configuration state. */
  hasActiveOperations(): boolean { return this.activeByPath.size > 0; }

  private require(id: string): SetupOperation {
    const operation = this.operations.get(id);
    if (!operation) throw new Error(`Unknown setup operation: ${id}`);
    return structuredClone(operation);
  }

  private update(id: string, patch: Partial<SetupOperation>): void {
    const current = this.operations.get(id);
    if (!current) return;
    this.operations.set(id, { ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  /** 按阶段顺序执行配置流水线并更新操作状态。 */
  private async run(id: string): Promise<void> {
    const initial = this.operations.get(id)!;
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
        ...(error instanceof DashboardFault ? { errorCode: error.code } : {}),
      });
    } finally {
      this.activeByPath.delete(initial.projectPath);
    }
  }
}
