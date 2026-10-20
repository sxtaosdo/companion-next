from pathlib import Path
import hashlib,json
R=Path('D:/code/shidai3/P8000/companion-next');W=Path(__file__).parent
p=R/'src/adapters/project-connections.ts';raw=p.read_bytes()
marker=b'type Track = <T>(pending: Promise<T>) => Promise<T>'
helper=b'''/** Accept only the original receipt or its explicit Node + creator-ai.js equivalent. */
function validClientArgs(command:string,args:unknown,projectId:string):args is string[] {
 const tail=['mcp','--project',projectId]
 if(JSON.stringify(args)===JSON.stringify(tail))return true
 const absolute=(value:unknown):value is string=>typeof value==='string'&&value.length<=4096&&value===value.trim()&&!/[\\0-\\x1f\\x7f]/.test(value)&&/^(?:[a-z]:[\\\\/]|\\/(?!\\/))/i.test(value)&&!value.split(/[\\\\/]/).some(part=>part==='.'||part==='..')
 return absolute(command)&&/(?:^|[\\\\/])node(?:\\.exe)?$/i.test(command)&&Array.isArray(args)&&args.length===4&&absolute(args[0])&&/(?:^|[\\\\/])creator-ai\\.js$/i.test(args[0])&&JSON.stringify(args.slice(1))===JSON.stringify(tail)
}
'''
assert raw.count(marker)==1
old=b"JSON.stringify(reply.args)!==JSON.stringify(['mcp','--project',request.projectId])"
assert raw.count(old)==1
after=raw.replace(marker,helper+marker).replace(old,b'!validClientArgs(reply.command,reply.args,request.projectId)')
p.write_bytes(after)
t=R/'tests/project-connections.test.ts';traw=t.read_bytes()
anchor=b" it('uses the original completed setup link, never a plain unbound assignment',"
assert traw.count(anchor)==1
tests=b''' it.each(['codex','cursor'] as const)('accepts the exact repaired Windows Node receipt for %s',async target=>{
  const raw={...clientReply(target),command:'C:/Program Files/nodejs/node.exe',args:['D:/Companion/mcp/dist/companion/creator-ai.js','mcp','--project',id]}
  const api=createProjectConnectionsProvider({fetch:async()=>json(raw)}),reply=await api.run({kind:'client',projectId:id,target})
  expect(JSON.parse(reply.text)).toMatchObject({command:raw.command,args:raw.args});await api.waitForIdle()
 })
 it('accepts native Windows separators and an unchanged Node registration receipt',async()=>{
  const raw={...clientReply('cursor'),changed:false,command:'C:\\\\Program Files\\\\nodejs\\\\node.exe',args:['D:\\\\Companion\\\\mcp\\\\dist\\\\companion\\\\creator-ai.js','mcp','--project',id]}
  const reply=await createProjectConnectionsProvider({fetch:async()=>json(raw)}).run({kind:'client',projectId:id,target:'cursor'})
  expect(JSON.parse(reply.text).changed).toBe(false)
 })
 it.each([
  {command:'C:/Windows/cmd.exe'},
  {command:'node'},
  {args:['D:/Companion/arbitrary.js','mcp','--project',id]},
  {args:['creator-ai.js','mcp','--project',id]},
  {args:['D:/Companion/../creator-ai.js','mcp','--project',id]},
  {args:['D:/Companion/creator-ai.js','mcp','--project','fedcba9876543210']},
  {args:['D:/Companion/creator-ai.js','mcp','--project',id,'--extra']},
  {args:['D:/Companion/creator-ai.js','mcp','--project',id+'\\n']},
 ])('rejects a mismatched Node registration receipt without retry: %j',async invalid=>{
  const raw={...clientReply(),command:'C:/Program Files/nodejs/node.exe',args:['D:/Companion/creator-ai.js','mcp','--project',id],...invalid},fetch=vi.fn(async()=>json(raw))
  const api=createProjectConnectionsProvider({fetch})
  await expect(api.run({kind:'client',projectId:id,target:'codex'})).rejects.toMatchObject({code:'invalid-shape',outcome:'unknown'})
  expect(fetch).toHaveBeenCalledTimes(1);await api.waitForIdle()
 })
'''
t.write_bytes(traw.replace(anchor,tests+anchor))
(W/'edit-result.json').write_text(json.dumps({'adapterBefore':hashlib.sha256(raw).hexdigest(),'adapterAfter':hashlib.sha256(after).hexdigest(),'testBefore':hashlib.sha256(traw).hexdigest(),'files':['src/adapters/project-connections.ts','tests/project-connections.test.ts']},indent=2)+'\n')
print('Updated only Next registration receipt compatibility and targeted tests')
