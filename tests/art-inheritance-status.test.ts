import {describe,it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ArtInheritanceStatus from '../src/components/ArtInheritanceStatus.vue'
import type {ArtInheritanceResolution} from '../src/project-art-spec-integration'
const pin={path:'P0001/art/style.md',revision:'a'.repeat(40)}
function view(phase:string,resolution:ArtInheritanceResolution|null,extra:Record<string,unknown>={}){return mount(ArtInheritanceStatus,{props:{phase,resolution,inheritance:{mode:'none'},authorities:[],...extra},global:{plugins:[ElementPlus]}})}
describe('truthful inheritance status',()=>{
 it('never infers exclusion from an empty or absent association',()=>{const a=view('editing',null),b=view('editing',{state:'unlinked',code:'NO_PROJECT_ASSOCIATION',sources:[]});expect(a.text()).toContain('尚未核对');expect(b.text()).toContain('尚未关联');expect(b.text()).not.toContain('明确不适用');a.unmount();b.unmount()})
 it('keeps failed reads distinct from missing association',()=>{const a=view('error',{state:'unlinked',code:'NO_PROJECT_ASSOCIATION',sources:[]});expect(a.text()).toContain('读取失败');expect(a.text()).not.toContain('尚未关联');a.unmount()})
 it('renders explicit exclusion only with its source evidence',()=>{const a=view('editing',{state:'not-applicable',code:'EXPLICIT_NOT_APPLICABLE',sources:[pin]});expect(a.text()).toContain('明确不适用');expect(a.text()).toContain(pin.path);a.unmount()})
 it('does not call available or unsaved sources inherited',()=>{const info:ArtInheritanceResolution={state:'available',code:'REVIEWED_SOURCES_AVAILABLE',sources:[pin]},a=view('editing',info);expect(a.text()).toContain('有可选来源');a.unmount();const b=view('editing',info,{inheritance:{mode:'canon',usage:'shared-concept',sources:[pin]},authorities:[{source:pin,status:'Accepted'}],saved:false});expect(b.text()).toContain('待保存继承');b.unmount();const c=view('editing',info,{inheritance:{mode:'canon',usage:'shared-concept',sources:[pin]},authorities:[{source:pin,status:'Accepted'}],saved:true});expect(c.text()).toContain('已继承');c.unmount()})
 it('uses pending and unknown accurately',()=>{const a=view('reading',null),b=view('unknown',null);expect(a.find('.is-loading').exists()).toBe(true);expect(b.text()).toContain('待核对');a.unmount();b.unmount()})
})
