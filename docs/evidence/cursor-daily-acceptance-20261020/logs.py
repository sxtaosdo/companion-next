from pathlib import Path
import json,os,re,hashlib,datetime
W=Path(__file__).parent;root=Path.home()/'AppData/Roaming/Cursor/logs';latest=sorted(p for p in root.iterdir() if p.is_dir())[-1]
targets=['cocos-creator-cocos-214a2184','cocos-creator-cook-cdc0709d'];rows=[]
for folder,dirs,files in os.walk(latest):
 if len(Path(folder).relative_to(latest).parts)>=5:dirs[:]=[]
 for name in files:
  target=next((x for x in targets if x in name),None)
  if target is None or not name.lower().endswith('.log'):continue
  p=Path(folder)/name;b=p.read_bytes();text=b[-262144:].decode('utf-8',errors='replace');markers=[]
  for line in text.splitlines():
   timestamp=re.match(r'^\[?(\d{4}-\d{2}-\d{2}[^\] ]*)',line);t=timestamp.group(1) if timestamp else None
   patterns=[('connectedTrue',r'connected["\s:]+true'),('connectedStatus',r'statusType["\s:]+connected'),('toolCount',r'(?:found|listed|received|discovered|listing)\s+(\d+)\s+tools'),('reloadCompleted',r'ReloadClient completed'),('createCompleted',r'CreateClient completed')]
   for label,pattern in patterns:
    match=re.search(pattern,line,re.I)
    if match:markers.append({'kind':label,'timestamp':t,**({'count':int(match.group(1))} if label=='toolCount' else {})})
  rows.append({'target':target,'path':str(p),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'safeMarkers':markers,'rawContentArchived':False})
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualDailyLogDirectory':latest.name,'readOnlyTargetLogFiles':len(rows),'targets':rows,'otherServerLogContentsRead':0}
(W/'daily-log-proof.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode());print(json.dumps(proof))
