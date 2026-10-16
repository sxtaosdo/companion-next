import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { watch } from 'vue'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import type { ProjectOperationLease } from '../src/stores/project-operation-lane'

beforeEach(() => setActivePinia(createPinia()))

describe('same-Pinia project operation lane', () => {
  it('starts unlocked and exposes only a frozen opaque lease after acquisition', () => {
    const lane = useProjectOperationLaneStore()
    expect(lane.locked).toBe(false); expect(lane.description).toBe('')
    const lease = lane.acquire('创建工程')!
    expect(lease).not.toBeNull(); expect(Object.isFrozen(lease)).toBe(true)
    expect(Reflect.ownKeys(lease)).toEqual([])
    expect(lane.locked).toBe(true); expect(lane.description).toBe('创建工程')
    expect(lane.acquire('启动 Creator')).toBeNull()
    expect(lane.description).toBe('创建工程')
    expect(lane.release(lease)).toBe(true)
    expect(lane.locked).toBe(false); expect(lane.description).toBe('')
    expect('reset' in lane).toBe(false); expect('force' in lane).toBe(false)
  })

  it('rejects copied, forged, stale and malformed release attempts', () => {
    const lane = useProjectOperationLaneStore(), first = lane.acquire('创建工程')!
    for (const forged of [{ ...first }, JSON.parse(JSON.stringify(first)), Object.create(first), null, undefined]) {
      expect(lane.release(forged as ProjectOperationLease)).toBe(false)
      expect(lane.locked).toBe(true)
    }
    expect(lane.release(first)).toBe(true)
    const second = lane.acquire('导入工程')!
    expect(second).not.toBe(first); expect(lane.release(first)).toBe(false)
    expect(lane.locked).toBe(true); expect(lane.description).toBe('导入工程')
    expect(lane.release(second)).toBe(true); expect(lane.release(second)).toBe(false)
  })

  it('atomically excludes synchronous competing acquisition observers', () => {
    const lane = useProjectOperationLaneStore()
    const competing: (ProjectOperationLease | null)[] = []
    const stop = watch(() => lane.locked, locked => {
      if (locked) competing.push(lane.acquire('启动 Creator'))
    }, { flush: 'sync' })
    const lease = lane.acquire('创建工程')!
    expect(competing).toEqual([null]); expect(lane.description).toBe('创建工程')
    stop(); expect(lane.release(lease)).toBe(true)
  })

  it('cannot clear a new holder acquired synchronously when the old holder releases', () => {
    const lane = useProjectOperationLaneStore(), first = lane.acquire('创建工程')!
    let second: ProjectOperationLease | null = null
    const stop = watch(() => lane.locked, locked => {
      if (!locked) second = lane.acquire('启动 Creator')
    }, { flush: 'sync' })
    expect(lane.release(first)).toBe(true)
    expect(second).not.toBeNull(); expect(lane.locked).toBe(true)
    expect(lane.description).toBe('启动 Creator'); expect(lane.release(first)).toBe(false)
    stop(); expect(lane.release(second!)).toBe(true)
  })

  it('shares one lane within a Pinia instance without claiming cross-instance exclusion', () => {
    const first = useProjectOperationLaneStore(), lease = first.acquire('创建工程')!
    expect(useProjectOperationLaneStore()).toBe(first)
    const other = useProjectOperationLaneStore(createPinia())
    expect(other.locked).toBe(false); expect(other.release(lease)).toBe(false)
    expect(first.locked).toBe(true); expect(first.release(lease)).toBe(true)
  })
})
