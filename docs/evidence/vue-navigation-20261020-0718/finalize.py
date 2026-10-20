from pathlib import Path
import json,hashlib,datetime
R=Path('D:/code/shidai3/P8000/companion-next');W=Path(__file__).parent
E=R/'docs/evidence/vue-navigation-20261020-0718';E.mkdir(exist_ok=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
green=load(W/'after-fix-node22.json');assert green['success'] and green['numPassedTests']==51 and green['numFailedTests']==0
old=Path('D:/code/shidai3/P8000/cocos-mcp/web/src/app.ts')
proof={
 'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'Vue navigation, explicit registered-project help context, migration status boundary copy',
 'oldUi':{'path':str(old),'sha256':sha(old),'helpProjectReadLines':'975-998','helpTopicSwitchLines':'2378-2400,3091-3123','primaryPageLines':'2853-2872','observations':['Help tool manager preserves selectedProjectId across category switches and reloads the explicitly chosen project','Primary projects/knowledge/models/icons pages map to Vue projects/knowledge/knowledge?tab=models/ai-icons; no external client execution is necessary to compare routes']},
 'sourceFiles':{n:sha(R/n) for n in ['src/views/HelpView.vue','src/views/MigrationView.vue','tests/help-project-context-navigation.test.ts']},
 'reproducedDefect':{'file':'src/views/HelpView.vue','trigger':'Enter tools via project card, switch help category, then return to tools','before':'choose() replaced query with topic only; explicit project binding was lost and requested-project reread was not restored','after':'choose() preserves project only, drops unrelated query; existing invalid-project checks still reject rather than falling back'},
 'newRegressionCases':6,
 'finalValidation':{'node':'D:/code/shidai3/P8000/dual-game-build/node_modules/node/bin/node.exe','nodeVersionFamily':'22','testFiles':[{'name':Path(r['name']).name,'passed':len(r['assertionResults'])} for r in green['testResults']],'passed':51,'failed':0,'vueChangesUnderTest':['HelpView.vue topic navigation','MigrationView.vue two-layer verification copy'],'parallelDomainChanges':'product-information.ts was separately owned and may have changed after this run loaded modules; this result does not claim final validation of subsequent domain text edits'},
 'preliminaryResults':{'beforeFix':'before-fix.json: four query/navigation regressions failed, ordinary passive help passed','afterFixNode25':'after-fix.json: Node25 localStorage.clear harness failures and two initial fixture failures (missing required core preset); not product defects','resolution':'Corrected local fixture to include both built-in presets and used existing documented Node22 runtime; all final 51 passed'},
 'vueMigrationConclusions':{'utilityNavigation':'Previously covered by existing suite; current adjacent suite passed','specificProjectHelpRoundtrip':'Passed by actual VueRouter and ToolPresetsReadPanel isolation','cancelLateReadOnTopicExit':'Passed; aborted signal and stale completion ignored','invalidOrRemovedProject':'Passed; explicit rejection retained and no fallback read','ordinaryHelp':'Passed; passive without explicit project request','migrationBoundary':'UI distinguishes Vue API/interaction evidence from inherited business availability'},
 'integrationLimits':['No claim of all 21 Vue areas passing from this navigation slice','No production deployment by this unit','No Cursor/Agent conversation, Creator, model, real configuration write, history mutation or real log deletion','Overview default real project behavior was inspected against existing registered-project tests; no additional runtime execution was required or claimed'],
 'productionMutations':0,'desktopActions':0,'oldHostWrites':0,'newListeners':0,'gitCommitsByThisUnit':0,
}
(W/'result.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
for name in ['before-fix.json','after-fix.json','after-fix-node22.json','source-change.json','result.json','fix.py','migration-copy.py','finalize.py']:(E/name).write_bytes((W/name).read_bytes())
(E/'sha256.json').write_text(json.dumps({p.name:sha(p) for p in E.iterdir() if p.is_file()},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'newCases':6,'finalPassed':51,'failed':0,'sourceFiles':list(proof['sourceFiles']),'evidence':str(E),'productionMutations':0}))
