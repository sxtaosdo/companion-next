import {afterEach,expect,it,vi} from 'vitest'
import {webcrypto} from 'node:crypto'
import {reactive} from 'vue'
import {mount,flushPromises} from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Management from '../src/components/workflow-operation/WorkflowManagement.vue'
import Panel from '../src/components/workflow-operation/WorkflowOperationPanel.vue'
import {WorkflowCommandError} from '../src/components/workflow-operation/workflow-operation'
import {validateRecord} from '../src/components/workflow-operation/workflow-operation-http'
import type {WorkflowOperationRecord,WorkflowStage} from '../src/components/workflow-operation/workflow-operation'
const digest='a'.repeat(64)
const record=(id='goal-a'):WorkflowOperationRecord=>({schemaVersion:'workflow-operation-v1',id,revision:1,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',goal:{source:'gsd',ref:'goal',digest,version:'1'},plan:{source:'openspec',ref:'plan',digest,version:'1'},state:'review',review:null,activeRunId:null,runs:[],management:{revision:0,trashedAt:null,stages:[]},presentation:{title:id,planText:'计划'}})
const memory=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v)},removeItem:(k:string)=>{m.delete(k)}}}
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.unstubAllGlobals();vi.restoreAllMocks()})
it('uses one paged goal table, preserves selected detail when paging, and creates in a centered dialog',async()=>{
 vi.stubGlobal('crypto',webcrypto);const rows=Array.from({length:15},(_,i)=>record('goal-'+String(i).padStart(2,'0'))),provider={list:async()=>rows} as never
 wrapper=mount(Panel,{attachTo:document.body,props:{provider,section:'goals',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises()
 expect(wrapper.findAll('[aria-label="工作流目标列表"] table tbody tr')).toHaveLength(10)
 await wrapper.get('[aria-label="工作流目标列表"] tbody button').trigger('click');await flushPromises();expect(wrapper.get('[data-testid="record-workflow-id"]').text()).toBe('goal-00')
 await wrapper.get('.el-pagination .btn-next').trigger('click');await flushPromises();expect(wrapper.findAll('[aria-label="工作流目标列表"] table tbody tr')).toHaveLength(5);expect(wrapper.get('[data-testid="record-workflow-id"]').text()).toBe('goal-00')
 await wrapper.setProps({section:'goals'});await flushPromises();await wrapper.findAll('button').find(b=>b.text()==='新建目标')!.trigger('click');await flushPromises();expect(document.querySelector('.el-dialog.is-align-center,[aria-modal="true"]')).not.toBeNull();expect(document.querySelector('form[aria-label="新建目标"]')).not.toBeNull()
})
it('loads reactive stage records, keeps old bindings and moves a current task between stages',async()=>{
 vi.stubGlobal('crypto',webcrypto);const r=record();r.management!.stages=[{id:'old',title:'第一阶段',outcome:'一\n二',taskRefs:[{planDigest:'b'.repeat(64),taskId:'legacy'}]},{id:'new',title:'第二阶段',outcome:'',taskRefs:[]}]
 const rows=reactive([r]),updateStages=vi.fn(async(_id:string,input:{stages:WorkflowStage[]})=>({...r,management:{revision:1,trashedAt:null,stages:input.stages}}))
 const provider={updateStages,readReadiness:async()=>({workflowId:r.id,planDigest:digest,tasks:[{id:'task-a',text:'任务 A',digest,artifactDigest:digest,requiredDependencies:[]} ]})} as never
 wrapper=mount(Management,{props:{provider,records:rows,selectedId:r.id,selectedIds:[],trashView:false,storage:memory(),busy:false},global:{plugins:[ElementPlus]}});await flushPromises();expect(wrapper.text()).toContain('旧计划绑定，待确认');expect(wrapper.text()).toContain('暂无当前计划任务')
 await wrapper.findAll('button').find(b=>b.text()==='读取当前计划任务')!.trigger('click');await flushPromises();expect(wrapper.text()).toContain('未分阶段')
 const boxes=wrapper.findAll('input[type="checkbox"]');await boxes[0]!.setValue(true);await boxes[1]!.setValue(true)
 await wrapper.findAll('button').find(b=>b.text()==='保存阶段')!.trigger('click');await flushPromises();expect(updateStages).toHaveBeenCalledOnce();const stages=updateStages.mock.calls[0]![1].stages;expect(stages[0]!.taskRefs.some(x=>x.taskId==='task-a')).toBe(false);expect(stages[1]!.taskRefs).toContainEqual({planDigest:digest,taskId:'task-a'});expect(stages[0]!.outcome).toBe('一\n二')
})
it('preserves an unsaved stage draft across refresh and task switching, using the original revision',async()=>{
 vi.stubGlobal('crypto',webcrypto);const first=record(),second=record('goal-b');first.management={revision:2,trashedAt:null,stages:[{id:'stage',title:'原阶段',outcome:'',taskRefs:[]}]};const rows=reactive([first,second]),updateStages=vi.fn().mockRejectedValue(new WorkflowCommandError('rejected','conflict'))
 wrapper=mount(Management,{props:{provider:{updateStages} as never,records:rows,selectedId:first.id,selectedIds:[],trashView:false,storage:memory(),busy:false},global:{plugins:[ElementPlus]}});await flushPromises()
 await wrapper.get('input[maxlength="200"]').setValue('未保存草稿');rows[0]!.management!.revision=3;rows[0]!.management!.stages[0]!.title='其他页面更新';await flushPromises();expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe('未保存草稿');expect(wrapper.text()).toContain('草稿保留')
 await wrapper.setProps({selectedId:second.id});await wrapper.setProps({selectedId:first.id});await flushPromises();expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe('未保存草稿')
 await wrapper.findAll('button').find(b=>b.text()==='保存阶段')!.trigger('click');await flushPromises();expect(updateStages.mock.calls[0]![1].expectedRevision).toBe(2);expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe('未保存草稿')
 await wrapper.findAll('button').find(b=>b.text()==='放弃草稿并加载最新阶段')!.trigger('click');expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe('其他页面更新')
})
it('keeps an interrupted trash request locked when not observed and reconciles only the original operation',async()=>{
 vi.stubGlobal('crypto',webcrypto);const r=record(),storage=memory(),trashGoal=vi.fn().mockRejectedValue(new WorkflowCommandError('unknown','lost')),getOperation=vi.fn().mockImplementationOnce(async(operationId:string)=>({workflowId:r.id,operationId,state:'not-observed'}))
 const provider={trashGoal,getOperation} as never
 wrapper=mount(Management,{props:{provider,records:[r],selectedId:r.id,selectedIds:[r.id],trashView:false,storage,busy:false},global:{plugins:[ElementPlus]}});await flushPromises()
 await wrapper.findAll('button').find(b=>b.text()==='移入回收站')!.trigger('click');await flushPromises();expect(trashGoal).toHaveBeenCalledOnce();expect(wrapper.text()).toContain('结果待核对')
 const operationId=trashGoal.mock.calls[0]![1].operationId;getOperation.mockResolvedValueOnce({workflowId:r.id,operationId,state:'settled',record:{...r,management:{revision:1,trashedAt:'2026-01-01T00:00:00.000Z',stages:[]}}})
 await wrapper.findAll('button').find(b=>b.text()==='查询原请求')!.trigger('click');await flushPromises();expect(wrapper.text()).toContain('仍未确认');expect(trashGoal).toHaveBeenCalledOnce()
 await wrapper.findAll('button').find(b=>b.text()==='查询原请求')!.trigger('click');await flushPromises();expect(getOperation).toHaveBeenLastCalledWith(operationId,r.id);expect(wrapper.emitted('record')).toHaveLength(1);expect(trashGoal).toHaveBeenCalledOnce()
})
it('accepts a settled original request even when another tab has since updated the record',async()=>{
 vi.stubGlobal('crypto',webcrypto);const r=record(),storage=memory(),trashGoal=vi.fn().mockRejectedValue(new WorkflowCommandError('unknown','lost'))
 const getOperation=vi.fn(async(operationId:string)=>({workflowId:r.id,operationId,state:'settled',record:{...r,management:{revision:2,trashedAt:null,stages:[]}}}))
 wrapper=mount(Management,{props:{provider:{trashGoal,getOperation} as never,records:[r],selectedId:r.id,selectedIds:[r.id],trashView:false,storage,busy:false},global:{plugins:[ElementPlus]}});await flushPromises()
 await wrapper.findAll('button').find(b=>b.text()==='移入回收站')!.trigger('click');await flushPromises()
 await wrapper.findAll('button').find(b=>b.text()==='查询原请求')!.trigger('click');await flushPromises();expect(wrapper.text()).toContain('原请求已完成，当前记录有更新');expect(wrapper.emitted('record')).toHaveLength(1);expect(trashGoal).toHaveBeenCalledOnce()
})
it('continues interrupted purge using the exact original operation and revision',async()=>{
 vi.stubGlobal('crypto',webcrypto);const r=record();r.management={revision:4,trashedAt:'2026-01-01T00:00:00.000Z',stages:[{id:'phase',title:'阶段',outcome:'',taskRefs:[]}]};const storage=memory(),purgeGoal=vi.fn().mockRejectedValueOnce(new WorkflowCommandError('unknown','lost')).mockImplementationOnce(async(id:string,input:{operationId:string})=>({workflowId:id,purged:true,operationId:input.operationId}))
 wrapper=mount(Management,{attachTo:document.body,props:{provider:{purgeGoal} as never,records:[r],selectedId:r.id,selectedIds:[r.id],trashView:true,storage,busy:false},global:{plugins:[ElementPlus]}});await flushPromises()
 await wrapper.findAll('button').find(b=>b.text()==='永久删除')!.trigger('click');await flushPromises();expect(document.body.textContent).toContain('goal-a');expect(document.body.textContent).toContain('1 个阶段')
 Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('确认永久删除'))!.click();await flushPromises();expect(purgeGoal).toHaveBeenCalledOnce()
 await wrapper.findAll('button').find(b=>b.text()==='继续原管理请求')!.trigger('click');await flushPromises();expect(purgeGoal).toHaveBeenCalledTimes(2);expect(purgeGoal.mock.calls[1]).toEqual(purgeGoal.mock.calls[0]);expect(wrapper.emitted('purged')).toEqual([[r.id]])
})
it.each(['stages','trash','restore'] as const)('continues an interrupted %s with its original input and ID',async(kind)=>{
 const r=record(),storage=memory(),op='11111111-1111-4111-8111-111111111111',stages=[{id:'phase',title:'阶段',outcome:'',taskRefs:[]}],saved={id:r.id,kind,operationId:op,expectedRevision:2,...(kind==='stages'?{stages}:{})};storage.setItem('companion.workflow-management.pending.v1',JSON.stringify(saved))
 const returned={...r,management:{revision:3,trashedAt:kind==='trash'?'2026-01-01T00:00:00.000Z':null,stages:kind==='stages'?stages:[]}},call=vi.fn(async()=>returned),provider={updateStages:call,trashGoal:call,restoreGoal:call}
 wrapper=mount(Management,{props:{provider:provider as never,records:[r],selectedId:r.id,selectedIds:[],trashView:false,storage,busy:false},global:{plugins:[ElementPlus]}});await flushPromises()
 await wrapper.findAll('button').find(b=>b.text()==='继续原管理请求')!.trigger('click');await flushPromises();expect(call).toHaveBeenCalledOnce();expect(call.mock.calls[0]).toEqual([r.id,{operationId:op,expectedRevision:2,...(kind==='stages'?{stages}:{})}]);expect(wrapper.emitted('record')).toHaveLength(1)
})
it('accepts legacy records and validates management dates and stages',()=>{
 const r={...record(),capability:'task-directory-workspace-write' as const};delete r.management;expect(validateRecord(r).management).toBeUndefined()
 expect(validateRecord({...r,management:{revision:0,trashedAt:null,stages:[{id:'x',title:'阶段',outcome:'可换行\n第二行',taskRefs:[]}]}}).management?.stages).toHaveLength(1)
 expect(()=>validateRecord({...r,management:{revision:-1,trashedAt:null,stages:[]}})).toThrow()
})
it.each(['read','continue'] as const)('clears only a proven un-applied interrupted stage request through %s and retains the draft',async method=>{
 vi.stubGlobal('crypto',webcrypto);const r=record(),storage=memory(),stages=[{id:'phase',title:'保留草稿',outcome:'',taskRefs:[]}],operationId='11111111-1111-4111-8111-111111111111';storage.setItem('companion.workflow-management.pending.v1',JSON.stringify({id:r.id,kind:'stages',operationId,expectedRevision:0,stages}));const getOperation=vi.fn(async()=>({workflowId:r.id,operationId,state:'rejected',outcome:'not-applied',code:'MANAGEMENT_NOT_APPLIED_RECORD_CHANGED'})),updateStages=vi.fn().mockRejectedValue(new WorkflowCommandError('rejected','changed','MANAGEMENT_NOT_APPLIED_RECORD_CHANGED'))
 r.management!.stages=[{id:'phase',title:'原阶段',outcome:'',taskRefs:[]}];wrapper=mount(Management,{props:{provider:{getOperation,updateStages} as never,records:[r],selectedId:r.id,selectedIds:[],trashView:false,storage,busy:false},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('input[maxlength="200"]').setValue('未保存草稿');await wrapper.findAll('button').find(b=>b.text()===(method==='read'?'查询原请求':'继续原管理请求'))!.trigger('click');await flushPromises();expect(wrapper.text()).toContain('原操作未应用');expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe('未保存草稿');expect(storage.getItem('companion.workflow-management.pending.v1')).toBeNull();if(method==='continue')expect(updateStages.mock.calls[0]![1]).toEqual({operationId,expectedRevision:0,stages})
})
