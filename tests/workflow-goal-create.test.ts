import {afterEach,expect,it,vi} from 'vitest'
import {webcrypto} from 'node:crypto'
import {mount,flushPromises} from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Panel from '../src/components/workflow-operation/WorkflowOperationPanel.vue'
import {GoalDraftController,goalPayloadDigest} from '../src/components/workflow-operation/goal-draft'
import {WorkflowCommandError} from '../src/components/workflow-operation/workflow-operation'
import {ingressRequestDigest} from '../src/components/workflow-operation/scoped-pending'
import {validateRecord,createWorkflowHttpProvider} from '../src/components/workflow-operation/workflow-operation-http'
const op='11111111-1111-4111-8111-111111111111',op2='22222222-2222-4222-8222-222222222222'
const payload=(operationId=op)=>({operationId,businessType:'mcp' as const,deliveryMode:'sample' as const,projectId:'mcp',title:'Useful workflow repair',description:'Verify scoped goal creation'})
const record=(p=payload())=>({schemaVersion:'workflow-operation-v1',id:'goal-'+p.operationId.slice(0,8),revision:0,capability:'task-directory-workspace-write',businessType:p.businessType,deliveryMode:p.deliveryMode,projectId:p.projectId,goal:{source:'gsd',ref:'goal',digest:'a'.repeat(64),version:'1'},state:'draft',plan:null,review:null,activeRunId:null,runs:[]})
function memory(seed:Record<string,string>={}){const map=new Map(Object.entries(seed));return {map,clear:()=>map.clear(),getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:vi.fn((k:string)=>map.delete(k))}}
let wrapper:any
afterEach(async()=>{wrapper?.unmount();await flushPromises();await new Promise(r=>setTimeout(r,10));vi.unstubAllGlobals();document.body.innerHTML=''})
function serialLocks(){let queue=Promise.resolve();const request=vi.fn((_name:string,callback:()=>any)=>{const next=queue.then(callback);queue=next.catch(()=>{});return next});const nav=new Proxy(navigator,{get(target,key){if(key==='locks')return {request};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});vi.stubGlobal('navigator',nav);return request}
it('persists a fixed SHA-256 request before one POST despite double click and leaves execution journals untouched',async()=>{
 vi.stubGlobal('crypto',webcrypto);const storage=memory({'companion.workflow-operation.pending.v1':'old execution unknown'}),c=new GoalDraftController(storage)
 let finish:any;const provider={createGoal:vi.fn(()=>new Promise(r=>finish=r))} as any
 const first=c.submit(payload(),provider),second=c.submit(payload(),provider);await new Promise(r=>setTimeout(r,5))
 expect(provider.createGoal).toHaveBeenCalledTimes(1);expect(c.receipt?.operationId).toBe(op);expect(c.receipt?.requestDigest).toMatch(/^[a-f0-9]{64}$/)
 expect(storage.getItem('companion.workflow-operation.pending.v1')).toBe('old execution unknown')
 finish(record());await Promise.all([first,second]);expect(c.receipt?.phase).toBe('settled');expect(storage.removeItem).not.toHaveBeenCalled()
})
it('retains a timed-out draft through reload, queries the original operation, and never reposts',async()=>{
 vi.stubGlobal('crypto',webcrypto);const storage=memory(),provider={createGoal:vi.fn(async()=>{throw Error('transport unconfirmed')}),getOperation:vi.fn(async(id:string)=>({operationId:id,state:'settled',workflowId:record().id,record:record()}))} as any
 const c=new GoalDraftController(storage);await expect(c.submit(payload(),provider)).rejects.toThrow();expect(c.receipt?.phase).toBe('unknown')
 const restored=new GoalDraftController(storage);await expect(restored.submit(payload(),provider)).rejects.toThrow(/原创建/);await restored.reconcile(provider)
 expect(provider.createGoal).toHaveBeenCalledTimes(1);expect(provider.getOperation).toHaveBeenCalledWith(op,undefined);expect(restored.receipt?.phase).toBe('settled')
})
it('preserves independent unknown creation receipts while another distinct goal is saved',async()=>{
 vi.stubGlobal('crypto',webcrypto);const storage=memory(),c=new GoalDraftController(storage),provider={createGoal:vi.fn(async(p:any)=>{if(p.operationId===op)throw Error('unknown');return record(p)})} as any
 await expect(c.submit(payload(),provider)).rejects.toThrow();await c.submit(payload(op2),provider)
 expect(c.unresolved().map(r=>r.operationId)).toEqual([op]);expect(provider.createGoal).toHaveBeenCalledTimes(2)
 c.selectReceipt(op);expect(c.receipt?.requestDigest).toMatch(/^[a-f0-9]{64}$/);expect(c.receipt?.phase).toBe('unknown')
})
it('does not POST when durable storage fails or when an original payload digest has changed',async()=>{
 vi.stubGlobal('crypto',webcrypto);const provider={createGoal:vi.fn(),getOperation:vi.fn()} as any
 await expect(new GoalDraftController({getItem:()=>null,setItem:()=>{throw Error('disk')}}).submit(payload(),provider)).rejects.toThrow();expect(provider.createGoal).not.toHaveBeenCalled()
 const storage=memory(),c=new GoalDraftController(storage);provider.createGoal.mockRejectedValue(Error('unknown'));await expect(c.submit(payload(),provider)).rejects.toThrow();c.receipt!.payload.title='tampered';await expect(c.reconcile(provider)).rejects.toThrow(/摘要/);expect(provider.getOperation).not.toHaveBeenCalled()
})
it('opens and fills a typed new goal despite unrelated unknown/lane state, with exactly three categories and matching projects',async()=>{
 vi.stubGlobal('crypto',webcrypto);const oldLane=JSON.stringify({channelId:'old-channel',oldWorkflowId:'old-original',workflowId:'old-child',pending:null}),storage=memory({'companion.workflow-operation.followup-lane.v1':oldLane})
 const provider={list:vi.fn(async()=>[]),createGoal:vi.fn(async(p:any)=>record(p)),start:vi.fn(),resume:vi.fn()} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:storage,projects:[{id:'ant',name:'ant-cook',businessTypes:['game']},{id:'mcp',name:'mcp',businessTypes:['mcp']},{id:'ops',name:'Ops',businessTypes:['other']}]},global:{plugins:[ElementPlus]}});await flushPromises()
 await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click')
 expect(wrapper.findAll('#workflow-business-type option').map((o:any)=>o.attributes('value'))).toEqual(['game','mcp','other'])
 expect(wrapper.get('#workflow-goal-title').element.disabled).toBe(false)
 await wrapper.get('#workflow-business-type').setValue('mcp');expect(wrapper.findAll('#workflow-goal-project option').map((o:any)=>o.text())).toEqual(['请选择已登记的具体工程','mcp'])
 await wrapper.get('#workflow-goal-project').setValue('mcp');await wrapper.get('#workflow-delivery-mode').setValue('sample');await wrapper.get('#workflow-goal-title').setValue('Useful workflow repair');await wrapper.get('form[aria-label="新建目标"]').trigger('submit');await new Promise(r=>setTimeout(r,10));await flushPromises()
 expect(provider.createGoal).toHaveBeenCalledTimes(1);expect(provider.createGoal.mock.calls[0][0]).toMatchObject({businessType:'mcp',projectId:'mcp'})
 expect(storage.getItem('companion.workflow-operation.followup-lane.v1')).toBe(oldLane);expect(provider.start).not.toHaveBeenCalled();expect(provider.resume).not.toHaveBeenCalled()
})
it('accepts legacy unclassified records without inventing a type and rejects invalid new metadata',()=>{
 const old={...record()};delete (old as any).businessType;expect(validateRecord(old).businessType).toBeUndefined();expect(old).not.toHaveProperty('businessType')
 expect(()=>validateRecord({...record(),businessType:'fourth'})).toThrow(/business type/)
})
it('preserves a newly acknowledged goal when an older list request completes afterwards',async()=>{
 vi.stubGlobal('crypto',webcrypto);let finishList:any
 const provider={list:vi.fn(()=>new Promise(r=>finishList=r)),createGoal:vi.fn(async(p:any)=>record(p))} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory(),projects:[{id:'mcp',name:'mcp',businessTypes:['mcp']}]},global:{plugins:[ElementPlus]}})
 await flushPromises()
 await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click')
 await wrapper.get('#workflow-business-type').setValue('mcp');await wrapper.get('#workflow-goal-project').setValue('mcp')
 await wrapper.get('#workflow-delivery-mode').setValue('sample');await wrapper.get('#workflow-goal-title').setValue('Useful workflow repair')
 await wrapper.get('form[aria-label="新建目标"]').trigger('submit');await new Promise(r=>setTimeout(r,10));await flushPromises()
 expect(provider.createGoal).toHaveBeenCalledTimes(1)
 finishList([]);await flushPromises()
 const observations=wrapper.emitted('ledger-observation');expect(observations.at(-1)[0].records).toHaveLength(1)
 expect(observations.at(-1)[0].records[0].id).toBe('goal-'+provider.createGoal.mock.calls[0][0].operationId.slice(0,8))
})
it('reopening during a pending POST restores the same identity and digest without resubmitting; late acknowledgement settles the original',async()=>{
 vi.stubGlobal('crypto',webcrypto);const storage=memory(),c=new GoalDraftController(storage);let finish:any
 const provider={createGoal:vi.fn(()=>new Promise(r=>finish=r))} as any
 const p=payload(),sent=c.submit(p,provider);await new Promise(r=>setTimeout(r,5));const digest=c.receipt!.requestDigest
 p.title='edited after submission'
 const reopened=new GoalDraftController(storage);expect(reopened.receipt).toMatchObject({operationId:op,requestDigest:digest,phase:'unknown'});expect(reopened.receipt!.payload.title).toBe('Useful workflow repair')
 await expect(reopened.submit(payload(),provider)).rejects.toThrow();expect(provider.createGoal).toHaveBeenCalledTimes(1)
 finish(record());await sent;expect(new GoalDraftController(storage).receipt).toMatchObject({operationId:op,phase:'settled',requestDigest:digest})
})
it('two independent drafts can submit concurrently, retain each identity, and safely observe a late response',async()=>{
 vi.stubGlobal('crypto',webcrypto);const storage=memory(),a=new GoalDraftController(storage),b=new GoalDraftController(storage);const resolvers=new Map<string,(r:any)=>void>()
 const provider={createGoal:vi.fn((p:any)=>new Promise(r=>resolvers.set(p.operationId,r))),getOperation:vi.fn(async(id:string)=>({operationId:id,state:'settled',workflowId:record(payload(id)).id,record:record(payload(id))}))} as any
 const first=a.submit(payload(),provider),second=b.submit(payload(op2),provider);await new Promise(r=>setTimeout(r,5));expect(provider.createGoal).toHaveBeenCalledTimes(2);expect(a.unresolved().map(r=>r.operationId).sort()).toEqual([op,op2])
 resolvers.get(op2)!(record(payload(op2)));await second;expect(a.unresolved().map(r=>r.operationId)).toEqual([op])
 resolvers.get(op)!(record());await first;expect(a.unresolved()).toEqual([]);expect(provider.createGoal).toHaveBeenCalledTimes(2)
 expect(JSON.parse(storage.getItem('companion.workflow-create.receipt.v1.'+op)!)).toMatchObject({operationId:op,phase:'settled'})
 expect(JSON.parse(storage.getItem('companion.workflow-create.receipt.v1.'+op2)!)).toMatchObject({operationId:op2,phase:'settled'})
})
it('a second controller cannot overwrite an already persisted same-draft identity or changed digest',async()=>{
 vi.stubGlobal('crypto',webcrypto);const storage=memory(),a=new GoalDraftController(storage),b=new GoalDraftController(storage);let finish:any
 const provider={createGoal:vi.fn(()=>new Promise(r=>finish=r))} as any
 const first=a.submit(payload(),provider);await new Promise(r=>setTimeout(r,5));await expect(b.submit({...payload(),title:'changed identity payload'},provider)).rejects.toThrow();expect(provider.createGoal).toHaveBeenCalledTimes(1)
 finish(record());await first
})
it('the real form retains an unknown creation after closing, reopening, and remounting using independent local storage',async()=>{
 vi.stubGlobal('crypto',webcrypto);const lock=serialLocks();vi.stubGlobal('localStorage',memory());vi.stubGlobal('sessionStorage',memory());window.localStorage.clear();window.sessionStorage.setItem('companion.workflow-operation.pending.v1','old execution unknown')
 const provider={list:vi.fn(async()=>[]),createGoal:vi.fn(async()=>{throw Error('unconfirmed transport')}),getOperation:vi.fn(async(id:string)=>({operationId:id,state:'unknown'}))} as any
 const options={props:{provider,section:'goals' as const,projects:[{id:'mcp',name:'mcp',businessTypes:['mcp' as const]}]},global:{plugins:[ElementPlus]}}
 wrapper=mount(Panel,options);await flushPromises();await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click')
 await wrapper.get('#workflow-business-type').setValue('mcp');await wrapper.get('#workflow-goal-project').setValue('mcp');await wrapper.get('#workflow-delivery-mode').setValue('sample');await wrapper.get('#workflow-goal-title').setValue('Retain original draft');await wrapper.get('form[aria-label="新建目标"]').trigger('submit');await new Promise(r=>setTimeout(r,10));await flushPromises()
 const original=JSON.parse(window.localStorage.getItem('companion.workflow-create.receipt.v1.'+provider.createGoal.mock.calls[0][0].operationId)!)
 await wrapper.findAll('button').find((b:any)=>b.text()==='取消').trigger('click');await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click');expect(wrapper.get('#workflow-goal-title').element.value).toBe('Retain original draft')
 wrapper.unmount();wrapper=mount(Panel,options);await flushPromises();await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click')
 expect(wrapper.get('#workflow-goal-title').element.disabled).toBe(true);expect(wrapper.get('#workflow-goal-title').element.value).toBe('Retain original draft');expect(provider.createGoal).toHaveBeenCalledTimes(1)
 const restored=new GoalDraftController(window.localStorage);expect(restored.receipt).toMatchObject({operationId:original.operationId,requestDigest:original.requestDigest,phase:'unknown'});expect(lock).toHaveBeenCalled();expect(window.sessionStorage.getItem('companion.workflow-operation.pending.v1')).toBe('old execution unknown')
})
it('Web Locks serializes only receipt updates across independent controllers, without holding the lock during their POSTs',async()=>{
 vi.stubGlobal('crypto',webcrypto);const lock=serialLocks();vi.stubGlobal('localStorage',memory());vi.stubGlobal('sessionStorage',memory());window.localStorage.clear();const a=new GoalDraftController(window.localStorage),b=new GoalDraftController(window.localStorage);const end=new Map<string,(r:any)=>void>(),provider={createGoal:vi.fn((p:any)=>new Promise(r=>end.set(p.operationId,r)))} as any
 const first=a.submit(payload(),provider),second=b.submit(payload(op2),provider);await new Promise(r=>setTimeout(r,10));expect(provider.createGoal).toHaveBeenCalledTimes(2);expect(a.unresolved().map(r=>r.operationId).sort()).toEqual([op,op2]);expect(lock.mock.calls.every(c=>c[0]==='companion.workflow-create.receipts.v1')).toBe(true)
 end.get(op)!(record());end.get(op2)!(record(payload(op2)));await Promise.all([first,second]);expect(a.unresolved()).toEqual([])
})

it('requires an explicit delivery mode before saving and submits the selected source patch mode',async()=>{
 vi.stubGlobal('crypto',webcrypto);const provider={list:async()=>[],createGoal:vi.fn(async(p:any)=>record(p))} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory(),projects:[{id:'mcp',name:'mcp',businessTypes:['mcp']}]},global:{plugins:[ElementPlus]}});await flushPromises()
 await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click')
 await wrapper.get('#workflow-business-type').setValue('mcp');await wrapper.get('#workflow-goal-project').setValue('mcp');await wrapper.get('#workflow-goal-title').setValue('Patch delivery')
 expect(wrapper.findAll('button').find((b:any)=>b.text()==='保存目标').element.disabled).toBe(true)
 await wrapper.get('form').trigger('submit');await flushPromises();expect(provider.createGoal).not.toHaveBeenCalled()
 await wrapper.get('#workflow-delivery-mode').setValue('source-patch');await wrapper.get('form').trigger('submit');await new Promise(r=>setTimeout(r,10));await flushPromises()
 expect(provider.createGoal).toHaveBeenCalledTimes(1);expect(provider.createGoal.mock.calls[0][0].deliveryMode).toBe('source-patch')
 expect(wrapper.text()).toContain('不会授予源码读取或工程写入权限')
})
it('retains the v1 digest and original payload while reconciling a legacy unknown request',async()=>{
 vi.stubGlobal('crypto',webcrypto);const legacy:any={...payload()};delete legacy.deliveryMode
 const digest=await goalPayloadDigest(legacy),oldBytes=new TextEncoder().encode(JSON.stringify([legacy.operationId,legacy.businessType,legacy.projectId,legacy.title,legacy.description]));const expected=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',oldBytes)),b=>b.toString(16).padStart(2,'0')).join('');expect(digest).toBe(expected)
 const raw=JSON.stringify({schemaVersion:1,operationId:op,payload:legacy,requestDigest:digest,phase:'unknown'}),key='companion.workflow-create.receipt.v1.'+op
 const storage=memory({'companion.workflow-create.active.v1':op,'companion.workflow-create.index.v1':JSON.stringify([op]),[key]:raw});const c=new GoalDraftController(storage)
 expect(storage.getItem(key)).toBe(raw);expect(c.receipt?.payload).not.toHaveProperty('deliveryMode')
 const oldRecord:any=record();delete oldRecord.deliveryMode;const provider={createGoal:vi.fn(),getOperation:vi.fn(async()=>({operationId:op,state:'settled',workflowId:oldRecord.id,record:oldRecord}))} as any
 await c.reconcile(provider);expect(provider.createGoal).not.toHaveBeenCalled();expect(provider.getOperation).toHaveBeenCalledWith(op,undefined);expect(c.receipt?.payload).not.toHaveProperty('deliveryMode')
})
it('binds new receipts to delivery mode and never accepts a mismatching return',async()=>{
 vi.stubGlobal('crypto',webcrypto);const a=payload(),b={...a,deliveryMode:'source-patch' as const};expect(await goalPayloadDigest(a)).not.toBe(await goalPayloadDigest(b))
 const provider={createGoal:vi.fn(async()=>record())} as any,c=new GoalDraftController(memory())
 await expect(c.submit(b,provider)).rejects.toThrow(/身份不匹配/);expect(c.receipt?.phase).toBe('unknown');expect(c.receipt?.payload.deliveryMode).toBe('source-patch')
})
it('validates optional historical delivery modes and sends selected mode on the wire',async()=>{
 const old:any=record();delete old.deliveryMode;expect(validateRecord(old)).not.toHaveProperty('deliveryMode');expect(validateRecord({...old,deliveryMode:'source-patch'}).deliveryMode).toBe('source-patch');expect(()=>validateRecord({...old,deliveryMode:'invalid'})).toThrow(/delivery mode/)
 const fetcher=vi.fn(async(_url:any,options:any)=>({ok:true,redirected:false,status:200,json:async()=>({...old,deliveryMode:JSON.parse(options.body).deliveryMode})}));const provider=createWorkflowHttpProvider(fetcher as any)
 await provider.createGoal({...payload(),deliveryMode:'source-patch'});expect(JSON.parse(fetcher.mock.calls[0][1].body).deliveryMode).toBe('source-patch')
})

it('migrates an unclassified target only after acknowledgement and invalidates the old plan',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any={...record(),state:'review',plan:{source:'openspec',ref:'plan',digest:'b'.repeat(64),version:'1'}};delete original.deliveryMode
 const revised:any={...original,revision:1,state:'draft',plan:null,review:null,deliveryMode:'source-patch'},provider={list:async()=>[original],changeDeliveryMode:vi.fn(async()=>revised),getOperation:vi.fn()} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click')
 const area=wrapper.get('[aria-label="设置历史目标交付方式"]');expect(area.text()).toContain('当前计划和审阅将失效');await area.get('#workflow-migration-mode').setValue('source-patch');expect(area.get('button').element.disabled).toBe(true)
 await area.get('input[type="checkbox"]').setValue(true);await area.get('button').trigger('click');await flushPromises()
 expect(provider.changeDeliveryMode).toHaveBeenCalledTimes(1);expect(provider.changeDeliveryMode.mock.calls[0][1]).toMatchObject({expectedRevision:0,deliveryMode:'source-patch'});expect(wrapper.text()).toContain('原计划不再生效')
})
it('retains an unknown migration and queries the same operation without a repeat POST',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any=record();delete original.deliveryMode;const store=memory(),provider={list:async()=>[original],changeDeliveryMode:vi.fn(async()=>{throw Error('network')}),getOperation:vi.fn(async(id:string)=>({operationId:id,workflowId:original.id,state:'unknown'}))} as any
 const opts={props:{provider,section:'goals' as const,pendingStorage:store},global:{plugins:[ElementPlus]}};wrapper=mount(Panel,opts);await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click')
 let area=wrapper.get('[aria-label="设置历史目标交付方式"]');await area.get('#workflow-migration-mode').setValue('source-patch');await area.get('input[type="checkbox"]').setValue(true);await area.get('button').trigger('click');await flushPromises()
 const sent=provider.changeDeliveryMode.mock.calls[0][1].operationId;expect(wrapper.text()).toContain(sent)
 wrapper.unmount();wrapper=mount(Panel,opts);await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');expect(wrapper.text()).toContain(sent)
 await wrapper.findAll('button').find((b:any)=>b.text()==='查询该请求结果').trigger('click');await flushPromises();expect(provider.getOperation).toHaveBeenCalledWith(sent,original.id);expect(provider.changeDeliveryMode).toHaveBeenCalledTimes(1);expect(wrapper.text()).toContain('保持写入锁定')
})

it('shows server policy files before explicit grant, sends only the fixed policy identity and retains original-plan warning',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any={...record(),deliveryMode:'source-patch'};const digest='a'.repeat(64),policy={id:'ui-source',policyDigest:digest,files:[{id:'panel',root:'D:/example',path:'src/panel.vue',sha256:'b'.repeat(64)}]};const revised:any={...original,revision:1,sourceGrant:{policyId:policy.id,policyDigest:digest,grantedAt:'2026-10-29T01:00:00Z'}}
 const provider={list:async()=>[original],readSourcePolicies:vi.fn(async()=>({workflowId:original.id,revision:0,projectId:'mcp',binding:{state:'none',files:[]},policies:[policy]})),grantSourcePolicy:vi.fn(async()=>revised)} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click')
 const area=wrapper.get('[aria-label="源码策略与授权"]');await area.findAll('button').find((b:any)=>b.text()==='读取源码策略与绑定').trigger('click');await flushPromises();await area.get('input[type="radio"]').setValue(true)
 expect(area.text()).toContain('D:/example');expect(area.text()).toContain('src/panel.vue');expect(area.text()).toContain('当前计划和审阅将失效');const submit=area.findAll('button').find((b:any)=>b.text()==='确认授权此源码范围');expect(submit.element.disabled).toBe(true)
 await area.get('input[type="checkbox"]').setValue(true);await submit.trigger('click');await flushPromises();expect(provider.grantSourcePolicy).toHaveBeenCalledTimes(1)
 const p=provider.grantSourcePolicy.mock.calls[0][1];expect(Object.keys(p).sort()).toEqual(['expectedRevision','operationId','policyDigest','policyId']);expect(p).toMatchObject({policyId:'ui-source',policyDigest:digest,expectedRevision:0});expect(wrapper.text()).toContain('源码范围已授权')
})
it('keeps an unknown source grant request and only queries its original operation after remount',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any={...record(),deliveryMode:'source-patch'},digest='a'.repeat(64),store=memory();const provider={list:async()=>[original],readSourcePolicies:async()=>({workflowId:original.id,revision:0,projectId:'mcp',binding:{state:'none',files:[]},policies:[{id:'ui-source',policyDigest:digest,files:[{id:'panel',root:'D:/example',path:'panel',sha256:'b'.repeat(64)}]}]}),grantSourcePolicy:vi.fn(async()=>{throw Error('timeout')}),getOperation:vi.fn(async(id:string)=>({operationId:id,workflowId:original.id,state:'unknown'}))} as any
 const opts={props:{provider,section:'goals' as const,pendingStorage:store},global:{plugins:[ElementPlus]}};wrapper=mount(Panel,opts);await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');let area=wrapper.get('[aria-label="源码策略与授权"]');await area.get('button').trigger('click');await flushPromises();await area.get('input[type="radio"]').setValue(true);await area.get('input[type="checkbox"]').setValue(true);await area.findAll('button').find((b:any)=>b.text()==='确认授权此源码范围').trigger('click');await flushPromises()
 const id=provider.grantSourcePolicy.mock.calls[0][1].operationId;wrapper.unmount();wrapper=mount(Panel,opts);await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');expect(wrapper.text()).toContain(id);await wrapper.findAll('button').find((b:any)=>b.text()==='查询该请求结果').trigger('click');await flushPromises();expect(provider.getOperation).toHaveBeenCalledWith(id,original.id);expect(provider.grantSourcePolicy).toHaveBeenCalledTimes(1);expect(wrapper.text()).toContain('保持写入锁定')
})
it('rejects a mismatched policy catalogue and does not expose an authorisation action',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any={...record(),deliveryMode:'source-patch'},provider={list:async()=>[original],readSourcePolicies:async()=>({workflowId:original.id,revision:99,projectId:'mcp',binding:{state:'none',files:[]},policies:[]}),grantSourcePolicy:vi.fn()} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');const area=wrapper.get('[aria-label="源码策略与授权"]');await area.get('button').trigger('click');await flushPromises();expect(area.text()).toContain('读取未确认');expect(provider.grantSourcePolicy).not.toHaveBeenCalled()
})
it('never displays legacy mode migration when the goal has a historical run',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any=record();delete original.deliveryMode;original.runs=[{id:'old'}];const provider={list:async()=>[original],changeDeliveryMode:vi.fn()} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');expect(wrapper.find('[aria-label="设置历史目标交付方式"]').exists()).toBe(false);expect(provider.changeDeliveryMode).not.toHaveBeenCalled()
})

it('explains the legacy static source binding refusal without retrying planning',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any=record();delete original.deliveryMode;const provider={list:async()=>[original],generatePlan:vi.fn(async()=>{throw new WorkflowCommandError('rejected','denied','LEGACY_SOURCE_CONTEXT_REVIEW_REQUIRED',409)})} as any
 wrapper=mount(Panel,{props:{provider,section:'specs',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');await wrapper.findAll('button').find((b:any)=>b.text()==='生成计划').trigger('click');await flushPromises();expect(wrapper.text()).toContain('若没有执行历史');expect(wrapper.text()).toContain('已有执行历史时不能直接迁移');expect(provider.generatePlan).toHaveBeenCalledTimes(1)
})

it.each(['static','dynamic','conflict','unverified'])('does not offer another source grant for %s binding',async state=>{
 vi.stubGlobal('crypto',webcrypto);const original:any={...record(),deliveryMode:'source-patch'},files=state==='static'||state==='dynamic'?[{id:'panel',root:'D:/example',path:'panel',sha256:'b'.repeat(64)}]:[],provider={list:async()=>[original],readSourcePolicies:async()=>({workflowId:original.id,revision:0,projectId:'mcp',binding:{state,files},policies:[{id:'ui-source',policyDigest:'a'.repeat(64),files}]}),grantSourcePolicy:vi.fn()} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');const area=wrapper.get('[aria-label="源码策略与授权"]');await area.get('button').trigger('click');await flushPromises();expect(area.find('input[type="radio"]').exists()).toBe(false);expect(area.text()).toContain(state==='static'||state==='dynamic'?'不需重复授权':'不能据此授权或规划');expect(provider.grantSourcePolicy).not.toHaveBeenCalled()
})
it('source policy provider rejects missing binding and validates fixed policy file metadata',async()=>{
 const id='goal-example',file={id:'panel',root:'D:/example',path:'panel.vue',sha256:'b'.repeat(64)},payload={workflowId:id,revision:0,projectId:'mcp',binding:{state:'static',files:[file]},policies:[]}
 const fetcher=vi.fn(async()=>({ok:true,redirected:false,status:200,json:async()=>payload}));const api=createWorkflowHttpProvider(fetcher as any);expect((await api.readSourcePolicies!(id)).binding.state).toBe('static')
 ;(payload as any).binding={state:'unverified',files:[file]};await expect(api.readSourcePolicies!(id)).rejects.toThrow()
})

it('retains an unconfirmed source grant when settled readback lacks the matching binding',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any={...record(),deliveryMode:'source-patch'},store=memory(),digest='a'.repeat(64);const provider={list:async()=>[original],readSourcePolicies:async()=>({workflowId:original.id,revision:0,projectId:'mcp',binding:{state:'none',files:[]},policies:[{id:'ui-source',policyDigest:digest,files:[{id:'panel',root:'D:/example',path:'panel',sha256:'b'.repeat(64)}]}]}),grantSourcePolicy:vi.fn(async()=>{throw Error('timeout')}),getOperation:vi.fn(async(id:string)=>({operationId:id,workflowId:original.id,state:'settled',record:original}))} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:store},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');const area=wrapper.get('[aria-label="源码策略与授权"]');await area.get('button').trigger('click');await flushPromises();await area.get('input[type="radio"]').setValue(true);await area.get('input[type="checkbox"]').setValue(true);await area.findAll('button').find((b:any)=>b.text()==='确认授权此源码范围').trigger('click');await flushPromises();const id=provider.grantSourcePolicy.mock.calls[0][1].operationId
 await wrapper.findAll('button').find((b:any)=>b.text()==='查询该请求结果').trigger('click');await flushPromises();expect(wrapper.text()).toContain('请求结果读取失败');expect(wrapper.text()).toContain(id);expect(provider.grantSourcePolicy).toHaveBeenCalledTimes(1)
})
it('does not apply an in-flight policy read to a different selected goal',async()=>{
 vi.stubGlobal('crypto',webcrypto);const a:any={...record(),deliveryMode:'source-patch'},b:any={...record(payload(op2)),deliveryMode:'source-patch'};let resolveRead:any;const provider={list:async()=>[a,b],readSourcePolicies:()=>new Promise(r=>resolveRead=r),grantSourcePolicy:vi.fn()} as any
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises();let buttons=wrapper.findAll('[aria-label="工作流目标列表"] tbody tr button');await buttons[0].trigger('click');await wrapper.get('[aria-label="源码策略与授权"] button').trigger('click');buttons=wrapper.findAll('[aria-label="工作流目标列表"] tbody tr button');await buttons[1].trigger('click');resolveRead({workflowId:a.id,revision:0,projectId:'mcp',binding:{state:'none',files:[]},policies:[{id:'ui-source',policyDigest:'a'.repeat(64),files:[]}]});await flushPromises();expect(wrapper.text()).not.toContain('ui-source');expect(provider.grantSourcePolicy).not.toHaveBeenCalled()
})

it.each(['valid','wrong-goal','wrong-operation','wrong-kind','wrong-digest','unknown'])('only releases an unobserved rejected mode request with exact ingress proof: %s',async variant=>{
 vi.stubGlobal('crypto',webcrypto);const original:any=record();delete original.deliveryMode;const store=memory(),provider:any={list:async()=>[original],changeDeliveryMode:vi.fn(async()=>{throw Error('response lost')}),getOperation:vi.fn(async(id:string)=>({operationId:id,workflowId:original.id,state:'not-observed'})),readIngressProof:vi.fn(async(id:string,opId:string)=>{const sent=provider.changeDeliveryMode.mock.calls[0][1],digest=await ingressRequestDigest(id,'delivery-mode',sent);return {schemaVersion:'workflow-ingress-proof-v1',workflowId:variant==='wrong-goal'?'goal-other':id,operationId:variant==='wrong-operation'?'other':opId,state:variant==='unknown'?'unknown':'rejected',kind:variant==='wrong-kind'?'source-grant':'delivery-mode',requestDigest:variant==='wrong-digest'?'f'.repeat(64):digest}})}
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:store},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');const area=wrapper.get('[aria-label="设置历史目标交付方式"]');await area.get('#workflow-migration-mode').setValue('source-patch');await area.get('input[type="checkbox"]').setValue(true);await area.get('button').trigger('click');await flushPromises();const sent=provider.changeDeliveryMode.mock.calls[0][1].operationId
 await wrapper.findAll('button').find((b:any)=>b.text()==='查询该请求结果').trigger('click');await new Promise(r=>setTimeout(r,25));await flushPromises();expect(provider.changeDeliveryMode).toHaveBeenCalledTimes(1);expect(provider.readIngressProof).toHaveBeenCalledWith(original.id,sent)
 if(variant==='valid')expect(wrapper.text()).toContain('已明确拒绝');else expect(wrapper.text()).toContain(sent)
})
it('releases a rejected source-grant request only with its full policy and revision digest',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any={...record(),deliveryMode:'source-patch'},digest='a'.repeat(64),provider:any={list:async()=>[original],readSourcePolicies:async()=>({workflowId:original.id,revision:0,projectId:'mcp',binding:{state:'none',files:[]},policies:[{id:'ui-source',policyDigest:digest,files:[]}]}),grantSourcePolicy:vi.fn(async()=>{throw Error('lost')}),getOperation:vi.fn(async(id:string)=>({operationId:id,workflowId:original.id,state:'not-observed'})),readIngressProof:vi.fn(async(id:string,opId:string)=>({schemaVersion:'workflow-ingress-proof-v1',workflowId:id,operationId:opId,state:'rejected',kind:'source-grant',requestDigest:await ingressRequestDigest(id,'source-grant',provider.grantSourcePolicy.mock.calls[0][1])}))}
 wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory()},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');const area=wrapper.get('[aria-label="源码策略与授权"]');await area.get('button').trigger('click');await flushPromises();await area.get('input[type="radio"]').setValue(true);await area.get('input[type="checkbox"]').setValue(true);await area.findAll('button').find((b:any)=>b.text()==='确认授权此源码范围').trigger('click');await flushPromises();await wrapper.findAll('button').find((b:any)=>b.text()==='查询该请求结果').trigger('click');await new Promise(r=>setTimeout(r,25));await flushPromises();expect(wrapper.text()).toContain('已明确拒绝');expect(provider.grantSourcePolicy).toHaveBeenCalledTimes(1)
})

it('finds lost delivery mode and source grant ingress IDs and retains a locked no-replay marker',async()=>{
 vi.stubGlobal('crypto',webcrypto);const original:any=record(),store=memory(),changeDeliveryMode=vi.fn(),grantSourcePolicy=vi.fn(),rows=[{workflowId:original.id,operationId:op,kind:'delivery-mode',state:'unknown'},{workflowId:original.id,operationId:'legacy-grant-a',kind:'source-grant',state:'pending'}],provider:any={list:async()=>[original],listRequestIngress:vi.fn(async()=>rows),changeDeliveryMode,grantSourcePolicy,getOperation:vi.fn()}
 const opts={props:{provider,section:'execution' as const,pendingStorage:store},global:{plugins:[ElementPlus]}};wrapper=mount(Panel,opts);await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');await wrapper.get('[data-testid="find-server-request"]').trigger('click');await flushPromises();expect(wrapper.text()).toContain(op);expect(wrapper.text()).toContain('legacy-grant-a');expect(wrapper.text()).toContain('不能猜测或重发')
 wrapper.unmount();wrapper=mount(Panel,opts);await flushPromises();await wrapper.get('[aria-label="工作流目标列表"] tbody tr button').trigger('click');expect(wrapper.text()).toContain('legacy-grant-a');await wrapper.findAll('button').find((b:any)=>b.text()==='查询该请求结果').trigger('click');await flushPromises();expect(wrapper.text()).toContain('继续锁定');expect(changeDeliveryMode).not.toHaveBeenCalled();expect(grantSourcePolicy).not.toHaveBeenCalled();expect(provider.getOperation).not.toHaveBeenCalled()
})
it('keeps an unsent draft when closing and reopening the actual dialog, then starts fresh after settlement',async()=>{
 vi.stubGlobal('crypto',webcrypto);const provider={list:vi.fn(async()=>[]),createGoal:vi.fn(async(p:any)=>record(p))} as any
 wrapper=mount(Panel,{attachTo:document.body,props:{provider,section:'goals',pendingStorage:memory(),projects:[{id:'mcp',name:'MCP 工程',businessTypes:['mcp']}]},global:{plugins:[ElementPlus]}});await flushPromises()
 const open=()=>wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click');const cancel=()=>wrapper.findAll('button').find((b:any)=>b.text()==='取消').trigger('click')
 await open();await wrapper.get('#workflow-business-type').setValue('mcp');await wrapper.get('#workflow-goal-project').setValue('mcp');await wrapper.get('#workflow-delivery-mode').setValue('source-patch');await wrapper.get('#workflow-goal-title').setValue('尚未提交');await wrapper.get('#workflow-goal-description').setValue('保留完整描述')
 await cancel();await flushPromises();await open();await flushPromises();expect(wrapper.get('#workflow-business-type').element.value).toBe('mcp');expect(wrapper.get('#workflow-goal-project').element.value).toBe('mcp');expect(wrapper.get('#workflow-delivery-mode').element.value).toBe('source-patch');expect(wrapper.get('#workflow-goal-title').element.value).toBe('尚未提交');expect(wrapper.get('#workflow-goal-description').element.value).toBe('保留完整描述');expect(provider.createGoal).not.toHaveBeenCalled()
 await wrapper.get('form[aria-label="新建目标"]').trigger('submit');await new Promise(r=>setTimeout(r,10));await flushPromises();expect(provider.createGoal).toHaveBeenCalledTimes(1);await cancel();await open();await flushPromises();expect(wrapper.get('#workflow-goal-title').element.value).toBe('');expect(wrapper.get('#workflow-delivery-mode').element.value).toBe('')
})
it('retains a separate unsent draft after explicitly creating another goal while the original is unknown',async()=>{
 vi.stubGlobal('crypto',webcrypto);const provider={list:async()=>[],createGoal:vi.fn(async()=>{throw Error('unconfirmed')})} as any
 wrapper=mount(Panel,{attachTo:document.body,props:{provider,section:'goals',pendingStorage:memory(),projects:[{id:'mcp',name:'MCP 工程',businessTypes:['mcp']}]},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click');await wrapper.get('#workflow-business-type').setValue('mcp');await wrapper.get('#workflow-goal-project').setValue('mcp');await wrapper.get('#workflow-delivery-mode').setValue('sample');await wrapper.get('#workflow-goal-title').setValue('原请求');await wrapper.get('form[aria-label="新建目标"]').trigger('submit');await new Promise(r=>setTimeout(r,10));await flushPromises();await wrapper.findAll('button').find((b:any)=>b.text()==='另建不同目标（保留原回执）').trigger('click');await wrapper.get('#workflow-goal-title').setValue('另一份未提交草稿');await wrapper.findAll('button').find((b:any)=>b.text()==='取消').trigger('click');await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click');await flushPromises();expect(wrapper.get('#workflow-goal-title').element.value).toBe('另一份未提交草稿');expect(provider.createGoal).toHaveBeenCalledTimes(1);const originalId=provider.createGoal.mock.calls[0][0].operationId;expect(wrapper.text()).toContain(originalId);await wrapper.findAll('button').find((b:any)=>b.text().includes('查看原创建 '+originalId)).trigger('click');expect(wrapper.get('#workflow-goal-title').element.value).toBe('原请求');expect(wrapper.get('#workflow-goal-title').element.disabled).toBe(true)
})
it('derives business context from the selected project without requiring advanced settings',async()=>{vi.stubGlobal('crypto',webcrypto);const provider={list:async()=>[],createGoal:vi.fn(async(p:any)=>record(p))} as any;wrapper=mount(Panel,{props:{provider,section:'goals',pendingStorage:memory(),projects:[{id:'mcp',name:'mcp',businessTypes:['mcp']}]},global:{plugins:[ElementPlus]}});await flushPromises();await wrapper.findAll('button').find((b:any)=>b.text()==='新建目标').trigger('click');await wrapper.get('#workflow-goal-project').setValue('mcp');expect(wrapper.get('#workflow-business-type').element.value).toBe('mcp');await wrapper.get('#workflow-delivery-mode').setValue('sample');await wrapper.get('#workflow-goal-title').setValue('简化新需求');await wrapper.get('form[aria-label="新建目标"]').trigger('submit');await new Promise(r=>setTimeout(r,10));await flushPromises();expect(provider.createGoal.mock.calls[0][0]).toMatchObject({businessType:'mcp',projectId:'mcp'})})
