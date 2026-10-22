/** A reached stage needs observed task evidence, never a route query or click. */
export interface ArtProductionSnapshot { state:string; candidates:number; selected:number; hasImport:boolean }
export function artProductionStage(snapshot:ArtProductionSnapshot|null):number|null {
 if(!snapshot)return null
 if(snapshot.hasImport)return 5
 if(['imported_pending_verification','import_unknown'].includes(snapshot.state))return 4
 if(snapshot.state==='selected' && snapshot.selected>0)return 4
 if(['awaiting_selection','selected'].includes(snapshot.state) && snapshot.candidates>0)return 3
 return 2
}

export function canChooseArtStage(index:number,reached:number):boolean {
 return Number.isInteger(index) && index>=0 && index<=5 && Number.isInteger(reached) && reached>=index
}

/** A production brief is pinned to the saved specification actually selected in this flow. */
export interface ArtSpecDependency { projectId:string; projectPath:string; source:object; provider:object; hash:string; version:number }
export function sameArtSpecDependency(a:ArtSpecDependency|null,b:ArtSpecDependency|null):boolean {
 return !!a && !!b && a.projectId===b.projectId && a.projectPath===b.projectPath && a.source===b.source && a.provider===b.provider && a.hash===b.hash && a.version===b.version
}
export function savedArtSpecDependency(input:{project:{id:string;path:string}|null;source:object|null;context:{projectId:string;projectPath:string;source:object}|null;provider:object|null;currentProvider:object|null;hash:unknown;version:unknown;ready:boolean}):ArtSpecDependency|null {
 const {project,source,context,provider,currentProvider,hash,version}=input
 if(!input.ready || !project || !source || !context || !provider || provider!==currentProvider || context.projectId!==project.id || context.projectPath!==project.path || context.source!==source || typeof hash!=='string' || !/^[a-f0-9]{64}$/.test(hash) || typeof version!=='number' || !Number.isSafeInteger(version) || version<1)return null
 return {projectId:project.id,projectPath:project.path,source,provider,hash,version}
}
