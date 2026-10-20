from pathlib import Path
import json,hashlib,datetime
W=Path(__file__).parent;R=Path('D:/code/shidai3/P8000/companion-next');E=R/'docs/evidence/vue-root-20261020-0718'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
E.mkdir(exist_ok=False)
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Vue pages/interactions/API contracts only; external client/model/host execution separate','runtimeNodeUnchanged':'v25.2.1','testNode':'existing Node22.23.3','typecheckExitCode':0,'oldHostWriterChangesApplied':False,'cursorActions':0,'productionBusinessWrites':0,'review':{'remainingP1P2':0,'readonly':True,'changedLayers':['Vue component state','display-only status formatter','help navigation','scope wording']},'tests':{}}
for name in ['root-tests.json','scope-test.json']:
 raw=json.loads((W/name).read_text(encoding='utf-8-sig'));assert raw['success']
 proof['tests'][name]={'rawReportSha256':sha(W/name),'total':raw['numTotalTests'],'passed':raw['numPassedTests'],'failed':raw['numFailedTests'],'pending':raw['numPendingTests'],'suites':[{'name':Path(t['name']).name,'status':t['status'],'assertions':[{'title':a['fullName'],'status':a['status']} for a in t['assertionResults'] if a['status']!='pending']} for t in raw['testResults']]}
proof['changedSourceSha256']={n:sha(R/n) for n in ['src/components/ProjectSetupWizard.vue','src/views/HelpView.vue','src/views/MigrationView.vue','src/views/CompanionBrowserView.vue','src/domain/product-call-meta.ts'] if (R/n).exists()}
for n in ['src/domain/project-call-meta.ts','src/domain/product-information.ts']:proof['changedSourceSha256'][n]=sha(R/n)
(E/'source-verification.json').write_text(json.dumps(proof,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
for name in ['protection.py','baseline.json','edit-call-status.py','edit-scope.py','update-scope-test.py','archive-source.py']:(E/name).write_bytes((W/name).read_bytes())
(E/'sha256.json').write_text(json.dumps({p.name:sha(p) for p in E.iterdir() if p.is_file()},indent=2)+'\n',encoding='utf-8',newline='\n')
p=R/'.gitattributes';raw=p.read_bytes()
for name in ['vue-history-20261020-0718','vue-setup-20261020-0718','vue-navigation-20261020-0718','vue-model-ui-20261020-0718','vue-root-20261020-0718']:
 rule=f'docs/evidence/{name}/** -text -whitespace\n'.encode()
 if rule not in raw:raw+=b'\n'+rule
p.write_bytes(raw)
print(json.dumps({name:{k:v for k,v in result.items() if k!='suites'} for name,result in proof['tests'].items()}))
