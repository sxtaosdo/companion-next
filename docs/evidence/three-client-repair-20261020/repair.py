from pathlib import Path
import json,tomllib,re,hashlib,os,sys,datetime,ctypes,msvcrt
W=Path(__file__).parent;U=Path.home();sha=lambda b:hashlib.sha256(b).hexdigest()
NODE='C:/Program Files/nodejs/node.exe';ENTRY='D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js'
TARGETS=[(U/'.codex/config.toml','toml',['cocos-creator-ant-cook-04c4cde2']),(U/'.cursor/mcp.json','json',['cocos-creator-cocos-214a2184','cocos-creator-cook-cdc0709d'])]
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def object_fields(s,start):
 dec=json.JSONDecoder();i=start+1;fields={}
 while True:
  while s[i].isspace() or s[i]==',':i+=1
  if s[i]=='}':break
  key,end=dec.raw_decode(s,i);i=end
  while s[i].isspace():i+=1
  assert s[i]==':';i+=1
  while s[i].isspace():i+=1
  value,end=dec.raw_decode(s,i);fields[key]=(i,end,value);i=end
 return fields
def transform(raw,kind,names):
 bom=raw.startswith(b'\xef\xbb\xbf');s=raw.decode('utf-8-sig');data=tomllib.loads(s) if kind=='toml' else json.loads(s);key='mcp_servers' if kind=='toml' else 'mcpServers';servers=data[key];changes=[];replacements=[]
 for name in names:
  value=servers[name];old=value['command'];args=value['args'];assert old.replace('\\','/')==ENTRY and args[0]=='mcp' and args[1]=='--project' and len(args)==3,'TARGET_CHANGED'
  updated={'command':NODE,'args':[ENTRY,*args]};changes.append({'serverName':name,'oldCommand':old,'oldArgs':args,**updated})
  if kind=='json':
   root=object_fields(s,s.index('{'));start=root[key][0];fields=object_fields(s,start);start=fields[name][0];own=object_fields(s,start)
   for field in ['command','args']:a,b,_=own[field];replacements.append((a,b,json.dumps(updated[field],ensure_ascii=False)))
  else:
   heads=list(re.finditer(r'(?m)^\[([^\r\n]+)\][ \t]*(?:\r?\n|$)',s));head=next((i,h) for i,h in enumerate(heads) if h.group(1)=='mcp_servers.'+name);i,h=head;end=heads[i+1].start() if i+1<len(heads) else len(s);part=s[h.end():end]
   for field in ['command','args']:
    matches=list(re.finditer(r'(?m)^'+field+r'[ \t]*=[ \t]*([^\r\n]+)',part));assert len(matches)==1,'UNEXPECTED_TOML_LAYOUT';m=matches[0];replacements.append((h.end()+m.start(1),h.end()+m.end(1),json.dumps(updated[field],ensure_ascii=False)))
 expected=json.loads(json.dumps(data))
 for c in changes:expected[key][c['serverName']]['command']=c['command'];expected[key][c['serverName']]['args']=c['args']
 for a,b,value in sorted(replacements,reverse=True):s=s[:a]+value+s[b:]
 actual=tomllib.loads(s) if kind=='toml' else json.loads(s);assert actual==expected,'NON_TARGET_CHANGED'
 return (b'\xef\xbb\xbf' if bom else b'')+s.encode(),changes
def held_file(path):
 k=ctypes.WinDLL('kernel32',use_last_error=True);k.CreateFileW.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p];k.CreateFileW.restype=ctypes.c_void_p
 handle=k.CreateFileW(str(path),0xC0000000,1,None,3,0x80,None)
 if handle==ctypes.c_void_p(-1).value:raise RuntimeError('EXCLUSIVE_WRITE_HANDLE_UNAVAILABLE')
 return os.fdopen(msvcrt.open_osfhandle(handle,os.O_RDWR|os.O_BINARY),'r+b')
mode=sys.argv[1]
if mode=='prepare':
 assert not (W/'plan.json').exists();plans=[]
 oldproposal=load(Path('C:/Users/33272/AppData/Local/Temp/companion-client-calls-closeout-20261020/configuration-proposal.json'))
 for p,kind,names in TARGETS:
  raw=p.read_bytes();candidate,changes=transform(raw,kind,names);old=next(x for x in oldproposal['files'] if Path(x['path'])==p)
  plans.append({'path':str(p),'kind':kind,'sha256Before':sha(raw),'sha256After':sha(candidate),'unchangedSinceReadOnlyProposal':sha(raw)==old['guardSha256'],'changes':changes,'candidateBytes':len(candidate),'originalBytes':len(raw)})
 with (W/'plan.json').open('x',encoding='utf-8') as f:json.dump({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':plans,'targetEntries':3,'nonTargetSemanticChanges':0,'permissionsOrCredentialsChanges':0},f,indent=2)
 print(json.dumps({'prepared':True,'files':2,'entries':3,'unchangedSinceProposal':[x['unchangedSinceReadOnlyProposal'] for x in plans]}))
elif mode=='apply':
 plan=load(W/'plan.json');assert not (W/'write-issued.json').exists(),'PRIOR_WRITE_ISSUED_INSPECT_FIRST';handles=[];backups=[]
 try:
  for (p,kind,names),item in zip(TARGETS,plan['files']):
   f=held_file(p);handles.append((f,p,kind,names,item));raw=f.read();assert sha(raw)==item['sha256Before'],'CONFIG_CHANGED_SINCE_CHECKPOINT'
   candidate,changes=transform(raw,kind,names);assert sha(candidate)==item['sha256After']
   backup=p.with_name(p.name+'.companion-three-20261020-'+item['sha256Before'][:12]+'.bak');assert not backup.exists(),'BACKUP_ALREADY_EXISTS_INSPECT_FIRST'
   with backup.open('xb') as b:b.write(raw);b.flush();os.fsync(b.fileno())
   assert sha(backup.read_bytes())==item['sha256Before'];backups.append({'path':str(backup),'sha256':item['sha256Before']})
  with (W/'write-issued.json').open('x',encoding='utf-8') as f:json.dump({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'backups':backups,'files':2,'entries':3},f,indent=2);f.flush();os.fsync(f.fileno())
  for f,p,kind,names,item in handles:
   f.seek(0);raw=f.read();assert sha(raw)==item['sha256Before'];candidate,_=transform(raw,kind,names);f.seek(0);f.write(candidate);f.truncate();f.flush();os.fsync(f.fileno());f.seek(0);assert sha(f.read())==item['sha256After']
  with (W/'write-result.json').open('x',encoding='utf-8') as f:json.dump({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ok':True,'files':[{'path':x['path'],'sha256':x['sha256After']} for x in plan['files']],'entries':3,'sameFileHandlesAndPermissionsPreserved':True,'nonTargetSemanticChanges':0,'backups':backups},f,indent=2)
  print(json.dumps({'ok':True,'files':2,'entries':3,'backupsVerified':2,'nonTargetSemanticChanges':0,'permissionsChanged':False}))
 finally:
  for f,*_ in handles:f.close()
else:raise RuntimeError('BAD_MODE')
