export interface WorkflowRegisteredProject {id:string;name:string;path:string}
export interface WorkflowRegistrationProject extends WorkflowRegisteredProject {purpose:'workflow'}
export interface WorkflowRegistrationSnapshot {schemaVersion:'workflow-registration-snapshot-v1';revision:string;projects:WorkflowRegistrationProject[]}
export interface WorkflowRegistrationInput {operationId:string;path:string;purpose:'workflow';expectedRegistryRevision:string;approved:true}
export interface WorkflowRegistrationResult {schemaVersion:'workflow-project-registration-result-v1';operationId:string;purpose:'workflow';state:'registered'|'rejected'|'unknown'|'not-observed';project:WorkflowRegistrationProject|null;registryRevision:string|null;effect:'created'|'existing'|'none'|'unconfirmed';git:{headDigest:string;indexDigest:string;dirtyDigest:string;digest:string}|null;code?:string}
export interface WorkflowProjectRegistrationProvider {
 snapshot():Promise<WorkflowRegistrationSnapshot>;
 legacyProjects():Promise<WorkflowRegisteredProject[]>;
 register(input:WorkflowRegistrationInput):Promise<WorkflowRegistrationResult>;
 status(operationId:string):Promise<WorkflowRegistrationResult>;
 reconcile(operationId:string):Promise<WorkflowRegistrationResult>;
}
export class WorkflowRegistrationRequestError extends Error {
 constructor(readonly outcome:'rejected'|'unknown',readonly code:string){super(code);this.name='WorkflowRegistrationRequestError'}
}
const digest=/^[a-f0-9]{64}$/,operation=/^workflow-register-[a-f0-9]{32}$/;
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('登记回执无效');return value as Record<string,unknown>};
export function workflowProjectPathKey(value:string){return value.replace(/\\/g,'/').replace(/\/+$/,'').toLocaleLowerCase('en-US')}
export function validateWorkflowProjectPath(value:unknown):asserts value is string {
 if(typeof value!=='string'||value.length>4096||value!==value.trim()||/[\u0000-\u001f\u007f]/.test(value)||/^[A-Za-z]:[\\/]*$/.test(value)||/^\/+$/ .test(value)||!(/^[A-Za-z]:[\\/]/.test(value)||value.startsWith('/'))||value.split(/[\\/]/).some(part=>part==='.'||part==='..'))throw new Error('请填写已有开发工程的绝对路径。');
}
function project(value:unknown,workflow=false):WorkflowRegisteredProject {
 const row=object(value);if(typeof row.id!=='string'||!/^[a-f0-9]{16}$/.test(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>256||workflow&&row.purpose!=='workflow')throw new Error('工程登记回执无效');
 validateWorkflowProjectPath(row.path);return {id:row.id,name:row.name,path:row.path};
}
export function decodeWorkflowRegistrationSnapshot(value:unknown):WorkflowRegistrationSnapshot {
 const v=object(value);if(v.schemaVersion!=='workflow-registration-snapshot-v1'||typeof v.revision!=='string'||!digest.test(v.revision)||!Array.isArray(v.projects)||v.projects.length>1000)throw new Error('工作流登记快照无效');
 const projects=v.projects.map(row=>({...project(row,true),purpose:'workflow' as const}));
 if(new Set(projects.map(row=>row.id)).size!==projects.length||new Set(projects.map(row=>workflowProjectPathKey(row.path))).size!==projects.length)throw new Error('工作流登记包含重复工程');
 return {schemaVersion:'workflow-registration-snapshot-v1',revision:v.revision,projects};
}
export function validateWorkflowRegistrationInput(value:unknown):asserts value is WorkflowRegistrationInput {
 const v=object(value);if(Object.keys(v).sort().join(',')!=='approved,expectedRegistryRevision,operationId,path,purpose'||typeof v.operationId!=='string'||!operation.test(v.operationId)||v.purpose!=='workflow'||v.approved!==true||typeof v.expectedRegistryRevision!=='string'||!digest.test(v.expectedRegistryRevision))throw new Error('工作流登记输入无效');validateWorkflowProjectPath(v.path);
}
export function decodeWorkflowRegistrationResult(value:unknown,operationId:string):WorkflowRegistrationResult {
 const v=object(value);if(!operation.test(operationId)||v.schemaVersion!=='workflow-project-registration-result-v1'||v.operationId!==operationId||v.purpose!=='workflow'||!['registered','rejected','unknown','not-observed'].includes(String(v.state))||!['created','existing','none','unconfirmed'].includes(String(v.effect))||v.registryRevision!==null&&(typeof v.registryRevision!=='string'||!digest.test(v.registryRevision))||v.code!==undefined&&(typeof v.code!=='string'||!/^[A-Z][A-Z0-9_]{1,119}$/.test(v.code)))throw new Error('工作流登记原操作回执不匹配');
 const registered=v.project===null?null:{...project(v.project,true),purpose:'workflow' as const};let git:WorkflowRegistrationResult['git']=null;
 if(v.git!==null){const g=object(v.git);if(!['headDigest','indexDigest','dirtyDigest','digest'].every(key=>typeof g[key]==='string'&&digest.test(g[key] as string)))throw new Error('登记Git身份无效');git={headDigest:g.headDigest as string,indexDigest:g.indexDigest as string,dirtyDigest:g.dirtyDigest as string,digest:g.digest as string}}
 if(v.state==='registered'&&(!registered||!git||v.registryRevision===null||!['created','existing'].includes(String(v.effect))))throw new Error('登记成功证据不完整');
 if(v.state==='rejected'&&v.effect!=='none'||v.state==='not-observed'&&(v.project!==null||v.effect!=='none'))throw new Error('登记结果与副作用状态矛盾');
 return {schemaVersion:'workflow-project-registration-result-v1',operationId,purpose:'workflow',state:v.state as WorkflowRegistrationResult['state'],project:registered,registryRevision:v.registryRevision as string|null,effect:v.effect as WorkflowRegistrationResult['effect'],git,...(v.code?{code:v.code as string}:{})};
}
/** UI cookie/Origin authorization stays on the existing same-origin host.
 * Legacy /api/projects is GET-only here. No Creator setup or replay channel. */
export function createWorkflowProjectRegistrationProvider(fetcher:typeof fetch=globalThis.fetch):WorkflowProjectRegistrationProvider {
 const base='/api/workflow/projects';
 async function request(method:'GET'|'POST',url:string,body?:unknown){
  let reply:Response;try{reply=await fetcher(url,{method,credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})}catch{throw new WorkflowRegistrationRequestError('unknown','WORKFLOW_REGISTRATION_TRANSPORT_UNCONFIRMED')}
  const raw=await reply.text();if(raw.length>512*1024)throw new WorkflowRegistrationRequestError('unknown','WORKFLOW_REGISTRATION_RESPONSE_LIMIT');
  let value:unknown;try{value=JSON.parse(raw)}catch{throw new WorkflowRegistrationRequestError('unknown','WORKFLOW_REGISTRATION_RESPONSE_INVALID')}
  if(reply.redirected)throw new WorkflowRegistrationRequestError('unknown','WORKFLOW_REGISTRATION_REDIRECTED');
  if(!reply.ok){const v=object(value);if(v.outcome==='rejected'&&typeof v.code==='string'&&/^[A-Z][A-Z0-9_]{1,119}$/.test(v.code))throw new WorkflowRegistrationRequestError('rejected',v.code);if(v.schemaVersion!=='workflow-project-registration-result-v1')throw new WorkflowRegistrationRequestError('unknown','WORKFLOW_REGISTRATION_HTTP_'+reply.status)}
  return value;
 }
 const opPath=(operationId:string)=>{if(!operation.test(operationId))throw new Error('原登记操作ID无效');return base+'/operations/'+operationId};
 return {
  async snapshot(){return decodeWorkflowRegistrationSnapshot(await request('GET',base))},
  async legacyProjects(){const value=await request('GET','/api/projects');if(!Array.isArray(value)||value.length>1000)throw new Error('原工程列表无效');return value.map(row=>project(row))},
  async register(input){validateWorkflowRegistrationInput(input);return decodeWorkflowRegistrationResult(await request('POST',base,input),input.operationId)},
  async status(operationId){return decodeWorkflowRegistrationResult(await request('GET',opPath(operationId)),operationId)},
  async reconcile(operationId){return decodeWorkflowRegistrationResult(await request('POST',opPath(operationId)+'/reconcile',{approved:true}),operationId)},
 };
}
