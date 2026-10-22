import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
import ImageAssetsView from '../src/views/ImageAssetsView.vue'
import PublicImageCollectorFrame from '../src/components/PublicImageCollectorFrame.vue'
import { PUBLIC_IMAGE_COLLECTOR_URL, PUBLIC_IMAGE_COLLECTOR_ORIGIN, PUBLIC_IMAGE_COLLECTOR_READY_TIMEOUT_MS, isPublicImageCollectorReady } from '../src/domain/public-image-collector'
import { imageReviewProvider } from '../src/image-review-integration'
import { companionBrowserProvider, companionProjectEntryProvider } from '../src/companion-browser-integration'
let wrapper:VueWrapper|undefined
const ready={type:'public-image-review:ready',version:1}
function deliver(frame:HTMLIFrameElement,data:unknown=ready,origin=PUBLIC_IMAGE_COLLECTOR_ORIGIN,source:Window|null=frame.contentWindow){window.dispatchEvent(new MessageEvent('message',{origin,source,data}))}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;imageReviewProvider.value=null;companionBrowserProvider.value=null;companionProjectEntryProvider.value=null;document.body.innerHTML='';vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()})
describe('fixed loopback collector trust contract',()=>{
 it.each([
  ['wrong origin','http://localhost:32182',ready,true],
  ['wrong port','http://127.0.0.1:32183',ready,true],
  ['wrong window',PUBLIC_IMAGE_COLLECTOR_ORIGIN,ready,false],
  ['wrong version',PUBLIC_IMAGE_COLLECTOR_ORIGIN,{...ready,version:2},true],
  ['extra data',PUBLIC_IMAGE_COLLECTOR_ORIGIN,{...ready,token:'not-accepted'},true],
  ['array payload',PUBLIC_IMAGE_COLLECTOR_ORIGIN,[ready],true],
  ['null payload',PUBLIC_IMAGE_COLLECTOR_ORIGIN,null,true],
 ] as const)('rejects %s',(_name,origin,data,sameWindow)=>{
  const own={} as Window,other={} as Window
  expect(isPublicImageCollectorReady({origin,data,source:sameWindow?own:other},own)).toBe(false)
 })
 it('accepts only the expected document handshake',()=>{
  const own={} as Window
  expect(isPublicImageCollectorReady({origin:PUBLIC_IMAGE_COLLECTOR_ORIGIN,source:own,data:ready},own)).toBe(true)
  expect(isPublicImageCollectorReady({origin:PUBLIC_IMAGE_COLLECTOR_ORIGIN,source:null,data:ready},null)).toBe(false)
 })
})
describe('collector iframe feedback and retry',()=>{
 it('waits for its own trusted message instead of load and ignores unsolicited messages',async()=>{
  vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn())
  wrapper=mount(PublicImageCollectorFrame,{attachTo:document.body,global:{plugins:[ElementPlus]}})
  const frame=wrapper.get('iframe').element as HTMLIFrameElement
  expect(frame.getAttribute('src')).toBe(PUBLIC_IMAGE_COLLECTOR_URL)
  await wrapper.get('iframe').trigger('load');expect(wrapper.text()).toContain('加载中')
  deliver(frame,ready,PUBLIC_IMAGE_COLLECTOR_ORIGIN,window);await flushPromises();expect(wrapper.text()).not.toContain('已就绪')
  deliver(frame);await flushPromises();expect(wrapper.text()).toContain('已就绪');expect(wrapper.get('iframe').isVisible()).toBe(true)
  const link=wrapper.get('a');expect(link.attributes('href')).toBe(PUBLIC_IMAGE_COLLECTOR_URL);expect(link.attributes('rel')).toBe('noopener noreferrer')
  expect(fetch).not.toHaveBeenCalled()
 })
 it('offers bounded unavailable feedback, retries a new window, and rejects the old window',async()=>{
  vi.useFakeTimers();wrapper=mount(PublicImageCollectorFrame,{attachTo:document.body,global:{plugins:[ElementPlus]}})
  const previous=wrapper.get('iframe').element as HTMLIFrameElement,previousWindow=previous.contentWindow
  await vi.advanceTimersByTimeAsync(PUBLIC_IMAGE_COLLECTOR_READY_TIMEOUT_MS)
  expect(wrapper.text()).toContain('未确认就绪');expect(wrapper.text()).toContain('npm run start:companion')
  await wrapper.get('button').trigger('click');await flushPromises()
  const current=wrapper.get('iframe').element as HTMLIFrameElement
  expect(current).not.toBe(previous);expect(wrapper.text()).toContain('加载中')
  deliver(current,ready,PUBLIC_IMAGE_COLLECTOR_ORIGIN,previousWindow);await flushPromises();expect(wrapper.text()).not.toContain('已就绪')
  deliver(current);await flushPromises();expect(wrapper.text()).toContain('已就绪')
 })
})
describe('existing image assets route retains the independent document',()=>{
 it('keeps one connected iframe across labels, routes, query edits and knowledge cache expiry',async()=>{
  vi.stubGlobal('fetch',vi.fn())
  const empty={template:'<p>Other page</p>'},router=createRouter({history:createMemoryHistory(),routes:[{path:'/art-resources',component:ImageAssetsView},{path:'/overview',component:empty},{path:'/help',component:empty},{path:'/knowledge',component:empty}]})
  await router.push('/art-resources?references=1&url=https://untrusted.example/');await router.isReady()
  wrapper=mount(App,{attachTo:document.body,global:{plugins:[createPinia(),router,ElementPlus]}});await flushPromises()
  const frame=wrapper.get('iframe.collector-frame').element as HTMLIFrameElement
  deliver(frame);await flushPromises();expect(wrapper.text()).toContain('已就绪')
  expect(wrapper.find('[data-testid="companion-image-review-panel"]').exists()).toBe(false)
  await wrapper.get('[data-testid="review-tab"]').trigger('click');expect(wrapper.find('[data-testid="companion-image-review-panel"]').exists()).toBe(true)
  await wrapper.get('[aria-label="图片素材工具"]').trigger('keydown',{key:'Home'});await flushPromises();expect(wrapper.get('iframe.collector-frame').element).toBe(frame)
  for(const path of ['/help','/knowledge','/overview','/art-resources?references=1&ignored=1']){await router.push(path);await flushPromises();expect(wrapper.get('iframe.collector-frame').element).toBe(frame);expect(frame.isConnected).toBe(true)}
  expect(frame.getAttribute('src')).toBe(PUBLIC_IMAGE_COLLECTOR_URL);expect(wrapper.findAll('iframe.collector-frame')).toHaveLength(1)
  expect(wrapper.get('iframe.collector-frame').isVisible()).toBe(true);expect(fetch).not.toHaveBeenCalled()
 })
})
