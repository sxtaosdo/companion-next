import { resourceView } from './fixtures/ai-resource-read'
// @ts-ignore Node test runtime provides webcrypto; no browser dependency or Node types required.
import { webcrypto } from 'node:crypto'
import { artBindingHash } from '../src/domain/project-art-pending'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ProjectArtSpecPanel from '../src/components/ProjectArtSpecPanel.vue'
import { projectArtSpecProvider, type ProjectArtSpecProvider } from '../src/project-art-spec-integration'
import type { ProjectArtSpec } from '../src/domain/project-art-spec'
const project = { id: '1234567890abcdef', path: '/test/project', name: 'Test project' }, source = {}
const config = (): ProjectArtSpec => ({ schemaVersion: 'project-art-spec-v1', projectId: project.id, version: 1, project: { name: 'Project', content: 'Test content', engine: 'cocos-creator', designResolution: { width: 750, height: 1334 } }, inheritance: { mode: 'none', reason: 'Independent' }, overrides: { width: 96, height: 96, transparent: true, destination: 'assets/art' }, categories: {} })
let wrapper: VueWrapper | null = null
const button = (label: string) => wrapper!.findAll('button').find(item => item.text() === label)!
beforeEach(() => { vi.stubGlobal('crypto',webcrypto); const data=new Map<string,string>();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)},clear:()=>data.clear()}}); projectArtSpecProvider.value = null })
afterEach(() => { wrapper?.unmount(); wrapper = null })
function setup(provider: ProjectArtSpecProvider | null = null) { wrapper = mount(ProjectArtSpecPanel, { props: { project, source, provider }, global: { plugins: [createPinia()] } }); return wrapper }
describe('project art specification three-section candidate', () => {
  it('requires an explicit usage for an old Canon file and exposes the existing inheritance selector',async()=>{
    const pin={path:'P0001/ip/canon_interface.md',revision:'a'.repeat(40)},old=config();old.inheritance={mode:'canon',sources:[pin]}
    const host:ProjectArtSpecProvider={label:'host',endpoint:'http://127.0.0.1:32181',status:vi.fn(),read:vi.fn(async()=>({projectId:project.id,projectPath:project.path,config:old,hash:'a'.repeat(64),authorities:[{source:pin,status:'Accepted' as const,kind:'canon-interface' as const,projectIds:[project.id],allowedUsages:['shared-concept' as const],categories:['icon' as const],locked:{},defaults:{},requiresImageReference:false}]})),save:vi.fn()}
    setup(host);await button('读取 / 刷新美术规范').trigger('click');await flushPromises()
    const select=wrapper!.get('[aria-label="继承用途"]');expect((select.element as HTMLSelectElement).value).toBe('');expect(wrapper!.find('[role="alert"]').exists()).toBe(true)
    await select.setValue('shared-concept');expect(wrapper!.find('[role="alert"]').exists()).toBe(false);expect(host.save).not.toHaveBeenCalled()
  })

  it('explains explicit legacy migration in the existing confirmation area without an automatic write', async () => {
    const host:ProjectArtSpecProvider={label:'host',endpoint:'http://127.0.0.1:32181',status:vi.fn(),read:vi.fn(async()=>({projectId:project.id,projectPath:project.path,config:resourceView(project.id).config,hash:'a'.repeat(64),authorities:[]})),save:vi.fn()}
    setup(host);await button('读取 / 刷新美术规范').trigger('click');await flushPromises();await button('编写项目美术草稿').trigger('click')
    expect(wrapper!.get('[aria-label="项目导出目录"]').element).toHaveProperty('value', 'art/final/icons');expect(wrapper!.get('[aria-label="项目底色"]').element).toHaveProperty('value', '#ffffff');expect(wrapper!.find('footer').text()).toContain('保留原图标文件');expect(wrapper!.find('footer').text()).toContain('版本 2');expect(host.save).not.toHaveBeenCalled()
  })

  it('shows unavailable engineering save and does not claim browser draft is saved', async () => {
    setup(); await button('编写项目美术草稿').trigger('click')
    expect(wrapper!.text()).toContain('工程保存接口未接入'); expect(wrapper!.text()).toContain('未保存草稿'); expect(button('保存美术规范到工程').attributes('disabled')).toBeDefined()
    expect(wrapper!.findAll('fieldset').map(item => item.find('legend').text())).toEqual(['全局继承', '项目设定', '素材分类']); expect(wrapper!.find('[aria-label="JSON"]').exists()).toBe(false)
  })
  it('switches five categories and edits specific structured fields without network', async () => {
    setup(); await button('编写项目美术草稿').trigger('click'); await button('人物 IP').trigger('click'); expect(wrapper!.find('[aria-label="人物 IP身份 / 角色编号"]').exists()).toBe(true)
    await button('UI').trigger('click'); expect(wrapper!.find('[aria-label="UI文本安全区"]').exists()).toBe(true)
    expect(wrapper!.text()).toContain('参考图入模仍未实现'); expect(wrapper!.find('[aria-label="UI成品宽"]').exists()).toBe(true); expect(wrapper!.find('[aria-label="UI透明背景"]').exists()).toBe(true); expect(wrapper!.find('[aria-label="UI资源目录"]').exists()).toBe(true); expect(wrapper!.find('[aria-label="UI导出目录"]').exists()).toBe(true); expect(wrapper!.find('[aria-label="UI底色"]').exists()).toBe(true)
  })
  it('only exposes backend-provided pinned sources and locks inherited fields', async () => {
    const pin = { path: 'P0001/ip/canteen-transport-interface.md', revision: 'a'.repeat(40) }
    const host: ProjectArtSpecProvider = { label: 'host', endpoint: 'http://127.0.0.1:32181', status: vi.fn(), read: vi.fn(async () => ({ projectId: project.id, projectPath: project.path, config: config(), hash: 'a'.repeat(64), authorities: [{ source: pin, status: 'Accepted' as const, kind: 'canon-interface' as const, allowedUsages: ['runtime' as const], projectIds: [project.id], categories: ['icon' as const], locked: { materials: 'accepted material' }, defaults: {}, requiresImageReference: true }] })), save: vi.fn() }
    setup(host); await button('读取 / 刷新美术规范').trigger('click'); await flushPromises()
    await wrapper!.get(`[aria-label="继承 ${pin.path}"]`).setValue(true)
    expect(wrapper!.text()).toContain(pin.revision); expect(wrapper!.get('[aria-label="项目材质"]').attributes('disabled')).toBeDefined(); expect(wrapper!.get('[aria-label="项目材质"]').element).toHaveProperty('value', 'accepted material')
    expect(host.save).not.toHaveBeenCalled()
  })
  it('writes through provider once after a field change and an independent checkbox', async () => {
    const host: ProjectArtSpecProvider = { label: 'host', endpoint: 'http://127.0.0.1:32181', status: vi.fn(), read: vi.fn(async () => ({ projectId: project.id, projectPath: project.path, config: config(), hash: 'a'.repeat(64), authorities: [] })), save: vi.fn(async (binding, input) => ({ operation:{operationId:input.operationId,bindingHash:await artBindingHash(binding.projectId,binding.projectPath,input),state:'completed' as const}, projectId: project.id, projectPath: project.path, config: { ...input.config, version: 2 }, hash: 'b'.repeat(64), authorities: [] })) }
    setup(host); await button('读取 / 刷新美术规范').trigger('click'); await flushPromises(); await wrapper!.get('[aria-label="美术项目内容"]').setValue('Changed content')
    expect(button('保存美术规范到工程').attributes('disabled')).toBeDefined(); await wrapper!.get('[aria-label="确认美术规范保存"]').setValue(true); await button('保存美术规范到工程').trigger('click'); await flushPromises()
    await vi.waitFor(()=>expect(host.save).toHaveBeenCalledOnce()); await flushPromises(); expect(wrapper!.text()).toContain('已确认保存到工程')
  })
})
