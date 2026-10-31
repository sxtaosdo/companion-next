<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { sortProjectsByRecentOpen } from '../domain/recent-projects'
import '../styles/workflow-prototype-source.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { adjacentWorkflowSection, evidenceForProject, filterWorkflowTasks, workflowSections } from '../components/workflow-operation/workflow-workspace'
import type { WorkflowSection } from '../components/workflow-operation/workflow-workspace'
import { storeToRefs } from 'pinia'
import { ArrowLeft, ArrowRight, CircleCheck, CircleClose, InfoFilled, Loading, Refresh, Warning } from '@element-plus/icons-vue'
import { createWorkflowReadProvider } from '../adapters/workflow-read'
import { companionBrowserProvider } from '../companion-browser-integration'
import { displayedTaskState, workflowEvidenceLabels, workflowKindLabels, workflowTaskLabels, workflowTone } from '../domain/workflow-read'
import type { WorkflowEvidence, WorkflowReadProvider } from '../domain/workflow-read'
import { useWorkflowReadStore } from '../stores/workflow-read'
import WorkflowOperationPanel from '../components/workflow-operation/WorkflowOperationPanel.vue'
import WorkflowProjectRegistration from '../components/WorkflowProjectRegistration.vue'
import type {WorkflowProjectRegistrationProvider} from '../adapters/workflow-project-registration'
import { createWorkflowHttpProvider } from '../components/workflow-operation/workflow-operation-http'
import type { WorkflowOperationProvider } from '../components/workflow-operation/workflow-operation'
import { operationLabels } from '../components/workflow-operation/workflow-operation'
import { emptyWorkflowLedgerObservation, projectWorkflowLedger } from '../components/workflow-operation/workflow-ledger-projection'
import type { WorkflowLedgerObservation } from '../components/workflow-operation/workflow-ledger-projection'
const emit=defineEmits<{ 'workflow-section-change':[label:string] }>()
const props=defineProps<{provider?:WorkflowReadProvider;operationProvider?:WorkflowOperationProvider;registrationProvider?:WorkflowProjectRegistrationProvider}>()
const route=useRoute(), router=useRouter()
const taskDetailTab=ref<'specification'|'execution'|'acceptance'|'evidence'>('specification')
const detailTabs=[{id:'specification',label:'规格'},{id:'execution',label:'执行'},{id:'acceptance',label:'验收'},{id:'evidence',label:'证据'}] as const
function syncDetailRoute(){if(router&&route)void router.push({path:'/workflow',query:{...route.query,section:activeSection.value,task:taskId.value||undefined,goal:goalId.value||undefined,detail:taskId.value?taskDetailTab.value:undefined}})}
function selectDetailTab(id:typeof taskDetailTab.value){taskDetailTab.value=id;syncDetailRoute()}
const operationProvider=props.operationProvider??createWorkflowHttpProvider()
const operationPanel=ref<{refresh:()=>Promise<void>|void;selectWorkflow:(id:string)=>boolean}|null>(null)
const ledgerObservation=ref<WorkflowLedgerObservation>(emptyWorkflowLedgerObservation())
const sourcePanels=ref<string[]>([])
const activeSection=ref<WorkflowSection>('goals'),milestoneId=ref(''),taskQuery=ref(''),proposalOpen=ref(false)
watch(activeSection,section=>{sourcePanels.value=section==='specs'?['sources']:[]})
watch(activeSection,section=>emit('workflow-section-change',workflowSections.find(item=>item.id===section)?.label??'概览'),{immediate:true})
const operationSection=computed(()=>activeSection.value==='overview'?'goals':activeSection.value)
function setSection(section:WorkflowSection){activeSection.value=section==='goals'||section==='overview'?'goals':'tasks';evidenceOpen.value=false;syncDetailRoute();if(['specs','execution','acceptance','evidence'].includes(section)&&router&&route)void router.push({query:{...route.query,section:'tasks',recordTab:section}})}
async function keyboardSection(event:KeyboardEvent){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();setSection(adjacentWorkflowSection(activeSection.value,event.key));await nextTick();rootElement.value?.querySelector<HTMLButtonElement>(`#tab-${activeSection.value}`)?.focus()}
function drillMilestone(id:string,goal:string){goalId.value=goal;milestoneId.value=id;stateFilter.value='';taskQuery.value='';taskId.value='';setSection('tasks')}
const allEvidence=computed(()=>evidenceForProject(snapshot.value,projectId.value))
const planningBlocked=computed(()=>(snapshot.value?.tasks??[]).filter(item=>(!projectId.value||item.projectId===projectId.value)&&snapshot.value&&displayedTaskState(item,snapshot.value)==='blocked').length)
const selectedMilestone=computed(()=>selectedGoal.value?.milestones.find(item=>item.id===milestoneId.value))
const sourceAcceptance=computed(()=>(task.value?taskEvidence.value:allEvidence.value).filter(item=>['task-mark','test','uat'].includes(item.kind)))
const sourceCalls=computed(()=>(task.value?taskEvidence.value:allEvidence.value).filter(item=>!['task-mark','test','uat'].includes(item.kind)))
const executionLedger=computed(()=>projectWorkflowLedger(ledgerObservation.value,projectId.value))
function observeLedger(observation:WorkflowLedgerObservation){ledgerObservation.value=observation}
async function selectExecution(id:string){
 activeSection.value='tasks';await nextTick()
 if(!operationPanel.value?.selectWorkflow(id)){selectionNotice.value='该执行记录已不在当前工程范围，请刷新核对。';return}
 await nextTick();operationPanelElement.value?.scrollIntoView({block:'start',behavior:'auto'})
}
const operationPanelElement=ref<HTMLElement|null>(null)

const store=useWorkflowReadStore(),{snapshot,busy,error,read,stale}=storeToRefs(store)
const provider=props.provider??(companionBrowserProvider.value?createWorkflowReadProvider({fetch:(path,init)=>fetch(path,init)}):null)
const projectId=ref(''),stateFilter=ref(''),goalId=ref(''),taskId=ref(''),evidenceOpen=ref(false),evidenceId=ref(''),sourceId=ref('')
const selectionNotice=ref(''),parentSourceId=ref('')
const detailHeading=ref<HTMLElement|null>(null),rootElement=ref<HTMLElement|null>(null)
const projects=computed(()=>sortProjectsByRecentOpen(snapshot.value?.projects??[]))
const filterProjects=computed(()=>{
 const result=projects.value.map(project=>({id:project.id,name:project.name,lastOpenedAt:project.lastOpenedAt}))
 for(const record of ledgerObservation.value.records){if(record.projectId&&!result.some(project=>project.id===record.projectId))result.push({lastOpenedAt:undefined,id:record.projectId,name:`未匹配工程（${record.projectId}）`})}
 return sortProjectsByRecentOpen(result)
})
const tasks=computed(()=>(snapshot.value?.tasks??[]).filter(t=>(!projectId.value||t.projectId===projectId.value)&&(!stateFilter.value||displayedTaskState(t,snapshot.value!)===stateFilter.value)))
const goals=computed(()=>(snapshot.value?.goals??[]).filter(g=>!projectId.value||g.projectId===projectId.value))
const selectedGoal=computed(()=>goals.value.find(g=>g.id===goalId.value))
const visibleTasks=computed(()=>filterWorkflowTasks(snapshot.value,{projectId:projectId.value,goalId:goalId.value,milestoneId:milestoneId.value,state:stateFilter.value,query:taskQuery.value}))
const task=computed(()=>snapshot.value?.tasks.find(t=>t.id===taskId.value))
const taskEvidence=computed(()=>snapshot.value?.evidence.filter(e=>task.value?.evidenceIds.includes(e.id))??[])
const missingEvidence=computed(()=>task.value?.evidenceIds.filter(id=>!taskEvidence.value.some(e=>e.id===id))??[])
const drawerEvidence=computed(()=>snapshot.value?.evidence.find(e=>e.id===evidenceId.value))
const drawerSource=computed(()=>snapshot.value?.sources.find(s=>s.id===sourceId.value))
const sourceEvidence=computed(()=>snapshot.value?.evidence.filter(e=>e.sourceId===drawerSource.value?.id)??[])
const sources=computed(()=>(snapshot.value?.sources??[]).filter(s=>!projectId.value||!s.projectId||s.projectId===projectId.value))
const sourceGroups=[{id:'current-roles',title:'.codex 当前角色配置'},{id:'historical-roles',title:'历史角色调用来源'},{id:'kb-entry',title:'P7000 知识库入口'},{id:'knowledge-service',title:'WeKnora 内置来源'}] as const
function sourcesForGroup(id:string){return sources.value.filter(s=>id==='current-roles'?s.kind==='codex-role'&&!s.id.includes('historical-role:'):id==='historical-roles'?s.kind==='codex-role'&&s.id.includes('historical-role:'):s.kind===id)}
const prototypeDetailMode=ref<'task'|'acceptance'|'kb'|'preset'>('task')
const prototypeDetailClose=ref<HTMLButtonElement|null>(null)
const prototypeTaskGoal=computed(()=>goals.value.find(goal=>goal.id===task.value?.goalId))
const prototypeTaskMilestones=computed(()=>prototypeTaskGoal.value?.milestones.filter(m=>!!task.value&&(m.id===task.value.milestoneId||m.taskIds.includes(task.value.id)))??[])
watch(taskId,()=>{prototypeDetailMode.value='task'})
function closePrototypeDetail(){if(task.value&&activeSection.value==='tasks'){void back()}else evidenceOpen.value=false}
function returnPrototypeTask(){prototypeDetailMode.value='task';evidenceOpen.value=false}
function focusPrototypeDetail(){prototypeDetailClose.value?.focus()}
const sourceStateLabels:Record<string,string>={available:'来源可读', 'not-configured':'未配置',unavailable:'读取失败',unmatched:'未匹配 · 待核对'}
function projectName(id?:string){return projects.value.find(p=>p.id===id)?.name??(id?`未匹配工程（${id}）`:'跨工程')}
function sourceName(id:string){const source=snapshot.value?.sources.find(s=>s.id===id);return source?`${source.kind==='gsd'?'GSD 目标 / 阶段 · ':source.kind==='openspec'?'OpenSpec 规格 / 变更 · ':''}${source.label}`:'来源未匹配'}
function formatTime(value?:string){return value?new Date(value).toLocaleString():'时间未提供'}
function icon(state:string){return state==='passed'?CircleCheck:['failed','denied','blocked'].includes(state)?CircleClose:['unverified','expired','unavailable','unmatched'].includes(state)?Warning:InfoFilled}
function taskState(id:string){const t=snapshot.value?.tasks.find(t=>t.id===id);return t&&snapshot.value?displayedTaskState(t,snapshot.value):'unverified'}
function evidenceForIds(ids:string[]){return ids.map(id=>snapshot.value?.evidence.find(e=>e.id===id)).filter((e):e is WorkflowEvidence=>!!e)}
function missingEvidenceCount(ids:string[]){return ids.length-evidenceForIds(ids).length}
watch(snapshot,next=>{
 if(!next)return
 let removed=false
 if(goalId.value&&!next.goals.some(g=>g.id===goalId.value)){goalId.value='';milestoneId.value='';removed=true}
 if(milestoneId.value&&!next.goals.some(g=>g.id===goalId.value&&g.milestones.some(m=>m.id===milestoneId.value))){milestoneId.value='';removed=true}
 if(taskId.value&&!next.tasks.some(t=>t.id===taskId.value)){taskId.value='';removed=true}
 if(evidenceId.value&&!next.evidence.some(e=>e.id===evidenceId.value)){evidenceId.value='';removed=true}
 if(sourceId.value&&!next.sources.some(s=>s.id===sourceId.value)){sourceId.value='';removed=true}
 if(parentSourceId.value&&!next.sources.some(s=>s.id===parentSourceId.value)){parentSourceId.value='';removed=true}
 if(removed){evidenceOpen.value=false;selectionNotice.value='所选记录已不在最新快照中，已返回可用记录。'}
},{flush:'sync'})
function resetSelection(){goalId.value='';milestoneId.value='';taskId.value='';evidenceOpen.value=false;selectionNotice.value=''}
async function openTask(id:string){taskId.value=id;activeSection.value='tasks';taskDetailTab.value='specification';syncDetailRoute();selectionNotice.value='';await nextTick();detailHeading.value?.focus()}
async function back(){const previousId=taskId.value;taskId.value='';evidenceOpen.value=false;syncDetailRoute();await nextTick();Array.from(rootElement.value?.querySelectorAll<HTMLButtonElement>('button[data-workflow-task]')??[]).find(button=>button.dataset.workflowTask===previousId)?.focus()}
function openEvidence(e:WorkflowEvidence){parentSourceId.value=sourceId.value;sourceId.value='';evidenceId.value=e.id;evidenceOpen.value=true;selectionNotice.value=''}
function openSource(id:string){evidenceId.value='';sourceId.value=id;parentSourceId.value='';evidenceOpen.value=true;selectionNotice.value=''}
function refreshPlanning(){if(provider)return store.refresh(provider)}
function refresh(){void operationPanel.value?.refresh();return refreshPlanning()}

// The route stores only selection. Loading it never starts or resumes execution.
function restoreDetailRoute(){
 if(!route)return
 const q=route.query
 const value=(v:unknown)=>typeof v==='string'?v:''
 const section=value(q.section)
 activeSection.value=section==='goals'||section==='overview'||!section?'goals':'tasks'
 taskId.value=value(q.task);goalId.value=value(q.goal)
 if(taskId.value)activeSection.value='tasks'
 const detail=value(q.detail)
 taskDetailTab.value=detailTabs.some(t=>t.id===detail)?detail as typeof taskDetailTab.value:'specification'
}
restoreDetailRoute()
watch(()=>route?.fullPath,restoreDetailRoute)

onMounted(()=>{void refreshPlanning()})
onBeforeUnmount(()=>{store.clear()})
</script>
<template>
 <main ref="rootElement" class="workflow-read workflow-operational workflow-prototype page" aria-labelledby="workflow-title">
  <header class="heading workflow-header"><div><h1 id="workflow-title" tabindex="-1">提出需求 → 审阅方案 → 查看交付</h1></div>
   <div class="page-actions"><button type="button" data-testid="return-overview" @click="setSection('overview')">返回总览</button><button type="button" data-testid="proposal-toggle" :aria-expanded="proposalOpen" @click="proposalOpen=!proposalOpen">方案说明</button><button type="button" :disabled="busy" @click="refresh"><el-icon v-if="busy" class="is-loading"><Loading/></el-icon><el-icon v-else><Refresh/></el-icon> 刷新读取</button></div>
  </header>
  <section v-if="proposalOpen" class="panel choice-section" data-testid="technical-proposal" aria-labelledby="technical-title"><div class="section-head"><h2 id="technical-title">方案说明 · 复用组件接入现有后台</h2><button type="button" @click="proposalOpen=false">返回工作流</button></div><p><strong>唯一方案：在现有 Companion / Vue 后台中复用读取内核与组件。</strong>GSD 提供目标与里程碑，OpenSpec 提供规格与计划。执行以真实账本、日志和回执为准。</p><div class="comparison"><table><thead><tr><th scope="col">层次</th><th scope="col">优先复用</th><th scope="col">必须核对的边界</th></tr></thead><tbody><tr><th scope="row">规格读取</th><td>现有 OpenSpec 来源读取组件</td><td>实际来源、版本、关联证据分别核对；规划齐全不等于验收通过</td></tr><tr><th scope="row">长期目标与恢复</th><td>现有 GSD 目标 / 里程碑读取</td><td>恢复位置是规划元数据，不能代替真实执行账本</td></tr><tr><th scope="row">变更与规格</th><td>现有规划快照与任务清单</td><td>任务勾选、自动测试、UAT 分开核对</td></tr><tr><th scope="row">界面与证据</th><td>现有 Vue / Element Plus、工程与状态组件</td><td>同一 32180 的真实执行、日志与原操作回执；未知不自动重发</td></tr></tbody></table></div><p class="callout">配置存在不等于实际角色已读取、调用或采用；所有阶段保留其真实来源与未验证边界。</p></section>
  <section class="panel" id="workflow-main" data-testid="workflow-main" aria-label="跨工程开发工作流">
   <div class="projectbar"><label for="workflow-project">工程筛选<select id="workflow-project" v-model="projectId" aria-label="工程筛选" @change="resetSelection"><option value="">全部工程</option><option v-for="project in filterProjects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label><WorkflowProjectRegistration :provider="registrationProvider" @registered="refresh"/></div>
   <nav class="tabs workflow-tabs" aria-label="工作流分区" role="tablist" @keydown="keyboardSection"><button v-for="section in workflowSections" :id="`tab-${section.id}`" :key="section.id" role="tab" type="button" :aria-controls="`panel-${section.id}`" :aria-selected="activeSection===section.id" :tabindex="activeSection===section.id?0:-1" @click="setSection(section.id)">{{ section.label }}</button></nav>
   <div :id="`panel-${activeSection}`" class="content" role="tabpanel" :aria-labelledby="`tab-${activeSection}`" tabindex="0">
    <div class="summary-line workflow-observation" role="status" aria-live="polite"><strong>{{ projectId?projectName(projectId):'全部工程' }}</strong><el-tag v-if="busy&&!snapshot" class="companion-status-tag" type="primary"><el-icon class="companion-status-icon is-loading"><Loading/></el-icon>读取中</el-tag><el-tag v-else-if="stale" class="companion-status-tag" type="warning"><el-icon class="companion-status-icon"><Warning/></el-icon>旧快照 · 待核对</el-tag><span v-else-if="snapshot" class="badge neutral">已读取来源快照</span><span v-else-if="!read" class="badge neutral">尚未读取</span><span v-if="snapshot" class="muted">观察于 {{ formatTime(snapshot.observedAt) }}</span><span v-if="busy&&snapshot" class="muted">正在刷新</span></div>
    <el-alert v-if="error" :title="snapshot?'读取失败，保留上次快照供核对':'工作流读取失败'" :description="error" type="error" :closable="false" show-icon/>
    <el-alert v-else-if="!provider" title="当前页面未接入 Companion 只读来源。" type="info" :closable="false" show-icon/>
    <el-alert v-if="selectionNotice" :title="selectionNotice" type="info" show-icon @close="selectionNotice=''"/>
    <section v-if="activeSection==='overview'" aria-label="长期目标与下一交付"><div class="lifecycle-summary workflow-overview-counts" aria-label="当前执行状态数量"><div v-for="state in ['running','queued','paused','failed','unknown'] as const" :key="state"><strong>{{ executionLedger.counts[state] }}</strong><span>{{ operationLabels[state] }}</span></div><div><strong>{{ planningBlocked }}</strong><span>{{ stale?'上次规划阻塞 · 待核对':'规划阻塞（来源记录）' }}</span></div></div><p v-if="executionLedger.staleCount" class="callout">另有 {{ executionLedger.staleCount }} 条历史状态待核对，不计入当前数量。</p><div class="grid2 workflow-overview-goals" data-testid="workflow-overview"><article v-for="goal in goals" :key="goal.id" class="info-card workflow-delivery" :class="{'is-selected':goalId===goal.id}" :data-workflow-goal="goal.id">
 <h3>{{ projectName(goal.projectId) }} · 长期目标</h3><p><strong>{{ goal.title }}</strong></p><p><small>目标 ID：<code>{{ goal.id }}</code> · 规划来源：{{ sourceName(goal.sourceId) }}</small></p><p v-if="goal.summary">{{ goal.summary }}</p>
 <dl><dt>里程碑（来源）</dt><dd><template v-if="goal.milestones.length"><p v-for="m in goal.milestones" :key="m.id">{{ m.title }} <small>{{ m.taskIds.length }} 项任务 · {{ m.evidenceIds.length }} 条证据引用</small></p></template><span v-else class="workflow-muted">来源尚未提供里程碑。</span></dd>
 <dt>交付范围 / 下一交付</dt><dd>{{ goal.nextDelivery||'来源尚未提供' }}</dd><dt>验收状态</dt><dd><template v-for="e in evidenceForIds(goal.milestones.flatMap(m=>m.evidenceIds)).filter(e=>e.kind==='uat')" :key="e.id"><button class="text-button" type="button" @click="openEvidence(e)">{{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button></template><span v-if="!evidenceForIds(goal.milestones.flatMap(m=>m.evidenceIds)).some(e=>e.kind==='uat')" class="workflow-muted">尚无匹配 UAT 证据</span></dd></dl>
 <div class="card-actions"><button v-for="m in goal.milestones" :key="m.id" :data-workflow-milestone="m.id" type="button" @click="drillMilestone(m.id,goal.id)">查看里程碑任务 · {{ m.title }}</button><button type="button" @click="goalId=goal.id;setSection('acceptance')">查看验收</button><button type="button" @click="goalId=goal.id;setSection('goals')">查看目标</button></div>
</article></div><p v-if="!goals.length" class="empty">当前范围没有已读取的长期目标，不使用演示数据填充。</p><p class="callout">目标 → 里程碑 → 任务 → 验收与知识证据。GSD 的恢复位置是规划元数据；真实执行以同一任务账本核对。</p><section class="info-card workflow-live-goals"><h3>真实执行目标</h3><p v-if="!executionLedger.rows.length" class="muted">暂无真实执行记录，创建目标不等于启动执行。</p><div class="table-wrap" v-if="executionLedger.rows.length"><table><thead><tr><th scope="col">目标 / 工程</th><th scope="col">真实执行状态</th><th scope="col">详情</th></tr></thead><tbody><tr v-for="row in executionLedger.rows" :key="row.id"><td>{{ row.title }}<br><code>{{ projectName(row.projectId??undefined) }}</code></td><td><el-tag :type="row.stale?'warning':'info'">{{ row.stale?'历史待核对 · ':'' }}{{ row.label }}</el-tag></td><td><button type="button" class="text-button" @click="selectExecution(row.workflowId)">查看详情</button></td></tr></tbody></table></div><div class="card-actions"><button type="button" @click="setSection('goals')">进入目标</button></div></section></section>
  <section v-show="activeSection!=='overview'" ref="operationPanelElement" class="workflow-operation-integration" aria-label="目标执行工作台">
   <details class="workflow-muted"><summary>工作流范围说明</summary><p>创建目标并审阅计划后，需显式启动；暂停任务不会自动恢复。技术样例通过不等于业务验收。</p></details>
   <WorkflowOperationPanel ref="operationPanel" :provider="operationProvider" :projects="projects" :project-filter="projectId" :section="operationSection" @ledger-observation="observeLedger"/>
  </section>
    <details v-if="['goals','specs','tasks','acceptance','evidence'].includes(activeSection)" class="workflow-planning-source"><summary>工程规划参考（只读）</summary><div class="section-head"><h2>{{ activeSection==='goals'?'长期目标与里程碑':activeSection==='specs'?'规格来源':activeSection==='tasks'?'任务清单':activeSection==='acceptance'?'来源验收':'调用证据' }}</h2><small class="muted">{{ activeSection==='tasks'?'已勾选 '+visibleTasks.filter(t=>t.checked===true).length+' / '+visibleTasks.length+' 项（来源记录）':'来源快照' }}</small></div><p class="callout">以下目标、阶段与勾选来自登记工程的 GSD / OpenSpec，不是上方执行账本，不合并完成状态。</p>
     <template v-if="snapshot"><template v-if="activeSection==='goals'"><div class="grid2"><article v-for="goal in goals" :key="goal.id" class="info-card workflow-delivery" :class="{'is-selected':goalId===goal.id}" :data-workflow-goal="goal.id">
 <h3>{{ projectName(goal.projectId) }} · 长期目标</h3><p><strong>{{ goal.title }}</strong></p><p><small>目标 ID：<code>{{ goal.id }}</code> · 规划来源：{{ sourceName(goal.sourceId) }}</small></p><p v-if="goal.summary">{{ goal.summary }}</p>
 <dl><dt>里程碑（来源）</dt><dd><template v-if="goal.milestones.length"><p v-for="m in goal.milestones" :key="m.id">{{ m.title }} <small>{{ m.taskIds.length }} 项任务 · {{ m.evidenceIds.length }} 条证据引用</small></p></template><span v-else class="workflow-muted">来源尚未提供里程碑。</span></dd>
 <dt>交付范围 / 下一交付</dt><dd>{{ goal.nextDelivery||'来源尚未提供' }}</dd><dt>验收状态</dt><dd><template v-for="e in evidenceForIds(goal.milestones.flatMap(m=>m.evidenceIds)).filter(e=>e.kind==='uat')" :key="e.id"><button class="text-button" type="button" @click="openEvidence(e)">{{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button></template><span v-if="!evidenceForIds(goal.milestones.flatMap(m=>m.evidenceIds)).some(e=>e.kind==='uat')" class="workflow-muted">尚无匹配 UAT 证据</span></dd></dl>
 <div class="card-actions"><button v-for="m in goal.milestones" :key="m.id" :data-workflow-milestone="m.id" type="button" @click="drillMilestone(m.id,goal.id)">钻取里程碑任务 · {{ m.title }}</button><button type="button" @click="goalId=goal.id;setSection('acceptance')">查看验收</button></div>
 <div class="workflow-milestone-evidence"><section v-for="m in goal.milestones" :key="m.id"><h3>{{ m.title }}</h3><p class="workflow-muted">{{ workflowTaskLabels[m.state==='running'?'unverified':m.state] }}</p><button v-for="e in evidenceForIds(m.evidenceIds)" :key="e.id" type="button" class="text-button" @click="openEvidence(e)">{{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button><p v-if="missingEvidenceCount(m.evidenceIds)" class="workflow-muted">有 {{ missingEvidenceCount(m.evidenceIds) }} 条里程碑证据引用未匹配，待核对。</p></section></div>
</article></div><p v-if="!goals.length" class="empty">当前范围尚无长期目标记录。</p><p class="callout">目标 → 里程碑 → 任务 → 验收与知识证据。恢复位置只是元数据，不能被用作任务已调度的证明。</p></template>
      <template v-if="activeSection==='tasks'"><p v-if="selectedMilestone" class="callout" data-testid="milestone-filter">里程碑筛选：{{ selectedGoal?.title }} / {{ selectedMilestone.title }} <button type="button" @click="milestoneId=''">返回全部任务</button></p><div class="filter workflow-filters"><label for="workflow-query">名称或标识<input id="workflow-query" v-model="taskQuery" placeholder="筛选任务"></label><label for="workflow-state">任务状态<select id="workflow-state" v-model="stateFilter" aria-label="任务状态筛选" @change="taskId=''"><option value="">全部状态</option><option v-for="(label,state) in workflowTaskLabels" :key="state" :value="state">{{ label }}</option></select></label></div><div class="table-wrap"><table><thead><tr><th scope="col">勾选</th><th scope="col">任务 / 编号</th><th scope="col">执行状态（来源核对）</th><th scope="col">详情</th></tr></thead><tbody data-testid="task-rows"><tr v-for="t in visibleTasks" :key="t.id"><td><input v-if="t.checked!==undefined" type="checkbox" :checked="t.checked===true" disabled :aria-label="'任务勾选只读：'+t.title"><span v-else class="muted">未提供</span></td><td>{{ t.title }}<br><code>{{ t.id }}</code><br><small>{{ projectName(t.projectId) }} · {{ sourceName(t.sourceId) }}</small><p v-if="t.reason">{{ t.reason }}</p></td><td><el-tag class="companion-status-tag" :type="workflowTone(taskState(t.id))"><el-icon class="companion-status-icon"><component :is="icon(taskState(t.id))"/></el-icon>{{ workflowTaskLabels[taskState(t.id)] }}</el-tag></td><td><button type="button" class="text-button" :data-workflow-task="t.id" :aria-label="'查看详情：'+t.title" @click="openTask(t.id)">查看详情</button></td></tr><tr v-if="!visibleTasks.length"><td colspan="4" class="empty">当前筛选下没有任务记录。</td></tr></tbody></table></div><p class="callout">勾选只代表来源清单标记，不改变自动测试、真实 UAT 或真实快照。此处只读，不保存到文件或后台。</p></template>
      <section v-if="activeSection==='acceptance'" class="workflow-stage-evidence"><p v-if="task" class="callout">当前任务：{{ task.title }} <button type="button" class="text-button" @click="setSection('tasks')">返回任务详情</button></p><div class="accept-grid"><article class="accept-card"><h3>① 规划勾选</h3><span>{{ tasks.filter(t=>t.checked===true).length }} / {{ tasks.length }} 项（来源记录）</span><p>来自任务清单；不具有真实验收权威。</p><button type="button" @click="setSection('tasks')">查看任务勾选</button></article><article class="accept-card"><h3>② 自动测试</h3><p v-if="!sourceAcceptance.some(e=>e.kind==='test')">暂无匹配的自动测试证据。</p><button v-for="e in sourceAcceptance.filter(e=>e.kind==='test')" :key="e.id" type="button" class="text-button" @click="openEvidence(e)">{{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button><p>测试结果按真实证据核对，不影响 UAT。</p></article><article class="accept-card"><h3>③ 真实 UAT</h3><p v-if="!sourceAcceptance.some(e=>e.kind==='uat')">当前没有匹配的真实 UAT 证据。</p><button v-for="e in sourceAcceptance.filter(e=>e.kind==='uat')" :key="e.id" type="button" class="text-button" @click="openEvidence(e)">{{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button><p>真实 UAT 与规划勾选、自动测试分别核对。</p></article></div><p class="callout">任务勾选、自动测试、UAT 分开；来源规划齐全或局部通过不能解除其他真实门禁。</p><div class="workflow-source-marks"><button v-for="e in sourceAcceptance.filter(e=>e.kind==='task-mark')" :key="e.id" type="button" class="text-button" @click="openEvidence(e)">{{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button></div></section>
      <section v-if="activeSection==='evidence'" class="workflow-stage-evidence"><p v-if="task" class="callout">当前任务：{{ task.title }} <button type="button" class="text-button" @click="setSection('tasks')">返回任务详情</button></p><div class="table-wrap"><table><thead><tr><th scope="col">操作 / 关联 ID</th><th scope="col">结果</th><th scope="col">证据</th></tr></thead><tbody data-testid="evidence-rows"><tr v-for="e in sourceCalls" :key="e.id"><td>{{ e.label }}<br><code>{{ e.id }}</code><br><small>{{ workflowKindLabels[e.kind] }}</small></td><td><el-tag class="companion-status-tag" :type="workflowTone(e.state)">{{ workflowEvidenceLabels[e.state] }}</el-tag></td><td><button type="button" class="text-button" @click="openEvidence(e)">查看详情</button></td></tr><tr v-if="!sourceCalls.length"><td colspan="3" class="empty">暂无匹配证据。</td></tr></tbody></table></div><p class="callout">请求 / 响应关联 ID、来源 hash 与采用分别核对；没有原始证据或权限时不补造。</p></section>
   <el-collapse v-model="sourcePanels" class="workflow-sources"><el-collapse-item title="来源与配置（角色配置、知识库入口、内置来源分别核对）" name="sources">
    <p class="workflow-muted">配置存在不能证明已读取、调用或采纳；实际原始调用以对应任务证据为准。</p>
    <div class="workflow-source-groups"><section v-for="group in sourceGroups" :key="group.id" :data-workflow-source-group="group.id"><h3>{{ group.title }} <small>{{ sourcesForGroup(group.id).length }}</small></h3><p v-if="!sourcesForGroup(group.id).length" class="workflow-muted">尚无匹配来源记录。</p><article v-for="s in sourcesForGroup(group.id)" :key="s.id" class="workflow-source"><el-button link type="primary" @click="openSource(s.id)">{{ s.label }}<span v-if="s.projectId"> · {{ projectName(s.projectId) }}</span></el-button><el-tag class="companion-status-tag" :type="workflowTone(s.state)"><el-icon class="companion-status-icon"><component :is="icon(s.state)"/></el-icon>{{ sourceStateLabels[s.state] }}</el-tag><small>{{ formatTime(s.checkedAt) }}</small><p v-if="s.reason">{{ s.reason }}</p></article></section></div>
    <div class="workflow-other-sources"><h3>{{ activeSection==='specs'?'OpenSpec 规格':'目标与交付来源' }}</h3><article v-for="s in sources.filter(s=>activeSection==='specs'?s.kind==='openspec':!['codex-role','kb-entry','knowledge-service'].includes(s.kind))" :key="s.id" class="workflow-source"><el-button link type="primary" @click="openSource(s.id)">{{ s.label }}<span v-if="s.projectId"> · {{ projectName(s.projectId) }}</span></el-button><span>{{ sourceStateLabels[s.state] }} · {{ formatTime(s.checkedAt) }}</span><p v-if="s.reason">{{ s.reason }}</p></article></div>
   </el-collapse-item></el-collapse>
     </template><el-empty v-else-if="read&&!error" description="接口未提供工作流快照"/>
    </details>
   </div>
  </section>
  <details class="panel real-snapshot" aria-label="真实来源观察"><summary>数据状态</summary><p v-if="snapshot">观察于 {{ formatTime(snapshot.observedAt) }} · {{ projects.length }} 个登记工程 · {{ snapshot.sources.length }} 条来源记录。{{ stale?'当前为旧快照，需重新核对。':'来源读取与实际执行分别核对。' }}</p><p v-else>来源尚未读取；不使用演示数据填充。</p></details>
  <details v-if="proposalOpen" class="panel sources" id="technical-sources" data-testid="sources"><summary>原型历史调查 · 来源记录、许可与未验证边界（非路线选择）</summary><p class="callout">以下直接保留原型调查来源与当时的许可/兼容说明；它们不是现用执行或兼容验收结论。</p><p class="callout">以下保留官方与历史调查来源，不是供使用者选择的接入路线。当前仅评审“复用组件接入现有后台”。</p><ul>
<li><a href="https://github.com/spekhq/spek" target="_blank" rel="noopener noreferrer">spekhq/spek</a>：MIT（上游声明）；仅评估可复用core/组件，不另建独立站点。源码/依赖审查与OpenSpec1.15兼容仍未实测。</li>
<li><a href="https://github.com/VeryComplexAndLongName/OpenSpec-UI" target="_blank" rel="noopener noreferrer">OpenSpec-UI</a>：历史比较来源，非当前采用路线。MIT（上游声明）；Node ≥24.2、&lt;25；Codex mock不代表真实兼容；本机未安装。</li>
<li><a href="https://github.com/mirkanu/gsd-dashboard" target="_blank" rel="noopener noreferrer">mirkanu/gsd-dashboard</a>：历史比较来源，非当前采用路线。MIT（上游声明）；维护不活跃；Core1.18、hooks与本机适配未验证。</li>
<li><a href="https://github.com/open-gsd/gsd-core" target="_blank" rel="noopener noreferrer">官方 GSD Core</a>：MIT；以1.18 planning inspect结构为状态基线；本机只核过命令源码，未实调该命令。不借用 gsd-2 的能力声明。</li>
<li><a href="https://github.com/Fission-AI/OpenSpec" target="_blank" rel="noopener noreferrer">官方 OpenSpec</a>：MIT；当前已安装1.15；规划结构齐全不等于开发或验收完成。</li></ul><p class="callout">不选用 jixoai/openspecui：声明 ≥1.14、&lt;1.15，与当前1.15不符；不选用 ToruAI：仅测试1.6且含 idea/config 写入。未安装任何候选UI，未选择第三方执行器。</p></details>
  <footer class="footer"><span>仅显式动作可写入；任务执行与验收以真实账本、日志和回执为准。</span><span>规划、测试、UAT、读取、调用与采用分别核对。</span></footer>
  <el-dialog :model-value="evidenceOpen||!!task&&activeSection==='tasks'" class="workflow-prototype-evidence" modal-class="workflow-prototype-evidence-overlay" width="min(520px, calc(100vw - 24px))" append-to-body :show-close="false" :close-on-click-modal="true" :aria-label="evidenceOpen?(drawerSource?'来源详情':'证据详情'):'任务详情'" @update:model-value="!$event&&closePrototypeDetail()" @opened="focusPrototypeDetail">
   <template #header><div class="drawer-head"><h2 id="drawer-title">{{ evidenceOpen?(drawerSource?'来源详情':'证据详情'):'任务详情' }}</h2><button ref="prototypeDetailClose" type="button" aria-label="关闭证据详情" @click="closePrototypeDetail">×</button></div></template><div class="drawer-body"><div v-if="evidenceOpen"><button v-if="task&&activeSection==='tasks'" type="button" class="text-button" data-testid="detail-back" @click="returnPrototypeTask">← 返回任务详情</button>   <div v-if="drawerEvidence" class="workflow-evidence-detail"><el-button v-if="parentSourceId" :icon="ArrowLeft" @click="openSource(parentSourceId)">返回来源关联证据</el-button><p class="workflow-muted">{{ workflowKindLabels[drawerEvidence.kind] }}</p><h2>{{ drawerEvidence.label }}</h2><el-tag class="companion-status-tag" :type="workflowTone(drawerEvidence.state)"><el-icon class="companion-status-icon"><component :is="icon(drawerEvidence.state)"/></el-icon>{{ workflowEvidenceLabels[drawerEvidence.state] }}</el-tag><p v-if="drawerEvidence.summary">{{ drawerEvidence.summary }}</p><p v-if="drawerEvidence.reason">{{ drawerEvidence.reason }}</p><dl><dt>来源</dt><dd>{{ sourceName(drawerEvidence.sourceId) }}</dd><dt>证据时间</dt><dd>{{ formatTime(drawerEvidence.at) }}</dd><template v-if="drawerEvidence.phase"><dt>阶段</dt><dd>{{ drawerEvidence.phase }}</dd></template><template v-if="drawerEvidence.version"><dt>版本</dt><dd>{{ drawerEvidence.version }}</dd></template><template v-if="drawerEvidence.digest"><dt>摘要</dt><dd>{{ drawerEvidence.digest }}</dd></template><template v-for="(fact,index) in drawerEvidence.facts" :key="index"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></template></dl><p class="workflow-muted">证据只说明对应来源与阶段，不替代其他验收项。</p></div>
   <div v-else-if="drawerSource" class="workflow-evidence-detail"><h2>{{ drawerSource.label }}</h2><p v-if="drawerSource.projectId" class="workflow-muted">工程：{{ projectName(drawerSource.projectId) }}</p><el-tag class="companion-status-tag" :type="workflowTone(drawerSource.state)"><el-icon class="companion-status-icon"><component :is="icon(drawerSource.state)"/></el-icon>{{ sourceStateLabels[drawerSource.state] }}</el-tag><p v-if="drawerSource.reason">{{ drawerSource.reason }}</p><dl><dt>来源类别</dt><dd>{{ drawerSource.kind }}</dd><dt>核对时间</dt><dd>{{ formatTime(drawerSource.checkedAt) }}</dd><dt>版本</dt><dd>{{ drawerSource.version||'来源未提供' }}</dd><dt>摘要</dt><dd>{{ drawerSource.digest||'来源未提供' }}</dd></dl><p class="workflow-muted">这是来源与配置记录，实际读取、调用、采纳仍需分别核对任务证据。</p><h3>关联证据</h3><p v-if="!sourceEvidence.length" class="workflow-muted">尚无该来源的关联证据记录。</p><div class="workflow-evidence-list workflow-source-evidence"><button v-for="e in sourceEvidence" :key="e.id" class="workflow-evidence-button" type="button" @click="openEvidence(e)"><span><small>{{ workflowKindLabels[e.kind] }}</small><strong>{{ e.label }}</strong></span><el-tag class="companion-status-tag" :type="workflowTone(e.state)"><el-icon class="companion-status-icon"><component :is="icon(e.state)"/></el-icon>{{ workflowEvidenceLabels[e.state] }}</el-tag><el-icon aria-hidden="true"><ArrowRight/></el-icon></button></div></div>
   <el-empty v-else description="证据引用未匹配，待核对"/></div><section v-else-if="task" class="workflow-task-detail" aria-labelledby="workflow-task-title">
    <h2 id="workflow-task-title" ref="detailHeading" tabindex="-1">{{ task.title }}</h2>
    <p>任务 ID：<code data-testid="detail-task-id">{{ task.id }}</code></p>
    <p><el-tag class="companion-status-tag" :type="workflowTone(taskState(task.id))">{{ workflowTaskLabels[taskState(task.id)] }}</el-tag> · 规划来源：{{ sourceName(task.sourceId) }}</p>
    <dl aria-label="任务清单、依赖与进度"><dt>清单</dt><dd>{{ task.checked===true?'已勾选':task.checked===false?'未勾选':'来源未提供清单标记' }}</dd><dt>依赖</dt><dd>规划快照未提供任务依赖字段，请在规格中的原计划及任务来源审阅核对；不推定无依赖。</dd><dt>进度</dt><dd>{{ workflowTaskLabels[taskState(task.id)] }}；来源未提供执行百分比，勾选不代表 Verify 或 Accepted。</dd></dl>
    <nav class="tabs" aria-label="任务详情标签"><button v-for="tab in detailTabs" :key="tab.id" type="button" :aria-pressed="taskDetailTab===tab.id" :data-detail-tab="tab.id" @click="selectDetailTab(tab.id)">{{ tab.label }}</button></nav>
    <section v-if="taskDetailTab==='specification'" aria-label="任务规格"><h3>规格</h3><p>{{ task.reason||'来源未提供额外任务说明。' }}</p><dl><dt>长期目标</dt><dd>{{ prototypeTaskGoal?.title||'来源未提供' }}</dd><dt>里程碑</dt><dd>{{ prototypeTaskMilestones.map(m=>m.title).join('、')||'来源未提供' }}</dd><dt>来源 ID</dt><dd>{{ task.sourceId }}</dd></dl><button type="button" @click="openSource(task.sourceId)">查看该任务的规划来源</button></section>
    <section v-else-if="taskDetailTab==='execution'" aria-label="任务执行"><h3>执行</h3><p>规划记录与真实执行账本分别核对。查看详情不会恢复 unknown 或暂停任务。</p><p v-if="!taskEvidence.some(e=>e.kind==='agent-execution')">暂无匹配的实际执行证据，不能由规划状态推定执行。</p><button v-for="e in taskEvidence.filter(e=>e.kind==='agent-execution')" :key="e.id" type="button" class="text-button" @click="openEvidence(e)">{{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button></section>
    <section v-else-if="taskDetailTab==='acceptance'" aria-label="任务验收"><h3>验收</h3><p>Review、Verify 与 Owner Accepted 分别核对；规划勾选、测试和 UAT 不自动互相升级。</p><p v-if="!sourceAcceptance.length">暂无匹配的验收证据；未确认 Owner Accepted。</p><button v-for="e in sourceAcceptance" :key="e.id" type="button" class="text-button" @click="openEvidence(e)">{{ workflowKindLabels[e.kind] }} · {{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button></section>
    <section v-else aria-label="任务证据"><h3>证据</h3><p v-if="!taskEvidence.length">暂无匹配证据，不创建替代事实。</p><p v-if="missingEvidence.length">{{ missingEvidence.length }} 条原证据引用未匹配，待核对。</p><button v-for="e in taskEvidence" :key="e.id" type="button" class="text-button" @click="openEvidence(e)">{{ e.id }} · {{ e.label }} · {{ workflowEvidenceLabels[e.state] }}</button></section>

   </section></div><template #footer><div class="drawer-foot">证据只说明对应来源与阶段，不替代其他验收项。</div></template>
  </el-dialog>
 </main>
</template>
