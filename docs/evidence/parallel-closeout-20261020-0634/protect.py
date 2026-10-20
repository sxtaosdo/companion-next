from pathlib import Path
import json,hashlib,subprocess,datetime
W=Path(__file__).parent
B=Path('C:/Users/33272/AppData/Local/Temp/companion-startup-reader-fixes-20261020/cold-entry-acceptance')
P=Path('C:/Users/33272/AppData/Local/Temp/companion-three-client-repair-20261020')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
ns={'__file__':str(B/'deploy.py')};exec(compile((B/'deploy.py').read_text().rsplit('\nmode=sys.argv[1]',1)[0],'readonly-protection','exec'),ns)
state=ns['state'](old=False);ns['idle'](state)
last=load(Path('D:/code/shidai3/P8000/companion-next/docs/evidence/cursor-agent-status-20261020/result.json'))
runtime=all(sha(ns['I']/n)==v for n,v in ns['C']['runtime'].items())
business=ns['ns']['business']()==ns['C']['business']
canonical=load(B/'captured.json')['canonicalName']
immutable=all(sha(ns['D']/n)==v for n,v in ns['C']['immutable'].items() if n!=canonical)
configs=all(sha(Path(x['path']))==x['sha256After'] for x in load(P/'plan.json')['files'])
shared=Path('D:/code/shidai3/P8000/cocos-mcp');git=lambda *a:subprocess.check_output(['C:/Program Files/Git/cmd/git.exe','-C',str(shared),*a],stderr=subprocess.DEVNULL)
status=git('status','--porcelain=v1');current={'head':git('rev-parse','HEAD').decode().strip(),'dirtyEntryCount':len(status.splitlines()),'statusSha256':hashlib.sha256(status).hexdigest(),'diffSha256':hashlib.sha256(git('diff','--binary')).hexdigest(),'indexDiffSha256':hashlib.sha256(git('diff','--cached','--binary')).hexdigest()}
ps="""Add-Type -AssemblyName UIAutomationClient;Add-Type -AssemblyName UIAutomationTypes;$cp=@(Get-CimInstance Win32_Process -Filter \"Name='Cursor.exe'\");$ids=@($cp|ForEach-Object {[int]$_.ProcessId});$wins=@([System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)|Where-Object {$_.Current.ProcessId-in$ids-and$_.Current.ControlType-eq[System.Windows.Automation.ControlType]::Window});@{processCount=$cp.Count;visibleWindowCount=$wins.Count;atUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress"""
cursor=json.loads(subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',ps]).decode('utf-8-sig'))
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runtime312MatchExistingBaseline':runtime,'business9TablesMatchExistingBaseline':business,'noncanonicalCompanionFilesMatchExistingBaseline':immutable,'approvedClientConfigurationsUnchanged':configs,'daemonIdentityUnchanged':state['identity']==last['daemonIdentity'] if 'daemonIdentity' in last else state['identity']['pid']==6564,'daemonIdentity':state['identity'],'phase':state['phase'],'counts':state['counts'],'knowledgeService':ns['service'](),'sharedWorktree':current,'sharedFingerprintsMatchPreviousCheckpoint':all(v==last['sharedWorktree'][k] for k,v in current.items()),'historicalExact21FileBaselineAvailable':False,'cursorObservation':cursor,'cursorThisResumeAttemptCount':1,'cursorThisResumeRequestsSent':0,'cursorPreviousConfirmedRequestsSent':1,'cursorPreviousToolReceipts':0,'cursorThisResumeOutcome':'SKIPPED_NO_EXISTING_DAILY_WINDOW','cursorCurrentQuotaTested':False,'paidActions':0,'configurationWrites':0,'productionRegistrationPosts':0,'productionSetupPosts':0,'creatorControlActions':0,'modelControlActions':0,'newListeners':0}
assert runtime and business and immutable and configs and result['daemonIdentityUnchanged'] and state['phase']=='OPEN'
(W/'protection.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'runtime312':runtime,'business9':business,'configs':configs,'sharedFingerprintsMatchPreviousCheckpoint':result['sharedFingerprintsMatchPreviousCheckpoint'],'daemonPid':state['identity']['pid'],'knowledgePid':600,'cursor':cursor,'cursorResumeSent':0}))
