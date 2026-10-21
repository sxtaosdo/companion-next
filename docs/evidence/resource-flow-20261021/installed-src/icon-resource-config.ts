import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import type { ProjectRecord } from "./types.js";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const size = z.object({ width: z.number().int().min(1).max(8192), height: z.number().int().min(1).max(8192) }).strict();
const relativePath = z.string().max(240).refine(value => !value.includes("\\") && !value.includes(":")
  && !value.startsWith("/") && value.split("/").every(part => /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(part) && part !== ".."));
export const legacyIconResourceConfigSchema = z.object({
  schemaVersion: z.literal("project-resource-config-v1"), version: z.number().int().positive(),
  designResolution: size, orientation: z.enum(["portrait", "landscape", "square"]),
  iconPresets: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/), label: z.string().trim().min(1).max(60),
    displaySize: size, outputPixels: z.object({ width: z.literal(1024), height: z.literal(1024) }).strict() }).strict()).min(1).max(8),
  style: z.object({ description: z.string().trim().min(1).max(1500),
    references: z.array(relativePath.refine(value => /^(?:art\/reference\/|assets\/).+\.(?:png|jpe?g|webp)$/i.test(value))).max(4) }).strict(),
  background: z.object({ format: z.literal("png"), transparent: z.literal(true) }).strict(),
  composition: z.object({ centered: z.literal(true), paddingPercent: z.number().min(0).max(40) }).strict(),
  destination: z.object({ directory: relativePath.refine(value => value === "assets" || value.startsWith("assets/")), naming: z.literal("kebab-case") }).strict(),
}).strict().superRefine((config, context) => {
  if (config.orientation !== orientation(config.designResolution)) context.addIssue({ code: "custom", path: ["orientation"], message: "Orientation must match design resolution" });
  if (new Set(config.iconPresets.map(preset => preset.id)).size !== config.iconPresets.length) context.addIssue({ code: "custom", path: ["iconPresets"], message: "Duplicate preset" });
});
export const projectIconResourceConfigSchema = z.object({
  schemaVersion: z.literal("project-resource-config-v2"), projectId: z.string().regex(/^[a-f0-9]{16}$/), version: z.number().int().positive(),
  designResolution: size, orientation: z.enum(["portrait", "landscape", "square"]), iconSize: z.object({ width: z.number().int().min(1).max(4096), height: z.number().int().min(1).max(4096) }).strict().refine(value => value.width * value.height <= 16_000_000),
  style: z.object({ description: z.string().trim().min(1).max(1500), references: z.array(relativePath.refine(value => /^(?:art\/reference\/|assets\/).+\.(?:png|jpe?g|webp)$/i.test(value)
    && value.split("/").every(part => !part.endsWith(".") && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))).max(4).refine(value => new Set(value).size === value.length) }).strict(),
  background: z.object({ format: z.literal("png"), transparent: z.boolean(), color: z.string().regex(/^#[a-fA-F0-9]{6}$/) }).strict(),
  composition: z.object({ centered: z.literal(true), paddingPercent: z.number().min(0).max(40) }).strict(),
  destination: z.object({ directory: relativePath.refine(value => value === "assets" || value.startsWith("assets/")),
    exportDirectory: relativePath.refine(value => (value === "art/final" || value.startsWith("art/final/")) && value.split("/").every(part => /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(part))), naming: z.literal("kebab-case") }).strict(),
}).strict().superRefine((config, context) => {
  if (config.orientation !== orientation(config.designResolution)) context.addIssue({ code: "custom", path: ["orientation"], message: "Orientation must match design resolution" });
});
export const iconResourceConfigSchema = z.union([legacyIconResourceConfigSchema, projectIconResourceConfigSchema]);
export type IconResourceConfig = z.infer<typeof iconResourceConfigSchema>;
export type ProjectIconResourceConfig = z.infer<typeof projectIconResourceConfigSchema>;
export const iconResourceBindingSchema = z.object({ version: z.number().int().positive(), hash: sha, presetId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/) }).strict();
export const iconResourceSaveSchema = z.object({ config: iconResourceConfigSchema, expectedHash: sha.nullable(), approved: z.literal(true) }).strict();
const assetSchema = z.object({ assetId: z.string().regex(/^[a-z][a-z0-9-]{0,59}$/), relativePath,
  prompt: z.string().trim().min(1).max(4096), purpose: z.string().trim().min(1).max(400), required: z.literal(true) }).strict();
const requestSchema = z.object({ schemaVersion: z.literal("local-icon-requests-v1"), projectId: z.string().regex(/^[a-f0-9]{16}$/),
  runId: z.string().regex(/^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/), sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  visualSpec: z.string().min(1).max(2000), assets: z.array(assetSchema).min(1).max(2) }).strict();
const capsuleSchema = z.object({ schemaVersion: z.literal("companion-icon-resource-snapshot-v1"), projectId: z.string().regex(/^[a-f0-9]{16}$/),
  jobId: z.string().regex(/^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/), sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  requestHash: sha, inputHash: sha, binding: iconResourceBindingSchema, config: iconResourceConfigSchema, configBytes: z.string().max(65536),
  sourceHashes: z.record(z.string(), sha), request: requestSchema,
  referenceSnapshots: z.array(z.object({ relativePath, sha256: sha }).strict()).max(4).optional() }).strict();
type Capsule = z.infer<typeof capsuleSchema>;
export class IconResourceFault extends Error {
  constructor(readonly code: string, readonly httpStatus = 409) { super(code); }
}
export type ResourceSnapshot = { state: "sealed"; version: number; hash: string; presetId: string; config: IconResourceConfig; referenceSnapshots?: Array<{relativePath: string; sha256: string}> }
  | { state: "unavailable" };
export interface ResourceView {
  projectId: string; state: "valid" | "missing" | "invalid"; version: number | null; hash: string | null;
  relativePath: string; migrationRequired: boolean; config: IconResourceConfig | null; draft: ProjectIconResourceConfig;
  issues: Array<{ field: string; code: string }>;
  detected: { designResolution: { width: number; height: number } | null; designSource: string | null; resourceDirectories: string[] };
  capabilities: { outputPixels: { width: 1024; height: 1024 }; format: "png"; overwrite: false; referencesAsModelInput: false };
}
export interface IconResourceBackend {
  read(project: ProjectRecord): Promise<ResourceView>;
  save(project: ProjectRecord, input: z.infer<typeof iconResourceSaveSchema>): Promise<ResourceView>;
  prepare(project: ProjectRecord, request: unknown, binding: unknown, persist: boolean): Promise<unknown>;
  snapshot(job: { projectId: string; jobId: string; requestHash: string; sourceRevision: string }): Promise<ResourceSnapshot | undefined>;
}
const orientation = (value: { width: number; height: number }) => value.width === value.height ? "square" : value.width < value.height ? "portrait" : "landscape";
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export function iconCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(iconCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${iconCanonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined || typeof value === "number" && !Number.isFinite(value)) throw new IconResourceFault("INVALID_INPUT", 400);
  return encoded;
}
const parseJson = (bytes: Buffer) => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")) as unknown;
const inside = (root: string, target: string) => { const part = relative(root, target); return part !== "" && !part.startsWith("..") && !isAbsolute(part); };
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
async function readBounded(path: string, limit = 64 * 1024): Promise<Buffer | null> {
  let file;
  try { file = await open(path, "r"); } catch (error) { if (missing(error)) return null; throw error; }
  try {
    if (!(await file.stat()).isFile()) throw new IconResourceFault("RESOURCE_CONFIG_INVALID");
    const buffer = Buffer.alloc(limit + 1); let offset = 0;
    while (offset < buffer.length) { const next = await file.read(buffer, offset, buffer.length - offset, null); if (!next.bytesRead) break; offset += next.bytesRead; }
    if (offset > limit) throw new IconResourceFault("RESOURCE_CONFIG_INVALID");
    return buffer.subarray(0, offset);
  } finally { await file.close(); }
}
async function projectFile(root: string, path: string): Promise<Buffer | null> {
  const canonicalRoot = await realpath(root), target = resolve(root, path);
  if (!inside(resolve(root), target)) throw new IconResourceFault("RESOURCE_PATH_INVALID");
  try { if (!inside(canonicalRoot, await realpath(target))) throw new IconResourceFault("RESOURCE_PATH_INVALID"); }
  catch (error) { if (missing(error)) return null; throw error; }
  return readBounded(target);
}
async function referenceExists(root: string, path: string): Promise<boolean> {
  try {
    const target = await realpath(resolve(root, path));
    if (!inside(await realpath(root), target)) throw new IconResourceFault("RESOURCE_PATH_INVALID");
    return (await lstat(target)).isFile(); // References are metadata only; never load image bytes.
  } catch (error) { if (missing(error)) return false; throw error; }
}
function validCapsule(c: Capsule): boolean {
  return c.projectId === c.request.projectId && c.jobId === c.request.runId && c.sourceRevision === c.request.sourceRevision
    && hash(iconCanonicalJson(c.request)) === c.requestHash && hash(c.configBytes) === c.binding.hash
    && iconCanonicalJson(iconResourceConfigSchema.parse(JSON.parse(c.configBytes.replace(/^\uFEFF/, "")))) === iconCanonicalJson(c.config)
    && c.config.version === c.binding.version && (c.config.schemaVersion === "project-resource-config-v1"
      ? c.config.iconPresets.some(p => p.id === c.binding.presetId)
      : c.config.projectId === c.projectId && c.binding.presetId === "default"
        && (c.config.style.references.length === 0 || c.referenceSnapshots?.length === c.config.style.references.length
          && c.referenceSnapshots.every((ref, index) => ref.relativePath === c.config.style.references[index]
            && c.sourceHashes[ref.relativePath] === ref.sha256 && c.request.visualSpec.includes(`${ref.relativePath}:${ref.sha256}`))));
}

/** Project parameters only; art/manifest.csv stays the asset-selection authority. No Creator/GPU lifecycle. */
export class IconResourceConfigs implements IconResourceBackend {
  private readonly saving = new Set<string>();
  constructor(private readonly storePath: string,
    private readonly snapshotReferences?: (project: ProjectRecord, refs: string[]) => Promise<Array<{relativePath: string; sha256: string}>>) {}
  private async configFile(project: ProjectRecord): Promise<{ relativePath: string; bytes: Buffer | null }> {
    const preferred = `${project.id}.ai-icons.json`, names = (await readdir(project.path)).filter(name => name.endsWith(".ai-icons.json"));
    if (names.length > 32) throw new IconResourceFault("RESOURCE_CONFIG_CONFLICT");
    const candidates: Array<{relativePath: string; bytes: Buffer}> = [];
    for (const name of [...new Set([preferred, "resource-config.json", ...names])]) {
      const bytes = await projectFile(project.path, name); if (!bytes) continue;
      let owner: unknown; try { owner = parseJson(bytes); } catch { /* An existing default/legacy file remains protected. */ }
      if (name === preferred || name === "resource-config.json" || owner && typeof owner === "object" && (owner as Record<string, unknown>).projectId === project.id) candidates.push({ relativePath: name, bytes });
    }
    if (candidates.length > 1) throw new IconResourceFault("RESOURCE_CONFIG_CONFLICT");
    return candidates[0] ?? { relativePath: preferred, bytes: null };
  }
  private capsulePath(projectId: string, jobId: string): string {
    if (!/^[a-f0-9]{16}$/.test(projectId) || !/^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/.test(jobId)) throw new IconResourceFault("INVALID_INPUT", 400);
    return join(this.storePath, "companion-resource-snapshots", projectId, `${jobId}.json`);
  }
  private async capsuleRead(path: string): Promise<Buffer | null> {
    try {
      if (!inside(await realpath(this.storePath), await realpath(path))) throw new IconResourceFault("RESOURCE_PATH_INVALID");
      return readBounded(path, 128 * 1024);
    } catch (error) { if (missing(error)) return null; throw error; }
  }
  private async sources(project: ProjectRecord) {
    const sourceHashes: Record<string, string> = {};
    const designSource = "settings/v2/packages/project.json";
    let design: { width: number; height: number } | null = null;
    const designBytes = await projectFile(project.path, designSource);
    if (designBytes) {
      sourceHashes[designSource] = hash(designBytes);
      try { const parsed = z.object({ general: z.object({ designResolution: size }) }).parse(parseJson(designBytes)); design = parsed.general.designResolution; } catch { /* Missing or unsupported design must be entered explicitly. */ }
    }
    const manifestBytes = await projectFile(project.path, "art/manifest.csv");
    if (manifestBytes) sourceHashes["art/manifest.csv"] = hash(manifestBytes);
    const resourceDirectories: string[] = [];
    for (const path of ["assets/resources/common/texture", "assets/bundle/endless/art/characters", "assets/icons", "assets/art", "assets/resources/textures", "assets"]) {
      try { const canonical = await realpath(join(project.path, path)); if (inside(await realpath(project.path), canonical) && (await lstat(canonical)).isDirectory()) resourceDirectories.push(path); } catch (error) { if (!missing(error)) throw error; }
    }
    return { sourceHashes, detected: { designResolution: design, designSource: design ? designSource : null, resourceDirectories } };
  }
  async read(project: ProjectRecord): Promise<ResourceView> {
    const { detected } = await this.sources(project);
    const draft: ProjectIconResourceConfig = { schemaVersion: "project-resource-config-v2", projectId: project.id, version: 1,
      designResolution: detected.designResolution ?? { width: 0, height: 0 }, orientation: detected.designResolution ? orientation(detected.designResolution) : "portrait",
      iconSize: { width: 0, height: 0 },
      style: { description: "", references: [] }, background: { format: "png", transparent: true, color: "#ffffff" }, composition: { centered: true, paddingPercent: 10 },
      destination: { directory: detected.resourceDirectories[0] ?? "assets", exportDirectory: "art/final/companion", naming: "kebab-case" } };
    const selected = await this.configFile(project);
    const view: ResourceView = { projectId: project.id, state: "missing", version: null, hash: null, relativePath: selected.relativePath, migrationRequired: false, config: null, draft, issues: [], detected,
      capabilities: { outputPixels: { width: 1024, height: 1024 }, format: "png", overwrite: false, referencesAsModelInput: false } };
    const bytes = selected.bytes;
    if (!bytes) return view;
    view.hash = hash(bytes); view.state = "invalid";
    let value: unknown;
    try { value = parseJson(bytes); } catch { view.issues.push({ field: "config", code: "INVALID_JSON" }); return view; }
    const savedVersion = z.object({ schemaVersion: z.enum(["project-resource-config-v1", "project-resource-config-v2"]), version: z.number().int().positive() }).safeParse(value);
    if (savedVersion.success) view.version = savedVersion.data.version;
    const parsed = iconResourceConfigSchema.safeParse(value);
    if (!parsed.success) { view.issues = parsed.error.issues.slice(0, 20).map(issue => ({ field: issue.path.join("."), code: "INVALID_FIELD" })); return view; }
    if (parsed.data.schemaVersion === "project-resource-config-v2" && parsed.data.projectId !== project.id) { view.issues.push({ field: "projectId", code: "RESOURCE_PROJECT_MISMATCH" }); return view; }
    view.config = parsed.data; view.version = parsed.data.version;
    if (parsed.data.schemaVersion === "project-resource-config-v2") view.draft = structuredClone(parsed.data);
    else {
      view.migrationRequired = true;
      const sizes = new Set(parsed.data.iconPresets.map(p => iconCanonicalJson(p.displaySize)));
      view.draft = { ...draft, ...structuredClone(parsed.data), schemaVersion: "project-resource-config-v2", projectId: project.id,
        iconSize: sizes.size === 1 ? parsed.data.iconPresets[0]!.displaySize : { width: 0, height: 0 },
        background: { ...parsed.data.background, color: "#ffffff" }, destination: { ...parsed.data.destination, exportDirectory: "art/final/companion" } };
      delete (view.draft as unknown as Record<string, unknown>).iconPresets;
    }
    if (detected.designResolution && iconCanonicalJson(detected.designResolution) !== iconCanonicalJson(parsed.data.designResolution)) {
      view.draft.designResolution = detected.designResolution; view.draft.orientation = orientation(detected.designResolution);
      view.issues.push({ field: "designResolution", code: "ENGINE_DESIGN_CHANGED" });
    }
    for (const reference of parsed.data.style.references) {
      if (!(await referenceExists(project.path, reference))) view.issues.push({ field: "style.references", code: "REFERENCE_NOT_FOUND" });
    }
    if (!view.issues.length) view.state = "valid";
    return view;
  }
  async save(project: ProjectRecord, input: z.infer<typeof iconResourceSaveSchema>): Promise<ResourceView> {
    if (this.saving.has(project.id)) throw new IconResourceFault("RESOURCE_CONFIG_BUSY");
    this.saving.add(project.id);
    let tempPath: string | undefined;
    let displacedPath: string | undefined;
    let target: string | undefined;
    try {
      const current = await this.read(project);
      if (current.hash !== input.expectedHash) throw new IconResourceFault("RESOURCE_CONFIG_STALE");
      target = join(project.path, current.relativePath);
      if (current.hash) {
        if ((await lstat(target)).isSymbolicLink()) throw new IconResourceFault("RESOURCE_PATH_INVALID");
        const raw = parseJson((await projectFile(project.path, current.relativePath))!);
        if (!raw || typeof raw !== "object" || !["project-resource-config-v1", "project-resource-config-v2"].includes(String((raw as Record<string, unknown>).schemaVersion))) throw new IconResourceFault("RESOURCE_CONFIG_CONFLICT");
        if (current.version === null) throw new IconResourceFault("RESOURCE_CONFIG_CONFLICT");
        const v2 = (raw as Record<string, unknown>).schemaVersion === "project-resource-config-v2";
        if (v2 && (raw as Record<string, unknown>).projectId !== project.id) throw new IconResourceFault("RESOURCE_CONFIG_CONFLICT");
        if (Object.keys(raw).some(key => !["schemaVersion", "version", "designResolution", "orientation", v2 ? "iconSize" : "iconPresets", "style", "background", "composition", "destination", ...(v2 ? ["projectId"] : [])].includes(key))) throw new IconResourceFault("RESOURCE_CONFIG_CONFLICT");
        const known = (v2 ? projectIconResourceConfigSchema : legacyIconResourceConfigSchema).safeParse(raw);
        if (!known.success && known.error.issues.some(issue => issue.code === "unrecognized_keys")) throw new IconResourceFault("RESOURCE_CONFIG_CONFLICT");
      }
      const config = iconResourceConfigSchema.parse({ ...input.config, version: (current.version ?? 0) + 1 });
      if (config.schemaVersion === "project-resource-config-v2" && config.projectId !== project.id) throw new IconResourceFault("RESOURCE_PROJECT_MISMATCH");
      if (current.detected.designResolution && iconCanonicalJson(current.detected.designResolution) !== iconCanonicalJson(config.designResolution)) throw new IconResourceFault("RESOURCE_DESIGN_MISMATCH");
      for (const reference of config.style.references) if (!(await referenceExists(project.path, reference))) throw new IconResourceFault("RESOURCE_REFERENCE_INVALID");
      const bytes = Buffer.from(`${JSON.stringify(config, null, 2)}\n`);
      tempPath = join(project.path, `.resource-config-${randomUUID()}.tmp`);
      const file = await open(tempPath, "wx", 0o600); try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
      const beforeRename = await projectFile(project.path, current.relativePath);
      if ((beforeRename ? hash(beforeRename) : null) !== input.expectedHash) throw new IconResourceFault("RESOURCE_CONFIG_STALE");
      if ((await this.configFile(project)).relativePath !== current.relativePath) throw new IconResourceFault("RESOURCE_CONFIG_STALE");
      if (input.expectedHash !== null) {
        displacedPath = join(project.path, `.resource-config-conflict-${randomUUID()}.json`);
        await rename(target, displacedPath);
        const displaced = await readBounded(displacedPath);
        if (!displaced || hash(displaced) !== input.expectedHash || (await lstat(displacedPath)).isSymbolicLink()) throw new IconResourceFault("RESOURCE_CONFIG_STALE");
      }
      try { await link(tempPath, target); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new IconResourceFault("RESOURCE_CONFIG_STALE"); throw error; }
      await unlink(tempPath); tempPath = undefined;
      if (displacedPath) { await unlink(displacedPath); displacedPath = undefined; }
      const saved = await this.read(project);
      if (saved.hash !== hash(bytes) || saved.state !== "valid") throw new IconResourceFault("RESOURCE_CONFIG_SAVE_UNCONFIRMED");
      return saved;
    } finally {
      // A concurrent Owner file wins. Restore displaced bytes only if the target remains absent;
      // if another writer filled the target, retain the conflict archive instead of deleting it.
      if (displacedPath) {
        try { if (target) { await link(displacedPath, target); await unlink(displacedPath); } } catch { /* Retain the exact archive on conflict. */ }
      }
      if (tempPath) await unlink(tempPath).catch(() => undefined); this.saving.delete(project.id);
    }
  }
  async prepare(project: ProjectRecord, input: unknown, bindingInput: unknown, persist: boolean): Promise<unknown> {
    const request = requestSchema.parse(input), binding = iconResourceBindingSchema.parse(bindingInput);
    if (request.projectId !== project.id) throw new IconResourceFault("RESOURCE_PROJECT_MISMATCH");
    const capsulePath = this.capsulePath(project.id, request.runId), inputHash = hash(iconCanonicalJson(request));
    const existing = await this.capsuleRead(capsulePath);
    if (existing) {
      const capsule = capsuleSchema.parse(parseJson(existing));
      if (capsule.projectId !== project.id || capsule.jobId !== request.runId || capsule.inputHash !== inputHash
        || iconCanonicalJson(capsule.binding) !== iconCanonicalJson(binding) || !validCapsule(capsule)) throw new IconResourceFault("RESOURCE_SNAPSHOT_CONFLICT");
      return capsule.request;
    }
    const view = await this.read(project);
    if (view.state !== "valid" || !view.config || !view.hash) throw new IconResourceFault("RESOURCE_CONFIG_REQUIRED");
    if (binding.version !== view.version || binding.hash !== view.hash) throw new IconResourceFault("RESOURCE_CONFIG_STALE");
    const c = view.config;
    const display = c.schemaVersion === "project-resource-config-v1" ? c.iconPresets.find(preset => preset.id === binding.presetId)?.displaySize : binding.presetId === "default" ? c.iconSize : undefined;
    if (!display) throw new IconResourceFault("RESOURCE_PRESET_INVALID");
    const referenceHashes: Array<{relativePath: string; sha256: string}> = [];
    if (c.schemaVersion === "project-resource-config-v2") for (const reference of c.style.references) {
      const canonicalRoot = await realpath(project.path), target = await realpath(resolve(project.path, reference));
      if (!inside(canonicalRoot, target)) throw new IconResourceFault("RESOURCE_PATH_INVALID");
      const bytes = await readBounded(target, 4 * 1024 * 1024); if (!bytes) throw new IconResourceFault("RESOURCE_REFERENCE_INVALID");
      referenceHashes.push({ relativePath: reference, sha256: hash(bytes) });
    }
    const visualSpec = `${c.style.description}\n配置 v${c.version} SHA256 ${view.hash}; 设计 ${c.designResolution.width}×${c.designResolution.height} ${c.orientation}; 默认尺寸 ${display.width}×${display.height}（CPU 派生）; 母图 1024×1024 透明 PNG; 居中完整，四周 ${c.composition.paddingPercent}% 留白; 参考仅记录，不作为模型图像输入。${referenceHashes.map(ref => `\n${ref.relativePath}:${ref.sha256}`).join("")}`;
    if (visualSpec.length > 2000) throw new IconResourceFault("RESOURCE_STYLE_TOO_LONG");
    const compiled = requestSchema.parse({ ...request, visualSpec, assets: request.assets.map(asset => {
      if (asset.relativePath !== `${c.destination.directory}/${asset.assetId}.png`) throw new IconResourceFault("RESOURCE_DESTINATION_MISMATCH");
      return { ...asset, prompt: `${asset.prompt}\n${c.style.description}\n单个游戏图标，物体居中完整，四周 ${c.composition.paddingPercent}% 留白，透明背景，PNG，无文字、无水印；文字由游戏 UI 承担。` };
    }) });
    if (persist) {
      const sources = await this.sources(project);
      const capsule: Capsule = { schemaVersion: "companion-icon-resource-snapshot-v1", projectId: project.id, jobId: compiled.runId,
        sourceRevision: compiled.sourceRevision, requestHash: hash(iconCanonicalJson(compiled)), inputHash, binding, config: c,
        configBytes: (await projectFile(project.path, view.relativePath))!.toString("utf8"), sourceHashes: sources.sourceHashes, request: compiled };
      if (c.schemaVersion === "project-resource-config-v2" && c.style.references.length) {
        if (!this.snapshotReferences) throw new IconResourceFault("RESOURCE_REFERENCE_SNAPSHOT_UNAVAILABLE");
        capsule.referenceSnapshots = (await this.snapshotReferences(project, c.style.references)).map(ref => ({ relativePath: ref.relativePath, sha256: ref.sha256 }));
        if (iconCanonicalJson(capsule.referenceSnapshots) !== iconCanonicalJson(referenceHashes)) throw new IconResourceFault("RESOURCE_REFERENCE_SNAPSHOT_UNAVAILABLE");
        for (const ref of capsule.referenceSnapshots) capsule.sourceHashes[ref.relativePath] = ref.sha256;
      }
      if (!validCapsule(capsule)) throw new IconResourceFault("RESOURCE_CONFIG_STALE");
      const capsuleRoot = dirname(dirname(capsulePath));
      await mkdir(capsuleRoot, { recursive: true });
      if (!inside(await realpath(this.storePath), await realpath(capsuleRoot))) throw new IconResourceFault("RESOURCE_PATH_INVALID");
      await mkdir(dirname(capsulePath), { recursive: true });
      if (!inside(await realpath(this.storePath), await realpath(dirname(capsulePath)))) throw new IconResourceFault("RESOURCE_PATH_INVALID");
      const temporary = join(dirname(capsulePath), `.snapshot-${randomUUID()}.tmp`);
      try {
        const file = await open(temporary, "wx", 0o600);
        try { await file.writeFile(`${JSON.stringify(capsule)}\n`); await file.sync(); } finally { await file.close(); }
        try { await link(temporary, capsulePath); } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") return this.prepare(project, input, bindingInput, persist);
          throw error;
        }
      } finally { await unlink(temporary).catch(() => undefined); }
    }
    return compiled;
  }
  async snapshot(job: { projectId: string; jobId: string; requestHash: string; sourceRevision: string }): Promise<ResourceSnapshot | undefined> {
    try {
      const bytes = await this.capsuleRead(this.capsulePath(job.projectId, job.jobId));
      if (!bytes) return undefined;
      const c = capsuleSchema.parse(parseJson(bytes));
      if (c.projectId !== job.projectId || c.jobId !== job.jobId || c.requestHash !== job.requestHash || c.sourceRevision !== job.sourceRevision
        || !validCapsule(c)) throw new Error();
      return { state: "sealed", version: c.binding.version, hash: c.binding.hash, presetId: c.binding.presetId, config: c.config,
        ...(c.referenceSnapshots ? { referenceSnapshots: c.referenceSnapshots } : {}) };
    } catch { return { state: "unavailable" }; }
  }
}
