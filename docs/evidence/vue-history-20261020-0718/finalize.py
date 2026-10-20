from pathlib import Path
import json,hashlib,datetime
R=Path('D:/code/shidai3/P8000/companion-next');W=Path(__file__).parent
E=R/'docs/evidence/vue-history-20261020-0718'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
first=load(W/'vitest-first-attempt.json');follow=load(W/'vitest-filter-followup.json')
firstTests={a['fullName']:a for t in first['testResults'] for a in t['assertionResults']}
followTests={a['fullName']:a for t in follow['testResults'] for a in t['assertionResults']}
proof=[]
for name,a in firstTests.items():
 final=followTests[name] if followTests[name]['status']=='passed' else a
 assert final['status']=='passed'
 proof.append({'name':name,'status':'passed','evidence':'followup' if followTests[name]['status']=='passed' else 'first-attempt'})
assert len(proof)==4
old=Path('D:/code/shidai3/P8000/cocos-mcp/web/src/app.ts');lines=old.read_text(encoding='utf-8').splitlines()
source={
 'oldUi':{'path':str(old),'sha256':sha(old),'contractLines':{'callRendering':'2053-2095','pageTransport':'2098-2128','filterAndMore':'2131-2153','logClear':'2507-2518','logDiagnostics':'3507-3525'}},
 'newSource':{n:sha(R/n) for n in ['src/adapters/companion-browser.ts','src/stores/companion-browser.ts','src/components/LogTools.vue','src/adapters/log-tools.ts','src/stores/log-tools.ts','tests/call-history-page-migration.test.ts','tests/log-tools-ui.test.ts','tests/log-tools-adapter.test.ts']},
 'contractComparison':[
  {'feature':'call pages','legacy':'GET limit=50; status=failed optional; before exclusive server cursor','vue':'same endpoint, query shape and actual decoder; full DOM event path verified'},
  {'feature':'call detail','legacy':'escaped text summaries, status label, preserves opened same-ID details','vue':'summaries escaped; same-key opened detail retained in actual page append; raw status label difference reported for root fix'},
  {'feature':'clear logs','legacy':'DELETE /api/logs with selected projectId repeated; text/source/level do not scope deletion','vue':'same contract, explicit frozen confirmation; stale filter/identity invalidation, unknown-delivery lock; existing isolated tests reviewed, not rerun by this unit'},
  {'feature':'diagnostic','legacy':'POST /api/projects/id/diagnostic; log project then last preview then first project','vue':'same target priority/POST; source-bound receipt, escaped/redacted result and local save; existing isolated UI/adapter tests reviewed, not rerun by this unit'},
 ]
}
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Vue migration: history/log page contracts and isolated interactions','newScenarios':proof,'newScenariosPassed':4,'attempts':{'first':{'passed':2,'testSelectorFailures':2},'followup':{'passed':2,'earlierPassedNotRepeated':2}},'sourceChangesByThisUnit':0,'newTestFiles':['tests/call-history-page-migration.test.ts'],'newSourceDefectReportedToRoot':{'file':'src/views/CompanionBrowserView.vue','lineAtAudit':159,'difference':'raw English status instead of old Chinese label','owner':'root'},'productionToolCalls':0,'productionHistoryWrites':0,'productionLogDeletes':0,'desktopActions':0,'serviceActions':0,'migrationConclusion':{'10':'Vue log-tools contract covered by existing isolated confirmation/error/receipt tests and exact old endpoint comparison; no requirement to delete production logs','11':'Vue page migration isolated pagination/detail/filter/retry/stale-read coverage passed; no natural >=51 history required for this conclusion'},'integrationEvidenceBoundary':{'naturalSecondPage':'not run: previous real snapshot 19 records; independent production integration evidence gap, not frontend migration blocker','naturalFailedDetails':'previous actual deployed UI verification retained; not repeated'},'notes':['First two filter failures were test selector mismatches; no product defect inferred','No full-suite rerun; parent may run affected view tests after its status label change']}
E.mkdir(exist_ok=False)
for name in ['vitest-first-attempt.json','vitest-filter-followup.json','fix-selector.py','finalize.py']:(E/name).write_bytes((W/name).read_bytes())
(E/'contract-audit.json').write_text(json.dumps(source,indent=2)+'\n',encoding='utf-8',newline='\n')
(E/'result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
(E/'sha256.json').write_text(json.dumps({p.name:sha(p) for p in E.iterdir() if p.is_file()},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'newScenariosPassed':4,'productionMutations':0,'evidenceFiles':6,'migrationHistoryPage':'passed isolated frontend contract','sourceDefectHandedToRoot':'Chinese status labels'}))
