from pathlib import Path
import json,hashlib,datetime
W=Path(__file__).parent;R=Path('D:/code/shidai3/P8000/companion-next')
E=R/'docs/evidence/vue-setup-20261020-0718'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
after=load(W/'after-fix.json');before=load(W/'before-fix.json')
assert before['numFailedTests']==2 and after['numFailedTests']==0 and after['numPassedTests']==66
old=Path('D:/code/shidai3/P8000/cocos-mcp/web/src/app.ts');html=old.parent.parent/'index.html'
out={
 'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'Vue registration/setup UI migration; inherited host execution and external client sessions are independent integration evidence',
 'legacyReadOnlySources':{str(old):sha(old),str(html):sha(html)},
 'legacyBindings':{
  'registration':{'sourceLines':'2451-2487','path':'/api/projects/{projectId}/mcp/register','method':'POST','bodyKeys':['target'],'resultFields':['name','changed','command','args','configPath'],'allFiveTargetsPreserved':True},
  'setup':{'sourceLines':'377-415, 3180-3247','legacyPath':'/api/setup','bodyFields':['projectId or projectPath','startCreator','configureCodex'],'vueStrictOptionsRoute':'/api/setup/options-v1','strictOptionsAcceptedAsExistingApprovedHostContract':True},
  'completion':{'htmlLines':'424-434','usageControls':['readonly prompt','wrap toggle','copy','close'],'vueControlsPreserved':True}
 },
 'vueDefect':{'trigger':'Cancel a draft path for project A, then open installation from registered project B card','before':'Step 1 retained project A path while installation selection targeted B','after':'A known explicit card ID binds both path and selected project; absent ID opens nothing; empty add entry preserves existing cancelled draft behavior','unknownIdNeverFallsBack':True},
 'changedFiles':{n:sha(R/n) for n in ['src/components/ProjectSetupWizard.vue','tests/project-setup-ui.test.ts']},
 'beforeRegression':{'exitCode':1,'failedNewTests':2},
 'afterRegression':{'exitCode':0,'passedTests':66,'failedTests':0,'files':[{'file':x['name'],'passed':sum(a['status']=='passed' for a in x['assertionResults'])} for x in after['testResults']]},
 'migrationAssessment':{
  '5':{'vueContract':'passed for reviewed flows','evidence':'Four 00/10/01/11 strict-option UI cases in the affected full UI test file verify confirmation, exact flags, accepted task status/completion and conditional usage. Cancel/unknown/no-replay/failed receipt and native directory late-result cases remain covered.','productionIntegration':'01/11 not executed; host writer defects and Creator operation restrictions do not invalidate isolated Vue migration evidence.'},
  '13':{'reviewedSubscope':'Setup completion usage retains old prompt, wrap/copy and close controls. External Cursor start, real Agent call and quota are outside Vue migration gate.','wholeCliUseAssessment':'Root should combine existing CliUseDialog/handoff evidence; this unit did not modify or invoke external handoff.'},
  '14':{'vueContract':'Five client choices, exact target/project binding, explicit confirmation, serial batch/cancel/unknown guards and source-bound receipts are retained. Existing test contract/source audit covers these; no new external client execution is required to prove the chooser migration.','productionIntegration':'Host writer regression is tracked independently; this unit did not change it or run registration POST.'}
 },
 'productionActions':{'registrationPosts':0,'setupPosts':0,'configurationWrites':0,'creatorOrModelActions':0,'externalClientActions':0,'oldHostWrites':0},
 'deployed':False,'gitCommittedByThisUnit':False
}
(W/'result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
E.mkdir(exist_ok=False)
for n in ['add-regressions.py','fix-context.py','edit-result.json','before-fix.json','after-fix.json','result.json','finalize.py']:(E/n).write_bytes((W/n).read_bytes())
(E/'sha256.json').write_text(json.dumps({p.name:sha(p) for p in E.iterdir() if p.is_file()},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'newVueDefectFixed':True,'beforeFailed':2,'afterPassed':66,'changedSourceFiles':2,'productionWrites':0,'deployed':False}))
