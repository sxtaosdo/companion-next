import {afterEach,expect,it,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import {createPinia} from 'pinia'
import {createMemoryHistory,createRouter} from 'vue-router'
import ElementPlus from 'element-plus'
import View from '../src/views/DevelopmentWorkflowView.vue'
import OperationPanel from '../src/components/workflow-operation/WorkflowOperationPanel.vue'
import type {WorkflowOperationRecord} from '../src/components/workflow-operation/workflow-operation'
import type {WorkflowReadSnapshot} from '../src/domain/workflow-read'
const snapshot=():WorkflowReadSnapshot=>({schemaVersion:'workflow-read-v1',readOnly:true,observedAt:'2026-10-27T08:00:00Z',projects:[],sources:[],goals:[{id:'original-goal',title:'Long goal',summary:'Scope',sourceId:'gsd',milestones:[]}],tasks:[{id:'original-paused-task',title:'Retained task',state:'paused',goalId:'original-goal',sourceId:'openspec',evidenceIds:[]}],evidence:[]})
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.restoreAllMocks()})
async function render(url:string,data=snapshot()){
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/workflow',component:View},{path:'/other',component:{template:'<div>other</div>'}}]})
 await router.push(url);await router.isReady()
 const writes=vi.fn()
 wrapper=mount(View,{attachTo:document.body,props:{provider:{read:async()=>data},operationProvider:{read:async()=>({records:[]})} as never},global:{plugins:[createPinia(),router,ElementPlus],stubs:{WorkflowOperationPanel:{template:'<div/>',methods:{refresh:writes}},WorkflowProjectRegistration:true}}})
 await flushPromises()
 return {router,writes}
}
it('opens the original task directly and preserves identity and state across all detail tabs',async()=>{
 const data=snapshot(),before=JSON.stringify(data)
 const {router,writes}=await render('/workflow?task=original-paused-task',data)
 for(const tab of ['specification','execution','acceptance','evidence']){
  const button=document.querySelector<HTMLButtonElement>(`[data-detail-tab="${tab}"]`)!
  expect(button).not.toBeNull();button.click();await flushPromises()
  expect(document.querySelector('[data-testid="detail-task-id"]')?.textContent).toBe('original-paused-task')
  expect(router.currentRoute.value.query.task).toBe('original-paused-task')
  expect(router.currentRoute.value.query.detail).toBe(tab)
 }
 expect(document.body.textContent).toContain('暂无匹配证据')
 expect(writes).not.toHaveBeenCalled();expect(JSON.stringify(data)).toBe(before)
})
it('keeps only goals/tasks primary entries and opens the selected source without inventing a ledger mapping',async()=>{
 const {router}=await render('/workflow?task=original-paused-task')
 expect(wrapper!.findAll('nav.workflow-tabs > button').map(b=>b.attributes('id'))).toEqual(['tab-goals','tab-tasks'])
 const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('查看该任务的规划来源'))!
 button.click();await flushPromises()
 expect(router.currentRoute.value.query.task).toBe('original-paused-task')
 expect(router.currentRoute.value.query.workflow).toBeUndefined()
})
it('restores the detail selection from a refreshed route and browser history',async()=>{
 const {router}=await render('/workflow?task=original-paused-task&detail=acceptance')
 expect(document.body.textContent).toContain('Owner Accepted')
 await router.push('/other');await router.push('/workflow?task=original-paused-task&detail=evidence');await flushPromises()
 router.back();await flushPromises();router.back();await flushPromises()
 expect(document.querySelector('[data-detail-tab="acceptance"]')?.getAttribute('aria-pressed')).toBe('true')
})
it('keeps empty goals navigable and handles missing optional legacy fields',async()=>{
 const data=snapshot();data.tasks=[]
 const {router}=await render('/workflow?section=tasks&goal=original-goal',data)
 expect(wrapper!.text()).toContain('当前筛选下没有任务记录')
 await router.push('/workflow?section=goals');await flushPromises()
 expect(wrapper!.text()).toContain('original-goal');expect(wrapper!.text()).toContain('来源尚未提供里程碑')
})
it('shows the full plan only in specification and never resumes a retained unknown record',async()=>{
 const record:WorkflowOperationRecord={schemaVersion:'workflow-operation-v1',id:'original-unknown',revision:1,goal:{source:'gsd',ref:'goal-source',digest:'goal-digest',version:'1'},plan:{source:'openspec',ref:'original-plan',digest:'plan-digest',version:'1'},state:'unknown',review:null,activeRunId:null,runs:[],presentation:{title:'Retained unknown',planText:'UNIQUE_FULL_PLAN_BODY'}}
 const before=JSON.stringify(record),resume=vi.fn(),start=vi.fn()
 wrapper=mount(OperationPanel,{props:{section:'specs',pendingStorage:null,provider:{list:async()=>[record],resume,start} as never},global:{plugins:[ElementPlus]}})
 await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');await flushPromises()
 expect(wrapper.findAll('[data-testid="full-plan"]')).toHaveLength(1)
 await wrapper.setProps({section:'tasks'});await flushPromises()
 expect(wrapper.findAll('[data-testid="full-plan"]')).toHaveLength(1)
 await wrapper.get('[data-record-tab="execution"]').trigger('click');await flushPromises()
 expect(wrapper.text()).not.toContain('UNIQUE_FULL_PLAN_BODY')
 await wrapper.setProps({section:'execution'});await flushPromises()
 expect(resume).not.toHaveBeenCalled();expect(start).not.toHaveBeenCalled();expect(JSON.stringify(record)).toBe(before)
})

it('restores actual execution task identity and detail tabs through direct links, refresh and history without writes',async()=>{
 const record:WorkflowOperationRecord={schemaVersion:'workflow-operation-v1',id:'ledger-original',revision:7,goal:{source:'gsd',ref:'goal-ref',digest:'digest',version:'7'},plan:{source:'openspec',ref:'plan-ref',digest:'plan-digest',version:'1'},state:'unknown',review:null,activeRunId:null,runs:[],presentation:{title:'Real ledger task',planText:'ONE_PLAN_BODY'}}
 record.planningConversation={phase:'planning',requestId:'plan-request',threadId:'plan-thread',turnId:'plan-turn',lastKnownState:'completed',observedAt:null}
 record.activeRunId='run-original';record.runs=[{id:'run-original',operationId:'run-request',planDigest:'plan-digest',goalDigest:'digest',state:'unknown',executionId:'run-thread',lastObservedAt:null,logRefs:[],evidenceRefs:[],acceptance:null,conversation:{phase:'execution',requestId:'run-request',threadId:'run-thread',turnId:'run-turn',lastKnownState:'completed',observedAt:null}}]
 const before=JSON.stringify(record),start=vi.fn(),resume=vi.fn(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/workflow',component:View}]})
 await router.push('/workflow?section=execution&workflow=ledger-original');await router.isReady()
 const options={props:{provider:{read:async()=>snapshot()},operationProvider:{list:async()=>[record],start,resume} as never},global:{plugins:[createPinia(),router,ElementPlus],stubs:{WorkflowProjectRegistration:true}}}
 wrapper=mount(View,options);await flushPromises()
 expect(wrapper.get('#tab-tasks').attributes('aria-selected')).toBe('true')
 expect(wrapper.get('[data-record-tab="execution"]').attributes('aria-pressed')).toBe('true')
 for(const tab of ['specs','execution','acceptance','evidence']){
  await wrapper.get('[data-record-tab="'+tab+'"]').trigger('click');await flushPromises()
  expect(wrapper.get('[data-testid="record-workflow-id"]').text()).toBe('ledger-original')
  expect(router.currentRoute.value.query.workflow).toBe('ledger-original')
  if(tab==='specs')expect(wrapper.text()).toContain('plan-thread')
  if(tab==='execution'||tab==='evidence'){expect(wrapper.text()).toContain('run-thread');expect(wrapper.text()).toContain('run-turn')}
  expect(wrapper.findAll('[data-testid="full-plan"]').length).toBe(tab==='specs'?1:0)
 }
 wrapper.unmount();wrapper=mount(View,options);await flushPromises()
 expect(wrapper.get('[data-record-tab="evidence"]').attributes('aria-pressed')).toBe('true')
 router.back();await flushPromises()
 expect(wrapper.get('[data-record-tab="acceptance"]').attributes('aria-pressed')).toBe('true')
 expect(start).not.toHaveBeenCalled();expect(resume).not.toHaveBeenCalled();expect(JSON.stringify(record)).toBe(before)
})
