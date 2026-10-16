import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_WRITE_FENCE_KEY, AI_WRITE_LOCK_NAME, getAiWriteFenceStorage, hasPendingAiWrites, putAiWriteFence, readAiWriteFences, removeAiWriteFence, runAiWriteExclusive } from '../src/domain/ai-write-coordination'
import type { AiWriteFence } from '../src/domain/ai-write-coordination'
const id = '0123456789abcdef', jobId = 'STUDIO-RUN-icon-demo-0123abcd'
const fence = (): AiWriteFence => ({ key:`${id}/${jobId}/run-next/1`,projectId:id,jobId,operation:'run-next',revision:1,requestHash:'a'.repeat(64),sourceRevision:'b'.repeat(40) })
function storage() { const map = new Map<string,string>(); return { getItem:(key:string) => map.get(key) ?? null, setItem:(key:string,value:string) => {map.set(key,value)} } }
afterEach(() => vi.unstubAllGlobals())
describe('shared original AI write fence', () => {
  it('uses a shared global lock and separate bounded same-origin ledger', () => { expect(AI_WRITE_LOCK_NAME).toBe('companion-next:ai-write-v1'); expect(AI_WRITE_FENCE_KEY).toBe('companion-next.ai-write-fences.v1') })
  it('preserves unrelated unknown records and supports creation revision zero with unknown compiled hash', () => {
    const saved = storage(), action = fence(), creation:AiWriteFence = {...fence(),key:`${id}/${jobId}/enqueue`,operation:'enqueue',revision:0,requestHash:null}
    putAiWriteFence(saved,action); putAiWriteFence(saved,creation); expect(hasPendingAiWrites(saved,id)).toBe(true); removeAiWriteFence(saved,action.key); expect(readAiWriteFences(saved)).toEqual([creation]); expect(hasPendingAiWrites(saved,'fedcba9876543210')).toBe(false)
  })
  it.each(['bad-json','{}','null','[null]',JSON.stringify([fence(),fence()]),' '.repeat(65*1024)])('fail-closes malformed or oversized storage %#', value => { const saved=storage(); saved.setItem(AI_WRITE_FENCE_KEY,value); expect(() => readAiWriteFences(saved)).toThrow(); expect(() => hasPendingAiWrites(saved,id)).toThrow() })
  it.each([{operation:'start-model'},{revision:0},{revision:1.1},{requestHash:null},{requestHash:'bad'},{sourceRevision:'bad'},{jobId:'../escape'},{projectId:'../escape'},{key:'file://secret?token=x'},{key:'x'.repeat(301)},{token:'secret'}])('rejects invalid fence %#', delta => { const saved=storage(); expect(() => putAiWriteFence(saved,{...fence(),...delta} as AiWriteFence)).toThrow(); expect(readAiWriteFences(saved)).toEqual([]) })
  it('does not overwrite duplicate records or reset all unknowns', () => { const saved=storage(); putAiWriteFence(saved,fence()); expect(() => putAiWriteFence(saved,fence())).toThrow(); expect(readAiWriteFences(saved)).toEqual([fence()]) })
  it('limits count and catches failed persistence readback', () => { const saved=storage(); for(let n=0;n<100;n++) putAiWriteFence(saved,{...fence(),key:`key-${n}`}); expect(() => putAiWriteFence(saved,{...fence(),key:'last'})).toThrow(); expect(readAiWriteFences(saved)).toHaveLength(100); expect(() => putAiWriteFence({getItem:()=>null,setItem:()=>undefined},fence())).toThrow() })
  it('never persists caller credentials, project paths or image bytes as optional metadata', () => { const saved=storage(); for(const field of ['base64','path','password','token']) expect(() => putAiWriteFence(saved,{...fence(),[field]:'SECRET'})).toThrow(); expect(saved.getItem(AI_WRITE_FENCE_KEY)).toBeNull() })
})
describe('cross-tab lock fail-closed behavior', () => {
  it('refuses absent locks without invoking callback', async () => { vi.stubGlobal('navigator',{}); const work=vi.fn(async()=>1); await expect(runAiWriteExclusive(work)).rejects.toThrow(); expect(work).not.toHaveBeenCalled() })
  it('requests exclusive ifAvailable shared name and does not queue/retry when held', async () => {
    const request=vi.fn(async(_name,_options,callback)=>callback(null)); vi.stubGlobal('navigator',{locks:{request}}); const work=vi.fn(async()=>1)
    expect(await runAiWriteExclusive(work)).toEqual({acquired:false}); expect(work).not.toHaveBeenCalled(); expect(request).toHaveBeenCalledExactlyOnceWith(AI_WRITE_LOCK_NAME,{mode:'exclusive',ifAvailable:true},expect.any(Function))
  })
  it('retains callback promise until actual work settles', async () => {
    let resolve!:(value:number)=>void, finished=false; const wait=new Promise<number>(r=>{resolve=r}); const request=vi.fn(async(_name,_options,callback)=>{const result=await callback({name:AI_WRITE_LOCK_NAME}); finished=true; return result}); vi.stubGlobal('navigator',{locks:{request}})
    const pending=runAiWriteExclusive(()=>wait); await Promise.resolve(); expect(finished).toBe(false); resolve(7); expect(await pending).toEqual({acquired:true,value:7}); expect(finished).toBe(true)
  })
  it('storage access denial cannot be confused with a clean ledger', () => { vi.stubGlobal('localStorage',null); expect(()=>getAiWriteFenceStorage()).toThrow() })
})
