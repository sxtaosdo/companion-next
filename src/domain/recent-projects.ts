import type { DashboardProject, ManagedProject } from './companion-browser'
export function projectPathKey(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^(?:[a-z]:|\/\/)/i.test(normalized) ? normalized.toLowerCase() : normalized
}
export function validLastOpenedAt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
type RecencyProject = { id?: string; path?: string; lastOpenedAt?: number }
/** Presentation only; stable ties, immutable input and no implicit selection. */
export function sortProjectsByRecentOpen<T extends RecencyProject>(projects: readonly T[], stableKey: (project:T)=>string = project => project.id ?? projectPathKey(project.path ?? '')): T[] {
  return projects.map((project, index) => ({ project, index })).sort((a,b) =>
    (validLastOpenedAt(b.project.lastOpenedAt) ? b.project.lastOpenedAt : -1) - (validLastOpenedAt(a.project.lastOpenedAt) ? a.project.lastOpenedAt : -1)
    || compare(stableKey(a.project), stableKey(b.project))
    || compare(projectPathKey(a.project.path ?? ''), projectPathKey(b.project.path ?? '')) || a.index - b.index).map(item => item.project)
}
/** Only actual profile timestamps order recent use. Runtime/read timestamps never participate. */
export function orderedProjects(projects: readonly ManagedProject[], dashboard: readonly Pick<DashboardProject,'path'|'lastOpenedAt'>[]) {
  const times = new Map<string, number>()
  for (const item of dashboard) if (validLastOpenedAt(item.lastOpenedAt)) {
    const key = projectPathKey(item.path)
    times.set(key, Math.max(times.get(key) ?? -1, item.lastOpenedAt))
  }
  return projects.map(project => {
    const values = [project.lastOpenedAt, times.get(projectPathKey(project.path))].filter(validLastOpenedAt)
    return { project, lastOpenedAt: values.length ? Math.max(...values) : undefined }
  }).sort((a,b) => (b.lastOpenedAt ?? -1) - (a.lastOpenedAt ?? -1)
    || compare(a.project.id, b.project.id) || compare(projectPathKey(a.project.path), projectPathKey(b.project.path)))
}
/** Dashboard remains bounded to four actual registered projects. */
export function recentProjects(projects: readonly ManagedProject[], dashboard: readonly Pick<DashboardProject,'path'|'lastOpenedAt'>[]) {
  return orderedProjects(projects, dashboard).slice(0,4)
}
