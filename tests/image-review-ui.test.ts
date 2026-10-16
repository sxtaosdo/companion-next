import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import ImageAssetsView from '../src/views/ImageAssetsView.vue'
import { useImageReviewStore } from '../src/stores/image-review'
import { imageReviewProvider, registerImageReviewProvider } from '../src/image-review-integration'
import type { ImageReviewProvider } from '../src/domain/image-review'
const taskId='a'.repeat(32),imageId='b'.repeat(32)
let wrapper:VueWrapper|undefined
let activePinia:ReturnType<typeof createPinia>
const manifest=()=>JSON.stringify({schema_version:1,images:[{image_url:'https://example.org/a.png',source_page:'https://example.org/',title:'本页候选'}]})
function provider(overrides:Partial<ImageReviewProvider>={}):ImageReviewProvider{return {label:'offline UI test provider',saveSelectionGuard:'unverified',loadState:async()=>({taskId,busy:false,items:[{id:imageId,title:'已下载候选',status:'ready',selected:false,width:32,height:32,contentType:'image/png'}]}),importCandidates:vi.fn(async()=>{}),loadPreview:vi.fn(async()=>({kind:'same-origin-image' as const,path:`/image/test-session-placeholder-only/${imageId}/full`})),saveSelected:vi.fn(async()=>({cancelled:true,results:[]})),...overrides}}
async function setup(p?:ImageReviewProvider){if(p)registerImageReviewProvider(p);const pinia=createPinia();activePinia=pinia;wrapper=mount(ImageAssetsView,{attachTo:document.body,global:{plugins:[pinia,ElementPlus]}});await flushPromises();return useImageReviewStore(pinia)}
function button(text:string){const b=wrapper!.findAll('button').find(e=>e.text().includes(text));if(!b)throw new Error(`missing ${text}`);return b}
async function stage(){await wrapper!.find('textarea[aria-label="Picker 候选 JSON"]').setValue(manifest());await button('解析候选清单').trigger('click');await flushPromises()}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;imageReviewProvider.value=null;document.body.innerHTML='';vi.unstubAllGlobals();vi.restoreAllMocks()})
describe('in-page review without remote image requests',()=>{
 it('parses and lists addresses while disconnected without setting any remote image src',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await setup();await stage();expect(wrapper!.text()).toContain('本页候选');expect(wrapper!.text()).toContain('https://example.org/a.png');expect(wrapper!.findAll('img')).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();expect(button('导入并下载').attributes('disabled')).toBeDefined();expect(button('保存选中').attributes('disabled')).toBeDefined()})
 it('uses only the fixed same-origin service path for inline preview under the existing CSP',async()=>{const p=provider();await setup(p);await button('连接本机').trigger('click');await flushPromises();await button('页内查看').trigger('click');await flushPromises();expect(p.loadPreview).toHaveBeenCalledWith(imageId,'full',expect.any(AbortSignal));expect(wrapper!.find('img').attributes('src')).toBe(`/image/test-session-placeholder-only/${imageId}/full`);expect(wrapper!.find('img').attributes('src')).not.toContain('example.org')})
 it('does not enable native saving just because a service says ready',async()=>{await setup(provider());await button('连接本机').trigger('click');await flushPromises();await wrapper!.find('.image-review-row input[type=checkbox]').setValue(true);expect(button('保存选中').attributes('disabled')).toBeDefined();expect(wrapper!.text()).toContain('一致性保护尚未接通验证')})
 it('invalidates a delayed preview when the task changes',async()=>{let finish!:(source:{kind:'same-origin-image';path:string})=>void;const p=provider({loadPreview:()=>new Promise(r=>{finish=r})});const store=await setup(p);await button('连接本机').trigger('click');await flushPromises();await button('页内查看').trigger('click');p.loadState=async()=>({taskId:'c'.repeat(32),busy:false,items:[]});await store.refresh();await flushPromises();finish({kind:'same-origin-image',path:`/image/test-session-placeholder-only/${imageId}/full`});await flushPromises();expect(wrapper!.findAll('img')).toHaveLength(0)})
 it('does not submit the prior manifest during a new file read or after an unparsed text edit',async()=>{const p=provider();await setup(p);await button('连接本机').trigger('click');await flushPromises();await stage();const checkbox=wrapper!.findAll('label.el-checkbox').find(e=>e.text().includes('确认由本机'))!.find('input');await checkbox.setValue(true);expect(button('导入并下载').attributes('disabled')).toBeUndefined();let finish!:(value:string)=>void;const file={size:100,text:()=>new Promise<string>(r=>{finish=r})};const input=wrapper!.find('input[type=file]');Object.defineProperty(input.element,'files',{value:[file],configurable:true});await input.trigger('change');await flushPromises();expect(button('导入并下载').attributes('disabled')).toBeDefined();finish(manifest());await flushPromises();expect(button('导入并下载').attributes('disabled')).toBeDefined();expect(p.importCandidates).not.toHaveBeenCalled()})
 it('defers a provider replacement until the active write settles, then closes the old connection',async()=>{let finish!:()=>void;const p=provider({importCandidates:()=>new Promise<void>(r=>{finish=r})});const store=await setup(p);await button('连接本机').trigger('click');await flushPromises();await stage();const pending=store.submitImport(true);registerImageReviewProvider(provider());await flushPromises();expect(store.mutation).toBe('import');finish();await pending;await flushPromises();expect(store.provider).toBeNull();expect(store.connected).toBe(false)})
})

it('rejects an arbitrary remote or wrong-item preview path from an injected provider',async()=>{
 const p=provider({loadPreview:async()=>({kind:'same-origin-image',path:'https://example.org/private.png'})});await setup(p);await button('连接本机').trigger('click');await flushPromises();await button('页内查看').trigger('click');await flushPromises();expect(wrapper!.findAll('img')).toHaveLength(0);expect(wrapper!.text()).toContain('不属于当前候选')
})
it('rechecks registered identity immediately on remount after a navigation-away change',async()=>{
 const p=provider();const store=await setup(p);await button('连接本机').trigger('click');await flushPromises();const pinia=activePinia;wrapper!.unmount();wrapper=undefined;registerImageReviewProvider(provider());wrapper=mount(ImageAssetsView,{attachTo:document.body,global:{plugins:[pinia,ElementPlus]}});await flushPromises();expect(store.provider).toBeNull();expect(store.connected).toBe(false)
})
