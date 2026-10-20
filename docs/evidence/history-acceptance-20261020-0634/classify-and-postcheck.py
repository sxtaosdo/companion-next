from pathlib import Path
import json, re, datetime, hashlib
W=Path(__file__).parent
scope={'__file__':str(W/'read-natural-history.py')}
exec(compile((W/'read-natural-history.py').read_text(encoding='utf-8').split('\ncounts=read(')[0],'readonly-history-helper','exec'),scope)
read=scope['read'];load=scope['load'];sha=scope['sha']
prior=load(W/'natural-history-result.json')
pid='04c4cde24ee76d83'
before=read('/api/calls/counts')
failures=read('/api/projects/'+pid+'/calls?limit=50&status=failed')
classification=[]
patterns={'compileMention':r'compil','timeoutMention':r'time.?out|timed out','validationMention':r'validat','bridgeMention':r'bridge','notReadyMention':r'not.?ready|not running|not connected','toolUnknownMention':r'unknown tool|tool.not.found|method.not.found','connectionMention':r'econnrefused|econnreset|connection refused','policyMention':r'denied|forbidden|not.allowed|permission','testFailureMention':r'assert|failed|failure','upstreamMention':r'upstream'}
for row in failures['records']:
    error=row.get('errorSummary','')
    codes=[];keys=set()
    try:
        parsed=json.loads(error)
        def walk(value):
            if isinstance(value,dict):
                for key,item in value.items():
                    keys.add(str(key))
                    if key.lower() in ['code','errorcode','reasoncode','status','type','failurekind','phase'] and isinstance(item,(str,int,bool)) and re.fullmatch(r'[a-zA-Z0-9_. :/-]{1,90}',str(item)):
                        codes.append({'field':key,'value':item})
                    walk(item)
            elif isinstance(value,list):
                for item in value:walk(item)
        walk(parsed)
        encoding='json'
    except (ValueError,TypeError):
        encoding='text_or_truncated'
    classification.append({'id':row['id'],'operation':row['operation'],'source':row['source'],'status':row['status'],'startedAt':row['startedAt'],'errorSummarySha256':sha(error.encode()),'errorEncoding':encoding,'jsonFieldNames':sorted(keys),'safeCodes':codes,'mentions':{name:bool(re.search(pattern,error,re.I)) for name,pattern in patterns.items()},'predatesThisTask':row['startedAt']<'2026-10-20T06:34:19Z','migrationDefectProven':False})
after=read('/api/calls/counts')
assert before==after,'Concurrent calls changed while classifying; preserve observations, do not write'
assert all(row['source']=='cli' for row in classification)
prior_count=prior['sessionCounts']['counts'].get(pid)
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sessionId':after['sessionId'],'countsBefore':before['counts'],'countsAfter':after['counts'],'countsUnchangedWithinClassificationReads':before==after,'countsMatchInitialHistoryRead':prior['sessionCounts']==after,'antCookInitialCount':prior_count,'antCookAfterCount':after['counts'].get(pid),'naturalFailureCount':len(classification),'failures':classification,'newMcpCalls':0,'writes':0,'replayedFailures':0,'classificationScope':'Stored CLI operation failures predating this acceptance task. Successful history read and display do not establish whether the earlier tool/business failure was a migration software defect.'}
(W/'classification-postcheck.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(proof))
