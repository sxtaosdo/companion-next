import {artEndpoint,artPath} from './project-art-pending'
import {resourceDomainSuffix} from './art-resource-domains'
import type {ProjectArtSpec} from './project-art-spec'
import type {ProjectArtSpecContext,ProjectArtSpecProvider} from '../project-art-spec-integration'

type DraftRecord={schemaVersion:'project-art-draft-v1';projectId:string;projectPath:string;resourceDomainId?:string;endpoint:string;baseHash:string|null;draft:ProjectArtSpec}
const key=(context:ProjectArtSpecContext,provider:ProjectArtSpecProvider)=>'project-art-draft-v1:'+encodeURIComponent(artEndpoint(provider))+':'+context.projectId+':'+encodeURIComponent(artPath(context.projectPath))+resourceDomainSuffix(context.resourceDomainId)

export function readArtDraft(context:ProjectArtSpecContext,provider:ProjectArtSpecProvider):{record:DraftRecord;raw:string}|null {
 const raw=window.localStorage.getItem(key(context,provider));if(!raw)return null
 if(raw.length>512*1024)throw Error('invalid draft')
 const value=JSON.parse(raw) as DraftRecord
 if(value.schemaVersion!=='project-art-draft-v1'||value.endpoint!==artEndpoint(provider)||value.projectId!==context.projectId||artPath(value.projectPath)!==artPath(context.projectPath)||value.resourceDomainId!==context.resourceDomainId||value.baseHash!==null&&!/^[a-f0-9]{64}$/.test(value.baseHash)||!value.draft||value.draft.projectId!==context.projectId||value.draft.resourceDomainId!==context.resourceDomainId||!value.draft.project||!value.draft.inheritance||!value.draft.overrides||!value.draft.categories)throw Error('invalid draft')
 return {record:value,raw}
}
export function writeArtDraft(context:ProjectArtSpecContext,provider:ProjectArtSpecProvider,baseHash:string|null,draft:ProjectArtSpec,expected:string|null) {
 const record:DraftRecord={schemaVersion:'project-art-draft-v1',projectId:context.projectId,projectPath:context.projectPath,...(context.resourceDomainId?{resourceDomainId:context.resourceDomainId}:{}),endpoint:artEndpoint(provider),baseHash,draft}
 const raw=JSON.stringify(record);if(raw.length>512*1024)throw Error('draft too large')
 if(window.localStorage.getItem(key(context,provider))!==expected)throw Error('draft changed elsewhere')
 window.localStorage.setItem(key(context,provider),raw)
 if(window.localStorage.getItem(key(context,provider))!==raw)throw Error('draft not stored')
 return raw
}
export function clearArtDraft(context:ProjectArtSpecContext,provider:ProjectArtSpecProvider,expected:string|null){
 if(expected===null)return true
 if(window.localStorage.getItem(key(context,provider))!==expected)return false
 window.localStorage.removeItem(key(context,provider));return true
}
