from pathlib import Path
import os,json,hashlib,datetime,urllib.request,http.cookiejar
W=Path(__file__).parent;D=Path(os.environ['APPDATA'])/'Creator AI Companion';load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
loc=load(D/'daemon.json');assert loc['identity']['pid']==6564 and loc['baseUrl']=='http://127.0.0.1:32180'
base=loc['baseUrl'];request=urllib.request.Request(base+'/v1/ui/session',headers={'Authorization':'Bearer '+loc['apiToken'],'Content-Type':'application/json'},data=b'{}')
with urllib.request.urlopen(request,timeout=12) as r:ticket=json.load(r)
assert ticket['url'].startswith(base+'/auth?code=')
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with opener.open(ticket['url'],timeout=12) as r:assert r.status==200
def read(path):
 with opener.open(base+path,timeout=15) as r:return json.load(r)
counts=read('/api/calls/counts');projects=load(D/'projects.json')['projects'];safeprojects=[p for p in projects if 'p1060' not in str(p.get('name','')).lower() and 'p1060' not in str(p.get('path','')).lower()]
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'identity':loc['identity'],'countShape':type(counts).__name__,'counts':counts,'projects':[],'productionWrites':0,'injectedRecords':0,'dangerousFailureRequests':0}
for p in safeprojects:
 id=p['id'];page=read('/api/projects/'+id+'/calls?limit=50');items=page['records']
 def summary(x):
  return {k:x[k] for k in ['id','sequence','status','source','operation','startedAt','finishedAt'] if k in x}
 row={'projectId':id,'name':p.get('name'),'fields':sorted(page),'count':len(items),'total':page.get('total'),'retained':page.get('retained'),'nextBefore':page.get('nextBefore'),'items':[summary(x) for x in items]}
 if page.get('nextBefore') is not None:
  second=read('/api/projects/'+id+'/calls?limit=50&before='+str(page['nextBefore']));row['secondPage']={'count':len(second['records']),'nextBefore':second.get('nextBefore'),'items':[summary(x) for x in second['records']]}
 failed=read('/api/projects/'+id+'/calls?limit=50&status=failed');row['failures']={'count':len(failed['records']),'nextBefore':failed.get('nextBefore'),'items':[summary(x) for x in failed['records']]}
 result['projects'].append(row)
assert load(D/'daemon.json')['identity']==loc['identity']
(W/'natural-calls.json').write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode())
print(json.dumps({'counts':counts,'projects':[{k:r.get(k) for k in ['projectId','name','count','total','retained','nextBefore','failures']} for r in result['projects']]},ensure_ascii=False))
