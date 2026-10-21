import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest'
import {testCrypto} from './fixtures/generation-png'
import {createAiJobsReadProvider} from '../src/adapters/ai-jobs-read'
import {verifyAiResourceSnapshotIntegrity} from '../src/domain/ai-resource-snapshot'
import {aiJobActionCanonical} from '../src/domain/ai-job-actions'
import {createPinia,setActivePinia} from 'pinia'
import {reactive} from 'vue'
import {resolveArtGenerationInput,type ProjectArtSpec} from '../src/domain/project-art-spec'
import {aiResourceSnapshotOutput,type AiArtResourceSnapshot} from '../src/domain/ai-resource-snapshot'
import {decodeAiJobSnapshot,type AiJobSnapshot} from '../src/domain/ai-jobs-read'
import {aiJobActionAllowed,aiVariantDestination,decodeAiJobActionResponse,validateAiJobActionSubmission,type AiJobActionSubmission} from '../src/domain/ai-job-actions'
import {createAiJobActionsState} from '../src/stores/ai-job-actions'
const id='0123456789abcdef',jobId='STUDIO-RUN-icon-art-0123abcd',candidateId='CANDIDATE-gem-1',head='a'.repeat(40),requestHash='b'.repeat(64)
function fixture(){
 const config:ProjectArtSpec={schemaVersion:'project-art-spec-v1',projectId:id,version:2,project:{name:'Test',content:'Owner art direction',engine:'cocos-creator',designResolution:{width:750,height:1334}},inheritance:{mode:'none',reason:'No applicable Canon'},overrides:{subject:'gem',purpose:'inventory',width:96,height:64,transparent:false,backgroundColor:'#112233',destination:'assets/art',exportDirectory:'art/final/test'},categories:{}}
 const asset=resolveArtGenerationInput(config,{assetId:'gem',category:'icon',prompt:'a blue gem',overrides:{},references:[]},[],{imageReferenceInput:false,categories:['icon']})
 const hash='d'.repeat(64),inputSha256='e'.repeat(64),visualSpec=`Project art v2 SHA256 ${hash}; resolved ${inputSha256}; text constraints only; image conditioning unsupported; requested dimensions/background are CPU export requirements.`
 const request={schemaVersion:'local-icon-requests-v1' as const,projectId:id,runId:jobId,sourceRevision:head,visualSpec,assets:[{assetId:'gem',relativePath:'assets/art/gem.png',prompt:asset.prompt+'\nProject art text constraints:\n'+Object.entries(asset.values).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+': '+v).join('\n'),purpose:'inventory',required:true}]}
 const sealed:AiArtResourceSnapshot={state:'sealed',kind:'project-art-spec',version:2,hash,presetId:'project-art',config,inputSha256,job:{projectId:id,jobId,sourceRevision:head,requestHash},request,freeze:{schemaVersion:'companion-project-art-input-v1',projectId:id,configHash:hash,configVersion:2,spec:config,productIdentity:null,sourceDocuments:[],capabilities:{imageReferenceInput:false,categories:['icon']},assets:[asset],readyForGeneration:true,inputSha256}}
 const job:AiJobSnapshot={projectId:id,jobId,revision:4,state:'selected',sourceRevision:head,requestHash,profile:'local-icon-v1',budget:{maxAssets:2,candidatesPerAsset:1,submissionAttempts:1},createdAt:'',assets:[{assetId:'gem',relativePath:'assets/art/gem.png'}],candidates:[{candidateId,assetId:'gem',fileSha256:'c'.repeat(64),width:1024,height:1024,hasAlpha:true}],selectedIds:[candidateId],import:null,workerResident:false,productionVerified:false,resourceSnapshot:sealed}
 return {sealed,job}
}
beforeEach(()=>{setActivePinia(createPinia());vi.stubGlobal('crypto',testCrypto)})
afterEach(()=>vi.unstubAllGlobals())
describe('new art sealed snapshot and downstream output union',()=>{
 it('preserves new schema, exact authoritative config hash and frozen text-only evidence rather than fabricating v2',()=>{
  const {sealed,job}=fixture(),decoded=decodeAiJobSnapshot(job,id)
  expect(decoded.resourceSnapshot).toEqual(sealed);expect(decoded.resourceSnapshot).not.toBe(sealed)
  expect(aiResourceSnapshotOutput(decoded.resourceSnapshot,'gem')).toEqual({width:96,height:64,directory:'assets/art',exportDirectory:'art/final/test',transparent:false,color:'#112233'})
  expect(aiResourceSnapshotOutput(decoded.resourceSnapshot,'foreign')).toBeNull()
 })
 it.each(['unknown','hash','version','job','requesthash','head','path','prompt','capabilities','source','usage','provenance','values','reference','product','inputsha','config'])('rejects incomplete or mismatched %s evidence',kind=>{
  const {sealed,job}=fixture(),s=sealed as any
  if(kind==='unknown')s.silentFallback=true
  if(kind==='hash')s.freeze.configHash='0'.repeat(64)
  if(kind==='version')s.freeze.configVersion++
  if(kind==='job')s.job.jobId='STUDIO-RUN-other-0123abcd'
  if(kind==='requesthash')s.job.requestHash='0'.repeat(64)
  if(kind==='head')s.request.sourceRevision='0'.repeat(40)
  if(kind==='path')s.request.assets[0].relativePath='assets/other/gem.png'
  if(kind==='prompt')s.request.assets[0].prompt+=' changed'
  if(kind==='capabilities')s.freeze.capabilities.imageReferenceInput=true
  if(kind==='source')s.freeze.sourceDocuments=[{source:{path:'P0001/rules.md',revision:head},documentSha256:'0'.repeat(64)}]
  if(kind==='usage')s.freeze.assets[0].usage='runtime'
  if(kind==='provenance')s.freeze.assets[0].provenance.width='secret-source'
  if(kind==='values')s.freeze.assets[0].values.width++
  if(kind==='reference')s.freeze.assets[0].references=['art/reference/missing.png']
  if(kind==='product')s.freeze.productIdentity={productId:'cook',uuid:'uuid',revision:head,packageSha256:'bad'}
  if(kind==='inputsha')s.freeze.inputSha256='0'.repeat(64)
  if(kind==='config')s.config.schemaVersion='project-resource-config-v2'
  expect(()=>decodeAiJobSnapshot(job,id)).toThrow()
 })
 it('exports and imports through original strict operation inputs with new configured target and receipt identity',()=>{
  const {job}=fixture();expect(aiJobActionAllowed('export-variant',job)).toBe(true)
  const submission:AiJobActionSubmission={operation:'export-variant',input:{jobId,revision:4,candidateId,width:96,height:64,allowUpscale:false,expectedTargetSha256:null,approved:true},snapshot:job,approved:true}
  const result=decodeAiJobActionResponse({schemaVersion:'companion-icons-v1',jobId,revision:4,candidateId,relativePath:'art/final/test/gem-96x64-'+ 'c'.repeat(12)+'.png',sha256:'f'.repeat(64),sourceSha256:'c'.repeat(64),width:96,height:64,created:true,upscaled:false,qualityLimit:null,receiptSha256:'1'.repeat(64)},id,submission)
  expect(result.kind).toBe('variant')
  const destination=aiVariantDestination(job,{candidateId,width:96,height:64,sha256:'f'.repeat(64)})
  expect(destination).toBe('db://assets/art/gem-96x64-'+ 'f'.repeat(12)+'.png')
  expect(validateAiJobActionSubmission(id,{operation:'import-variant',input:{jobId,revision:4,candidateId,width:96,height:64,destinationUrl:destination,expectedVariantSha256:'f'.repeat(64),expectedReceiptSha256:'1'.repeat(64),approved:true},snapshot:job,approved:true}).operation).toBe('import-variant')
 })
 it('store default export size comes from exact selected art asset and is not an old v2 fallback',()=>{
  const {job}=fixture(),reader={label:'fake reader',readStatus:vi.fn(),readJobs:vi.fn(),previewCandidate:vi.fn(),waitForIdle:async()=>undefined},provider={label:'fake writer',execute:vi.fn(),waitForIdle:async()=>undefined}
  const saved=new Map<string,string>(),store=reactive(createAiJobActionsState({storage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>{saved.set(k,v)}},coordinator:{async run(work){return {acquired:true,value:await work()}}}}))
  store.setContext({id,name:'test',path:'/isolated/test'},{},job,reader,provider)
  expect(store.prepare('export-variant')).toBe(true);expect(store.confirmation?.submission.input).toMatchObject({width:96,height:64});expect(provider.execute).not.toHaveBeenCalled()
 })
})

async function actualHashFixture(){
 const value=fixture(),s=value.sealed,{inputSha256,...body}=s.freeze
 const digest=async(v:unknown)=>Array.from(new Uint8Array(await testCrypto.subtle.digest('SHA-256',new TextEncoder().encode(aiJobActionCanonical(v)))),b=>b.toString(16).padStart(2,'0')).join('')
 const actual=await digest(body);s.inputSha256=actual;s.freeze.inputSha256=actual;s.request.visualSpec=s.request.visualSpec.replace(inputSha256,actual)
 s.job.requestHash=await digest(s.request);value.job.requestHash=s.job.requestHash
 return value
}
describe('browser-visible immutable capsule digest verification',()=>{
 it('hashes canonical freeze body and compiled Studio request independent of insertion key order',async()=>{
  const {sealed}=await actualHashFixture();await expect(verifyAiResourceSnapshotIntegrity(sealed)).resolves.toBeUndefined()
  const reordered=JSON.parse(JSON.stringify(sealed)) as AiArtResourceSnapshot
  reordered.request={...reordered.request,assets:reordered.request.assets.map(a=>({required:a.required,purpose:a.purpose,prompt:a.prompt,relativePath:a.relativePath,assetId:a.assetId}))}
  await expect(verifyAiResourceSnapshotIntegrity(reordered)).resolves.toBeUndefined()
  reordered.request.assets[0]!.prompt+=' changed';await expect(verifyAiResourceSnapshotIntegrity(reordered)).rejects.toThrow()
 })
 it('refuses changed freeze body or unavailable crypto without trusting a syntactically valid SHA',async()=>{
  const {sealed}=await actualHashFixture();sealed.freeze.productIdentity={productId:'cook',uuid:'id',revision:head,packageSha256:'1'.repeat(64)}
  await expect(verifyAiResourceSnapshotIntegrity(sealed)).rejects.toThrow()
  vi.stubGlobal('crypto',undefined);await expect(verifyAiResourceSnapshotIntegrity(sealed)).rejects.toThrow()
 })
 it('actual read provider validates digest and drains its status request before returning a usable snapshot',async()=>{
  const {job}=await actualHashFixture();const fetch=vi.fn(async()=>new Response(JSON.stringify({schemaVersion:'companion-icons-v1',job}),{headers:{'content-type':'application/json'}}))
  const provider=createAiJobsReadProvider({fetch});expect((await provider.readStatus(id,jobId)).resourceSnapshot).toMatchObject({kind:'project-art-spec'})
  await provider.waitForIdle?.();expect(fetch).toHaveBeenCalledTimes(1)
  job.requestHash='0'.repeat(64);if(job.resourceSnapshot?.state==='sealed'&&'kind'in job.resourceSnapshot)job.resourceSnapshot.job.requestHash=job.requestHash
  await expect(provider.readStatus(id,jobId)).rejects.toThrow();await provider.waitForIdle?.();expect(fetch).toHaveBeenCalledTimes(2)
 })
})
