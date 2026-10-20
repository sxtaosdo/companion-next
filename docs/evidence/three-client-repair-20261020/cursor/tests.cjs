const vscode=require('vscode');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');
const root='C:/Users/33272/AppData/Local/Temp/companion-three-client-repair-20261020/cursor-actual';
const proof={atUtc:new Date().toISOString(),actualClient:'Installed Cursor extension host with built-in anysphere.cursor-mcp',isolatedInstance:true,dailyUserWindowReloaded:false,extensionInstalled:false,modelRequests:0,profileConfigWrites:0,servers:[],ok:false};
exports.run=async()=>{
 const created=[];
 try{
  proof.appName=vscode.env.appName;proof.appVersion=vscode.version;proof.executable=process.execPath;proof.homeMatchesIsolated=path.resolve(os.homedir()).toLowerCase()===path.resolve(root+'/home').toLowerCase();
  if(!proof.homeMatchesIsolated||!/cursor/i.test(vscode.env.appName))throw Error('NOT_ISOLATED_ACTUAL_CURSOR');
  const definitions=JSON.parse(fs.readFileSync(root+'/home/.cursor/mcp.json','utf8')).mcpServers;
  if(Object.keys(definitions).length!==2||Object.keys(definitions).some(x=>/p1060/i.test(x)))throw Error('UNAPPROVED_SERVER_SET');
  const extension=vscode.extensions.getExtension('anysphere.cursor-mcp');if(!extension)throw Error('BUILTIN_MCP_EXTENSION_UNAVAILABLE');await extension.activate();
  const commands=await vscode.commands.getCommands(true);proof.availableMcpCommands=commands.filter(x=>/^mcp\.(?:createClient|reloadClient|listToolsRaw|callTool|deleteClient)$/.test(x));
  if(!commands.includes('mcp.reloadClient'))throw Error('TARGET_MCP_RELOAD_NOT_EXPOSED');
  const lease=extension.exports?.getMcpLease?.();if(!lease)throw Error('CURSOR_MCP_LEASE_UNAVAILABLE');proof.builtinLeaseUsed=true;
  for(const [name,config] of Object.entries(definitions)){
   const identifier='user-'+name,serverInfo={type:'stdio',command:config.command,args:config.args,env:config.env||{}};
   const connected=await vscode.commands.executeCommand('mcp.reloadClient',{identifier,serverInfo,serverName:name});created.push(identifier);
   const row={name,reloadReturned:connected!==undefined};proof.servers.push(row);
   const client=await lease.getClient(undefined,identifier);if(!client)throw Error('CURSOR_TARGET_CLIENT_UNAVAILABLE');
   const tools=await client.getTools(undefined);row.toolCount=Array.isArray(tools)?tools.length:undefined;row.connected=row.toolCount>0;
   if(!row.connected)throw Error('CURSOR_TARGET_NOT_CONNECTED');
   const result=await client.callTool(undefined,'project_get_status',{},'companion-client-readonly-'+name);
   const value=result?.result??result;let structured=value?.structuredContent;
   if(!structured&&Array.isArray(value?.content))for(const item of value.content)if(item.type==='text'){try{const data=JSON.parse(item.text);if(data?.projectId)structured={status:'PASSED',data};}catch{}}
   row.isError=value?.isError===true;row.toolStatus=structured?.status;row.resultSha256=crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
   if(row.isError||row.toolStatus!=='PASSED')throw Error('CURSOR_READONLY_TOOL_NOT_PASSED');
  }
  proof.ok=true;
 }catch(error){proof.failureCode=/^[A-Z_]+$/.test(error?.message||'')?error.message:'CURSOR_CLIENT_VALIDATION_FAILED';}
 finally{
  proof.ownedClientsDisposedByTestInstanceExit=true;
  proof.rawResultArchived=false;fs.writeFileSync(root+'/result.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 }
 if(!proof.ok)throw Error(proof.failureCode);
};
