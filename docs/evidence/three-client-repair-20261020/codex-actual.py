from pathlib import Path
import subprocess,json,tomllib,threading,queue,time,datetime,hashlib,os
W=Path(__file__).parent;U=Path.home();EXE='C:/Users/33272/AppData/Local/OpenAI/Codex/bin/896a0166b774037a/codex.exe';TARGET='cocos-creator-ant-cook-04c4cde2'
config=tomllib.loads((U/'.codex/config.toml').read_text(encoding='utf-8-sig'));cmd=[EXE,'app-server','--stdio']
for name in config['mcp_servers']:
 if name!=TARGET:cmd+=['-c','mcp_servers.'+name+'.enabled=false']
cmd+=['-c','features.apps=false']
assert not (W/'codex-actual-issued.json').exists()
(W/'codex-actual-issued.json').write_bytes((json.dumps({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualExecutable':EXE,'transport':'stdio','target':TARGET,'nonTargetDisabledInProcessOnly':True,'modelTurnsRequested':0})+'\n').encode())
p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,cwd='D:/code/shidai3/P8000/companion-next')
messages=queue.Queue();stderrBytes=[0]
def output():
 for line in p.stdout:
  try:messages.put(json.loads(line))
  except ValueError:messages.put({'invalidJson':True})
def errors():
 for b in iter(lambda:p.stderr.read(4096),b''):stderrBytes[0]+=len(b)
threading.Thread(target=output,daemon=True).start();threading.Thread(target=errors,daemon=True).start();counter=0
def send(method,params,id=None):
 v={'method':method,'params':params}
 if id is not None:v['id']=id
 p.stdin.write((json.dumps(v)+'\n').encode());p.stdin.flush()
def request(method,params,seconds=40):
 global counter
 counter+=1;id=counter;send(method,params,id);until=time.monotonic()+seconds
 while time.monotonic()<until:
  try:m=messages.get(timeout=min(1,until-time.monotonic()))
  except queue.Empty:continue
  if m.get('id')==id:
   if 'error' in m:raise RuntimeError('RPC_'+str(m['error'].get('code')))
   return m.get('result')
  if 'id'in m and 'method'in m:
   # No inference, approvals, input or credential setup are authorized here.
   p.stdin.write((json.dumps({'id':m['id'],'error':{'code':-32601,'message':'Unsupported in read-only connection verification'}})+'\n').encode());p.stdin.flush()
 raise RuntimeError('RPC_TIMEOUT_'+method)
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualClient':'Installed codex.exe app-server','target':TARGET,'modelTurnsRequested':0,'configurationWrites':0,'tools':[],'ok':False}
try:
 init=request('initialize',{'clientInfo':{'name':'companion-client-acceptance','version':'1.0.0'},'capabilities':{'experimentalApi':True}});send('initialized',{})
 proof['initialized']=True
 status=request('mcpServerStatus/list',{'serverName':TARGET,'detail':'toolsAndAuthOnly','limit':1})
 proof['statusResponseShape']=list(status) if isinstance(status,dict) else type(status).__name__
 rows=status.get('data',[]) if isinstance(status,dict) else [];row=next(x for x in rows if x.get('name')==TARGET)
 proof['targetStatusFields']=sorted(row);proof['toolCount']=len(row.get('tools',{}));proof['authStatus']=row.get('authStatus');assert proof['toolCount']>0
 started=request('thread/start',{'cwd':'D:/code/shidai3/P8000/companion-next','ephemeral':True})
 thread=started['thread']['id'];proof['ephemeralThreadId']=thread
 status2=request('mcpServerStatus/list',{'serverName':TARGET,'threadId':thread,'detail':'toolsAndAuthOnly','limit':1})
 proof['threadTargetToolCount']=len(next(x for x in status2['data'] if x.get('name')==TARGET).get('tools',{}))
 result=request('mcpServer/tool/call',{'threadId':thread,'server':TARGET,'tool':'project_get_status','arguments':{}},30)
 proof['toolResponseFields']=sorted(result) if isinstance(result,dict) else type(result).__name__
 structured=result.get('structuredContent',{}) if isinstance(result,dict) else {}
 proof['toolStatus']=structured.get('status');proof['isError']=result.get('isError') if isinstance(result,dict) else None
 proof['toolResultSha256']=hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()
 proof['ok']=proof['toolStatus']=='PASSED' and proof['isError'] is not True
 request('thread/unsubscribe',{'threadId':thread},10)
except Exception as error:
 proof['failureCode']=str(error) if str(error).startswith(('RPC_','OWNER_')) else type(error).__name__
finally:
 p.stdin.close()
 try:proof['appServerExitCode']=p.wait(timeout=15)
 except subprocess.TimeoutExpired:proof['appServerExitCode']=None
 proof['stderrBytes']=stderrBytes[0];proof['rawOutputArchived']=False
 (W/'codex-actual-result.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode());print(json.dumps(proof))
if not proof['ok']:raise SystemExit(1)
