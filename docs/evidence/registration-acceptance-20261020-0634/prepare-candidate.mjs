import { readFile,writeFile,mkdir } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import ts from 'file:///D:/code/shidai3/P8000/companion-next/node_modules/typescript/lib/typescript.js';
const W=dirname(fileURLToPath(import.meta.url));
const map=JSON.parse(await readFile('D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/companion-daemon.js.map','utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const source=name=>{const ids=map.sources.flatMap((s,i)=>s.endsWith('/'+name)?[i]:[]);if(ids.length!==1)throw Error(name);return map.sourcesContent[ids[0]]};
const original=source('cursor-configurator.ts');
if(sha(original)!=='27cc842a4894948333d21f9f25924c849711cac3775857dc381d97389697cd62')throw Error('Baseline source changed');
let candidate=original.replace('basename, dirname, join','basename, dirname, join, win32');
const begin=candidate.indexOf('function isManagedEntry('),end=candidate.indexOf('/**',begin);
if(begin<0||end<0)throw Error('Helper anchors missing');
candidate=candidate.slice(0,begin)+`function sameLaunchPath(actual: string, expected: string): boolean {
  return process.platform === "win32" ? win32.normalize(actual).toLowerCase() === win32.normalize(expected).toLowerCase() : actual === expected;
}

function sameEntry(entry: CursorMcpServerEntry | undefined, command: string, args: string[]): boolean {
  if (!entry || typeof entry.command !== "string" || !Array.isArray(entry.args)) return false;
  if (entry.type !== undefined && entry.type !== "stdio") return false;
  if (!sameLaunchPath(entry.command, command) || entry.args.length !== args.length || !entry.args.every((item): item is string => typeof item === "string")) return false;
  return entry.args.every((item, index) => index === 0 && args.length === 4 ? sameLaunchPath(item, args[index]) : item === args[index]);
}

function isManagedEntry(entry: CursorMcpServerEntry | undefined, creatorAiPath: string, projectId: string): boolean {
  const args = ["mcp", "--project", projectId];
  return sameEntry(entry, creatorAiPath, args) || sameEntry(entry, process.execPath, [creatorAiPath, ...args]);
}

`+candidate.slice(end);
candidate=candidate.replace(/const args = \["mcp", "--project", input\.projectId\];\r?\n  const command = input\.creatorAiPath;/,`const useNode = process.platform === "win32" && /\\.(?:c?js|mjs)$/i.test(input.creatorAiPath);
  const command = useNode ? process.execPath : input.creatorAiPath;
  const args = [...(useNode ? [input.creatorAiPath] : []), "mcp", "--project", input.projectId];`);
candidate=candidate.replace('await accessPath(command);','await accessPath(input.creatorAiPath);\n  if (useNode) await accessPath(command);');
candidate=candidate.replace('return { name, command, args, projectId: input.projectId, configPath, changed: false };','return { name, command: existing!.command as string, args: existing!.args as string[], projectId: input.projectId, configPath, changed: false };');
candidate=candidate.replace('isManagedEntry(existing, input.projectId)','isManagedEntry(existing, input.creatorAiPath, input.projectId)');
candidate=candidate.replace('servers[name] = { command, args };','servers[name] = { ...existing, command, args };');
if(candidate===original||!candidate.includes('const useNode'))throw Error('Candidate patch missing');
candidate=candidate.replace(/\r?\n/g,original.includes('\r\n')?'\r\n':'\n');
await writeFile(join(W,'cursor-configurator.candidate.ts'),candidate,'utf8');
const hashes={baseline:sha(original),candidate:sha(candidate),dependencies:{}};
for(const variant of ['baseline','candidate']){
 const root=join(W,'modules-'+variant);await mkdir(root,{recursive:true});await writeFile(join(root,'package.json'),'{"type":"module"}\n');
 for(const name of ['cursor-configurator.ts','codex-configurator.ts','atomic-config-write.ts','config-file-security.ts']){
  const text=name==='cursor-configurator.ts'&&variant==='candidate'?candidate:source(name);
  if(name!=='cursor-configurator.ts')hashes.dependencies[name]=sha(text);
  const compiled=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  await writeFile(join(root,name.replace(/\.ts$/,'.js')),compiled);
 }
}
await writeFile(join(W,'candidate-bindings.json'),JSON.stringify(hashes,null,2)+'\n');
const check=join(W,'typecheck');await mkdir(check,{recursive:true});
for(const name of ['cursor-configurator.ts','codex-configurator.ts','atomic-config-write.ts','config-file-security.ts'])await writeFile(join(check,name),name==='cursor-configurator.ts'?candidate:source(name));
await writeFile(join(check,'package.json'),'{"type":"module"}\n');
await writeFile(join(check,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,noEmit:true,target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',skipLibCheck:true,types:['node'],typeRoots:['D:/code/shidai3/P8000/cocos-mcp/mcp/node_modules/@types']},include:['*.ts']},null,2));
console.log(JSON.stringify(hashes));
