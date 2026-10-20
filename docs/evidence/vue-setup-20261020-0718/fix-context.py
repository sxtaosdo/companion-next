from pathlib import Path
import json,hashlib
R=Path('D:/code/shidai3/P8000/companion-next');W=Path(__file__).parent
before=json.loads((W/'before-fix.json').read_text(encoding='utf-8'))
failed=[r for suite in before['testResults'] for r in suite['assertionResults'] if r['status']=='failed']
assert len(failed)==2,[r['fullName'] for r in failed]
p=R/'src/components/ProjectSetupWizard.vue';raw=p.read_bytes()
old=b"function show(id=''){if(lane.locked)return;agentsSkipped.value=false;dialogEpoch++;useCreatorOperationsStore().closeDialog();store.clearPrepared();scaffold.clearPrepared();sourceMode.value='custom';resetConsents();directoryError.value='';projectId.value=id;open.value=true}"
assert raw.count(old)==1
new=b"""function show(id=''){
 if(lane.locked)return
 const target=id?projects.projects.find(project=>project.id===id):undefined
 if(id&&!target)return
 agentsSkipped.value=false;dialogEpoch++;useCreatorOperationsStore().closeDialog();store.clearPrepared();scaffold.clearPrepared();sourceMode.value='custom';resetConsents();directoryError.value=''
 if(target)path.value=target.path
 projectId.value=id;open.value=true
}"""
after=raw.replace(old,new)
p.write_bytes(after)
(W/'edit-result.json').write_text(json.dumps({'sourceBeforeSha256':hashlib.sha256(raw).hexdigest(),'sourceAfterSha256':hashlib.sha256(after).hexdigest(),'confirmedBeforeFailures':[r['fullName'] for r in failed],'changedFiles':['src/components/ProjectSetupWizard.vue','tests/project-setup-ui.test.ts'],'productionWrites':0},indent=2)+'\n',encoding='utf-8')
print('Fixed explicit card path binding and rejected absent project IDs; empty add entry preserves draft')
