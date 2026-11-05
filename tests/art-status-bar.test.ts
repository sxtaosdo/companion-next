import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import ArtStatusBar from '../src/components/ArtStatusBar.vue'
import ProjectArtSpecPanel from '../src/components/ProjectArtSpecPanel.vue'
import { defineComponent, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useRegisteredProjectPage } from '../src/composables/use-registered-project-page'
import { useRegisteredProjectStore } from '../src/stores/registered-project'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { CreatorOperationError } from '../src/domain/creator-operations'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { useAiResourceReadStore } from '../src/stores/ai-resource-read'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { aiResourceReadProvider } from '../src/ai-resource-read-integration'
import { AiResourceReadError, type AiResourceReadProvider, type AiResourceView } from '../src/domain/ai-resource-read'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { knowledgeReadProvider } from '../src/knowledge-read-integration'
import type { KnowledgeReadProvider } from '../src/domain/knowledge-read'
import { CircleClose } from '@element-plus/icons-vue'
import { resourceView } from './fixtures/ai-resource-read'
import { useProjectArtSpecStore } from '../src/stores/project-art-spec'
import { projectArtSpecProvider, type ProjectArtSpecContext, type ProjectArtSpecProvider, type ProjectArtSpecReceipt } from '../src/project-art-spec-integration'
import type { ProjectArtSpec } from '../src/domain/project-art-spec'
const id='0123456789abcdef', project={id,name:'Alpha',path:'D:/Alpha'}
let wrapper:VueWrapper|undefined
async function enter(modern:ProjectArtSpecProvider|null=null){
 const pinia=createPinia(), selection=useRegisteredProjectStore(pinia), resource=useAiResourceReadStore(pinia)
 const source:CompanionBrowserProvider={label:'isolated registration',runtimeProbesEnabled:true,loadProjects:vi.fn(async()=>({projects:[project],statuses:[{projectId:id,state:'stopped' as const,capabilityProfile:'unknown' as const}],dashboard:[],warnings:[]})),loadCounts:vi.fn(),loadLogs:vi.fn(),loadCalls:vi.fn()}
 const reader:AiResourceReadProvider={label:'isolated resource',readConfig:vi.fn(async()=>resourceView(id)),previewReference:vi.fn()}
 registerCompanionBrowserProvider(source);aiResourceReadProvider.value=reader;projectArtSpecProvider.value=modern
 await selection.directory.connect(source);selection.restoreRouteProject(id);resource.setContext(selection.project,selection.currentSource)
 wrapper=mount(ArtStatusBar,{props:{projectPicker:false,showCreator:true},global:{plugins:[pinia,ElementPlus]}});await flushPromises()
 return {pinia,art:useProjectArtSpecStore(pinia),selection,resource,source,reader,operations:useCreatorOperationsStore(pinia)}
}
function tag(kind:string){const node=wrapper!.get(`[data-status="${kind}"]`);return node.classes().includes('el-tag')?node:node.get('.el-tag')}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;companionBrowserProvider.value=null;companionProjectEntryProvider.value=null;aiResourceReadProvider.value=null;creatorOperationsProvider.value=null;projectArtSpecProvider.value=null;knowledgeReadProvider.value=null;vi.restoreAllMocks()})
describe('shared compact art status',()=>{
 it('shows the selected real project and independent unobserved resource status without requesting reads',async()=>{
  const {source,reader}=await enter()
  expect(wrapper!.get('.art-current-project strong').text()).toBe('Alpha')
  expect(tag('registration').classes()).toContain('el-tag--success')
  expect(tag('specification').text()).toBe('规范未读取');expect(tag('specification').classes()).toContain('el-tag--info')
  expect(wrapper!.find('[data-status="task"]').exists()).toBe(false)
  expect(source.loadProjects).toHaveBeenCalledTimes(1);expect(reader.readConfig).not.toHaveBeenCalled();expect(reader.previewReference).not.toHaveBeenCalled()
 })
 it('keeps resource reading and adapter-disabled failure separate from connected registrations',async()=>{
  const {reader,resource}=await enter()
  let fail!:(cause:unknown)=>void
  reader.readConfig=vi.fn(()=>new Promise<AiResourceView>((_resolve,reject)=>fail=reject))
  const reading=resource.readConfig(reader);await flushPromises()
  expect(tag('specification').text()).toBe('规范读取中');expect(tag('specification').find('.is-loading').exists()).toBe(true)
  fail(new AiResourceReadError('adapter-disabled','resource-config',503));await reading;await flushPromises()
  expect(tag('registration').classes()).toContain('el-tag--success')
  expect(tag('specification').text()).toBe('规范读取失败');expect(tag('specification').classes()).toContain('el-tag--danger')
  expect(wrapper!.text()).not.toContain('规范未配置')
 })
 it('clears ready-looking specification state when project path or provider no longer matches',async()=>{
  const {resource,reader,selection}=await enter();await resource.readConfig(reader);await flushPromises()
  expect(tag('specification').text()).toBe('项目规范未配置');expect(tag('specification').classes()).toContain('el-tag--warning')
  resource.project={...project,path:'D:/Other'};await flushPromises()
  expect(tag('specification').text()).toBe('规范未读取')
  selection.directory.disconnect();await flushPromises()
  expect(tag('registration').classes()).not.toContain('el-tag--success');expect(tag('specification').classes()).not.toContain('el-tag--success')
 })
 it('accepts only the local jobs panel snapshot bound to the current project and source',async()=>{
  const {source}=await enter()
  const jobs={projectId:id,projectPath:project.path,source,loading:false,error:'',observedAt:'2026-10-21T00:00:00Z',hasRead:true,state:'import_unknown' as const}
  await wrapper!.setProps({jobs});expect(tag('task').text()).toBe('导入结果未知 · 待核对');expect(tag('task').classes()).toContain('el-tag--warning')
  await wrapper!.setProps({jobs:{...jobs,loading:true}});expect(tag('task').text()).toBe('任务读取中');expect(tag('task').find('.is-loading').exists()).toBe(true)
  await wrapper!.setProps({jobs:{...jobs,error:'isolated failure'}});expect(tag('task').text()).toBe('任务读取失败');expect(tag('task').classes()).toContain('el-tag--danger')
  await wrapper!.setProps({jobs:{...jobs,source:{}}});expect(wrapper!.find('[data-status="task"]').exists()).toBe(false)
  await wrapper!.setProps({jobs:{...jobs,projectPath:'D:/Other'}});expect(wrapper!.find('[data-status="task"]').exists()).toBe(false)
 })
 it('never lets an older unknown receipt override a newer observed ready project',async()=>{
  const {selection,operations}=await enter(), directory=selection.directory
  creatorOperationsProvider.value={label:'isolated action',run:vi.fn(async()=>{throw new CreatorOperationError('network-error','unknown')}),waitForIdle:vi.fn(async()=>{})}
  await operations.direct(id,'start');await flushPromises()
  expect(operations.lastReceipt?.phase).toBe('unknown')
  expect(wrapper!.get('.art-creator-state').text()).toContain('结果未知')
  directory.projectSnapshotRevision++;directory.statuses=[{projectId:id,state:'ready',capabilityProfile:'authoring'}];await flushPromises()
  expect(wrapper!.get('.art-creator-state').text()).not.toContain('结果未知')
  expect(wrapper!.get('.art-creator-state').text()).toContain('已就绪')
 })
 it('provides one shared real-project selector and hides Creator outside import context',async()=>{
  const {selection,source}=await enter();await wrapper!.setProps({projectPicker:true,showCreator:false})
  expect(wrapper!.find('input[aria-label="当前登记工程"]').exists()).toBe(true)
  expect(wrapper!.find('.art-creator-state').exists()).toBe(false)
  await wrapper!.setProps({showCreator:true});expect(wrapper!.find('.art-creator-state').exists()).toBe(true)
  selection.directory.disconnect();await flushPromises()
  expect(wrapper!.find('input[aria-label="当前登记工程"]').exists()).toBe(false)
  expect(tag('registration').classes()).not.toContain('el-tag--success')
  expect(source.loadProjects).toHaveBeenCalledTimes(1)
 })
 it('keeps an independent collector status separate from Creator and registration',async()=>{
  await enter();await wrapper!.setProps({showCreator:false,service:{label:'采集器',text:'未确认就绪',tone:'warning'}})
  expect(tag('service').classes()).toContain('el-tag--warning');expect(wrapper!.find('.art-creator-state').exists()).toBe(false)
  await wrapper!.setProps({service:{label:'采集器',text:'已就绪',tone:'success'}})
  expect(tag('service').classes()).toContain('el-tag--success');expect(tag('specification').classes()).toContain('el-tag--info')
 })
 it.each(['missing','invalid'] as const)('shows %s as a specification condition after a successful real-shaped read',async state=>{
  const {resource,reader}=await enter();await resource.readConfig(reader);resource.resource={...resource.resource!,state};await flushPromises()
  expect(tag('specification').classes()).toContain(state==='missing'?'el-tag--warning':'el-tag--danger')
  expect(tag('specification').text()).toBe(state==='missing'?'规范未配置':'规范读取失败')
 })
})

function specification(version=1):ProjectArtSpec { return {schemaVersion:'project-art-spec-v1',projectId:id,version,project:{name:'Alpha',content:'Isolated test project',engine:'cocos-creator',designResolution:{width:720,height:1280}},inheritance:{mode:'none',reason:'Independent test art direction'},overrides:{width:128,height:128},categories:{}} }
function receipt(config:unknown=specification()):ProjectArtSpecReceipt { return {projectId:id,projectPath:project.path,config,hash:config===null?null:'a'.repeat(64),authorities:[]} }
function modern(read:ProjectArtSpecProvider['read']=vi.fn(async()=>receipt())):ProjectArtSpecProvider { return {label:'isolated art provider',endpoint:'http://127.0.0.1:32180',read,save:vi.fn(async()=>{throw Error('not used')}),status:vi.fn(async()=>{throw Error('not used')})} }
describe('shared project art specification status and actions',()=>{
 it('automatically reads once per exact bound project and deduplicates multiple header instances',async()=>{
  const provider=modern(),{pinia,reader,art}=await enter(provider)
  expect(provider.read).toHaveBeenCalledTimes(1);expect(reader.readConfig).not.toHaveBeenCalled();expect(art.base?.version).toBe(1)
  expect(tag('specification').text()).toBe('规范已配置');expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('configured')
  const second=mount(ArtStatusBar,{props:{projectPicker:false},global:{plugins:[pinia,ElementPlus]}})
  await flushPromises();expect(provider.read).toHaveBeenCalledTimes(1);second.unmount()
  expect(wrapper!.get('.art-spec-source').text()).toBe('v1 · 项目自定义')
  await wrapper!.get('[data-testid="open-art-specification"]').trigger('click');expect(wrapper!.emitted('open-specification')).toHaveLength(1)
  expect(provider.save).not.toHaveBeenCalled()
 })
 it('shows reading before the first receipt and never offers creation from unread or loading state',async()=>{
  let resolve!:(value:ProjectArtSpecReceipt)=>void
  const provider=modern(vi.fn(()=>new Promise<ProjectArtSpecReceipt>(res=>resolve=res))),{art}=await enter(provider)
  expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('reading');expect(tag('specification').find('.is-loading').exists()).toBe(true)
  expect(wrapper!.find('[data-testid="open-art-specification"]').exists()).toBe(false)
  resolve(receipt(null));await flushPromises()
  expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('missing');expect(wrapper!.get('[data-testid="open-art-specification"]').text()).toBe('新建美术规范')
  expect(art.draft).toBeNull();expect(provider.save).not.toHaveBeenCalled()
 })
 it('automatically resumes a cancelled initial read after the panel changes its read-only binding',async()=>{
  const pending:Array<{resolve:(value:ProjectArtSpecReceipt)=>void}> = []
  const provider=modern(vi.fn(()=>new Promise<ProjectArtSpecReceipt>(resolve=>pending.push({resolve}))))
  const {art,source}=await enter(provider);expect(pending).toHaveLength(1)
  art.bind({projectId:id,projectPath:project.path,source,readOnly:true},provider);await flushPromises()
  expect(pending).toHaveLength(2)
  art.bind({projectId:id,projectPath:project.path,source,readOnly:false},provider);await flushPromises();expect(pending).toHaveLength(3)
  pending[0]!.resolve(receipt(specification()));pending[1]!.resolve(receipt(specification()));pending[2]!.resolve(receipt(null));await flushPromises()
  expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('missing')
  expect(wrapper!.get('[data-testid="open-art-specification"]').text()).toBe('新建美术规范')
  expect(provider.save).not.toHaveBeenCalled()
 })
 it('automatically resumes when an outgoing panel cancels a read without changing the project',async()=>{
  const pending:Array<{resolve:(value:ProjectArtSpecReceipt)=>void}> = []
  const provider=modern(vi.fn(()=>new Promise<ProjectArtSpecReceipt>(resolve=>pending.push({resolve}))))
  const {art}=await enter(provider);expect(pending).toHaveLength(1)
  art.leave();await flushPromises();expect(pending).toHaveLength(2)
  pending[1]!.resolve(receipt(null));await flushPromises()
  pending[0]!.resolve(receipt(specification()));await flushPromises()
  expect(wrapper!.get('[data-testid="open-art-specification"]').text()).toBe('新建美术规范');expect(art.base).toBeNull()
 })
 it('does not start a competing automatic read during the unified manual refresh',async()=>{
  const provider=modern(vi.fn(async()=>receipt(null))),{art,source}=await enter(provider)
  expect(provider.read).toHaveBeenCalledTimes(1)
  await wrapper!.setProps({refreshBusy:true});art.bind({projectId:id,projectPath:project.path,source,readOnly:true},provider);await flushPromises()
  expect(provider.read).toHaveBeenCalledTimes(1)
  art.bind({projectId:id,projectPath:project.path,source,readOnly:false},provider);await art.read();await flushPromises()
  await wrapper!.setProps({refreshBusy:false});await flushPromises();expect(provider.read).toHaveBeenCalledTimes(2)
 })
 it('does not classify read failure as missing, auto-retry it, or offer new creation',async()=>{
  const provider=modern(vi.fn(async()=>{throw Error('isolated read failure')})),{pinia,selection}=await enter(provider)
  expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('error');expect(tag('specification').classes()).toContain('el-tag--danger')
  expect(wrapper!.find('[data-testid="open-art-specification"]').exists()).toBe(false)
  const second=mount(ArtStatusBar,{props:{projectPicker:false},global:{plugins:[pinia,ElementPlus]}});await flushPromises()
  selection.directory.statuses=[{projectId:id,state:'ready',capabilityProfile:'authoring'}];await flushPromises()
  expect(provider.read).toHaveBeenCalledTimes(1);second.unmount()
  await wrapper!.get('button[aria-label="读取工程规范"]').trigger('click');await flushPromises();expect(provider.read).toHaveBeenCalledTimes(2)
 })
 it('identifies legacy icon configuration honestly and permits only explicit project-spec creation',async()=>{
  const legacy=resourceView().config!,provider=modern(vi.fn(async()=>receipt(legacy))),{reader,art}=await enter(provider)
  expect(tag('specification').text()).toBe('项目规范未配置');expect(tag('specification').classes()).not.toContain('el-tag--success')
  expect(wrapper!.get('.art-spec-source').text()).toBe('旧图标 v1');expect(wrapper!.get('[data-testid="open-art-specification"]').text()).toBe('新建美术规范')
  expect(art.draft).toBeNull();expect(reader.readConfig).not.toHaveBeenCalled();expect(provider.save).not.toHaveBeenCalled()
  await wrapper!.get('button[aria-label="读取工程规范"]').trigger('click');await flushPromises();expect(reader.readConfig).toHaveBeenCalledTimes(1)
 })
 it('preserves local draft editing but never presents that draft as a configured project',async()=>{
  const provider=modern(vi.fn(async()=>receipt(null))),{art}=await enter(provider)
  art.startDraft('Alpha');await flushPromises()
  expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('missing');expect(wrapper!.get('[data-testid="open-art-specification"]').text()).toBe('查看 / 编辑')
  expect(wrapper!.get('.art-spec-source').text()).toBe('有未保存修改');expect(wrapper!.get('button[aria-label="读取工程规范"]').attributes('disabled')).toBeDefined()
  expect(art.draft?.project.name).toBe('Alpha');expect(provider.save).not.toHaveBeenCalled()
 })
 it('distinguishes saving, result awaiting verification and errors without losing the existing draft',async()=>{
  const {art}=await enter(modern());const draft=art.draft
  art.pending=true;art.phase='saving';await flushPromises();expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('saving')
  expect(wrapper!.find('[data-testid="open-art-specification"]').exists()).toBe(false)
  art.pending=false;art.phase='unknown';await flushPromises();expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('unknown')
  expect(tag('specification').text()).toBe('规范结果待核对');expect(wrapper!.get('[data-testid="open-art-specification"]').text()).toBe('查看 / 编辑')
  art.phase='error';await flushPromises();expect(wrapper!.get('[data-status="specification"]').attributes('data-spec-state')).toBe('error');expect(art.draft).toBe(draft)
  expect(wrapper!.get('[data-testid="open-art-specification"]').text()).toBe('查看 / 编辑')
 })
 it('rejects stale provider receipts and automatically reads the newly bound provider once',async()=>{
  let resolve!:(value:ProjectArtSpecReceipt)=>void
  const old=modern(vi.fn(()=>new Promise<ProjectArtSpecReceipt>(res=>resolve=res))),{art}=await enter(old)
  const replacement=modern(vi.fn(async()=>receipt(specification(2))));projectArtSpecProvider.value=replacement;await flushPromises()
  resolve(receipt(specification(1)));await flushPromises()
  expect(art.base?.version).toBe(2);expect(replacement.read).toHaveBeenCalledTimes(1);expect(old.read).toHaveBeenCalledTimes(1)
  expect(wrapper!.get('.art-spec-source').text()).toBe('v2 · 项目自定义')
 })
 it('rejects a late receipt after the selected project path changes',async()=>{
  let resolve!:(value:ProjectArtSpecReceipt)=>void
  const provider=modern(vi.fn(()=>new Promise<ProjectArtSpecReceipt>(res=>resolve=res))),{selection,art}=await enter(provider)
  selection.directory.projects=[{...project,path:'D:/Changed'}];await flushPromises();resolve(receipt());await flushPromises()
  expect(selection.project).toBeNull();expect(art.base).toBeNull();expect(tag('specification').classes()).not.toContain('el-tag--success')
  expect(wrapper!.find('[data-testid="open-art-specification"]').exists()).toBe(false)
 })
 it('does not apply an older receipt after the project ID changes',async()=>{
  const pending:Array<{context:ProjectArtSpecContext;resolve:(value:ProjectArtSpecReceipt)=>void}>=[]
  const provider=modern(vi.fn((context:ProjectArtSpecContext)=>new Promise<ProjectArtSpecReceipt>(resolve=>pending.push({context,resolve}))))
  const {selection,art}=await enter(provider),second={id:'fedcba9876543210',name:'Beta',path:'D:/Beta'}
  selection.directory.projects=[project,second];selection.restoreRouteProject(second.id);await flushPromises()
  expect(provider.read).toHaveBeenCalledTimes(2)
  const config={...specification(2),projectId:second.id}
  pending[1]!.resolve({projectId:second.id,projectPath:second.path,config,hash:'b'.repeat(64),authorities:[]});await flushPromises()
  pending[0]!.resolve(receipt());await flushPromises()
  expect(art.base?.projectId).toBe(second.id);expect(art.base?.version).toBe(2);expect(wrapper!.get('.art-current-project strong').text()).toBe('Beta')
 })
 it('binds automatic reads and results to the exact registration source identity',async()=>{
  const pending:Array<{context:ProjectArtSpecContext;resolve:(value:ProjectArtSpecReceipt)=>void}>=[]
  const provider=modern(vi.fn((context:ProjectArtSpecContext)=>new Promise<ProjectArtSpecReceipt>(resolve=>pending.push({context,resolve}))))
  const {selection,source,art}=await enter(provider),replacement={...source,label:'another isolated registration source'}
  registerCompanionBrowserProvider(replacement);await selection.directory.connect(replacement);selection.restoreRouteProject(id);await flushPromises()
  expect(provider.read).toHaveBeenCalledTimes(2);expect(pending[1]!.context.source).toBe(replacement)
  pending[1]!.resolve(receipt(specification(2)));await flushPromises();pending[0]!.resolve(receipt());await flushPromises()
  expect(art.context?.source).toBe(replacement);expect(art.base?.version).toBe(2);expect(wrapper!.get('.art-spec-source').text()).toBe('v2 · 项目自定义')
 })
 it('cannot continue the legacy follow-up read after its provider changes during refresh',async()=>{
  const provider=modern(vi.fn(async()=>receipt(resourceView().config!))),{reader}=await enter(provider)
  let resolve!:(value:ProjectArtSpecReceipt)=>void;provider.read=vi.fn(()=>new Promise<ProjectArtSpecReceipt>(res=>resolve=res))
  await wrapper!.get('button[aria-label="读取工程规范"]').trigger('click');await flushPromises()
  const other={...reader,readConfig:vi.fn(async()=>resourceView())};aiResourceReadProvider.value=other
  resolve(receipt(resourceView().config!));await flushPromises()
  expect(reader.readConfig).not.toHaveBeenCalled();expect(other.readConfig).not.toHaveBeenCalled()
 })
})

describe('specification automatic read during real panel replacement',()=>{
 it('starts its one automatic read after the outgoing panel has left the shared store',async()=>{
  const pinia=createPinia(),selection=useRegisteredProjectStore(pinia),art=useProjectArtSpecStore(pinia),provider=modern(),show=ref(false)
  const source:CompanionBrowserProvider={label:'isolated transition source',runtimeProbesEnabled:true,loadProjects:vi.fn(async()=>({projects:[project],statuses:[],dashboard:[],warnings:[]})),loadCounts:vi.fn(),loadLogs:vi.fn(),loadCalls:vi.fn()}
  registerCompanionBrowserProvider(source);projectArtSpecProvider.value=provider;aiResourceReadProvider.value=null
  await selection.directory.connect(source);selection.restoreRouteProject(id)
  const Host=defineComponent({components:{ArtStatusBar,ProjectArtSpecPanel},setup:()=>({show,selection}),template:'<main><ArtStatusBar v-if="show" :project-picker="false"/><ProjectArtSpecPanel v-if="show" key="incoming" :project="selection.project" :source="selection.currentSource" shared-header/><ProjectArtSpecPanel v-if="!show" key="outgoing" :project="selection.project" :source="selection.currentSource" shared-header/></main>'})
  wrapper=mount(Host,{global:{plugins:[pinia,ElementPlus]}});await flushPromises()
  expect(provider.read).not.toHaveBeenCalled()
  show.value=true;await flushPromises()
  expect(provider.read).toHaveBeenCalledTimes(1);expect(art.base?.version).toBe(1)
  expect(art.phase).not.toBe('idle');expect(tag('specification').text()).toBe('规范已配置')
 })
})

describe('specification project selection through the actual router binding',()=>{
 it('reads B once and retains its receipt when the selector updates the route query',async()=>{
  const pinia=createPinia(),selection=useRegisteredProjectStore(pinia),art=useProjectArtSpecStore(pinia),second={id:'fedcba9876543210',name:'Beta',path:'D:/Beta'}
  const provider=modern(vi.fn(async(context:ProjectArtSpecContext)=>context.projectId===id?receipt():{projectId:second.id,projectPath:second.path,config:null,hash:null,authorities:[]}))
  const source:CompanionBrowserProvider={label:'isolated routed source',runtimeProbesEnabled:true,loadProjects:vi.fn(async()=>({projects:[project,second],statuses:[],dashboard:[],warnings:[]})),loadCounts:vi.fn(),loadLogs:vi.fn(),loadCalls:vi.fn()}
  registerCompanionBrowserProvider(source);projectArtSpecProvider.value=provider;aiResourceReadProvider.value=null
  await selection.directory.connect(source)
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/art-resources',component:{template:'<div/>'}}]})
  await router.push({path:'/art-resources',query:{project:id}});await router.isReady()
  const Host=defineComponent({components:{ArtStatusBar,ProjectArtSpecPanel},setup(){const selection=useRegisteredProjectPage();return{selection}},template:'<main><ArtStatusBar/><ProjectArtSpecPanel :project="selection.project" :source="selection.currentSource" shared-header/></main>'})
  wrapper=mount(Host,{global:{plugins:[pinia,router,ElementPlus]}});await flushPromises()
  expect(art.base?.projectId).toBe(id);expect(provider.read).toHaveBeenCalledTimes(1)
  wrapper.findComponent({name:'ElSelect'}).vm.$emit('update:modelValue',second.id)
  await flushPromises();await flushPromises()
  expect(router.currentRoute.value.query.project).toBe(second.id);expect(selection.project?.id).toBe(second.id)
  expect(provider.read).toHaveBeenCalledTimes(2);expect(art.hash).toBeNull();expect(art.phase).not.toBe('idle')
  expect(tag('specification').text()).toBe('规范未配置');expect(wrapper.get('[data-testid="open-art-specification"]').text()).toBe('新建美术规范')
 })
})

describe('unified art header status appearance',()=>{
 it('uses shared classes and primary only while actually reading or saving',async()=>{
  let resolve!:(value:ProjectArtSpecReceipt)=>void
  const {art}=await enter(modern(vi.fn(()=>new Promise<ProjectArtSpecReceipt>(done=>resolve=done))))
  expect(wrapper!.get('[data-status="specification"]').classes()).toContain('companion-status-tag')
  expect(tag('specification').classes()).toContain('el-tag--primary');expect(tag('specification').get('.companion-status-icon').classes()).toContain('is-loading')
  resolve(receipt());await flushPromises();expect(tag('specification').classes()).toContain('el-tag--success');expect(tag('specification').find('.is-loading').exists()).toBe(false)
  art.pending=true;art.phase='saving';await flushPromises();expect(tag('specification').classes()).toContain('el-tag--primary')
  art.phase='unknown';await flushPromises();expect(tag('specification').classes()).toContain('el-tag--warning');expect(tag('specification').find('.is-loading').exists()).toBe(false)
  art.pending=false;art.phase='error';await flushPromises();expect(tag('specification').classes()).toContain('el-tag--danger');expect(tag('specification').findComponent(CircleClose).exists()).toBe(true)
 })
 it('shows a negative model reachability observation as gray disconnected, never stopped',async()=>{
  const {pinia}=await enter(),knowledge=useKnowledgeReadStore(pinia),provider={} as KnowledgeReadProvider
  knowledgeReadProvider.value=provider;knowledge.provider=provider;knowledge.services={model:{running:false},warnings:[]}
  await wrapper!.setProps({showModel:true});expect(tag('model').text()).toContain('未连接');expect(tag('model').classes()).toContain('el-tag--info');expect(tag('model').text()).not.toContain('未启动')
  knowledge.statusLoading=true;await flushPromises();expect(tag('model').classes()).toContain('el-tag--primary');expect(tag('model').find('.is-loading').exists()).toBe(true)
  knowledge.statusLoading=false;knowledge.serviceError='isolated failure';await flushPromises();expect(tag('model').classes()).toContain('el-tag--danger');expect(tag('model').findComponent(CircleClose).exists()).toBe(true)
 })
 it.each([
  ['queued','info',false],['waiting_service','warning',false],['running','primary',true],['unknown','warning',false],['import_unknown','warning',false],['failed','danger',false],['selected','success',false],['reusable','success',false],['awaiting_selection','warning',false],['imported_pending_verification','warning',false],['blocked','warning',false],
 ] as const)('renders original task %s with %s and correct activity',async(state,tone,spinning)=>{
  const {source}=await enter();await wrapper!.setProps({jobs:{projectId:id,projectPath:project.path,source,loading:false,error:'',observedAt:'2026-10-21T00:00:00Z',hasRead:true,state}})
  expect(tag('task').classes()).toContain('el-tag--'+tone);expect(tag('task').find('.is-loading').exists()).toBe(spinning)
  expect(wrapper!.get('[data-status="task"]').classes()).toContain('companion-status-tag')
  if(state==='failed')expect(tag('task').findComponent(CircleClose).exists()).toBe(true)
  if(['unknown','import_unknown'].includes(state))expect(tag('task').text()).toContain('待核对')
  if(state==='imported_pending_verification'){expect(tag('task').text()).toContain('待运行验收');expect(tag('task').text()).not.toContain('验收完成')}
 })
})

describe('art header explicit unknown and historical evidence',()=>{
 it('keeps unobserved model gray but marks a valid response lacking model state as unknown awaiting verification',async()=>{
  const {pinia}=await enter(),knowledge=useKnowledgeReadStore(pinia),provider={} as KnowledgeReadProvider
  knowledgeReadProvider.value=provider;knowledge.provider=provider;await wrapper!.setProps({showModel:true})
  expect(tag('model').text()).toContain('未读取');expect(tag('model').classes()).toContain('el-tag--info')
  knowledge.services={warnings:[]};await flushPromises()
  expect(tag('model').text()).toContain('未知，待核对');expect(tag('model').classes()).toContain('el-tag--warning');expect(tag('model').find('.is-loading').exists()).toBe(false)
 })
 it('shows explicitly historical running as static warning rather than present execution',async()=>{
  const {source}=await enter();const jobs={projectId:id,projectPath:project.path,source,loading:false,error:'',observedAt:'2026-10-21T00:00:00Z',hasRead:true,state:'running' as const,historyOnly:true}
  await wrapper!.setProps({jobs});expect(tag('task').classes()).toContain('el-tag--warning');expect(tag('task').find('.is-loading').exists()).toBe(false)
  expect(tag('task').text()).toContain('历史任务');expect(tag('task').text()).toContain('只读，待核对')
  await wrapper!.setProps({jobs:{...jobs,historyOnly:false}});expect(tag('task').classes()).toContain('el-tag--primary');expect(tag('task').find('.is-loading').exists()).toBe(true)
 })
})
it('shows current domain specification separately from the public-project read state',async()=>{await enter();await wrapper!.setProps({domainSpecification:{kind:'configured',text:'当前域规范已配置',tone:'success'}});expect(tag('specification').text()).toBe('当前域规范已配置');expect(tag('specification').classes()).toContain('el-tag--success');expect(wrapper!.text()).toContain('读取 / 刷新工程公共规范');expect(wrapper!.text()).not.toContain('规范未读取');await wrapper!.setProps({domainSpecification:{kind:'unknown',text:'当前域规范待核对',tone:'warning'}});expect(tag('specification').text()).toBe('当前域规范待核对');expect(tag('specification').classes()).toContain('el-tag--warning');await wrapper!.setProps({domainSpecification:null});expect(tag('specification').text()).toBe('规范未读取')})
