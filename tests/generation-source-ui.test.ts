import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import GenerationSourcePanel from '../src/components/GenerationSourcePanel.vue'
import { useWorkspaceStore } from '../src/stores/workspace'
import { useResourcePlanningStore } from '../src/stores/resource-planning'
let wrapper:VueWrapper|undefined
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';localStorage.clear();vi.unstubAllGlobals()})
async function setup(begin=true){const pinia=createPinia();const workspace=useWorkspaceStore(pinia);await workspace.openDemo();const planning=useResourcePlanningStore(pinia);if(begin)planning.begin(workspace.project!,workspace.spec!,'demo','read-only');wrapper=mount(GenerationSourcePanel,{attachTo:document.body,global:{plugins:[pinia,ElementPlus]}});await flushPromises();return {workspace,planning}}
function button(text:string){const b=new DOMWrapper(document.body).findAll('button').find(e=>e.text().includes(text));if(!b)throw new Error(`missing ${text}`);return b}
async function choose(value:string){await wrapper!.find(`input[type=radio][value="${value}"]`).setValue(true);await flushPromises()}
describe('generation source UI without external invocation',()=>{
 it('requires an existing plan and does not choose a source by default',async()=>{await setup(false);expect(wrapper!.text()).toContain('先在「资源规划」');expect(button('预览统一交接 JSON').attributes('disabled')).toBeDefined();expect(wrapper!.find('input[value="codex-native"]').attributes('disabled')).toBeDefined()})
 it('switches freely without changing project spec or causing a network call',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const {workspace,planning}=await setup();const spec=JSON.stringify(workspace.spec);const initial=planning.get('demo',workspace.project!.id)!.binding;await choose('codex-native');expect(wrapper!.text()).toContain('半自动 · 会话生成 / 人工回收');expect(wrapper!.text()).toContain('不切换到付费 Image API');await choose('comfyui');expect(wrapper!.text()).toContain('本网页未连接');expect(planning.get('demo',workspace.project!.id)?.binding).toEqual(initial);expect(JSON.stringify(workspace.spec)).toBe(spec);expect(fetch).not.toHaveBeenCalled();expect(localStorage.length).toBe(0);expect(button('提交生成').attributes('disabled')).toBeDefined()})
 it('previews an empty output receipt and invalidates it after selection changes',async()=>{const {workspace,planning}=await setup();await choose('codex-native');await button('预览统一交接 JSON').trigger('click');await flushPromises();const body=new DOMWrapper(document.body);const json=JSON.parse((body.find('textarea[aria-label="生成交接 JSON"]').element as HTMLTextAreaElement).value);expect(json.source.source).toBe('codex-native');expect(json.outputReceipt.artifacts).toEqual([]);expect(json.manifest.generationSource).toBe('codex-native');planning.selectSource('demo',workspace.project!.id,'comfyui');await flushPromises();expect((body.find('textarea[aria-label="生成交接 JSON"]').element as HTMLTextAreaElement).value).toBe('');expect(wrapper!.text()).toContain('实际提交 0')})
 it('keeps each project source choice and clears a preview on navigation',async()=>{const {workspace}=await setup();const first=workspace.selectedProjectId;await choose('codex-native');await button('预览统一交接 JSON').trigger('click');await flushPromises();workspace.selectedProjectId='demo-4060';await flushPromises();expect(button('预览统一交接 JSON').attributes('disabled')).toBeDefined();workspace.selectedProjectId=first;await flushPromises();expect((wrapper!.find('input[value="codex-native"]').element as HTMLInputElement).checked).toBe(true)})
})

it('invalidates a handoff preview when the current specification changes',async()=>{
 const {workspace}=await setup();await choose('codex-native');await button('预览统一交接 JSON').trigger('click');await flushPromises()
 const body=new DOMWrapper(document.body)
 const before=JSON.parse((body.find('textarea[aria-label="生成交接 JSON"]').element as HTMLTextAreaElement).value)
 expect(before.blockers.map((b:{code:string})=>b.code)).not.toContain('spec-not-current')
 workspace.localDraft={schemaVersion:1,projectId:workspace.project!.id,mode:'demo',revision:'changed-after-preview',savedAt:new Date().toISOString(),spec:{...workspace.spec!,width:1080}}
 await flushPromises()
 expect((body.find('textarea[aria-label="生成交接 JSON"]').element as HTMLTextAreaElement).value).toBe('')
 await button('预览统一交接 JSON').trigger('click');await flushPromises()
 const after=JSON.parse((body.find('textarea[aria-label="生成交接 JSON"]').element as HTMLTextAreaElement).value)
 expect(after.blockers.map((b:{code:string})=>b.code)).toContain('spec-not-current')
})
