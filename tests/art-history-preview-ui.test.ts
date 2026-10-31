// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Panel from '../src/components/ArtOutputReviewPanel.vue'
import {decodeArtOutputReviewSnapshot} from '../src/adapters/art-output-review'
import {appendArtOutputVersion} from '../src/domain/art-output-history'
import {context,need,job,observation,preview,provider,scope,snapshot,storage} from './fixtures/art-output-review'
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();vi.unstubAllGlobals()})
async function click(id:string){await wrapper!.get('[data-testid="'+id+'"]').trigger('click');await flushPromises()}
it('accepts only an explicit boolean historical capability, preserving unavailable current source',()=>{
 const base=snapshot(),value={...base,capabilities:{...base.capabilities,historicalPreview:true,registerOutput:false,review:false},snapshot:{...base.snapshot,currentJobId:null,currentSourceRevision:null}}
 expect(decodeArtOutputReviewSnapshot(value,scope).capabilities.historicalPreview).toBe(true)
 expect(decodeArtOutputReviewSnapshot(value,scope).snapshot.currentSourceRevision).toBeNull()
 expect(()=>decodeArtOutputReviewSnapshot({...value,capabilities:{...value.capabilities,historicalPreview:'true'}},scope)).toThrow()
})
it.each([null,'b'.repeat(40)])('allows pinned historical pictures with current source %s and never enables review',async(source)=>{
 const first=snapshot(),next=observation('7'.repeat(64));const history=appendArtOutputVersion(first.history!,1,{...next,job:{...next.job,jobId:'STUDIO-RUN-second-b1c2d3e4',sourceRevision:'b'.repeat(40)}})
 const value={...first,history,capabilities:{...first.capabilities,historicalPreview:true,registerOutput:false,review:false},snapshot:{...first.snapshot,currentJobId:null,currentSourceRevision:source}}
 const api=provider(value)
 api.previewVersion.mockImplementation(async(_context,input)=>{
  const version=history.versions.find(row=>row.versionId===input.versionId)!
  const dto=preview(value);return {...dto,versionId:version.versionId,sourceRevision:version.sourceRevision,preview:{...dto.preview,candidateId:version.candidateId,sha256:version.fileSha256},previewReceipt:{...dto.previewReceipt,versionId:version.versionId,fileSha256:version.fileSha256,sourceRevision:version.sourceRevision}}
 })
 wrapper=mount(Panel,{props:{context,need:need(),job:job(),provider:api,storage:storage()},global:{plugins:[ElementPlus]}})
 expect(api.read).not.toHaveBeenCalled();await click('review-read')
 await wrapper.get('[data-testid="review-left"]').setValue(history.versions[0]!.versionId);await wrapper.get('[data-testid="review-right"]').setValue(history.versions[1]!.versionId);await click('review-compare')
 expect(wrapper.find('[data-testid="review-comparison"]').exists()).toBe(true)
 if(source===null)expect(wrapper.get('[data-testid="review-comparison"]').text()).toContain('来源待核对')
 await click('review-preview-1');await click('review-preview-2')
 expect(api.previewVersion).toHaveBeenCalledTimes(2);expect(wrapper.findAll('img')).toHaveLength(2)
 for(const image of wrapper.findAll('img')){Object.defineProperties(image.element,{naturalWidth:{value:1024,configurable:true},naturalHeight:{value:1024,configurable:true}});await image.trigger('load')}
 expect(wrapper.get('[data-testid="review-accept"]').attributes('disabled')).toBeDefined();expect(wrapper.get('[data-testid="review-register"]').attributes('disabled')).toBeDefined();expect(api.review).not.toHaveBeenCalled();expect(api.registerOutput).not.toHaveBeenCalled()
})
it('does not approve a registration revision receipt after the current job revision advances',async()=>{
 const value=snapshot(),api=provider(value)
 wrapper=mount(Panel,{props:{context,need:need(),job:{...job(),revision:5},provider:api,storage:storage()},global:{plugins:[ElementPlus]}})
 await click('review-read');await wrapper.get('[data-testid="review-version"]').setValue(value.history!.versions[0]!.versionId);await click('review-preview-1')
 const image=wrapper.get('img');Object.defineProperties(image.element,{naturalWidth:{value:1024,configurable:true},naturalHeight:{value:1024,configurable:true}});await image.trigger('load')
 expect(wrapper.get('[data-testid="review-confirm"]').attributes('disabled')).toBeDefined();expect(wrapper.get('[data-testid="review-accept"]').attributes('disabled')).toBeDefined();expect(api.review).not.toHaveBeenCalled()
})
