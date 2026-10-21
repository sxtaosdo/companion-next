import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ProjectStatusTag from '../src/components/ProjectStatusTag.vue'
import OperationFeedback from '../src/components/OperationFeedback.vue'
let wrapper:VueWrapper|undefined
afterEach(()=>{wrapper?.unmount();document.body.innerHTML=''})
describe('operation feedback preserves request versus runtime facts',()=>{
 it('immediately shows pending start over a stopped snapshot, then uses only observed runtime after receipt',async()=>{
  wrapper=mount(ProjectStatusTag,{props:{status:{projectId:'p',state:'stopped',capabilityProfile:'unknown'},operation:{action:'start',phase:'sending'}},global:{plugins:[ElementPlus]}})
  expect(wrapper.text()).toBe('启动中');expect(wrapper.get('[role="status"]').attributes('aria-busy')).toBe('true');expect(wrapper.find('.status-spin').exists()).toBe(true)
  await wrapper.setProps({operation:{action:'start',phase:'acknowledged'}})
  expect(wrapper.text()).toBe('已停止');expect(wrapper.text()).not.toContain('已就绪')
  await wrapper.setProps({status:{projectId:'p',state:'bridge-wait',capabilityProfile:'unknown'}})
  expect(wrapper.find('.status-spin').exists()).toBe(true)
  await wrapper.setProps({status:{projectId:'p',state:'ready',capabilityProfile:'unknown'}})
  expect(wrapper.text()).toBe('已就绪');expect(wrapper.find('.status-spin').exists()).toBe(false)
 })
 it('keeps stop, failure and unknown visibly distinct without inventing stopped',async()=>{
  wrapper=mount(ProjectStatusTag,{props:{status:{projectId:'p',state:'ready',capabilityProfile:'unknown'},operation:{action:'stop',phase:'sending'}},global:{plugins:[ElementPlus]}})
  expect(wrapper.text()).toBe('停止中')
  await wrapper.setProps({operation:{action:'stop',phase:'reported-failure'}});expect(wrapper.text()).toBe('停止失败');expect(wrapper.get('.el-tag').classes()).toContain('el-tag--danger')
  await wrapper.setProps({operation:{action:'stop',phase:'unknown'}});expect(wrapper.text()).toBe('结果未知，待核对');expect(wrapper.get('.el-tag').classes()).toContain('el-tag--warning');expect(wrapper.find('.status-spin').exists()).toBe(false)
 })
 it('announces the same compact lifecycle semantics in existing service and dialog feedback',async()=>{
  wrapper=mount(OperationFeedback,{props:{phase:'sending',action:'restart'},global:{plugins:[ElementPlus]}})
  expect(wrapper.text()).toBe('重启中');expect(wrapper.attributes('aria-busy')).toBe('true')
  await wrapper.setProps({phase:'acknowledged'});expect(wrapper.text()).toBe('已收到重启回执');expect(wrapper.text()).not.toContain('就绪');expect(wrapper.attributes('aria-busy')).toBe('false')
  await wrapper.setProps({phase:'rejected'});expect(wrapper.text()).toBe('请求被拒绝')
 })
})
