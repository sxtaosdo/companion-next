from pathlib import Path
import os,json,hashlib,subprocess,datetime,uuid,stat,time,urllib.request
W=Path(__file__).parent;S=Path('D:/services/weknora');P=S/'pilot-access'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def save(name,obj):
 with (W/name).open('x',encoding='utf-8') as f:json.dump(obj,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
reviewPath=Path('C:/Users/33272/AppData/Local/Temp/companion-reader403-readonly-20261020/safe-start-review.json')
assert sha(reviewPath)=='a4f6f264c0d5bff1074c1dd56273d411638ff1dd0d9336cafe881cf7167eb9be'
review=load(reviewPath);assert review['safeToStartKnowledgeOnly']
for n in ['Start-PilotAccess.ps1','pilot-access/state-check.py','pilot-access/Load-JwtSecret.ps1','build/reader-recovery-v0.8.2/deployment-evidence.json']:
 assert sha(S/n)==review['sourceProvenance']['sourceHashes'][n]
for n,b in review['artifactPins'].items():assert sha(S/'normal-reader-recovery-v0.8.2'/n)==b['sha256']
assert not (W/'start-issued.json').exists(),'Already issued; inspect before any retry'
ps='''$ErrorActionPreference='Stop';$l=@(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue);$w=@(Get-CimInstance Win32_Process -Filter "Name='weknora.exe'");$c=@(Get-NetTCPConnection -LocalPort 32180 -State Listen);if($l.Count-or$w.Count-or$c.Count-ne1-or$c[0].OwningProcess-ne7156){throw 'Unexpected owner'};'VERIFIED' '''
z=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',ps],capture_output=True)
assert z.returncode==0 and z.stdout.strip()==b'VERIFIED','Pre-start owner state unconfirmed'
(W/'safe-start-review.json').write_bytes(reviewPath.read_bytes())
beforeSha=sha(P/'metadata-before.json')
save('start-issued.json',{'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'entry':str(S/'Start-PilotAccess.ps1'),'scope':'EXISTING_KNOWLEDGE_ONLY','reviewSha256':sha(reviewPath),'companionPidPreserved':7156,'metadataBeforeSha256':beforeSha,'modelStartsAuthorized':False,'credentialOrPermissionChangesAuthorized':False,'issuedOnce':True})
retained=[];suffix='.retained-before-companion-20261020-'+str(uuid.uuid4())
for n in ['server.stdout.log','server.stderr.log','server.pid']:
 source=P/n
 if not source.exists():continue
 info=source.lstat();assert stat.S_ISREG(info.st_mode) and info.st_nlink==1 and not (info.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT)
 target=P/(n+suffix);assert source.resolve().parent==P.resolve() and target.resolve().parent==P.resolve() and not target.exists()
 save('retain-issued-'+n+'.json',{'source':str(source),'target':str(target),'bytes':info.st_size,'inode':info.st_ino,'contentRead':False})
 os.rename(source,target)
 after=target.lstat();assert after.st_ino==info.st_ino and after.st_size==info.st_size
 retained.append({'source':str(source),'retained':str(target),'bytes':info.st_size,'inode':info.st_ino,'sameFileObject':True,'contentRead':False})
save('retained-files.json',retained)
assert sha(P/'metadata-before.json')==beforeSha
cmd=['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(S/'Start-PilotAccess.ps1')]
save('entry-invocation-issued.json',{'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'entry':cmd[-1],'invocations':1,'existingProcessScopedOptions':True})
with (W/'entry-private-output.txt').open('xb') as output:
 child=subprocess.Popen(cmd,stdout=output,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
 try:code=child.wait(timeout=45)
 except subprocess.TimeoutExpired:
  save('start-result.json',{'state':'UNCONFIRMED','entryProcessPid':child.pid,'entryReturned':False,'noTerminationOrRetry':True});print('ENTRY_STILL_PENDING_NO_RETRY');raise SystemExit(2)
assert sha(P/'metadata-before.json')==beforeSha
if code!=0:
 save('start-result.json',{'state':'ENTRY_FAILED','entryExit':code,'privateOutputInspected':False,'noRetry':True});print('ENTRY_FAILED_INSPECT_GUARDS_NO_RETRY');raise SystemExit(1)
pidText=(P/'server.pid').read_text().strip();assert pidText.isdecimal();pid=int(pidText)
deadline=time.monotonic()+45;healthy=False
while time.monotonic()<deadline:
 try:
  with urllib.request.urlopen('http://127.0.0.1:8081/health',timeout=2) as response:healthy=response.status==200
 except Exception:pass
 if healthy:break
 time.sleep(.4)
state='HEALTHY' if healthy else 'UNCONFIRMED'
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'state':state,'pid':pid,'entryExit':code,'entryInvocations':1,'healthHttp':200 if healthy else None,'metadataBeforeUnchanged':True,'historicalLogsAndPidRetained':len(retained),'companionRestarted':False,'modelOrInferenceServicesStarted':False,'credentialsCreatedOrPermissionChanges':False,'persistentExecutionPolicyChanged':False}
save('start-result.json',result);print(json.dumps(result));raise SystemExit(0 if healthy else 2)
