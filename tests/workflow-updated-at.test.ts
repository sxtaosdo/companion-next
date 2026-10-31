import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {mount, type VueWrapper} from '@vue/test-utils'
import {nextTick} from 'vue'
import WorkflowUpdatedAt from '../src/components/workflow-operation/WorkflowUpdatedAt.vue'

const NOW = Date.parse('2026-10-29T06:30:42.000Z')
const iso = (age: number) => new Date(NOW - age).toISOString()
const pad = (value: number) => String(value).padStart(2, '0')
const localDate = (date: Date) =>
  [String(date.getFullYear()).padStart(4, '0'), pad(date.getMonth() + 1), pad(date.getDate())].join('-')
const exactTitle = (value: string) => {
  const date = new Date(value)
  const offset = -date.getTimezoneOffset()
  const absolute = Math.abs(offset)
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} UTC${offset >= 0 ? '+' : '-'}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
}

describe('WorkflowUpdatedAt', () => {
  let wrappers: VueWrapper[]
  const render = (value?: string | null) => {
    const wrapper = mount(WorkflowUpdatedAt, {props: {value}})
    wrappers.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    wrappers = []
  })
  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.unmount())
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it.each([
    [0, '刚刚'],
    [59_999, '刚刚'],
    [60_000, '1分钟前'],
    [3_599_999, '59分钟前'],
    [3_600_000, '1小时前'],
    [86_399_999, '23小时前'],
    [86_400_000, '1天前'],
    [604_799_999, '6天前'],
  ])('formats age %i ms as %s', (age, expected) => {
    expect(render(iso(age)).text()).toBe(expected)
  })

  it.each([604_800_000, 864_000_000])('uses the local date at age %i ms', age => {
    const value = iso(age)
    expect(render(value).text()).toBe(localDate(new Date(value)))
  })

  it('clamps future age while retaining the actual future tooltip', () => {
    const value = iso(-86_400_000)
    const wrapper = render(value)
    expect(wrapper.text()).toBe('刚刚')
    expect(wrapper.attributes('title')).toBe(exactTitle(value))
  })

  it.each([undefined, null, '', '   ', 'invalid', '2026-99-99T00:00:00Z'])(
    'keeps unusable input %s explicit and without a tooltip', value => {
      const wrapper = render(value)
      expect(wrapper.text()).toBe('未提供')
      expect(wrapper.attributes('title')).toBeUndefined()
    },
  )

  it('accepts an omitted value', () => {
    const wrapper = mount(WorkflowUpdatedAt)
    wrappers.push(wrapper)
    expect(wrapper.text()).toBe('未提供')
    expect(wrapper.attributes('title')).toBeUndefined()
  })

  it('does not borrow another instance timestamp', async () => {
    const valid = render(iso(60_000))
    const missing = render(null)
    await valid.setProps({value: iso(3_600_000)})
    expect(valid.text()).toBe('1小时前')
    expect(missing.text()).toBe('未提供')
    expect(missing.attributes('title')).toBeUndefined()
  })

  it('includes local seconds and a signed, minute-precision UTC offset', () => {
    const value = '2026-10-29T06:30:42.123Z'
    const title = render(value).attributes('title')
    expect(title).toBe(exactTitle(value))
    expect(title).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:42 UTC[+-]\d{2}:\d{2}$/)
  })

  it('uses the input date offset rather than the current seasonal offset', async () => {
    const winter = '2026-01-15T06:30:42.000Z'
    const summer = '2026-07-15T06:30:42.000Z'
    // Simulate seasonal offsets independently of the host timezone.
    const offset = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockImplementation(function (this: Date) {
      return this.getUTCMonth() === 0 ? 300 : 240
    })
    const wrapper = render(winter)
    expect(wrapper.attributes('title')).toBe(exactTitle(winter))
    expect(wrapper.attributes('title')).toMatch(/ UTC-05:00$/)
    await wrapper.setProps({value: summer})
    expect(wrapper.attributes('title')).toBe(exactTitle(summer))
    expect(wrapper.attributes('title')).toMatch(/ UTC-04:00$/)
    offset.mockRestore()
  })

  it('formats positive offsets with fractional hours', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-345)
    expect(render(iso(0)).attributes('title')).toMatch(/ UTC\+05:45$/)
  })

  it('recalculates immediately on input changes using the current clock', async () => {
    const wrapper = render(iso(0))
    // Move the clock without firing the interval.
    vi.setSystemTime(NOW + 3_600_000)
    const replacement = iso(60_000)
    await wrapper.setProps({value: replacement})
    expect(wrapper.text()).toBe('1小时前')
    expect(wrapper.attributes('title')).toBe(exactTitle(replacement))
    await wrapper.setProps({value: 'invalid'})
    expect(wrapper.text()).toBe('未提供')
    expect(wrapper.attributes('title')).toBeUndefined()
    await wrapper.setProps({value: null})
    expect(wrapper.text()).toBe('未提供')
    await wrapper.setProps({value: iso(-3_600_000)})
    expect(wrapper.text()).toBe('刚刚')
    expect(wrapper.attributes('title')).toBe(exactTitle(iso(-3_600_000)))
  })

  it.each([
    [59_000, '刚刚', '1分钟前'],
    [3_599_000, '59分钟前', '1小时前'],
    [86_399_000, '23小时前', '1天前'],
    [604_799_000, '6天前', null],
  ])('refreshes across the threshold from %i ms', async (age, before, after) => {
    const value = iso(age)
    const wrapper = render(value)
    const title = wrapper.attributes('title')
    expect(wrapper.text()).toBe(before)
    vi.advanceTimersByTime(1_000)
    await nextTick()
    expect(wrapper.text()).toBe(after ?? localDate(new Date(value)))
    expect(wrapper.attributes('title')).toBe(title)
  })

  it('clears its sole refresh timer on unmount', () => {
    const initial = vi.getTimerCount()
    const wrapper = render(iso(59_000))
    expect(vi.getTimerCount()).toBe(initial + 1)
    const clear = vi.spyOn(globalThis, 'clearInterval')
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    wrapper.unmount()
    expect(clear).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(initial)
    vi.advanceTimersByTime(120_000)
    expect(vi.getTimerCount()).toBe(initial)
  })
})
