<script setup lang="ts">
import AgentRegistrationPanel from './AgentRegistrationPanel.vue'
import SetupToolScopePanel from './SetupToolScopePanel.vue'
import { projectConnectionsProvider } from '../project-connections-integration'
import { computed,onBeforeUnmount,ref,watch } from 'vue'
import { Plus,Refresh } from '@element-plus/icons-vue'
import SetupCompletionUsage from './SetupCompletionUsage.vue'
import InfoTip from './InfoTip.vue'
import '../styles/project-setup-theme.css'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useProjectSetupStore } from '../stores/project-setup'
import { useProjectScaffoldStore } from '../stores/project-scaffold'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { useProjectOperationLaneStore } from '../stores/project-operation-lane'
import { ProjectSetupError,projectScaffoldTarget,setupStageLabel,validateProjectPath } from '../domain/project-setup'
import { projectSetupProvider } from '../project-setup-integration'
import type { DashboardProject } from '../domain/companion-browser'
import { projectDisplayPathKey,projectDisplayRank } from '../domain/companion-project-display'
const emit=defineEmits<{(event:'dialog-visibility',open:boolean):void}>()
const projects=useCompanionBrowserStore(),store=useProjectSetupStore(),lane=useProjectOperationLaneStore()
const scaffold=useProjectScaffoldStore()
const agentsSkipped=ref(false)
const open=ref(false),path=ref(''),projectId=ref('')
const sourceMode=ref<'custom'|'dashboard'|'create'|'initialize'>('custom'),parentPath=ref(''),projectName=ref('')
const pickingDirectory=ref(false),directoryError=ref('')
const consents=ref({installBridge:false,startCreator:false,configureCodex:false,acknowledgeReuse:false,acknowledgeToolScope:false})
const selected=computed(()=>projects.projects.find(p=>p.id===projectId.value)??null)
function registered(item:DashboardProject){return projects.projects.find(p=>projectDisplayPathKey(p.path)===projectDisplayPathKey(item.path))}
function dashboardStatus(item:DashboardProject){
 const target=registered(item),runtime=projects.statuses.find(s=>s.projectId===target?.id)
 if(!item.exists)return '路径不存在'
 if(item.running&&!target)return `Dashboard 已启动${item.pid?` · PID ${item.pid}`:''}`
 if(!target)return '未添加'
 if(runtime?.state==='ready')return '已接入 · ready'
 if(runtime?.state)return `已添加 · ${runtime.state}`
 return item.running?`Dashboard 已启动${item.pid?` · PID ${item.pid}`:''}`:'已添加'
}
const dashboardItems=computed(()=>[...projects.dashboard].sort((left,right)=>{
 const rank=(item:DashboardProject)=>projectDisplayRank(item.running?'dashboard-running':projects.statuses.find(s=>s.projectId===registered(item)?.id)?.state,item.lastOpenedAt)
 const a=rank(left),b=rank(right);return b[0]-a[0]||b[1]-a[1]
}))
function dashboardDate(value:number){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString():'时间未知'}
function selectDashboard(item:DashboardProject){
 if(lane.locked||!projects.connected||!item.exists||!projects.dashboard.includes(item))return
 sourceMode.value='dashboard';path.value=item.path;projectId.value=registered(item)?.id??''
}
const strictOptions=computed(()=>typeof projectSetupProvider.value?.startStrict==='function')
const completedSetup=computed(()=>open.value&&store.completedSetup?.project.id===selected.value?.id?store.completedSetup:null)
const completionUsage=computed(()=>open.value&&store.completedUsage?.project.id===selected.value?.id?store.completedUsage:null)
watch(()=>[completedSetup.value?.project.id,completedSetup.value?.project.path,store.setupReceipt?.operationId],()=>{agentsSkipped.value=false},{flush:'sync'})
const allConsented=computed(()=>strictOptions.value ? consents.value.installBridge&&consents.value.acknowledgeReuse&&consents.value.acknowledgeToolScope : Object.values(consents.value).every(value=>value===true))
const activeTask=computed(()=>!!store.setupReceipt&&['submitting','tracking','paused','unknown'].includes(store.setupReceipt.phase))
const resumableTask=computed(()=>!!store.setupReceipt&&['paused','unknown'].includes(store.setupReceipt.phase))
const hasReceipt=computed(()=>!!store.registrationReceipt||!!store.setupReceipt||!!scaffold.receipt)
const compactStatus=computed(()=>{
 if(scaffold.pending)return '正在创建 / 初始化工程目录'
 if(scaffold.receipt?.phase==='unknown')return '目录请求结果未知，请核对原目标'
 if(store.registrationReceipt?.phase==='sending')return '正在登记工程'
 const receipt=store.setupReceipt
 if(receipt?.phase==='submitting')return `${receipt.project.name} · 正在提交接入`
 if(receipt?.phase==='tracking')return `${receipt.project.name} · ${receipt.snapshot?setupStageLabel(receipt.snapshot.stage):'接入中'}`
 if(receipt?.phase==='paused')return `${receipt.project.name} · 已暂停读取，后台可能仍在运行`
 if(receipt?.phase==='unknown')return `${receipt.project.name} · 接入结果未知，请到原宿主核对`
 if(store.registrationReceipt?.phase==='unknown')return '登记结果未知，请核对原来源'
 if(receipt?.phase==='failed')return `${receipt.project.name} · 接入失败，可能有部分改动`
 return store.error?'接入操作需核对':''
})
const statusDetails=computed(()=>{
 const details:string[]=[]
 const registration=store.registrationReceipt,setup=store.setupReceipt
 if(scaffold.receipt)details.push(`目录请求：${projectScaffoldTarget(scaffold.receipt.input)}`,`目录回执：${scaffold.receipt.message}`)
 if(registration){
  details.push(`登记请求路径：${registration.requestedPath}`)
  if(registration.project)details.push(`登记工程：${registration.project.name} · ${registration.project.id}`,`后台规范路径：${registration.project.path}`)
  details.push(`登记回执：${registration.message}`)
 }
 if(setup)details.push(`任务 ID：${setup.operationId??'尚未取得可核实的任务标识'}`,`接入工程：${setup.project.name} · ${setup.project.id}`,`完整路径：${setup.project.path}`,`接入回执：${setup.message}`)
 if(store.error&&store.error!==registration?.message&&store.error!==setup?.message)details.push(`错误：${store.error}`)
 details.push('以上为原请求回执，接口未提供来源标签；请核对原宿主，不能据此判断当前连接状态。')
 return details.join('；')
})
let mounted=true,contextEpoch=0,dialogEpoch=0,formEpoch=0
watch(()=>[projects.provider,projectSetupProvider.value,projects.connected,JSON.stringify(projects.projects)],()=>{contextEpoch++;store.clearPrepared();scaffold.clearPrepared()},{flush:'sync'})
watch([path,projectId,sourceMode,parentPath,projectName,()=>JSON.stringify(consents.value)],()=>{formEpoch++;store.clearPrepared();scaffold.clearPrepared()},{flush:'sync'})
watch(open,value=>emit('dialog-visibility',value),{flush:'sync',immediate:true})
function resetConsents(){consents.value={installBridge:false,startCreator:false,configureCodex:false,acknowledgeReuse:false,acknowledgeToolScope:false}}
function show(id=''){if(lane.locked)return;agentsSkipped.value=false;dialogEpoch++;useCreatorOperationsStore().closeDialog();store.clearPrepared();scaffold.clearPrepared();sourceMode.value='custom';resetConsents();directoryError.value='';projectId.value=id;open.value=true}
function close(){dialogEpoch++;store.clearPrepared();scaffold.clearPrepared();store.stopWaiting();projects.cancelDashboardRead();open.value=false}
async function pickDirectory(target:'path'|'parent'='path'){
 const api=projectSetupProvider.value,source=projects.provider
 if(!mounted||!open.value||!projects.connected||lane.locked||!api?.pickDirectory)return
 const epoch=contextEpoch,dialog=dialogEpoch,form=formEpoch,originalPath=target==='parent'?parentPath.value:path.value,readLabel=source?.label,writeLabel=api.label
 const lease=lane.acquire('选择工程目录');if(!lease)return
 const current=()=>mounted&&open.value&&projects.connected&&dialog===dialogEpoch&&epoch===contextEpoch&&form===formEpoch&&source===projects.provider&&api===projectSetupProvider.value&&source?.label===readLabel&&api.label===writeLabel&&(target==='parent'?parentPath.value:path.value)===originalPath
 store.clearPrepared();scaffold.clearPrepared();directoryError.value='';pickingDirectory.value=true
 let terminalReply=false
 try{
  // Leaving the page only discards the reply; it cannot cancel the native dialog.
  const result=await api.pickDirectory()
  if(result!==undefined)validateProjectPath(result)
  terminalReply=true
  if(!current()||result===undefined)return
  if(target==='parent')parentPath.value=validateProjectPath(result)
  else{path.value=validateProjectPath(result);projectId.value=projects.projects.find(p=>projectDisplayPathKey(p.path)===projectDisplayPathKey(result))?.id??''}
 }catch(error){
  terminalReply=error instanceof ProjectSetupError&&error.outcome==='rejected'
  if(current())directoryError.value=error instanceof ProjectSetupError?`${new ProjectSetupError(error.code,error.outcome).message} 请先核对原系统窗口；页面取消不会关闭系统窗口。`:'无法读取目录选择结果；请先核对原系统窗口，不会自动重试。'
 }finally{
  let cleaned=false
  try{await api.waitForIdle();cleaned=true}catch{if(mounted)directoryError.value='无法确认目录请求已结束，工程操作仍被锁定；请核对原宿主。'}
  pickingDirectory.value=false
  // Transport completion cannot prove an unknown native dialog has closed.
  if(cleaned&&terminalReply)lane.release(lease)
 }
}
function prepareScaffold(){
 store.clearPrepared()
 if(sourceMode.value==='create')scaffold.prepare({mode:'create',parentPath:parentPath.value,projectName:projectName.value,creatorVersion:'3.8.8'})
 else if(sourceMode.value==='initialize')scaffold.prepare({mode:'initialize',path:path.value,creatorVersion:'3.8.8'})
}
async function submitScaffold(){
 const preview=scaffold.prepared;if(!preview)return
 const source=projects.provider,api=projectSetupProvider.value,epoch=contextEpoch,dialog=dialogEpoch,form=formEpoch,readLabel=source?.label,writeLabel=api?.label
 const result=await scaffold.send(preview,true)
 if(!result||!mounted||!open.value||!projects.connected||contextEpoch!==epoch||dialogEpoch!==dialog||formEpoch!==form||projects.provider!==source||projectSetupProvider.value!==api||source?.label!==readLabel||api?.label!==writeLabel)return
 path.value=result.path;projectId.value=projects.projects.find(p=>projectDisplayPathKey(p.path)===projectDisplayPathKey(result.path))?.id??''
 sourceMode.value='custom'
}
async function register(){
 const preview=store.preparedRegistration;if(!preview)return
 const source=projects.provider,epoch=contextEpoch,dialog=dialogEpoch
 const acknowledged=await store.sendRegistration(preview,true)
 if(acknowledged&&mounted&&open.value&&dialog===dialogEpoch&&projects.connected&&source===projects.provider&&contextEpoch===epoch){
  await projects.refreshProjects()
  if(mounted&&open.value&&dialog===dialogEpoch&&source===projects.provider&&projects.connected&&store.registrationReceipt?.project){
   const returned=store.registrationReceipt.project
   const found=projects.projects.find(p=>p.id===returned.id&&p.path===returned.path&&p.name===returned.name)
   if(found)projectId.value=found.id
  }
 }
}
function prepareFull(){if(selected.value)store.prepareSetup(selected.value.id,{...consents.value})}
async function submitFull(){const preview=store.preparedSetup;if(preview)await store.sendSetup(preview,true)}
function visibility(){store.setVisible(document.visibilityState==='visible')}
visibility();document.addEventListener('visibilitychange',visibility)
onBeforeUnmount(()=>{mounted=false;store.leave();scaffold.clearPrepared();projects.cancelDashboardRead();document.removeEventListener('visibilitychange',visibility);emit('dialog-visibility',false)})
defineExpose({openForProject:show,close})
</script>
<template>
 <div class="project-setup-toolbar" data-testid="project-setup-panel">
  <el-button size="small" :icon="Plus" :disabled="!projects.connected||lane.locked" @click="show()">添加已有工程</el-button>
  <span v-if="compactStatus" class="setup-status" data-testid="project-setup-status" role="status">{{ compactStatus }}</span>
  <InfoTip v-if="compactStatus||(lane.locked&&hasReceipt)" label="登记与接入状态详情" :text="statusDetails"/>
  <el-button v-if="resumableTask" size="small" :disabled="!store.canResume" @click="store.resume()">继续读取此任务</el-button>
  <el-button v-if="store.pending||store.tracking" size="small" @click="store.stopWaiting()">停止等待接入</el-button>
 </div>
 <el-dialog class="project-setup-dialog" modal-class="project-setup-overlay" :model-value="open" title="已有工程：登记与安装接入" width="760px" :close-on-click-modal="false" @update:model-value="(value:boolean)=>{if(!value)close()}">
   <section class="setup-step"><h3>1. 工程来源与登记</h3>
    <el-radio-group v-model="sourceMode" :disabled="lane.locked" aria-label="工程来源"><el-radio-button value="custom">已有工程</el-radio-button><el-radio-button value="dashboard">Dashboard</el-radio-button><el-radio-button value="create">创建项目</el-radio-button><el-radio-button value="initialize">初始化空目录</el-radio-button></el-radio-group>
    <section v-if="sourceMode==='create'||sourceMode==='initialize'" class="scaffold-fields" aria-label="创建与初始化工程">
     <template v-if="sourceMode==='create'"><label>父目录</label><div class="setup-path-row"><el-input v-model="parentPath" :disabled="lane.locked" :maxlength="4096" aria-label="新工程父目录"/><el-button v-if="projectSetupProvider?.pickDirectory" :loading="pickingDirectory" :disabled="!projects.connected||lane.locked" @click="pickDirectory('parent')">选择父目录…</el-button></div><label>工程名称</label><el-input v-model="projectName" :disabled="lane.locked" :maxlength="128" aria-label="新工程名称"/></template>
     <p v-else>在下方工程路径中填写或选择已存在的空目录。</p>
     <p>Creator 3.8.8。仅写入最小 package.json 和空 assets；不登记、安装或启动。新建目标须不存在，初始化目标须为空；失败可能留下新建的父目录。</p>
     <el-button :disabled="!projects.connected||lane.locked||!projectSetupProvider?.scaffold" @click="prepareScaffold">{{ sourceMode==='create'?'核对创建工程':'核对初始化目录' }}</el-button>
     <div v-if="scaffold.prepared" class="setup-confirm" data-testid="scaffold-confirm"><p>请求目标：{{ projectScaffoldTarget(scaffold.prepared.input) }}</p><p>来源：{{ scaffold.prepared.sourceLabel }}</p><p>将创建最小工程文件。关闭页面不取消文件写入；结果未知时不会自动重发。</p><el-button type="primary" @click="submitScaffold">{{ scaffold.prepared.input.mode==='create'?'确认创建工程':'确认初始化空目录' }}</el-button></div>
    </section>
    <p>登记不会安装 Bridge、启动 Creator 或配置 Codex。后台校验工程并返回规范路径；已有登记返回原记录。请核对返回路径后，再单独确认安装接入。</p>
    <div class="setup-path-row"><el-input v-model="path" :disabled="lane.locked" :maxlength="4096" aria-label="已有工程绝对路径" placeholder="例如 D:\Games\MyProject"/><el-button v-if="projectSetupProvider?.pickDirectory" :loading="pickingDirectory" :disabled="!projects.connected||lane.locked" @click="pickDirectory('path')">选择目录…</el-button></div>
    <el-alert v-if="directoryError" :title="directoryError" type="error" :closable="false"/>
     <section v-if="projects.provider?.loadDashboardProjects&&(sourceMode==='custom'||sourceMode==='dashboard')" class="setup-dashboard" aria-label="Dashboard 工程发现">
      <div class="planner-import-actions"><h4>Dashboard 工程</h4><el-button size="small" :icon="Refresh" :loading="projects.dashboardLoading" :disabled="!projects.connected||lane.locked||projects.dashboardLoading" @click="projects.refreshDashboard()">刷新 Dashboard 工程</el-button><InfoTip label="Dashboard 工程发现说明" text="读取 Dashboard / Creator 本地工程列表、路径存在性和 Creator 进程信息。点选仅填入路径；登记与安装接入仍需分别确认。工程状态轮询不会刷新此列表。"/></div>
      <el-alert v-if="projects.dashboardError" title="Dashboard 工程读取失败" :description="projects.dashboardError" type="error" :closable="false"/>
      <p v-else-if="!projects.dashboardRead&&!projects.dashboardLoading">尚未读取 Dashboard 工程。</p>
      <p v-else-if="projects.dashboardRead&&!dashboardItems.length">本次未读到 Dashboard / Creator 工程。</p>
      <p v-if="projects.dashboardRead">读取时间：{{ new Date(projects.dashboardObservedAt).toLocaleString() }}</p>
      <div class="setup-dashboard-list"><button v-for="item in dashboardItems" :key="item.path" type="button" class="dashboard-item" :class="{selected:path===item.path,registered:!!registered(item)}" :aria-pressed="path===item.path" :disabled="!item.exists||!projects.connected||lane.locked" @click="selectDashboard(item)"><span class="dashboard-heading"><strong>{{ item.name }}</strong><span>{{ dashboardStatus(item) }}</span></span><span class="dashboard-meta">{{ [item.version?`Creator ${item.version}`:'',item.source==='dashboard'?'Dashboard':item.source==='creator-editor'?'Creator':'来源未知',item.progress?`状态 ${item.progress}`:'',item.lastOpenedAt===undefined?'':`最近打开 ${dashboardDate(item.lastOpenedAt)}`].filter(Boolean).join(' · ') }}</span><span class="dashboard-path">{{ item.path }}</span></button></div>
     </section>
    <p>缺少工具绑定时默认 full（全部工具）。重新登记不会恢复已移除的绑定，请另行核对工具清单。</p>
    <el-button :disabled="!projects.connected||lane.locked||sourceMode==='create'||sourceMode==='initialize'" @click="store.prepareRegistration(path)">核对仅登记</el-button>
    <div v-if="store.preparedRegistration" class="setup-confirm" data-testid="registration-confirm"><p>待发送路径：{{ store.preparedRegistration.path }}</p><p>来源：{{ store.preparedRegistration.sourceLabel }}</p><p>仅发送登记请求；成功后重读工程与状态，可能探测 Bridge 并更新诊断日志。</p><el-button type="primary" @click="register">确认仅登记此路径</el-button></div>
   </section>
   <section class="setup-step"><h3>2. 完整安装接入</h3>
    <el-select popper-class="project-setup-select-popper" v-model="projectId" :disabled="lane.locked" aria-label="安装接入登记工程" placeholder="选择已登记工程"><el-option v-for="project in projects.projects" :key="project.id" :value="project.id" :label="`${project.name} · ${project.id}`"/></el-select>
    <p v-if="selected">{{ selected.name }} · {{ selected.id }}<br>{{ selected.path }}</p>
    <p>以下五项均需主动勾选。安装可能覆盖未登记的 extensions/creator-ai-bridge 保留目录；失败不保证回滚，Codex 写入或迁移失败也可能留下部分配置。</p>
    <div class="setup-consents">
     <el-checkbox v-model="consents.installBridge" :disabled="lane.locked">允许安装 / 更新 / 接管该工程的 Bridge 扩展及安装登记</el-checkbox>
     <el-checkbox v-model="consents.startCreator" :disabled="lane.locked">允许经 Dashboard 启动 / 复用 Creator 并验证 Bridge</el-checkbox>
     <el-checkbox v-model="consents.configureCodex" :disabled="lane.locked">允许配置 / 迁移 Codex 中此工程的持久 MCP 接入</el-checkbox>
     <el-checkbox v-model="consents.acknowledgeToolScope" :disabled="lane.locked">同意按当前工具范围接入；缺少绑定时可能是 full（全部工具），本向导不改变范围</el-checkbox>
     <el-checkbox v-model="consents.acknowledgeReuse" :disabled="lane.locked">接受可能复用已有任务；原选项 / 实际步骤无法核验，完成回执不能证明本次选项已执行</el-checkbox>
    </div>
    <el-alert type="info" :closable="false" :title="strictOptions?'Bridge 必选；Creator 与 Codex 可独立选择。服务须支持严格选项合同，否则不会发送安装请求。':'仅支持完整接入。严格只装 Bridge 或保证不配置 Codex 暂不可提交：后台复用任务时不核对新选项。'"/>
    <el-button :disabled="!projects.connected||!selected||!allConsented||lane.locked" @click="prepareFull">{{ strictOptions?'核对所选安装步骤':'核对完整安装接入' }}</el-button>
    <div v-if="store.preparedSetup" class="setup-confirm" data-testid="full-setup-confirm"><strong>{{ store.preparedSetup.project.name }} · {{ store.preparedSetup.project.id }}</strong><p>{{ store.preparedSetup.project.path }}</p><p>来源：{{ store.preparedSetup.sourceLabel }}</p><p>将请求安装 Bridge；Creator {{ store.preparedSetup.effectiveOptions ? (store.preparedSetup.effectiveOptions.startCreator?'启动及验证':'不启动') : '启动及验证' }}；Codex {{ store.preparedSetup.effectiveOptions ? (store.preparedSetup.effectiveOptions.configureCodex?'配置':'不配置') : '配置' }}。202 仅表示任务已接受；关闭 / 停止等待不取消后台。刷新页面会丢失本页任务记录和互斥保护；本页不能锁定其他标签页或客户端。</p><el-button type="warning" @click="submitFull">{{ strictOptions?'确认执行所选安装步骤':'确认完整安装并接入 Codex' }}</el-button></div>
   </section>
  <section v-if="hasReceipt" class="setup-step setup-receipts" aria-label="登记与接入回执">
   <h3>当前回执</h3>
   <article v-if="scaffold.receipt" class="setup-result" data-testid="scaffold-receipt" role="status"><strong>目录请求 · {{ projectScaffoldTarget(scaffold.receipt.input) }}</strong><p>{{ scaffold.receipt.message }}</p><p v-if="scaffold.receipt.result">返回路径：{{ scaffold.receipt.result.path }} · Creator {{ scaffold.receipt.result.creatorVersion }}</p><p>来源：{{ scaffold.receipt.sourceLabel }}</p></article>
   <article v-if="store.registrationReceipt" class="setup-result" data-testid="registration-receipt" role="status">
    <strong>登记 · {{ store.registrationReceipt.requestedPath }}</strong><p>{{ store.registrationReceipt.message }}</p>
    <dl v-if="store.registrationReceipt.project"><dt>后台规范路径</dt><dd>{{ store.registrationReceipt.project.path }}</dd><dt>登记名称 / ID</dt><dd>{{ store.registrationReceipt.project.name }} · {{ store.registrationReceipt.project.id }}</dd></dl>
   </article>
   <article v-if="store.setupReceipt" class="setup-result" data-testid="setup-receipt" role="status">
    <strong>安装接入 · {{ store.setupReceipt.project.name }}</strong><p>{{ store.setupReceipt.project.id }} · {{ store.setupReceipt.project.path }}</p>
    <p>{{ store.setupReceipt.message }}</p><p v-if="store.setupReceipt.operationId">任务 ID：{{ store.setupReceipt.operationId }}</p>
    <template v-if="store.setupReceipt.snapshot"><p>后台阶段：{{ setupStageLabel(store.setupReceipt.snapshot.stage) }} · {{ store.setupReceipt.snapshot.updatedAt }}</p><p v-if="store.setupReceipt.snapshot.bridge">Bridge 回执：{{ store.setupReceipt.snapshot.bridge.status }} · {{ store.setupReceipt.snapshot.bridge.version }}<br>{{ store.setupReceipt.snapshot.bridge.targetPath }}</p><p v-if="store.setupReceipt.snapshot.runtime">当时运行回执：{{ store.setupReceipt.snapshot.runtime.state }}，不是当前状态验证。</p><p v-if="store.setupReceipt.snapshot.mcpName">后台返回的 MCP 名称：{{ store.setupReceipt.snapshot.mcpName }}；不证明当前配置或工具范围。</p></template>
    <template v-if="completedSetup&&projectConnectionsProvider&&store.setupReceipt?.operationId"><SetupToolScopePanel :project-id="completedSetup.project.id" :setup-operation-id="store.setupReceipt.operationId"/><AgentRegistrationPanel v-if="!agentsSkipped" :project-id="completedSetup.project.id" wizard @skip="agentsSkipped=true"/><p v-else>已跳过本步 Agent 注册；先前已完成的配置不变。</p></template><SetupCompletionUsage v-if="completionUsage" :usage="completionUsage"/>
    <p>可能复用同路径任务，但接口不返回原始选项或复用标记，无法核验实际执行范围。complete 不证明本次全部步骤已执行，也不证明 Creator 当前就绪。</p>
    <el-button v-if="activeTask" :disabled="!store.canResume" @click="store.resume()">继续读取接入进度</el-button>
   </article>
   <p class="setup-record-note">回执仅保留在本页；关闭 / 停止等待不取消后台任务，刷新页面会丢失记录。</p>
  </section>
  <el-alert v-if="store.error" :title="store.error" type="warning" :closable="false"/>
  <el-alert v-if="scaffold.error" :title="scaffold.error" type="warning" :closable="false"/>
  <template #footer><el-button v-if="store.pending||store.tracking" @click="store.stopWaiting()">停止等待（不取消后台）</el-button><el-button @click="close">关闭向导</el-button></template>
 </el-dialog>
</template>
<style scoped>
.setup-path-row{display:flex;align-items:center;gap:8px}.setup-path-row :deep(.el-input){min-width:0;flex:1}
.scaffold-fields{display:grid;gap:8px}
.project-setup-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.project-setup-toolbar :deep(.el-button+.el-button){margin-left:0}.setup-status{font-size:12px;color:var(--text-secondary);overflow-wrap:anywhere}.setup-step+.setup-step{border-top:1px solid var(--border-color);margin-top:20px;padding-top:16px}.setup-step{display:grid;gap:10px}.setup-step p{margin:3px 0}.setup-step h3{margin:0 0 4px}.setup-consents{display:grid;gap:8px}.setup-consents :deep(.el-checkbox){height:auto;align-items:flex-start}.setup-consents :deep(.el-checkbox__label){white-space:normal;line-height:1.6}.setup-confirm{border:1px solid var(--border-color);border-radius:8px;padding:12px}.setup-result+.setup-result{border-top:1px solid var(--border-color);padding-top:12px}.setup-result dl{display:grid;grid-template-columns:130px minmax(0,1fr);gap:5px}.setup-result dd{margin:0}.setup-step,.setup-result{overflow-wrap:anywhere}.setup-record-note{color:var(--text-secondary);font-size:12px}
</style>
