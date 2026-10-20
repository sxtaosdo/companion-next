from pathlib import Path
import json,hashlib,subprocess,datetime,sys
W=Path(__file__).parent;B=Path('C:/Users/33272/AppData/Local/Temp/companion-startup-reader-fixes-20261020/cold-entry-acceptance')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
ns={'__file__':str(B/'deploy.py')};exec(compile((B/'deploy.py').read_text().rsplit('\nmode=sys.argv[1]',1)[0],'readonly-protection','exec'),ns)
I=ns['I'];D=ns['D'];R=Path('D:/code/shidai3/P8000/companion-next')
def snapshot():
 state=ns['state'](old=False);ns['idle'](state)
 shared=Path('D:/code/shidai3/P8000/cocos-mcp');git=lambda *a:subprocess.check_output(['C:/Program Files/Git/cmd/git.exe','-C',str(shared),*a],stderr=subprocess.DEVNULL)
 canonical=load(B/'captured.json')['canonicalName']
 plan=load(Path('C:/Users/33272/AppData/Local/Temp/companion-three-client-repair-20261020/plan.json'))
 return {'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'identity':state['identity'],'phase':state['phase'],'counts':state['counts'],'runtime':{n:sha(I/n) for n in ns['C']['runtime']},'business':ns['ns']['business'](),'immutable':{n:sha(D/n) for n in ns['C']['immutable'] if n!=canonical},'config':{str(p['path']):sha(Path(p['path'])) for p in plan['files']},'shared':{'head':git('rev-parse','HEAD').decode().strip(),'statusSha256':hashlib.sha256(git('status','--porcelain=v1')).hexdigest(),'diffSha256':hashlib.sha256(git('diff','--binary')).hexdigest(),'indexDiffSha256':hashlib.sha256(git('diff','--cached','--binary')).hexdigest()},'knowledge':ns['service'](),'historicalExact21FileBaselineAvailable':False}
def check(current,baseline,allowed=()):
 assert current['identity']==baseline['identity'] and current['phase']=='OPEN'
 for k in ['business','immutable','config','shared','knowledge']:assert current[k]==baseline[k],k+' drift'
 for name,value in baseline['runtime'].items():
  if name not in allowed:assert current['runtime'][name]==value,name+' drift'
 return True
if __name__=='__main__':
 current=snapshot()
 if sys.argv[1]=='capture':
  assert current['runtime']==ns['C']['runtime'],'Installed runtime differs from previous baseline; inspect before deployment'
  p=W/'baseline.json';assert not p.exists();p.write_text(json.dumps(current,indent=2)+'\n',encoding='utf-8')
 elif sys.argv[1]=='check':
  allowed=load(W/'deployment.json')['changedOriginalRuntimeNames'] if (W/'deployment.json').exists() else []
  check(current,load(W/'baseline.json'),allowed)
  (W/'after.json').write_text(json.dumps(current,indent=2)+'\n',encoding='utf-8')
 else:raise RuntimeError('Unknown mode')
 print(json.dumps({'protection':sys.argv[1],'pid':current['identity']['pid'],'runtimeTracked':len(current['runtime']),'businessTables':len(current['business']),'configUnchanged':True,'knowledgePid':600,'cursorActions':0}))
