<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {RegistrationStorageUnconfirmed,retainRegistrationPending,persistRegistrationPending,archiveRegistrationPending} from './workflow-registration-pending-storage'
import {createWorkflowProjectRegistrationProvider,validateWorkflowProjectPath,validateWorkflowRegistrationInput,decodeWorkflowRegistrationResult,WorkflowRegistrationRequestError,workflowProjectPathKey} from '../adapters/workflow-project-registration'
import type {WorkflowProjectRegistrationProvider,WorkflowRegisteredProject,WorkflowRegistrationSnapshot,WorkflowRegistrationInput,WorkflowRegistrationResult} from '../adapters/workflow-project-registration'
const props=defineProps<{provider?:WorkflowProjectRegistrationProvider}>()
const emit=defineEmits<{registered:[project:WorkflowRegisteredProject]}>()
const api=props.provider??createWorkflowProjectRegistrationProvider()
const open=ref(false),projectPath=ref(''),busy=ref(false),error=ref(''),notice=ref(''),storageBlocked=ref(false)
const snapshot=ref<WorkflowRegistrationSnapshot|null>(null),legacyPath=ref<string|null>(null),legacyEffect=ref<'unread'|'absent'|'present'>('unread'),legacyReviewed=ref(false),approved=ref(false),reconcileApproved=ref(false),trigger=ref<HTMLButtonElement|null>(null)
interface Pending {schemaVersion:2;input:WorkflowRegistrationInput;phase:'intent'|'unknown'|'registered'|'rejected'|'reconciling';result?:WorkflowRegistrationResult}
const pending=ref<Pending|null>(null),storageKey='companion-workflow-project-registration-pending-v2',legacyKey='companion-workflow-project-registration-pending-v1',auditKey='companion-workflow-project-registration-receipt-v2'
let alive=true
let persistedPending:string|null=null
const locked=computed(()=>busy.value||pending.value!==null||storageBlocked.value)
const canRegister=computed(()=>!locked.value&&!!snapshot.value&&approved.value&&(!legacyPath.value||legacyEffect.value==='absent'&&legacyReviewed.value))
watch(projectPath,()=>{approved.value=false;legacyReviewed.value=false;reconcileApproved.value=false})
function keep(value:Pending){
 try{
  const retained=retainRegistrationPending(pending.value,value)
  // Retain the original operation in memory even when Storage cannot acknowledge it.
  pending.value=retained
  const bytes=JSON.stringify(retained)
  persistRegistrationPending(sessionStorage,storageKey,persistedPending,bytes)
  persistedPending=bytes;return true
 }catch(cause){storageBlocked.value=true;if(cause instanceof RegistrationStorageUnconfirmed&&cause.code==='REGISTRATION_RECEIPT_CHANGED'){error.value='原操作成功回执出现不一致，保留原完整回执并锁定核对，不重发。';return false}error.value=pending.value?.result?.state==='registered'?'已收到原登记成功回执，但本地恢复记录未确认；保留原回执与操作ID，不再发起登记。':'无法可靠保存原登记操作，已保留原操作并停止写入；不会重新提交。';return false}
}
function archiveAndRelease(result:WorkflowRegistrationResult){
 if(storageBlocked.value){error.value='本地恢复记录仍未确认，保留原回执与操作ID，不释放或重新登记。';return false}
 try{
  if(!pending.value||pending.value.input.operationId!==result.operationId||persistedPending===null)throw Error('REGISTRATION_PENDING_OPERATION_CHANGED')
  const auditBytes=JSON.stringify({schemaVersion:2,result,legacyPath:legacyPath.value,legacyRecordRetained:true})
  archiveRegistrationPending(sessionStorage,{pendingKey:storageKey,expectedPending:persistedPending,auditKey,auditBytes})
  persistedPending=null;pending.value=null;return true
 }catch{storageBlocked.value=true;error.value='已收到回执，但审计或删除回读未确认；保留原回执与操作ID，不释放或重新登记。';return false}
}
async function readRegistry(){
 if(busy.value)return;busy.value=true;error.value=''
 try{const value=await api.snapshot();let effect:typeof legacyEffect.value='unread';if(legacyPath.value){const rows=await api.legacyProjects();effect=rows.some(row=>workflowProjectPathKey(row.path)===workflowProjectPathKey(legacyPath.value!))?'present':'absent'}
  if(!alive)return;snapshot.value=value;legacyEffect.value=effect;legacyReviewed.value=false;approved.value=false;notice.value='已读取工作流专用登记快照。登记只供工作流选择，不启动 Creator，也不授予全仓写入。'
 }catch{if(alive)error.value='读取登记快照失败，未提交任何新登记。'}finally{if(alive)busy.value=false}
}
async function show(){open.value=true;if(!snapshot.value&&!pending.value)await readRegistry()}
async function closeFocus(){await nextTick();trigger.value?.focus()}
function failedReceipt(input:WorkflowRegistrationInput,code:string):WorkflowRegistrationResult{return {schemaVersion:'workflow-project-registration-result-v1',operationId:input.operationId,purpose:'workflow',state:'rejected',project:null,registryRevision:null,effect:'none',git:null,code}}
async function accept(value:Pending,result:WorkflowRegistrationResult){
 if(!alive||pending.value?.input.operationId!==value.input.operationId)return
 if(pending.value.result?.state==='registered'&&result.state!=='registered'){
  if(!keep({...pending.value,phase:'unknown'}))return
  notice.value=`已保留原登记成功回执；本次原操作回读为 ${result.code??result.state}，继续核对原操作，不重新提交。`;return
 }
 const phase=result.state==='registered'?'registered':result.state==='rejected'?'rejected':'unknown'
 if(!keep({...value,phase,result}))return
 if(result.state==='registered'){
  if(!result.project||workflowProjectPathKey(result.project.path)!==workflowProjectPathKey(value.input.path)){error.value='登记回执的工程身份与原请求不匹配，保留原操作。';return}
  let observed:WorkflowRegistrationSnapshot;try{observed=await api.snapshot()}catch{if(alive)error.value='已收到原登记回执，但列表回读未确认；保留原回执与操作ID，不重新登记。';return}if(!alive)return
  const found=observed.projects.find(row=>row.id===result.project!.id&&row.path===result.project!.path)
  if(!found){notice.value='收到登记回执，但列表回读未确认同一工程；保留原操作，不重新提交。';return}
  snapshot.value=observed;if(archiveAndRelease(result)){notice.value=`已读取工作流登记：${found.name}。执行仍只限服务端核定的任务专用目录。`;approved.value=false;emit('registered',found)}
 }else notice.value=result.state==='rejected'?`后台明确拒绝本次登记：${result.code??'WORKFLOW_REGISTRATION_REJECTED'}。原回执保留。`:result.state==='not-observed'?'后台尚未观察到原操作；保留原请求，不重新提交。':'原登记结果仍未确认，只核对原操作，不创建新请求。'
}
async function register(){
 if(!canRegister.value)return;error.value='';notice.value='';const selected=projectPath.value
 try{validateWorkflowProjectPath(selected)}catch(cause){error.value=cause instanceof Error?cause.message:'路径无效';return}
 busy.value=true;let intent:Pending|undefined,received:WorkflowRegistrationResult|undefined
 try{
  const fresh=await api.snapshot();if(!alive)return;snapshot.value=fresh
  const existing=fresh.projects.find(row=>workflowProjectPathKey(row.path)===workflowProjectPathKey(selected))
  if(existing){notice.value=`该工作流工程已登记：${existing.name}`;emit('registered',existing);return}
  if(legacyPath.value){const rows=await api.legacyProjects();if(!alive)return;if(rows.some(row=>workflowProjectPathKey(row.path)===workflowProjectPathKey(legacyPath.value!))){legacyEffect.value='present';legacyReviewed.value=false;error.value='原登记列表已变化，停止新登记，请先核对原记录。';return}}
  const operationId='workflow-register-'+crypto.randomUUID().replace(/-/g,'')
  const input:WorkflowRegistrationInput={operationId,path:selected,purpose:'workflow',expectedRegistryRevision:fresh.revision,approved:true};validateWorkflowRegistrationInput(input)
  intent={schemaVersion:2,input,phase:'intent'};if(!keep(intent))return
  const result=await api.register(input);received=result;await accept(intent,result)
 }catch(cause){if(!alive)return;if(intent){if(!received&&cause instanceof WorkflowRegistrationRequestError&&cause.outcome==='rejected')await accept(intent,failedReceipt(intent.input,cause.code));else{const current=pending.value?.input.operationId===intent.input.operationId?pending.value:intent;keep({...current,phase:'unknown',...(received?{result:received}:{})});error.value='原登记结果未确认。保留原操作ID及已收到的回执，只读取原结果，不重新提交。'}}else error.value='提交前核对失败，未发送新登记。'}
 finally{if(alive)busy.value=false}
}
async function lookup(){
 const original=pending.value;if(!original||busy.value)return;busy.value=true;error.value=''
 try{await accept(original,await api.status(original.input.operationId))}catch{if(alive)error.value='原操作读取失败，保留原记录，不重新提交。'}finally{if(alive)busy.value=false}
}
async function reconcile(){
 const original=pending.value;if(!original||busy.value||!reconcileApproved.value||original.phase==='rejected'||storageBlocked.value)return
 if(!keep({...original,phase:'reconciling'}))return;busy.value=true;error.value='';reconcileApproved.value=false
 try{await accept(original,await api.reconcile(original.input.operationId))}catch{if(alive){const current=pending.value?.input.operationId===original.input.operationId?pending.value:original;keep({...current,phase:'unknown'});error.value='原操作恢复仍未确认，保留原记录及已收到的回执，不重新登记。'}}finally{if(alive)busy.value=false}
}
function reviewRejected(){const result=pending.value?.result;if(!result||result.state!=='rejected'||busy.value)return;if(archiveAndRelease(result)){snapshot.value=null;approved.value=false;legacyReviewed.value=false;notice.value='明确拒绝回执已保留；请重新读取和审阅，尚未发送新请求。'}}
onMounted(()=>{
 try{
  const legacy=sessionStorage.getItem(legacyKey);if(legacy){const value=JSON.parse(legacy);if(value?.schemaVersion!==1)throw Error();validateWorkflowProjectPath(value.path);legacyPath.value=value.path;projectPath.value=value.path}
  const raw=sessionStorage.getItem(storageKey);if(!raw)return;const value=JSON.parse(raw)
  if(value?.schemaVersion!==2||!['intent','unknown','registered','rejected','reconciling'].includes(value.phase))throw Error();validateWorkflowRegistrationInput(value.input)
  if(value.result)value.result=decodeWorkflowRegistrationResult(value.result,value.input.operationId)
  pending.value=value;persistedPending=raw;projectPath.value=value.input.path;open.value=true;notice.value='保留原登记操作；只读核对，不自动查询或重新提交。'
 }catch{storageBlocked.value=true;error.value='原登记恢复记录不可读，停止新登记；没有自动清除任何旧记录。'}
})
onBeforeUnmount(()=>{alive=false})
</script>
<template>
 <section class="workflow-project-registration">
  <button ref="trigger" type="button" class="btn" :aria-expanded="open" @click="show">接入已有开发工程</button>
  <el-dialog v-model="open" title="接入已有开发工程" width="520px" class="workflow-registration-dialog" :close-on-click-modal="false" @closed="closeFocus">
   <form aria-label="登记已有开发工程" @submit.prevent="register">
    <p>使用工作流专用登记。只登记服务端已批准的开发工程；不启动 Creator、不安装桥、不改变账号或全仓权限。</p>
    <p>真实执行仍需逐任务计划审阅，只写 <code>.companion/tasks/&lt;workflowId&gt;</code>。</p>
    <section v-if="legacyPath" class="legacy-registration" aria-label="原登记记录">
     <strong>原入口未确认记录仍保留</strong><p>{{ legacyPath }}</p>
     <p v-if="legacyEffect==='unread'">尚未读取原列表，不自动重发原请求。</p><p v-else-if="legacyEffect==='absent'">本次只读列表未见该工程；这不伪称原HTTP请求已收到终态。</p><p v-else>原列表已存在该工程，请先核对原记录；不新建重复登记。</p>
     <label v-if="legacyEffect==='absent'"><input v-model="legacyReviewed" type="checkbox" :disabled="locked">我已核对本次无登记记录，确认改用专用工作流登记；保留原未知记录，不重放旧请求</label>
    </section>
    <label for="workflow-register-path">工程绝对路径</label><input id="workflow-register-path" v-model="projectPath" :disabled="locked" autocomplete="off" required>
    <button type="button" class="btn" :disabled="busy" @click="readRegistry">读取工作流登记快照</button>
    <template v-if="!pending"><label><input v-model="approved" type="checkbox" :disabled="locked">确认此开发工程与上述任务专用写入范围</label><button type="submit" class="btn primary" :disabled="!canRegister">确认工作流登记</button></template>
    <section v-else class="pending-registration" aria-label="原登记操作">
     <p>原操作：<code>{{ pending.input.operationId }}</code></p><p>状态：{{ pending.phase }}<span v-if="pending.result?.code"> · {{ pending.result.code }}</span></p>
     <button type="button" class="btn" :disabled="busy" @click="lookup">读取原登记结果</button>
     <button v-if="pending.phase==='rejected'" type="button" class="btn" :disabled="busy" @click="reviewRejected">保留明确拒绝回执并重新审阅</button>
     <template v-else><p>原操作恢复只核对既有记录，并完成能够证明安全的元数据结算；不重新登记或创建新操作。</p><label><input v-model="reconcileApproved" type="checkbox" :disabled="busy||storageBlocked">确认仅恢复上面这个原操作</label><button type="button" class="btn" :disabled="busy||storageBlocked||!reconcileApproved" @click="reconcile">明确恢复原操作</button></template>
    </section>
    <p v-if="notice" role="status">{{ notice }}</p><p v-if="error" role="alert">{{ error }}</p>
   </form>
  </el-dialog>
 </section>
</template>
<style scoped>
.workflow-project-registration{display:inline-flex;min-width:0}form{display:grid;gap:10px;min-width:0;font:14px/1.55 "Microsoft YaHei",system-ui,sans-serif;color:#253345}input,button{font:inherit}input:not([type=checkbox]){padding:7px 9px;min-width:0;width:100%;border:1px solid #dce3ec;border-radius:5px}p{margin:0;overflow-wrap:anywhere}label{font-size:12px;color:#66758b}code{font-size:11px;overflow-wrap:anywhere}.btn{font:12px/1.4 "Microsoft YaHei",system-ui,sans-serif;border:1px solid #dce3ec;border-radius:5px;background:#fff;color:#253345;padding:6px 10px;cursor:pointer;width:fit-content}.primary{background:#315fb2;border-color:#315fb2;color:#fff}button:disabled{opacity:.5;cursor:not-allowed}.legacy-registration,.pending-registration{display:grid;gap:8px;border:1px solid #dce3ec;background:#f4f6f9;padding:12px;border-radius:6px}.workflow-registration-dialog{max-width:calc(100vw - 24px)}[role=alert]{color:#b34645}input:focus-visible,button:focus-visible{outline:2px solid #315fb2;outline-offset:2px}
</style>
