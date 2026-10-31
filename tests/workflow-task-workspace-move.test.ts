import {afterEach,expect,it,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Panel from '../src/components/workflow-operation/WorkflowOperationPanel.vue'
import type {WorkflowOperationRecord} from '../src/components/workflow-operation/workflow-operation'

const fixture=(id:string,hash:string):WorkflowOperationRecord=>({schemaVersion:'workflow-operation-v1',id,revision:1,goal:{source:'gsd',ref:'goal',digest:hash.repeat(64),version:'1'},plan:null,state:'completed',review:null,activeRunId:'run',runs:[{id:'run',operationId:'operation',planDigest:hash.repeat(64),goalDigest:hash.repeat(64),state:'completed',executionId:'thread',lastObservedAt:null,logRefs:[],evidenceRefs:[],acceptance:null,capability:'task-directory-workspace-write',scope:'task-directory',taskWorkspace:{relativePath:`.companion/tasks/${id}`,baselineDigest:hash.repeat(64),policyDigest:hash.repeat(64)}}],presentation:{title:id}})
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();vi.restoreAllMocks()})
it('shows each verified task directory only inside its selected task detail',async()=>{
 const a=fixture('goal-a','a'),b=fixture('goal-b','b'),legacy={...fixture('goal-old','c'),runs:[]}
 const before=JSON.stringify([a,b,legacy]);const provider={list:async()=>[a,b,legacy]} as never
 wrapper=mount(Panel,{props:{section:'goals',provider,pendingStorage:null},global:{plugins:[ElementPlus]}});await flushPromises()
 const pick=async(id:string)=>{await wrapper!.findAll('[aria-label="工作流目标列表"] tbody tr button').find(x=>x.attributes('data-workflow-id')===id)!.trigger('click');await flushPromises()}
 await pick('goal-a');expect(wrapper.find('[aria-label="任务目录范围"]').exists()).toBe(false)
 await wrapper.setProps({section:'tasks'});await flushPromises()
 expect(wrapper.get('article [aria-label="任务目录范围"]').text()).toContain('.companion/tasks/goal-a')
 expect(wrapper.text()).toContain('仅本任务目录，不代表整仓库权限')
 await wrapper.setProps({section:'goals'});await pick('goal-b');await wrapper.setProps({section:'tasks'});expect(wrapper.get('article [aria-label="任务目录范围"]').text()).toContain('.companion/tasks/goal-b');expect(wrapper.text()).not.toContain('.companion/tasks/goal-a')
 await wrapper.setProps({section:'goals'});await pick('goal-old');await wrapper.setProps({section:'tasks'});expect(wrapper.find('[aria-label="任务目录范围"]').exists()).toBe(false)
 expect(JSON.stringify([a,b,legacy])).toBe(before)
})
it('reconciles only the selected planning goal on refresh, without dispatching a new plan',async()=>{
 const a={...fixture('goal-a','a'),state:'planning' as const},b={...fixture('goal-b','b'),state:'planning' as const};const completed={...a,revision:2,state:'review' as const}
 const readExecution=vi.fn(async()=>({record:completed})),generatePlan=vi.fn(),provider={list:vi.fn(async()=>[a,b]),readExecution,generatePlan} as never
 wrapper=mount(Panel,{props:{section:'goals',provider,pendingStorage:null},global:{plugins:[ElementPlus]}});await flushPromises();expect(readExecution).not.toHaveBeenCalled()
 await wrapper.findAll('[aria-label="工作流目标列表"] tbody tr button').find(x=>x.attributes('data-workflow-id')==='goal-a')!.trigger('click')
 await wrapper.findAll('button').find(x=>x.text()==='读取最新状态')!.trigger('click');await flushPromises()
 expect(readExecution).toHaveBeenCalledTimes(1);expect(readExecution).toHaveBeenCalledWith('goal-a');expect(wrapper.text()).toContain('计划待审阅');expect(generatePlan).not.toHaveBeenCalled()
})
it('marks the selected planning goal stale when its reconciliation fails',async()=>{
 const a={...fixture('goal-a','a'),state:'planning' as const};const readExecution=vi.fn(async()=>{throw Error('unavailable')}),generatePlan=vi.fn(),provider={list:async()=>[a],readExecution,generatePlan} as never
 wrapper=mount(Panel,{props:{section:'goals',provider,pendingStorage:null},global:{plugins:[ElementPlus]}});await flushPromises()
 await wrapper.findAll('[aria-label="工作流目标列表"] tbody tr button')[0].trigger('click');await wrapper.findAll('button').find(x=>x.text()==='读取最新状态')!.trigger('click');await flushPromises()
 expect(wrapper.text()).toContain('规划状态读取失败');expect(wrapper.text()).toContain('当前待核对');expect(generatePlan).not.toHaveBeenCalled()
})
