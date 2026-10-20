/** Daily presentation preserves original releases and content. */
export interface DatedChangeEntry { version: string; product?: string; date?: string; updatedAt?: string; title?: string; changes: readonly string[] }
export interface DailyChangeOrigin { version: string; product?: string; title?: string; date?: string; updatedAt?: string; firstChange: number; lastChange: number }
export interface DailyChanges { key: string; date: string; versions: string[]; changes: string[]; origins: DailyChangeOrigin[] }
function explicitDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value
}
/** Explicit calendar dates stay local; only timezone-qualified instants shift. */
export function changelogCalendarDay(entry: Pick<DatedChangeEntry,'date' | 'updatedAt'>): string | undefined {
  if (entry.date !== undefined) return explicitDay(entry.date) ? entry.date : undefined
  const value = entry.updatedAt
  if (!value) return undefined
  if (explicitDay(value)) return value
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return undefined
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return undefined
  const shifted = new Date(time+8*60*60*1000)
  return Number.isFinite(shifted.getTime()) ? shifted.toISOString().slice(0,10) : undefined
}
/** One main record per day; every original version and change remains traceable. */
export function groupChangelogByDay(entries: readonly DatedChangeEntry[]): DailyChanges[] {
  const groups = new Map<string,DailyChanges>()
  const ordered = entries.map((entry,index) => ({ entry,index,day:changelogCalendarDay(entry) }))
    .sort((a,b) => (b.day ?? '').localeCompare(a.day ?? '') || a.index-b.index)
  for (const { entry,index,day } of ordered) {
    const key = day ?? `undated-${index}`
    let group = groups.get(key)
    if (!group) { group = { key,date:day ?? '日期未标明',versions:[],changes:[],origins:[] }; groups.set(key,group) }
    if (!group.versions.includes(entry.version)) group.versions.push(entry.version)
    const firstChange = group.changes.length+1
    group.changes.push(...entry.changes)
    group.origins.push({ version:entry.version,...(entry.product === undefined ? {} : { product:entry.product }),...(entry.title === undefined ? {} : { title:entry.title }),
      ...(entry.date === undefined ? {} : { date:entry.date }),...(entry.updatedAt === undefined ? {} : { updatedAt:entry.updatedAt }),
      firstChange,lastChange:group.changes.length })
  }
  return [...groups.values()]
}

export function groupProductChangelog(frontend: readonly DatedChangeEntry[], legacy: readonly DatedChangeEntry[]): DailyChanges[] {
  return groupChangelogByDay([...frontend.map(entry => ({...entry,product:'Companion Next'})), ...legacy.map(entry => ({...entry,product:'Creator AI Companion'}))])
}
