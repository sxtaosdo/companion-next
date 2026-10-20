from pathlib import Path
import os,json,datetime,urllib.request,http.cookiejar,hashlib
W=Path(__file__).parent;D=Path(os.environ['APPDATA'])/'Creator AI Companion';load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
assert load(W/'protocol-result.json')['ok'];loc=load(D/'daemon.json');base=loc['baseUrl'];project='04c4cde24ee76d83'
request=urllib.request.Request(base+'/v1/ui/session',headers={'Authorization':'Bearer '+loc['apiToken'],'Content-Type':'application/json'},data=b'{}')
with urllib.request.urlopen(request,timeout=10) as r:ticket=json.load(r)
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with opener.open(ticket['url'],timeout=10) as r:assert r.status==200
def read(path):
 with opener.open(base+path,timeout=10) as r:assert r.status==200;return json.load(r)
one=read('/api/projects/'+project+'/calls?limit=1');assert len(one['records'])==1 and one['nextBefore'] is not None
two=read('/api/projects/'+project+'/calls?limit=1&before='+str(one['nextBefore']));assert len(two['records'])==1 and two.get('nextBefore') is None
combined=one['records']+two['records'];assert len({x['id'] for x in combined})==2 and all(x['status']=='success' and x['source']=='mcp' for x in combined)
full=read('/api/projects/'+project+'/calls?limit=50');assert len(full['records'])==2 and full.get('nextBefore') is None
assert [x['id'] for x in full['records']]==[x['id'] for x in combined]
failed=read('/api/projects/'+project+'/calls?status=failed&limit=50');assert failed['records']==[]
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'projectId':project,'realToolsExecuted':2,'source':'mcp','pageSizeOneTraversal':True,'distinctRows':2,'matchesRealLimit50Order':True,'limit50Cursor':full.get('nextBefore'),'total':full.get('total'),'retained':full.get('retained'),'failedCount':0,'productionUiPageThreshold':50,'realUiSecondPageProven':False,'realFailureDetailProven':False,'fakeBusinessRecordsInjected':0,'dangerousFailuresManufactured':0,'rows':[]}
for x in combined:
 proof['rows'].append({'id':x['id'],'sequence':x.get('sequence'),'operation':x.get('operation'),'status':x['status'],'source':x['source'],'fields':sorted(x),'detailSha256':hashlib.sha256(json.dumps(x,sort_keys=True,ensure_ascii=False).encode()).hexdigest()})
(W/'real-pagination.json').write_bytes((json.dumps(proof,ensure_ascii=False,indent=2)+'\n').encode());print(json.dumps(proof,ensure_ascii=False))
