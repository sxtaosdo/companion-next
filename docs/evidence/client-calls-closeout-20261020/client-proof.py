from pathlib import Path
import json,tomllib,os,hashlib,subprocess,datetime,re
W=Path(__file__).parent;U=Path.home();load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'));sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inventory=load(W/'inventory.json');projects=load(Path(os.environ['APPDATA'])/'Creator AI Companion/projects.json')['projects']
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'configWrites':0,'secretOrCredentialFilesRead':0,'actualClientConnectionEstablished':False,'workspaceConfigs':[]}
for project in projects:
 if 'p1060' in str(project.get('path','')).lower() or 'p1060' in str(project.get('name','')).lower():continue
 for rel in ['.cursor/mcp.json','.codex/config.toml']:
  p=Path(project['path'])/rel;proof['workspaceConfigs'].append({'projectId':project['id'],'path':str(p),'exists':p.is_file()})
entry=Path('D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js')
# Direct CreateProcess validation only: no shell/file-association fallback, stdin closed,
# no MCP request and no tool call. The Windows OS rejects a JS file as an executable.
try:
 process=subprocess.Popen([str(entry),'mcp','--project','04c4cde24ee76d83'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:code=process.wait(timeout=5)
 except subprocess.TimeoutExpired:code=None
 proof['directConfiguredLaunch']={'created':True,'exitCode':code,'pid':process.pid,'shell':False,'toolRequests':0}
except OSError as error:
 proof['directConfiguredLaunch']={'created':False,'winerror':getattr(error,'winerror',None),'errno':error.errno,'rawErrorArchived':False,'shell':False,'toolRequests':0}
logroot=U/'AppData/Roaming/Cursor/logs';latest=sorted(p for p in logroot.iterdir() if p.is_dir())[-1];logs=[]
for p in latest.glob('mcp-server-user-cocos-creator-*.log'):
 if 'p1060' in p.name:continue
 b=p.read_bytes();tail=b[-65536:].decode('utf-8',errors='replace')
 logs.append({'filename':p.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'failedMarkers':len(re.findall(r'failed|error -32000',tail,re.I)),'closedMarkers':len(re.findall('closed',tail,re.I)),'successMarkers':len(re.findall(r'successfully connected|connection established|initialized successfully',tail,re.I))})
proof['cursorLatestDedicatedLogDirectory']=latest.name;proof['cursorDedicatedLogs']=logs
proof['configBytesUnchanged']=all(sha(Path(x['path']))==x['sha256'] for x in inventory['configs'] if x.get('exists'))
assert proof['configBytesUnchanged']
ps="Get-CimInstance Win32_Process | Where-Object {$_.Name -in @('Cursor.exe','codex.exe','CocosCreator.exe')} | Group-Object Name | Select-Object Name,Count | ConvertTo-Json -Compress"
out=subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',ps]).decode('utf-8-sig').strip();proof['clientProcessCounts']=json.loads(out) if out else []
(W/'client-proof.json').write_bytes((json.dumps(proof,ensure_ascii=False,indent=2)+'\n').encode());print(json.dumps(proof,ensure_ascii=False))
