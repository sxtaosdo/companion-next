from pathlib import Path
import json,hashlib,os,stat,datetime,uuid
import protection as p
W=Path(__file__).parent;load=p.load;sha=p.sha
candidate=load(W/'candidate.json');baseline=load(W/'baseline.json')
current_head=__import__('subprocess').check_output(['C:/Program Files/Git/cmd/git.exe','-C',str(p.R),'rev-parse','HEAD']).decode().strip()
assert candidate['sourceCommit']==current_head,'Source commit changed before deployment'
assert not (W/'apply-issued.json').exists(),'Prior deployment issued or uncertain; inspect rather than reapply'
p.check(p.snapshot(),baseline)
def ordinary(path,directory=False):
 info=path.lstat();assert not stat.S_ISLNK(info.st_mode) and not getattr(info,'st_file_attributes',0)&stat.FILE_ATTRIBUTE_REPARSE_POINT,str(path)
 assert stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode),str(path)
 if not directory:assert info.st_nlink==1,str(path)
def ancestors(path):
 for parent in [path,*path.parents]:
  if parent==parent.parent:break
  ordinary(parent,True)
web=p.I/'web';dest=web/'next';ancestors(dest);ancestors(dest/'assets')
files=[]
for entry in candidate['files']:
 name=entry['path'];assert name.startswith('next/') and '..' not in name and '\\' not in name
 source=W/'static-candidate'/name;ordinary(source);assert sha(source)==entry['sha256'] and source.stat().st_size==entry['size']
 target=web/name
 if target.exists():
  ordinary(target)
  if name!='next/index.html':assert sha(target)==entry['sha256'],'Hashed asset collision'
 files.append((entry,source,target))
index=dest/'index.html';index_key='web/next/index.html';assert sha(index)==baseline['runtime'][index_key]
backup=W/'backup-index.html'
with backup.open('xb') as f:f.write(index.read_bytes());f.flush();os.fsync(f.fileno())
assert sha(backup)==baseline['runtime'][index_key]
issued={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':candidate['sourceCommit'],'oldIndexSha256':sha(index),'files':[e['path'] for e,s,t in files],'scope':'Next static assets and atomic index only; no process restart'}
with (W/'apply-issued.json').open('x',encoding='utf-8') as f:json.dump(issued,f,indent=2);f.flush();os.fsync(f.fileno())
created=[]
for entry,source,target in files:
 if entry['path']=='next/index.html' or target.exists():continue
 with target.open('xb') as f:f.write(source.read_bytes());f.flush();os.fsync(f.fileno())
 assert sha(target)==entry['sha256'];created.append('web/'+entry['path'])
assert sha(index)==baseline['runtime'][index_key],'Index drift before switch; do not overwrite'
newindex=next(source for entry,source,target in files if entry['path']=='next/index.html')
stage=dest/('.index-vue-'+uuid.uuid4().hex+'.tmp')
with stage.open('xb') as f:f.write(newindex.read_bytes());f.flush();os.fsync(f.fileno())
os.replace(stage,index)
for entry,source,target in files:assert sha(target)==entry['sha256']
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':candidate['sourceCommit'],'internalCheckpoint':candidate['internalCheckpoint'],'productVersion':'1.3.173','kind':'Next static only','files':candidate['files'],'changedOriginalRuntimeNames':[index_key],'newRuntimeNames':created,'oldIndexSha256':sha(backup),'newIndexSha256':sha(index),'oldResourcesRetained':True,'rollback':'Restore backup-index.html atomically only if current index still matches this receipt; retain content-addressed assets','daemonRestarted':False,'cursorActions':0,'creatorActions':0,'modelActions':0,'configurationWrites':0}
(W/'deployment.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
p.check(p.snapshot(),baseline,[index_key])
print(json.dumps({'deployed':True,'sourceCommit':candidate['sourceCommit'],'verifiedFiles':len(files),'changedOriginalRuntimeNames':[index_key],'newAssets':len(created),'daemonPid':baseline['identity']['pid'],'restart':False}))
