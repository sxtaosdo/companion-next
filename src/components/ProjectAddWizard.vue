<script setup lang="ts">
import { sortProjectsByRecentOpen } from '../domain/recent-projects'
import { computed,onBeforeUnmount,ref,watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import AgentRegistrationPanel from './AgentRegistrationPanel.vue'
import SetupCompletionUsage from './SetupCompletionUsage.vue'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useProjectSetupAddStore } from '../stores/project-setup-add'
import { useProjectOperationLaneStore } from '../stores/project-operation-lane'
import { useProjectScaffoldStore } from '../stores/project-scaffold'
import { projectSetupProvider } from '../project-setup-integration'
import { projectDisplayPathKey } from '../domain/companion-project-display'
import type { DashboardProject } from '../domain/companion-browser'
import { runtimeStateLabel } from '../domain/companion-browser'
import { setupStageLabel,validateProjectPath,ProjectSetupError,buildSetupCompletionPrompt } from '../domain/project-setup'
const emit=defineEmits<{(event:'dialog-visibility',open:boolean):void}>(),browser=useCompanionBrowserStore(),store=useProjectSetupAddStore(),lane=useProjectOperationLaneStore(),scaffold=useProjectScaffoldStore()
const open=ref(false),step=ref(1),mode=ref<'custom'|'dashboard'|'create'|'initialize'>('custom'),path=ref(''),parent=ref(''),name=ref(''),localError=ref(''),working=ref(false)
const labels={custom:'自定义项目目录',dashboard:'来自 Cocos Dashboard',create:'创建 Cocos 项目',initialize:'初始化空目录'}
function registered(item:DashboardProject){return browser.projects.find(p=>projectDisplayPathKey(p.path)===projectDisplayPathKey(item.path))}
function dashboardStatus(item:DashboardProject){const project=registered(item),runtime=browser.statuses.find(s=>s.projectId===project?.id);if(!item.exists)return '路径不存在';if(item.running&&!project)return `Dashboard 已启动${item.pid?` · PID ${item.pid}`:''}`;if(!project)return '未接入';if(runtime?.state==='ready')return '已接入 · 已就绪';return runtime?.state?`已接入 · ${runtimeStateLabel(runtime.state)}`:'已接入'}
const dashboardItems=computed(()=>sortProjectsByRecentOpen(browser.dashboard,item=>registered(item)?.id??projectDisplayPathKey(item.path)))
const createTarget=computed(()=>parent.value.replace(/[\\/]+$/u,'')+(parent.value.startsWith('/')?'/':'\\')+name.value)
const phases={idle:'尚未开始',reading:'正在读取工具范围',prepared:'确认工程',submitting:'正在提交启动',tracking:'正在启动',paused:'已停止等待',complete:'接入完成',failed:'启动失败',unknown:'结果待核对',error:'请核对'}
const errorText:Record<string,string>={'invalid-path':'请填写有效的工程绝对路径。','add-unavailable':'当前来源未提供严格启动与工具范围接口，未提交任务。','scope-read-failed':'工具范围读取失败，未启动工程。','setup-unknown':'启动结果未知，请核对原任务，不要重复提交。','setup-failed':'原启动任务失败，可能已有部分修改。','poll-budget':'等待已达上限，可继续读取原任务。','status-or-scope-unconfirmed':'原任务或工具范围结果未确认，只能继续核对原任务，不会重发启动或配置。','transport-unsettled':'请求尚未确认结束，操作仍受保护。','source-changed':'来源已变化，原操作仍受保护。','waiting-stopped':'已停止等待，未取消后台任务。'}
let alive=true,dialogEpoch=0,formEpoch=0,sourceEpoch=0
watch(()=>[browser.provider,browser.provider?.label,projectSetupProvider.value,projectSetupProvider.value?.label],()=>{sourceEpoch++},{flush:'sync'})
watch([mode,path,parent,name],()=>{formEpoch++;if(!hasTask.value)store.clearRead()},{flush:'sync'})
const hasTask=computed(()=>!!store.operationId||['unknown','submitting','tracking','paused'].includes(store.phase))
function show(){dialogEpoch++;if(!hasTask.value){store.clearRead();step.value=1;mode.value='custom';localError.value=''}else step.value=3;open.value=true;emit('dialog-visibility',true)}
function close(){dialogEpoch++;open.value=false;browser.cancelDashboardRead();store.pause();emit('dialog-visibility',false)}
async function nextSource(){step.value=2}
async function nextProject(){
 if(working.value||lane.locked)return;const dialog=dialogEpoch,form=formEpoch,source=sourceEpoch;const current=()=>alive&&open.value&&dialog===dialogEpoch&&form===formEpoch&&source===sourceEpoch;working.value=true;localError.value=''
 try{
  if(mode.value==='create'||mode.value==='initialize'){
   scaffold.prepare(mode.value==='create'?{mode:'create',parentPath:parent.value,projectName:name.value,creatorVersion:'3.8.8'}:{mode:'initialize',path:path.value,creatorVersion:'3.8.8'})
   if(!scaffold.prepared)return
   const result=await scaffold.send(scaffold.prepared,true);if(!result||!current())return;path.value=result.path
  }
  validateProjectPath(path.value);const preparedForm=formEpoch;if(await store.prepare(path.value)&&alive&&open.value&&dialog===dialogEpoch&&preparedForm===formEpoch&&source===sourceEpoch)step.value=3
 }catch{localError.value='请填写或选择有效工程路径。'}finally{working.value=false}
}
async function pick(parentOnly=false){
 const api=projectSetupProvider.value,reader=browser.provider;if(!api?.pickDirectory||lane.locked||working.value||!browser.connected)return
 const lease=lane.acquire('选择工程目录');if(!lease)return;const dialog=dialogEpoch,form=formEpoch,source=sourceEpoch;working.value=true;localError.value='';let known=false
 try{const result=await api.pickDirectory();if(result!==undefined)validateProjectPath(result);known=true;if(alive&&open.value&&dialog===dialogEpoch&&form===formEpoch&&source===sourceEpoch&&api===projectSetupProvider.value&&reader===browser.provider&&result!==undefined){if(parentOnly)parent.value=result;else path.value=result}}
 catch(cause){known=cause instanceof ProjectSetupError&&cause.outcome==='rejected';localError.value='目录选择结果未确认或路径无效，请先核对原系统窗口。'}
 finally{try{await api.waitForIdle();if(known)lane.release(lease)}catch{localError.value='目录请求尚未结束，操作仍受保护。'}working.value=false}
}
async function launch(){if(await store.start())return}
async function nextAgents(){if(store.phase==='complete'&&store.project)step.value=4}
function finish(){step.value=5}
const completionUsage=computed(()=>{
 const project=store.project,snapshot=store.snapshot
 if(!open.value||store.phase!=='complete'||!browser.connected||!project||!snapshot||snapshot.stage!=='complete'||snapshot.id!==store.operationId||snapshot.projectId!==project.id||projectDisplayPathKey(snapshot.projectPath)!==projectDisplayPathKey(project.path)||!browser.projects.some(item=>item.id===project.id&&item.name===project.name&&item.path===project.path))return null
 const prompt=buildSetupCompletionPrompt(snapshot.mcpName)
 return prompt?{project:{...project},prompt}:null
})
defineExpose({open:show,close})
onBeforeUnmount(()=>{alive=false;dialogEpoch++;browser.cancelDashboardRead();store.pause();emit('dialog-visibility',false)})
</script>
<template>
 <span class="project-add-entry"><el-button size="small" :icon="Plus" :disabled="!browser.connected||(lane.locked&&!hasTask)" @click="show">添加已有工程</el-button><span v-if="hasTask" role="status">{{ phases[store.phase] }}</span><el-button v-if="store.canResume" size="small" @click="store.resume">继续读取原任务</el-button></span>
 <el-dialog class="project-setup-dialog" modal-class="project-setup-overlay" :model-value="open" title="添加项目" width="720px" :close-on-click-modal="false" @update:model-value="!$event&&close()">
 <div class="setup-timeline" data-testid="legacy-add-wizard">
  <section v-for="n in 5" :key="n" class="setup-timeline-item" :class="{active:step===n,done:step>n}"><button class="setup-timeline-heading" type="button" :disabled="lane.locked||n>step||working" :aria-expanded="step===n" @click="step=n"><span class="setup-timeline-node"/>{{ ['选择来源','选择工程','通过 Dashboard 启动 Creator','选择 Agent','完成'][n-1] }}</button>
  <div v-if="step===n" class="setup-timeline-panel">
   <template v-if="n===1"><el-radio-group class="setup-source-options" v-model="mode" aria-label="工程来源"><el-radio v-for="(label,value) in labels" :key="value" :value="value" border>{{ label }}</el-radio></el-radio-group><el-button type="primary" @click="nextSource">下一步</el-button></template>
   <template v-if="n===2"><template v-if="mode==='create'"><label>父目录</label><div class="path-row"><el-input v-model="parent" aria-label="新工程父目录"/><el-button v-if="projectSetupProvider?.pickDirectory" :disabled="lane.locked||working" @click="pick(true)">选择父目录…</el-button></div><label>项目名称</label><el-input v-model="name" aria-label="新工程名称"/></template><template v-else><label>{{ mode==='initialize'?'空目录':'工程路径' }}</label><div class="path-row"><el-input v-model="path" aria-label="已有工程绝对路径"/><el-button v-if="projectSetupProvider?.pickDirectory" :disabled="lane.locked||working" @click="pick()">选择目录…</el-button></div></template><p v-if="mode==='create'&&parent&&name">请求目标：{{ createTarget }}</p><p v-if="mode==='create'||mode==='initialize'">Creator 3.8.8</p><template v-if="mode==='dashboard'"><el-button :loading="browser.dashboardLoading" :disabled="browser.dashboardLoading||lane.locked" @click="browser.refreshDashboard">刷新 Dashboard 工程</el-button><p v-if="browser.dashboardError" role="alert">Dashboard 工程读取失败</p><p v-else-if="!browser.dashboardRead&&!browser.dashboardLoading">尚未读取 Dashboard 工程</p><p v-else-if="browser.dashboardRead&&!browser.dashboard.length">本机未发现 Dashboard 工程</p><button v-for="item in dashboardItems" :key="item.path" type="button" class="dashboard-item" :disabled="!item.exists" :aria-pressed="path===item.path" @click="path=item.path">{{ item.name }} · {{ dashboardStatus(item) }} · {{ item.version?`Creator ${item.version}`:'' }} {{ item.progress?`状态 ${item.progress}`:'' }} · {{ item.path }}</button></template><div class="actions"><el-button @click="step=1">上一步</el-button><el-button type="primary" :loading="working" :disabled="lane.locked||((mode==='create'||mode==='initialize')&&!projectSetupProvider?.scaffold)" @click="nextProject">下一步</el-button></div></template>
   <template v-if="n===3"><p>确认工程后由 Cocos Dashboard 启动对应 Creator（Bridge / 工程登记）；不会直接执行 Creator --project。</p><label>工程路径</label><p>{{ store.target }}</p><label>工具范围</label><el-select popper-class="project-setup-select-popper" :model-value="store.presetId" aria-label="向导工具范围" :disabled="hasTask||store.busy" @update:model-value="store.selectPreset"><el-option v-for="preset in store.presets?.presets??[]" :key="preset.id" :value="preset.id" :label="preset.name"/></el-select><p>新工程默认全部工具；已有工程保留当前范围，只有明确改变选择才更新。</p><el-button :disabled="lane.locked" @click="step=2">上一步</el-button><el-button type="primary" :loading="store.phase==='submitting'" :disabled="!store.canStart" @click="launch">通过 Dashboard 启动 Creator</el-button><section v-if="hasTask||store.snapshot" data-testid="add-setup-receipt" role="status"><strong>{{ phases[store.phase] }}</strong><p v-if="store.operationId">任务 ID：{{ store.operationId }}</p><p v-if="store.snapshot">{{ setupStageLabel(store.snapshot.stage) }}</p><el-button v-if="store.canResume" @click="store.resume">继续读取原任务</el-button><el-button v-if="store.phase==='tracking'||store.phase==='submitting'" @click="store.pause">停止等待</el-button></section><el-button v-if="store.phase==='complete'" type="primary" @click="nextAgents">下一步</el-button></template>
   <template v-if="n===4"><AgentRegistrationPanel v-if="store.project" :project-id="store.project.id" wizard single-confirm @skip="finish" @complete="finish"/></template>
   <template v-if="n===5"><p>添加流程完成。当前工程状态以工程页实时读取为准。</p><SetupCompletionUsage v-if="completionUsage" :usage="completionUsage"/></template>
  </div></section>
 </div><section v-if="scaffold.receipt" data-testid="scaffold-receipt" role="status"><p>{{ scaffold.receipt.message }}</p><p>{{ scaffold.receipt.result?.path }}</p></section><el-alert v-if="localError||store.error||scaffold.error" :title="localError||errorText[store.error]||store.error||scaffold.error" type="warning" :closable="false"/><template #footer><el-button @click="close">关闭向导</el-button></template>
 </el-dialog>
</template>
<style scoped>.project-add-entry,.path-row,.actions{display:flex;align-items:center;gap:8px}.path-row .el-input{flex:1;min-width:0}.setup-timeline-panel{display:grid;gap:12px}p{margin:0;overflow-wrap:anywhere}label{font-weight:500}</style>
