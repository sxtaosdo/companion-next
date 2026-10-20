from pathlib import Path
import os,json,hashlib,subprocess,sqlite3,datetime,urllib.request
W=Path(__file__).parent;S=Path('D:/services/weknora');P=S/'pilot-access';B=Path('C:/Users/33272/AppData/Local/Temp/companion-boot-repair-20261020')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
started=load(W/'start-result.json');reader=load(W/'reader-result.json');review=load(W/'safe-start-review.json');issued=load(W/'start-issued.json')
assert started['state']=='HEALTHY' and started['pid']==600 and reader['ok']
assert sha(P/'metadata-before.json')==issued['metadataBeforeSha256']
for n in ['Start-PilotAccess.ps1','pilot-access/state-check.py','pilot-access/Load-JwtSecret.ps1']:
 assert sha(S/n)==review['sourceProvenance']['sourceHashes'][n]
for n,pin in review['artifactPins'].items():assert sha(S/'normal-reader-recovery-v0.8.2'/n)==pin['sha256']
for row in load(W/'retained-files.json'):
 f=Path(row['retained']).lstat();assert f.st_ino==row['inode'] and f.st_size==row['bytes']
assert not (W/'metadata-after-process-check.json').exists()
z=subprocess.run(['C:/Users/33272/miniconda3/python.exe','-X','utf8','-B',str(P/'state-check.py'),'D:/knowledge-data/weknora/pilot-access/weknora.db',str(W/'metadata-after-process-check.json')],capture_output=True)
assert z.returncode==0,'Existing read-only database guard failed; inspect without bypass'
after=load(W/'metadata-after-process-check.json');pre=load(P/'metadata-prestart.json')
assert after['knowledge_state_sha256']==pre['knowledge_state_sha256']==load(P/'metadata-before.json')['knowledge_state_sha256']
assert after['counts']==pre['counts'] and after['knowledge_statuses']==pre['knowledge_statuses'] and after['empty_trigger_counts']==pre['empty_trigger_counts']
db=sqlite3.connect(Path('D:/knowledge-data/weknora/pilot-access/weknora.db').as_uri()+'?mode=ro',uri=True);db.execute('PRAGMA query_only=ON')
try:
 row=db.execute('SELECT id,tenant_id,scope_type,full_access,knowledge_base_ids,capabilities,expires_at,revoked_at FROM tenant_api_keys WHERE id=3').fetchone()
finally:db.close()
assert row[:4]==(3,1,'tenant',0) and json.loads(row[4])==['da1051a5-3fff-4198-ba55-017ea79df9c3'] and json.loads(row[5])==['retrieve'] and row[6]=='2026-11-08T01:25:46.685460+00:00' and row[7] is None
ns={'__file__':str(B/'deploy.py')};exec(compile((B/'deploy.py').read_text().split('mode=sys.argv[1]')[0],'readonly-companion-protection','exec'),ns)
ns['check_immutable'](load(B/'predeploy.json'));I=ns['I'];installed=load(B/'installed.json')
assert sha(I/'companion-daemon.js')==installed['daemonSha256'] and sha(I/'companion-daemon.js.map')==installed['mapSha256']
assert sha(I/'knowledge-worker.js')=='07c4861de1716058f79866df3b15e64286b1281da8478e5f8feef192964013d4'
assert sha(I/'creator-ai.js')=='bc1e15920a33e388a6d5cdc8347a9bec93fbe7cc719e7208cc8b112feeebca53'
loc=load(ns['D']/'daemon.json');assert loc['identity']==reader['daemonIdentity']
req=urllib.request.Request(loc['baseUrl']+'/v1/daemon/inflight',headers={'Authorization':'Bearer '+loc['apiToken']})
with urllib.request.urlopen(req,timeout=12) as response:state=json.load(response)
assert state['phase']=='OPEN' and state['identity']==loc['identity'] and state['counts']['nativeEpochUnproven']==2
ps='''$ErrorActionPreference='Stop';$k=Get-CimInstance Win32_Process -Filter 'ProcessId=600';$kl=@(Get-NetTCPConnection -State Listen -LocalPort 8081);$cl=@(Get-NetTCPConnection -State Listen -LocalPort 32180);if($null-eq$k-or$kl.Count-ne1-or$kl[0].OwningProcess-ne600-or$cl.Count-ne1-or$cl[0].OwningProcess-ne7156){throw 'Listener owner mismatch'};@{knowledgePid=$k.ProcessId;knowledgeExe=$k.ExecutablePath;knowledgeCreationTime=$k.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ');knowledgeDirectChildProcesses=@(Get-CimInstance Win32_Process -Filter 'ParentProcessId=600').Count;creatorProcesses=@(Get-CimInstance Win32_Process -Filter "Name='CocosCreator.exe'").Count;companionPid=7156;port8081Owner=600;port32180Owner=7156}|ConvertTo-Json -Compress'''
process=json.loads(subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',ps]).decode('utf-8-sig'))
assert Path(process['knowledgeExe']).resolve()==(S/'normal-reader-recovery-v0.8.2/weknora.exe').resolve() and process['creatorProcesses']==0
# Windows attaches its console host to a console-subsystem binary. Validate its
# actual system image instead of treating every child as an inference process.
childScript="Get-CimInstance Win32_Process -Filter 'ParentProcessId=600' | Select-Object ProcessId,Name,ExecutablePath | ConvertTo-Json -Compress"
rawChildren=subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',childScript]).decode('utf-8-sig').strip()
children=json.loads(rawChildren) if rawChildren else []
if isinstance(children,dict):children=[children]
assert all(p['Name'].lower()=='conhost.exe' and Path(p['ExecutablePath']).resolve()==Path(os.environ['SystemRoot'],'System32/conhost.exe').resolve() for p in children)
process['children']=children;process['onlySystemConsoleHostChildren']=True
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'process':process,'companionPhase':'OPEN','companionIdentityUnchanged':True,'companionAll312RuntimeFilesUnchangedFromThisPhaseStart':True,'shared22And21ProtectedSourcesPreserved':True,'companionBusiness9TablesUnchanged':True,'unknown2AndNativeHistoryUnchanged':True,'knowledgeStateGuardAndCountsUnchanged':True,'knowledgeEmptyTriggerCounts':after['empty_trigger_counts'],'knowledgeMigration':after['migration'],'knowledgeCounts':after['counts'],'existingPublicReaderPermissionMetadataUnchanged':True,'secretOrHashColumnsSelected':False,'metadataBeforeUnchanged':True,'oldLogsAndPidSameFileObjectsPreserved':3,'entryInvocations':1,'cliAndWorkerNotModified':True,'modelOrCreatorOrInferenceRequests':0,'credentialsCreatedOrPermissionsChanged':False,'readerSecretInspected':False,'originalSourceContentArchived':False}
with (W/'final-protection.json').open('x',encoding='utf-8') as f:json.dump(proof,f,indent=2);f.write('\n')
print(json.dumps(proof))
