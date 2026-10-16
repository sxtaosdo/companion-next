<script setup lang="ts">
import GenerationSourcePanel from './GenerationSourcePanel.vue'
import { computed, reactive, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { MAX_PLAN_IMPORT_BYTES, parseResourcePlan } from '../domain/resource-plan-import'
import { Plus, Download, Document } from '@element-plus/icons-vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useResourcePlanningStore } from '../stores/resource-planning'
import { exportResourcePlan, parseDerivedSizes, planningCounts, planMatchesSpec } from '../domain/resource-planning'
import { preflightResourcePlan } from '../domain/resource-preflight'
import type { RequirementInput, ResourcePlan, ResourceRequirement } from '../domain/resource-planning'
const workspace = useWorkspaceStore()
const planning = useResourcePlanningStore()
const error = ref('')
const adding = ref(false)
const editingId = ref<string | null>(null)
let importReadVersion = 0
const importOpen = ref(false)
const importText = ref('')
const importConfirmed = ref(false)
const importLoading = ref(false)
const exportName = ref('companion-resource-plan.json')
const batchOpen = ref(false)
const exportOpen = ref(false)
const exportText = ref('')
const selected = ref<string[]>([])
const batchName = ref('')
const derivedEnabled = ref(false)
const derivedText = ref('128×128')
const confirmed = ref(false)
const showPreflight = ref(false)
const preflight = computed(() => plan.value ? preflightResourcePlan(plan.value, workspace.spec) : undefined)
const mode = computed(() => workspace.mode === 'live' ? 'live' : 'demo')
const plan = computed(() => workspace.project ? planning.get(mode.value, workspace.project.id) : undefined)
const counts = computed(() => plan.value ? planningCounts(plan.value) : undefined)
const currentSpecMatches = computed(() => plan.value ? planMatchesSpec(plan.value, workspace.spec) : true)
const backups = computed(() => workspace.project ? planning.getBackups(mode.value, workspace.project.id) : [])
const assigned = computed(() => new Set(plan.value?.batches.flatMap((b) => b.requirementIds) ?? []))
const blank = (): RequirementInput => ({ name: '', category: '图标', purpose: '', page: '通用 UI', priority: 'normal', defaultSize: { width: 256, height: 256 }, transparent: true, ownerProtected: false, acceptanceNotes: '' })
const form = reactive(blank())
watch(() => [workspace.mode, workspace.selectedProjectId], () => { adding.value = false; batchOpen.value = false; exportOpen.value = false; importOpen.value = false; importReadVersion++; importLoading.value = false; importText.value = ''; importConfirmed.value = false; selected.value = []; error.value = ''; showPreflight.value = false })
function attempt(action: () => void) {
  error.value = ''
  try { action() } catch (cause) { error.value = cause instanceof Error ? cause.message : '规划操作未完成' }
}
function begin() {
  attempt(() => {
    if (!workspace.project || !workspace.spec || workspace.mode === 'disconnected') throw new Error('请先在项目规范中建立有效草稿')
    planning.begin(workspace.project, workspace.spec, mode.value, workspace.localDraft ? 'local-draft' : 'read-only')
  })
}
function openRequirement() { editingId.value = null; Object.assign(form, blank()); derivedEnabled.value = false; confirmed.value = false; derivedText.value = '128×128'; error.value = ''; adding.value = true }
function add() {
  attempt(() => {
    if (!workspace.project) throw new Error('项目已切换')
    if (!currentSpecMatches.value) throw new Error('当前规范已变动，新增需求已暂停；计划仍绑定原快照')
    const input = { ...form, defaultSize: { ...form.defaultSize }, derivedSizes: derivedEnabled.value ? parseDerivedSizes(derivedText.value) : [], confirmSameMaster: confirmed.value }
    if (editingId.value) planning.edit(mode.value, workspace.project.id, editingId.value, input)
    else planning.add(mode.value, workspace.project.id, input)
    adding.value = false
  })
}
function openBatch() { batchName.value = `第 ${(plan.value?.batches.length ?? 0) + 1} 批资源`; error.value = ''; batchOpen.value = true }
function batch() {
  attempt(() => {
    if (!workspace.project || !currentSpecMatches.value) throw new Error('当前规范已变动，本计划仍绑定原规范快照，不能继续编批')
    planning.batch(mode.value, workspace.project.id, batchName.value, selected.value)
    batchOpen.value = false; selected.value = []
  })
}
function exportPreview(target: ResourcePlan | undefined = plan.value) { attempt(() => { if (!target) return; exportText.value = exportResourcePlan(target); exportName.value = `companion-resource-plan-${target.id}.json`; exportOpen.value = true }) }
function download() {
  attempt(() => {
    parseResourcePlan(exportText.value)
    const contents = exportText.value
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = exportName.value
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}
function openEdit(item: ResourceRequirement) {
  if (item.ownerProtected || assigned.value.has(item.id) || !currentSpecMatches.value) return
  editingId.value = item.id
  Object.assign(form, { name:item.name, category:item.category, purpose:item.purpose, page:item.page, priority:item.priority, defaultSize:{...item.defaultSize}, transparent:item.transparent, ownerProtected:item.ownerProtected, acceptanceNotes:item.acceptanceNotes })
  derivedEnabled.value = item.derivatives.length > 0
  derivedText.value = item.derivatives.map((d)=>`${d.width}×${d.height}`).join(', ')
  confirmed.value = false; error.value = ''; adding.value = true
}
async function remove(item: ResourceRequirement) {
  const projectId=workspace.project?.id; const sourceMode=mode.value; const planId=plan.value?.id
  try { await ElMessageBox.confirm(`仅移除内存需求“${item.name}”；不会删除任何项目资产。`, '移除本地需求', { confirmButtonText:'移除本地需求', cancelButtonText:'取消', type:'warning' }) } catch { return }
  attempt(()=>{ if(!projectId || projectId!==workspace.project?.id || sourceMode!==mode.value || planId!==plan.value?.id)throw new Error('项目或计划已切换，未移除需求'); planning.remove(sourceMode,projectId,item.id); selected.value=selected.value.filter((id)=>id!==item.id) })
}
async function cancelBatch(batchId: string) {
  const projectId=workspace.project?.id; const sourceMode=mode.value; const planId=plan.value?.id
  try { await ElMessageBox.confirm('仅取消内存计划批次，保留需求供重新编辑。没有真实队列任务被撤销。', '取消本地计划批次', { confirmButtonText:'取消计划批次', cancelButtonText:'保留' }) } catch { return }
  attempt(()=>{ if(!projectId || projectId!==workspace.project?.id || sourceMode!==mode.value || planId!==plan.value?.id)throw new Error('项目或计划已切换，未取消批次'); planning.cancelBatch(sourceMode,projectId,batchId); selected.value=[] })
}
function openImport() { importReadVersion++; importLoading.value=false; importText.value=''; importConfirmed.value=false; error.value=''; importOpen.value=true }
async function readImport(event: Event) {
  const version=++importReadVersion
  importText.value=''; importConfirmed.value=false; importLoading.value=false; error.value=''
  const file=(event.target as HTMLInputElement).files?.[0]
  if(!file)return
  if(file.size>MAX_PLAN_IMPORT_BYTES){error.value='导入文件超过 512 KiB 上限';return}
  importLoading.value=true
  try { const contents=await file.text(); if(version!==importReadVersion)return; importText.value=contents; error.value='' } catch { if(version===importReadVersion)error.value='文件读取失败；现有草稿未改变' } finally { if(version===importReadVersion)importLoading.value=false }
}
function editImportText() { importReadVersion++; importLoading.value=false; importConfirmed.value=false }
watch(importOpen,(open)=>{if(!open){importReadVersion++;importLoading.value=false}})
function restore() {
  attempt(()=>{
    if(importLoading.value)throw new Error('文件仍在读取，尚未恢复任何草稿')
    if(!workspace.project)throw new Error('请先选择项目')
    planning.restore(workspace.project,mode.value,importText.value,importConfirmed.value)
    importOpen.value=false; selected.value=[]; showPreflight.value=false
  })
}
function toggle(id: string, checked: boolean) { selected.value = checked ? [...new Set([...selected.value, id])] : selected.value.filter((value) => value !== id) }
</script>

<template>
  <section class="resource-planner" data-testid="resource-planner">
    <el-alert title="资源规划 · 当前页内存草稿" type="info" :closable="false" show-icon description="仅在浏览器内规划需求与批次。刷新页面会丢失，请显式导出 JSON 备份；没有写入项目配置，也没有提交或生成素材。" />
    <el-alert v-if="error && !adding && !batchOpen" :title="error" type="error" :closable="false" class="planner-alert"/>
    <div class="planner-import-actions"><el-button @click="openImport">导入 / 恢复计划 JSON</el-button><span v-if="backups.length">本页旧草稿备份 {{ backups.length }} 份</span><el-button v-for="(backup,index) in backups" :key="`${backup.id}-${index}`" text @click="exportPreview(backup)">导出备份 {{ index + 1 }}</el-button></div>
    <section v-if="!plan" class="panel planner-start">
      <span class="round-icon"><el-icon><Document/></el-icon></span>
      <h3>先锁定规范，再登记这批资源</h3>
      <p>规划不需要已批准样板或生成服务。开始后，每项需求和每个批次都引用同一份规范快照。</p>
      <p>当前版本：{{ workspace.spec?.version || '尚未建立规范' }} · 风格引用：{{ workspace.spec?.styleName || '待填写' }}</p>
      <el-button type="primary" :disabled="!workspace.spec" @click="begin">建立内存规划草稿</el-button>
    </section>
    <template v-else>
      <div class="planner-binding panel">
        <div><span class="field-label">已冻结的规范版本</span><strong>{{ plan.binding.specVersion }}</strong></div>
        <div><span class="field-label">同一风格引用</span><strong>{{ plan.binding.styleReference }}</strong></div>
        <div><span class="field-label">规划状态</span><strong>草稿 · 未批准</strong></div>
        <el-button :icon="Download" @click="exportPreview()">预览 / 导出计划 JSON</el-button>
      </div>
      <GenerationSourcePanel/>
      <el-alert v-if="!currentSpecMatches" class="planner-alert" type="warning" :closable="false" title="当前规范已变动，计划仍绑定原快照" description="原规划与验收条件保持不变，新增需求和编批已暂停。可导出保留；如需采用新规范，请导出后刷新，再建立新规划。"/>
      <div class="planner-toolbar"><div><h3>资源需求清单 <span>{{ plan.requirements.length }} 项</span></h3><p>默认单尺寸。只有显式确认后，才规划同母图的附加缩小尺寸。</p></div><el-button type="primary" :icon="Plus" :disabled="!currentSpecMatches" @click="openRequirement">添加本地需求</el-button></div>
      <div class="panel planner-table-wrapper">
        <table class="planner-table"><thead><tr><th>编批</th><th>资源 / 页面 / 用途</th><th>默认尺寸 / 派生</th><th>规划状态</th><th>本地操作</th></tr></thead><tbody>
          <tr v-for="item in plan.requirements" :key="item.id">
            <td><el-checkbox :model-value="selected.includes(item.id)" :disabled="item.ownerProtected || assigned.has(item.id) || !currentSpecMatches" @change="toggle(item.id, Boolean($event))"><span class="sr-only">规划选择{{ item.name }}</span></el-checkbox></td>
            <td><strong>{{ item.name }}</strong><small>{{ item.category }} · {{ item.page }} · {{ item.purpose }}</small><small>优先级：{{ item.priority === 'high' ? '高' : '普通' }} · PNG{{ item.transparent ? ' / 透明' : '' }}</small></td>
            <td><strong>{{ item.defaultSize.width }} × {{ item.defaultSize.height }}</strong><small>{{ item.derivatives.length ? `同母图派生 ${item.derivatives.map((d) => `${d.width}×${d.height}`).join('、')}` : '单尺寸 · 无派生' }}</small></td>
            <td><el-tag :type="item.ownerProtected ? 'warning' : 'info'">{{ item.ownerProtected ? 'Owner 保护' : assigned.has(item.id) ? '已编批 · 未提交' : '待编批 · 未生成' }}</el-tag><small>8 项验收条件均未检查</small></td><td><el-button text :disabled="item.ownerProtected || assigned.has(item.id) || !currentSpecMatches" @click="openEdit(item)">编辑需求</el-button><el-button text type="danger" :disabled="item.ownerProtected || assigned.has(item.id)" @click="remove(item)">移除需求</el-button><small v-if="assigned.has(item.id)">先取消对应本地批次</small></td>
          </tr>
        </tbody></table>
        <el-empty v-if="!plan.requirements.length" description="尚未登记本地需求；不会自动复制示例清单或真实资产" :image-size="70"/>
      </div>
      <div class="action-bar panel"><div><h3>选择需求，规划小批次</h3><p>已选 {{ selected.length }} 项 · 每批 1–32 项 · Owner 保护项不会进入批次</p></div><el-button :disabled="!selected.length || !currentSpecMatches" @click="openBatch">建立所选计划批次</el-button></div>
      <div class="planner-counts"><span>拟安排母图推理 <strong>{{ counts?.plannedMasterInferences }}</strong></span><span>同图派生输出 <strong>{{ counts?.plannedDerivativeOutputs }}</strong> · 增加 0 次推理</span><span>实际提交 <strong>0</strong> · 实际生成 <strong>0</strong></span></div>
      <div class="planner-batches"><article v-for="item in plan.batches" :key="item.id" class="panel planner-batch"><div><h3>{{ item.name }}</h3><el-tag type="info">计划 · 未提交</el-tag></div><p>{{ item.requirementIds.length }} 项 · 串行计划 · 未批准</p><small>{{ item.requirementIds.map((id) => plan?.requirements.find((r) => r.id === id)?.name).join(' / ') }}</small><small>规范 {{ plan.binding.specVersion }} · {{ plan.binding.styleReference }}</small><el-button text @click="cancelBatch(item.id)">取消本地计划批次</el-button></article></div>
      <section class="panel planner-preflight">
        <div class="planner-toolbar"><div><h3>下一步：执行前预检</h3><p>只展开依赖与阻塞条件，不运行工作流，不生成任何图片。</p></div><el-button @click="showPreflight = true">执行前预检（不运行）</el-button></div>
        <template v-if="showPreflight && preflight"><el-alert :title="preflight.localValidation === 'passed' ? '规划结构检查通过 · 真实执行仍被阻止' : '规划结构检查未通过'" :type="preflight.localValidation === 'passed' ? 'info' : 'error'" :closable="false"/><ul class="preflight-blockers"><li v-for="blocker in preflight.blockers" :key="blocker.code">{{ blocker.message }}</li></ul><ol class="preflight-nodes"><li v-for="node in preflight.nodes" :key="node.id"><strong>{{ node.name }}</strong><span>{{ node.outputSize ? `${node.outputSize.width} × ${node.outputSize.height}` : '人工确认关卡' }} · {{ node.inferenceIntent ? '拟推理 1 次' : '增加 0 次推理' }} · 未启动</span><small>{{ node.kind === 'planned-resize' ? '仅在同一母图人工批准后缩放' : node.kind === 'manual-approval-gate' ? '母图生成后人工检查；不自动通过' : '批次串行计划；服务与工作流尚未接通' }}</small></li></ol><p class="form-help">实际提交 0 · 实际生成 0 · 无图像、模型或工程文件写入</p></template>
      </section>
      <section class="panel planner-acceptance"><h3>验收条件已登记，结果全部待检查</h3><div><p><strong>技术检查</strong>尺寸 / 格式、alpha 与边缘、动态文字、九切片与 pivot</p><p><strong>视觉批准</strong>同一风格引用、视觉占比、小尺寸辨识、Owner 人工批准</p><p><strong>工程验收</strong>导入 UUID、Prefab 绑定、{{ plan.binding.snapshot.width }} × {{ plan.binding.snapshot.height }} 实际运行证据</p></div><span>任何规划、导出或技术检查都不会自动批准素材。批次只是下一阶段的计划。</span></section>
    </template>

    <el-dialog v-model="adding" :title="editingId ? '编辑本地资源需求' : '添加本地资源需求'" width="680px" class="planning-dialog" :close-on-click-modal="false" destroy-on-close>
      <el-form label-position="top"><div class="form-grid"><el-form-item label="资源名称"><el-input v-model="form.name" maxlength="100" aria-label="资源名称"/></el-form-item><el-form-item label="类别"><el-select v-model="form.category" aria-label="资源类别"><el-option v-for="category in ['图标','按钮','面板','角色','背景','特效','字体']" :key="category" :label="category" :value="category"/></el-select></el-form-item><el-form-item label="关联页面"><el-input v-model="form.page" maxlength="160"/></el-form-item><el-form-item label="用途"><el-input v-model="form.purpose" maxlength="200" aria-label="资源用途"/></el-form-item><el-form-item label="默认宽度 / px"><el-input-number v-model="form.defaultSize.width" :min="16" :max="8192" aria-label="资源默认宽度"/></el-form-item><el-form-item label="默认高度 / px"><el-input-number v-model="form.defaultSize.height" :min="16" :max="8192" aria-label="资源默认高度"/></el-form-item></div>
      <div class="planner-options"><el-checkbox v-model="form.transparent">透明 PNG</el-checkbox><el-checkbox v-model="form.ownerProtected" @change="derivedEnabled = false">Owner 保护（不进入生成批次）</el-checkbox><el-select v-model="form.priority" aria-label="需求优先级"><el-option label="普通优先级" value="normal"/><el-option label="高优先级" value="high"/></el-select></div>
      <div class="planner-derivation"><el-checkbox v-model="derivedEnabled" :disabled="form.ownerProtected">显式规划同母图的附加尺寸</el-checkbox><template v-if="derivedEnabled"><el-input v-model="derivedText" placeholder="128×128, 64×64" aria-label="派生尺寸" maxlength="250"/><el-checkbox v-model="confirmed">我确认从同一已批准母图缩小，增加 0 次推理</el-checkbox><p>保持宽高比，不放大、不裁切、不重新推理；每项最多 8 个派生尺寸。</p></template></div>
      <el-form-item label="补充验收条件（可选）"><el-input v-model="form.acceptanceNotes" maxlength="500"/></el-form-item></el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false"/>
      <template #footer><el-button @click="adding = false">取消</el-button><el-button type="primary" @click="add">{{ editingId ? '保存内存需求修改' : '加入内存需求清单' }}</el-button></template>
    </el-dialog>
    <el-dialog v-model="batchOpen" title="建立计划批次" width="520px" class="planning-dialog" :close-on-click-modal="false"><p class="form-help">本操作只编排所选需求，不提交生成，也不会产生批准记录。</p><el-input v-model="batchName" maxlength="100" aria-label="计划批次名称"/><p class="form-help">同一规范 {{ plan?.binding.specVersion }} / {{ plan?.binding.styleReference }} · 串行 · 未提交</p><el-alert v-if="error" :title="error" type="error" :closable="false"/><template #footer><el-button @click="batchOpen = false">取消</el-button><el-button type="primary" @click="batch">保存内存计划批次</el-button></template></el-dialog>
    <el-dialog v-model="importOpen" title="导入 / 恢复资源计划草稿" width="740px" class="planning-dialog" :close-on-click-modal="false">
      <el-alert title="只恢复浏览器内存草稿，不写项目配置" type="info" :closable="false" description="仅接受本合同的完整 JSON，最多 512 KiB。项目、模式和名称必须匹配；规范快照保持原样。任何假生成、批准、验收状态或未知字段都会拒绝。"/>
      <input type="file" accept=".json,application/json" aria-label="选择资源计划 JSON 文件" @change="readImport"/>
      <el-input v-model="importText" :disabled="importLoading" @input="editImportText" type="textarea" :rows="10" :maxlength="MAX_PLAN_IMPORT_BYTES" placeholder="选择已导出的 JSON 文件，或在此粘贴其完整内容" aria-label="待恢复资源计划 JSON"/>
      <el-checkbox v-if="plan" v-model="importConfirmed">确认替换当前内存草稿；旧草稿保留为本页可导出的备份</el-checkbox>
      <p class="form-help">页面备份同样会在刷新时丢失，请导出保存；最多保留 5 份。已有 Owner 保护项不得通过导入改写或移除。</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false"/>
      <template #footer><el-button @click="importOpen = false">取消</el-button><el-button type="primary" :loading="importLoading" :disabled="importLoading || !importText.trim() || Boolean(plan && !importConfirmed)" @click="restore">恢复到浏览器内存</el-button></template>
    </el-dialog>
    <el-dialog v-model="exportOpen" title="资源计划 JSON · 草稿导出" width="820px" class="planning-dialog"><el-alert title="这是规划 manifest，不是项目配置或执行结果" type="info" :closable="false"/><el-input :model-value="exportText" type="textarea" :rows="16" readonly aria-label="资源计划 JSON"/><template #footer><el-button @click="exportOpen = false">关闭</el-button><el-button type="primary" :icon="Download" @click="download">下载计划 JSON</el-button></template></el-dialog>
  </section>
</template>
