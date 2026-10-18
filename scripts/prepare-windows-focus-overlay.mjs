/** Offline candidate only: rebuild exact live baseline, then replace only Windows focus. */
import {build} from 'esbuild'
import {readFile,writeFile,mkdir,cp,copyFile} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
const repo=resolve('.'),w=process.argv[2]
if(!w)throw Error('Provide task-owned output directory')
const out=resolve(w)
if(!out.toLowerCase().startsWith('c:\\users\\33272\\appdata\\local\\temp\\companion-focus-fix-20261018\\'))throw Error('Output scope')
const live='D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion',deps='D:/code/shidai3/P8000/cocos-mcp/mcp/node_modules',prior='C:/Users/33272/AppData/Local/Temp/companion-owner-host-implementation-20261018/verified-source',sha=b=>createHash('sha256').update(b).digest('hex')
const original=await readFile(live+'/companion-daemon.js'),mapBytes=await readFile(live+'/companion-daemon.js.map'),map=JSON.parse(mapBytes)
if(sha(original)!=='35225eb5ddb4d415457a9cad960c8e22d14c4b4a0de321fb8b8aa51adc4af699')throw Error('Live baseline changed')
const sourceRoot=join(out,'verified-source')
await cp(prior,sourceRoot,{recursive:true,errorOnExist:true,force:false})
for(let i=0;i<map.sources.length;i++){
 const s=map.sources[i],mark='/verified-source/'
 if(s.includes(mark)){
  const rel=s.split(mark)[1]
  if(rel.split(/[\\/]/).includes('..'))throw Error('Source scope')
  const p=join(sourceRoot,rel);await mkdir(dirname(p),{recursive:true});await writeFile(p,map.sourcesContent[i])
 }
}
const common={absWorkingDir:join(sourceRoot,'mcp'),entryPoints:['src/companion-daemon.ts'],bundle:true,platform:'node',format:'esm',target:'node20',sourcemap:true,nodePaths:[deps],external:['playwright','playwright-core','chromium-bidi','fsevents','better-sqlite3','typescript'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}}
await mkdir(join(out,'baseline'));await build({...common,outfile:join(out,'baseline/companion-daemon.js')})
if(!(await readFile(join(out,'baseline/companion-daemon.js'))).equals(original))throw Error('Baseline reconstruction differs')
const platform=join(sourceRoot,'mcp/src/companion/platform.ts'),s=await readFile(platform,'utf8'),fn=s.indexOf('export async function focusPidBestEffort'),a=s.indexOf('  if (process.platform === "win32") {',fn),b=s.indexOf('\n  throw new Error("Creator focus is not supported on this platform")',a)
if(fn<0||a<0||b<0)throw Error('Original focus contract changed')
const changed='import { focusWindowsPid } from "./windows-focus.js";\n'+s.slice(0,a)+'  if (process.platform === "win32") {\n    await focusWindowsPid(pid);\n    return;\n  }\n'+s.slice(b)
await writeFile(platform,changed)
await copyFile(join(repo,'host/windows-focus.ts'),join(sourceRoot,'mcp/src/companion/windows-focus.ts'))
await mkdir(join(out,'candidate'));await build({...common,outfile:join(out,'candidate/companion-daemon.js')})
const nextMap=JSON.parse(await readFile(join(out,'candidate/companion-daemon.js.map'),'utf8')),changedSources=[],addedSources=[]
for(let i=0;i<nextMap.sources.length;i++){
 const path=nextMap.sources[i],rel=path.includes('/verified-source/')?path.split('/verified-source/')[1]:null
 const old=rel?map.sources.findIndex(s=>s.endsWith('/verified-source/'+rel)):map.sources.indexOf(path)
 if(old<0){if(rel!=='mcp/src/companion/windows-focus.ts')throw Error('Unexpected added source '+path);addedSources.push(rel)}
 else if(nextMap.sourcesContent[i]?.replaceAll('\r\n','\n')!==map.sourcesContent[old]?.replaceAll('\r\n','\n')){if(rel!=='mcp/src/companion/platform.ts')throw Error('Unexpected changed source '+path);changedSources.push(rel)}
}
const key=s=>s.includes('/verified-source/')?s.split('/verified-source/')[1]:s
const nextKeys=new Set(nextMap.sources.map(key)),removedSources=map.sources.map(key).filter(s=>!nextKeys.has(s))
if(removedSources.length)throw Error('Unexpected removed sources '+removedSources.join(','))
const result={baselineByteIdentical:true,baselineSha256:sha(original),baselineMapSha256:sha(mapBytes),candidateSha256:sha(await readFile(join(out,'candidate/companion-daemon.js'))),changedSources,addedSources,removedSources,helperSha256:sha(await readFile(join(repo,'host/windows-focus.ts'))),deployed:false,daemonRestarted:false}
await writeFile(join(out,'build-proof.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
