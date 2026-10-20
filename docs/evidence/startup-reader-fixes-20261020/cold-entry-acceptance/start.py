from pathlib import Path
import json,subprocess,hashlib,datetime,time,os,tempfile
W=Path(__file__).parent;D=Path(os.environ['APPDATA'])/'Creator AI Companion'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
assert load(W/'termination-completed.json')['exactHandleExited']
with (W/'start-issued.json').open('x',encoding='utf-8') as f:json.dump({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'entry':'connect-knowledge-reader.ps1 -StartOnly -NoBrowser','invocations':1,'scope':'NO_CODE_CHANGE_CONTROLLED_COLD_ACCEPTANCE','observer':'process.wait + temporary files; no pipe EOF','computerRestart':False},f,indent=2);f.flush();os.fsync(f.fileno())
begin=time.monotonic()
with tempfile.TemporaryFile('w+b') as output,tempfile.TemporaryFile('w+b') as error:
 p=subprocess.Popen(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File','D:/code/shidai3/P8000/companion-next/scripts/connect-knowledge-reader.ps1','-StartOnly','-NoBrowser'],stdout=output,stderr=error)
 try:code=p.wait(timeout=55)
 except subprocess.TimeoutExpired:code=None
 elapsed=round((time.monotonic()-begin)*1000,3)
 output.seek(0);out=output.read(1024*1024);error.seek(0);err=error.read(1024*1024)
 identity=load(D/'daemon.json')['identity']
 result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'entryPid':p.pid,'entryExitCode':code,'elapsedMs':elapsed,'passedReceipt':b'PASSED' in out,'stdoutBytes':len(out),'stderrBytes':len(err),'stdoutSha256':hashlib.sha256(out).hexdigest(),'newIdentity':identity,'newOwnerObserved':identity!=load(W/'checkpoint.json')['identity'],'startInvocations':1,'codeOrRuntimeChanges':0,'processKilled':False,'rawOutputArchived':False,'observerWaitsForExactEntryExit':True}
with (W/'start-result.json').open('x',encoding='utf-8') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
if code!=0 or not result['passedReceipt'] or not result['newOwnerObserved']:raise SystemExit(1)
