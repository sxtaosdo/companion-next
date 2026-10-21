import type { DashboardProject, ManagedProject } from './companion-browser'
export function projectPathKey(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^(?:[a-z]:|\/\/)/i.test(normalized) ? normalized.toLowerCase() : normalized
}
/** Only actual profile timestamps order recent use. Runtime/read timestamps never participate. */
export function orderedProjects(projects: readonly ManagedProject[], dashboard: readonly DashboardProject[]) {
  const times = new Map<string, number>()
  for (const item of dashboard) if (typeof item.lastOpenedAt === 'number' && Number.isFinite(item.lastOpenedAt) && item.lastOpenedAt >= 0) {
    const key = projectPathKey(item.path)
    times.set(key, Math.max(times.get(key) ?? -1, item.lastOpenedAt))
  }
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
  return projects.map(project => ({ project, lastOpenedAt: times.get(projectPathKey(project.path)) }))
    .sort((a,b) => (b.lastOpenedAt ?? -1) - (a.lastOpenedAt ?? -1)
      || compare(projectPathKey(a.project.path), projectPathKey(b.project.path))
      || compare(a.project.id, b.project.id))
}
/** Dashboard remains bounded to four actual registered projects. */
export function recentProjects(projects: readonly ManagedProject[], dashboard: readonly DashboardProject[]) {
  return orderedProjects(projects, dashboard).slice(0,4)
}
