// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ArtWorkbenchManager from '../src/components/ArtWorkbenchManager.vue'
import ArtTaskDetailDialog from '../src/components/ArtTaskDetailDialog.vue'
import ArtVisualReviewDialog from '../src/components/ArtVisualReviewDialog.vue'
import { aiJobsReadProvider } from '../src/ai-jobs-read-integration'
import type { AiJobsReadProvider } from '../src/domain/ai-jobs-read'
import { job, need, scope } from './fixtures/art-output-review'
const selection = vi.hoisted(() => ({ source: {}, project: { id: '1234567890abcdef', name: 'Fixture', path: 'D:/fixture-only' } }))
vi.mock('../src/stores/registered-project', () => ({ useRegisteredProjectStore: () => ({ project: selection.project, currentSource: selection.source }) }))
vi.mock('../src/stores/project-art-spec', () => ({ useProjectArtSpecStore: () => ({ base: { projectId: selection.project.id, version: 1 }, hash: 'a'.repeat(64), phase: 'editing', dirty: false, pending: false, blocked: false, context: { projectId: selection.project.id, projectPath: selection.project.path, source: selection.source } }), useResourceDomainArtSpecStore: () => ({ base: null, context: null }) }))
const taskRead = reactive({ state: 'awaiting_selection', loading: false, snapshot: job() })
const panel = defineComponent({ setup(_, { expose }) { expose({ workflowSnapshot: computed(() => ({ state: 'awaiting_selection', candidates: 1, selected: 0, hasImport: false })), readStatusSnapshot: computed(() => ({ state: taskRead.state, snapshot: taskRead.snapshot, projectId: selection.project.id, projectPath: selection.project.path, source: selection.source, hasRead: true, loading: taskRead.loading, error: '', historyOnly: false })), readCreatedTask: vi.fn(async () => {}) }); return () => null } })
const review = defineComponent({ props: ['context', 'need', 'job', 'provider', 'active'], template: '<div data-testid="review-mount"/>' })
let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => { wrapper?.unmount(); aiJobsReadProvider.value = null; sessionStorage.clear(); vi.unstubAllGlobals(); taskRead.snapshot = job(); taskRead.state = 'awaiting_selection'; taskRead.loading = false })
describe('Manager mounting against guarded source', () => {
  it('passes actual bound need/job/context and passive provider, then removes the panel on task close', async () => {
    const bound = need(), value = job()
    const fetch = vi.fn(async (_path: string, _init?: RequestInit) => new Response(JSON.stringify({ projectId: scope.projectId, projectPath: scope.projectPath, hash: 'b'.repeat(64), document: { schemaVersion: 'art-workbench-v1', projectId: scope.projectId, projectPath: scope.projectPath, version: 1, norm: { hash: 'a'.repeat(64), version: 1 }, projectReferences: [], specs: [bound.spec], needs: [bound] }, capabilities: { generation: false, imageConditioning: false, referenceUpload: true, existingJobLink: true } }), { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    aiJobsReadProvider.value = { label: 'isolated actual-job fixture', readJobs: vi.fn<AiJobsReadProvider['readJobs']>(async () => ({ schemaVersion: 'companion-icons-v1', projectId: scope.projectId, sourceRevision: value.sourceRevision, jobs: [value], profile: { id: value.profile, ...value.budget }, schedulerEnabled: false, workerResident: false })), readStatus: vi.fn(async () => value), previewCandidate: vi.fn(async () => { throw Error('not requested') }) }
    wrapper = mount(ArtWorkbenchManager, { props: { view: 'needs' }, global: { plugins: [createPinia()], stubs: { AiJobsReadPanel: panel, ArtOutputReviewPanel: review, ElDialog: { props: ['modelValue'], template: '<div v-show="modelValue"><slot/></div>' } } } })
    await wrapper.findAll('button').find(button => button.text() === '读取 / 刷新工作台')!.trigger('click'); await flushPromises()
    expect(wrapper.find('[data-testid="review-mount"]').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === '处理任务')!.trigger('click'); await flushPromises()
    await wrapper.get('[data-testid="task-open-visual-review"]').trigger('click'); await flushPromises()
    const child = wrapper.getComponent(review)
    expect(child.props('need')).toMatchObject({ id: scope.needId, jobId: value.jobId })
    expect(child.props('job')).toMatchObject({ jobId: value.jobId, revision: 4, state: 'awaiting_selection' })
    expect(child.props('context')).toMatchObject({ projectId: scope.projectId, projectPath: scope.projectPath, source: selection.source })
    expect(child.props('provider').endpoint).toBe('same-origin:art-output-review-v1')
    taskRead.snapshot = { ...value, jobId: 'STUDIO-RUN-other-task-12345678' }; await flushPromises()
    expect(child.props('job'), 'same-state different job must not authorize the opened need').toBeNull()
    taskRead.snapshot = { ...value, revision: value.revision + 1 }; await flushPromises()
    expect(child.props('job'), 'same-state newer revision must replace the cached observation').toMatchObject({ jobId: value.jobId, revision: value.revision + 1 })
    taskRead.snapshot = value; await flushPromises()
    taskRead.loading = true; await flushPromises(); expect(child.props('job')).toBeNull()
    taskRead.loading = false; taskRead.state = 'unknown'; await flushPromises(); expect(child.props('job')).toBeNull()
    taskRead.state = 'awaiting_selection'; await flushPromises(); expect(child.props('job')).toMatchObject({ jobId: value.jobId })
    expect(fetch.mock.calls.every(([, init]) => !init || init.method === 'GET')).toBe(true)
    wrapper.getComponent(ArtVisualReviewDialog).vm.$emit('update:open', false); await flushPromises()
    wrapper.getComponent(ArtTaskDetailDialog).vm.$emit('update:open', false); await flushPromises()
    expect(wrapper.getComponent(review).props('active')).toBe(false)
  })
})
