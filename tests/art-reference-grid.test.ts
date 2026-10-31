import managerSource from '../src/components/ArtWorkbenchManager.vue?raw'
import type { AiResourceReadProvider } from '../src/domain/ai-resource-read'
import { afterEach,describe,it,expect,vi } from 'vitest'
import { mount,flushPromises } from '@vue/test-utils'
import { createPinia,setActivePinia } from 'pinia'
import ArtWorkbenchManager from '../src/components/ArtWorkbenchManager.vue'
import { useArtWorkbenchStore } from '../src/stores/art-workbench'
import type { WorkbenchSpec,WorkbenchDocument } from '../src/domain/art-workbench'
import { aiReferenceUploadProvider } from '../src/ai-reference-upload-integration'
import { aiResourceReadProvider } from '../src/ai-resource-read-integration'
// Component fixtures, not a real backend or real model capability.
const fixture=vi.hoisted(()=>({project:{id:'1234567890abcdef',path:'D:/fixture',name:'Fixture'},source:{},norm:{base:{projectId:'1234567890abcdef',version:1},hash:'a'.repeat(64),dirty:false,pending:false,blocked:false}}))
vi.mock('../src/stores/registered-project',()=>({useRegisteredProjectStore:()=>({project:fixture.project,currentSource:fixture.source})}))
vi.mock('../src/stores/project-art-spec',()=>({useProjectArtSpecStore:()=>({...fixture.norm,phase:'editing',context:{projectId:fixture.project.id,projectPath:fixture.project.path,source:fixture.source}})}))
const spec=(category:'icon'|'ui'='icon',policy:'fixed'|'per-asset'='fixed'):WorkbenchSpec=>({id:category,name:'Fixture '+category,category,version:1,sizePolicy:policy,width:128,height:128,destination:'assets/art',exportDirectory:'art/final',imageOutput:'transparent-png',style:'Fixture style',references:[]})
const doc=(s=spec()):WorkbenchDocument=>({schemaVersion:'art-workbench-v1',projectId:fixture.project.id,projectPath:fixture.project.path,version:1,norm:{hash:'a'.repeat(64),version:1},projectReferences:[],specs:[s],needs:[]})
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();aiReferenceUploadProvider.value=null;aiResourceReadProvider.value=null;sessionStorage.clear();localStorage.clear();vi.unstubAllGlobals()})
async function render(value=doc(),view:'specs'|'needs'='needs',prepared=false,conditioning=false) {const pinia=createPinia();setActivePinia(pinia);vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({projectId:fixture.project.id,projectPath:fixture.project.path,hash:'b'.repeat(64),document:value,capabilities:{generation:false,imageConditioning:false,referenceUpload:true,existingJobLink:true,...(prepared?{preparedTasks:{categories:['icon'],maxBatch:1,imageConditioning:conditioning,...(conditioning?{referenceModes:['evidence-only','image-conditioning']}:{})}}:{})}}))));wrapper=mount(ArtWorkbenchManager,{props:{view},global:{plugins:[pinia],stubs:{ElDialog:{props:['modelValue'],template:'<div v-if="modelValue" role="dialog"><slot/></div>'},AiJobsReadPanel:true}}});await click('读取 / 刷新工作台');await flushPromises();return useArtWorkbenchStore(pinia)}
function button(text:string){return wrapper!.findAll('button').find(b=>b.text()===text)!}
async function click(text:string){await button(text).trigger('click')}

const reference=(name:string,letter:string)=>({name,relativePath:'art/reference/'+name+'.png',sha256:letter.repeat(64)})
const preview=(sha256:string)=>({base64:'aGVsbG8=',sha256,width:16,height:16,mimeType:'image/png' as const})
async function openReferences(){await wrapper!.findAll('button').find(b=>b.text().startsWith('\u9879\u76ee\u53c2\u8003'))!.trigger('click')}
function cards(){return wrapper!.findAll('[data-testid="reference-card"]')}
async function readCard(index:number){await cards()[index]!.get('[data-testid="reference-preview-action"]').trigger('click');await flushPromises()}
function provider(read:AiResourceReadProvider['previewReference']){aiResourceReadProvider.value={label:'Isolated reference fixture',readConfig:vi.fn(),previewReference:read}}
describe('attached reference cards (isolated component fixtures)',()=>{
 it('does not read on opening and retains separately verified images after explicit per-card reads',async()=>{
  const value=doc();value.projectReferences=[reference('one','c'),reference('two','d')];const read=vi.fn(async(_id:string,path:string)=>preview(path.includes('one')?'c'.repeat(64):'d'.repeat(64)));provider(read);await render(value);await openReferences();expect(read).not.toHaveBeenCalled();expect(cards()).toHaveLength(2);expect(wrapper!.findAll('[data-testid="reference-card-image"]')).toHaveLength(0);await readCard(0);await readCard(1);expect(read).toHaveBeenCalledTimes(2);expect(wrapper!.findAll('[data-testid="reference-card-image"]')).toHaveLength(2);expect(cards()[0]!.get('img').attributes('src')).toBe('data:image/png;base64,aGVsbG8=');expect(cards()[1]!.get('img').attributes('src')).toBe('data:image/png;base64,aGVsbG8=');expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('keeps a hash mismatch in its own card and preserves draft references and another verified image',async()=>{
  const value=doc();value.projectReferences=[reference('one','c'),reference('two','d')];provider(vi.fn(async(_id:string,path:string)=>preview(path.includes('one')?'c'.repeat(64):'f'.repeat(64))));const store=await render(value);await openReferences();await readCard(0);await readCard(1);expect(cards()[0]!.find('img').exists()).toBe(true);expect(cards()[1]!.find('img').exists()).toBe(false);expect(cards()[1]!.get('[role="alert"]').text()).toContain('\u54c8\u5e0c');expect(store.draft!.projectReferences).toEqual(value.projectReferences);expect(store.dirty).toBe(false)
 })
 it('shows read and browser-display failures locally without clearing saved associations',async()=>{
  const value=doc();value.projectReferences=[reference('one','c'),reference('two','d')];provider(vi.fn(async(_id:string,path:string)=>{if(path.includes('two'))throw Error('fixture read unavailable');return preview('c'.repeat(64))}));const store=await render(value);await openReferences();await readCard(0);await readCard(1);expect(cards()[1]!.find('[role="alert"]').exists()).toBe(true);await cards()[0]!.get('img').trigger('error');expect(cards()[0]!.find('img').exists()).toBe(false);expect(cards()[0]!.find('[role="alert"]').exists()).toBe(true);expect(store.draft!.projectReferences).toEqual(value.projectReferences)
 })
 it('clears images and ignores late responses after the provider/context identity boundary changes',async()=>{
  const value=doc();value.projectReferences=[reference('one','c')];let resolve!:(v:ReturnType<typeof preview>)=>void;const read=vi.fn(()=>new Promise<ReturnType<typeof preview>>(r=>resolve=r));provider(read);const store=await render(value);await openReferences();await cards()[0]!.get('[data-testid="reference-preview-action"]').trigger('click');provider(vi.fn(async()=>preview('c'.repeat(64))));await flushPromises();resolve(preview('c'.repeat(64)));await flushPromises();await openReferences();expect(cards()[0]!.find('img').exists()).toBe(false);expect(store.draft!.projectReferences).toEqual(value.projectReferences)
 })
 it('rejects a late preview when the associated reference hash changes without clearing the draft',async()=>{
  const value=doc();value.projectReferences=[reference('one','c')];let resolve!:(v:ReturnType<typeof preview>)=>void;provider(vi.fn(()=>new Promise<ReturnType<typeof preview>>(r=>resolve=r)));const store=await render(value);await openReferences();await cards()[0]!.get('[data-testid="reference-preview-action"]').trigger('click');store.draft!.projectReferences[0]!.sha256='d'.repeat(64);resolve(preview('c'.repeat(64)));await flushPromises();expect(cards()[0]!.find('img').exists()).toBe(false);expect(store.draft!.projectReferences[0]!.sha256).toBe('d'.repeat(64))
 })
 it('clears loaded thumbnails when moving from project references to a specification target',async()=>{
  const value=doc();value.projectReferences=[reference('one','c')];value.specs[0]!.references=[reference('two','d')];const read=vi.fn(async()=>preview('c'.repeat(64)));provider(read);const store=await render(value,'specs');await openReferences();await readCard(0);expect(cards()[0]!.find('img').exists()).toBe(true);await click('\u524d\u5f80\u53c2\u8003\u7d20\u6750\u91c7\u96c6');await click('\u7f16\u8f91');await wrapper!.findAll('button').find(b=>b.text().startsWith('\u89c4\u683c\u53c2\u8003'))!.trigger('click');expect(cards()).toHaveLength(1);expect(cards()[0]!.text()).toContain('two');expect(cards()[0]!.find('img').exists()).toBe(false);expect(read).toHaveBeenCalledTimes(1);expect(store.draft!.projectReferences).toEqual(value.projectReferences)
 })
 it('does not use unverified reference paths as image URLs when the preview capability is unavailable',async()=>{
  const value=doc();value.projectReferences=[reference('one','c')];await render(value);await openReferences();expect(cards()).toHaveLength(1);expect(cards()[0]!.find('img').exists()).toBe(false);expect(cards()[0]!.get('[data-testid="reference-preview-action"]').attributes('disabled')).toBeDefined();expect(cards()[0]!.find('[data-testid="reference-placeholder"]').exists()).toBe(true)
 })
})

describe('existing prepared batch presentation',()=>{
 it('keeps selection count and existing controls below the table, sticky and wrapping, without creating a task',async()=>{
  const value=doc();value.needs=[{id:'batch',name:'Batch fixture',content:'Fixture content',version:1,specId:'icon',specVersion:1,spec:spec(),references:[]}];await render(value,'needs',true);expect(wrapper!.find('[data-testid="workbench-batch-actions"]').exists()).toBe(false);await wrapper!.get('input[aria-label="\u9009\u62e9\u9700\u6c42 Batch fixture"]').setValue(true);const batch=wrapper!.get('[data-testid="workbench-batch-actions"]');expect(batch.get('strong').text()).toContain('1');expect(wrapper!.get('.table-scroll').element.compareDocumentPosition(batch.element)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(batch.findAll('button')).toHaveLength(2);expect(fetch).toHaveBeenCalledTimes(1);const source=managerSource;expect(source).toMatch(/\.batch-actions\{position:sticky;bottom:12px;/);expect(source).toMatch(/\.batch-actions,\.task-result\{[^}]*flex-wrap:wrap/)
 })
})

