import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { knowledgeNavigation, knowledgePageFor } from './knowledge-navigation'
type Location = Pick<RouteLocationNormalizedLoaded, 'path' | 'query' | 'meta' | 'fullPath'>
export function shellTitle(route: Location): string {
 const knowledge = knowledgePageFor(route)
 if (knowledge) return knowledgeNavigation.find(item => item.page === knowledge)!.label
 if (route.path === '/knowledge' && route.query.tab === 'models') return '模型服务'
 if (route.path === '/projects') return '工程'
 return String(route.meta.title ?? '页面')
}
export function breadcrumbLabels(route: Location): string[] {
 return knowledgePageFor(route) ? ['知识库', shellTitle(route)] : [shellTitle(route)]
}
/** Different project/query contexts must never overwrite each other's navigation destination. */
export function shellTabKey(route: Location): string { return JSON.stringify([route.path,route.query.project ?? null,route.path==='/knowledge'&&route.query.tab==='models'?'models':null]) }
export interface ShellTab { key: string; to: string; title: string }
export function visitShellTab(tabs: ShellTab[], route: Location): ShellTab[] {
 const key = shellTabKey(route)
 const title = shellTitle(route) + (typeof route.query.project === 'string' ? ` · ${route.query.project.slice(0, 6)}` : '')
 return tabs.some(tab => tab.key === key) ? tabs.map(tab => tab.key === key ? {...tab,title,to:route.fullPath} : tab) : [...tabs, {key,to:route.fullPath,title}]
}
