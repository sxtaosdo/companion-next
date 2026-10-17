import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import AiJobsReadPanel from '../src/components/AiJobsReadPanel.vue'
import { decodeAiJobSnapshot } from '../src/domain/ai-jobs-read'
import type { AiJobSnapshot, AiJobVariantImport, AiJobsReadProvider, AiVariantPreview } from '../src/domain/ai-jobs-read'
import { AI_JOB_ACTIONS, aiJobActionAllowed, validateAiJobActionSubmission } from '../src/domain/ai-job-actions'
import { createAiJobsReadProvider } from '../src/adapters/ai-jobs-read'
import { aiJobActionsProvider } from '../src/ai-job-actions-integration'
import { testCrypto } from './fixtures/generation-png'
import { reactive } from 'vue'
import { createAiJobsReadState } from '../src/stores/ai-jobs-read'
const projectId='0123456789abcdef',jobId='STUDIO-RUN-variant-demo-0123abcd',candidateId='CANDIDATE-pouch-1'
function variant(): AiJobVariantImport { return { operationId:`icon-import-${'d'.repeat(32)}`, state:'imported_pending_verification',effectApplied:true,leaseState:'RELEASED',errorCode:null,tools:[],active:false,
  artifact:{kind:'variant',candidateId,width:96,height:96,fileSha256:'e'.repeat(64),receiptSha256:'f'.repeat(64),destinationUrl:'db://assets/art/pouch.png'} } }
function job(): AiJobSnapshot { return {projectId,jobId,revision:6,state:'selected',sourceRevision:'a'.repeat(40),requestHash:'b'.repeat(64),profile:'local-icon-v1',budget:{maxAssets:2,candidatesPerAsset:1,submissionAttempts:1},createdAt:'2026-10-17T01:00:00Z',assets:[{assetId:'pouch',relativePath:'assets/art/pouch.png'}],candidates:[{candidateId,assetId:'pouch',fileSha256:'c'.repeat(64),width:1024,height:1024,hasAlpha:true}],selectedIds:[candidateId],import:null,variantImport:variant(),workerResident:false,productionVerified:false} }
afterEach(()=>{aiJobActionsProvider.value=null;vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('deployed independent variant-import contract',()=>{
  it('preserves the variant without changing the selected mother task or production boundary',()=>{
    const checked=decodeAiJobSnapshot(job(),projectId)
    expect(checked.variantImport).toEqual(variant());expect(checked.state).toBe('selected');expect(checked.import).toBeNull();expect(checked.productionVerified).toBe(false)
    expect(()=>decodeAiJobSnapshot({...job(),productionVerified:true},projectId)).toThrow()
  })
  it.each([
    {active:'false'}, {artifact:{...variant().artifact,width:0}}, {artifact:{...variant().artifact,height:4097}},
    {artifact:{...variant().artifact,fileSha256:'bad'}},{artifact:{...variant().artifact,receiptSha256:'bad'}},
    {artifact:{...variant().artifact,candidateId:'CANDIDATE-other-1'}},
    ...['db://assets/../pouch.png','db://assets/%2e%2e/pouch.png','file:///tmp/pouch.png','https://external/pouch.png','db://assets/art/pouch.png?x'].map(destinationUrl=>({artifact:{...variant().artifact,destinationUrl}})),
  ])('rejects malformed or foreign artifact metadata: %o',change=>expect(()=>decodeAiJobSnapshot({...job(),variantImport:{...variant(),...change}},projectId)).toThrow())
  it('retains explicit UNKNOWN and tolerates an absent artifact without inventing metadata',()=>{
    const value=variant();delete value.artifact;value.effectApplied='UNKNOWN';value.state='import_unknown';value.leaseState='UNKNOWN';value.active=true
    const checked=decodeAiJobSnapshot({...job(),variantImport:value},projectId)
    expect(checked.variantImport).toEqual(value);expect(checked.variantImport?.artifact).toBeUndefined()
  })
  it('preserves valid dotted names accepted by the original backend',()=>{
    const value=job();value.variantImport!.artifact!.destinationUrl='db://assets/art.v2/pouch.v2.png'
    expect(decodeAiJobSnapshot(value,projectId).variantImport?.artifact?.destinationUrl).toBe('db://assets/art.v2/pouch.v2.png')
  })
  it('blocks every write on an already bound variant, even though its mother remains selected',()=>{
    for(const operation of AI_JOB_ACTIONS)expect(aiJobActionAllowed(operation,job())).toBe(false)
    expect(()=>validateAiJobActionSubmission(projectId,{operation:'import',input:{jobId,revision:6,approved:true},snapshot:job(),approved:true})).toThrow()
    const original=job();delete original.variantImport;expect(aiJobActionAllowed('import',original)).toBe(true)
  })
  it('keeps stale task fields but blocks all writes even without a variant record',()=>{
    const value=job();delete value.variantImport;value.historyOnly={reason:'SOURCE_REVISION_CHANGED',currentSourceRevision:'d'.repeat(40)}
    const checked=decodeAiJobSnapshot(value,projectId);expect(checked.state).toBe('selected');expect(checked.sourceRevision).toBe('a'.repeat(40));expect(checked.historyOnly).toEqual(value.historyOnly)
    for(const op of AI_JOB_ACTIONS)expect(aiJobActionAllowed(op,checked)).toBe(false)
    expect(()=>decodeAiJobSnapshot({...value,historyOnly:{...value.historyOnly,currentSourceRevision:value.sourceRevision}},projectId)).toThrow()
  })
  it('uses the original status endpoint and preserves its variant snapshot',async()=>{
    const fetch=vi.fn(async()=>new Response(JSON.stringify({schemaVersion:'companion-icons-v1',job:job()}),{headers:{'content-type':'application/json'}}))
    const reader=createAiJobsReadProvider({fetch});expect((await reader.readStatus(projectId,jobId)).variantImport).toEqual(variant())
    expect(fetch.mock.calls[0]).toEqual([`/api/icons/${projectId}/status`,expect.objectContaining({method:'POST',body:JSON.stringify({jobId}),credentials:'same-origin'})])
  })
  it('reports a real revision mismatch as failure instead of an empty or completed history',async()=>{
    const fetch=vi.fn(async()=>new Response(JSON.stringify({error:'REVISION_MISMATCH',code:'REVISION_MISMATCH',retryable:false}),{status:409,headers:{'content-type':'application/json'}}))
    await expect(createAiJobsReadProvider({fetch}).readJobs(projectId)).rejects.toMatchObject({code:'http-error',backendCode:'REVISION_MISMATCH',status:409})
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('renders the 96px receipt and labels unavailable PNG preview without dispatching a write',async()=>{
    const reader:AiJobsReadProvider={label:'synthetic read fixture',readJobs:vi.fn<AiJobsReadProvider['readJobs']>(async()=>({schemaVersion:'companion-icons-v1',projectId,sourceRevision:'a'.repeat(40),jobs:[job()],profile:{id:'local-icon-v1',...job().budget},schedulerEnabled:false,workerResident:false})),readStatus:vi.fn(async()=>job()),previewCandidate:vi.fn()}
    const execute=vi.fn();aiJobActionsProvider.value={label:'unused',execute,waitForIdle:async()=>{}}
    const wrapper=mount(AiJobsReadPanel,{props:{project:{id:projectId,name:'Fixture',path:'/synthetic/fixture'},source:{},provider:reader,workflowStep:5},global:{plugins:[createPinia(),ElementPlus]}})
    try{
      await wrapper.findAll('button').find(button=>button.text().includes('读取 / 刷新任务'))!.trigger('click');await flushPromises()
      wrapper.getComponent({name:'ElSelect'}).vm.$emit('update:modelValue',jobId);await flushPromises()
      const section=wrapper.get('[data-testid="job-variant-import"]')
      expect(section.text()).toContain('96 × 96');expect(section.text()).toContain('当前构建未接入变体图像读取');expect(section.text()).toContain(variant().artifact!.fileSha256)
      expect(wrapper.text()).toContain('productionVerified：false');expect(wrapper.findAll('button').some(button=>/导入所选母图|导出.*变体|确认导入/.test(button.text()))).toBe(false)
      expect(execute).not.toHaveBeenCalled();expect(reader.previewCandidate).not.toHaveBeenCalled();expect(wrapper.find('img').exists()).toBe(false)
    }finally{wrapper.unmount()}
  })
})

async function png96(){
  const name='node:zlib', {deflateSync}=await import(name) as {deflateSync:(bytes:Uint8Array)=>Uint8Array}
  const crc=(bytes:Uint8Array)=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0}
  const chunk=(type:string,data:Uint8Array)=>{const b=new Uint8Array(data.length+12),v=new DataView(b.buffer);v.setUint32(0,data.length);b.set([...type].map(c=>c.charCodeAt(0)),4);b.set(data,8);v.setUint32(b.length-4,crc(b.subarray(4,b.length-4)));return b}
  const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,96);view.setUint32(4,96);header.set([8,6,0,0,0],8)
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(new Uint8Array((96*4+1)*96))),chunk('IEND',new Uint8Array())]
  const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let cursor=0;for(const p of parts){bytes.set(p,cursor);cursor+=p.length}
  const hash=Array.from(new Uint8Array(await testCrypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
  return {base64:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')),sha256:hash}
}
describe('bounded receipt-bound variant PNG client read',()=>{
  async function sample(){vi.stubGlobal('crypto',testCrypto);const image=await png96(),value=job();value.variantImport!.artifact!.fileSha256=image.sha256;value.historyOnly={reason:'SOURCE_REVISION_CHANGED',currentSourceRevision:'d'.repeat(40)};return {image,value,body:{schemaVersion:'companion-icons-v1',projectId,jobId,operationId:value.variantImport!.operationId,preview:{candidateId,...image,sourceSha256:value.candidates[0]!.fileSha256,receiptSha256:value.variantImport!.artifact!.receiptSha256,width:96,height:96,mimeType:'image/png'}}}}
  it('reads only exact original operation metadata and verifies 96px PNG bytes',async()=>{
    const f=await sample(),fetch=vi.fn(async()=>new Response(JSON.stringify(f.body),{headers:{'content-type':'application/json'}})),reader=createAiJobsReadProvider({fetch})
    expect(await reader.previewVariant!(projectId,f.value)).toMatchObject({operationId:f.value.variantImport!.operationId,width:96,height:96,sha256:f.image.sha256,receiptSha256:f.value.variantImport!.artifact!.receiptSha256})
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/icons/${projectId}/variant-preview`,expect.objectContaining({method:'POST',body:JSON.stringify({jobId,operationId:f.value.variantImport!.operationId}),credentials:'same-origin'}))
  })
  it.each(['operation','receipt','dimensions','source','hash'])('rejects changed %s without displaying a PNG',async fault=>{
    const f=await sample();if(fault==='operation')f.body.operationId=`icon-import-${'e'.repeat(32)}`
    if(fault==='receipt')f.body.preview.receiptSha256='e'.repeat(64);if(fault==='dimensions')f.body.preview.width=1024
    if(fault==='source')f.body.preview.sourceSha256='e'.repeat(64);if(fault==='hash')f.body.preview.sha256='e'.repeat(64)
    const reader=createAiJobsReadProvider({fetch:async()=>new Response(JSON.stringify(f.body),{headers:{'content-type':'application/json'}})})
    await expect(reader.previewVariant!(projectId,f.value)).rejects.toMatchObject({code:'invalid-shape'})
  })
  it('renders a verified variant separately while stale mother preview and all writes stay blocked',async()=>{
    const f=await sample(),transport=createAiJobsReadProvider({fetch:async()=>new Response(JSON.stringify(f.body),{headers:{'content-type':'application/json'}})})
    const reader:AiJobsReadProvider={label:'synthetic PNG read',readJobs:vi.fn<AiJobsReadProvider['readJobs']>(async()=>({schemaVersion:'companion-icons-v1',projectId,sourceRevision:'d'.repeat(40),jobs:[f.value],profile:{id:'local-icon-v1',...f.value.budget},schedulerEnabled:false,workerResident:false})),readStatus:vi.fn(async()=>f.value),previewCandidate:vi.fn(),previewVariant:transport.previewVariant}
    const wrapper=mount(AiJobsReadPanel,{props:{project:{id:projectId,name:'Synthetic',path:'/synthetic'},source:{},provider:reader,workflowStep:6},global:{plugins:[createPinia(),ElementPlus]}})
    try{
      await wrapper.findAll('button').find(b=>b.text().includes('读取 / 刷新任务'))!.trigger('click');await flushPromises();wrapper.getComponent({name:'ElSelect'}).vm.$emit('update:modelValue',jobId);await flushPromises()
      expect(wrapper.text()).toContain('历史任务 · 只读');expect(wrapper.findAll('button').find(b=>b.text()==='预览此候选')!.attributes('disabled')).toBeDefined()
      await wrapper.findAll('button').find(b=>b.text()==='预览此变体')!.trigger('click');await vi.waitFor(()=>expect(wrapper.find('[data-testid="variant-png-preview"] img').exists()).toBe(true))
      expect(wrapper.get('[data-testid="variant-png-preview"] img').attributes('src')).toBe(`data:image/png;base64,${f.image.base64}`)
      expect(reader.previewCandidate).not.toHaveBeenCalled();expect(wrapper.text()).toContain('96 × 96')
    }finally{wrapper.unmount()}
  })
  it('aborts and ignores a late variant read after switching registered project',async()=>{
    const f=await sample(),state=reactive(createAiJobsReadState()),source={},transport=createAiJobsReadProvider({fetch:async()=>new Response(JSON.stringify(f.body),{headers:{'content-type':'application/json'}})})
    let finish!:(value:AiVariantPreview)=>void,signal:AbortSignal|undefined
    const reader:AiJobsReadProvider={label:'synthetic',readJobs:vi.fn<AiJobsReadProvider['readJobs']>(async()=>({schemaVersion:'companion-icons-v1',projectId,sourceRevision:'d'.repeat(40),jobs:[f.value],profile:{id:'local-icon-v1',...f.value.budget},schedulerEnabled:false,workerResident:false})),readStatus:vi.fn(),previewCandidate:vi.fn(),previewVariant:vi.fn<NonNullable<AiJobsReadProvider['previewVariant']>>((_project,_job,next)=>{signal=next;return new Promise<AiVariantPreview>(resolve=>{finish=resolve})})}
    state.setContext({id:projectId,name:'A',path:'/A'},source);await state.readJobs(reader);state.selectJob(jobId);const pending=state.readVariantPreview()
    state.setContext({id:'fedcba9876543210',name:'B',path:'/B'},source);expect(signal?.aborted).toBe(true)
    finish(await transport.previewVariant!(projectId,f.value));await pending;expect(state.variantPreview).toBeNull();expect(state.selectedJobId).toBe('')
  })
})
