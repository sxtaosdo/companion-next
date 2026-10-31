import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Panel from '../src/components/workflow-operation/WorkflowOperationPanel.vue'
import type { SourcePatchInspection, WorkflowOperationRecord } from '../src/components/workflow-operation/workflow-operation'
import { createWorkflowHttpProvider, validateRecord, validateSourcePatchInspection } from '../src/components/workflow-operation/workflow-operation-http'

const hash = 'a'.repeat(64)
const makeRecord = (mode?: 'sample' | 'source-patch'): WorkflowOperationRecord => ({
  schemaVersion: 'workflow-operation-v1', id: 'goal-one', revision: 3,
  ...(mode ? { deliveryMode: mode } : {}),
  goal: { source: 'gsd', ref: 'goal', digest: hash, version: '1' },
  plan: { source: 'openspec', ref: 'plan', digest: hash, version: '1' },
  state: 'completed', review: {goalDigest:hash,planDigest:hash,reviewedAt:'2026-01-01T00:00:00.000Z',...(mode==='source-patch'?{patchPolicyDigest:hash}:{})}, activeRunId: 'run-one', presentation: { title: '目标' },
  runs: [{ id: 'run-one', operationId: 'op-one', goalDigest: hash, planDigest: hash, state: 'completed', executionId: 'thread', lastObservedAt: null, logRefs: [], evidenceRefs: [], acceptance: null, capability: 'task-directory-workspace-write', scope: 'task-directory', taskWorkspace: { relativePath: '.companion/tasks/goal-one', baselineDigest: hash, policyDigest: hash } }],
})
let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => { wrapper?.unmount(); vi.useRealTimers(); vi.restoreAllMocks() })

const inspection = (): SourcePatchInspection => ({ schemaVersion: 'workflow-source-patch-inspection-v1', workflowId: 'goal-one', goalDigest: hash, planDigest: hash, runId: 'run-one', sourceFingerprint: hash, policyDigest: hash, patchDigest: hash, descriptionDigest: hash, reportDigest: hash, taskFilesDigest:hash, terminalEvidenceDigest:hash, observedAt: new Date().toISOString(), state: 'passed', validity:'point-in-time', activity:'unverified', tests: 'not-verified', applied: 'unverified', accepted: false })

async function setup(mode?: 'sample' | 'source-patch', failRead = false, inspect?: () => Promise<SourcePatchInspection>) {
  const record = makeRecord(mode), accept = vi.fn()
  const data = new Map<string,string>()
  const storage = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)}}
  const provider = { list: async () => [record], accept, ...(inspect ? {readSourcePatchInspection: inspect} : {}), readExecution: async () => {
    if (failRead) throw new Error('disconnected')
    return { record, evidence: [{ ref: 'executor/evidence', digest: hash, kind: 'execution', state: 'completed' }] }
  } }
  wrapper = mount(Panel, { props: { section: 'execution', provider: provider as never, pendingStorage: storage }, global: { plugins: [ElementPlus] } })
  await flushPromises()
  await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click')
  await flushPromises()
  const read = wrapper.findAll('button').find(b => b.text().includes('查询执行与证据'))!
  await read.trigger('click'); await flushPromises()
  await wrapper.setProps({ section: 'acceptance' }); await flushPromises()
  return { accept }
}

it('does not accept a source patch from execution evidence alone', async () => {
  const { accept } = await setup('source-patch')
  expect(wrapper!.get('[data-testid="source-patch-status"]').text()).toContain('补丁检查：未核验或已过期')
  expect(wrapper!.text()).toContain('实际测试：未核验')
  expect(wrapper!.text()).toContain('工程应用：未确认')
  await wrapper!.get('input[type="checkbox"][value="' + hash + '"]').setValue(true)
  await wrapper!.get('#workflow-acceptance-note').setValue('人工核对')
  const button = wrapper!.findAll('button').find(b => b.text().includes('提交任务目录验收'))!
  expect(button.attributes('disabled')).toBeDefined()
  await button.trigger('click'); expect(accept).not.toHaveBeenCalled()
})

it('does not treat a disconnected read as a passed check', async () => {
  const { accept } = await setup('source-patch', true)
  expect(wrapper!.text()).toContain('补丁检查：未核验或已过期')
  expect(wrapper!.text()).toContain('实际测试：未核验')
  expect(wrapper!.text()).toContain('工程应用：未确认')
  expect(accept).not.toHaveBeenCalled()
})

it('checks fresh matching inspection without claiming tests or application, then expires it', async () => {
  await setup('source-patch', false, async () => inspection())
  const button = () => wrapper!.findAll('button').find(b => b.text().includes('提交任务目录验收'))!
  await wrapper!.get('input[type="checkbox"][value="' + hash + '"]').setValue(true)
  await wrapper!.get('#workflow-acceptance-note').setValue('人工核对')
  expect(button().attributes('disabled')).toBeDefined()
  await wrapper!.findAll('button').find(b => b.text().includes('重新检查源码补丁'))!.trigger('click'); await flushPromises()
  expect(wrapper!.text()).toContain('本次检查通过')
  expect(wrapper!.text()).toContain('实际测试：未核验')
  expect(wrapper!.text()).toContain('工程应用：未确认')
  expect(button().attributes('disabled')).toBeUndefined()
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000); await new Promise(resolve => setTimeout(resolve, 1100)); await flushPromises()
  expect(wrapper!.text()).toContain('未核验或已过期')
  expect(button().attributes('disabled')).toBeDefined()
})

it('keeps unknown inspection and wrong-run results blocked', async () => {
  const inspect = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({...inspection(),runId:'other-run'})
  await setup('source-patch', false, inspect)
  const check = () => wrapper!.findAll('button').find(b => b.text().includes('重新检查源码补丁'))!
  await check().trigger('click'); await flushPromises(); expect(wrapper!.text()).toContain('补丁检查失败或结果未知')
  await check().trigger('click'); await flushPromises(); expect(wrapper!.text()).toContain('补丁检查失败或结果未知')
  expect(wrapper!.findAll('button').find(b => b.text().includes('提交任务目录验收'))!.attributes('disabled')).toBeDefined()
})

it('rejects malformed or misleading inspection responses', () => {
  const result = inspection()
  expect(validateSourcePatchInspection(result,'goal-one')).toEqual(result)
  expect(() => validateSourcePatchInspection({...result, tests:'passed'},'goal-one')).toThrow()
  expect(() => validateSourcePatchInspection({...result, applied:true},'goal-one')).toThrow()
  expect(() => validateSourcePatchInspection({...result, workflowId:'other'},'goal-one')).toThrow()
  expect(() => validateSourcePatchInspection({...result, patchDigest:'bad'},'goal-one')).toThrow()
})

it('accepts only a historical inspection bound to its accepted run and reviewed policy', () => {
  const record = {...makeRecord('source-patch'),capability:'task-directory-workspace-write',state:'accepted' as const}
  record.runs[0].state='accepted'
  record.runs[0].acceptance={scope:'task-directory',goalDigest:hash,planDigest:hash,evidenceDigests:[hash],acceptedAt:'2026-01-01T00:00:00.000Z',patchInspection:inspection()}
  expect(validateRecord(record).runs[0].acceptance?.patchInspection?.activity).toBe('unverified')
  const changed=structuredClone(record);changed.runs[0].acceptance!.patchInspection!.runId='other'
  expect(()=>validateRecord(changed)).toThrow('Acceptance inspection binding mismatch')
})

it('reads the server patch target and submits its digest on review, preserving the legacy request shape', async () => {
  const record = {...makeRecord('source-patch'),capability:'task-directory-workspace-write'}
  const policy = { workflowId:'goal-one',revision:3,projectId:'project',policies:[],binding:{state:'static',files:[]},patchPolicy:{targetRoot:'D:/frontend',files:[{id:'panel',path:'src/panel.vue',sha256:hash}],policyDigest:hash} }
  const calls: {url:string; options:RequestInit}[] = []
  const fetcher = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    calls.push({url:String(url),options:options!})
    return {ok:true,status:200,redirected:false,json:async()=>String(url).endsWith('/source-policies')?policy:record} as Response
  })
  const api = createWorkflowHttpProvider(fetcher as typeof fetch)
  expect((await api.readSourcePolicies!('goal-one')).patchPolicy).toEqual(policy.patchPolicy)
  const command = {operationId:'op-review',expectedRevision:3,planDigest:hash,selectedTaskId:'task',sourceIds:['goal-current'],note:'checked'}
  await api.reviewPlan('goal-one',{...command,patchPolicyDigest:hash})
  expect(JSON.parse(String(calls.at(-1)!.options.body)).patchPolicyDigest).toBe(hash)
  await api.reviewPlan('goal-one',command)
  expect(JSON.parse(String(calls.at(-1)!.options.body))).not.toHaveProperty('patchPolicyDigest')
})

it('requires a server patch target before source-patch plan review', async () => {
  const record = {...makeRecord('source-patch'), projectId:'project', state:'review' as const, activeRunId:null, runs:[], presentation:{title:'目标',planText:'计划正文'}}
  const storageData = new Map<string,string>()
  const storage = {getItem:(key:string)=>storageData.get(key)??null,setItem:(key:string,value:string)=>{storageData.set(key,value)},removeItem:(key:string)=>{storageData.delete(key)}}
  const reviewPlan = vi.fn(async (_id:string, _input:{patchPolicyDigest?:string}) => record)
  const readiness = {schemaVersion:'workflow-readiness-catalogue-v1',workflowId:'goal-one',goalDigest:hash,goalVersion:'1',planDigest:hash,availability:'configured',tasks:[{id:'task',text:'任务',digest:hash,artifactDigest:hash,requiredDependencies:['goal.current']}],sources:[{id:'goal-current',label:'目标',taskId:null,digest:hash,expiresAt:'2099-01-01T00:00:00.000Z',resolves:['goal.current'],remaining:[],status:'verified',reason:null}],current:null,currentStatus:'missing'}
  const policies = {workflowId:'goal-one',revision:3,projectId:'project',policies:[],binding:{state:'static',files:[]},patchPolicy:{targetRoot:'D:/frontend',files:[{id:'panel',path:'src/panel.vue',sha256:hash}],policyDigest:hash}}
  const provider = {list:async()=>[record],readReadiness:async()=>readiness,readSourcePolicies:async()=>policies,reviewPlan}
  wrapper=mount(Panel,{props:{section:'specs',provider:provider as never,pendingStorage:storage},global:{plugins:[ElementPlus]}});await flushPromises()
  await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');await flushPromises()
  await wrapper.findAll('button').find(b=>b.text().includes('读取审阅目录'))!.trigger('click');await flushPromises()
  await wrapper.get('#workflow-review-task').setValue('task')
  await wrapper.get('fieldset input[type="checkbox"]').setValue(true)
  await wrapper.get('#workflow-review-note').setValue('已审阅')
  const reviewButton=()=>wrapper!.findAll('button').find(b=>b.text().includes('审阅并批准此版本计划'))!
  expect(reviewButton().attributes('disabled')).toBeDefined()
  await wrapper.findAll('button').find(b=>b.text().includes('读取补丁目标范围'))!.trigger('click');await flushPromises()
  expect(wrapper.text()).toContain('D:/frontend');expect(wrapper.text()).toContain('src/panel.vue')
  expect(reviewButton().attributes('disabled')).toBeUndefined()
  await reviewButton().trigger('click');await flushPromises()
  expect(reviewPlan).toHaveBeenCalledOnce();expect(reviewPlan.mock.calls[0][1].patchPolicyDigest).toBe(hash)
})

it('does not claim a source patch check for an old unclassified record', async () => {
  await setup()
  expect(wrapper!.find('[data-testid="source-patch-status"]').exists()).toBe(false)
  expect(wrapper!.text()).not.toContain('补丁检查：通过')
})
