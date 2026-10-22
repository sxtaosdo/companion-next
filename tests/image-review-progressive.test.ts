import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Panel from '../src/components/CompanionImageReviewPanel.vue'
import { useImageReviewStore } from '../src/stores/image-review'
import { imageReviewProvider, registerImageReviewProvider } from '../src/image-review-integration'
import type { ImageReviewProvider, ImageReviewSnapshot } from '../src/domain/image-review'
const task='a'.repeat(32), image='b'.repeat(32)
let wrapper:VueWrapper|undefined
const manifest=JSON.stringify({schema_version:1,images:[{image_url:'https://example.org/a.png',source_page:'https://example.org/',title:'候选地址'}]})
function button(text:string){const found=wrapper!.findAll('button').find(node=>node.text()===text);if(!found)throw Error(`missing button ${text}`);return found}
async function setup(data:Partial<ImageReviewSnapshot>={}){
 let state:ImageReviewSnapshot={taskId:task,busy:false,items:[{id:image,title:'测试候选',status:'ready',selected:true,width:32,height:32,contentType:'image/png'}],...data}
 const p:ImageReviewProvider={label:'isolated mocked review',workflowGuard:'verified',selectionGuard:'verified',saveSelectionGuard:'verified',loadState:vi.fn(async()=>state),importCandidates:vi.fn(async()=>{}),loadPreview:vi.fn(async(_id:string,variant:'thumb'|'full')=>({kind:'same-origin-image' as const,path:`/owner-review/image/${image}/${variant}`})),saveSelected:vi.fn(async()=>({cancelled:true,results:[]})),persistSelection:vi.fn(async(_task,ids)=>{state={...state,items:state.items.map(item=>({...item,selected:ids.includes(item.id)}))}})}
 registerImageReviewProvider(p);const pinia=createPinia();wrapper=mount(Panel,{attachTo:document.body,global:{plugins:[pinia,ElementPlus]}});await flushPromises();return {store:useImageReviewStore(pinia),p,setState:(next:ImageReviewSnapshot)=>{state=next}}
}
async function connect(){await button('连接本机审阅服务').trigger('click');await flushPromises()}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;imageReviewProvider.value=null;document.body.innerHTML='';vi.restoreAllMocks()})
it('disconnected manifest parsing exposes no future review, download or save cards',async()=>{
 const {p}=await setup();await wrapper!.get('textarea').setValue(manifest);await button('解析候选清单（不下载）').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('候选地址');expect(wrapper!.find('[data-testid=image-review-step]').exists()).toBe(false);expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(false);expect(wrapper!.text()).not.toContain('导入并下载到审阅区');expect(p.importCandidates).not.toHaveBeenCalled();expect(p.saveSelected).not.toHaveBeenCalled()
})
it('reveals saving only after confirmed selection and a result only after a real receipt',async()=>{
 const {p}=await setup();await connect();expect(wrapper!.find('[data-testid=image-review-step]').exists()).toBe(true);expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(false);await button('确认选择').trigger('click');await flushPromises();expect(wrapper!.find('[data-testid=image-review-step]').exists()).toBe(false);expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(true);expect(wrapper!.find('[data-testid=image-result-step]').exists()).toBe(false);await button('保存选中 · 选择目录').trigger('click');await flushPromises();expect(p.saveSelected).toHaveBeenCalledOnce();expect(wrapper!.get('[data-testid=image-result-step]').text()).toContain('目录选择已取消');expect(wrapper!.text()).not.toContain('已保存');await button('返回保存').trigger('click');await flushPromises();expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(true)
})
it('backtracking retains source input and resumes the same existing task without searching',async()=>{
 const {store,p}=await setup();await wrapper!.get('textarea').setValue(manifest);await connect();await button('返回修改来源').trigger('click');await flushPromises();expect((wrapper!.get('textarea').element as HTMLTextAreaElement).value).toBe(manifest);expect(store.snapshot.taskId).toBe(task);await button('继续审阅现有候选').trigger('click');await flushPromises();expect(wrapper!.find('[data-testid=image-review-step]').exists()).toBe(true);expect(p.importCandidates).not.toHaveBeenCalled()
})
it('keeps waiting downloads in the current phase and hides review and save',async()=>{
 const {setState,store}=await setup({busy:true,items:[{id:image,title:'排队候选',status:'waiting',selected:false,width:null,height:null,contentType:null}]});await connect();expect(wrapper!.text()).toContain('采集素材');expect(wrapper!.find('[data-testid=image-review-step]').exists()).toBe(false);expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(false);setState({taskId:task,busy:false,items:[{id:image,title:'测试候选',status:'ready',selected:true,width:32,height:32,contentType:'image/png'}]});await store.refresh();await flushPromises();expect(wrapper!.find('[data-testid=image-review-step]').exists()).toBe(true)
})
it('task changes invalidate the save step instead of showing a prior task receipt',async()=>{
 const {setState,store}=await setup();await connect();await button('确认选择').trigger('click');setState({taskId:'c'.repeat(32),busy:false,items:[]});await store.refresh();await flushPromises();expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(false);expect(wrapper!.find('[data-testid=image-result-step]').exists()).toBe(false);expect(wrapper!.find('[data-testid=image-source-step]').exists()).toBe(true)
})
it('unknown writes never expose a second save or replacement request',async()=>{
 const {store}=await setup();await connect();store.uncertain=true;await flushPromises();expect(button('确认选择').attributes('disabled')).toBeDefined();expect(button('返回修改来源').attributes('disabled')).toBeDefined();expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(false)
})
it('refresh failure returns to current connection/source area without stale review controls',async()=>{
 const {store,p}=await setup();await connect();p.loadState=vi.fn(async()=>{throw Error('isolated read failure')});await store.refresh();await flushPromises();expect(wrapper!.text()).toContain('isolated read failure');expect(wrapper!.find('[data-testid=image-review-step]').exists()).toBe(false);expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(false);expect(button('连接本机审阅服务').exists()).toBe(true)
})

it('owner-review exposes only its supported existing-candidate workflow',async()=>{
 const {p}=await setup();registerImageReviewProvider({...p,candidateImportEnabled:false,workflowGuard:'unverified',searchImages:undefined});await flushPromises();expect(wrapper!.find('textarea').exists()).toBe(false);expect(wrapper!.text()).not.toContain('关键词搜索');expect(wrapper!.text()).not.toContain('导入候选清单');await connect();expect(wrapper!.find('[data-testid=image-review-step]').exists()).toBe(true);expect(wrapper!.text()).not.toContain('回收区');expect(wrapper!.text()).not.toContain('请求停止下载');await button('确认选择').trigger('click');await flushPromises();expect(wrapper!.find('[data-testid=image-save-step]').exists()).toBe(true)
})
it('a changed or still-reading manifest cannot reuse the previous download confirmation',async()=>{
 const {store,p}=await setup();await connect();await button('返回修改来源').trigger('click');await wrapper!.get('textarea').setValue(manifest);await button('解析候选清单（不下载）').trigger('click');await flushPromises();const checkbox=wrapper!.findAll('label.el-checkbox').find(node=>node.text().includes('确认由本机'))!.get('input');await checkbox.setValue(true);expect(button('导入并下载到审阅区').attributes('disabled')).toBeUndefined();let finish!:(text:string)=>void;const file={size:100,text:()=>new Promise<string>(resolve=>{finish=resolve})};const input=wrapper!.get('input[type=file]');Object.defineProperty(input.element,'files',{value:[file],configurable:true});await input.trigger('change');await flushPromises();expect(button('导入并下载到审阅区').attributes('disabled')).toBeDefined();finish(manifest);await flushPromises();expect(button('导入并下载到审阅区').attributes('disabled')).toBeDefined();expect(p.importCandidates).not.toHaveBeenCalled();expect(store.snapshot.taskId).toBe(task)
})
it('provider replacement waits for the pending write and never replays it',async()=>{
 const {store,p}=await setup();await connect();await button('返回修改来源').trigger('click');await wrapper!.get('textarea').setValue(manifest);await button('解析候选清单（不下载）').trigger('click');let finish!:()=>void;p.importCandidates=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve}));const pending=store.submitImport(true);registerImageReviewProvider({...p,label:'replacement provider'});await flushPromises();expect(store.mutation).toBe('import');finish();await pending;await flushPromises();expect(store.provider).toBeNull();expect(store.connected).toBe(false);expect(p.importCandidates).toHaveBeenCalledOnce()
})
