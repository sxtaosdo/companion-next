from pathlib import Path
import json,hashlib,subprocess,datetime,time,os
W=Path(__file__).parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
assert load(W/'installed.json')['daemonAndStaticUnchanged']
with (W/'start-issued.json').open('x',encoding='utf-8') as f:json.dump({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'entry':'connect-knowledge-reader.ps1 -StartOnly -NoBrowser','invocations':1,'scope':'NEW_FULL_ENTRY_CANDIDATE_DEPLOYMENT','computerRestart':False},f,indent=2);f.flush();os.fsync(f.fileno())
begin=time.monotonic()
process=subprocess.Popen(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File','D:/code/shidai3/P8000/companion-next/scripts/connect-knowledge-reader.ps1','-StartOnly','-NoBrowser'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
 try:out,err=process.communicate(timeout=55)
 except subprocess.TimeoutExpired:
  with (W/'observation-55s.json').open('x',encoding='utf-8') as f:json.dump({'elapsedMs':round((time.monotonic()-begin)*1000,3),'entryPid':process.pid,'outcome':'PENDING','processKilled':False,'repeated':False},f,indent=2)
  out,err=process.communicate(timeout=55)
 result={'entryExitCode':process.returncode,'elapsedMs':round((time.monotonic()-begin)*1000,3),'stdoutSha256':hashlib.sha256(out).hexdigest(),'stderrBytes':len(err),'stdoutBytes':len(out),'passedReceipt':'PASSED' in out.decode('utf-8',errors='replace'),'rawOutputArchived':False,'repeated':False,'entryPid':process.pid}
except subprocess.TimeoutExpired:
 result={'entryOutcome':'UNKNOWN','elapsedMs':round((time.monotonic()-begin)*1000,3),'entryPid':process.pid,'repeated':False,'processKilled':False}
with (W/'start-result.json').open('x',encoding='utf-8') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
if result.get('entryExitCode')!=0 or not result.get('passedReceipt'):raise SystemExit(1)
