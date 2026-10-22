import type { ManagedStatus } from './companion-browser'
/** Match the old Dashboard card behavior only for syntactically Windows paths.
 * POSIX paths remain case-sensitive; normalization is display matching, not file identity proof. */
export function projectDisplayPathKey(path:string):string {
 return /^(?:[a-z]:[\\/]|\\\\|\/\/)/i.test(path)?path.replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase():path
}
/** v148 opened-first ordering, with unknown conservatively excluded from opened. */
export function projectDisplayRank(state:string|undefined,lastOpenedAt:number|undefined):[number,number]{
 return [state!==undefined&&state!=='unknown'&&!['stopped','crashed','error'].includes(state)?1:0,lastOpenedAt??0]
}

/** Original card state colours; unknown never implies stopped. */
export function projectStateTone(status: ManagedStatus | undefined, passive = false, expectedStop = false): 'success' | 'danger' | 'warning' | 'info' | 'primary' {
 if(passive || !status) return 'info'
 if(expectedStop || status.state==='unknown') return 'warning'
 if(status?.state === 'ready') return 'success'
 if(['error','crashed','incompatible'].includes(status?.state ?? '')) return 'danger'
 if(['launching','bridge-wait','stopping'].includes(status?.state ?? '')) return 'primary'
 return 'info'
}
/** Bridge permission is independent from tool preset visibility. */
export function creatorPermissionLabel(status:ManagedStatus | undefined):string {
 if(!status || status.state!=='ready') return '未连接'
 return ({'read-only':'只读',authoring:'创作','full-control':'完全控制',unknown:'未知'} as Record<string,string>)[status.capabilityProfile] ?? '未知'
}
