// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {defineComponent} from 'vue'
import {flushPromises,mount} from '@vue/test-utils'
import {createPinia} from 'pinia'
import ElementPlus from 'element-plus'
import Manager from '../src/components/ArtWorkbenchManager.vue'
import {savedReferenceLibraryKey} from '../src/adapters/saved-reference-library'
import {need,scope} from './fixtures/art-output-review'
import {WORKBENCH_REFERENCE_LEDGER_KEY} from '../src/domain/art-workbench'
import {AI_REFERENCE_UPLOAD_FENCE_KEY} from '../src/stores/ai-reference-upload'
const selection=vi.hoisted(()=>({source:{},project:{id:'1234567890abcdef',name:'Fixture',path:'D:/fixture-only'}}))
vi.mock('../src/stores/registered-project',()=>({useRegisteredProjectStore:()=>({project:selection.project,currentSource:selection.source})}))
vi.mock('../src/stores/project-art-spec',()=>({useProjectArtSpecStore:()=>({base:{projectId:selection.project.id,version:1},hash:'a'.repeat(64),phase:'editing',dirty:false,pending:false,blocked:false,context:{projectId:selection.project.id,projectPath:selection.project.path,source:selection.source}}),useResourceDomainArtSpecStore:()=>({base:null,context:null})}))
const Picker=defineComponent({props:['identity','entries','target','existingReferences','reader','disabled','active'],emits:['select'],template:'<div data-testid="library-seam"/>'})
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();localStorage.clear();sessionStorage.clear();vi.unstubAllGlobals()})
it('Manager lists saved references and rechecks the original source/list/target before local-only attachment',async()=>{
 const reference={name:'Saved specimen',relativePath:'art/reference/saved.png',sha256:'7'.repeat(64)},spec={...need().spec,references:[reference]}
 const fetch=vi.fn(async()=>new Response(JSON.stringify({projectId:scope.projectId,projectPath:scope.projectPath,hash:'b'.repeat(64),document:{schemaVersion:'art-workbench-v1',projectId:scope.projectId,projectPath:scope.projectPath,version:1,norm:{hash:'a'.repeat(64),version:1},projectReferences:[],specs:[spec],needs:[]},capabilities:{generation:false,imageConditioning:false,referenceUpload:true,existingJobLink:true}}),{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetch)
 wrapper=mount(Manager,{props:{view:'specs'},global:{plugins:[createPinia(),ElementPlus],stubs:{SavedReferenceLibraryPicker:Picker,ElDialog:{props:['modelValue'],template:'<div v-if="modelValue"><slot/></div>'}}}})
 expect(fetch).not.toHaveBeenCalled();await wrapper.findAll('button').find(row=>row.text()==='读取 / 刷新工作台')!.trigger('click');await flushPromises()
 await wrapper.get('[data-testid="workbench-project-references"]').trigger('click');await flushPromises()
 const picker=wrapper.getComponent(Picker),identity=picker.props('identity'),entries=picker.props('entries'),target=picker.props('target')
 expect(identity).toMatchObject({projectId:scope.projectId,projectPath:scope.projectPath,workbenchHash:'b'.repeat(64),source:selection.source});expect(entries).toEqual([{reference,origins:['规格 icon · v1']}]);expect(target).toMatchObject({scope:'project',targetId:scope.projectId});expect(picker.props('disabled')).toBe(false)
 const event={schemaVersion:'saved-reference-library-selection-v1',identity,listKey:savedReferenceLibraryKey(identity,entries),target,reference,preview:{sha256:reference.sha256,width:1024,height:1024,displayed:true}}
 picker.vm.$emit('select',{...event,identity:{...identity,source:{}}});await flushPromises();expect(picker.props('existingReferences')).toHaveLength(0)
 picker.vm.$emit('select',event);await flushPromises();expect(picker.props('existingReferences')).toEqual([reference]);expect(fetch).toHaveBeenCalledTimes(1)
 picker.vm.$emit('select',event);await flushPromises();expect(picker.props('existingReferences')).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1)
})
it.each(['workbench','legacy'] as const)('keeps %s persistent UNKNOWN locked after closing and reopening references',async(kind)=>{
 const reference={name:'Saved specimen',relativePath:'art/reference/saved.png',sha256:'7'.repeat(64)},spec={...need().spec,references:[reference]}
 const fetch=vi.fn(async()=>new Response(JSON.stringify({projectId:scope.projectId,projectPath:scope.projectPath,hash:'b'.repeat(64),document:{schemaVersion:'art-workbench-v1',projectId:scope.projectId,projectPath:scope.projectPath,version:1,norm:{hash:'a'.repeat(64),version:1},projectReferences:[],specs:[spec],needs:[]},capabilities:{generation:false,imageConditioning:false,referenceUpload:true,existingJobLink:true}}),{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetch)
 wrapper=mount(Manager,{props:{view:'specs'},global:{plugins:[createPinia(),ElementPlus],stubs:{SavedReferenceLibraryPicker:Picker,ElDialog:{props:['modelValue'],template:'<div v-if="modelValue"><slot/></div>'}}}})
 await wrapper.findAll('button').find(row=>row.text()==='读取 / 刷新工作台')!.trigger('click');await flushPromises();await wrapper.get('[data-testid="workbench-project-references"]').trigger('click');await flushPromises()
 let picker=wrapper.getComponent(Picker);const identity=picker.props('identity'),entries=picker.props('entries'),target=picker.props('target'),event={schemaVersion:'saved-reference-library-selection-v1',identity,listKey:savedReferenceLibraryKey(identity,entries),target,reference,preview:{sha256:reference.sha256,width:1024,height:1024,displayed:true}}
 const key=kind==='workbench'?WORKBENCH_REFERENCE_LEDGER_KEY:AI_REFERENCE_UPLOAD_FENCE_KEY
 const record=kind==='workbench'?{...target,name:'Unknown original',originalSha256:'8'.repeat(64),mimeType:'image/png',width:16,height:16,receipt:null}:{project:selection.project,originalSha256:'8'.repeat(64),mimeType:'image/png',width:16,height:16,receipt:null}
 const original=JSON.stringify([record]);sessionStorage.setItem(key,original)
 await wrapper.findAll('button').find(row=>row.text()==='前往参考素材采集')!.trigger('click');await flushPromises();await wrapper.get('[data-testid="workbench-project-references"]').trigger('click');await flushPromises()
 picker=wrapper.getComponent(Picker);expect(picker.props('disabled')).toBe(true);picker.vm.$emit('select',event);await flushPromises();expect(picker.props('existingReferences')).toHaveLength(0);expect(sessionStorage.getItem(key)).toBe(original);expect(fetch).toHaveBeenCalledTimes(1)
})
