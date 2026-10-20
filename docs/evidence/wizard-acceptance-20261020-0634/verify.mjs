import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile as exec} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname} from 'node:path';
import {createRequire} from 'node:module';
const W=dirname(fileURLToPath(import.meta.url));
const require=createRequire('D:/code/shidai3/P8000/companion-next/package.json');
const ts=require('typescript');
const sha=b=>createHash('sha256').update(b).digest('hex');
const cli='C:/Users/33272/AppData/Local/OpenAI/Codex/bin/896a0166b774037a/codex.exe';
const execute=promisify(exec),rows=[],commands=[];
assert.equal(process.platform,'win32');
const input={projectId:'04c4cde24ee76d83',projectName:'ant-cook',projectPath:'D:/code/shidai3/P8000/ant-cook',creatorAiPath:'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js',codexPath:cli};
const name='cocos-creator-ant-cook-04c4cde2';
const expected={command:process.execPath,args:[input.creatorAiPath,'mcp','--project',input.projectId]};
const unrelated='[mcp_servers.fixture_unrelated]\ncommand = "C:/never-executed-fixture.exe"\nargs = ["unrelated"]\nenabled = false\n';
async function compile(folder){const src=await readFile(join(W,folder,'codex-configurator.ts'),'utf8');const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,strict:true},reportDiagnostics:true});assert.equal(out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);const target=join(W,folder,'codex-configurator.mjs');await writeFile(target,out.outputText);return import(pathToFileURL(target).href);}
const base=await compile('baseline'),candidate=await compile('candidate');
const home=join(W,'isolated-codex-home');await mkdir(home,{recursive:true});process.env.CODEX_HOME=home;
const config=join(home,'config.toml');await writeFile(config,unrelated);
async function run(args){assert.deepEqual(args.slice(0,1),['mcp']);assert.ok(['get','add','remove'].includes(args[1]));commands.push({verb:args[1],target:args[2]});return execute(cli,args,{cwd:W,env:{...process.env,CODEX_HOME:home},windowsHide:true,timeout:15000,maxBuffer:1024*1024});}
const actualExec=async(file,args)=>{assert.equal(file,cli);return run([...args]);};
await run(['mcp','add',name,'--',input.creatorAiPath,'mcp','--project',input.projectId]);
const beforeMigration=await readFile(config);assert.ok(beforeMigration.toString().includes(unrelated));
const upgraded=await candidate.configureCodexMcp(input,{execFile:actualExec});
assert.equal(upgraded.changed,true);assert.deepEqual({command:upgraded.command,args:upgraded.args},expected);
let actual=JSON.parse((await run(['mcp','get',name,'--json'])).stdout);assert.deepEqual({command:actual.transport.command,args:actual.transport.args},expected);
assert.ok((await readFile(config,'utf8')).includes(unrelated));
rows.push({scenario:'candidate-old-direct-js-upgrade-actual-cli-isolated-home',status:'passed',changed:true,unrelatedEntryBytesPreserved:true});
let calls=0;const existing=JSON.stringify(actual);
await assert.rejects(base.configureCodexMcp(input,{execFile:async(file,args)=>{calls++;assert.equal(args[1],'get');return {stdout:existing,stderr:''};}}),error=>error.code==='CODEX_MCP_CONFIGURATION_FAILED'&&error.stage==='read'&&error.recovery==='conflict');assert.equal(calls,1);
rows.push({scenario:'deployed-baseline-rejects-repaired-node-shape',status:'reproduced-defect',reads:1,mutationCommands:0});
const beforeNoop=await readFile(config),noop=await candidate.configureCodexMcp(input,{execFile:actualExec});assert.equal(noop.changed,false);assert.deepEqual(await readFile(config),beforeNoop);
rows.push({scenario:'candidate-new-node-idempotent-actual-cli-isolated-home',status:'passed',wholeConfigBytesUnchanged:true});
actual.transport.command=actual.transport.command.replaceAll('\\','/').toUpperCase();actual.transport.args[0]=actual.transport.args[0].replaceAll('/','\\').toUpperCase();
calls=0;const normalized=await candidate.configureCodexMcp(input,{execFile:async(file,args)=>{calls++;assert.equal(args[1],'get');return {stdout:JSON.stringify(actual),stderr:''};}});assert.equal(normalized.changed,false);assert.equal(calls,1);
rows.push({scenario:'candidate-node-path-case-and-separator-noop',status:'passed',mutationCommands:0});
for(const scenario of ['other-project','tool-restrictions','unrelated-command']){
 const value=JSON.parse(existing);
 if(scenario==='other-project')value.transport.args[value.transport.args.length-1]='ffffffffffffffff';
 if(scenario==='tool-restrictions')value.enabled_tools=['project_get_status'];
 if(scenario==='unrelated-command')value.transport.command='C:/unrelated/node.exe';
 const before=await readFile(config);calls=0;
 await assert.rejects(candidate.configureCodexMcp(input,{execFile:async(file,args)=>{calls++;assert.equal(args[1],'get');return {stdout:JSON.stringify(value),stderr:''};}}),error=>error.code==='CODEX_MCP_CONFIGURATION_FAILED'&&error.stage==='read'&&error.recovery==='conflict');assert.equal(calls,1);assert.deepEqual(await readFile(config),before);
 rows.push({scenario:'candidate-refuses-'+scenario,status:'passed',mutationCommands:0,configBytesUnchanged:true});
}
for(const detail of ["Permission denied", "Login required", "Unknown configuration error", `No MCP server named 'other-name' found.`]){
 calls=0;
 await assert.rejects(candidate.configureCodexMcp(input,{execFile:async(file,args)=>{calls++;assert.equal(args[1],'get');throw Object.assign(new Error('CLI read failed'),{code:1,stderr:detail+`\nError: No MCP server named '${name}' found.`});}}),error=>error.code==='CODEX_MCP_CONFIGURATION_FAILED'&&error.stage==='read'&&error.recovery==='unknown');
 assert.equal(calls,1);
}
rows.push({scenario:'candidate-refuses-permission-login-unknown-or-other-name-mixed-output',status:'passed',cases:4,mutationCommands:0});
const baseline=JSON.parse(await readFile(join(W,'baseline.json'),'utf8'));
for(const [p,h] of Object.entries(baseline.realGlobalConfigBefore))assert.equal(sha(await readFile(p)),h,'real global configuration changed during isolated tests');
for(const [filename,key] of [['companion-daemon.js','daemonSha256'],['companion-daemon.js.map','daemonMapSha256'],['creator-ai.js','cliSha256']])assert.equal(sha(await readFile('D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/'+filename)),baseline[key]);
const result={atUtc:new Date().toISOString(),scope:'OFFLINE_CANDIDATE_AND_REAL_CLI_IN_TASK_OWNED_CODEX_HOME_ONLY',rows,actualCodexCliCommands:commands,passed:rows.filter(x=>x.status==='passed').length,reproducedDefects:1,productionSetupRequests:0,realGlobalConfigWrites:0,mcpServerStarts:0,modelCalls:0,creatorActions:0,isolatedConfigSha256:sha(await readFile(config)),realGlobalConfigAndInstalledRuntimeHashesUnchanged:true};
await writeFile(join(W,'verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,reproducedDefects:1,actualIsolatedCliCommands:commands.length,productionSetupRequests:0,globalConfigWrites:0}));
