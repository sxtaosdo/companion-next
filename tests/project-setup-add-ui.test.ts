import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {createPinia} from 'pinia'
import {mount,DOMWrapper,flushPromises,type VueWrapper} from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ProjectAddWizard from '../src/components/ProjectAddWizard.vue'
import {useCompanionBrowserStore} from '../src/stores/companion-browser'
import {projectSetupProvider} from '../src/project-setup-integration'
import {toolPresetReadProvider} from '../src/tool-presets-read-integration'
import {projectConnectionsProvider} from '../src/project-connections-integration'
import {companionBrowserProvider} from '../src/companion-browser-integration'
import type {ProjectSetupProvider,SetupSnapshot} from '../src/domain/project-setup'
const path='D:/Fixture/Add',id='0123456789abcdef',operationId='11111111-1111-4111-8111-111111111111',options={startCreator:true,configureCodex:false}
const project={id,path,name:'Add'},presets=[{id:'full',name:'全部工具',baseProfile:'full' as const,enabled:[],disabled:[],builtIn:true,updatedAt:'1970-01-01T00:00:00.000Z'},{id:'core',name:'核心工具',baseProfile:'core' as const,enabled:[],disabled:[],builtIn:true,updatedAt:'1970-01-01T00:00:00.000Z'}]
let wrapper:VueWrapper|undefined
const body=()=>new DOMWrapper(document.body)
const button=(text:string)=>body().findAll('button').find(b=>b.text()===text&&!b.classes().includes('setup-timeline-heading'))!
async function click(text:string){await button(text).trigger('click');await flushPromises()}
beforeEach(()=>{vi.useFakeTimers()})
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.clearAllTimers();vi.useRealTimers();projectSetupProvider.value=null;toolPresetReadProvider.value=null;projectConnectionsProvider.value=null;companionBrowserProvider.value=null})
async function setup(){
 let registered=false
 const pinia=createPinia(),reader={label:'reader',loadProjects:vi.fn(async()=>({projects:registered?[project]:[],statuses:[],dashboard:[],warnings:[]})),loadCounts:async()=>({sessionId:'s',counts:{},latest:{}}),loadLogs:async()=>[],loadCalls:async()=>({sessionId:'s',total:0,retained:0,records:[]})}
 const api:ProjectSetupProvider={label:'setup',register:vi.fn(async()=>project),start:vi.fn(async()=>({operationId})),startPathStrict:vi.fn(async()=>({operationId,optionsContractVersion:1 as const,effectiveOptions:options,reused:false})),status:vi.fn(async()=>({id:operationId,projectId:id,projectPath:path,stage:'installing-bridge' as const,startedAt:'',updatedAt:'',optionsContractVersion:1 as const,effectiveOptions:options})),waitForIdle:vi.fn(async()=>{})}
 const scope={label:'scope',loadTools:vi.fn(async()=>[]),loadPresets:vi.fn(async()=>({presets,selectedPresetId:'full'})),exportPreset:vi.fn()}
 const connections={label:'connections',run:vi.fn(async()=>({key:'ok',text:'ok'})),waitForIdle:vi.fn(async()=>{})}
 projectSetupProvider.value=api;toolPresetReadProvider.value=scope;projectConnectionsProvider.value=connections;companionBrowserProvider.value=reader
 await useCompanionBrowserStore(pinia).connect(reader)
 wrapper=mount(ProjectAddWizard,{attachTo:document.body,global:{plugins:[pinia,ElementPlus]}})
 return {api,scope,connections,complete:()=>{registered=true;vi.mocked(api.status).mockResolvedValue({id:operationId,projectId:id,projectPath:path,stage:'complete',startedAt:'',updatedAt:'',optionsContractVersion:1,effectiveOptions:options} as SetupSnapshot)}}
}
it('matches old source/path/launch confirmation order without separate registration or installation controls',async()=>{
 const {api,scope}=await setup();await click('添加已有工程');expect(body().text()).toContain('选择来源');expect(body().findAll('.setup-timeline-heading')).toHaveLength(5)
 await click('下一步');await body().get('input[aria-label="已有工程绝对路径"]').setValue(path);expect(api.register).not.toHaveBeenCalled();expect(api.startPathStrict).not.toHaveBeenCalled()
 await click('下一步');expect(scope.loadPresets).toHaveBeenCalledOnce();expect(body().find('.setup-consents').exists()).toBe(false);expect(body().find('[data-testid="registration-confirm"]').exists()).toBe(false)
 expect(body().text()).toContain('工具范围');expect(body().text()).not.toContain('配置 Codex');await click('通过 Dashboard 启动 Creator')
 expect(api.startPathStrict).toHaveBeenCalledExactlyOnceWith(path,options,expect.any(AbortSignal));expect(api.register).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled();expect(body().find('[data-testid="agent-registration-panel"]').exists()).toBe(false)
})
it('shows Agent selection only after completion, defaults all selected, and supports skip without client writes',async()=>{
 const {api,connections,complete}=await setup();await click('添加已有工程');await click('下一步');await body().get('input[aria-label="已有工程绝对路径"]').setValue(path);await click('下一步');await click('通过 Dashboard 启动 Creator');complete();await vi.advanceTimersByTimeAsync(1000);await flushPromises();await click('下一步')
 const agent=body().get('[data-testid="agent-registration-panel"]');expect(agent.findAll('input[type="checkbox"]')).toHaveLength(6);for(const check of agent.findAll('input[type="checkbox"]'))expect((check.element as HTMLInputElement).checked).toBe(true)
 await click('跳过 Agent 接入');expect(body().text()).toContain('添加流程完成');expect(connections.run).toHaveBeenCalledOnce();expect(api.startPathStrict).toHaveBeenCalledOnce()
})
