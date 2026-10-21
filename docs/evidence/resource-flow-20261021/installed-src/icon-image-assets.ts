import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { runJsonProcess, type JsonRunner } from "./knowledge-adapter.js";
import type { ProjectRecord } from "./types.js";
import { iconVariantBindingSchema } from "./icon-handoff.js";

const INPUT_LIMIT = 4 * 1024 * 1024, PROCESS_LIMIT = 8 * 1024 * 1024, MAX_PIXELS = 16_000_000;
const sha = z.string().regex(/^[a-f0-9]{64}$/), size = z.number().int().min(1).max(4096);
const encodedImage = z.string().min(4).max(Math.ceil(INPUT_LIMIT / 3) * 4).refine(value => value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value));
const segment = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const safeRelative = (value: string) => !isAbsolute(value) && !value.includes("\\") && value.split("/").every(part => segment.test(part) && !reserved.test(part));
const outputDirectory = z.string().max(240).refine(value => (value === "art/final" || value.startsWith("art/final/")) && safeRelative(value));
export const iconReferenceUploadSchema = z.object({ base64: encodedImage, approved: z.literal(true) }).strict();
const cropRoi = z.object({ x: z.number().int().min(0).max(4095), y: z.number().int().min(0).max(4095), width: size, height: size }).strict();
export const iconReferenceCropSchema = z.object({ base64: encodedImage, sourceSha256: sha, width: size, height: size,
  roi: cropRoi, approved: z.literal(true) }).strict().refine(value => value.width * value.height <= MAX_PIXELS
    && value.roi.x + value.roi.width <= value.width && value.roi.y + value.roi.height <= value.height);
export const iconReferenceCropStatusSchema = z.object({ cropId: sha }).strict();
const referencePath = z.string().max(240).refine(value => /^(?:art\/reference|assets)\/.+\.(?:png|jpe?g|webp)$/i.test(value)
  && !isAbsolute(value) && !value.includes("\\") && !value.includes(":")
  && value.split("/").every(part => /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(part)
    && part !== ".." && !part.endsWith(".") && !reserved.test(part)));
export const iconReferencePreviewSchema = z.object({ relativePath: referencePath }).strict();
/** directory is supplied by the trusted adapter, never copied from browser input. */
export const iconVariantExportSchema = z.object({
  base64: encodedImage, sourceSha256: sha, assetId: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(80).refine(value => !reserved.test(value)),
  width: size, height: size, directory: outputDirectory, transparent: z.boolean(), color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  allowUpscale: z.boolean(), expectedTargetSha256: z.null(),
  binding: iconVariantBindingSchema.optional(),
}).strict().refine(value => value.width * value.height <= MAX_PIXELS);
export class IconImageFault extends Error {
  constructor(readonly code: string, readonly httpStatus = 409) { super(code); }
}
export interface IconImageAssetsOptions { pythonPath: string; storePath: string; runJson?: JsonRunner; }
export interface IconReferenceAsset {
  relativePath: string; sha256: string; width: number; height: number; mimeType: "image/png";
  originalRelativePath: string; originalSha256: string;
}
export interface IconReferenceSnapshot { relativePath: string; sha256: string; }
const imageReference = z.object({ relativePath: referencePath, sha256: sha, width: size, height: size }).strict();
const cropReceipt = z.object({ schemaVersion: z.literal("companion-reference-crop-v1"), projectId: z.string().regex(/^[a-f0-9]{16}$/), cropId: sha,
  sourceSha256: sha, width: size, height: size, roi: cropRoi, coordinateSpace: z.literal("top-left-display-pixels-after-exif-transpose"),
  original: z.object({ relativePath: referencePath, sha256: sha }).strict(), context: imageReference, subject: imageReference,
  modelConditioning: z.literal(false) }).strict();
export type IconReferenceCropAsset = z.infer<typeof cropReceipt> & { receiptRelativePath: string; receiptSha256: string };
export interface IconVariantAsset {
  relativePath: string; sha256: string; sourceSha256: string; width: number; height: number;
  created: boolean; upscaled: boolean; qualityLimit: string | null;
  receiptSha256?: string;
}
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const code = (error: unknown) => (error as NodeJS.ErrnoException)?.code;
const contained = (root: string, target: string) => { const part = relative(root, target); return part === "" || (!isAbsolute(part) && part !== ".." && !part.startsWith(`..${sep}`)); };
const metadata = z.object({ width: size, height: size, mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]) }).strict().refine(value => value.width * value.height <= MAX_PIXELS);
const pixels = z.object({ base64: encodedImage, width: size, height: size, mimeType: z.literal("image/png") }).strict().refine(value => value.width * value.height <= MAX_PIXELS);
const faults = ["IMAGE_INVALID", "IMAGE_ANIMATED", "IMAGE_DIMENSIONS_INVALID", "IMAGE_TYPE_UNSUPPORTED", "IMAGE_OUTPUT_LIMIT", "UPSCALE_APPROVAL_REQUIRED", "IMAGE_SOURCE_DIMENSIONS_CHANGED", "CROP_BOUNDS_INVALID"] as const;
const failure = z.object({ ok: z.literal(false), error: z.object({ code: z.enum(faults) }).strict() }).strict();

// Fixed CPU-only program. Bytes and options arrive through stdin; no browser text is executable code.
const PILLOW_SCRIPT = String.raw`
import base64, io, json, sys, warnings
from PIL import Image, ImageFile, ImageOps
Image.MAX_IMAGE_PIXELS = 16000000
ImageFile.LOAD_TRUNCATED_IMAGES = False
warnings.simplefilter("error", Image.DecompressionBombWarning)
def fail(code):
    print(json.dumps({"ok":False,"error":{"code":code}},separators=(',',':')))
    sys.exit(0)
try:
    value = json.loads(sys.stdin.read(8388609))
    raw = base64.b64decode(value['base64'], validate=True)
    if len(raw) > 4194304: fail('IMAGE_INVALID')
    image = Image.open(io.BytesIO(raw), formats=['PNG','JPEG','WEBP'])
    kind = image.format
    if getattr(image, 'is_animated', False) or getattr(image, 'n_frames', 1) != 1: fail('IMAGE_ANIMATED')
    w, h = image.size
    if not (1 <= w <= 4096 and 1 <= h <= 4096 and w*h <= 16000000): fail('IMAGE_DIMENSIONS_INVALID')
    image.verify()
    image = Image.open(io.BytesIO(raw), formats=['PNG','JPEG','WEBP'])
    image.load()
    if value['operation'] == 'validate':
        image = ImageOps.exif_transpose(image)
        w,h = image.size
        data = {'width':w,'height':h,'mimeType':{'PNG':'image/png','JPEG':'image/jpeg','WEBP':'image/webp'}[kind]}
    else:
        image = ImageOps.exif_transpose(image).convert('RGBA')
        # A new pixel canvas drops EXIF, ICC, textual chunks and other uploaded metadata.
        source = Image.new('RGBA', image.size)
        source.paste(image, (0,0))
        if value['operation'] == 'crop':
            if (value['width'], value['height']) != source.size: fail('IMAGE_SOURCE_DIMENSIONS_CHANGED')
            roi = value['roi']
            x,y,w,h = roi['x'],roi['y'],roi['width'],roi['height']
            if not all(isinstance(v,int) and not isinstance(v,bool) for v in (x,y,w,h)) or x<0 or y<0 or w<1 or h<1 or x+w>source.width or y+h>source.height: fail('CROP_BOUNDS_INVALID')
            source = source.crop((x,y,x+w,y+h))
        elif value['operation'] == 'variant':
            w, h = value['width'], value['height']
            scale = min(w / source.width, h / source.height)
            if scale > 1 and not value['allowUpscale']: fail('UPSCALE_APPROVAL_REQUIRED')
            target = (max(1,min(w,round(source.width*scale))),max(1,min(h,round(source.height*scale))))
            resized = source.resize(target, Image.Resampling.LANCZOS)
            color = value['color']
            background = (0,0,0,0) if value['transparent'] else tuple(int(color[i:i+2],16) for i in (1,3,5))+(255,)
            source = Image.new('RGBA',(w,h),background)
            source.alpha_composite(resized,((w-target[0])//2,(h-target[1])//2))
        w,h = source.size
        output = io.BytesIO()
        source.save(output,format='PNG',compress_level=6)
        if output.tell() > 4194304: fail('IMAGE_OUTPUT_LIMIT')
        data = {'base64':base64.b64encode(output.getvalue()).decode('ascii'),'width':w,'height':h,'mimeType':'image/png'}
    print(json.dumps({'ok':True,'data':data},separators=(',',':')))
except (Image.DecompressionBombError, Image.DecompressionBombWarning): fail('IMAGE_DIMENSIONS_INVALID')
except Exception: fail('IMAGE_INVALID')
`;

/** Reject every link/junction below the trusted root, including links whose target remains inside it. */
async function safePath(rootPath: string, name: string, createParents: boolean): Promise<{ root: string; path: string; parent: string }> {
  const root = resolve(rootPath);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (await realpath(root)).toLowerCase() !== root.toLowerCase()) throw new IconImageFault("IMAGE_PATH_UNSAFE");
  const target = resolve(root, name);
  if (!contained(root, target) || target === root) throw new IconImageFault("IMAGE_PATH_UNSAFE");
  let current = root;
  const pieces = relative(root, target).split(sep);
  for (const part of pieces.slice(0, -1)) {
    current = join(current, part);
    if (createParents) { try { await mkdir(current); } catch (error) { if (code(error) !== "EEXIST") throw error; } }
    const entry = await lstat(current);
    if (!entry.isDirectory() || entry.isSymbolicLink() || !contained(root, await realpath(current))) throw new IconImageFault("IMAGE_PATH_UNSAFE");
  }
  try { const entry = await lstat(target); if (!entry.isFile() || entry.isSymbolicLink() || !contained(root, await realpath(target))) throw new IconImageFault("IMAGE_PATH_UNSAFE"); }
  catch (error) { if (code(error) !== "ENOENT") throw error; }
  return { root, path: target, parent: await realpath(dirname(target)) };
}
async function readSafe(root: string, name: string): Promise<Buffer> {
  const checked = await safePath(root, name, false), before = await lstat(checked.path);
  if (before.size > INPUT_LIMIT) throw new IconImageFault("IMAGE_INPUT_LIMIT", 400);
  const file = await open(checked.path, "r");
  try {
    const opened = await file.stat();
    if (!opened.isFile() || opened.size > INPUT_LIMIT || opened.dev !== before.dev || opened.ino !== before.ino) throw new IconImageFault("IMAGE_PATH_UNSAFE");
    const bytes = await file.readFile();
    const after = await safePath(root, name, false), current = await lstat(after.path);
    if (after.parent !== checked.parent || current.dev !== opened.dev || current.ino !== opened.ino || bytes.length > INPUT_LIMIT) throw new IconImageFault("IMAGE_PATH_UNSAFE");
    return bytes;
  } finally { await file.close(); }
}
async function persist(root: string, name: string, bytes: Buffer): Promise<boolean> {
  const checked = await safePath(root, name, true), expected = digest(bytes);
  try { const existing = await readSafe(root, name); if (digest(existing) !== expected) throw new IconImageFault("OVERWRITE_FORBIDDEN"); return false; }
  catch (error) { if (code(error) !== "ENOENT") throw error; }
  const temporary = join(dirname(checked.path), `.companion-image-${randomUUID()}.tmp`);
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(bytes); await file.sync(); await file.close();
    const beforeLink = await safePath(root, name, false);
    if (beforeLink.parent !== checked.parent) throw new IconImageFault("IMAGE_PATH_UNSAFE");
    try { await link(temporary, checked.path); }
    catch (error) {
      if (code(error) !== "EEXIST") throw error;
      if (digest(await readSafe(root, name)) !== expected) throw new IconImageFault("OVERWRITE_FORBIDDEN");
      return false;
    }
    if (digest(await readSafe(root, name)) !== expected) throw new IconImageFault("IMAGE_WRITE_UNCONFIRMED");
    return true;
  } finally {
    await file.close().catch(() => undefined);
    // Never unlink through a parent that has been replaced with a link/junction.
    try { if ((await safePath(root, name, false)).parent === checked.parent) await unlink(temporary); } catch { /* retain evidence on an unsafe path */ }
  }
}
function bytesFromBase64(value: string): Buffer {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length === 0 || bytes.length > INPUT_LIMIT || bytes.toString("base64") !== value) throw new IconImageFault("IMAGE_INPUT_LIMIT", 400);
  return bytes;
}
function pngBytes(value: z.infer<typeof pixels>): Buffer {
  const bytes = bytesFromBase64(value.base64);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    || bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR"
    || bytes.readUInt32BE(16) !== value.width || bytes.readUInt32BE(20) !== value.height || bytes[25] !== 6) throw new IconImageFault("IMAGE_RESULT_INVALID", 502);
  return bytes;
}
function validateProject(project: ProjectRecord) {
  if (!/^[a-f0-9]{16}$/.test(project.id) || !isAbsolute(project.path)) throw new IconImageFault("INVALID_INPUT", 400);
}
function originalExtension(bytes: Buffer): "png" | "jpg" | "webp" {
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP") return "webp";
  throw new IconImageFault("IMAGE_TYPE_UNSUPPORTED",400);
}
function cropIdentity(value: {sourceSha256:string;width:number;height:number;roi:z.infer<typeof cropRoi>}): string {
  return digest(Buffer.from(JSON.stringify({ sourceSha256: value.sourceSha256, width: value.width, height: value.height,
    roi: { x: value.roi.x, y: value.roi.y, width: value.roi.width, height: value.roi.height } })));
}
function variantReceipt(projectId:string, options:{sourceSha256:string;width:number;height:number;binding?:z.infer<typeof iconVariantBindingSchema>|undefined},relativePath:string,sha256:string,upscaled:boolean) {
  return {schemaVersion:options.binding?"companion-icon-variant-v2":"companion-icon-variant-v1",projectId,relativePath,sha256,sourceSha256:options.sourceSha256,
    width:options.width,height:options.height,upscaled,qualityLimit:upscaled?"Upscaling adds no new detail.":null,method:"Pillow LANCZOS contain",runtimeImported:false,
    ...(options.binding?{binding:options.binding}:{})};
}

/** Controlled local image assets. No model, network, Creator, credential or runtime import operations. */
export class IconImageAssets {
  private readonly runner: JsonRunner;
  constructor(private readonly options: IconImageAssetsOptions) { this.runner = options.runJson ?? runJsonProcess; }
  private async process(input: object, validating = false) {
    if (!isAbsolute(this.options.pythonPath)) throw new IconImageFault("IMAGE_PROCESSING_UNAVAILABLE", 503);
    const env: NodeJS.ProcessEnv = { PATH: dirname(this.options.pythonPath), PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1", OMP_NUM_THREADS: "1" };
    for (const key of ["SYSTEMROOT", "WINDIR", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
    let output: unknown;
    try { output = await this.runner({ executable: this.options.pythonPath, args: ["-I", "-B", "-X", "utf8", "-c", PILLOW_SCRIPT], env, timeoutMs: 15_000, maxBytes: PROCESS_LIMIT, input: JSON.stringify(input) }); }
    catch { throw new IconImageFault("IMAGE_PROCESSING_UNAVAILABLE", 503); }
    let outputBytes: number;
    try { outputBytes = Buffer.byteLength(JSON.stringify(output) ?? ""); } catch { throw new IconImageFault("IMAGE_RESULT_INVALID", 502); }
    if (outputBytes > PROCESS_LIMIT) throw new IconImageFault("IMAGE_OUTPUT_LIMIT");
    const failed = failure.safeParse(output); if (failed.success) throw new IconImageFault(failed.data.error.code, 400);
    const result = z.object({ ok: z.literal(true), data: validating ? metadata : pixels }).strict().safeParse(output);
    if (!result.success) throw new IconImageFault("IMAGE_RESULT_INVALID", 502);
    return result.data.data;
  }
  async uploadReference(project: ProjectRecord, input: z.input<typeof iconReferenceUploadSchema>): Promise<IconReferenceAsset> {
    validateProject(project);
    const parsed = iconReferenceUploadSchema.safeParse(input); if (!parsed.success) throw new IconImageFault("INVALID_INPUT", 400);
    const original = bytesFromBase64(parsed.data.base64), extension = originalExtension(original);
    const result = pixels.parse(await this.process({ operation: "normalize", base64: parsed.data.base64 }));
    const bytes = pngBytes(result), sha256 = digest(bytes), relativePath = `art/reference/companion/${sha256}.png`;
    const originalSha256 = digest(original), originalRelativePath = `art/reference/companion/original/${originalSha256}.${extension}`;
    await persist(project.path, originalRelativePath, original);
    await persist(project.path, relativePath, bytes);
    return { relativePath, sha256, width: result.width, height: result.height, mimeType: "image/png", originalRelativePath, originalSha256 };
  }
  async previewReference(project: ProjectRecord, input: z.input<typeof iconReferencePreviewSchema>): Promise<{base64:string;sha256:string;width:number;height:number;mimeType:"image/png"}> {
    validateProject(project);
    const parsed = iconReferencePreviewSchema.safeParse(input); if (!parsed.success) throw new IconImageFault("INVALID_INPUT",400);
    const original = await readSafe(project.path,parsed.data.relativePath);
    const result = pixels.parse(await this.process({operation:"normalize",base64:original.toString("base64")}));
    const normalized = pngBytes(result);
    return {base64:result.base64,sha256:digest(normalized),width:result.width,height:result.height,mimeType:"image/png"};
  }
  async cropReference(project: ProjectRecord, input: z.input<typeof iconReferenceCropSchema>): Promise<IconReferenceCropAsset> {
    validateProject(project);
    const parsed = iconReferenceCropSchema.safeParse(input); if (!parsed.success) throw new IconImageFault("INVALID_INPUT", 400);
    const options = parsed.data, original = bytesFromBase64(options.base64), extension = originalExtension(original);
    if (digest(original) !== options.sourceSha256) throw new IconImageFault("SOURCE_SHA_MISMATCH");
    const context = pixels.parse(await this.process({ operation: "normalize", base64: options.base64 }));
    if (context.width !== options.width || context.height !== options.height) throw new IconImageFault("IMAGE_SOURCE_DIMENSIONS_CHANGED", 400);
    const subject = pixels.parse(await this.process({ operation: "crop", base64: options.base64, width: options.width, height: options.height, roi: options.roi }));
    if (subject.width !== options.roi.width || subject.height !== options.roi.height) throw new IconImageFault("IMAGE_RESULT_INVALID", 502);
    const contextBytes = pngBytes(context), subjectBytes = pngBytes(subject), cropId = cropIdentity(options);
    const originalRelativePath = `art/reference/companion/original/${options.sourceSha256}.${extension}`;
    const contextSha = digest(contextBytes), subjectSha = digest(subjectBytes);
    const receipt = cropReceipt.parse({ schemaVersion: "companion-reference-crop-v1", projectId: project.id, cropId,
      sourceSha256: options.sourceSha256, width: context.width, height: context.height, roi: options.roi,
      coordinateSpace: "top-left-display-pixels-after-exif-transpose", modelConditioning: false,
      original: { relativePath: originalRelativePath, sha256: options.sourceSha256 },
      context: { relativePath: `art/reference/companion/${contextSha}.png`, sha256: contextSha, width: context.width, height: context.height },
      subject: { relativePath: `art/reference/companion/crops/${cropId}.png`, sha256: subjectSha, width: subject.width, height: subject.height } });
    const receiptRelativePath = `art/reference/companion/crops/${cropId}.json`, bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
    await persist(project.path, originalRelativePath, original);
    await persist(project.path, receipt.context.relativePath, contextBytes);
    await persist(project.path, receipt.subject.relativePath, subjectBytes);
    await persist(project.path, receiptRelativePath, bytes);
    await persist(this.options.storePath, `companion-reference-crop-receipts/${project.id}/${cropId}.json`, bytes);
    return { ...receipt, receiptRelativePath, receiptSha256: digest(bytes) };
  }
  async cropReferenceStatus(project: ProjectRecord, input: z.input<typeof iconReferenceCropStatusSchema>): Promise<
    { state: "available"; crop: IconReferenceCropAsset } | { state: "missing" | "unavailable"; cropId: string }> {
    validateProject(project);
    const parsed = iconReferenceCropStatusSchema.safeParse(input); if (!parsed.success) throw new IconImageFault("INVALID_INPUT", 400);
    const {cropId} = parsed.data, receiptRelativePath = `art/reference/companion/crops/${cropId}.json`;
    let bytes: Buffer;
    try { bytes = await readSafe(this.options.storePath, `companion-reference-crop-receipts/${project.id}/${cropId}.json`); }
    catch (error) { if (code(error) === "ENOENT") return { state: "missing", cropId }; return { state: "unavailable", cropId }; }
    try {
      const receipt = cropReceipt.parse(JSON.parse(bytes.toString("utf8")));
      if (receipt.projectId !== project.id || receipt.cropId !== cropId || cropIdentity(receipt) !== cropId
        || receipt.roi.x + receipt.roi.width > receipt.width || receipt.roi.y + receipt.roi.height > receipt.height
        || receipt.context.width !== receipt.width || receipt.context.height !== receipt.height
        || receipt.subject.width !== receipt.roi.width || receipt.subject.height !== receipt.roi.height
        || receipt.original.sha256 !== receipt.sourceSha256
        || !new RegExp(`^art/reference/companion/original/${receipt.sourceSha256}\\.(png|jpg|webp)$`).test(receipt.original.relativePath)
        || receipt.context.relativePath !== `art/reference/companion/${receipt.context.sha256}.png`
        || receipt.subject.relativePath !== `art/reference/companion/crops/${cropId}.png`
        || digest(await readSafe(project.path, receiptRelativePath)) !== digest(bytes)) throw new Error();
      for (const image of [receipt.original, receipt.context, receipt.subject]) if (digest(await readSafe(project.path,image.relativePath)) !== image.sha256) throw new Error();
      return { state: "available", crop: { ...receipt, receiptRelativePath, receiptSha256: digest(bytes) } };
    } catch { return { state: "unavailable", cropId }; }
  }
  async snapshotReferences(project: ProjectRecord, refs: string[]): Promise<IconReferenceSnapshot[]> {
    validateProject(project);
    if (!Array.isArray(refs) || refs.length > 4 || new Set(refs).size !== refs.length) throw new IconImageFault("INVALID_INPUT", 400);
    const snapshots: IconReferenceSnapshot[] = [];
    // Validate every reference before creating any immutable snapshot object.
    const prepared: { relativePath: string; sha256: string; bytes: Buffer }[] = [];
    for (const relativePath of refs) {
      if (!referencePath.safeParse(relativePath).success) throw new IconImageFault("IMAGE_PATH_UNSAFE", 400);
      const bytes = await readSafe(project.path, relativePath);
      await this.process({ operation: "validate", base64: bytes.toString("base64") }, true);
      prepared.push({ relativePath, sha256: digest(bytes), bytes });
    }
    for (const reference of prepared) {
      await persist(this.options.storePath, `companion-reference-snapshots/${reference.sha256}.png`, reference.bytes);
      snapshots.push({ relativePath: reference.relativePath, sha256: reference.sha256 });
    }
    return snapshots;
  }
  async exportVariant(project: ProjectRecord, input: z.input<typeof iconVariantExportSchema>): Promise<IconVariantAsset> {
    validateProject(project);
    const parsed = iconVariantExportSchema.safeParse(input); if (!parsed.success) throw new IconImageFault("INVALID_INPUT", 400);
    const options = parsed.data, source = bytesFromBase64(options.base64);
    if (digest(source) !== options.sourceSha256) throw new IconImageFault("SOURCE_SHA_MISMATCH");
    const sourceSize = metadata.parse(await this.process({ operation: "validate", base64: options.base64 }, true));
    const upscaled = Math.min(options.width / sourceSize.width, options.height / sourceSize.height) > 1;
    if (upscaled && !options.allowUpscale) throw new IconImageFault("UPSCALE_APPROVAL_REQUIRED");
    const result = pixels.parse(await this.process({ operation: "variant", base64: options.base64, width: options.width, height: options.height,
      transparent: options.transparent, color: options.color, allowUpscale: options.allowUpscale }));
    if (result.width !== options.width || result.height !== options.height) throw new IconImageFault("IMAGE_RESULT_INVALID", 502);
    const bytes = pngBytes(result), sha256 = digest(bytes);
    const relativePath = `${options.directory}/${options.assetId}-${options.width}x${options.height}-${options.sourceSha256.slice(0, 12)}.png`;
    const created = await persist(project.path, relativePath, bytes);
    const qualityLimit = upscaled ? "Upscaling adds no new detail." : null;
    const receipt = variantReceipt(project.id,options,relativePath,sha256,upscaled),receiptBytes=Buffer.from(JSON.stringify(receipt,null,2)+"\n");
    await persist(this.options.storePath, `companion-variant-receipts/${project.id}/${digest(Buffer.from(JSON.stringify(receipt)))}.json`, receiptBytes);
    return { relativePath, sha256, sourceSha256: options.sourceSha256, width: result.width, height: result.height, created, upscaled, qualityLimit,
      ...(options.binding?{receiptSha256:digest(receiptBytes)}:{}) };
  }
  async readVariant(project:ProjectRecord,input:{assetId:string;directory:string;sourceSha256:string;width:number;height:number;binding:z.infer<typeof iconVariantBindingSchema>}) {
    validateProject(project);
    const options=z.object({assetId:iconVariantExportSchema.shape.assetId,directory:outputDirectory,sourceSha256:sha,width:size,height:size,binding:iconVariantBindingSchema}).strict().safeParse(input);
    if(!options.success||input.width*input.height>MAX_PIXELS) throw new IconImageFault("INVALID_INPUT",400);
    const relativePath=`${input.directory}/${input.assetId}-${input.width}x${input.height}-${input.sourceSha256.slice(0,12)}.png`;
    try {
      const bytes=await readSafe(project.path,relativePath);pngBytes({base64:bytes.toString("base64"),width:input.width,height:input.height,mimeType:"image/png"});
      const sha256=digest(bytes),receipt=variantReceipt(project.id,input,relativePath,sha256,input.width>1024&&input.height>1024);
      const expected=Buffer.from(JSON.stringify(receipt,null,2)+"\n");
      const stored=await readSafe(this.options.storePath,`companion-variant-receipts/${project.id}/${digest(Buffer.from(JSON.stringify(receipt)))}.json`);
      if(!stored.equals(expected))throw new Error();
      return {relativePath,sha256,sourceSha256:input.sourceSha256,width:input.width,height:input.height,receiptSha256:digest(stored),receiptJson:stored.toString("utf8")};
    }catch{throw new IconImageFault("VARIANT_PROVENANCE_UNAVAILABLE");}
  }
  async previewVariant(project: ProjectRecord, input: Parameters<IconImageAssets["readVariant"]>[1]) {
    const checked = await this.readVariant(project, input);
    const bytes = await readSafe(project.path, checked.relativePath);
    if (digest(bytes) !== checked.sha256) throw new IconImageFault("VARIANT_PROVENANCE_UNAVAILABLE");
    const { receiptJson: _receiptJson, ...metadata } = checked;
    return { ...metadata, mimeType: "image/png" as const, base64: bytes.toString("base64") };
  }
}
