from pathlib import Path
import os,json,hashlib,subprocess,datetime,sqlite3
W=Path(__file__).parent; B=Path('C:/Users/33272/AppData/Local/Temp/companion-boot-repair-20261020')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
ns={'__file__':str(B/'deploy.py')};exec(compile((B/'deploy.py').read_text().split('mode=sys.argv[1]')[0],'read-only-protection','exec'),ns)
assert ns['shared']();I=ns['I'];D=ns['D']
assert not (W/'checkpoint.json').exists()
loc=load(D/'daemon.json');assert loc['identity']['pid']==7156
runtime={p.relative_to(I).as_posix():sha(p) for p in I.rglob('*') if p.is_file()}
assert runtime['creator-ai.js']=='bc1e15920a33e388a6d5cdc8347a9bec93fbe7cc719e7208cc8b112feeebca53'
assert runtime['knowledge-worker.js']=='07c4861de1716058f79866df3b15e64286b1281da8478e5f8feef192964013d4'
assert runtime['companion-daemon.js']=='70df42a8f84e6bf9d32c050919fcb91565ff4b53ff9f85a3b1e50664d267ca65'
(W/'original').mkdir(exist_ok=True)
for n in ['creator-ai.js','creator-ai.js.map','knowledge-worker.js','knowledge-worker.js.map']:(W/'original'/n).write_bytes((I/n).read_bytes())
immutable={p.name:sha(p) for p in D.iterdir() if p.is_file() and (p.name.startswith('native-') or p.name in ['projects.json','bridge-installs.json','tool-presets.json'])}
db=sqlite3.connect(Path('D:/knowledge-data/weknora/pilot-access/weknora.db').as_uri()+'?mode=ro',uri=True);db.execute('PRAGMA query_only=ON')
row=db.execute('SELECT id,tenant_id,scope_type,full_access,knowledge_base_ids,capabilities,expires_at,revoked_at FROM tenant_api_keys WHERE id=3').fetchone();db.close()
row=[x.decode('utf-8') if isinstance(x,bytes) else x for x in row]
assert row[:4]==[3,1,'tenant',0] and json.loads(row[4])==['da1051a5-3fff-4198-ba55-017ea79df9c3'] and json.loads(row[5])==['retrieve']
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'identity':loc['identity'],'runtime':runtime,'immutable':immutable,'business':ns['business'](),'shared22Preserved':True,'readerPublicMetadata':row,'baselineNext':'916face','servicePid':600,'scope':'CLI_WAIT_AND_WORKER_ERROR_CLASSIFICATION_ONLY'}
(W/'checkpoint.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'checkpoint':True,'runtimeFiles':len(runtime),'businessTables':len(proof['business']),'shared22Preserved':True,'readerPermissionUnchanged':True}))
