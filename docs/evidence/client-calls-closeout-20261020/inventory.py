from pathlib import Path
import json,tomllib,hashlib,datetime,os,shutil
W=Path(__file__).parent;U=Path.home();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
configs=[(U/'.codex/config.toml','toml','mcp_servers'),(U/'.cursor/mcp.json','json','mcpServers')]
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'configurationWrites':0,'credentialFilesRead':0,'configs':[]}
for p,kind,key in configs:
 if not p.exists():proof['configs'].append({'path':str(p),'exists':False});continue
 h=sha(p);data=tomllib.loads(p.read_text(encoding='utf-8-sig')) if kind=='toml' else json.loads(p.read_text(encoding='utf-8-sig'));servers=data.get(key,{})
 rows=[]
 for name,value in servers.items():
  if not any(t in name.lower() for t in ['cocos','creator','companion']):continue
  if 'p1060' in name.lower():rows.append({'name':name,'excludedPaused':True});continue
  command=value.get('command','');args=value.get('args',[]);entry=Path(command);resolved=entry if entry.is_absolute() else Path(shutil.which(command) or '')
  safe=[]
  for i,a in enumerate(args):
   if a in ['mcp','--project','--locked','--coordinated']:safe.append(a)
   elif i>0 and args[i-1]=='--project' and isinstance(a,str) and all(c.isalnum() or c in '-_' for c in a):safe.append(a)
   elif isinstance(a,str) and a.lower().endswith(('.js','.cmd','.ps1')) and Path(a).is_absolute():safe.append(a)
   else:safe.append('[omitted]')
  rows.append({'name':name,'fields':sorted(value),'enabled':value.get('enabled',not value.get('disabled',False)),'command':command if entry.is_absolute() or command in ['node','npx','cmd','powershell'] else '[omitted]','resolvedCommand':str(resolved) if resolved.is_file() else None,'commandFileSha256':sha(resolved) if resolved.is_file() else None,'args':safe,'environmentNames':sorted(value.get('env',{})),'transport':'url' if 'url' in value else 'stdio','excludedPaused':False})
 proof['configs'].append({'path':str(p),'exists':True,'sha256':h,'serverCount':len(servers),'relevant':rows,'unchangedAfterRead':sha(p)==h})
assert all(x.get('unchangedAfterRead',True) for x in proof['configs'])
(W/'inventory.json').write_bytes((json.dumps(proof,ensure_ascii=False,indent=2)+'\n').encode())
print(json.dumps(proof,ensure_ascii=False))
