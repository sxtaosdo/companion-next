import { assertPlan, exportResourcePlan, planningCounts, PLAN_JSON_LIMIT_BYTES } from './resource-planning'
import type { ResourcePlan } from './resource-planning'
import { validateSpec } from './spec'
import { GENERATION_SOURCES } from './generation-source'
export const MAX_PLAN_IMPORT_BYTES = PLAN_JSON_LIMIT_BYTES
function record(input:unknown,keys:string[],label:string):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error(`${label}须为对象`)
 const value=input as Record<string,unknown>
 if(Object.keys(value).some((key)=>!keys.includes(key))||keys.some((key)=>!(key in value)))throw new Error(`${label}字段不完整或包含未知字段`)
 return value
}
function bounded(value:unknown,max:number,label:string,empty=false):void{if(typeof value!=='string'||value.length>max||(!empty&&!value.trim())||/[\u0000-\u001f\u007f]/u.test(value))throw new Error(`${label}文本无效`)}
function identifier(value:unknown,label:string):void{if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value))throw new Error(`${label}标识无效`)}
function enumeration(value:unknown,allowed:readonly unknown[],label:string):void{if(!allowed.includes(value))throw new Error(`${label}状态无效`)}
function list(value:unknown,max:number,label:string):unknown[]{if(!Array.isArray(value)||value.length>max)throw new Error(`${label}数量或结构无效`);return value}
function dimensions(value:unknown):void{const d=record(value,['width','height'],'尺寸');for(const field of ['width','height'])if(typeof d[field]!=='number'||!Number.isInteger(d[field])||d[field]<16||d[field]>8192)throw new Error('尺寸须为16–8192整数')}
/** Strict external input boundary. No URLs, paths, job payloads or extra keys accepted. */
export function parseResourcePlan(input:string):ResourcePlan{
 if(new TextEncoder().encode(input).byteLength>MAX_PLAN_IMPORT_BYTES)throw new Error('导入文件超过 512 KiB 上限')
 let raw:unknown;try{raw=JSON.parse(input)}catch{throw new Error('导入内容不是有效 JSON')}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('导入内容须为计划对象')
 const root=raw as Record<string,unknown>
 const baseKeys=['schemaVersion','kind','id','createdAt','scope','binding','status','requirements','batches','execution','generationSource']
 if(Object.keys(root).some((key)=>![...baseKeys,'disclaimer','plannedCounts'].includes(key)))throw new Error('计划包含未知字段')
 // Earlier schema-1 exports lack source selection. Missing means unselected, never a live default.
 const p=record(Object.fromEntries(baseKeys.map((key)=>[key,key==='generationSource'&&!Object.prototype.hasOwnProperty.call(root,key)?'unselected':root[key]])),baseKeys,'计划')
 enumeration(p.generationSource,GENERATION_SOURCES,'生成来源')
 enumeration(p.schemaVersion,[1],'schema');enumeration(p.kind,['companion-resource-plan'],'类型');enumeration(p.status,['draft'],'计划')
 identifier(p.id,'计划');bounded(p.createdAt,24,'时间')
 if(typeof p.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.createdAt)||!Number.isFinite(Date.parse(p.createdAt))||new Date(p.createdAt).toISOString()!==p.createdAt)throw new Error('创建时间无效')
 const scope=record(p.scope,['mode','projectId','projectName','storage'],'项目范围')
 enumeration(scope.mode,['demo','live'],'数据模式');identifier(scope.projectId,'项目');bounded(scope.projectName,160,'项目名称');enumeration(scope.storage,['browser-memory-and-json-export'],'存储')
 const binding=record(p.binding,['id','specVersion','styleReference','source','snapshot'],'规范绑定')
 identifier(binding.id,'规范绑定');bounded(binding.specVersion,60,'规范版本');bounded(binding.styleReference,100,'风格引用');enumeration(binding.source,['local-draft','read-only'],'规范来源')
 if(validateSpec(binding.snapshot).length)throw new Error('规范快照不满足完整 schema')
 const execution=record(p.execution,['submittedTasks','generatedAssets','importedAssets','boundAssets','runtimeChecks'],'执行计数')
 if(Object.values(execution).some((value)=>value!==0))throw new Error('导入计划不能包含真实执行计数')
 const requirementNames=new Set<string>()
 for(const entry of list(p.requirements,200,'需求')){
  const r=record(entry,['id','projectId','specBindingId','name','category','purpose','page','priority','defaultSize','format','transparent','ownerProtected','derivatives','status','generated','acceptanceNotes','acceptance'],'需求')
  for(const key of ['id','projectId','specBindingId'])identifier(r[key],key)
  bounded(r.name,100,'需求名称');bounded(r.page,160,'页面');bounded(r.purpose,200,'用途');bounded(r.acceptanceNotes,500,'补充验收',true)
  const nameKey=JSON.stringify([r.page,r.name]);if(requirementNames.has(nameKey))throw new Error('同页面需求名称重复');requirementNames.add(nameKey)
  enumeration(r.category,['图标','按钮','面板','角色','背景','特效','字体'],'类别');enumeration(r.priority,['normal','high'],'优先级');dimensions(r.defaultSize)
  enumeration(r.format,['png'],'格式');enumeration(r.transparent,[true,false],'透明');enumeration(r.ownerProtected,[true,false],'保护');enumeration(r.generated,[false],'生成');enumeration(r.status,['planned','owner-protected'],'需求')
  for(const item of list(r.derivatives,8,'派生')){const d=record(item,['width','height','method','sourceRequirementId','additionalInferenceCount'],'派生');dimensions({width:d.width,height:d.height});identifier(d.sourceRequirementId,'母图');enumeration(d.method,['resize-approved-master'],'派生方式');enumeration(d.additionalInferenceCount,[0],'额外推理')}
  for(const item of list(r.acceptance,8,'验收')){const a=record(item,['id','phase','description','state'],'验收条件');bounded(a.id,20,'验收ID');enumeration(a.phase,['technical','visual','delivery'],'验收阶段');bounded(a.description,500,'验收说明');enumeration(a.state,['not-checked'],'验收结果')}
 }
 const batchIds=new Set<string>()
 for(const entry of list(p.batches,50,'批次')){
  const b=record(entry,['id','name','projectId','specBindingId','requirementIds','queuePolicy','status','approval'],'批次')
  for(const key of ['id','projectId','specBindingId'])identifier(b[key],key)
  if(batchIds.has(b.id as string))throw new Error('批次 ID 重复');batchIds.add(b.id as string)
  bounded(b.name,100,'批次名称');enumeration(b.queuePolicy,['serial'],'队列');enumeration(b.status,['not-submitted'],'提交');enumeration(b.approval,['not-approved'],'批准')
  for(const rid of list(b.requirementIds,32,'批次需求'))identifier(rid,'批次需求')
 }
 const plan=p as unknown as ResourcePlan
 assertPlan(plan)
 if(root.disclaimer!==undefined)bounded(root.disclaimer,1000,'声明')
 if(root.plannedCounts!==undefined){const expected=planningCounts(plan);const values=record(root.plannedCounts,Object.keys(expected),'计划统计');if(Object.keys(expected).some((key)=>values[key]!==expected[key as keyof typeof expected]))throw new Error('导入统计与需求 / 批次不一致')}
 exportResourcePlan(plan) // Reject compact inputs that exceed canonical export budget.
 return JSON.parse(JSON.stringify(plan)) as ResourcePlan
}
