import {afterEach,expect,it,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import {createPinia} from 'pinia'
import {createMemoryHistory,createRouter} from 'vue-router'
import ElementPlus from 'element-plus'
import View from '../src/views/DevelopmentWorkflowView.vue'
import {emptyWorkflowLedgerObservation,projectWorkflowLedger} from '../src/components/workflow-operation/workflow-ledger-projection'
import type {WorkflowOperationRecord} from '../src/components/workflow-operation/workflow-operation'
import type {WorkflowReadSnapshot} from '../src/domain/workflow-read'
const hash='a'.repeat(64)
const goal=(id:string,trash:string|null=null):WorkflowOperationRecord=>({schemaVersion:'workflow-operation-v1',id,revision:1,goal:{source:'gsd',ref:'goal',digest:hash,version:'1'},plan:null,state:'draft',review:null,activeRunId:null,runs:[],management:{revision:0,trashedAt:trash,stages:[]},presentation:{title:'执行目标'}})
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.restoreAllMocks()})
it('keeps engineering planning read-only and collapsed apart from the execution ledger',async()=>{
 const snapshot:WorkflowReadSnapshot={schemaVersion:'workflow-read-v1',readOnly:true,observedAt:'2026-01-01T00:00:00Z',projects:[],sources:[],goals:[{id:'source-goal',title:'来源目标',sourceId:'gsd',milestones:[]}],tasks:[{id:'source-task',title:'来源清单任务',state:'queued',goalId:'source-goal',sourceId:'openspec',evidenceIds:[]}],evidence:[]}
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/workflow',component:View}]});await router.push('/workflow?section=tasks');await router.isReady();const start=vi.fn(),provider={list:async()=>[goal('execution-one')],start} as never
 wrapper=mount(View,{attachTo:document.body,props:{provider:{read:async()=>snapshot},operationProvider:provider},global:{plugins:[createPinia(),router,ElementPlus],stubs:{WorkflowProjectRegistration:true}}});await flushPromises()
 const reference=wrapper.get('details.workflow-planning-source');expect(reference.attributes('open')).toBeUndefined();expect(reference.get('summary').text()).toContain('工程规划参考')
 expect(wrapper.find('[aria-label="工作流目标列表"]').exists()).toBe(false);expect(wrapper.get('[aria-label="计划任务列表"]').text()).toContain('暂无可核验的计划任务')
 expect(reference.text()).toContain('来源清单任务');await reference.get('summary').trigger('click');await wrapper.get('[data-workflow-task="source-task"]').trigger('click');await flushPromises();expect(router.currentRoute.value.query.task).toBe('source-task');expect(document.body.textContent).toContain('来源清单任务');expect(start).not.toHaveBeenCalled()
})
it('excludes trash from execution status counts without changing source records',()=>{
 const observation=emptyWorkflowLedgerObservation();observation.readState='ready';observation.records=[goal('active'),goal('trash','2026-01-01T00:00:00Z')]
 const projection=projectWorkflowLedger(observation);expect(projection.rows.map(x=>x.workflowId)).toEqual(['active']);expect(projection.counts.draft).toBe(1);expect(observation.records).toHaveLength(2)
})
