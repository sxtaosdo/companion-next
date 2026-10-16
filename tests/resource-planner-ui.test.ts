import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import ResourcePlanner from '../src/components/ResourcePlanner.vue'
import { useWorkspaceStore } from '../src/stores/workspace'
import { addRequirement, createResourcePlan, exportResourcePlan } from '../src/domain/resource-planning'
import { useResourcePlanningStore } from '../src/stores/resource-planning'
let wrapper:VueWrapper|undefined
beforeEach(()=>localStorage.clear())
afterEach(()=>{wrapper?.unmount();wrapper=undefined;document.body.innerHTML=''})
async function setup(){const pinia=createPinia();const workspace=useWorkspaceStore(pinia);await workspace.openDemo();wrapper=mount(ResourcePlanner,{attachTo:document.body,global:{plugins:[pinia,ElementPlus]}});await flushPromises();return{workspace,planning:useResourcePlanningStore(pinia)}}
function button(text:string){const found=new DOMWrapper(document.body).findAll('button').find(b=>b.text().includes(text));if(!found)throw new Error(`Missing ${text}`);return found}
describe('local resource planning UI (jsdom)',()=>{
 it('starts empty and freezes a spec only after an explicit action',async()=>{const{planning}=await setup();expect(Object.keys(planning.plans)).toHaveLength(0);expect(wrapper!.text()).toContain('刷新页面会丢失');await button('建立内存规划草稿').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('草稿 · 未批准');expect(wrapper!.findAll('.planner-table tbody tr')).toHaveLength(0)})
 it('adds a single-size local requirement and leaves actual counts zero',async()=>{await setup();await button('建立内存规划草稿').trigger('click');await button('添加本地需求').trigger('click');await flushPromises();const body=new DOMWrapper(document.body);await body.find('input[aria-label="资源名称"]').setValue('试点图标');await body.find('input[aria-label="资源用途"]').setValue('商店货币');await button('加入内存需求清单').trigger('click');await flushPromises();expect(wrapper!.findAll('.planner-table tbody tr')).toHaveLength(1);expect(wrapper!.text()).toContain('单尺寸 · 无派生');expect(wrapper!.text()).toContain('实际生成 0');expect(localStorage.length).toBe(0)})
 it('pauses adds and batching if the project specification changes',async()=>{const{workspace}=await setup();await button('建立内存规划草稿').trigger('click');workspace.localDraft={schemaVersion:1,projectId:workspace.project!.id,mode:'demo',revision:'testing',savedAt:new Date().toISOString(),spec:{...workspace.spec!,width:1080}};await flushPromises();expect(wrapper!.text()).toContain('当前规范已变动');expect(button('添加本地需求').attributes('disabled')).toBeDefined()})
 it('exports a preview without a service call or a file-system write',async()=>{await setup();await button('建立内存规划草稿').trigger('click');await button('预览 / 导出计划 JSON').trigger('click');await flushPromises();const body=new DOMWrapper(document.body);expect(body.text()).toContain('不是项目配置或执行结果');const text=(body.find('textarea[aria-label="资源计划 JSON"]').element as HTMLTextAreaElement).value;expect(JSON.parse(text).kind).toBe('companion-resource-plan');expect(localStorage.length).toBe(0)})
})

it('rejects final add when the spec changes after the requirement dialog was opened', async()=>{
 const {workspace,planning}=await setup()
 await button('建立内存规划草稿').trigger('click'); await button('添加本地需求').trigger('click'); await flushPromises()
 const body=new DOMWrapper(document.body)
 await body.find('input[aria-label="资源名称"]').setValue('迟到的需求')
 await body.find('input[aria-label="资源用途"]').setValue('不可进入旧规范批次')
 workspace.localDraft={schemaVersion:1,projectId:workspace.project!.id,mode:'demo',revision:'changed-while-open',savedAt:new Date().toISOString(),spec:{...workspace.spec!,width:1080}}
 await flushPromises(); await button('加入内存需求清单').trigger('click'); await flushPromises()
 expect(body.text()).toContain('当前规范已变动，新增需求已暂停')
 expect(planning.get('demo',workspace.project!.id)?.requirements).toHaveLength(0)
 expect(body.find('[role="dialog"]').exists()).toBe(true)
})

function sampleInput(){return {name:'可恢复资源',category:'图标' as const,purpose:'商店货币',page:'商店',priority:'normal' as const,defaultSize:{width:256,height:256},transparent:true,ownerProtected:false,acceptanceNotes:''}}
it('restores an exported plan through the explicit JSON dialog',async()=>{
 const {workspace,planning}=await setup()
 const p=addRequirement(createResourcePlan(workspace.project!,workspace.spec!,'demo','read-only'),sampleInput())
 await button('导入 / 恢复计划 JSON').trigger('click');await flushPromises()
 const body=new DOMWrapper(document.body);await body.find('textarea[aria-label="待恢复资源计划 JSON"]').setValue(exportResourcePlan(p))
 await button('恢复到浏览器内存').trigger('click');await flushPromises()
 expect(planning.get('demo',workspace.project!.id)?.requirements[0]?.name).toBe('可恢复资源')
 expect(wrapper!.findAll('.planner-table tbody tr')).toHaveLength(1);expect(localStorage.length).toBe(0)
})
it('requires an explicit replacement checkbox and exposes the old draft backup',async()=>{
 const {workspace,planning}=await setup();await button('建立内存规划草稿').trigger('click')
 const oldId=planning.get('demo',workspace.project!.id)!.id
 const p=createResourcePlan(workspace.project!,workspace.spec!,'demo','read-only')
 await button('导入 / 恢复计划 JSON').trigger('click');await flushPromises()
 const body=new DOMWrapper(document.body);await body.find('textarea[aria-label="待恢复资源计划 JSON"]').setValue(exportResourcePlan(p))
 expect(button('恢复到浏览器内存').attributes('disabled')).toBeDefined()
 const label=body.findAll('label.el-checkbox').find(el=>el.text().includes('确认替换当前内存草稿'))!
 await label.find('input[type=checkbox]').setValue(true);await button('恢复到浏览器内存').trigger('click');await flushPromises()
 expect(planning.getBackups('demo',workspace.project!.id)[0]?.id).toBe(oldId)
 expect(wrapper!.text()).toContain('导出备份 1')
 await button('导出备份 1').trigger('click');await flushPromises()
 const preview=(body.find('textarea[aria-label="资源计划 JSON"]').element as HTMLTextAreaElement).value
 expect(JSON.parse(preview).id).toBe(oldId)
})
it('edits an unbatched requirement in place without changing its ID',async()=>{
 const {workspace,planning}=await setup();planning.begin(workspace.project!,workspace.spec!,'demo','read-only');planning.add('demo',workspace.project!.id,sampleInput());await flushPromises()
 const oldId=planning.get('demo',workspace.project!.id)!.requirements[0]!.id
 await button('编辑需求').trigger('click');await flushPromises()
 const body=new DOMWrapper(document.body);await body.find('input[aria-label="资源名称"]').setValue('已修改需求')
 await button('保存内存需求修改').trigger('click');await flushPromises()
 expect(planning.get('demo',workspace.project!.id)!.requirements[0]).toMatchObject({id:oldId,name:'已修改需求'})
})
it('cancels a local batch only after confirmation and keeps its requirement',async()=>{
 const {workspace,planning}=await setup();planning.begin(workspace.project!,workspace.spec!,'demo','read-only');planning.add('demo',workspace.project!.id,sampleInput())
 const p=planning.get('demo',workspace.project!.id)!;planning.batch('demo',workspace.project!.id,'一批',[p.requirements[0]!.id]);await flushPromises()
 expect(button('编辑需求').attributes('disabled')).toBeDefined()
 await button('取消本地计划批次').trigger('click');await flushPromises()
 expect(planning.get('demo',workspace.project!.id)?.batches).toHaveLength(1)
 await button('取消计划批次').trigger('click');await flushPromises()
 expect(planning.get('demo',workspace.project!.id)?.batches).toHaveLength(0)
 expect(planning.get('demo',workspace.project!.id)?.requirements).toHaveLength(1)
 expect(button('编辑需求').attributes('disabled')).toBeUndefined()
})
it('retains the existing draft on invalid JSON without closing recovery',async()=>{
 const {workspace,planning}=await setup();planning.begin(workspace.project!,workspace.spec!,'demo','read-only');const prior=JSON.stringify(planning.plans)
 await button('导入 / 恢复计划 JSON').trigger('click');await flushPromises();const body=new DOMWrapper(document.body)
 await body.find('textarea[aria-label="待恢复资源计划 JSON"]').setValue('{bad')
 await body.findAll('label.el-checkbox').find(el=>el.text().includes('确认替换当前内存草稿'))!.find('input[type=checkbox]').setValue(true)
 await button('恢复到浏览器内存').trigger('click');await flushPromises()
 expect(body.text()).toContain('导入内容不是有效 JSON');expect(JSON.stringify(planning.plans)).toBe(prior)
 expect(body.find('textarea[aria-label="待恢复资源计划 JSON"]').exists()).toBe(true)
})

it('clears the old candidate and confirmation while a newly selected import file is pending',async()=>{
 const {workspace,planning}=await setup();planning.begin(workspace.project!,workspace.spec!,'demo','read-only')
 await button('导入 / 恢复计划 JSON').trigger('click');await flushPromises();const body=new DOMWrapper(document.body)
 const data=exportResourcePlan(createResourcePlan(workspace.project!,workspace.spec!,'demo','read-only'))
 await body.find('textarea[aria-label="待恢复资源计划 JSON"]').setValue(data)
 const check=body.findAll('label.el-checkbox').find(el=>el.text().includes('确认替换当前内存草稿'))!.find('input[type=checkbox]')
 await check.setValue(true)
 expect(button('恢复到浏览器内存').attributes('disabled')).toBeUndefined()
 let resolve!:(value:string)=>void
 const file={size:100,text:()=>new Promise<string>(r=>{resolve=r})}
 const input=body.find('input[type=file]');Object.defineProperty(input.element,'files',{configurable:true,value:[file]})
 await input.trigger('change');await flushPromises()
 expect((body.find('textarea[aria-label="待恢复资源计划 JSON"]').element as HTMLTextAreaElement).value).toBe('')
 expect((check.element as HTMLInputElement).checked).toBe(false)
 expect(button('恢复到浏览器内存').attributes('disabled')).toBeDefined()
 const before=planning.get('demo',workspace.project!.id)!.id
 resolve(data);await flushPromises()
 expect(planning.get('demo',workspace.project!.id)!.id).toBe(before)
 expect(button('恢复到浏览器内存').attributes('disabled')).toBeDefined()
})
it('cannot restore a previous candidate after an oversized or failed new file read',async()=>{
 const {workspace}=await setup();await button('导入 / 恢复计划 JSON').trigger('click');await flushPromises();const body=new DOMWrapper(document.body)
 const data=exportResourcePlan(createResourcePlan(workspace.project!,workspace.spec!,'demo','read-only'))
 const input=body.find('input[type=file]');const textarea=body.find('textarea[aria-label="待恢复资源计划 JSON"]')
 await textarea.setValue(data)
 Object.defineProperty(input.element,'files',{configurable:true,value:[{size:524289,text:async()=>data}]})
 await input.trigger('change');await flushPromises()
 expect((textarea.element as HTMLTextAreaElement).value).toBe('');expect(button('恢复到浏览器内存').attributes('disabled')).toBeDefined()
 expect(body.text()).toContain('512 KiB')
 await textarea.setValue(data)
 Object.defineProperty(input.element,'files',{configurable:true,value:[{size:100,text:async()=>{throw new Error('read failed')}}]})
 await input.trigger('change');await flushPromises()
 expect((textarea.element as HTMLTextAreaElement).value).toBe('');expect(button('恢复到浏览器内存').attributes('disabled')).toBeDefined()
 expect(body.text()).toContain('文件读取失败')
})
it('ignores the late result of an earlier import-file selection',async()=>{
 await setup();await button('导入 / 恢复计划 JSON').trigger('click');await flushPromises();const body=new DOMWrapper(document.body)
 let resolve!:(value:string)=>void;const input=body.find('input[type=file]')
 Object.defineProperty(input.element,'files',{configurable:true,value:[{size:10,text:()=>new Promise<string>(r=>{resolve=r})}]});await input.trigger('change')
 Object.defineProperty(input.element,'files',{configurable:true,value:[{size:10,text:async()=>'{"new":"selection"}'}]});await input.trigger('change');await flushPromises()
 resolve('{"old":"selection"}');await flushPromises()
 expect((body.find('textarea[aria-label="待恢复资源计划 JSON"]').element as HTMLTextAreaElement).value).toBe('{"new":"selection"}')
})
