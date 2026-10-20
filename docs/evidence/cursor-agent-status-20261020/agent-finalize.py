from pathlib import Path
import json, hashlib, subprocess, datetime
W=Path(__file__).parent
R=Path('D:/code/shidai3/P8000/companion-next')
E=R/'docs/evidence/cursor-agent-status-20261020'
B=Path('C:/Users/33272/AppData/Local/Temp/companion-startup-reader-fixes-20261020/cold-entry-acceptance')
P=Path('C:/Users/33272/AppData/Local/Temp/companion-three-client-repair-20261020')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
observed=load(W/'agent-status-observed.json'); issued=load(W/'agent-status-send-issued.json')
texts=[r['name'] for r in observed['controls']]
assert issued['sendAttempts']==1 and issued['requestedCalls']==1 and observed['sendMarkerExists']
assert 'Weekly usage limit reached. It resets in 1 day.' in texts
assert 'Buy credits to keep going now, or upgrade your plan for more weekly usage.' in texts
assert sum(t.startswith('One-shot MCP connection acceptance.') for t in texts)==1
plan=load(P/'plan.json')
config_unchanged=all(sha(Path(f['path']))==f['sha256After'] for f in plan['files'])
assert config_unchanged
ns={'__file__':str(B/'deploy.py')}
exec(compile((B/'deploy.py').read_text().rsplit('\nmode=sys.argv[1]',1)[0],'readonly-protection','exec'),ns)
state=ns['state'](old=False); previous=load(W/'result.json')
assert state['identity']==previous['daemonIdentity'] and state['phase']=='OPEN'; ns['idle'](state)
runtime_ok=all(sha(ns['I']/name)==value for name,value in ns['C']['runtime'].items())
business_ok=ns['ns']['business']()==ns['C']['business']
canonical=load(B/'captured.json')['canonicalName']
immutable_ok=all(sha(ns['D']/name)==value for name,value in ns['C']['immutable'].items() if name!=canonical)
assert runtime_ok and business_ok and immutable_ok
service=ns['service']()
shared=Path('D:/code/shidai3/P8000/cocos-mcp')
git=lambda *args:subprocess.check_output(['C:/Program Files/Git/cmd/git.exe','-C',str(shared),*args],stderr=subprocess.DEVNULL)
status=git('status','--porcelain=v1')
shared_current={'head':git('rev-parse','HEAD').decode().strip(),'dirtyEntryCount':len(status.splitlines()),'statusSha256':hashlib.sha256(status).hexdigest(),'diffSha256':hashlib.sha256(git('diff','--binary')).hexdigest(),'indexDiffSha256':hashlib.sha256(git('diff','--cached','--binary')).hexdigest()}
shared_equal=all(v==previous['sharedWorktree'][k] for k,v in shared_current.items())
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dailyCursorPid':23912,'requestSendCount':1,'targetServer':issued['target'],'requestedTool':'project_get_status','arguments':{},'actualToolReceiptCount':0,'status':'BLOCKED_WEEKLY_USAGE_LIMIT','uiMessages':[t for t in texts if 'Weekly usage limit' in t or 'Buy credits to' in t],'requestVisibleInExistingConversation':True,'retryCount':0,'paymentOrUpgradeClicked':False,'newPermissionOrLoginActions':0,'configurationBytesUnchanged':config_unchanged,'daemonIdentityUnchanged':True,'phase':state['phase'],'counts':state['counts'],'runtime312Unchanged':runtime_ok,'business9TablesUnchanged':business_ok,'noncanonicalCompanionFilesUnchanged':immutable_ok,'knowledgeService':service,'sharedWorktree':shared_current,'sharedFingerprintsMatchPreviousCheckpoint':shared_equal,'historicalExact21FileBaselineAvailable':False,'creatorControlActions':0,'windowLeftOpen':True,'matrixCountsUnchanged':'13 passed / 6 partial / 2 paused','remaining':'Actual Cursor tool invocation is unverified. No further attempt is authorized by this result; no paid action was taken.'}
E.mkdir(exist_ok=False)
for name in ['agent-status-once.ps1','agent-status-prompt.txt','agent-status-send-issued.json','agent-status-observed.json','agent-finalize.py']:
 (E/name).write_bytes((W/name).read_bytes())
(E/'result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
(E/'sha256.json').write_text(json.dumps({p.name:sha(p) for p in E.iterdir() if p.is_file()},indent=2)+'\n',encoding='utf-8',newline='\n')
doc='''# Cursor one-shot project status acceptance, 2026-10-20

The one authorized Agent request was sent exactly once in the existing normal Cursor window (PID 23912). Its existing conversation is titled **MCP connection acceptance**. The exact request only permits `project_get_status {}` on `cocos-creator-cocos-214a2184`, then stop; it prohibits other tools/servers, file reads or writes, shell, Creator/model/service management, retries and automatic continuation. No source files were attached. The cook server was not invoked.

The UI accepted the request but immediately returned **Weekly usage limit reached. It resets in 1 day.** It also displayed **Buy credits to keep going now, or upgrade your plan for more weekly usage.** There is no actual tool result. Status: **BLOCKED_WEEKLY_USAGE_LIMIT**, actual tool receipts: **0**. No retry, credit purchase, plan upgrade, login or permission action was taken. The existing window remains open. No automatic future run was scheduled.

The earlier successful connection/discovery checks remain valid: cocos and cook each Connected with 117 tools. The Codex actual readonly call passed previously. Cursor's actual business invocation remains unverified; the earlier absence of a no-Agent tool execution button is no longer the immediate blocker after this bounded approval. The current blocker is the account's displayed weekly usage limit. This is a client quota result, not evidence that MCP or project status failed.

Preparation guards prevented sending malformed drafts. UIAutomation SetValue did not populate the composer; direct keyboard text was altered by the active IME and failed exact-content verification. Only this task's own unsent draft was replaced with the exact request through normal paste, preserving the prior clipboard in memory. A durable exclusive send-issued marker was written before the single Enter action. The visible request and quota message confirm delivery; the request must not be resent because its status is already known.

Postchecks: both repaired client configuration files match their approved hashes; daemon PID 6564 and identity remain unchanged, OPEN and idle with the existing two native-epoch unknowns; knowledge PID 600 remains healthy. All 312 runtime files, nine business-table fingerprints, and noncanonical Companion files match prior protection checkpoints. Shared-source HEAD/status/diff/index fingerprints are recorded and compared with the immediately preceding checkpoint in result.json; the historical exact 21-file Temp baseline remains unavailable. No shared source or external Creator was controlled or edited.

The parity matrix remains **13 passed / 6 partial / 2 paused**. This attempt does not close installation wizard combinations, formal registration, natural history pagination/failure details, production log clearing, resources' paused model path, or other paused Agent/model work. Any later retry should occur only after the quota permits it and with the user's applicable authorization; no purchase or subscription change is required by this task.

[Exact evidence and protection results](evidence/cursor-agent-status-20261020/result.json) · [Visible UI receipt](evidence/cursor-agent-status-20261020/agent-status-observed.json) · [Previous connection acceptance](cursor-daily-acceptance-20261020.md)
'''
(R/'docs/cursor-agent-status-20261020.md').write_text(doc,encoding='utf-8',newline='\n')
notice=b'2026-10-20 Cursor actual-call update: one authorized project_get_status-only Agent request was sent once. Cursor returned Weekly usage limit reached / Buy credits or Upgrade Plan before any tool receipt. STOPPED, no retry or paid action; actual Cursor business invocation remains unverified. Matrix remains 13/6/2. [Evidence and remaining blocker](cursor-agent-status-20261020.md).\n\n'
for name in ['cursor-daily-acceptance-20261020.md','three-client-repair-20261020.md','partial-six-remaining-20261020.md','parity-matrix-20261020.md','migration-next-tasks-20261019.md']:
 p=R/'docs'/name;p.write_bytes(notice+p.read_bytes())
p=R/'.gitattributes';p.write_bytes(p.read_bytes()+b'\ndocs/evidence/cursor-agent-status-20261020/** -text -whitespace\n')
print(json.dumps({'sentOnce':True,'toolReceipts':0,'blocked':'WEEKLY_USAGE_LIMIT','configurationUnchanged':True,'runtime312Unchanged':runtime_ok,'business9TablesUnchanged':business_ok,'sharedFingerprintsMatchPreviousCheckpoint':shared_equal,'daemonPid':6564,'knowledgePid':600,'matrix':'13/6/2'}))
