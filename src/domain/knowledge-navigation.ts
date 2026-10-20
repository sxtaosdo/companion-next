export const knowledgeNavigation = [
  { path: '/knowledge', label: '检索与文档', page: 'read' },
  { path: '/knowledge/qa', label: '问答', page: 'qa' },
  { path: '/knowledge/manage', label: '连接与同步', page: 'manage' },
] as const
export type KnowledgePage = typeof knowledgeNavigation[number]['page']
export interface KnowledgeLocation { path: string; query?: Record<string, unknown> }
/** Only the existing root models tab denotes the independent model page. */
export function knowledgePageFor(route: KnowledgeLocation): KnowledgePage | undefined {
  if (route.path === '/knowledge' && route.query?.tab === 'models') return undefined
  return knowledgeNavigation.find(item => item.path === route.path)?.page
}
function scrollKey(route: KnowledgeLocation) {
  const page = knowledgePageFor(route)
  return page === 'qa' ? `${page}:${route.query?.mode === 'agent' ? 'agent' : 'kb'}` : page
}
const positions = new Map<string, { left: number; top: number }>()
export function rememberKnowledgeScroll(route: KnowledgeLocation, position: { left: number; top: number }) {
  const key = scrollKey(route)
  if (key && Number.isFinite(position.left) && Number.isFinite(position.top)) positions.set(key, { left: Math.max(0,position.left), top: Math.max(0,position.top) })
}
export function knowledgeScrollFor(route: KnowledgeLocation) {
  const value = positions.get(scrollKey(route) ?? '')
  return value ? { ...value } : undefined
}
/** App-session positions only. Source changes clear all; new read conditions clear read. */
export function clearKnowledgeScrollPositions(page?: KnowledgePage) {
  if (!page) { positions.clear(); return }
  for (const key of positions.keys()) if (key === page || key.startsWith(page+':')) positions.delete(key)
}
