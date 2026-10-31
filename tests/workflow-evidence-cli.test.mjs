import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {workflowDigest} from '../scripts/workflow-evidence-gate.mjs';
import {verifyWorkflowFiles} from '../scripts/task-preflight.mjs';
import {materializeWorkflowSample} from './workflow-evidence-sample.mjs';
const gate=resolve(dirname(fileURLToPath(import.meta.url)),'../scripts/task-preflight.mjs');
function fixture(run){const dir=fs.mkdtempSync(join(tmpdir(),'workflow-evidence-cli-'));const f=materializeWorkflowSample(dir,{...fs,join});const save=()=>{fs.writeFileSync(f.evidencePath,JSON.stringify(f.evidence));fs.writeFileSync(f.policyPath,JSON.stringify(f.policy));};try{return run({...f,dir,save});}finally{assert.equal(resolve(dirname(dir)),resolve(tmpdir()));assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep+'workflow-evidence-cli-'));fs.rmSync(dir,{recursive:true,force:true});}}
const cli=(f,...args)=>spawnSync(process.execPath,[gate,...(args.length?args:['--workflow',f.evidencePath,'--workflow-policy',f.policyPath])],{encoding:'utf8',windowsHide:true,timeout:15000});
const blocked=(r,reason)=>{assert.equal(r.status,1,r.stdout);const e=JSON.parse(r.stderr);assert.equal(e.gate,'blocked');if(reason)assert.match(e.reason,reason);};
test('synthetic hit passes CLI with independent reviewed policy and actual collector-byte hash',()=>fixture(f=>{const r=cli(f);assert.equal(r.status,0,r.stderr);const v=JSON.parse(r.stdout);assert.equal(v.workflow.mode,'isolated');assert.equal(v.workflow.state,'evidence-linked');assert.equal(v.workflow.runtime.model,'unverified');assert.match(v.workflow.policyAuthority.coverage,/not mechanically authenticated/);}));
test('workflow without policy is rejected before IO',()=>fixture(f=>blocked(cli(f,'--workflow',f.evidencePath),/WORKFLOW_EVIDENCE_AND_POLICY_REQUIRED/)));
test('policy without workflow is rejected before IO',()=>fixture(f=>blocked(cli(f,'--workflow-policy',f.policyPath),/WORKFLOW_EVIDENCE_AND_POLICY_REQUIRED/)));
test('no original wire response evidence means blocked, no service fallback',()=>fixture(f=>{fs.unlinkSync(join(f.dir,'wire-response.json'));blocked(cli(f),/ENOENT/);}));
test('synthetic capture cannot satisfy production policy',()=>fixture(f=>{f.policy.mode='production';f.save();blocked(cli(f),/WORKFLOW_MODE_MISMATCH/);}));
test('an unknown claimed runtime model activation field is rejected',()=>fixture(f=>{f.evidence.runtime.verified=true;f.save();blocked(cli(f),/RUNTIME_SCHEMA/);}));
test('changed collector source bytes cannot retain a declared valid pin',()=>fixture(f=>{fs.appendFileSync(f.policy.collectorPath,'// changed');blocked(cli(f),/WORKFLOW_COLLECTOR_BYTES_MISMATCH/);}));
test('policy pins declared file bytes independently of evidence hash claims',()=>fixture(f=>{fs.writeFileSync(join(f.dir,'plan.md'),'unreviewed plan');blocked(cli(f),/WORKFLOW_POLICY_FILE_HASH_MISMATCH/);}));
test('evidence cannot replace the caller chosen preset identity',()=>fixture(f=>{f.evidence.preset.id='other';f.save();blocked(cli(f),/PRESET_EXPECTATION_MISMATCH/);}));
test('manifest-pin authority is not satisfied by an unverified manifest-shaped argument or absence',()=>fixture(f=>{f.policy.authority={kind:'manifest-pin'};f.save();blocked(cli(f),/WORKFLOW_POLICY_MANIFEST_PIN_REQUIRED/);}));
test('already verified scope pin matches exact policy file and hash only',()=>fixture(f=>{f.policy.authority={kind:'manifest-pin'};f.save();const scope={task:f.policy.taskId,files:[{path:f.policyPath,role:'evidence',sha256:workflowDigest(fs.readFileSync(f.policyPath))}]};assert.equal(verifyWorkflowFiles(f.evidencePath,f.policyPath,scope).policyAuthority.kind,'manifest-pin');scope.files[0].sha256='f'.repeat(64);assert.throws(()=>verifyWorkflowFiles(f.evidencePath,f.policyPath,scope),/WORKFLOW_POLICY_MANIFEST_PIN_REQUIRED/);}));
test('manual policy requires named review attribution and reference, not verified=true',()=>fixture(f=>{f.policy.authority={kind:'reviewed-caller-policy',reviewer:'',reviewReference:'test'};f.save();blocked(cli(f),/WORKFLOW_POLICY_REVIEW_REQUIRED/);}));
test('duplicate file keys and mappings are rejected rather than last-write-wins',()=>fixture(f=>{f.policy.files.push(f.policy.files[0]);f.save();blocked(cli(f),/WORKFLOW_FILE_MAPPING_INVALID/);}));
test('actual failed-service envelope blocks CLI without replay',()=>fixture(f=>{const p=join(f.dir,'response.json'),d=JSON.parse(fs.readFileSync(p));d.status='failed';d.hits=[];d.error='SYNTHETIC service unavailable';const b=JSON.stringify(d);fs.writeFileSync(p,b);const h=workflowDigest(b);f.evidence.retrieval.response.sha256=h;f.policy.files.find(x=>x.key==='response.json').sha256=h;f.save();blocked(cli(f),/KNOWLEDGE_SERVICE_BLOCKED/);}));

test('scope manifest task requires explicit workflow evidence before any Git or file check',()=>fixture(f=>blocked(cli(f,'--manifest',join(f.dir,'not-read-scope.json')),/WORKFLOW_EVIDENCE_REQUIRED_FOR_TASK/)));

test('CLI rejects scope evidence for another task before Git or workflow acceptance',()=>fixture(f=>{const manifestPath=join(f.dir,'different-task-manifest.json');fs.writeFileSync(manifestPath,JSON.stringify({task:'different-task'}));blocked(cli(f,'--manifest',manifestPath,'--workflow',f.evidencePath,'--workflow-policy',f.policyPath),/WORKFLOW_SCOPE_TASK_MISMATCH/);}));

test('CLI requires an independent explicit policy phase',()=>fixture(f=>{delete f.policy.phase;f.save();blocked(cli(f),/PRODUCT_BUILD_STRICT_KEYS_REJECTED/);}));
test('CLI start with only plan citations passes but cannot be presented as delivery',()=>fixture(f=>{f.policy.phase='start';f.evidence.adoption.delivery=null;f.evidence.adoption.citations=f.evidence.adoption.citations.filter(c=>c.stage==='plan');f.policy.files=f.policy.files.filter(x=>x.key!=='delivery.md');fs.unlinkSync(join(f.dir,'delivery.md'));f.save();const result=cli(f);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).workflow.phase,'start');f.policy.phase='delivery';f.save();blocked(cli(f),/EVIDENCE_FILE_SCHEMA/);}));
