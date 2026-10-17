import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import AiJobsReadPanel from '../src/components/AiJobsReadPanel.vue'
import { decodeAiJobSnapshot } from '../src/domain/ai-jobs-read'
import type { AiJobSnapshot, AiJobVariantImport, AiJobsReadProvider } from '../src/domain/ai-jobs-read'
import { AI_JOB_ACTIONS, aiJobActionAllowed, validateAiJobActionSubmission } from '../src/domain/ai-job-actions'
import { createAiJobsReadProvider } from '../src/adapters/ai-jobs-read'
import { aiJobActionsProvider } from '../src/ai-job-actions-integration'
const projectId='0123456789abcdef',jobId='STUDIO-RUN-variant-demo-0123abcd',candidateId='CANDIDATE-pouch-1'
function variant(): AiJobVariantImport { return { operationId:`icon-import-${'d'.repeat(32)}`, state:'imported_pending_verification',effectApplied:true,leaseState:'RELEASED',errorCode:null,tools:[],active:false,
  artifact:{kind:'variant',candidateId,width:96,height:96,fileSha256:'e'.repeat(64),receiptSha256:'f'.repeat(64),destinationUrl:'db://assets/art/pouch.png'} } }
function job(): AiJobSnapshot { return {projectId,jobId,revision:6,state:'selected',sourceRevision:'a'.repeat(40),requestHash:'b'.repeat(64),profile:'local-icon-v1',budget:{maxAssets:2,candidatesPerAsset:1,submissionAttempts:1},createdAt:'2026-10-17T01:00:00Z',assets:[{assetId:'pouch',relativePath:'assets/art/pouch.png'}],candidates:[{candidateId,assetId:'pouch',fileSha256:'c'.repeat(64),width:1024,height:1024,hasAlpha:true}],selectedIds:[candidateId],import:null,variantImport:variant(),workerResident:false,productionVerified:false} }
afterEach(()=>{aiJobActionsProvider.value=null;vi.restoreAllMocks()})
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
      expect(section.text()).toContain('96 × 96');expect(section.text()).toContain('变体 PNG 预览待接口接入');expect(section.text()).toContain(variant().artifact!.fileSha256)
      expect(wrapper.text()).toContain('productionVerified：false');expect(wrapper.findAll('button').some(button=>/导入所选母图|导出.*变体|确认导入/.test(button.text()))).toBe(false)
      expect(execute).not.toHaveBeenCalled();expect(reader.previewCandidate).not.toHaveBeenCalled();expect(wrapper.find('img').exists()).toBe(false)
    }finally{wrapper.unmount()}
  })
})
