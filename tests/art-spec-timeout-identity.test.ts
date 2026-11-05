import { afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectArtSpecStore } from '../src/stores/project-art-spec'
import type { ProjectArtSpecContext, ProjectArtSpecProvider, ProjectArtSpecReceipt } from '../src/project-art-spec-integration'

afterEach(()=>vi.useRealTimers())
it('does not let an old timed-out read abort the newly selected project',async()=>{
 vi.useFakeTimers();setActivePinia(createPinia());const store=useProjectArtSpecStore(),source={}
 const pending:Array<{signal:AbortSignal;resolve:(v:ProjectArtSpecReceipt)=>void}>=[]
 const provider={label:'test',endpoint:'http://127.0.0.1:32180',read:vi.fn((_context:ProjectArtSpecContext,signal:AbortSignal)=>new Promise<ProjectArtSpecReceipt>(resolve=>pending.push({signal,resolve}))),save:vi.fn(),status:vi.fn()} as unknown as ProjectArtSpecProvider
 const first={projectId:'0123456789abcdef',projectPath:'D:/first',source},second={projectId:'fedcba9876543210',projectPath:'D:/second',source}
 store.bind(first,provider);const a=store.read();await vi.advanceTimersByTimeAsync(10000)
 store.bind(second,provider);const b=store.read();expect(pending).toHaveLength(2);expect(pending[0]!.signal.aborted).toBe(true)
 await vi.advanceTimersByTimeAsync(10000);expect(pending[1]!.signal.aborted).toBe(false)
 pending[1]!.resolve({projectId:second.projectId,projectPath:second.projectPath,config:null,hash:null,authorities:[]});await b
 pending[0]!.resolve({projectId:first.projectId,projectPath:first.projectPath,config:null,hash:null,authorities:[]});await a
 expect(store.context?.projectId).toBe(second.projectId);expect(store.hash).toBeNull()
})
