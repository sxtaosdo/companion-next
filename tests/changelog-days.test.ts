import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { changelogCalendarDay, groupChangelogByDay, groupProductChangelog, type DatedChangeEntry } from '../src/domain/changelog-days'
import { frontendChanges } from '../src/domain/product-information'
import { CHANGELOG_ENTRIES } from '../src/domain/legacy-v148-changelog'
import ChangelogView from '../src/views/ChangelogView.vue'

describe('daily changelog mapping',()=>{
  it('merges nonadjacent same-day versions, orders dates descending and keeps every change association',()=>{
    const entries:DatedChangeEntry[]=[
      {version:'1.0.2',date:'2026-10-20',title:'较新版本',changes:['新增','修复']},
      {version:'1.0.0',date:'2026-10-19',title:'昨日',changes:['旧内容']},
      {version:'1.0.1',date:'2026-10-20',title:'同日另一版',changes:['新增']},
    ]
    const before=JSON.stringify(entries),days=groupChangelogByDay(entries)
    expect(days.map(day=>day.date)).toEqual(['2026-10-20','2026-10-19'])
    expect(days[0]!.versions).toEqual(['1.0.2','1.0.1'])
    expect(days[0]!.changes).toEqual(['新增','修复','新增'])
    expect(days[0]!.origins).toEqual([
      {version:'1.0.2',date:'2026-10-20',title:'较新版本',firstChange:1,lastChange:2},
      {version:'1.0.1',date:'2026-10-20',title:'同日另一版',firstChange:3,lastChange:3},
    ])
    expect(JSON.stringify(entries)).toBe(before)
  })
  it('uses UTC+08 midnight rather than elapsed 24-hour windows or browser-local dates',()=>{
    const days=groupChangelogByDay([
      {version:'a',updatedAt:'2026-10-19T15:59:59.999Z',changes:['午夜前']},
      {version:'b',updatedAt:'2026-10-19T16:00:00.000Z',changes:['午夜后']},
      {version:'c',updatedAt:'2026-10-20T00:00:01+08:00',changes:['同日']},
    ])
    expect(days.map(day=>day.date)).toEqual(['2026-10-20','2026-10-19'])
    expect(days[0]!.versions).toEqual(['b','c']);expect(days[0]!.changes).toEqual(['午夜后','同日'])
  })
  it('does not shift an explicit historical calendar date a second time',()=>{
    expect(changelogCalendarDay({date:'2026-10-16',updatedAt:'2026-10-19T16:00:00Z'})).toBe('2026-10-16')
    expect(changelogCalendarDay({updatedAt:'2026-10-16'})).toBe('2026-10-16')
    expect(changelogCalendarDay({date:'2024-02-29'})).toBe('2024-02-29')
  })
  it('retains undated/invalid records without guessing a day or altering content',()=>{
    const days=groupChangelogByDay([
      {version:'a',date:'2026-02-30',changes:['无效日期仍保留']},
      {version:'b',updatedAt:'2026-10-20T12:00:00',changes:['未标时区']},
      {version:'c',date:'2026-10-20',changes:[]},
    ])
    expect(days[0]!.date).toBe('2026-10-20')
    expect(days.slice(1).map(day=>day.date)).toEqual(['日期未标明','日期未标明'])
    expect(days.flatMap(day=>day.changes)).toEqual(['无效日期仍保留','未标时区'])
    expect(days[1]!.origins[0]!.date).toBe('2026-02-30')
  })
  it('preserves repeated version associations and empty entries without deduplicating historical changes',()=>{
    const days=groupChangelogByDay([{version:'v',date:'2026-10-20',changes:['同文']},{version:'v',date:'2026-10-20',changes:['同文']},{version:'w',date:'2026-10-20',changes:[]}])
    expect(days).toHaveLength(1);expect(days[0]!.versions).toEqual(['v','w']);expect(days[0]!.origins).toHaveLength(3)
    expect(days[0]!.changes).toEqual(['同文','同文']);expect(days[0]!.origins[2]).toMatchObject({firstChange:3,lastChange:2})
  })
  it('keeps all real frontend records and all 114 legacy versions / 201 legacy changes',()=>{
    for(const entries of [frontendChanges,CHANGELOG_ENTRIES]){
      const before=JSON.stringify(entries),days=groupChangelogByDay(entries)
      expect(new Set(days.map(day=>day.date)).size).toBe(days.length)
      expect(days.map(day=>day.date)).toEqual(days.map(day=>day.date).sort().reverse())
      expect(days.flatMap(day=>day.origins)).toHaveLength(entries.length)
      expect(days.reduce((sum,day)=>sum+day.changes.length,0)).toBe(entries.reduce((sum,entry)=>sum+entry.changes.length,0))
      for(const day of days)for(const origin of day.origins){
        const original=entries.find(entry=>entry.version===origin.version && ('title' in entry ? entry.title===origin.title : true) && ('date' in entry ? entry.date===origin.date : entry.updatedAt===origin.updatedAt))!
        expect(day.changes.slice(origin.firstChange-1,origin.lastChange)).toEqual(original.changes)
      }
      expect(JSON.stringify(entries)).toBe(before)
    }
    expect(CHANGELOG_ENTRIES).toHaveLength(114)
    expect(groupChangelogByDay(CHANGELOG_ENTRIES).flatMap(day=>day.changes)).toHaveLength(201)
  })
})
describe('daily changelog UI',()=>{
  it('renders one main record per day and keeps versions and titles traceable without service requests',()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
    const wrapper=mount(ChangelogView,{global:{stubs:{RouterLink:{props:['to'],template:'<a :href="to"><slot/></a>'}}}})
    try{
      const days=groupProductChangelog(frontendChanges,CHANGELOG_ENTRIES),cards=wrapper.findAll('.changelog-entry')
      expect(cards).toHaveLength(days.length);expect(new Set(cards.map(card=>card.attributes('data-day'))).size).toBe(cards.length)
      for(const day of days){
        const card=wrapper.get(`.changelog-entry[data-day="${day.date}"]`)
        expect(card.findAll('.daily-changes>li').map(item=>item.text())).toEqual(day.changes)
        for(const origin of day.origins){expect(card.get('.changelog-version-trace').text()).toContain(`${origin.product} v${origin.version}`);if(origin.title)expect(card.text()).toContain(origin.title)}
      }
      const overlap=days.find(day=>day.date==='2026-10-12')!
      expect(new Set(overlap.origins.map(origin=>origin.product))).toEqual(new Set(['Companion Next','Creator AI Companion']))
      expect(days.flatMap(day=>day.origins)).toHaveLength(frontendChanges.length+CHANGELOG_ENTRIES.length)
      expect(days.flatMap(day=>day.changes)).toHaveLength(frontendChanges.reduce((n,entry)=>n+entry.changes.length,0)+201)
      expect(wrapper.text()).not.toContain('不表示新版已完成相同能力')
      expect(fetch).not.toHaveBeenCalled()
    }finally{wrapper.unmount();vi.unstubAllGlobals()}
  })
})
