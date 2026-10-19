import { afterEach, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import { CompanionBrowserError } from '../src/adapters/companion-browser'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { registerCompanionBrowserProvider, companionBrowserProvider, companionEventProvider } from '../src/companion-browser-integration'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
let wrapper: VueWrapper | undefined
let store: ReturnType<typeof useCompanionBrowserStore> | undefined
afterEach(()=>{store?.disconnect();wrapper?.unmount();store=undefined;wrapper=undefined;companionBrowserProvider.value=null;companionEventProvider.value=null;document.body.innerHTML='';vi.useRealTimers()})
it('lets the original stop button cancel automatic recovery while the read connection is unknown',async()=>{
 vi.useFakeTimers()
 const provider: CompanionBrowserProvider={label:'offline',loadProjects:vi.fn(async()=>({projects:[{id:'p1',name:'One',path:'/fixture'}],statuses:[],dashboard:[],warnings:[]})),loadCounts:vi.fn(async()=>({sessionId:'s1',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'s1',total:0,retained:0,records:[]}))}
 const subscribe=vi.fn(()=>vi.fn());registerCompanionBrowserProvider(provider,{label:'offline SSE',subscribe})
 const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView}]});await router.push('/projects');await router.isReady()
 wrapper=mount(CompanionBrowserView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}});store=useCompanionBrowserStore(pinia);await flushPromises()
 const button=(label:string)=>wrapper!.findAll('button').find(button=>button.text()===label)!
 expect(button('启用实时更新').attributes('disabled')).toBeDefined()
 await store.connect(provider);await flushPromises();await button('启用实时更新').trigger('click');await vi.advanceTimersByTimeAsync(0)
 vi.mocked(provider.loadProjects).mockRejectedValueOnce(new CompanionBrowserError('network-error','projects'));await vi.advanceTimersByTimeAsync(3000);await flushPromises()
 expect(store.connected).toBe(false);expect(store.liveEnabled).toBe(true);expect(store.liveState).toBe('retrying')
 expect(button('停止实时更新').attributes('disabled')).toBeUndefined()
 await button('停止实时更新').trigger('click');await flushPromises();const reads=vi.mocked(provider.loadProjects).mock.calls.length,streams=subscribe.mock.calls.length
 await vi.advanceTimersByTimeAsync(30_000);expect(store.liveEnabled).toBe(false);expect(store.liveState).toBe('off');expect(provider.loadProjects).toHaveBeenCalledTimes(reads);expect(subscribe).toHaveBeenCalledTimes(streams)
 expect(button('启用实时更新').attributes('disabled')).toBeDefined()
})
