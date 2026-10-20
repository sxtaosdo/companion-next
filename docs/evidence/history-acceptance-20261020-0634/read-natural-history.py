from pathlib import Path
import os, json, hashlib, datetime, urllib.request, http.cookiejar, urllib.parse

W=Path(__file__).parent
D=Path(os.environ['APPDATA'])/'Creator AI Companion'
R=Path('D:/code/shidai3/P8000/companion-next')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda raw:hashlib.sha256(raw).hexdigest()
loc=load(D/'daemon.json')
assert loc['baseUrl']=='http://127.0.0.1:32180' and loc['identity']['pid']==6564
base=loc['baseUrl']
token=loc['apiToken']
req=urllib.request.Request(base+'/v1/ui/session',headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},data=b'{}')
with urllib.request.urlopen(req,timeout=12) as response:
    assert response.status==200
    ticket=json.load(response)
assert ticket['url'].startswith(base+'/auth?code=')
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with opener.open(ticket['url'],timeout=12) as response:
    assert response.status==200

requests=[]
def read(path):
    with opener.open(base+path,timeout=15) as response:
        assert response.status==200
        body=json.load(response)
        requests.append({'path':path,'httpStatus':response.status})
        return body

def safe_row(row):
    result={key:row.get(key) for key in ['id','sequence','status','source','operation','startedAt','finishedAt','durationMs'] if key in row}
    result['fields']=sorted(row)
    for key in ['inputSummary','resultSummary','errorSummary']:
        value=row.get(key)
        result[key+'Present']=isinstance(value,str) and bool(value)
        if isinstance(value,str):
            result[key+'Sha256']=sha(value.encode('utf-8'))
            result[key+'Utf8Bytes']=len(value.encode('utf-8'))
    return result

counts=read('/api/calls/counts')
projects=load(D/'projects.json')['projects']
safe_projects=[p for p in projects if 'p1060' not in str(p.get('name','')).lower() and 'p1060' not in str(p.get('path','')).lower()]
rows=[]
for project in safe_projects:
    pid=project['id']
    root='/api/projects/'+urllib.parse.quote(pid,safe='')+'/calls'
    page=read(root+'?limit=50')
    items=page['records']
    assert len(items)<=50
    result={'projectId':pid,'projectName':project['name'],'firstPageCount':len(items),'total':page.get('total'),'retained':page.get('retained'),'nextBefore':page.get('nextBefore'),'records':[safe_row(row) for row in items]}
    cursor=page.get('nextBefore')
    if cursor is not None:
        assert len(items)==50 and isinstance(cursor,int)
        second=read(root+'?limit=50&before='+str(cursor))
        next_rows=second['records']
        assert len(next_rows)<=50 and not {row['id'] for row in items}&{row['id'] for row in next_rows}
        assert all(row['sequence']<cursor for row in next_rows)
        result['secondPage']={'count':len(next_rows),'nextBefore':second.get('nextBefore'),'records':[safe_row(row) for row in next_rows],'disjoint':True,'beforeCursorExclusive':True}
        result['formal50ApiPagination']='passed'
    else:
        result['formal50ApiPagination']='never_run_insufficient_natural_records'
    failed=read(root+'?limit=50&status=failed')
    assert all(row['status']=='failed' for row in failed['records'])
    result['naturalFailures']={'count':len(failed['records']),'nextBefore':failed.get('nextBefore'),'records':[safe_row(row) for row in failed['records']]}
    result['naturalFailureDetailApi']='passed' if failed['records'] and all(row.get('errorSummary') for row in failed['records']) else ('never_run_no_natural_failure' if not failed['records'] else 'failed_missing_error_summary')
    rows.append(result)

assert load(D/'daemon.json')['identity']==loc['identity']
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'daemonIdentity':loc['identity'],'safeProjectCount':len(safe_projects),'excludedP1060ProjectCount':len(projects)-len(safe_projects),'sessionCounts':counts,'projects':rows,'requests':requests,'newMcpCalls':0,'historyWrites':0,'injectedRecords':0,'manufacturedFailures':0,'productionLogClear':0,'clientConfigWrites':0,'desktopActions':0,'uiFormal50Pagination':'never_run_desktop_owned_by_primary_and_data_condition_applies','uiNaturalFailureDetail':'never_run_desktop_owned_by_primary_and_data_condition_applies'}
(W/'natural-history-result.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'safeProjectCount':len(rows),'excludedP1060ProjectCount':proof['excludedP1060ProjectCount'],'projects':[{k:r[k] for k in ['projectId','projectName','firstPageCount','total','retained','nextBefore','formal50ApiPagination','naturalFailureDetailApi']}|{'failureCount':r['naturalFailures']['count']} for r in rows],'newMcpCalls':0,'historyWrites':0},ensure_ascii=False))
