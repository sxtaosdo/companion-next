// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {flushPromises,mount} from '@vue/test-utils'
import {createPinia} from 'pinia'
import ElementPlus from 'element-plus'
import Manager from '../src/components/ArtWorkbenchManager.vue'
import JobsPanel from '../src/components/AiJobsReadPanel.vue'
import ReviewPanel from '../src/components/ArtOutputReviewPanel.vue'
import {aiJobsReadProvider} from '../src/ai-jobs-read-integration'
import {job,need,scope} from './fixtures/art-output-review'
const selection=vi.hoisted(()=>({source:{},project:{id:'1234567890abcdef',name:'Fixture',path:'D:/fixture-only'}}))
vi.mock('../src/stores/registered-project',()=>({useRegisteredProjectStore:()=>({project:selection.project,currentSource:selection.source})}))
vi.mock('../src/stores/project-art-spec',()=>({useProjectArtSpecStore:()=>({base:{projectId:selection.project.id,version:1},hash:'a'.repeat(64),phase:'editing',dirty:false,pending:false,blocked:false,context:{projectId:selection.project.id,projectPath:selection.project.path,source:selection.source}}),useResourceDomainArtSpecStore:()=>({base:null,context:null})}))
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();aiJobsReadProvider.value=null;sessionStorage.clear();localStorage.clear();vi.unstubAllGlobals()})
it('actual task panel forwards exact job changes through Manager to actual review panel',async()=>{
 const bound=need(),opened=job(),other={...opened,jobId:'STUDIO-RUN-other-task-12345678'};let current=opened
 const fetch=vi.fn(async()=>new Response(JSON.stringify({projectId:scope.projectId,projectPath:scope.projectPath,hash:'b'.repeat(64),document:{schemaVersion:'art-workbench-v1',projectId:scope.projectId,projectPath:scope.projectPath,version:1,norm:{hash:'a'.repeat(64),version:1},projectReferences:[],specs:[bound.spec],needs:[bound]},capabilities:{generation:false,imageConditioning:false,referenceUpload:true,existingJobLink:true}}),{headers:{'Content-Type':'application/json'}}))
 vi.stubGlobal('fetch',fetch)
 const readStatus=vi.fn(async()=>current)
 aiJobsReadProvider.value={label:'isolated real-component fixture',readJobs:vi.fn(async()=>({schemaVersion:'companion-icons-v1' as const,projectId:scope.projectId,sourceRevision:opened.sourceRevision,jobs:[opened,other],profile:{id:opened.profile,...opened.budget},schedulerEnabled:false as const,workerResident:false as const})),readStatus,previewCandidate:vi.fn(async()=>{throw Error('No preview requested')})}
 wrapper=mount(Manager,{props:{view:'needs'},global:{plugins:[createPinia(),ElementPlus],stubs:{ElDialog:{props:['modelValue'],template:'<div v-if="modelValue"><slot/></div>'}}}})
 const click=async(text:string)=>{const button=wrapper!.findAll('button').find(row=>row.text()===text);expect(button,`button ${text}`).toBeDefined();await button!.trigger('click');await flushPromises()}
 await click('读取 / 刷新工作台');await click('查看任务')
 const jobs=wrapper.getComponent(JobsPanel),review=wrapper.getComponent(ReviewPanel)
 expect(jobs.vm.readStatusSnapshot.snapshot).toMatchObject({jobId:opened.jobId,revision:4})
 expect(review.props('job')).toMatchObject({jobId:opened.jobId,revision:4})
 current={...opened,revision:5}
 await click('刷新所选原任务状态')
 expect(readStatus).toHaveBeenCalledTimes(1)
 expect(jobs.vm.readStatusSnapshot.snapshot).toMatchObject({jobId:opened.jobId,revision:5})
 expect(review.props('job')).toMatchObject({jobId:opened.jobId,revision:5})
 jobs.findComponent({name:'ElSelect'}).vm.$emit('update:modelValue',other.jobId);await flushPromises()
 expect(jobs.vm.readStatusSnapshot.snapshot).toMatchObject({jobId:other.jobId,revision:4,state:opened.state})
 expect(review.props('job')).toBeNull()
 expect(fetch).toHaveBeenCalledTimes(1)
})
