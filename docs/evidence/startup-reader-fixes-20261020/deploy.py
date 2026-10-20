from pathlib import Path
import os,json,hashlib,subprocess,datetime,urllib.request,urllib.error,sys,shutil,stat
W=Path(__file__).parent;B=Path('C:/Users/33272/AppData/Local/Temp/companion-boot-repair-20261020')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
ns={'__file__':str(B/'deploy.py')};exec(compile((B/'deploy.py').read_text().split('mode=sys.argv[1]')[0],'readonly-protection','exec'),ns)
I=ns['I'];D=ns['D'];C=load(W/'checkpoint.json');NAMES=['creator-ai.js.map','knowledge-worker.js.map','creator-ai.js','knowledge-worker.js']
def save(n,v):
 with (W/n).open('x',encoding='utf-8',newline='\n') as f:json.dump(v,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
def request(route,data=None):
 l=load(D/'daemon.json');assert l['baseUrl']=='http://127.0.0.1:32180'
 req=urllib.request.Request(l['baseUrl']+route,headers={'Authorization':'Bearer '+l['apiToken'],'Content-Type':'application/json'},data=None if data is None else json.dumps(data).encode())
 with urllib.request.urlopen(req,timeout=12) as r:return json.load(r)
def state(old=True):
 s=request('/v1/daemon/inflight');assert s['identity']==load(D/'daemon.json')['identity']
 assert s['identity']['entrySha256']==C['identity']['entrySha256']
 if old:assert s['identity']==C['identity']
 assert s['unknown']==['NATIVE_PRIOR_EPOCH_UNVERIFIED'] and s['counts']['nativeEpochUnproven']==2
 return s
def service():
 ps="""$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId=600';$l=@(Get-NetTCPConnection -State Listen -LocalPort 8081);if($null-eq$p-or$l.Count-ne1-or$l[0].OwningProcess-ne600){throw 'Knowledge owner changed'};@{pid=$p.ProcessId;path=$p.ExecutablePath;created=$p.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')}|ConvertTo-Json -Compress"""
 p=json.loads(subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',ps]).decode('utf-8-sig'))
 assert p['created']=='2026-10-20T02:03:09.5395770Z' and Path(p['path'])==Path('D:/services/weknora/normal-reader-recovery-v0.8.2/weknora.exe')
 assert sha(Path(p['path']))=='b05899bc8ccaf299f8d5b5bb7c131cedf81491e51b02906b4321d72c10d6ce64'
 with urllib.request.urlopen('http://127.0.0.1:8081/health',timeout=5) as r:assert r.status==200
 return p
def protected(installed=False,afterstart=False):
 assert ns['shared']() and ns['business']()==C['business'];service()
 for n,h in C['runtime'].items():
  if n in NAMES and installed:assert sha(I/n)==sha(W/'candidate'/n)
  else:assert sha(I/n)==h,n
 for n,h in C['immutable'].items():
  if afterstart and n==load(W/'captured.json')['canonicalName']:continue
  assert sha(D/n)==h,n
def idle(s):
 assert s['counts']['http']<=1 and all(v==0 for k,v in s['counts'].items() if k not in ['http','nativeEpochUnproven'])
def absent():
 ps="""$ErrorActionPreference='Stop';if((Get-CimInstance Win32_Process -Filter 'ProcessId=7156')-or@(Get-NetTCPConnection -State Listen -LocalPort 32180 -ErrorAction SilentlyContinue).Count){throw 'Owner exit or port absence unconfirmed'};'ABSENT'"""
 assert subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',ps]).strip()==b'ABSENT'
mode=sys.argv[1]
if mode=='capture':
 protected();s=state();assert s['phase']=='OPEN';idle(s)
 source=Path('C:/Users/33272/AppData/Local/Temp/companion-process-restart-20261019/process-handle.ps1').read_text(encoding='utf-8').replace('C:\\Users\\33272\\AppData\\Local\\Temp\\companion-process-restart-20261019',str(W)).replace('7832','7156')
 (W/'process-handle.ps1').write_bytes(source.encode())
 z=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',str(W/'process-handle.ps1'),'-Mode','Inspect'],capture_output=True);assert z.returncode==0,'Exact handle inspect failed'
 locks=[p for p in D.glob('native-epochs.jsonl.boot-*.lock') if load(p).get('pid')==7156];assert len(locks)==1
 lock=locks[0];f=lock.lstat();assert stat.S_ISREG(f.st_mode) and f.st_nlink==1 and not f.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT
 record=load(lock);assert record['schemaVersion']==2 and record['owner']['daemonIdentity']==s['identity']
 save('captured.json',{'identity':s['identity'],'canonicalName':lock.name,'canonicalSha256':sha(lock),'canonicalInode':f.st_ino,'os':load(W/'process-handle-before.json'),'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'service':service()})
 print(json.dumps({'captured':True,'pid':7156,'unknown':2,'exactHandleInspected':True,'knowledgePid':600}))
elif mode=='freeze':
 protected();s=state();assert s['phase']=='OPEN';idle(s)
 try:request('/v1/daemon/stop',{'identity':s['identity'],'generation':s['generation'],'maxWaitMs':1});raise RuntimeError('Unexpected completed stop; inspect exact owner, do not terminate')
 except urllib.error.HTTPError as error:
  assert error.code==409;failure=json.load(error);assert failure['code']=='DAEMON_DRAIN_BLOCKED'
 s=state();assert s['phase']=='DRAINING';idle(s);protected()
 save('admission-frozen.json',{'snapshot':s,'guardRefusalCode':failure['code'],'unknownRetained':2})
 save('kill-preflight-approved.json',{'identity':s['identity'],'os':load(W/'captured.json')['os'],'scope':'SINGLE_EXACT_PROCESS_HANDLE','allSpecializedBusinessCountersZero':True,'http':s['counts']['http'],'unknown':2,'windowsRestart':False})
 print(json.dumps({'frozen':True,'pid':7156,'specializedCounters':0,'http':s['counts']['http'],'unknown':2}))
elif mode=='terminate':
 s=state();prior=load(W/'admission-frozen.json')['snapshot'];assert s['identity']==prior['identity'] and s['generation']==prior['generation'] and s['phase']=='DRAINING' and s['counts']==prior['counts'];idle(s);protected()
 assert not (W/'termination-issued.json').exists(),'Prior termination issued; inspect instead of retry'
 z=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',str(W/'process-handle.ps1'),'-Mode','Terminate'],capture_output=True)
 assert z.returncode==0,'Exact termination unconfirmed; inspect receipts, do not resend'
 assert load(W/'termination-completed.json')['exactHandleExited'];absent();protected()
 print(json.dumps({'exactHandleExited':True,'pid':7156,'treeKill':False,'knowledgePid':600,'canonicalLockRetainedInPlace':True}))
elif mode=='install':
 assert load(W/'termination-completed.json')['exactHandleExited'];absent();protected()
 assert not (W/'installed.json').exists()
 for t in ['cli','worker']:
  proof=load(W/(t+'-build.json'));assert proof['baselineByteIdentical']
  name='creator-ai' if t=='cli' else 'knowledge-worker'
  assert sha(W/'candidate'/(name+'.js'))==proof['candidate']['jsSha256'] and sha(W/'candidate'/(name+'.js.map'))==proof['candidate']['mapSha256']
 for n in NAMES:
  stage=I/(n+'.startup-reader-candidate');assert not stage.exists()
  with stage.open('xb') as f:f.write((W/'candidate'/n).read_bytes());f.flush();os.fsync(f.fileno())
  os.replace(stage,I/n)
 protected(installed=True)
 save('installed.json',{'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':{n:sha(I/n) for n in NAMES},'daemonAndStaticUnchanged':True,'otherRuntimeFilesPreserved':len(C['runtime'])-4,'knowledgePid':600})
 print(json.dumps({'installed':True,'files':4,'otherRuntimePreserved':len(C['runtime'])-4,'daemonAndStaticUnchanged':True,'knowledgePid':600}))
elif mode=='verify':
 protected(installed=True,afterstart=True);s=state(old=False);assert s['identity']['pid']!=7156 and s['phase']=='OPEN';idle(s)
 captured=load(W/'captured.json');lock=D/captured['canonicalName'];retained=Path(str(lock)+'.retained-'+captured['canonicalSha256'])
 assert sha(retained)==captured['canonicalSha256'] and retained.stat().st_ino==captured['canonicalInode']
 current=load(lock);assert current['schemaVersion']==2 and current['owner']['daemonIdentity']==s['identity']
 history=request('/v1/daemon/native-history');assert history['historicalUnknownCount']==2 and history['archivedUnknownCount']==0 and history['quiescenceEvidence']==[]
 save('runtime-result.json',{'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'oldPid':7156,'newIdentity':s['identity'],'phase':s['phase'],'counts':s['counts'],'unknown':2,'canonicalSingleWriterLockSchema':2,'oldLockSameBytesAndFileObjectRetained':True,'quiescenceEvidence':0,'shared22Preserved':True,'business9TablesPreserved':True,'otherRuntime308Preserved':True,'knowledgeService':service(),'computerRestarted':False})
 print(json.dumps({'ok':True,'pid':s['identity']['pid'],'phase':s['phase'],'unknown':2,'knowledgePid':600,'retainedCanonicalLock':True}))
else:raise RuntimeError('Unknown mode')
