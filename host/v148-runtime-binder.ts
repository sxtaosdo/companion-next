/**
 * Compile this file beside the verified v148 mcp/src/companion/http-server.ts.
 * It constructs the ORIGINAL server, but never listens or launches a daemon.
 * The original router is retained; this is NOT a closed read-only HTTP server.
 */
import { isAbsolute, join, resolve } from "node:path";
import { BridgeFault } from "../errors.js";
import {
  CompanionHttpServer,
  type CompanionHttpActions,
  type CompanionHttpServerOptions,
} from "./http-server.js";
import { DebugLogStore } from "./log-store.js";
import { ToolPresetRepository } from "./tool-preset-store.js";
import { KnowledgeFault, type KnowledgeBackend } from "./knowledge-adapter.js";
import type { AiLauncherClient } from "./ai-launcher-client.js";
import type { KnowledgeServiceClient } from "./knowledge-service-client.js";

export const V148_BINDER_SOURCE_HEAD = "f6dcac804fb9ad806e8094594c7820a71cfab7b8";

export type V148ProjectTestReaders = Pick<
  CompanionHttpActions,
  "listProjects" | "listDashboardProjects" | "listStatuses"
>;

export type V148KnowledgeReads = Pick<
  KnowledgeBackend,
  | "status"
  | "search"
  | "listKnowledgeBases"
  | "viewKnowledgeBase"
  | "listDocuments"
  | "viewDocument"
  | "downloadDocument"
  | "listChunks"
  | "listAgents"
>;

export interface V148TestReaders {
  /** Independent test data providers. No registry or platform discovery fallback. */
  projects?: V148ProjectTestReaders;
  aiLauncher?: Pick<AiLauncherClient, "status">;
  knowledgeService?: Pick<KnowledgeServiceClient, "status">;
}

export interface V148IsolatedHostInput {
  /** Absolute directory containing the explicitly selected UI build. */
  webRoot: string;
  /** Absolute path inside the caller's approved isolated test directory. */
  isolatedStateDirectory: string;
  /** An explicit object is required; absent groups fail closed when requested. */
  testReaders: V148TestReaders;
  /** Already approved object only; this module neither creates it nor loads keys. */
  existingApprovedKnowledgeBackend?: V148KnowledgeReads;
}

export interface V148HostCapabilities {
  readonly projects: boolean;
  readonly modelStatus: boolean;
  readonly knowledgeServiceStatus: boolean;
  readonly knowledge: boolean;
  readonly logs: "isolated-instance-memory";
  readonly calls: "original-server-instance-memory";
  readonly oldDaemonLogs: false;
  readonly oldDaemonCalls: false;
  readonly closedReadOnlyRouter: false;
}

export interface V148IsolatedHost {
  readonly server: CompanionHttpServer;
  readonly logs: V148IsolatedLogStore;
  readonly capabilities: V148HostCapabilities;
}

function denied(): never {
  throw new BridgeFault("CAPABILITY_DENIED", "This operation is disabled in the isolated v148 host.");
}

async function deniedAsync(): Promise<never> { return denied(); }

async function unavailable(): Promise<never> {
  throw new BridgeFault("UNSUPPORTED", "An explicit isolated test reader was not supplied.");
}

async function knowledgeDenied(): Promise<never> {
  throw new KnowledgeFault("POLICY_DENIED", 403, "not_approved");
}

/**
 * Genuine memory-only DebugLogStore: append/query and EventEmitter subscriptions
 * are inherited unchanged. In particular, SSE on/off MUST NOT throw after headers.
 * The constructor has no directory argument, so inherited append cannot persist.
 */
export class V148IsolatedLogStore extends DebugLogStore {
  constructor() { super(1000); }

  override clear(..._args: Parameters<DebugLogStore["clear"]>): ReturnType<DebugLogStore["clear"]> {
    return denied();
  }
}

/**
 * Actual subclass preserves the original class's private-member nominal identity.
 * All ten public operations are overridden, including reads and selection removal.
 * The base constructor only builds its specs Map; it does not access the path.
 */
class DeniedToolPresetRepository extends ToolPresetRepository {
  constructor(isolatedStateDirectory: string) {
    super(join(isolatedStateDirectory, "denied-tool-presets.json"), []);
  }

  override async list(..._args: Parameters<ToolPresetRepository["list"]>): ReturnType<ToolPresetRepository["list"]> { return denied(); }
  override async get(..._args: Parameters<ToolPresetRepository["get"]>): ReturnType<ToolPresetRepository["get"]> { return denied(); }
  override async selectedForProject(..._args: Parameters<ToolPresetRepository["selectedForProject"]>): ReturnType<ToolPresetRepository["selectedForProject"]> { return denied(); }
  override async create(..._args: Parameters<ToolPresetRepository["create"]>): ReturnType<ToolPresetRepository["create"]> { return denied(); }
  override async update(..._args: Parameters<ToolPresetRepository["update"]>): ReturnType<ToolPresetRepository["update"]> { return denied(); }
  override async delete(..._args: Parameters<ToolPresetRepository["delete"]>): ReturnType<ToolPresetRepository["delete"]> { return denied(); }
  override async selectForProject(..._args: Parameters<ToolPresetRepository["selectForProject"]>): ReturnType<ToolPresetRepository["selectForProject"]> { return denied(); }
  override async removeProjectSelection(..._args: Parameters<ToolPresetRepository["removeProjectSelection"]>): ReturnType<ToolPresetRepository["removeProjectSelection"]> { return denied(); }
  override async export(..._args: Parameters<ToolPresetRepository["export"]>): ReturnType<ToolPresetRepository["export"]> { return denied(); }
  override async import(..._args: Parameters<ToolPresetRepository["import"]>): ReturnType<ToolPresetRepository["import"]> { return denied(); }
}

function explicitAbsolutePath(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || /[\u0000\r\n]/u.test(value) || !isAbsolute(value)) {
    throw new TypeError(`${label} must be an explicit absolute local path.`);
  }
  return resolve(value);
}

function checkMethods<T extends object>(source: T, keys: readonly (keyof T)[], label: string): void {
  if (!source || typeof source !== "object") throw new TypeError(`${label} must be an explicit reader object.`);
  for (const key of keys) {
    if (typeof source[key] !== "function") throw new TypeError(`Missing reader: ${label}.${String(key)}`);
  }
}

function bindKnowledge(backend: V148KnowledgeReads): KnowledgeBackend {
  checkMethods(backend, ["status", "search", "listKnowledgeBases", "viewKnowledgeBase", "listDocuments",
    "viewDocument", "downloadDocument", "listChunks", "listAgents"], "existingApprovedKnowledgeBackend");
  // Capture the nine approved methods with their real receiver; do not spread the
  // supplied backend, which may also contain writer or conversation capabilities.
  return Object.freeze({
    status: backend.status.bind(backend),
    search: backend.search.bind(backend),
    listKnowledgeBases: backend.listKnowledgeBases.bind(backend),
    viewKnowledgeBase: backend.viewKnowledgeBase.bind(backend),
    listDocuments: backend.listDocuments.bind(backend),
    viewDocument: backend.viewDocument.bind(backend),
    downloadDocument: backend.downloadDocument.bind(backend),
    listChunks: backend.listChunks.bind(backend),
    listAgents: backend.listAgents.bind(backend),
    sync: knowledgeDenied,
    chat: knowledgeDenied,
    askAgent: knowledgeDenied,
  } satisfies KnowledgeBackend);
}

/**
 * No apiToken/startupCode/port/daemon/config/backend-construction input exists.
 * The original constructor generates ephemeral authentication material and reads
 * its own module for its instance identity. It does not listen until the caller
 * explicitly invokes server.listen(); only do that within separately approved tests.
 */
export function createV148IsolatedHost(input: V148IsolatedHostInput): V148IsolatedHost {
  if (!input || typeof input !== "object") throw new TypeError("Explicit isolated host input is required.");
  const allowedInputKeys = new Set(["webRoot", "isolatedStateDirectory", "testReaders", "existingApprovedKnowledgeBackend"]);
  for (const key of Object.keys(input)) {
    if (!allowedInputKeys.has(key)) throw new TypeError(`Unsupported isolated host input: ${key}`);
  }
  const webRoot = explicitAbsolutePath(input.webRoot, "webRoot");
  const isolatedStateDirectory = explicitAbsolutePath(input.isolatedStateDirectory, "isolatedStateDirectory");
  const readers = input.testReaders;
  if (!readers || typeof readers !== "object") throw new TypeError("Explicit testReaders are required.");
  const projects = readers.projects;
  const aiLauncher = readers.aiLauncher;
  const knowledgeService = readers.knowledgeService;
  if (projects) checkMethods(projects, ["listProjects", "listDashboardProjects", "listStatuses"], "testReaders.projects");
  if (aiLauncher) checkMethods(aiLauncher, ["status"], "testReaders.aiLauncher");
  if (knowledgeService) checkMethods(knowledgeService, ["status"], "testReaders.knowledgeService");

  const actions = Object.freeze({
    listProjects: projects ? projects.listProjects.bind(projects) : unavailable,
    listDashboardProjects: projects ? projects.listDashboardProjects.bind(projects) : unavailable,
    listStatuses: projects ? projects.listStatuses.bind(projects) : unavailable,
    pickDirectory: deniedAsync,
    scaffoldProject: deniedAsync,
    addProject: deniedAsync,
    removeProject: deniedAsync,
    projectStatus: deniedAsync,
    start: deniedAsync,
    focus: deniedAsync,
    stop: deniedAsync,
    restart: deniedAsync,
    openFolder: deniedAsync,
    setupProject: deniedAsync,
    setupStatus: deniedAsync,
    registerMcp: deniedAsync,
    doctor: deniedAsync,
    bridgeCall: deniedAsync,
    managementCall: deniedAsync,
    stopDaemon: deniedAsync,
  } satisfies CompanionHttpActions);
  const logs = new V148IsolatedLogStore();
  const knowledge = input.existingApprovedKnowledgeBackend
    ? bindKnowledge(input.existingApprovedKnowledgeBackend) : undefined;
  const options = Object.freeze({
    actions,
    logs,
    toolPresets: new DeniedToolPresetRepository(isolatedStateDirectory),
    port: 0,
    webRoot,
    ...(knowledge ? { knowledge } : {}),
    // Always supply these facades, even if their status reader is absent. This
    // prevents the original constructor's installed-service client defaults.
    aiLauncher: Object.freeze({ status: aiLauncher ? aiLauncher.status.bind(aiLauncher) : unavailable, start: deniedAsync, stop: deniedAsync }),
    knowledgeService: Object.freeze({ status: knowledgeService ? knowledgeService.status.bind(knowledgeService) : unavailable, start: deniedAsync, stop: deniedAsync }),
    observeInFlight: async () => ({ counts: {}, unknown: ["EXISTING_DAEMON_AND_NATIVE_WORK_NOT_OBSERVED"] }),
  } satisfies CompanionHttpServerOptions);
  const capabilities = Object.freeze({
    projects: Boolean(projects),
    modelStatus: Boolean(aiLauncher),
    knowledgeServiceStatus: Boolean(knowledgeService),
    knowledge: Boolean(knowledge),
    logs: "isolated-instance-memory",
    calls: "original-server-instance-memory",
    oldDaemonLogs: false,
    oldDaemonCalls: false,
    closedReadOnlyRouter: false,
  } satisfies V148HostCapabilities);
  return Object.freeze({ server: new CompanionHttpServer(options), logs, capabilities });
}
