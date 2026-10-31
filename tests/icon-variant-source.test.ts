import {describe,it,expect} from 'vitest'
import backendOutput from './fixtures/variant-backend-output'
import {mount} from '@vue/test-utils'
import {createPinia} from 'pinia'
import ElementPlus from 'element-plus'
import IconSceneBindingPanel from '../src/components/IconSceneBindingPanel.vue'
import {createIconSceneBindingProvider} from '../src/adapters/icon-scene-binding'
import {decodeIconHandoff} from '../src/domain/icon-handoff'
import {sceneBindingSourceFromPacket,ICON_SCENE_BINDING_PROJECT} from '../src/domain/icon-scene-binding'
import {handoffJob,handoffInput,handoffPacket} from './icon-handoff-fixture'
function fixture(){
 const job=handoffJob();job.projectId=ICON_SCENE_BINDING_PROJECT;job.revision=13; if(job.resourceSnapshot?.state==='sealed'&&job.resourceSnapshot.config.schemaVersion==='project-resource-config-v2')job.resourceSnapshot.config.projectId=job.projectId
 const input=handoffInput(job);input.artifact={kind:'variant',width:96,height:96}
 const packet=handoffPacket(input,job)
 job.variantImport={operationId:'icon-import-'+'1'.repeat(32),state:'imported_pending_verification',effectApplied:true,leaseState:'RELEASED',errorCode:null,tools:[],active:false,artifact:{kind:'variant',candidateId:input.candidateId,width:96,height:96,fileSha256:packet.asset.sha256,receiptSha256:packet.asset.receiptSha256!,destinationUrl:'db://assets/icons/gem-96.png'}}
 packet.asset.savedCreatorDestination='assets/icons/gem-96.png'
 packet.evidence.observedImport={operationId:job.variantImport.operationId,state:job.variantImport.state,effectApplied:true,leaseState:'RELEASED'}
 return {job,input,packet}
}
describe('completed variant handoff to scene source (isolated contract)',()=>{
 it('consumes actual backend fixture output through decoder, source and rendered panel without dispatch',()=>{
  const data:any=backendOutput
  const decoded=decodeIconHandoff(data.response.handoff,data.projectId,data.input,data.job)
  const source=sceneBindingSourceFromPacket(decoded,data.job)
  expect(source?.assetUrl).toBe(data.job.variantImport.artifact.destinationUrl)
  let calls=0;const provider=createIconSceneBindingProvider({fetch:async()=>{calls++;throw Error('No passive dispatch')},origin:'http://127.0.0.1:32180'})
  const wrapper=mount(IconSceneBindingPanel,{props:{project:{id:data.projectId,path:'/isolated/cross-boundary'},packet:decoded,job:data.job,provider,ready:true},global:{plugins:[createPinia(),ElementPlus]}})
  try{expect(wrapper.text()).toContain(source!.assetUrl);expect(wrapper.findAll('button').find(b=>b.text()==='读取真实场景')?.attributes('disabled')).toBeUndefined();expect(calls).toBe(0)}finally{wrapper.unmount()}
 })
 it('does not borrow mother import authority for an unimported variant planning packet',()=>{
  const {job,input,packet}=fixture();delete job.variantImport
  job.import={operationId:'icon-import-'+'2'.repeat(32),state:'imported_pending_verification',effectApplied:true,leaseState:'RELEASED',errorCode:null,tools:[]}
  packet.asset.savedCreatorDestination=job.assets[0]!.relativePath;packet.evidence.observedImport=null
  const decoded=decodeIconHandoff(packet,job.projectId,input,job)
  expect(sceneBindingSourceFromPacket(decoded,job)).toBeNull()
 })
 it('accepts inactive released variant at its own saved destination with mother import absent',()=>{
  const {job,input,packet}=fixture();expect(job.import).toBeNull()
  const decoded=decodeIconHandoff(JSON.parse(JSON.stringify(packet)),job.projectId,input,job)
  expect(sceneBindingSourceFromPacket(decoded,job)).toMatchObject({revision:13,assetUrl:'db://assets/icons/gem-96.png',assetSha256:packet.asset.sha256,artifact:{kind:'variant',width:96,height:96}})
  expect(job.variantImport!.active).toBe(false);expect(decoded.evidence.imported).toMatchObject({state:'not_proven'})
 })
 it.each(['active','unknown-effect','false-effect','retained','unknown-lease','state','operation','mother-observation','missing-observation','destination','artifact-destination','candidate','hash','receipt','width','height','mother-hash','config','revision','request','source-revision','asset-id'] as const)('rejects %s without granting scene source',kind=>{
  const {job,input,packet}=fixture(),v=job.variantImport!,a=v.artifact!
  if(kind==='active')v.active=true
  if(kind==='unknown-effect')v.effectApplied='UNKNOWN'
  if(kind==='false-effect')v.effectApplied=false
  if(kind==='retained')v.leaseState='RETAINED'
  if(kind==='unknown-lease')v.leaseState='UNKNOWN'
  if(kind==='state')v.state='import_unknown'
  if(kind==='operation')(packet.evidence.observedImport as any).operationId='icon-import-'+'2'.repeat(32)
  if(kind==='mother-observation'){job.import={...v,operationId:'icon-import-'+'2'.repeat(32)};packet.evidence.observedImport={operationId:job.import.operationId,state:job.import.state,effectApplied:true,leaseState:'RELEASED'}}
  if(kind==='missing-observation')packet.evidence.observedImport=null
  if(kind==='destination')packet.asset.savedCreatorDestination=job.assets[0]!.relativePath
  if(kind==='artifact-destination')a.destinationUrl='db://assets/icons/other.png'
  if(kind==='candidate')a.candidateId='CANDIDATE-other-1'
  if(kind==='hash')a.fileSha256='8'.repeat(64)
  if(kind==='receipt')a.receiptSha256='8'.repeat(64)
  if(kind==='width')a.width=128
  if(kind==='height')a.height=128
  if(kind==='mother-hash')packet.asset.motherSha256='8'.repeat(64)
  if(kind==='config')packet.job.configHash='8'.repeat(64)
  if(kind==='revision')packet.job.revision++
  if(kind==='request')packet.job.requestHash='8'.repeat(64)
  if(kind==='source-revision')packet.sourceRevision='8'.repeat(40)
  if(kind==='asset-id')packet.asset.assetId='other'
  expect(()=>decodeIconHandoff(packet,job.projectId,input,job)).toThrow()
  expect(sceneBindingSourceFromPacket(packet,job)).toBeNull()
 })
 it('keeps user supplied target separate from durable imported source',()=>{
  const {job,input,packet}=fixture();input.target.destinationUrl=packet.target.destinationUrl='db://assets/user-request.png'
  const decoded=decodeIconHandoff(packet,job.projectId,input,job)
  expect(sceneBindingSourceFromPacket(decoded,job)?.assetUrl).toBe('db://assets/icons/gem-96.png')
 })
})
