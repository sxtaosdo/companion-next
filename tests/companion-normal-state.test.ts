import { describe,expect,it,vi } from 'vitest'
import { createCompanionBrowserProvider,type CompanionFetch } from '../src/adapters/companion-browser'
const id='0123456789abcdef',p={id,name:'已登记工程',path:'D:\\fixture\\project',requiredCreatorVersion:'3.8.8'}
const runtime={projectId:id,state:'ready',creatorVersion:'3.8.8',sessionId:'session-original',pid:123,capabilityProfile:'authoring'}
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}})
describe('normal project status from confirmed v150 array contract',()=>{
 it('reads real status without Dashboard discovery or invented single-project status endpoint',async()=>{
  const fetch=vi.fn<CompanionFetch>(async path=>path==='/api/projects'?json([p]):path==='/api/status'?json([runtime]):Promise.reject(Error('unexpected endpoint')))
  const api=createCompanionBrowserProvider({fetch,runtimeProbes:true,dashboardDiscovery:false});expect(fetch).not.toHaveBeenCalled()
  const result=await api.loadProjects();expect(fetch.mock.calls.map(([path])=>path)).toEqual(['/api/projects','/api/status'])
  expect(result.statuses[0]).toEqual(runtime);expect(result.dashboard).toEqual([]);expect(result.warnings.join('')).toContain('最近打开时间未读取')
  expect(api.runtimeProbesEnabled).toBe(true);expect(api.dashboardDiscoveryEnabled).toBe(false)
 })
 it.each([403,409,503])('preserves confirmed registration but unknown runtime on status %s',async status=>{
  const fetch=vi.fn<CompanionFetch>(async path=>path==='/api/projects'?json([p]):json({error:'unavailable'},status))
  const result=await createCompanionBrowserProvider({fetch,runtimeProbes:true,dashboardDiscovery:false}).loadProjects()
  expect(result.projects).toEqual([p]);expect(result.statuses).toEqual([]);expect(result.warnings.join('')).toContain('缺少状态');expect(fetch).toHaveBeenCalledTimes(2)
 })
 it('missing Creator version remains absent rather than copying requiredVersion',async()=>{
  const api=createCompanionBrowserProvider({fetch:async path=>path==='/api/projects'?json([p]):json([{projectId:id,state:'error'}]),runtimeProbes:true,dashboardDiscovery:false})
  const result=await api.loadProjects();expect(result.statuses[0]?.state).toBe('error');expect(result.statuses[0]?.creatorVersion).toBeUndefined();expect(result.statuses[0]?.capabilityProfile).toBe('unknown')
 })
 it('rejects wrapped status as partial failure, never stopped or current-version fallback',async()=>{
  const api=createCompanionBrowserProvider({fetch:async path=>path==='/api/projects'?json([p]):json({statuses:[runtime]}),runtimeProbes:true,dashboardDiscovery:false})
  const result=await api.loadProjects();expect(result.statuses).toEqual([]);expect(result.warnings.join('')).toContain('invalid-shape')
 })
})
