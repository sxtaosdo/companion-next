import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { CompanionBrowserError } from '../src/adapters/companion-browser'
import { useOverviewProjectLive } from '../src/composables/use-overview-project-live'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { companionBrowserProvider, companionEventProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import type { CompanionEventProvider } from '../src/domain/companion-live'
let wrapper: VueWrapper | undefined
const Harness = defineComponent({ setup() { useOverviewProjectLive(); return () => h('div') } })
beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })
afterEach(() => { wrapper?.unmount(); wrapper = undefined; useCompanionBrowserStore().disconnect(); companionProjectEntryProvider.value = null; companionBrowserProvider.value = null; companionEventProvider.value = null; vi.useRealTimers() })
async function setup(automatic = true) {
 const source: CompanionBrowserProvider = { label: 'offline', runtimeProbesEnabled: true, loadProjects: vi.fn(async () => ({ projects: [], statuses: [], dashboard: [], warnings: [] })), loadCounts: vi.fn(async () => ({ sessionId: 's', counts: {}, latest: {} })), loadLogs: vi.fn(async () => []), loadCalls: vi.fn() }
 const close = vi.fn(), events: CompanionEventProvider = { label: 'offline events', subscribe: vi.fn(() => close) }
 registerCompanionBrowserProvider(source, events, automatic ? { projectEntry: 'read' } : {})
 const directory = useCompanionBrowserStore(); await directory.connect(source)
 return { source, events, directory, close, mountPage: () => { wrapper = mount(Harness); return flushPromises() } }
}
describe('overview owns only the existing singleton live transport', () => {
 it('reuses one stream and serial project polling, suspends on leave and preserves user stop', async () => {
  const { source, events, directory, close, mountPage } = await setup(); await mountPage()
  expect(events.subscribe).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(0); const reads = vi.mocked(source.loadProjects).mock.calls.length
  directory.setLivePageActive(true); directory.ensureLive(events); await flushPromises(); expect(events.subscribe).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(3000); expect(source.loadProjects).toHaveBeenCalledTimes(reads + 1)
  wrapper!.unmount(); wrapper = undefined; expect(close).toHaveBeenCalledTimes(1)
  const stopped = vi.mocked(source.loadProjects).mock.calls.length; await vi.advanceTimersByTimeAsync(20000); expect(source.loadProjects).toHaveBeenCalledTimes(stopped)
  directory.stopLive(); await mountPage(); expect(events.subscribe).toHaveBeenCalledTimes(1); expect(directory.livePreferred).toBe(false)
 })
 it('preserves bounded background recovery when connection evidence is temporarily cleared', async () => {
  const { source, directory, events, mountPage } = await setup(); await mountPage(); await vi.advanceTimersByTimeAsync(0)
  vi.mocked(source.loadProjects).mockRejectedValueOnce(new CompanionBrowserError('network-error'))
  await vi.advanceTimersByTimeAsync(3000); await flushPromises()
  expect(directory.connected).toBe(false); expect(directory.liveState).toBe('retrying'); expect(directory.livePageActive).toBe(true)
  const reads = vi.mocked(source.loadProjects).mock.calls.length
  await vi.advanceTimersByTimeAsync(3000); await flushPromises()
  expect(source.loadProjects).toHaveBeenCalledTimes(reads + 1); expect(directory.connected).toBe(true)
  expect(events.subscribe).toHaveBeenCalledTimes(2)
 })
 it('does not create a stream in unapproved or passive entry modes', async () => {
  const { events, mountPage } = await setup(false); await mountPage(); expect(events.subscribe).not.toHaveBeenCalled()
 })
 it('suspends existing transport during an operation lane and resumes without a second simultaneous stream', async () => {
  const { events, close, mountPage } = await setup(); await mountPage(); const lane = useProjectOperationLaneStore()
  const lease = lane.acquire('offline test'); await flushPromises(); expect(close).toHaveBeenCalledTimes(1)
  if (!lease) throw Error('lease'); lane.release(lease); await flushPromises(); expect(events.subscribe).toHaveBeenCalledTimes(2)
 })
})
