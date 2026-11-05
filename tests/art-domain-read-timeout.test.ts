import { afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useArtResourceDomainsStore } from '../src/stores/art-resource-domains'

afterEach(()=>vi.useRealTimers())
it('times out a hanging response body and ignores its late completion',async()=>{
 vi.useFakeTimers();setActivePinia(createPinia());const store=useArtResourceDomainsStore(),id='0123456789abcdef',path='D:/fixture'
 store.bind({projectId:id,projectPath:path,source:{}})
 let release!:(value:string)=>void
 const fetcher=vi.fn(async()=>({ok:true,text:()=>new Promise<string>(resolve=>{release=resolve})})) as unknown as typeof fetch
 const pending=store.read(fetcher);await Promise.resolve();await vi.advanceTimersByTimeAsync(15000);await pending
 expect(store.phase).toBe('error');expect(store.error).toContain('超时')
 release(JSON.stringify({projectId:id,projectPath:path,domains:[],legacy:{readOnly:false,hasConfig:true,hasWorkbench:false},projectSettingsHash:null}));await Promise.resolve()
 expect(store.phase).toBe('error');expect(store.catalog).toBeNull()
})
