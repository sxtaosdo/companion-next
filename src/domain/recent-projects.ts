import type { DashboardProject, ManagedProject } from './companion-browser'
export function projectPathKey(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^(?:[a-z]:|\/\/)/i.test(normalized) ? normalized.toLowerCase() : normalized
}
/** Only Dashboard's actual lastOpenedAt orders recent use; absent values stay in registration order. */
export function recentProjects(projects: readonly ManagedProject[], dashboard: readonly DashboardProject[]) {
  const times = new Map<string, number>()
  for (const item of dashboard) if (typeof item.lastOpenedAt === 'number' && Number.isFinite(item.lastOpenedAt) && item.lastOpenedAt >= 0) {
    const key = projectPathKey(item.path)
    times.set(key, Math.max(times.get(key) ?? -1, item.lastOpenedAt))
  }
  return projects.map((project, index) => ({ project, index, lastOpenedAt: times.get(projectPathKey(project.path)) }))
    .sort((a,b) => (b.lastOpenedAt ?? -1) - (a.lastOpenedAt ?? -1) || a.index-b.index).slice(0,4)
}
