import {it,expect,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Panel from '../src/components/workflow-operation/WorkflowOperationPanel.vue'
import {WorkflowCommandError,type WorkflowOperationRecord} from '../src/components/workflow-operation/workflow-operation'
it('keeps diagnostic result across refresh and clears it for another goal',async()=>{
 const make=(id:string):WorkflowOperationRecord=>({schemaVersion:'workflow-operation-v1',id,revision:1,goal:{source:'gsd',ref:'g',digest:'g',version:'1'},plan:{source:'openspec',ref:'p',digest:'p',version:'1'},state:'unknown',review:null,activeRunId:null,runs:[],planningConversation:{phase:'planning',requestId:'original-'+id,threadId:'thread',turnId:'turn',lastKnownState:'completed',observedAt:null}})
 const rows=[make('goal-a'),make('goal-b')],recover=vi.fn(async()=>{throw new WorkflowCommandError('rejected','rejected','CODEX_VERSION_NOT_APPROVED',409)})
 const wrapper=mount(Panel,{props:{section:'specs',pendingStorage:null,provider:{list:async()=>structuredClone(rows),recoverPlanningTransport:recover} as never},global:{plugins:[ElementPlus]}})
 try{
  await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');await flushPromises()
  await wrapper.findAll('button').find(x=>x.text()==='核查原规划连接')!.trigger('click');await flushPromises()
  expect(wrapper.text()).toContain('核查进程未派发');expect(recover).toHaveBeenCalledWith('goal-a',{operationId:'original-goal-a',expectedRevision:1})
  await (wrapper.vm as unknown as {refresh:()=>Promise<void>}).refresh();await flushPromises();expect(wrapper.text()).toContain('核查进程未派发')
  await (wrapper.vm as unknown as {selectWorkflow:(id:string)=>void}).selectWorkflow('goal-b');await flushPromises();expect(wrapper.text()).not.toContain('核查进程未派发')
 }finally{wrapper.unmount()}
})
