from pathlib import Path
import json,subprocess,sqlite3,os,hashlib,datetime,urllib.request,http.cookiejar
W=Path(__file__).parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
ns={'__file__':str(W/'deploy.py'),'__name__':'protection'};exec(compile((W/'deploy.py').read_text().rsplit('\nmode=sys.argv[1]',1)[0],'task-readonly-protection','exec'),ns)
ns['protected'](installed=True,afterstart=True);s=ns['state'](old=False);assert s['phase']=='OPEN';ns['idle'](s)
reader=load(W/'reader-result.json');assert reader['ok'] and reader['daemonIdentity']==s['identity']
out=W/('knowledge-metadata-after-'+str(len(list(W.glob('knowledge-metadata-after*.json')))+1)+'.json');assert not out.exists()
result=subprocess.run(['C:/Users/33272/miniconda3/python.exe','-X','utf8','-B','D:/services/weknora/pilot-access/state-check.py','D:/knowledge-data/weknora/pilot-access/weknora.db',str(out)],capture_output=True);assert result.returncode==0,'Read-only metadata guard failed'
after=load(out);before=load(Path('D:/services/weknora/pilot-access/metadata-prestart.json'))
for k in ['knowledge_state_sha256','counts','knowledge_statuses','empty_trigger_counts']:assert after[k]==before[k],k
db=sqlite3.connect(Path('D:/knowledge-data/weknora/pilot-access/weknora.db').as_uri()+'?mode=ro',uri=True);db.execute('PRAGMA query_only=ON')
row=db.execute('SELECT id,tenant_id,scope_type,full_access,knowledge_base_ids,capabilities,expires_at,revoked_at FROM tenant_api_keys WHERE id=3').fetchone();db.close()
row=[x.decode('utf-8') if isinstance(x,bytes) else x for x in row];assert row==ns['C']['readerPublicMetadata']
pid=s['identity']['pid']
script="""$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId=PID_VALUE';$l=@(Get-NetTCPConnection -State Listen -LocalPort 32180);$ds=@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\"|Where-Object {$_.CommandLine -eq '\"C:\\Program Files\\nodejs\\node.exe\" D:\\code\\shidai3\\P8000\\cocos-mcp\\mcp\\dist\\companion\\companion-daemon.js'});if($null-eq$p-or$l.Count-ne1-or$l[0].OwningProcess-nePID_VALUE-or$ds.Count-ne1){throw 'Companion owner mismatch'};@{pid=$p.ProcessId;created=$p.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ');executable=$p.ExecutablePath;port32180Owner=$l[0].OwningProcess;matchingDaemonProcesses=$ds.Count;creatorProcesses=@(Get-CimInstance Win32_Process -Filter \"Name='CocosCreator.exe'\").Count;knowledgeChildren=@(Get-CimInstance Win32_Process -Filter 'ParentProcessId=600'|Select-Object ProcessId,Name,ExecutablePath)}|ConvertTo-Json -Depth 4 -Compress""".replace('PID_VALUE',str(pid))
process=json.loads(subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',script]).decode('utf-8-sig'))
assert process['creatorProcesses']==0 and process['matchingDaemonProcesses']==1
assert all(x['Name'].lower()=='conhost.exe' and Path(x['ExecutablePath'])==Path(os.environ['SystemRoot'],'System32/conhost.exe') for x in process['knowledgeChildren'])
base='http://127.0.0.1:32180';asset='assets/index-Dx563SKg.js'
ticket=ns['request']('/v1/ui/session',{});assert ticket['url'].startswith(base+'/auth?code=')
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with opener.open(ticket['url'],timeout=10) as r:assert r.status==200
with opener.open(base+'/next/index.html',timeout=10) as r:assert r.status==200;page=r.read()
assert asset.encode() in page
with opener.open(base+'/next/'+asset,timeout=10) as r:assert r.status==200;assetsha=hashlib.sha256(r.read()).hexdigest()
assert assetsha=='b2b29887dbc1e62e9f25fd1856afac8dc49dc0d6232de12346b2e00e90b5eda9'
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'process':process,'companionPhase':'OPEN','knowledgeService':ns['service'](),'shared22And21ProtectedSourcesPreserved':True,'business9TablesUnchanged':True,'allRuntime312Unchanged':True,'canonicalLockAndUnknown2Preserved':True,'knowledgeStateGuardAndCountsUnchanged':True,'knowledgeCounts':after['counts'],'knowledgeEmptyTriggerCounts':after['empty_trigger_counts'],'readerPublicPermissionMetadataUnchanged':True,'readerSecretInspectedOrReplaced':False,'modelCreatorInferenceActions':0,'nextStaticHttp200':True,'nextAssetSha256':assetsha,'nextUiDeployedRevision':'1.3.173.146','docsCheckpoint':'cold acceptance / 1.3.173.165','noComputerRestart':True}
with (W/'final-protection.json').open('x',encoding='utf-8') as f:json.dump(proof,f,indent=2);f.write('\n')
print(json.dumps(proof))
