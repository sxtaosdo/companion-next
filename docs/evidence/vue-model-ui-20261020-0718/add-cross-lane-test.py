from pathlib import Path
R=Path('D:/code/shidai3/P8000/companion-next')
p=R/'tests/knowledge-sync-ui.test.ts';raw=p.read_bytes()
marker=b"import { useKnowledgeConversationStore } from '../src/stores/knowledge-conversation'"
assert raw.count(marker)==1
raw=raw.replace(marker,b"import { knowledgeAgentPending } from '../src/knowledge-agent-integration'\n"+marker)
raw+= '''

describe('Agent and sync shared pending lane',()=>{
 it('blocks both sync actions during an Agent request and never replays them on release',async()=>{
  const fetch=vi.fn<KnowledgeSyncFetch>(async()=>reply(queued)),{connect}=await setup(fetch)
  try{
   await connect();knowledgeAgentPending.value=true;await flushPromises()
   expect(button('同步演练').attributes('disabled')).toBeDefined()
   expect(button('执行同步').attributes('disabled')).toBeDefined()
   expect(wrapper!.get('select').attributes('disabled')).toBeDefined()
   await button('同步演练').trigger('click');await button('执行同步').trigger('click')
   expect(fetch).not.toHaveBeenCalled()
   knowledgeAgentPending.value=false;await flushPromises()
   expect(button('同步演练').attributes('disabled')).toBeUndefined()
   expect(button('执行同步').attributes('disabled')).toBeUndefined()
   expect(fetch).not.toHaveBeenCalled()
   await button('同步演练').trigger('click');await flushPromises()
   expect(fetch).toHaveBeenCalledTimes(1)
   expect(fetch.mock.calls[0]![0]).toBe('/api/knowledge/sync/dry-run')
   expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({sourceId:a.id,channel:a.channel})
  }finally{knowledgeAgentPending.value=false}
 })
})
'''.encode()
p.write_bytes(raw)
print('Added one isolated cross-feature UI lane regression; no production source change')
