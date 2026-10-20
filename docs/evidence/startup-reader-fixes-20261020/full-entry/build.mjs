import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
const W='C:/Users/33272/AppData/Local/Temp/companion-startup-reader-fixes-20261020/full-cli-entry-round2';
const host='D:/code/shidai3/P8000/cocos-mcp/mcp';
const {build}=createRequire(host+'/package.json')('esbuild');
const sha=b=>createHash('sha256').update(b).digest('hex');
const target=process.argv[2],patch=process.argv[3];
if(!['cli','worker'].includes(target))throw Error('BAD_TARGET');
const name=target==='cli'?'creator-ai':'knowledge-worker',entry=target==='cli'?'companion-cli.ts':'knowledge-worker.ts';
const original=await readFile(W+'/original/'+name+'.js');
const map=JSON.parse(await readFile(W+'/original/'+name+'.js.map','utf8'));
const root=W+'/source-'+target+'/mcp',sources=new Map();
for(let i=0;i<map.sources.length;i++){const match=map.sources[i].match(/\/mcp\/src\/(.+)$/);if(match&&map.sourcesContent[i]!=null)sources.set('src/'+match[1],map.sourcesContent[i]);}
for(const [key,content] of sources){const file=root+'/'+key;await mkdir(dirname(file),{recursive:true});await writeFile(file,content);}
// These imports have no sourcesContent because the installed build fully removed them.
// Inert resolution stubs are accepted only if the entire baseline JS is byte-identical.
if(target==='cli')for(const [key,content] of [['src/document-service.ts','export class DocumentService {}'],['src/companion/tool-names.ts','export function operationNameZh() {}']])await writeFile(root+'/'+key,content);
const baselineDir=W+'/baseline-'+target;await mkdir(baselineDir,{recursive:true});
const banner=target==='cli'?original.toString().split('\n').slice(0,2).join('\n'):original.toString().split('\n')[0];
async function compile(outdir){
 await mkdir(outdir,{recursive:true});
 return build({absWorkingDir:root,entryPoints:['src/'+entry],outfile:outdir+'/'+name+'.js',bundle:true,platform:'node',format:'esm',target:'node20',sourcemap:true,metafile:true,nodePaths:[host+'/node_modules'],external:['playwright','playwright-core','chromium-bidi','fsevents','better-sqlite3','typescript'],banner:{js:banner},plugins:[{name:'owned-source-resolution',setup(b){b.onResolve({filter:/^\..*\.js$/},args=>{const ts=resolve(args.resolveDir,args.path).replace(/\.js$/,'.ts');const key=ts.replaceAll('\\','/').slice(root.length+1);return sources.has(key)?{path:ts}:null;});}}]});
}
await compile(baselineDir);
const baseline=await readFile(baselineDir+'/'+name+'.js');
if(sha(baseline)!==sha(original)){
 await writeFile(W+'/'+target+'-baseline-mismatch.json',JSON.stringify({original:sha(original),rebuilt:sha(baseline),banner,owned:sources.size},null,2));throw Error('BASELINE_NOT_BYTE_IDENTICAL');
}
if(!patch){console.log(JSON.stringify({target,baselineByteIdentical:true,owned:sources.size}));process.exit(0);}
const key=target==='cli'?'src/companion-cli.ts':'src/companion/knowledge-worker-core.ts';
const content=await readFile(patch,'utf8');await writeFile(root+'/'+key,content);
const candidateDir=W+'/candidate';await compile(candidateDir);
const candidateMap=JSON.parse(await readFile(candidateDir+'/'+name+'.js.map','utf8'));
const changed=[],seen=new Set();
for(let i=0;i<candidateMap.sources.length;i++){const m=candidateMap.sources[i].match(/\/mcp\/src\/(.+)$/);if(!m)continue;const k='src/'+m[1];if(!sources.has(k))throw Error('UNKNOWN_SOURCE');seen.add(k);const expected=k===key?content:sources.get(k);if(candidateMap.sourcesContent[i]!==expected)throw Error('SOURCE_CHANGED');if(k===key)changed.push(k);}
if(changed.length!==1)throw Error('OVERLAY_MISSING');
if(seen.size!==sources.size)throw Error('SOURCE_SET_CHANGED');
const dependencies=m=>m.sources.flatMap((s,i)=>/\/mcp\/src\//.test(s)?[]:[sha(m.sourcesContent[i]??'')]);
if(JSON.stringify(dependencies(map))!==JSON.stringify(dependencies(candidateMap)))throw Error('DEPENDENCY_CHANGED');
const proof={target,baselineByteIdentical:true,originalSha256:sha(original),originalMapSha256:sha(await readFile(W+'/original/'+name+'.js.map')),ownedSources:sources.size,changedSources:changed,dependenciesUnchanged:true,resolutionStubsAbsentFromOutput:true,candidate:{jsSha256:sha(await readFile(candidateDir+'/'+name+'.js')),mapSha256:sha(await readFile(candidateDir+'/'+name+'.js.map'))}};
await writeFile(W+'/'+target+'-build.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
