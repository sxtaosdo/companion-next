import { afterEach,describe,expect,it } from 'vitest'
import { mount,flushPromises,type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import InfoTip from '../src/components/InfoTip.vue'
let wrapper:VueWrapper|undefined
const help='状态来自本次读取，未取得状态不代表已停止。'
function setup(text=help){wrapper=mount(InfoTip,{props:{label:'状态说明',text},attachTo:document.body,global:{plugins:[ElementPlus]}});return wrapper.get('button')}
afterEach(()=>{wrapper?.unmount();document.body.innerHTML=''})
describe('old-style question-mark explanation',()=>{
 it('is a named native keyboard-focusable button and reveals its described text on focus',async()=>{const button=setup();expect(button.attributes('type')).toBe('button');expect(button.attributes('aria-label')).toBe('状态说明');expect(button.attributes('aria-describedby')).toBeUndefined();await button.trigger('focus');await flushPromises();const id=button.attributes('aria-describedby');expect(id).toBeTruthy();expect(document.getElementById(id!)?.textContent).toBe(help)})
 it('closes with Escape without closing a surrounding dialog and can be reopened',async()=>{const button=setup();await button.trigger('focus');let bubbled=false;wrapper!.element.parentElement?.addEventListener('keydown',()=>{bubbled=true});const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});button.element.dispatchEvent(event);await flushPromises();expect(event.defaultPrevented).toBe(true);expect(bubbled).toBe(false);expect(button.attributes('aria-describedby')).toBeUndefined();await button.trigger('click');expect(button.attributes('aria-describedby')).toBeTruthy()})
 it('retains focused help while the pointer leaves, then clears on blur',async()=>{const button=setup();await button.trigger('focus');await button.trigger('mouseleave');expect(button.attributes('aria-describedby')).toBeTruthy();await button.trigger('blur');expect(button.attributes('aria-describedby')).toBeUndefined()})
 it('supports pointer hover and touch click without creating a new page or dialog',async()=>{const button=setup();await button.trigger('mouseenter');expect(button.attributes('aria-describedby')).toBeTruthy();await button.trigger('mouseleave');expect(button.attributes('aria-describedby')).toBeUndefined();await button.trigger('click');expect(button.attributes('aria-describedby')).toBeTruthy();expect(document.querySelector('[role="dialog"]')).toBeNull()})
 it('renders returned diagnostic text literally without HTML or links',async()=>{const payload='<img src="https://invalid.example" onerror="alert(1)"> <a href="javascript:alert(1)">坏链接</a>';const button=setup(payload);await button.trigger('focus');await flushPromises();const content=document.getElementById(button.attributes('aria-describedby')!);expect(content?.textContent).toBe(payload);expect(content?.querySelector('img,a')).toBeNull()})
})
