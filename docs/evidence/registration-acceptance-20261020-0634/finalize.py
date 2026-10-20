from pathlib import Path
import json,hashlib,subprocess,datetime
W=Path(__file__).parent;R=Path('D:/code/shidai3/P8000/companion-next');E=R/'docs/evidence/registration-acceptance-20261020-0634'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
bindings=load(W/'candidate-bindings.json');tests=load(W/'cursor-candidate-results.json');audit=load(W/'installed-source-audit.json')
assert len(tests['cases'])==7 and all(c['passed'] for c in tests['cases'])
assert sha(W/'cursor-configurator.ts')==bindings['baseline']
assert sha(W/'cursor-configurator.candidate.ts')==bindings['candidate']
I=Path('D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion')
assert sha(I/'companion-daemon.js')==audit['bundleSha256']
assert sha(I/'companion-daemon.js.map')==audit['mapSha256']
plan=load(Path('C:/Users/33272/AppData/Local/Temp/companion-three-client-repair-20261020/plan.json'))
configuration_bytes_preserved=all(sha(Path(f['path']))==f['sha256After'] for f in plan['files'])
assert configuration_bytes_preserved
diff=subprocess.run(['C:/Program Files/Git/cmd/git.exe','diff','--no-index','--',str(W/'cursor-configurator.ts'),str(W/'cursor-configurator.candidate.ts')],capture_output=True)
assert diff.returncode==1
(W/'cursor-configurator.candidate.patch').write_bytes(diff.stdout)
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'installedDaemonSha256':audit['bundleSha256'],'installedMapSha256':audit['mapSha256'],'baselineCursorSourceSha256':bindings['baseline'],'candidateCursorSourceSha256':bindings['candidate'],'productionRegisterPosts':0,'productionConfigurationWrites':0,'clientOrCreatorOrModelLaunches':0,'configurationBytesMatchApprovedRepair':configuration_bytes_preserved,'strictTypecheck':{'passed':True,'command':'Node25 tsc -p typecheck/tsconfig.json','nodeTypesFromExistingDependency':True},'offlineDefaultFilesystemTests':{'passed':7,'failed':0,'skipped':0,'baselineDefectReproduced':True},'realFormalRegistration':'NEVER_RUN_RISK_FOUND','candidateStatus':'OFFLINE_ONLY_NOT_DEPLOYED','newUiOrPermissions':False,'remainingIntegration':'Next receipt validator must accept exact Node+originalJS args; central agent owns it. Codex candidate owned by wizard agent. Current daemon must not be restarted/deployed by this unit.','matrixChange':None}
(W/'result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
E.mkdir(exist_ok=False)
names=['audit.py','installed-source-audit.json','cursor-configurator.ts','cursor-configurator.candidate.ts','cursor-configurator.candidate.patch','prepare-candidate.mjs','candidate-bindings.json','cursor-candidate.test.mjs','cursor-candidate-results.json','result.json','finalize.py']
for name in names:(E/name).write_bytes((W/name).read_bytes())
dep=E/'dependencies';dep.mkdir()
for name in ['codex-configurator.ts','atomic-config-write.ts','config-file-security.ts']:(dep/name).write_bytes((W/'typecheck'/name).read_bytes())
(E/'tsconfig.json').write_bytes((W/'typecheck/tsconfig.json').read_bytes())
(E/'sha256.json').write_text(json.dumps({p.relative_to(E).as_posix():sha(p) for p in E.rglob('*') if p.is_file()},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(result,indent=2))
