from pathlib import Path
import hashlib,json,subprocess,datetime
R=Path('D:/code/shidai3/P8000/companion-next')
W=Path(__file__).parent;E=R/'docs/evidence/vue-model-ui-20261020-0718'
G='C:/Program Files/Git/cmd/git.exe'
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output([G,'-C',str(R),*a],stderr=subprocess.DEVNULL)
files=[
'src/components/KnowledgeAgentPanel.vue','src/components/KnowledgeConversationPanel.vue',
'src/components/KnowledgeSyncPanel.vue','src/components/LocalServiceControls.vue',
'src/stores/knowledge-agent.ts','src/stores/knowledge-conversation.ts','src/stores/local-service-operations.ts',
'src/adapters/knowledge-agent.ts','src/adapters/knowledge-conversation.ts','src/adapters/knowledge-sync.ts','src/adapters/local-service-operations.ts',
'tests/knowledge-agent-ui.test.ts','tests/knowledge-conversation-ui.test.ts','tests/knowledge-sync-ui.test.ts','tests/local-service-operations-ui.test.ts',
'src/views/AiResourceReadView.vue','src/components/AiTaskCreationPanel.vue','src/components/AiJobActionsPanel.vue','src/components/AiResourceConfigDialog.vue']
revisions={
'agent':('5138bbf5896f4ad98a524cc959bf049b299dbd89',['src/components/KnowledgeAgentPanel.vue','src/adapters/knowledge-agent.ts','tests/knowledge-agent-ui.test.ts']),
'sync':('40d10892ea49fc62b6f30063540a837755be5d7a',['src/components/KnowledgeSyncPanel.vue','src/adapters/knowledge-sync.ts','tests/knowledge-sync-ui.test.ts']),
'syncAfterAgentCoordination':('5138bbf5896f4ad98a524cc959bf049b299dbd89',['src/components/KnowledgeSyncPanel.vue','src/adapters/knowledge-sync.ts']),
'model':('9af58137f761ac330320e55476d23464b7a35685',['src/components/LocalServiceControls.vue','src/adapters/local-service-operations.ts','tests/local-service-operations-ui.test.ts'])}
continuity={}
for kind,(revision,names) in revisions.items():
 rows=[]
 for name in names:
  try:
   content=git('show',revision+':'+name)
   rows.append({'file':name,'historicalObjectAvailable':True,'historicalSha256':sha(content),'currentSha256':sha((R/name).read_bytes()),'byteEqual':content==(R/name).read_bytes()})
  except subprocess.CalledProcessError:
   rows.append({'file':name,'historicalObjectAvailable':False})
 continuity[kind]={'documentedCodeRevision':revision,'files':rows}
oldRoot=Path('D:/code/shidai3/P8000/cocos-mcp/web/src')
old={'knowledge-page.ts':sha((oldRoot/'knowledge-page.ts').read_bytes()),'app.ts':sha((oldRoot/'app.ts').read_bytes()),'ai-icons-page.ts':sha((oldRoot/'ai-icons-page.ts').read_bytes())}
proof={
'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Vue migration contract only; no model or business lifecycle acceptance',
'nextHead':git('rev-parse','HEAD').decode().strip(),'sourceSha256':{n:sha((R/n).read_bytes()) for n in files},'oldUiSourceSha256':old,'gitContinuity':continuity,
'freshTestsRunByThisUnit':0,'freshProductionRequests':0,'freshDesktopActions':0,'freshProductSourceEdits':0,'testFilesChanged':['tests/knowledge-sync-ui.test.ts'],
'newIsolatedUiCase':{'name':'blocks both sync actions during an Agent request and never replays them on release','purpose':'Cross-panel pending-lane contract: disable dry/run/source controls, no automatic replay on lease release, one explicit dry-run uses exact original source/channel body','execution':'Assigned to root final single related-suite run; this unit does not report it as passed yet'},
'syncHistoricalDifference':'Compared with original .76, current component adds knowledgeAgentPending import/gate introduced by .79 Agent migration. It is byte-identical to .79. The new cross-lane UI regression is a test-only change after those historical tests.',
'historicalRawTempEvidenceDirectoriesAvailable':{n:(Path('C:/Users/33272/AppData/Local/Temp')/n).exists() for n in ['companion-next-agent-20261018','companion-next-knowledge-sync-20261018','companion-model-parity-20261018']},
'migrationContracts':[
{'matrixItem':20,'feature':'Agent list, first/continued ask, local new conversation, cancellation and result feedback','oldAuthority':'web/src/knowledge-page.ts:664-675,749-769','newComponents':['KnowledgeAgentPanel.vue','KnowledgeConversationPanel.vue'],'wire':{'agentList':'POST /api/knowledge/agent/list {}','agentAsk':'POST /api/knowledge/agent/ask {query,agentId,sessionId?}','chat':'POST /api/knowledge/chat {query,kbId?,sessionId?}'},'coveredBy':['tests/knowledge-agent-ui.test.ts','tests/knowledge-conversation-ui.test.ts','tests/knowledge-agent-adapter.test.ts','tests/knowledge-conversation-adapter.test.ts'],'contractFindings':'Original selectors/forms/session bindings and complete JSON display exist; local reset does not create/delete server session. Unknown and late-source results do not become current success. No missing original server session-history or streaming UI: the old contract has neither.','documentedHistoricalUiEvidence':'docs/knowledge-agent-parity-20261018.md: authenticated deployed static UI with six fully intercepted business flows; no real Agent call','freshGap':'No concrete missing Vue control identified in reviewed components; root should tie current targeted/full regression result to this mapping. Real model conversations remain separate paused integration evidence.'},
{'matrixItem':20,'feature':'Sync source/status/dry-run/run/queued feedback','oldAuthority':'web/src/knowledge-page.ts:386-432,551-570','newComponents':['KnowledgeSyncPanel.vue'],'wire':{'dryRun':'POST /api/knowledge/sync/dry-run {sourceId,channel}','run':'POST /api/knowledge/sync/run {sourceId,channel}'},'coveredBy':['tests/knowledge-sync-ui.test.ts','tests/knowledge-sync-adapter.test.ts'],'contractFindings':'Collapsed source selector and exact original two actions exist. Source-specific approved/enabled/writerReady and global writer gate are retained, distinct from retrieval authentication. Queued receipt is not displayed as completed indexing; policy rejection, malformed receipt UNKNOWN, cancellation and cross-source safety are covered.','documentedHistoricalUiEvidence':'docs/knowledge-sync-parity-20261018.md: five intercepted deployed-page flows, original exact source/channel bodies and queued receipt','freshGap':'No new original UI implementation gap identified; real sync policy/auth/knowledge writes remain separate integration evidence and were not executed.'},
{'matrixItem':21,'feature':'Model launcher/knowledge service entry and start/stop/iframe feedback','oldAuthority':'web/src/app.ts:2853-2974,2984-3031','newComponents':['LocalServiceControls.vue'],'wire':{'knowledgeState':'GET /api/knowledge-service/status','modelState':'GET /api/model-service/status','startStop':'POST /api/{knowledge|model}-service/{start|stop} {}'},'coveredBy':['tests/local-service-operations-ui.test.ts','tests/local-service-operations-adapter.test.ts','tests/local-service-operations-store.test.ts'],'contractFindings':'Fixed original 8081 and 8090 panels, running/unframeable fallback, model entry status read, both start/stop controls and original response distinctions exist. The model controls remain in the inherited launcher iframe; copying those controls as new Vue API would invent a different capability.','documentedHistoricalUiEvidence':'docs/model-service-parity-20261018.md: .94 deployed source, intercepted lifecycle cases plus real readonly original launcher with nine cards and route-leave iframe removal','freshGap':'No missing original Next control identified. Real start/stop/GPU/workflow results remain separate paused integration evidence, not a Vue migration prerequisite.'},
{'matrixItem':16,'feature':'AI generate/edit/variant/import UI entry','oldAuthority':'web/src/ai-icons-page.ts','newComponents':['AiResourceReadView.vue','AiTaskCreationPanel.vue','AiJobActionsPanel.vue','AiResourceConfigDialog.vue'],'coveredBy':['tests/ai-task-creation-ui.test.ts','tests/ai-resource-editor-ui.test.ts','tests/ai-job-actions-ui.test.ts','tests/ai-variant-import-write.test.ts'],'contractFindings':'Read-only review confirms original creation/edit/action entry components are wired in the Vue resource page; root owns full #16 assessment. Existing 96-resource import and real Creator results are historical integration evidence, not a reason to rerun models.','freshGap':'No modifications made; broader resource UI parity is not newly certified by this limited component review.'}
],
'separateIntegrationUnverified':['Actual Agent/model conversation and remote session persistence','Actual sync dry-run/run policy, queue and completed indexing','Actual model launcher start/stop and GPU/workflow execution'],
'recommendation':'Do not retain model pause as a Vue migration failure. Distinguish current source regression + historical deployed intercepted UI evidence from fresh production lifecycle calls. No external Cursor/client acceptance required for these Vue contracts.'
}
W.mkdir(exist_ok=True);E.mkdir(exist_ok=True)
(W/'audit-result.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8',newline='\n')
for n in ['audit.py','audit-result.json','add-cross-lane-test.py']:(E/n).write_bytes((W/n).read_bytes())
(E/'sha256.json').write_text(json.dumps({p.name:sha(p.read_bytes()) for p in E.iterdir() if p.is_file() and p.name!='sha256.json'},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'concreteVueDefectsFound':0,'sourceEdits':0,'freshModelOrLifecycleCalls':0,'historicalContinuity':{k:[{'file':r['file'],'available':r['historicalObjectAvailable'],'byteEqual':r.get('byteEqual')} for r in v['files']] for k,v in continuity.items()},'evidence':str(E)}))
