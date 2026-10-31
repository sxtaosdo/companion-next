// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest'
import {flushPromises,mount} from '@vue/test-utils'
import AntSlotBindingPanel from '../src/components/AntSlotBindingPanel.vue'
import {ANT_SLOT_PROJECT,ANT_SLOT_PREFAB,ANT_SLOT_NODE} from '../src/domain/ant-slot-binding'
import type { AiJobSnapshot } from '../src/domain/ai-jobs-read'
const src={jobId:'STUDIO-RUN-workbench-test-abcdef12',revision:1,candidateId:'CANDIDATE-test-1',requestHash:'a'.repeat(64),assetSha256:'b'.repeat(64),assetUrl:'db://assets/Colony/art/toy-market/ui/companion-ant-toolbar-v01/slot.png',artifact:{kind:'variant',width:160,height:160}}
vi.mock('../src/domain/ant-slot-binding',async original=>({...await original(),antSlotSource:()=>src}))
const reply=(action:string,state:string,extra:object={})=>({schemaVersion:'ant-slot-binding-v1',projectId:ANT_SLOT_PROJECT,action,prefabUrl:ANT_SLOT_PREFAB,nodePath:ANT_SLOT_NODE,observedAt:'2026-10-29T00:00:00Z',state,revision:'r1',nodeKey:'node',currentSpriteFrameUuid:'688dee04-46bf-411e-9507-6db25532cb5b@f9941',pngUuid:'png',spriteFrameUuid:'new',...extra})
const artifact={kind:'variant' as const,candidateId:src.candidateId,width:160,height:160,fileSha256:src.assetSha256,receiptSha256:'c'.repeat(64),destinationUrl:src.assetUrl}
const job={projectId:ANT_SLOT_PROJECT,jobId:src.jobId,revision:1,requestHash:src.requestHash,sourceRevision:'d'.repeat(40),variantImport:{operationId:'icon-import-'+'1'.repeat(32),artifact}} as AiJobSnapshot
const variantVerification={projectId:job.projectId,jobId:job.jobId,revision:job.revision,requestHash:job.requestHash,sourceRevision:job.sourceRevision,operationId:job.variantImport!.operationId,artifact}
const props={project:{id:ANT_SLOT_PROJECT,path:'project'},packet:null,job,active:true,ready:true,variantVerification}
const response=(v:unknown)=>({ok:true,json:async()=>v})
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('ant slot original operation',()=>{
 it('does not expose binding without proof for the same operation and artifact',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);wrapper=mount(AntSlotBindingPanel,{props:{...props,variantVerification:null}})
  expect(wrapper.find('button').attributes('disabled')).toBeDefined();await wrapper.find('button').trigger('click');expect(fetcher).not.toHaveBeenCalled()
  await wrapper.setProps({variantVerification:{...variantVerification,operationId:'icon-import-'+'2'.repeat(32)}});expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  await wrapper.setProps({variantVerification});expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
 })
 it('stores before dispatch and resolves uncertain bind only by querying same request',async()=>{
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_key:string,_options:unknown,fn:any)=>fn({name:'exclusive'})}})
  const fetcher=vi.fn().mockImplementationOnce(async()=>response(reply('inspect','ready'))).mockImplementationOnce(async(_url)=>{expect(localStorage.getItem('companion-ant-slot-original-v1')).toContain('"action":"bind"');throw Error('lost')}).mockImplementationOnce(async(_url,options)=>{const original=JSON.parse(options.body).original;return response(reply('status','applied',{operationId:original.operationId,operationStatus:'SUCCEEDED',terminalReceiptId:'receipt',saved:true,revision:'r2',currentSpriteFrameUuid:'new'}))})
  vi.stubGlobal('fetch',fetcher);wrapper=mount(AntSlotBindingPanel,{props})
  await wrapper.find('button').trigger('click');await flushPromises();await wrapper.get('input').setValue(true);await wrapper.findAll('button').find(x=>x.text()==='应用到扩充槽位')!.trigger('click');await flushPromises()
  expect(wrapper.text()).toContain('结果尚未确认');expect(localStorage.getItem('companion-ant-slot-original-v1')).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(2)
  await wrapper.findAll('button').find(x=>x.text()==='查询原操作结果')!.trigger('click');await flushPromises();expect(wrapper.text()).toContain('已应用并保存');expect(localStorage.getItem('companion-ant-slot-original-v1')).toBeNull();expect(fetcher).toHaveBeenCalledTimes(3)
 })
 it('never calls backend when browser cannot safely lock original operation',async()=>{
  Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});const fetcher=vi.fn().mockResolvedValue(response(reply('inspect','ready')));vi.stubGlobal('fetch',fetcher);wrapper=mount(AntSlotBindingPanel,{props});await wrapper.find('button').trigger('click');await flushPromises();await wrapper.get('input').setValue(true);await wrapper.findAll('button').find(x=>x.text()==='应用到扩充槽位')!.trigger('click');expect(wrapper.text()).toContain('无法安全锁定');expect(fetcher).toHaveBeenCalledTimes(1)
 })
})
