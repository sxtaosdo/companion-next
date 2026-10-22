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
