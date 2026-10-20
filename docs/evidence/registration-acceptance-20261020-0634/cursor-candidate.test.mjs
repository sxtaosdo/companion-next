import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {configureCursorMcp as baseline} from './modules-baseline/cursor-configurator.js';
import {configureCursorMcp as candidate} from './modules-candidate/cursor-configurator.js';
const W=dirname(fileURLToPath(import.meta.url));
const id='214a2184be887306',name='cocos-creator-cocos-214a2184';
const js='D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js';
const args=['mcp','--project',id],node='C:/Program Files/nodejs/node.exe';
const input={projectId:id,projectName:'cocos',projectPath:'D:/fictional/not-opened',creatorAiPath:js};
const other={command:'fictional-unrelated',args:['untouched'],env:{KEEP:'fixture-only'}};
let seq=0;const outcomes=[];
async function fixture(entry){const dir=await mkdtemp(join(W,'fixture-'));const path=join(dir,'mcp.json');const data={fictionalPreference:{keep:true},mcpServers:{[name]:entry,unrelated:other}};await writeFile(path,JSON.stringify(data,null,2)+'\n');return {path,data,dir};}
const current=(extra={})=>({command:node,args:[js,...args],...extra});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function checked(label,fn){await fn();outcomes.push({label,passed:true});await writeFile(join(W,'cursor-candidate-results.json'),JSON.stringify({platform:process.platform,node:process.version,defaultFilesystemIO:true,noHttp:true,noClientLaunch:true,noGlobalConfigWrites:true,cases:outcomes},null,2)+'\n');}
test('current installed writer regresses repaired Node+JS transport in explicit Temp fixture',()=>checked('baseline_regression_reproduced',async()=>{const f=await fixture(current());const result=await baseline({...input,configPath:f.path});assert.equal(result.changed,true);const after=JSON.parse(await readFile(f.path,'utf8'));assert.equal(after.mcpServers[name].command,js);assert.deepEqual(after.mcpServers[name].args,args);assert.deepEqual(after.mcpServers.unrelated,other);}));
test('candidate upgrades exact legacy JS transport and preserves metadata/unrelated settings',()=>checked('legacy_upgrade_preserves_settings',async()=>{assert.equal(process.platform,'win32');const f=await fixture({command:js,args,type:'stdio',env:{KEEP:'fixture-only'}});const result=await candidate({...input,configPath:f.path});assert.equal(result.changed,true);const after=JSON.parse(await readFile(f.path,'utf8'));assert.equal(after.mcpServers[name].command,process.execPath);assert.deepEqual(after.mcpServers[name].args,[js,...args]);assert.deepEqual(after.mcpServers[name].env,{KEEP:'fixture-only'});assert.equal(after.mcpServers[name].type,'stdio');assert.deepEqual(after.mcpServers.unrelated,other);assert.deepEqual(after.fictionalPreference,{keep:true});}));
test('candidate treats existing approved forward-slash Node+JS config as byte-idempotent',()=>checked('repaired_node_transport_byte_idempotent',async()=>{const f=await fixture(current());const before=await readFile(f.path);const result=await candidate({...input,configPath:f.path});assert.equal(result.changed,false);assert.equal(result.command,node);assert.deepEqual(result.args,[js,...args]);assert.equal(hash(await readFile(f.path)),hash(before));}));
test('candidate refuses same-name transport for another project without changing bytes',()=>checked('other_project_conflict_no_write',async()=>{const f=await fixture({command:js,args:['mcp','--project','0000000000000000']});const before=await readFile(f.path);await assert.rejects(candidate({...input,configPath:f.path}));assert.equal(hash(await readFile(f.path)),hash(before));}));
test('candidate refuses foreign command even when its arguments include this project',()=>checked('foreign_command_conflict_no_write',async()=>{const f=await fixture({command:'D:/fictional/foreign.exe',args:[js,...args]});const before=await readFile(f.path);await assert.rejects(candidate({...input,configPath:f.path}));assert.equal(hash(await readFile(f.path)),hash(before));}));
test('candidate refuses unrelated script and extra execution arguments',()=>checked('foreign_script_and_extra_arguments_conflict',async()=>{for(const entry of [{command:node,args:['D:/fictional/other.js',...args]},{command:js,args:[...args,'--extra']},{command:js,args,type:'sse'}]){const f=await fixture(entry);const before=await readFile(f.path);await assert.rejects(candidate({...input,configPath:f.path}));assert.equal(hash(await readFile(f.path)),hash(before));}}));
test('candidate retains preexisting non-JS executable launch semantics',()=>checked('non_js_executable_unchanged',async()=>{const root=await mkdtemp(join(W,'exe-fixture-'));const exe=join(root,'creator-ai.exe');await writeFile(exe,'fictional access fixture; never executed');const f=await fixture({command:exe,args});const before=await readFile(f.path);const result=await candidate({...input,creatorAiPath:exe,configPath:f.path});assert.equal(result.changed,false);assert.equal(hash(await readFile(f.path)),hash(before));}));
