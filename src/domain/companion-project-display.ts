/** Match the old Dashboard card behavior only for syntactically Windows paths.
 * POSIX paths remain case-sensitive; normalization is display matching, not file identity proof. */
export function projectDisplayPathKey(path:string):string {
 return /^(?:[a-z]:[\\/]|\\\\|\/\/)/i.test(path)?path.replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase():path
}
/** v148 opened-first ordering, with unknown conservatively excluded from opened. */
export function projectDisplayRank(state:string|undefined,lastOpenedAt:number|undefined):[number,number]{
 return [state!==undefined&&state!=='unknown'&&!['stopped','crashed','error'].includes(state)?1:0,lastOpenedAt??0]
}
