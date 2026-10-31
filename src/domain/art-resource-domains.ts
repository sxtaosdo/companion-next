/** Resource domains are declared by the host, never inferred from a path or a label. */
export interface ResourceDomainContext { resourceDomainId?:string }
export interface ResourceDomainDescriptor {id:string;name:string;exists:boolean;configured:boolean;binding:null;directoriesStatus:'unconfigured'}
export interface ResourceDomainCatalog {projectId:string;projectPath:string;domains:ResourceDomainDescriptor[];legacy:{readOnly:boolean;hasConfig:boolean;hasWorkbench:boolean};projectSettingsHash:string|null}
export function validResourceDomainId(value:unknown):value is string{return typeof value==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(value)&&value!=='legacy'}
export function sameResourceDomain(a:ResourceDomainContext,b:ResourceDomainContext){return a.resourceDomainId===b.resourceDomainId}
export function resourceDomainSuffix(id:string|undefined){if(id===undefined)return '';if(!validResourceDomainId(id))throw Error('无效资源域');return ':domain:'+id}
export function resourceDomainRoute(projectId:string,domainId?:string){if(!/^[a-f0-9]{16}$/.test(projectId))throw Error('无效工程');if(domainId!==undefined&&!validResourceDomainId(domainId))throw Error('无效资源域');return '/api/art-spec/'+projectId+(domainId===undefined?'':'/domains/'+domainId)}
export function checkResourceDomainIdentity(actual:ResourceDomainContext,expected:ResourceDomainContext){if(!sameResourceDomain(actual,expected))throw Error('资源域回执不匹配')}
