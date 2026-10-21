import {afterEach,describe,expect,it,vi} from 'vitest'
const {app}=vi.hoisted(()=>({app:{use:vi.fn(),mount:vi.fn()}}))
vi.mock('vue',async importOriginal=>({...await importOriginal<typeof import('vue')>(),createApp:()=>{app.use.mockReturnValue(app);return app}}))
vi.mock('element-plus',()=>({default:{}}))
vi.mock('../src/App.vue',()=>({default:{name:'CompositionRootStub'}}))
vi.mock('../src/router',()=>({router:{}}))
const originalWindow=window
async function composition(mode:string){
 vi.resetModules();vi.stubEnv('MODE',mode)
 const fetcher=vi.fn(()=>Promise.reject(new Error('No request authorized by composition')))
 vi.stubGlobal('window',{location:{protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:32181',pathname:'/next/index.html'},fetch:fetcher})
 await import('../src/main')
 return {fetcher,provider:(await import('../src/project-art-spec-integration')).projectArtSpecProvider.value}
}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.stubGlobal('window',originalWindow);vi.clearAllMocks()})
describe('project art transport composition boundary',()=>{
 it('registers the real same-origin provider only in the normal workspace without sending reads or writes',async()=>{
  const {provider,fetcher}=await composition('companion-workspace')
  expect(provider?.endpoint).toBe('http://127.0.0.1:32181')
  expect(provider?.read).toBeTypeOf('function');expect(provider?.save).toBeTypeOf('function');expect(provider?.status).toBeTypeOf('function')
  expect(fetcher).not.toHaveBeenCalled();expect(app.mount).toHaveBeenCalledWith('#app')
 })
 it.each(['companion-readonly','companion-config-editor','companion-knowledge-chat','development'])('keeps the art write provider absent in %s',async mode=>{
  const {provider,fetcher}=await composition(mode);expect(provider).toBeNull();expect(fetcher).not.toHaveBeenCalled()
 })
})
