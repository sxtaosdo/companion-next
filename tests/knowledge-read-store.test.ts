import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { deferred, knowledgeFixture, knowledgeStatus } from './knowledge-read-fixture'
import type { KnowledgeSearchResponse, KnowledgeStatus } from '../src/domain/knowledge-read'
import { KnowledgeReadError } from '../src/adapters/knowledge-read'
beforeEach(()=>setActivePinia(createPinia()))
describe('knowledge read state isolation',()=>{
 it('displays closed diagnostic categories for real host failures without raw transport messages',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture();vi.mocked(p.status).mockRejectedValue(new KnowledgeReadError('http-error','status',503,'CLI_UNAVAILABLE'));await s.connect(p);expect(s.statusError).toBe('知识库 CLI 不可用。');vi.mocked(p.listKnowledgeBases).mockRejectedValue(new KnowledgeReadError('forbidden','kbList',403,'AUTH_DENIED'));await s.run('bases');expect(s.error).toBe('知识库身份或访问范围被拒绝。');expect(s.result).toBeNull()})
 it('starts without network and has no stored contents or fabricated counts',()=>{const s=useKnowledgeReadStore();expect(s.provider).toBeNull();expect(s.result).toBeNull();expect(s.status).toBeNull();expect(s.services).toBeNull()})
 it('explicit connect reads only statuses, never posts or starts an iframe',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture();await s.connect(p);expect(p.status).toHaveBeenCalledTimes(1);expect(p.loadServiceStates).toHaveBeenCalledTimes(1);expect(p.search).not.toHaveBeenCalled();expect(p.listKnowledgeBases).not.toHaveBeenCalled();expect(s.status?.retrieval.keyword).toBe('unverified');expect(s.services?.model?.running).toBe(true)})
 it('retains successful service status when CLI read fails without inventing an empty result',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture();vi.mocked(p.status).mockRejectedValue(new Error('secret'));await s.connect(p);expect(s.status).toBeNull();expect(s.statusError).not.toContain('secret');expect(s.services?.model?.running).toBe(true);expect(s.result).toBeNull()})
 it('keeps service failures unknown when CLI succeeds',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture();vi.mocked(p.loadServiceStates).mockRejectedValue(new Error());await s.connect(p);expect(s.services).toBeNull();expect(s.serviceError).toContain('未读取');expect(s.status).not.toBeNull()})
 it.each(['search','bases','base','documents','document','original','chunks','agents'] as const)('runs %s only when explicitly requested',async kind=>{const s=useKnowledgeReadStore(),p=knowledgeFixture();await s.connect(p);s.query='keyword';s.kbId='kb1';s.documentId='doc1';await s.run(kind);expect(s.result?.kind).toBe(kind);expect(s.error).toBe('')})
 it('rejects unsafe request IDs without using transport',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture();await s.connect(p);s.documentId='../doc';await s.run('document');expect(p.viewDocument).not.toHaveBeenCalled();expect(s.error).not.toBe('');expect(s.result).toBeNull()})
 it('clears errors and results immediately when request inputs change',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture();await s.connect(p);s.query='old';await s.run('search');s.query='new';expect(s.result).toBeNull();expect(s.invalidated).toBe(true);expect(p.search).toHaveBeenCalledTimes(1)})
 it('ignores late responses after query A to B to A changes',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture(),d=deferred<KnowledgeSearchResponse>();vi.mocked(p.search).mockReturnValue(d.promise);await s.connect(p);s.query='A';const run=s.run('search');const signal=vi.mocked(p.search).mock.calls[0]![1]!;s.query='B';s.query='A';d.resolve({results:[],count:0});await run;expect(signal.aborted).toBe(true);expect(s.result).toBeNull();expect(s.loading).toBe(false)})
 it('does not let cancelled old work clear new work loading state',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture(),old=deferred<KnowledgeSearchResponse>(),next=deferred<KnowledgeSearchResponse>();vi.mocked(p.search).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);await s.connect(p);s.query='old';const a=s.run('search');s.query='new';const b=s.run('search');old.reject(new Error());await a;expect(s.loading).toBe(true);expect(s.error).toBe('');next.resolve({results:[],count:0});await b;expect(s.result?.kind).toBe('search')})
 it('blocks double clicks and actions while status is in flight',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture(),d=deferred<KnowledgeStatus>();vi.mocked(p.status).mockReturnValue(d.promise);const c=s.connect(p);await s.run('bases');expect(p.listKnowledgeBases).not.toHaveBeenCalled();d.resolve(knowledgeStatus);await c;const r=deferred<{items:[]}>();vi.mocked(p.listKnowledgeBases).mockReturnValue(r.promise);const a=s.run('bases');await s.run('bases');expect(p.listKnowledgeBases).toHaveBeenCalledTimes(1);r.resolve({items:[]});await a})
 it('disconnect clears private query and contents, late response cannot revive them',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture(),d=deferred<KnowledgeSearchResponse>();await s.connect(p);s.query='private';vi.mocked(p.search).mockReturnValue(d.promise);const a=s.run('search');s.disconnect();d.resolve({results:[],count:0});await a;expect(s.query).toBe('');expect(s.result).toBeNull();expect(s.status).toBeNull();expect(s.services).toBeNull();expect(s.provider).toBeNull()})
 it('status refresh aborts old state and ignores previous-provider response',async()=>{const s=useKnowledgeReadStore(),a=knowledgeFixture(),b=knowledgeFixture(),d=deferred<KnowledgeStatus>();vi.mocked(a.status).mockReturnValue(d.promise);const one=s.connect(a);await s.connect(b);d.resolve({...knowledgeStatus,retrieval:{...knowledgeStatus.retrieval,auth:'verified'}});await one;expect(s.status?.retrieval.auth).toBe('configured');expect(s.statusLoading).toBe(false)})
 it('failed query never reuses the previous success',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture();await s.connect(p);await s.run('bases');vi.mocked(p.listKnowledgeBases).mockRejectedValue(new Error('token'));await s.run('bases');expect(s.result).toBeNull();expect(s.error).not.toContain('token')})
 it('cancelReads keeps newer action results safe from old status completions',async()=>{const s=useKnowledgeReadStore(),p=knowledgeFixture(),d=deferred<KnowledgeStatus>();vi.mocked(p.status).mockReturnValueOnce(d.promise).mockResolvedValue(knowledgeStatus);const first=s.connect(p);s.cancelReads();await s.refreshStatus();d.resolve({...knowledgeStatus,cli:{available:false,compatible:false}});await first;expect(s.status?.cli.available).toBe(true)})
})

describe('knowledge document source generations',()=>{
 it.each(['documents','document','chunks','original'] as const)('discards late %s content after the selected KB or document changes',async kind=>{
  const s=useKnowledgeReadStore(),p=knowledgeFixture(),pending=deferred<any>()
  const method={documents:'listDocuments',document:'viewDocument',chunks:'listChunks',original:'downloadDocument'} as const
  vi.mocked(p[method[kind]]).mockReturnValueOnce(pending.promise)
  await s.connect(p);s.kbId='kb-old';s.documentId='doc-old'
  const work=s.run(kind),signal=vi.mocked(p[method[kind]]).mock.calls[0]![1]!
  if(kind==='documents')s.kbId='kb-new';else s.documentId='doc-new'
  expect(signal.aborted).toBe(true)
  pending.resolve(kind==='original'?{docId:'doc-old',fileName:'old.txt',bytes:3,truncated:false,isBase64:false,content:'old'}:kind==='document'?{item:{id:'doc-old',description:'old'}}:{items:[{id:'old',content:'old'}],truncated:false})
  await work
  expect(s.result).toBeNull();expect(s.error).toBe('');expect(s.loading).toBe(false);expect(s.invalidated).toBe(true)
  expect(p[method[kind]]).toHaveBeenCalledTimes(1)
 })
})
