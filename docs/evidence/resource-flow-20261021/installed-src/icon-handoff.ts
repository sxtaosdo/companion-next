import { z } from "zod";
const hash=z.string().regex(/^[a-f0-9]{64}$/), id=z.string().regex(/^[a-f0-9]{16}$/);
const reserved=/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const path=z.string().max(240).refine(v=>!v.includes("\\")&&!v.includes(":")&&!v.startsWith("/")
  &&v.split("/").every(p=>/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(p)&&p!==".."&&!p.endsWith(".")&&!reserved.test(p)));
const assetPath=path.refine(v=>/^assets\/.+\.png$/i.test(v));
const referencePath=path.refine(v=>/^(?:art\/reference|assets)\/.+\.(png|jpe?g|webp)$/i.test(v));
const cocosUrl=(extension:RegExp)=>z.string().max(260).refine(v=>v.startsWith("db://")&&assetPath.or(path.refine(p=>p.startsWith("assets/"))).safeParse(v.slice(5)).success&&extension.test(v));
const size=z.number().int().min(1).max(4096);
export const iconVariantBindingSchema=z.object({jobId:z.string().regex(/^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/),
  revision:z.number().int().positive(),candidateId:z.string().regex(/^CANDIDATE-[a-z0-9-]+-1$/),requestHash:hash,configHash:hash}).strict();
export const iconHandoffTargetSchema=z.object({destinationUrl:cocosUrl(/\.png$/i).nullable(),documentUrl:cocosUrl(/\.(scene|prefab)$/i).nullable(),
  nodeKey:z.string().trim().min(1).max(300).refine(v=>!/[\u0000-\u001f\u007f]/.test(v)).nullable()}).strict().refine(v=>v.nodeKey===null||v.documentUrl!==null);
export const iconHandoffInputSchema=z.object({...iconVariantBindingSchema.pick({jobId:true,revision:true,candidateId:true}).shape,
  artifact:z.discriminatedUnion("kind",[z.object({kind:z.literal("mother")}).strict(),z.object({kind:z.literal("variant"),width:size,height:size}).strict().refine(v=>v.width*v.height<=16_000_000)]),
  purpose:z.string().trim().min(1).max(400),target:iconHandoffTargetSchema}).strict();
const absentProof=z.object({state:z.literal("not_proven"),receiptSha256:z.null(),assetUuid:z.null(),spriteFrameUuid:z.null()}).strict();
const roi=z.object({x:z.number().int().nonnegative(),y:z.number().int().nonnegative(),width:size,height:size}).strict();
const crop=z.discriminatedUnion("state",[
  z.object({state:z.literal("available"),cropId:hash,originalSha256:hash,contextSha256:hash,subjectSha256:hash,receiptSha256:hash,roi,
    coordinateSpace:z.literal("top-left-display-pixels-after-exif-transpose")}).strict(),
  z.object({state:z.literal("unavailable"),cropId:hash}).strict()]);
export const iconHandoffSchema=z.object({
  schemaVersion:z.literal("companion-icon-handoff-v1"),projectId:id,sourceRevision:z.string().regex(/^[a-f0-9]{40}$/),purpose:z.string().min(1).max(400),
  job:z.object({...iconVariantBindingSchema.shape,state:z.string().max(80),configHash:hash.nullable(),configVersion:z.number().int().positive().nullable()}).strict(),
  asset:z.object({candidateId:z.string().regex(/^CANDIDATE-[a-z0-9-]+-1$/),assetId:z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(80),
    motherSha256:hash,kind:z.enum(["mother","variant"]),relativePath:path.refine(v=>v.startsWith("art/final/")).nullable(),sha256:hash,width:size,height:size,
    sha256Verified:z.literal(true),receiptSha256:hash.nullable(),savedCreatorDestination:assetPath}).strict(),
  resource:z.object({state:z.enum(["sealed","not_recorded","unavailable"]),designResolution:z.object({width:z.number().int().positive(),height:z.number().int().positive()}).strict().nullable(),
    iconSize:z.object({width:size,height:size}).strict().nullable(),referencesAsModelInput:z.literal(false)}).strict(),
  referenceProvenance:z.array(z.object({relativePath:referencePath,sha256:hash,crop:crop.nullable()}).strict()).max(4),
  target:iconHandoffTargetSchema.safeExtend({component:z.literal("cc.Sprite"),property:z.literal("spriteFrame")}),
  evidence:z.object({imported:absentProof,bound:absentProof,
    runtimeVerified:z.object({state:z.literal("not_run"),receiptSha256:z.null(),designResolutionVerified:z.literal(false)}).strict(),
    observedImport:z.object({operationId:z.string().regex(/^icon-import-[a-f0-9]{32}$/),state:z.string().max(80),effectApplied:z.union([z.boolean(),z.literal("UNKNOWN")]),
      leaseState:z.enum(["RELEASED","UNKNOWN","RETAINED"])}).strict().nullable(),
    manualAttestation:z.object({state:z.literal("manual_attested"),receiptSha256:hash,scope:z.literal("import_and_runtime_visibility")}).strict().nullable()}).strict(),
  delivery:z.object({mode:z.literal("export_or_copy"),state:z.literal("prepared"),dispatchId:z.null()}).strict(),
  receiver:z.object({freshProjectAndRevisionRequired:z.literal(true),freshCoordinationRequired:z.literal(true),writeAuthorizationIncluded:z.literal(false),
    unknownReplayAllowed:z.literal(false),importVerificationTools:z.tuple([z.literal("asset_get_info"),z.literal("asset_resolve_reference")]),
    bindingTools:z.tuple([z.literal("scene_apply_patch"),z.literal("prefab_apply_patch")]),runtimeIdentityProvider:z.null()}).strict()
}).strict().superRefine((v,c)=>{
  if(v.asset.candidateId!==v.job.candidateId||v.asset.width*v.asset.height>16_000_000
    ||v.asset.kind==="mother"&&(v.asset.relativePath!==null||v.asset.receiptSha256!==null||v.asset.sha256!==v.asset.motherSha256||v.asset.width!==1024||v.asset.height!==1024)
    ||v.asset.kind==="variant"&&(v.asset.relativePath===null||v.asset.receiptSha256===null||v.job.configHash===null))
    c.addIssue({code:"custom",message:"Handoff asset identity invalid"});
});
export type IconHandoff=z.infer<typeof iconHandoffSchema>;
export type IconHandoffInput=z.infer<typeof iconHandoffInputSchema>;

/** Packaging evidence grants no task dispatch, lease or replay authority. */
export function iconHandoffText(packet:IconHandoff):string {
  return "请先只读核对下方工程、原任务、素材哈希与目标。交接包没有派发确认或写入授权；UNKNOWN 操作禁止重放。"
    +"后续真实写入需取得当前协调租约和新 operationId；导入要核对 URL/SHA/资产与 SpriteFrame UUID，绑定要保存后回读，运行要核对设计分辨率及精确素材身份。编译或 Preview 启动不足以证明。\n\n"
    +JSON.stringify(iconHandoffSchema.parse(packet),null,2);
}
