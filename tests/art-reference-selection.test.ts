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


import {pngBytes,testCrypto} from './fixtures/generation-png'
function image(name:string,width=16):File {const bytes=pngBytes(width);return {name,size:bytes.length,type:'image/png',arrayBuffer:async()=>bytes.slice().buffer} as File}
async function ready(value=doc()) {vi.stubGlobal('crypto',testCrypto);vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:16,height:16,close:vi.fn()})));const upload=vi.fn();aiReferenceUploadProvider.value={label:'Isolated queue fixture',uploadReference:upload,waitForIdle:async()=>{}};const store=await render(value);await wrapper!.findAll('button').find(b=>b.text().startsWith('项目参考'))!.trigger('click');return {store,upload}}
async function pick(files:File[]) {const input=wrapper!.get('input[type="file"]');Object.defineProperty(input.element,'files',{configurable:true,value:files});await input.trigger('change');await flushPromises()}
async function loaded(name:string) {await vi.waitFor(()=>expect(wrapper!.find('img[alt="本地预览：'+name+'"]').exists()).toBe(true));await wrapper!.get('img[alt="本地预览：'+name+'"]').trigger('load')}

async function receiptFor(width=16) {const bytes=pngBytes(width),originalSha256=Array.from(new Uint8Array(await testCrypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''),sha256=(width===16?'e':'f').repeat(64);return {schemaVersion:'companion-icons-v1' as const,relativePath:'art/reference/companion/'+sha256+'.png',sha256,width,height:16,mimeType:'image/png' as const,originalRelativePath:'art/reference/companion/original/'+originalSha256+'.png',originalSha256}}
async function approveLocal() {await wrapper!.get('input[type="checkbox"]').setValue(true);await click('上传并关联本层草稿');await flushPromises()}

describe('reference local selection queue (isolated UI boundary)',()=>{
 it('retains all selected local files and requires a separate explicit preview for the next image without uploading',async()=>{
  const {upload}=await ready();await pick([image('one.png'),image('two.png')]);await loaded('one.png');expect(wrapper!.get('input[type="file"]').attributes('multiple')).toBeDefined();const queue=wrapper!.get('[data-testid="reference-selection-queue"]');expect(queue.text()).toContain('one.png');expect(queue.text()).toContain('two.png');await queue.get('button[aria-label="预览队列图片 2"]').trigger('click');await loaded('two.png');expect(upload).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('clears the queue and keeps a late upload receipt unassociated after closing and reopening the same target',async()=>{
  const {store,upload}=await ready();const receipt=await receiptFor();let resolve!:(value:typeof receipt)=>void;upload.mockImplementation(()=>new Promise(r=>resolve=r));await pick([image('one.png'),image('two.png')]);await loaded('one.png');await approveLocal();await click('前往参考素材采集');await wrapper!.findAll('button').find(b=>b.text().startsWith('项目参考'))!.trigger('click');expect(wrapper!.find('[data-testid="reference-selection-queue"]').exists()).toBe(false);resolve(receipt);await flushPromises();expect(store.draft!.projectReferences).toEqual([]);expect(upload).toHaveBeenCalledTimes(1);expect(wrapper!.text()).toContain('明确恢复到本层草稿')
 })

 it('uploads only the active image after its own preview/approval and resets approval for the next image',async()=>{
  const {upload,store}=await ready(),one=await receiptFor(),two=await receiptFor(32);upload.mockResolvedValueOnce(one).mockResolvedValueOnce(two);await pick([image('one.png'),image('two.png',32)]);await loaded('one.png');expect(button('上传并关联本层草稿').attributes('disabled')).toBeDefined();await approveLocal();expect(upload).toHaveBeenCalledTimes(1);expect(store.draft!.projectReferences).toHaveLength(1);vi.mocked(createImageBitmap).mockResolvedValueOnce({width:32,height:16,close:vi.fn()} as ImageBitmap);await wrapper!.get('button[aria-label="预览队列图片 2"]').trigger('click');await loaded('two.png');expect((wrapper!.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false);expect(button('上传并关联本层草稿').attributes('disabled')).toBeDefined();await approveLocal();expect(upload).toHaveBeenCalledTimes(2);expect(store.draft!.projectReferences).toHaveLength(2);expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('retains every dropped or pasted file without uploading and leaves ordinary text paste untouched',async()=>{
  const {upload}=await ready();await wrapper!.get('.reference-drop').trigger('drop',{dataTransfer:{files:[image('drop-one.png'),image('drop-two.png')]}});await loaded('drop-one.png');expect(wrapper!.get('[data-testid="reference-selection-queue"]').text()).toContain('drop-two.png');const plain=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(plain,'clipboardData',{value:{items:[{kind:'string',getAsFile:()=>null}]}});wrapper!.get('.reference-editor').element.dispatchEvent(plain);expect(plain.defaultPrevented).toBe(false);const pasted=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(pasted,'clipboardData',{value:{items:[{kind:'file',getAsFile:()=>image('paste-one.png')},{kind:'file',getAsFile:()=>image('paste-two.png')}]}});wrapper!.get('.reference-editor').element.dispatchEvent(pasted);await loaded('paste-one.png');expect(pasted.defaultPrevented).toBe(true);expect(wrapper!.get('[data-testid="reference-selection-queue"]').text()).toContain('paste-two.png');expect(upload).not.toHaveBeenCalled()
 })
 it('bounds selection by remaining slots and reports all files that were not queued',async()=>{
  const value=doc();value.projectReferences=['a','b','c'].map(letter=>({name:letter,relativePath:'art/reference/'+letter+'.png',sha256:letter.repeat(64)}));const {upload}=await ready(value);await pick([image('one.png'),image('two.png'),image('three.png')]);await loaded('one.png');expect(wrapper!.get('[data-testid="reference-selection-queue"]').findAll('li')).toHaveLength(1);expect(wrapper!.text()).toContain('2 张未加入');expect(upload).not.toHaveBeenCalled()
 })
 it('shows an invalid first file and allows only explicit selection of another valid queued image',async()=>{
  const {upload}=await ready();await pick([{name:'bad.txt',size:3,type:'text/plain',arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer} as File,image('good.png')]);await flushPromises();expect(wrapper!.find('img[alt^="本地预览："]').exists()).toBe(false);expect(wrapper!.find('[role="alert"]').exists()).toBe(true);expect(wrapper!.get('[data-testid="reference-selection-queue"]').text()).toContain('bad.txt');await wrapper!.get('button[aria-label="预览队列图片 2"]').trigger('click');await loaded('good.png');expect(upload).not.toHaveBeenCalled()
 })
 it('stops the whole local queue on an UNKNOWN upload and never resends it or advances another file',async()=>{
  const {upload,store}=await ready();upload.mockRejectedValueOnce(Error('Isolated upload outcome unknown'));await pick([image('one.png'),image('two.png')]);await loaded('one.png');await approveLocal();expect(upload).toHaveBeenCalledTimes(1);expect(wrapper!.get('input[type="file"]').attributes('disabled')).toBeDefined();expect(wrapper!.get('[data-testid="reference-selection-queue"]').text()).toContain('队列已暂停');expect(wrapper!.get('button[aria-label="预览队列图片 2"]').attributes('disabled')).toBeDefined();await wrapper!.get('button[aria-label="预览队列图片 2"]').trigger('click');await pick([image('third.png')]);expect(wrapper!.get('[data-testid="reference-selection-queue"]').text()).not.toContain('third.png');expect(upload).toHaveBeenCalledTimes(1);expect(store.draft!.projectReferences).toEqual([])
 })
 it('does not upload the same original again when its confirmed receipt is already associated',async()=>{
  const {upload,store}=await ready(),receipt=await receiptFor();upload.mockResolvedValueOnce(receipt);await pick([image('one.png'),image('same-bytes.png')]);await loaded('one.png');await approveLocal();await wrapper!.get('button[aria-label="预览队列图片 2"]').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('此图片已关联到当前层');expect(wrapper!.find('img[alt="本地预览：same-bytes.png"]').exists()).toBe(false);expect(upload).toHaveBeenCalledTimes(1);expect(store.draft!.projectReferences).toHaveLength(1)
 })
 it('clears selected files and ignores late decode after the upload provider identity changes',async()=>{
  const {upload,store}=await ready();let resolve!:(bitmap:ImageBitmap)=>void;vi.mocked(createImageBitmap).mockImplementationOnce(()=>new Promise(r=>resolve=r));await pick([image('one.png'),image('two.png')]);aiReferenceUploadProvider.value={label:'New fixture provider',uploadReference:vi.fn(),waitForIdle:async()=>{}};await flushPromises();resolve({width:16,height:16,close:vi.fn()} as ImageBitmap);await flushPromises();await wrapper!.findAll('button').find(b=>b.text().startsWith('项目参考'))!.trigger('click');expect(wrapper!.find('[data-testid="reference-selection-queue"]').exists()).toBe(false);expect(wrapper!.find('img[alt^="本地预览："]').exists()).toBe(false);expect(store.draft!.projectReferences).toEqual([]);expect(upload).not.toHaveBeenCalled()
 })
 it('keeps the original queue while an explicit upload is still in flight',async()=>{
  const {upload}=await ready();const receipt=await receiptFor();let resolve!:(value:typeof receipt)=>void;upload.mockImplementation(()=>new Promise(r=>resolve=r));await pick([image('one.png'),image('two.png')]);await loaded('one.png');await approveLocal();await pick([image('replacement.png')]);expect(wrapper!.get('[data-testid="reference-selection-queue"]').text()).toContain('two.png');expect(wrapper!.get('[data-testid="reference-selection-queue"]').text()).not.toContain('replacement.png');resolve(receipt);await flushPromises();expect(upload).toHaveBeenCalledTimes(1)
 })

 it('keeps an existing UNKNOWN file blocked after reopening without replaying the original upload',async()=>{
  const {upload}=await ready();upload.mockRejectedValueOnce(Error('Isolated unknown receipt'));await pick([image('one.png')]);await loaded('one.png');await approveLocal();await click('前往参考素材采集');await wrapper!.findAll('button').find(b=>b.text().startsWith('项目参考'))!.trigger('click');await pick([image('same-original.png'),image('other.png')]);await vi.waitFor(()=>expect(wrapper!.text()).toContain('存在结果未知的上传记录'));expect(wrapper!.get('[data-testid="reference-selection-queue"]').text()).toContain('队列已暂停');expect(wrapper!.get('button[aria-label="预览队列图片 2"]').attributes('disabled')).toBeDefined();expect(upload).toHaveBeenCalledTimes(1)
 })

})
