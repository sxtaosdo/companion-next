/** User-approved business scope only; this grants no process, model or filesystem permissions. */
export const ANT_TOOLBAR_PROJECT='04c4cde24ee76d83';
export const ANT_TOOLBAR_DOMAIN='ant';
export const ANT_TOOLBAR_SPEC='ant-bottom-tools-160-v01';
export const ANT_TOOLBAR_DESTINATION='assets/Colony/art/toy-market/ui/companion-ant-toolbar-v01';
export const ANT_TOOLBAR_EXPORT='art/final/ant-toolbar';
export const ANT_TOOLBAR_REFERENCES=Object.freeze({
 'ant-bottom-trowel-v01':{relativePath:'assets/Colony/art/toy-market/ui/r03/toolbar-trowel.png',sha256:'db81ca38a557b93469112c701a4966a14a355dc38333fd965601110a5097f89c'},
 'ant-bottom-slot-v01':{relativePath:'assets/Colony/art/toy-market/ui/r03/toolbar-slot.png',sha256:'12dcb830bdf70f4739205ad4bacae25d9a5b47e32e3c02602b61ba1092a59961'},
 'ant-bottom-compass-v01':{relativePath:'assets/Colony/art/toy-market/ui/r03/toolbar-compass.png',sha256:'fbb42ede4c85093f05b6e36966a6d63c0e1845453869525e15906a3f42715b79'},
});
export function antToolbarScope(projectId:string,domain:unknown,needId?:string){return projectId===ANT_TOOLBAR_PROJECT&&domain===ANT_TOOLBAR_DOMAIN&&(needId===undefined||Object.hasOwn(ANT_TOOLBAR_REFERENCES,needId));}
export function antToolbarDirectorySpec(spec:{id:string;category:string;width:number;height:number;destination:string|null;exportDirectory:string|null;sizePolicy?:string;imageOutput?:string}){return spec.id===ANT_TOOLBAR_SPEC&&spec.category==='icon'&&spec.width===160&&spec.height===160&&spec.destination===ANT_TOOLBAR_DESTINATION&&spec.exportDirectory===ANT_TOOLBAR_EXPORT&&spec.sizePolicy==='fixed'&&spec.imageOutput==='transparent-png';}
export function antToolbarReference(needId:string,reference:{relativePath:string;sha256:string}){const expected=ANT_TOOLBAR_REFERENCES[needId as keyof typeof ANT_TOOLBAR_REFERENCES];return !!expected&&reference.relativePath===expected.relativePath&&reference.sha256===expected.sha256;}

