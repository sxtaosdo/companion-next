import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

const CLI_PATH = "D:/services/weknora/cli/weknora-cli.exe";
const CLI_CONFIG = "D:/services/weknora/cli/config";
const HOST = "http://127.0.0.1:8081";
const KB_ID = "da1051a5-3fff-4198-ba55-017ea79df9c3";
const PYTHON_PATH = "C:/Users/33272/miniconda3/python.exe";
const SYNC_BRIDGE = "D:/code/shidai3/P8000/knowledge-sync/companion_api.py";
const GIT_PATH = "C:/Program Files/Git/cmd";
const SCHEMA = "companion-knowledge-v1" as const;
const CLI_COMMIT = "3e8b0bfc80b845b2d4b2ed683994748741450a97";

const MESSAGES: Record<string, string> = {
  CLI_UNAVAILABLE: "知识库 CLI 不可用",
  CLI_INCOMPATIBLE: "知识库 CLI 版本或能力不兼容",
  AUTH_MISSING: "知识库只读身份尚未在本机配置",
  AUTH_DENIED: "知识库身份已失效或不允许访问此库",
  CHAT_UNAVAILABLE: "当前密钥没有对话权限，或所选知识库没有配置对话模型。检索、文档和列表仍可使用",
  UPSTREAM_UNAVAILABLE: "知识库服务暂不可用",
  TIMEOUT: "知识库操作超时",
  CANCELLED: "知识库操作已取消",
  SCHEMA_INVALID: "知识库请求或结果格式不符合约定",
  OUTPUT_LIMIT: "知识库结果超过长度上限",
  SOURCE_NOT_APPROVED: "来源或通道未登记",
  WRITER_DISABLED: "同步写入尚未配置并启用",
  POLICY_DENIED: "同步策略尚未批准或拒绝此操作",
  SYNC_OUTCOME_UNKNOWN: "同步中断，结果尚未确认；请先核对同步账本",
  BUSY: "知识库操作正在进行，请稍后再试",
};

/** Closed reasons the page may explain. Upstream messages never use this field. */
export const KNOWLEDGE_POLICY_REASONS = [
  "no_source",
  "not_approved",
  "writer_disabled",
  "credential_missing",
  "network_disabled",
  "retention_review",
  "delete_limit",
  "scope_changed",
  "prior_batch",
  "checkpoint_mismatch",
] as const;
export type KnowledgePolicyReason = (typeof KNOWLEDGE_POLICY_REASONS)[number];

const POLICY_REASON_BY_CODE: Record<string, KnowledgePolicyReason> = {
  POLICY_NOT_APPROVED: "not_approved",
  NETWORK_DISABLED: "network_disabled",
  RETENTION_REVIEW_REQUIRED: "retention_review",
  DELETE_POLICY_EXCEEDED: "delete_limit",
  POLICY_SCOPE_CHANGED: "scope_changed",
  prior_batch_unresolved: "prior_batch",
  baseline_checkpoint_mismatch: "checkpoint_mismatch",
  WRITER_DISABLED: "writer_disabled",
  WRITER_CREDENTIAL_MISSING: "credential_missing",
  INDEX_ATTESTATION_REQUIRED: "writer_disabled",
};

/** Only static messages cross the HTTP boundary; CLI stderr is never exposed. */
export class KnowledgeFault extends Error {
  readonly code: string;
  readonly reason?: KnowledgePolicyReason;
  constructor(code: string, readonly httpStatus = 502, reason?: KnowledgePolicyReason) {
    const safeCode = Object.hasOwn(MESSAGES, code) ? code : "UPSTREAM_UNAVAILABLE";
    super(MESSAGES[safeCode]);
    this.code = safeCode;
    if (reason && (KNOWLEDGE_POLICY_REASONS as readonly string[]).includes(reason)) this.reason = reason;
  }
}

export interface JsonInvocation {
  executable: string;
  args: readonly string[];
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBytes: number;
  input?: string;
  waitForClose?: boolean;
}
export type JsonRunner = (input: JsonInvocation, signal?: AbortSignal) => Promise<unknown>;
let jsonProcessesAwaitingClose = 0;
/** Promise rejection or a kill request is not child-exit evidence. */
export function jsonProcessInFlightCount(): number { return jsonProcessesAwaitingClose; }

/** Bounded, hidden subprocess. Executable/arguments are supplied only by trusted backend code. */
export const runJsonProcess: JsonRunner = async (input, signal) => {
  if (signal?.aborted) throw new KnowledgeFault("CANCELLED", 499);
  return await new Promise<unknown>((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(input.executable, [...input.args], {
        shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: input.env,
      });
    } catch { reject(new KnowledgeFault("CLI_UNAVAILABLE", 503)); return; }
    jsonProcessesAwaitingClose++;
    let done = false;
    let closed = false;
    let pendingFault: KnowledgeFault | undefined;
    let bytes = 0;
    const output: Buffer[] = [];
    const finish = (fault?: KnowledgeFault, value?: unknown): void => {
      if (done || pendingFault) return;
      if (fault && input.waitForClose && !closed) { pendingFault = fault; child.kill(); return; }
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancelled);
      if (fault) { child.kill(); reject(fault); } else resolve(value);
    };
    const cancelled = (): void => finish(new KnowledgeFault("CANCELLED", 499));
    const timer = setTimeout(() => finish(new KnowledgeFault("TIMEOUT", 504)), input.timeoutMs);
    signal?.addEventListener("abort", cancelled, { once: true });
    const count = (chunk: Buffer): boolean => {
      bytes += chunk.length;
      if (bytes > input.maxBytes) { finish(new KnowledgeFault("OUTPUT_LIMIT", 502)); return false; }
      return !done && !pendingFault;
    };
    child.stdout!.on("data", (chunk: Buffer) => { if (count(chunk)) output.push(chunk); });
    // Count and discard stderr, including any diagnostics that could contain credentials.
    child.stderr!.on("data", (chunk: Buffer) => { count(chunk); });
    child.on("error", () => finish(new KnowledgeFault("CLI_UNAVAILABLE", 503)));
    child.stdin!.on("error", () => finish(new KnowledgeFault("UPSTREAM_UNAVAILABLE", 503)));
    child.once("close", (code) => {
      closed = true;
      jsonProcessesAwaitingClose--;
      if (pendingFault) { clearTimeout(timer); signal?.removeEventListener("abort", cancelled); reject(pendingFault); return; }
      if (done) return;
      try {
        const value: unknown = JSON.parse(Buffer.concat(output).toString("utf8").trim());
        if (code !== 0 && (!record(value) || value.ok !== false)) {
          finish(new KnowledgeFault("UPSTREAM_UNAVAILABLE", 503));
        } else finish(undefined, value);
      } catch { finish(new KnowledgeFault("SCHEMA_INVALID")); }
    });
    child.stdin!.end(input.input ?? "");
    // A signal may have changed between the precheck and listener registration.
    if (signal?.aborted) cancelled();
  });
};

export interface KnowledgeSource {
  id: string;
  label: string;
  channel: "local" | "official";
  approved?: boolean;
  enabled?: boolean;
  writerReady?: boolean;
  targetSha?: string;
  completedSha?: string;
  freshness?: string;
  pending?: number;
  jobs?: Array<{ id: string; status: string; sourceCommit?: string }>;
  error?: { code: string; message: string; reason?: KnowledgePolicyReason };
}
export interface KnowledgeSyncStatus {
  available: boolean;
  writerEnabled: boolean;
  schedulerEnabled: boolean;
  sources: KnowledgeSource[];
  error?: { code: string; message: string; reason?: KnowledgePolicyReason };
}
export interface KnowledgeStatus {
  schemaVersion: typeof SCHEMA;
  cli: { available: boolean; compatible: boolean; version?: string; error?: { code: string; message: string } };
  retrieval: { auth: "missing" | "configured" | "verified" | "denied"; keyword: "unverified" | "verified"; kbId: string; endpoint: string };
  sync: KnowledgeSyncStatus;
}
export interface KnowledgeResult {
  id: string;
  title: string;
  content: string;
  knowledgeId?: string;
  source?: { channel?: "local" | "official"; repoId?: string; path?: string; commit?: string; blobSha?: string };
}

export interface KnowledgeBackend {
  status(signal?: AbortSignal): Promise<KnowledgeStatus>;
  search(input: unknown, signal?: AbortSignal): Promise<{ schemaVersion: typeof SCHEMA; results: KnowledgeResult[]; count: number }>;
  sync(input: unknown, write: boolean, signal?: AbortSignal): Promise<{ schemaVersion: typeof SCHEMA; plan: unknown }>;
  listKnowledgeBases(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
  viewKnowledgeBase(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
  listDocuments(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
  viewDocument(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
  downloadDocument(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
  listChunks(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
  chat(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
  listAgents(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
  askAgent(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload>;
}
export interface KnowledgePayload {
  schemaVersion: typeof SCHEMA;
  [key: string]: unknown;
}
export interface KnowledgeAdapterOptions {
  apiKey?: string;
  keywordOnly?: boolean;
  syncApiKey?: string;
  runJson?: JsonRunner;
  fileAvailable?: (path: string) => Promise<boolean>;
}

const safeId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/);
const queryText = z.string().trim().min(1).max(512).refine((value) => !value.startsWith("-") && !/[\u0000-\u001f\u007f]/u.test(value));
const querySchema = z.object({
  query: queryText,
  kbId: safeId.optional(),
  limit: z.number().int().min(1).max(1000).optional(),
}).strict();
const chatRequest = z.object({ query: queryText, kbId: safeId.optional(), sessionId: safeId.optional() }).strict();
const agentAskRequest = z.object({ query: queryText, agentId: safeId, sessionId: safeId.optional() }).strict();
const DOWNLOAD_LIMIT = 1 << 20;
const syncRequest = z.object({ sourceId: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/), channel: z.enum(["local", "official"]) }).strict();
const syncJobStates = ["queued", "pending", "running", "blocked", "done", "unknown", "cancelled"] as const;
const syncQueueReceipt = z.object({ sourceId: syncRequest.shape.sourceId, channel: syncRequest.shape.channel,
  jobId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/), jobState: z.enum(syncJobStates),
  targetSHA: z.string().regex(/^[0-9a-f]{40,64}$/i), queuedOnly: z.literal(true), writePerformed: z.literal(false) });
const syncErrorsSchema = z.array(z.object({ code: z.string().max(80) })).max(100);
const sourceSchema = z.object({
  schemaVersion: z.literal(1), sourceId: z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/), repoId: z.string().max(100), channel: z.enum(["local", "official"]),
  targetSHA: z.string().regex(/^[0-9a-f]{40,64}$/i).nullable(), completedSHA: z.string().regex(/^[0-9a-f]{40,64}$/i).nullable(),
  freshness: z.enum(["unknown", "current", "stale", "blocked", "syncing", "disabled"]), pending: z.number().int().nonnegative(),
  approved: z.boolean(), enabled: z.boolean(), writerReady: z.boolean(),
  jobs: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/), status: z.string().max(80), source_commit: z.string().regex(/^[0-9a-f]{40,64}$/i).nullable() })).max(10).optional(),
  errors: syncErrorsSchema.optional(),
});

/** Official CLI reader and independent sync bridge; neither owns Creator lifecycle or permissions. */
export class KnowledgeAdapter implements KnowledgeBackend {
  private readonly runner: JsonRunner;
  private readonly available: (path: string) => Promise<boolean>;
  private active = 0;
  private syncActive = false;
  private readonly writableSources = new Set<string>();
  private auth: KnowledgeStatus["retrieval"]["auth"];
  private keyword: KnowledgeStatus["retrieval"]["keyword"] = "unverified";

  constructor(private readonly options: KnowledgeAdapterOptions = {}) {
    this.runner = options.runJson ?? runJsonProcess;
    this.available = options.fileAvailable ?? (async (path) => { try { return (await stat(path)).isFile(); } catch { return false; } });
    this.auth = options.apiKey ? "configured" : "missing";
  }

  async status(signal?: AbortSignal): Promise<KnowledgeStatus> {
    const [cli, sync] = await Promise.all([this.cliStatus(signal), this.syncStatus(signal)]);
    return { schemaVersion: SCHEMA, cli, retrieval: { auth: this.auth, keyword: this.keyword, kbId: KB_ID, endpoint: HOST }, sync };
  }

  async search(input: unknown, signal?: AbortSignal): Promise<{ schemaVersion: typeof SCHEMA; results: KnowledgeResult[]; count: number }> {
    const parsed = querySchema.safeParse(input);
    if (!parsed.success) throw new KnowledgeFault("SCHEMA_INVALID", 400);
    if (!this.options.apiKey) throw new KnowledgeFault("AUTH_MISSING", 401);
    const cli = await this.cliStatus(signal);
    if (!cli.compatible) throw new KnowledgeFault(cli.error?.code ?? "CLI_INCOMPATIBLE", 503);
    try {
      const kbId = parsed.data.kbId ?? KB_ID;
      const limit = parsed.data.limit ?? 10;
      const response = await this.invoke({
        executable: CLI_PATH,
        args: cliArgs(["search", "chunks", parsed.data.query, "--kb", kbId, "--limit", String(limit), ...(this.options.keywordOnly ? ["--no-vector"] : [])]),
        env: this.cliEnv(),
        timeoutMs: 15_000, maxBytes: 1024 * 1024,
      }, signal);
      const data = envelope(response);
      if (!Array.isArray(data) || data.length > limit) throw new KnowledgeFault("SCHEMA_INVALID");
      const results = data.map((item) => searchResult(item, kbId));
      this.auth = "verified";
      this.keyword = "verified";
      return { schemaVersion: SCHEMA, results, count: results.length };
    } catch (error) {
      if (error instanceof KnowledgeFault && error.code === "AUTH_DENIED") { this.auth = "denied"; this.keyword = "unverified"; }
      throw error;
    }
  }

  async sync(input: unknown, write: boolean, signal?: AbortSignal): Promise<{ schemaVersion: typeof SCHEMA; plan: unknown }> {
    const parsed = syncRequest.safeParse(input);
    if (!parsed.success) throw new KnowledgeFault("SCHEMA_INVALID", 400);
    if (this.syncActive) throw new KnowledgeFault("BUSY", 429);
    this.syncActive = true;
    let dispatched = false;
    try {
      const state = await this.syncStatus(signal);
      if (!state.available) throw new KnowledgeFault("UPSTREAM_UNAVAILABLE", 503);
      if (!state.sources.some((s) => s.id === parsed.data.sourceId && s.channel === parsed.data.channel)) throw new KnowledgeFault("SOURCE_NOT_APPROVED", 403);
      if (write && (!state.writerEnabled || !this.writableSources.has(`${parsed.data.sourceId}/${parsed.data.channel}`))) throw new KnowledgeFault("WRITER_DISABLED", 403);
      dispatched = write;
      const response = await this.invoke({
        executable: PYTHON_PATH,
        args: ["-X", "utf8", "-B", SYNC_BRIDGE, "--operation", write ? "sync-once" : "dry-run"],
        env: { ...baseEnv(), PATH: GIT_PATH, ...(write && this.options.syncApiKey ? { KNOWLEDGE_SYNC_API_KEY: this.options.syncApiKey } : {}) },
        input: JSON.stringify(parsed.data), timeoutMs: write ? 60_000 : 30_000, maxBytes: 1024 * 1024,
      }, signal);
      const data = syncEnvelope(response);
      if (write && (!syncQueueReceipt.safeParse(data).success || !record(data) || data.sourceId !== parsed.data.sourceId || data.channel !== parsed.data.channel)) throw new KnowledgeFault("SYNC_OUTCOME_UNKNOWN", 409);
      return { schemaVersion: SCHEMA, plan: projectSyncPlan(data) };
    } catch (error) {
      if (dispatched && (!(error instanceof KnowledgeFault) || !["POLICY_DENIED", "WRITER_DISABLED", "SOURCE_NOT_APPROVED", "AUTH_DENIED"].includes(error.code))) throw new KnowledgeFault("SYNC_OUTCOME_UNKNOWN", 409);
      throw error;
    } finally { this.syncActive = false; }
  }

  private async cliStatus(signal?: AbortSignal): Promise<KnowledgeStatus["cli"]> {
    if (!await this.available(CLI_PATH)) return { available: false, compatible: false, error: safeError(new KnowledgeFault("CLI_UNAVAILABLE")) };
    try {
      const value = envelope(await this.invoke({ executable: CLI_PATH, args: ["version", "--format", "json"], env: { ...baseEnv(), XDG_CONFIG_HOME: CLI_CONFIG }, timeoutMs: 5_000, maxBytes: 32 * 1024 }, signal));
      if (!record(value) || value.version !== "source-v0.8.2" || value.commit !== CLI_COMMIT) throw new KnowledgeFault("CLI_INCOMPATIBLE");
      const schema = envelope(await this.invoke({ executable: CLI_PATH, args: ["schema", "search", "chunks", "--format", "json"], env: { ...baseEnv(), XDG_CONFIG_HOME: CLI_CONFIG }, timeoutMs: 5_000, maxBytes: 32 * 1024 }, signal));
      if (!record(schema) || schema.command !== "search chunks" || !Array.isArray(schema.flags) || !["no-vector", "limit", "kb"].every((name) => (schema.flags as unknown[]).some((f) => record(f) && f.name === name))) throw new KnowledgeFault("CLI_INCOMPATIBLE");
      return { available: true, compatible: true, version: value.version };
    } catch (error) { return { available: true, compatible: false, error: safeError(error) }; }
  }

  private async syncStatus(signal?: AbortSignal): Promise<KnowledgeSyncStatus> {
    const disabled: KnowledgeSyncStatus = { available: false, writerEnabled: false, schedulerEnabled: false, sources: [] };
    this.writableSources.clear();
    if (!await this.available(SYNC_BRIDGE)) return disabled;
    try {
      const data = syncEnvelope(await this.invoke({ executable: PYTHON_PATH, args: ["-X", "utf8", "-B", SYNC_BRIDGE, "--operation", "status"], env: { ...baseEnv(), PATH: GIT_PATH }, input: "{}", timeoutMs: 5_000, maxBytes: 128 * 1024 }, signal));
      if (!record(data)) throw new KnowledgeFault("SCHEMA_INVALID");
      const sources = z.array(sourceSchema).max(100).safeParse(data.sources);
      const errors = syncErrorsSchema.optional().safeParse(data.errors);
      if (!sources.success || !errors.success || typeof data.writerReady !== "boolean" || typeof data.schedulerEnabled !== "boolean") throw new KnowledgeFault("SCHEMA_INVALID");
      for (const source of sources.data) if (source.approved && source.enabled && source.writerReady) this.writableSources.add(`${source.sourceId}/${source.channel}`);
      const registryEmpty = sources.data.length === 0;
      return { available: true, ...(errors.data?.length ? { error: safeSyncError(errors.data[0]!.code, registryEmpty) } : {}), writerEnabled: data.writerReady && this.writableSources.size > 0 && Boolean(this.options.syncApiKey), schedulerEnabled: data.schedulerEnabled, sources: sources.data.map((source) => ({
        id: source.sourceId, label: source.repoId, channel: source.channel,
        approved: source.approved, enabled: source.enabled, writerReady: source.approved && source.enabled && source.writerReady,
        ...(source.targetSHA === null ? {} : { targetSha: source.targetSHA }),
        ...(source.completedSHA === null ? {} : { completedSha: source.completedSHA }),
        freshness: source.freshness, pending: source.pending,
        ...(source.jobs ? { jobs: source.jobs.map((job) => ({ id: job.id, status: ["queued", "pending", "running", "blocked", "done", "complete", "completed", "unknown", "cancelled", "planned"].includes(job.status) ? job.status : "unknown", ...(job.source_commit === null ? {} : { sourceCommit: job.source_commit }) })) } : {}),
        ...(source.errors?.length ? { error: safeSyncError(source.errors[0]!.code, false) } : {}),
      })) };
    } catch (error) { return { ...disabled, error: safeError(error) }; }
  }

  async listKnowledgeBases(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    parseInput(z.object({}).strict(), input);
    const { data } = await this.command(["kb", "list", "--limit", "100"], signal, 15_000);
    return payload({ items: projectRows(data, ["id", "name", "description", "type", "knowledge_count", "chunk_count", "is_pinned", "updated_at"]) });
  }

  async viewKnowledgeBase(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    const parsed = parseInput(z.object({ kbId: safeId }).strict(), input);
    const { data } = await this.command(["kb", "view", parsed.kbId], signal, 15_000);
    return payload({ item: projectRecord(data, ["id", "name", "description", "type", "knowledge_count", "chunk_count", "is_pinned", "updated_at", "embedding_model_id"]) });
  }

  async listDocuments(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    const parsed = parseInput(z.object({ kbId: safeId.optional(), keyword: queryText.optional(), limit: z.number().int().min(1).max(100).optional() }).strict(), input);
    const limit = parsed.limit ?? 20;
    const args = ["doc", "list", "--kb", parsed.kbId ?? KB_ID, "--limit", String(limit), "--page-size", "20"];
    if (parsed.keyword) args.push("--keyword", parsed.keyword);
    const { data, meta } = await this.command(args, signal, 15_000);
    return payload({
      items: projectRows(data, ["id", "title", "file_name", "parse_status", "file_type", "file_size", "updated_at"]),
      truncated: meta.has_more === true,
    });
  }

  async viewDocument(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    const parsed = parseInput(z.object({ id: safeId }).strict(), input);
    const { data } = await this.command(["doc", "view", parsed.id], signal, 15_000);
    return payload({ item: projectRecord(data, ["id", "title", "file_name", "parse_status", "file_type", "file_size", "description", "updated_at"]) });
  }

  async downloadDocument(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    const parsed = parseInput(z.object({ id: safeId }).strict(), input);
    await this.ready(signal);
    const dir = await mkdtemp(join(tmpdir(), "companion-kb-"));
    const target = join(dir, "payload");
    try {
      const response = await this.invoke({
        executable: CLI_PATH,
        args: cliArgs(["doc", "download", parsed.id, "--output", target, "--clobber"]),
        env: this.cliEnv(),
        timeoutMs: 30_000,
        maxBytes: 64 * 1024,
      }, signal);
      const data = envelope(response);
      if (!record(data) || resolve(String(data.path ?? "")) !== resolve(target)) throw new KnowledgeFault("SCHEMA_INVALID");
      let bytes: Buffer;
      try { bytes = await readFile(target); } catch { throw new KnowledgeFault("SCHEMA_INVALID"); }
      const truncated = bytes.length > DOWNLOAD_LIMIT;
      const slice = truncated ? bytes.subarray(0, DOWNLOAD_LIMIT) : bytes;
      const fileName = typeof data.filename === "string" ? data.filename.split(/[\\/]/).pop()?.slice(0, 200) || "document" : "document";
      const binary = slice.subarray(0, 512).includes(0);
      return payload({
        docId: parsed.id,
        fileName,
        bytes: slice.length,
        truncated,
        isBase64: binary,
        content: binary ? slice.toString("base64") : slice.toString("utf8"),
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async listChunks(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    const parsed = parseInput(z.object({ id: safeId, limit: z.number().int().min(1).max(1000).optional() }).strict(), input);
    const limit = parsed.limit ?? 50;
    const { data, meta } = await this.command(["chunk", "list", "--doc", parsed.id, "--limit", String(limit)], signal, 15_000);
    const items = projectRows(data, ["id", "chunk_index", "content", "is_enabled"]).map((item) => ({
      ...item,
      ...(typeof item.content === "string" ? { content: item.content.slice(0, 4000) } : {}),
    }));
    return payload({ items, truncated: meta.has_more === true || items.length >= limit && Number(meta.total_count) > items.length });
  }

  async chat(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    const parsed = parseInput(chatRequest, input);
    const args = ["chat", parsed.query, "--kb", parsed.kbId ?? KB_ID, "--reference"];
    if (parsed.sessionId) args.push("--session", parsed.sessionId);
    return this.conversation(async () => {
      const { data } = await this.command(args, signal, 60_000, 1024 * 1024);
      return payload(projectConversation(data));
    });
  }

  async listAgents(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    parseInput(z.object({}).strict(), input);
    const { data } = await this.command(["agent", "list", "--limit", "100"], signal, 15_000);
    return payload({ items: projectRows(data, ["id", "name", "description", "is_builtin"]) });
  }

  async askAgent(input: unknown, signal?: AbortSignal): Promise<KnowledgePayload> {
    const parsed = parseInput(agentAskRequest, input);
    const args = ["session", "ask", "--agent", parsed.agentId, "--reference", parsed.query];
    if (parsed.sessionId) args.splice(4, 0, "--session", parsed.sessionId);
    return this.conversation(async () => {
      const { data } = await this.command(args, signal, 60_000, 1024 * 1024);
      return payload({ ...projectConversation(data), agentId: parsed.agentId });
    });
  }

  /** 对话失败时给出固定说明，不把上游正文带回页面。 */
  private async conversation(run: () => Promise<KnowledgePayload>): Promise<KnowledgePayload> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof KnowledgeFault && (error.code === "AUTH_DENIED" || error.code === "UPSTREAM_UNAVAILABLE")) {
        throw new KnowledgeFault("CHAT_UNAVAILABLE", error.httpStatus);
      }
      throw error;
    }
  }

  private async command(args: string[], signal: AbortSignal | undefined, timeoutMs: number, maxBytes = 1024 * 1024): Promise<{ data: unknown; meta: Record<string, unknown> }> {
    await this.ready(signal);
    const response = await this.invoke({ executable: CLI_PATH, args: cliArgs(args), env: this.cliEnv(), timeoutMs, maxBytes }, signal);
    const data = envelope(response);
    const meta = record(response) && record(response.meta) ? response.meta : {};
    return { data, meta };
  }

  private async ready(signal?: AbortSignal): Promise<void> {
    if (!this.options.apiKey) throw new KnowledgeFault("AUTH_MISSING", 401);
    const cli = await this.cliStatus(signal);
    if (!cli.compatible) throw new KnowledgeFault(cli.error?.code ?? "CLI_INCOMPATIBLE", 503);
  }

  private cliEnv(): NodeJS.ProcessEnv {
    return { ...baseEnv(), XDG_CONFIG_HOME: CLI_CONFIG, WEKNORA_HOST: HOST, WEKNORA_API_KEY: this.options.apiKey, WEKNORA_LOG_LEVEL: "error" };
  }

  private async invoke(input: JsonInvocation, signal?: AbortSignal): Promise<unknown> {
    if (this.active >= 2) throw new KnowledgeFault("BUSY", 429);
    this.active += 1;
    try { return await this.runner(input, signal); } finally { this.active -= 1; }
  }
}

/** Whitelist essential OS environment only; proxy/provider/key variables are not inherited. */
function baseEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NO_PROXY: "127.0.0.1,localhost", PYTHONUTF8: "1" };
  for (const key of ["SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
  return env;
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function safeSyncError(code: string, registryEmpty: boolean): { code: string; message: string; reason?: KnowledgePolicyReason } {
  const reason = code === "POLICY_NOT_APPROVED" && registryEmpty ? "no_source" as const : POLICY_REASON_BY_CODE[code];
  if (!reason) return safeError(new KnowledgeFault("UPSTREAM_UNAVAILABLE"));
  const faultCode = reason === "writer_disabled" || reason === "credential_missing" ? "WRITER_DISABLED" : "POLICY_DENIED";
  return safeError(new KnowledgeFault(faultCode, 403, reason));
}
function safeError(error: unknown): { code: string; message: string; reason?: KnowledgePolicyReason } {
  const fault = error instanceof KnowledgeFault ? error : new KnowledgeFault("UPSTREAM_UNAVAILABLE");
  return { code: fault.code, message: fault.message, ...(fault.reason ? { reason: fault.reason } : {}) };
}
function envelope(value: unknown): unknown {
  if (!record(value) || typeof value.ok !== "boolean") throw new KnowledgeFault("SCHEMA_INVALID");
  if (!value.ok) {
    const error = record(value.error) ? value.error : {};
    const hint = `${String(error.code ?? "")} ${String(error.type ?? "")} ${String(error.message ?? "")}`;
    if (/401|403|unauthori[sz]ed|forbidden|auth.*(?:required|invalid|denied)/i.test(hint)) throw new KnowledgeFault("AUTH_DENIED", 403);
    const code = typeof error.code === "string" ? error.code : "UPSTREAM_UNAVAILABLE";
    throw new KnowledgeFault(Object.hasOwn(MESSAGES, code) ? code : "UPSTREAM_UNAVAILABLE");
  }
  return value.data;
}
function syncEnvelope(value: unknown): unknown {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.ok !== "boolean") throw new KnowledgeFault("SCHEMA_INVALID");
  if (!value.ok && record(value.error)) {
    const code = value.error.code;
    const reason = POLICY_REASON_BY_CODE[String(code)];
    if (reason === "writer_disabled" || reason === "credential_missing") throw new KnowledgeFault("WRITER_DISABLED", 403, reason);
    if (reason) throw new KnowledgeFault("POLICY_DENIED", 403, reason);
    if (["INVALID_SOURCE_ID", "INVALID_CHANNEL"].includes(String(code))) throw new KnowledgeFault("SOURCE_NOT_APPROVED", 403);
  }
  return envelope(value);
}
function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new KnowledgeFault("SCHEMA_INVALID", 400);
  return parsed.data;
}
function cliArgs(args: string[]): string[] {
  return [...args, "--format", "json", "--profile", "shidai3-pilot"];
}
function payload(fields: Record<string, unknown>): KnowledgePayload {
  return { schemaVersion: SCHEMA, ...fields };
}
function projectRows(value: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) throw new KnowledgeFault("SCHEMA_INVALID");
  return value.slice(0, 1000).map((item) => projectRecord(item, keys));
}
function projectRecord(value: unknown, keys: string[]): Record<string, unknown> {
  if (!record(value)) throw new KnowledgeFault("SCHEMA_INVALID");
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const item = value[key];
    if (typeof item === "string") result[key] = item.slice(0, key === "content" || key === "description" ? 4000 : 200);
    else if (typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) result[key] = item;
  }
  if (typeof result.id !== "string" && keys.includes("id")) throw new KnowledgeFault("SCHEMA_INVALID");
  return result;
}
function projectConversation(value: unknown): { answer: string; sessionId: string; references: Array<{ kbId?: string; chunkId?: string }> } {
  if (!record(value) || !safeId.safeParse(value.session_id).success) throw new KnowledgeFault("SCHEMA_INVALID");
  const events = Array.isArray(value.events) ? value.events : [];
  let answer = "";
  const references: Array<{ kbId?: string; chunkId?: string }> = [];
  for (const event of events) {
    if (!record(event)) continue;
    if (typeof event.content === "string" && event.response_type !== "references") answer += event.content;
    if (!Array.isArray(event.knowledge_references)) continue;
    for (const ref of event.knowledge_references) {
      if (!record(ref)) continue;
      references.push({
        ...(typeof ref.kb_id === "string" ? { kbId: ref.kb_id.slice(0, 80) } : {}),
        ...(typeof ref.chunk_id === "string" ? { chunkId: ref.chunk_id.slice(0, 80) } : {}),
      });
    }
  }
  return { answer: answer.slice(0, 12_000), sessionId: String(value.session_id), references: references.slice(0, 20) };
}
function searchResult(value: unknown, kbId: string): KnowledgeResult {
  if (!record(value) || typeof value.id !== "string" || value.id.length > 160 || typeof value.content !== "string") throw new KnowledgeFault("SCHEMA_INVALID");
  if (value.knowledge_base_id !== undefined && value.knowledge_base_id !== kbId) throw new KnowledgeFault("AUTH_DENIED", 403);
  const metadata = record(value.metadata) ? value.metadata : {};
  const source: NonNullable<KnowledgeResult["source"]> = {};
  if (metadata.channel === "local" || metadata.channel === "official") source.channel = metadata.channel;
  if (typeof metadata.repo_id === "string" && metadata.repo_id.length <= 100) source.repoId = metadata.repo_id;
  if (typeof metadata.source_path === "string" && metadata.source_path.length <= 512 && !/^(?:[a-z]:|[\\/])/i.test(metadata.source_path) && !metadata.source_path.split(/[\\/]/).includes("..")) source.path = metadata.source_path;
  if (typeof metadata.source_commit === "string" && /^[0-9a-f]{40,64}$/i.test(metadata.source_commit)) source.commit = metadata.source_commit;
  if (typeof metadata.source_blob_sha === "string" && /^[0-9a-f]{40,64}$/i.test(metadata.source_blob_sha)) source.blobSha = metadata.source_blob_sha;
  return {
    id: value.id, title: typeof value.knowledge_title === "string" ? value.knowledge_title.slice(0, 200) : "无标题",
    content: value.content.slice(0, 4000),
    ...(typeof value.knowledge_id === "string" ? { knowledgeId: value.knowledge_id.slice(0, 160) } : {}),
    ...(Object.keys(source).length ? { source } : {}),
  };
}

/** Only bounded provenance and counters reach the browser; config, content and diagnostics are omitted. */
function projectSyncPlan(value: unknown, depth = 0): Record<string, unknown> {
  if (!record(value)) throw new KnowledgeFault("SCHEMA_INVALID");
  if (depth > 4) return {};
  const result: Record<string, unknown> = {};
  const identifiers = ["sourceId", "source_id", "repoId", "repo_id"];
  const shas = ["commit", "commit_sha", "targetSha", "completedSha", "targetSHA", "completedSHA", "blobSha", "blob_sha", "source_commit", "baseline_commit"];
  const counters = ["pending", "added", "updated", "removed", "excluded", "unchanged", "total", "count"];
  for (const key of identifiers) if (typeof value[key] === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(value[key])) result[key] = value[key];
  for (const key of shas) if (typeof value[key] === "string" && /^[0-9a-f]{40,64}$/i.test(value[key])) result[key] = value[key];
  for (const key of counters) if (Number.isSafeInteger(value[key]) && (value[key] as number) >= 0) result[key] = value[key];
  if (value.channel === "local" || value.channel === "official") result.channel = value.channel;
  for (const key of ["queuedOnly", "writePerformed"]) if (typeof value[key] === "boolean") result[key] = value[key];
  for (const key of ["jobId", "persistedJobId"]) if (typeof value[key] === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value[key])) result[key] = value[key];
  if (typeof value.jobState === "string" && (syncJobStates as readonly string[]).includes(value.jobState)) result.jobState = value.jobState;
  if (typeof value.status === "string" && ["pending", "complete", "completed", "blocked", "dry-run", "unchanged"].includes(value.status)) result.status = value.status;
  if (typeof value.action === "string" && ["add", "create", "update", "remove", "delete", "exclude", "unchanged"].includes(value.action)) result.action = value.action;
  if (typeof value.path === "string" && value.path.length <= 512 && !/^(?:[a-z]:|[\\/])/i.test(value.path) && !value.path.split(/[\\/]/).includes("..")) result.path = value.path;
  for (const key of ["summary", "counts", "manifest", "changes"]) if (record(value[key])) result[key] = projectSyncPlan(value[key], depth + 1);
  for (const key of ["files", "documents", "items", "actions", "exclusions"]) {
    if (Array.isArray(value[key])) result[key] = value[key].slice(0, 100).filter(record).map((item) => projectSyncPlan(item, depth + 1));
  }
  return result;
}
