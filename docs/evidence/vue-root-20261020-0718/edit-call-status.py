from pathlib import Path
R=Path('D:/code/shidai3/P8000/companion-next')
p=R/'src/domain/project-call-meta.ts';raw=p.read_bytes();old=b"import type { CallLatest } from './companion-browser'";new=b"import type { CallLatest, CallStatus } from './companion-browser'";assert raw.count(old)==1
helper="""\n/** Keep the original call-history labels without changing the wire status. */
export function callStatusLabel(status:CallStatus):string {
 return ({running:'进行中',success:'成功',failed:'失败'} satisfies Record<CallStatus,string>)[status] ?? '未知'
}
""".encode()
p.write_bytes(raw.replace(old,new)+helper)
p=R/'src/views/CompanionBrowserView.vue';raw=p.read_bytes();old=b"import { formatProjectCallMeta } from '../domain/project-call-meta'";new=b"import { callStatusLabel, formatProjectCallMeta } from '../domain/project-call-meta'";assert raw.count(old)==1
raw=raw.replace(old,new);old=b'{{ record.status }}';assert raw.count(old)==1;raw=raw.replace(old,b'{{ callStatusLabel(record.status) }}')
rows=raw.splitlines(keepends=True);rows=[r.replace(b'\r\n',b'\n') if b'callStatusLabel' in r else r for r in rows];p.write_bytes(b''.join(rows))
p=R/'tests/companion-browser-ui.test.ts';raw=p.read_bytes();anchor=b" it('retains actual call pagination while moving capacity limits into an accessible tip',";assert raw.count(anchor)==1
test=""" it('retains the original Chinese history statuses while preserving wire values and readonly expansion',async()=>{
  const p=fixture(),statuses=['running','success','failed'] as const
  vi.mocked(p.loadCalls).mockResolvedValue({sessionId:'s1',total:3,retained:3,records:statuses.map((status,index)=>({id:`call-${index}`,sequence:3-index,projectId:'p1',operation:`read_${index}`,operationNameZh:'读取状态',source:'mcp' as const,startedAt:'2026-10-20T00:00:00Z',status,inputSummary:'{}',...(status==='failed'?{errorSummary:'已记录的业务错误'}:{})}))})
  registerCompanionBrowserProvider(p);const {store}=await setup();await button('连接 Companion').trigger('click');await flushPromises();await button('查看调用记录').trigger('click');await flushPromises()
  const rows=wrapper!.findAll('details.companion-call-record');expect(rows).toHaveLength(3)
  for(const [index,label] of ['进行中','成功','失败'].entries()){const summary=rows[index]!.get('summary');expect(summary.text()).toContain(label);expect(summary.text()).not.toContain(statuses[index]!);await summary.trigger('click')}
  expect(store.records.map(record=>record.status)).toEqual(statuses);expect(p.loadCalls).toHaveBeenCalledTimes(1)
 })
""".encode()
p.write_bytes(raw.replace(anchor,test+anchor))
print('Restored original visible Chinese call statuses; raw contract unchanged')
