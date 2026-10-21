import { describe, expect, it, vi } from 'vitest'
import { createProjectArtSpecProvider } from '../src/adapters/project-art-spec'
const context={projectId:'1234567890abcdef',projectPath:'/test/project',source:{}}
const receipt={projectId:context.projectId,projectPath:context.projectPath,config:null,hash:null,authorities:[]}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
describe('project art authenticated same-origin transport',()=>{
 it('reads exact route with same-origin credentials and no automatic write',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>json(receipt));const provider=createProjectArtSpecProvider(fetcher,'http://127.0.0.1:32181')
  expect(await provider.read(context,new AbortController().signal)).toEqual(receipt)
  expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/art-spec/'+context.projectId,expect.objectContaining({method:'GET',credentials:'same-origin',redirect:'error'}))
 })
 it('queries only the exact original operation and rejects foreign bindings',async()=>{
  const operationId='art-save-'+'a'.repeat(32),fetcher=vi.fn<typeof fetch>(async()=>json({schemaVersion:'project-art-write-v1',projectId:context.projectId,projectPath:context.projectPath,operationId,bindingHash:'b'.repeat(64),state:'pending'}))
  const provider=createProjectArtSpecProvider(fetcher,'http://127.0.0.1:32181');expect((await provider.status(context,operationId,new AbortController().signal)).state).toBe('pending')
  expect(fetcher).toHaveBeenCalledWith('/api/art-spec/'+context.projectId+'/operations/'+operationId,expect.objectContaining({method:'GET'}))
  fetcher.mockResolvedValueOnce(json({...receipt,schemaVersion:'project-art-write-v1',operationId:'art-save-'+'f'.repeat(32),bindingHash:'b'.repeat(64),state:'pending'}))
  await expect(provider.status(context,operationId,new AbortController().signal)).rejects.toThrow()
 })
 it.each([403,404,409,503])('does not retry or expose raw HTTP %s diagnostics',async status=>{
  const fetcher=vi.fn<typeof fetch>(async()=>json({error:'private-token-and-url'},status)),provider=createProjectArtSpecProvider(fetcher,'http://127.0.0.1:32181')
  await expect(provider.read(context,new AbortController().signal)).rejects.not.toThrow('private-token');expect(fetcher).toHaveBeenCalledOnce()
 })
 it('rejects cross-origin, credentials and nonloopback configuration before fetch',()=>{
  const fetcher=vi.fn<typeof fetch>();for(const origin of ['https://127.0.0.1:32181','http://localhost:32181','http://user:secret@127.0.0.1:32181','http://127.0.0.1:32181/other'])expect(()=>createProjectArtSpecProvider(fetcher,origin)).toThrow();expect(fetcher).not.toHaveBeenCalled()
 })
 it('rejects mismatched project receipts and oversized data',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>json({...receipt,projectId:'ffffffffffffffff'})),provider=createProjectArtSpecProvider(fetcher,'http://127.0.0.1:32181')
  await expect(provider.read(context,new AbortController().signal)).rejects.toThrow()
  fetcher.mockResolvedValueOnce(new Response('x'.repeat(512*1024+1)));await expect(provider.read(context,new AbortController().signal)).rejects.toThrow()
 })
})
