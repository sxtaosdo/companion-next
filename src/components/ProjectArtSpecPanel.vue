<script setup lang="ts">
import InfoTip from './InfoTip.vue'
import ArtInheritanceStatus from './ArtInheritanceStatus.vue'
import {artSettingHelp,artValueHelp} from '../domain/art-spec-field-help'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArtSpecError, validateArtProjectSettings, ART_CATEGORIES, ART_CANON_USAGES, type CanonArtUsage, type ArtCategory, type ArtValues } from '../domain/project-art-spec'
import type { AiResourceConfigV2 } from '../domain/ai-resource-read'
import { projectArtSpecProvider, type ProjectArtSpecProvider } from '../project-art-spec-integration'
import { useProjectArtSpecStore } from '../stores/project-art-spec'
const props = defineProps<{ project: { id: string; name: string; path: string } | null; source: object | null; legacy?: AiResourceConfigV2 | null; provider?: ProjectArtSpecProvider | null; sharedHeader?: boolean }>()
const store = useProjectArtSpecStore(), category = ref<ArtCategory>('icon')
const section = ref(0), editing = ref(false)
const sectionNames = ['项目设定', '通用规范', '素材分类', '核对保存']
const reached = ref(0)
const canvasPresets = [
  {id:'mobile-game',label:'移动端小游戏 · 750 × 1334',width:750,height:1334},
  {id:'mobile-hd',label:'移动端高清 · 1080 × 1920',width:1080,height:1920},
  {id:'pc-hd',label:'PC 1080P · 1920 × 1080',width:1920,height:1080},
] as const
const canvasChoice=ref('custom')
watch(()=>store.draft,value=>{if(value)canvasChoice.value=canvasPresets.find(p=>p.width===value.project.designResolution.width&&p.height===value.project.designResolution.height)?.id??'custom'},{immediate:true,flush:'sync'})
function chooseCanvas(event:Event){
  if(!store.draft || store.pending || store.blocked)return
  canvasChoice.value=(event.target as HTMLSelectElement).value
  const preset=canvasPresets.find(p=>p.id===canvasChoice.value)
  if(preset){store.draft.project.designResolution={width:preset.width,height:preset.height};store.touch()}
}
let editorRevision=0
watch(() => store.context, () => { editorRevision++; section.value = 0; reached.value = 0; editing.value = false }, { flush: 'sync' })
watch(() => store.draft, value => { if (value && !store.base) editing.value = true })
function openEditor() {
  if (!store.context || store.pending || store.blocked || (!!writer.value && store.hash === undefined)) return
  if (store.retained && !store.dirty) store.restoreRetained()
  if (!store.draft) store.startDraft(props.project?.name ?? '')
  if (store.draft) {
    if(props.project && store.draft.project.name!==props.project.name){store.draft.project.name=props.project.name;store.touch()}
    if(!store.base && store.legacyVersion===null && store.draft.project.designResolution.width===0 && store.draft.project.designResolution.height===0){store.draft.project.designResolution={width:750,height:1334};canvasChoice.value='mobile-game';store.touch()}
    editorRevision++; editing.value = true; section.value = 0; reached.value = 0 }
}
function closeEditor() { editorRevision++; editing.value = false }
function goToSection(index:number){if(index<=reached.value && !store.pending && !store.blocked && (index<=section.value || !currentErrors.value.length))section.value=index}
function next() { if (currentErrors.value.length) return; section.value = Math.min(3, section.value + 1); reached.value = Math.max(reached.value, section.value) }
async function saveAndRead() { const context=store.context, provider=store.provider, revision=editorRevision; await store.save(); if (revision!==editorRevision || !editing.value || store.context!==context || store.provider!==provider) return; if (store.phase === 'saved') { await store.read(); if (revision===editorRevision && editing.value && store.context===context && store.provider===provider) editing.value = ['error','unknown'].includes(store.phase) } }
defineExpose({ openEditor })
const currentErrors = computed(() => {
  if (section.value === 0 && store.draft) { try { validateArtProjectSettings(store.draft.project); return !store.base && !store.draft.project.visualMode ? ['REQUIRED · project.visualMode'] : [] } catch (error) { return [error instanceof ArtSpecError ? `${error.code} · ${error.field}` : 'INVALID_CONFIG · project'] } }
  return store.errors.filter(error => section.value === 3 || (section.value === 1 ? !/ · (?:project|categories)(?:\.|$)/.test(error) : section.value === 2 ? / · categories(?:\.|$)/.test(error) : false))
})

const writer = computed(() => props.provider === undefined ? projectArtSpecProvider.value : props.provider)
watch([() => props.project, () => props.source, writer], () => store.bind(props.project && props.source ? { projectId: props.project.id, projectPath: props.project.path, source: props.source } : null, writer.value), { immediate: true, flush: 'sync' })
onBeforeUnmount(store.leave)
const labels: Record<ArtCategory, string> = { ip: '人物 IP', equipment: '装备', skill: '技能', ui: 'UI', icon: '图标' }
const fieldLabels: Record<keyof ArtValues, string> = { renderingLanguage: '表现形式', proportions: '比例', realism: '写实程度', materials: '材质', lighting: '光照', palette: '色彩', subject: '主体内容', identity: '身份 / 角色编号', allowedChanges: '允许变化', purpose: '用途', view: '视角', state: '状态', textSafeArea: '文本安全区', destination: 'Creator 资源目录', exportDirectory: '导出目录', backgroundColor: '底色', width: '成品宽', height: '成品高', paddingPercent: '居中留白百分比', transparent: '透明 PNG' }
const legacyTechnical = computed(() => !!store.draft && (!!store.base || store.legacyVersion!==null) && [store.draft.overrides,...Object.values(store.draft.categories)].some(values=>['width','height','backgroundColor','transparent','paddingPercent'].some(key=>Object.hasOwn(values,key))))
const categoryFields: Record<ArtCategory, (keyof ArtValues)[]> = { ip: ['subject', 'identity', 'allowedChanges', 'view'], equipment: ['subject', 'purpose', 'view'], skill: ['subject', 'purpose', 'state'], ui: ['subject', 'state', 'textSafeArea'], icon: ['subject', 'purpose'] }
const available = computed(() => store.authorities.filter(item => item.status === 'Accepted' && item.projectIds.includes(props.project?.id ?? '')))
const usageLabels: Record<CanonArtUsage,string> = { 'shared-concept': '共享概念', runtime: '正式运行素材', 'placeholder-validation': '占位与验证' }
const selected = computed(() => store.draft?.inheritance.mode === 'canon' ? store.draft.inheritance.sources : [])
const chosenAuthorities = computed(() => available.value.filter(item => selected.value.some(pin => pin.path === item.source.path && pin.revision === item.source.revision)))
function chosen(path: string) { return selected.value.some(item => item.path === path) }
function selectSource(index: number, checked: boolean) {
  if (!store.draft || store.pending) return
  const pin = available.value[index]?.source; if (!pin) return
  const sources = selected.value.filter(item => item.path !== pin.path)
  if (checked) sources.push({ ...pin })
  const usage = store.draft.inheritance.mode === 'canon' ? store.draft.inheritance.usage : undefined
  store.draft.inheritance = sources.length ? { mode: 'canon', sources, ...(usage ? { usage } : {}) } : { mode: 'none', reason: '' }; store.touch()
}
function selectUsage(event: Event) {
  if (!store.draft || store.draft.inheritance.mode !== 'canon' || store.pending || store.base?.inheritance.mode === 'canon' && store.base.inheritance.usage !== undefined) return
  const value = (event.target as HTMLSelectElement).value
  if ((ART_CANON_USAGES as readonly string[]).includes(value)) { store.draft.inheritance.usage = value as CanonArtUsage; store.touch() }
}
function independent() { if (store.draft && store.draft.inheritance.mode !== 'none') { store.draft.inheritance = { mode: 'none', reason: '' }; store.touch() } }
function lock(field: keyof ArtValues, layer: 'project' | ArtCategory): string | number | boolean | undefined {
  return chosenAuthorities.value.filter(item => layer === 'project' || item.categories.includes(layer)).find(item => Object.hasOwn(item.locked, field))?.locked[field]
}
function shown(field: keyof ArtValues, layer: 'project' | ArtCategory) { return lock(field, layer) ?? (layer === 'project' ? store.draft?.overrides[field] : store.draft?.categories[layer]?.[field]) ?? '' }
function update(event: Event, field: keyof ArtValues, layer: 'project' | ArtCategory, numeric = false) {
  const value = (event.target as HTMLInputElement).value; store.setValue(layer, field, numeric && value !== '' ? Number(value) : value)
}
const changedSections = computed(() => {
  if (!store.draft) return []
  const result: string[] = []
  if (JSON.stringify(store.draft.inheritance) !== JSON.stringify(store.base?.inheritance)) result.push('全局继承与固定版本')
  if (JSON.stringify(store.draft.project) !== JSON.stringify(store.base?.project)) result.push('项目名称、内容或画布')
  if (JSON.stringify(store.draft.overrides) !== JSON.stringify(store.base?.overrides)) result.push('项目差异与成品要求')
  for (const item of ART_CATEGORIES) if (JSON.stringify(store.draft.categories[item]) !== JSON.stringify(store.base?.categories[item])) result.push(labels[item] + '类别差异')
  return result
})
const friendlyErrors = computed(() => currentErrors.value.map(error => {
  if (error.startsWith('INHERITANCE_CHANGE')) return '已保存的继承范围与固定版本不能在此移除，请先审阅迁移。'
  if (error.startsWith('LOCKED_OVERRIDE')) return '存在与继承锁定项不同的设定，请核对。'
  if (error.startsWith('SOURCE_DEPENDENCY_REQUIRED')) return '所选来源还需同时继承其依赖来源。'
  if (error.startsWith('SOURCE_USAGE_OUT_OF_SCOPE')) return '请明确继承用途，并确认所选来源允许该用途。'
  if (error.includes('inheritance.reason')) return '请填写使用项目自身设定的说明。'
  const field = error.split(' · ')[1] ?? ''
  const projectLabels: Record<string,string> = { 'project.name':'项目名称', 'project.visualMode':'2D / 3D 表现', 'project.content':'项目内容', 'project.designResolution.width':'设计画布宽度（1–8192 的整数）', 'project.designResolution.height':'设计画布高度（1–8192 的整数）' }
  if (projectLabels[field]) return '请填写有效的' + projectLabels[field] + '。'
  if (/^(overrides|categories)\./.test(field)) { const parts=field.split('.'); const name=fieldLabels[parts.at(-1) as keyof ArtValues] ?? field; return '请核对' + (parts[0]==='categories' ? labels[parts[1] as ArtCategory] : '项目') + name + '。' }
  if (error.startsWith('SOURCE_') || error.startsWith('CANON_')) return '继承来源尚未完整核实，请选择适用的固定版本接口。'
  return '请核对当前步骤的内容、继承范围和目录。'
}).filter((item, index, all) => all.indexOf(item) === index))
</script>
<template>
<section class="project-art-spec section-card" data-testid="project-art-spec-panel" aria-label="项目美术规范">
  <div v-if="!sharedHeader" class="art-heading"><h2>美术规范</h2><button type="button" :disabled="!store.context || !writer || store.pending || store.dirty" @click="store.read">读取 / 刷新美术规范</button></div>
  <p v-if="!project">请先选择已登记工程。</p>
  <template v-else>
    <p v-if="store.pending" role="status">{{ store.phase==='saving' ? '正在保存规范…' : '正在读取规范…' }}</p>
    <p v-else-if="store.blocked || store.phase==='unknown'" role="status">规范结果待核对，不能创建新规范。</p>
    <p v-else-if="store.phase==='error'" role="alert">规范读取失败，请重试。</p>
    <div v-else-if="store.base" class="art-saved-summary" data-testid="art-saved-summary"><strong>{{ store.base.project.name }} · v{{ store.base.version }}</strong><span>{{ store.base.project.designResolution.width }} × {{ store.base.project.designResolution.height }}</span><button v-if="!sharedHeader" type="button" :disabled="store.pending || store.blocked" @click="openEditor">查看 / 编辑美术规范</button></div>
    <div v-else-if="store.hash === null || store.legacyVersion !== null"><p>当前工程尚未配置项目美术规范。</p><el-button v-if="!sharedHeader" type="primary" :disabled="store.pending || store.blocked" @click="openEditor">新建美术规范</el-button><small v-if="store.legacyVersion !== null">已有图标配置 v{{ store.legacyVersion }}，新建时保留原文件并带入可兼容字段。</small></div>
    <p v-else-if="!store.pending && !store.draft">请读取当前工程美术规范。</p>
    <p v-if="store.dirty && !editing" role="status">有未保存的规范草稿。<button type="button" @click="openEditor">继续编辑</button></p>
    <p v-if="store.blocked" role="status">保存结果待核对。<button type="button" :disabled="store.pending || !writer" @click="store.recover">核对原保存结果</button></p>
  </template>
  <el-dialog class="project-setup-dialog art-spec-dialog" modal-class="project-setup-overlay" :model-value="editing" :title="store.base ? '编辑项目美术规范' : '新建项目美术规范'" width="min(760px, calc(100vw - 24px))" :close-on-click-modal="false" :close-on-press-escape="!store.pending" :show-close="!store.pending" @update:model-value="!$event && closeEditor()">
   <template #header="{titleId,titleClass}"><div class="art-dialog-title"><span :id="titleId" :class="titleClass">{{ store.base ? '编辑项目美术规范' : '新建项目美术规范' }}</span><InfoTip label="美术规范填写说明" :text="artSettingHelp.wizard"/></div></template>
   <template v-if="store.draft">
    <p class="art-project">{{ project?.name }} · {{ project?.path }}</p>
    <p v-if="!writer" class="art-notice" role="status">工程保存接口未接入；仅可保留草稿。</p>
    <p v-if="store.message && ['error','unknown','saving'].includes(store.phase)" role="status">{{ store.message }}</p>
    <p v-if="store.retained">有此工程保留的草稿。<button type="button" :disabled="store.pending || store.blocked" @click="store.restoreRetained">恢复此工程草稿</button></p>
    <div class="art-wizard-layout">
     <nav class="art-wizard-steps" aria-label="规范填写进度">
      <el-steps data-testid="art-wizard-progress" direction="vertical" :active="section" finish-status="success">
       <el-step v-for="(title,index) in sectionNames" :key="title" :status="section===index?'process':index<section?'success':'wait'" :description="section===index?'当前步骤':index<section?'已完成':index<=reached?'已到达':'未到达'">
        <template #title><button class="art-step-button" type="button" :disabled="index>reached || store.pending || store.blocked || (index>section && !!currentErrors.length)" :aria-current="section===index?'step':undefined" @click="goToSection(index)">{{ title }}</button></template>
       </el-step>
      </el-steps>
     </nav>
     <div class="art-wizard-body" data-testid="art-spec-wizard">
       <h3 data-testid="art-current-section" class="visually-hidden">{{ sectionNames[section] }}</h3>
    <fieldset v-if="section === 0" :disabled="store.pending || store.blocked" data-testid="art-project-section"><legend>项目设定</legend>
      <div class="art-grid"><label><span class="art-field-title">项目名称<InfoTip label="项目名称说明" :text="artSettingHelp.name"/><small class="art-field-kind">自动带入</small></span><input :value="project?.name" aria-label="美术项目名称" readonly></label><label><span class="art-field-title">引擎<InfoTip label="引擎说明" :text="artSettingHelp.engine"/><small class="art-field-kind">自动带入</small></span><input value="Cocos Creator" aria-label="项目引擎" readonly></label></div>
      <label><span class="art-field-title">2D / 3D 表现<span v-if="!store.base" class="art-required" aria-hidden="true">*</span><InfoTip label="2D / 3D 表现说明" :text="artSettingHelp.visualMode"/><small class="art-field-kind">{{ store.base ? '旧规范可保留未指定' : '必选' }}</small></span><select v-model="store.draft.project.visualMode" aria-label="项目视觉表现" :aria-required="!store.base" @change="store.touch"><option :value="undefined" :disabled="!store.base">{{ store.base ? '未指定（旧规范）' : '请选择' }}</option><option value="2d">2D</option><option value="3d">3D</option></select></label>
      <label><span class="art-field-title">项目内容说明 <span class="art-required" aria-hidden="true">*</span><InfoTip label="项目内容填写说明" :text="artSettingHelp.content"/><small class="art-field-kind">必填</small></span><textarea v-model="store.draft.project.content" aria-label="美术项目内容" aria-required="true" rows="3" maxlength="1500" placeholder="写清游戏类型、核心玩法、世界观或场景、目标用户和美术主题。例：面向休闲玩家的蚂蚁经营小游戏，收集食材扩建厨房，明亮卡通风格。" @input="store.touch"/></label>
      <label><span class="art-field-title">设计分辨率 <span class="art-required" aria-hidden="true">*</span><InfoTip label="设计分辨率说明" :text="artSettingHelp.canvas"/><small class="art-field-kind">必填</small></span><select aria-label="设计画布预设" aria-required="true" :value="canvasChoice" @change="chooseCanvas"><option v-for="preset in canvasPresets" :key="preset.id" :value="preset.id">{{ preset.label }}</option><option value="custom">自定义</option></select><small>游戏设计画布，不是 AI 出图尺寸。</small></label>
      <div class="art-grid"><label><span class="art-field-title">设计画布宽 <span class="art-required" aria-hidden="true">*</span><InfoTip label="设计画布宽说明" :text="artSettingHelp.width"/><small class="art-field-kind">必填</small></span><input v-model.number="store.draft.project.designResolution.width" aria-label="美术画布宽" aria-required="true" :readonly="canvasChoice!=='custom'" type="number" min="1" max="8192" @input="store.touch"></label><label><span class="art-field-title">设计画布高 <span class="art-required" aria-hidden="true">*</span><InfoTip label="设计画布高说明" :text="artSettingHelp.height"/><small class="art-field-kind">必填</small></span><input v-model.number="store.draft.project.designResolution.height" aria-label="美术画布高" aria-required="true" :readonly="canvasChoice!=='custom'" type="number" min="1" max="8192" @input="store.touch"></label></div>
    </fieldset>
<template v-if="section === 1">
    <fieldset v-if="section === 1" :disabled="store.pending || store.blocked" data-testid="art-global-section"><legend><span class="art-field-title">继承的全局设定<InfoTip label="继承的全局设定说明" :text="artSettingHelp.inheritance"/><small class="art-field-kind">必选</small></span></legend>
      <ArtInheritanceStatus :saved="!!store.base && !store.dirty" :phase="store.phase" :resolution="store.inheritanceResolution" :inheritance="store.draft.inheritance" :authorities="store.authorities"/>
      <label class="art-check"><input type="radio" name="art-inheritance" :disabled="store.base?.inheritance.mode === 'canon'" :checked="store.draft.inheritance.mode === 'none'" @change="independent">使用项目自身设定<InfoTip label="使用项目自身设定说明" :text="artSettingHelp.inheritance"/></label>
      <label v-if="store.draft.inheritance.mode === 'none'"><span class="art-field-title">项目适用说明<InfoTip label="项目适用说明说明" :text="artSettingHelp.reason"/><small class="art-field-kind">可选</small></span><input v-model="store.draft.inheritance.reason" aria-label="不继承原因" aria-required="false" maxlength="1500" @input="store.touch"></label>
      <label v-if="store.draft.inheritance.mode === 'canon'"><span class="art-field-title">继承用途 <span class="art-required" aria-hidden="true">*</span><InfoTip label="继承用途说明" :text="artSettingHelp.usage"/><small class="art-field-kind">必填</small></span><select :value="store.draft.inheritance.usage ?? ''" aria-label="继承用途" aria-required="true" :disabled="store.base?.inheritance.mode === 'canon' && store.base.inheritance.usage !== undefined" @change="selectUsage"><option value="" disabled>请明确用途</option><option v-for="usage in ART_CANON_USAGES" :key="usage" :value="usage">{{ usageLabels[usage] }}</option></select><small>人物共享概念不等于正式运行授权；旧文件未标明用途时需显式补齐。</small></label>
      <article v-for="(authority,index) in available" :key="authority.source.path" class="art-source"><label class="art-check"><input type="checkbox" :checked="chosen(authority.source.path)" :disabled="store.base?.inheritance.mode === 'canon' && store.base.inheritance.sources.some(pin => pin.path === authority.source.path)" :aria-label="`继承 ${authority.source.path}`" @change="selectSource(index,($event.target as HTMLInputElement).checked)">{{ authority.source.path }}<InfoTip :label="`继承 ${authority.source.path}说明`" :text="artSettingHelp.source"/></label><small>固定版本 {{ authority.source.revision }} · {{ authority.categories.map(value => labels[value]).join('、') }}</small>
        <p>允许用途：{{ (authority.allowedUsages ?? []).map(value => usageLabels[value]).join(' / ') || '未授权' }}</p><p v-if="Object.keys(authority.locked).length">锁定：{{ Object.keys(authority.locked).map(key => fieldLabels[key as keyof ArtValues] ?? key).join('、') }}</p><p v-if="Object.keys(authority.defaults).length">可覆盖默认：{{ Object.keys(authority.defaults).map(key => fieldLabels[key as keyof ArtValues] ?? key).join('、') }}</p>
      </article>
    </fieldset>
    <fieldset :disabled="store.pending || store.blocked" data-testid="art-project-values"><legend>通用规范</legend>
      <label><span class="art-field-title">画风说明<InfoTip label="画风说明" :text="artValueHelp.renderingLanguage"/><small class="art-field-kind">可选</small></span><span v-if="lock('renderingLanguage','project')!==undefined" class="art-lock">继承锁定</span><textarea :value="String(shown('renderingLanguage','project'))" :disabled="lock('renderingLanguage','project')!==undefined" aria-label="项目画风说明" rows="3" maxlength="1500" @input="update($event,'renderingLanguage','project')"/></label>
      <div class="art-grid"><label v-for="field in (['destination','exportDirectory'] as const)" :key="field"><span class="art-field-title">{{ fieldLabels[field] }}<InfoTip :label="`${fieldLabels[field]}说明`" :text="artValueHelp[field]"/><small class="art-field-kind">工程内相对目录</small></span><input :value="shown(field,'project')" :disabled="lock(field,'project')!==undefined" :aria-label="`项目${fieldLabels[field]}`" @input="update($event,field,'project')"></label></div>
      <p class="art-secondary" data-testid="art-output-policy">{{ store.draft.imageOutput==='transparent-png' ? '图片输出：透明 PNG' : '旧规范输出设置保持不变。' }}<InfoTip label="图片输出说明" :text="artSettingHelp.imageOutput"/></p>
      <p v-if="legacyTechnical" class="art-secondary" data-testid="art-legacy-values">旧尺寸、留白及背景设置已保留，在资源规划时核对。</p>
    </fieldset>
</template>
    <fieldset v-if="section===2" :disabled="store.pending || store.blocked" data-testid="art-category-section"><legend><span class="art-field-title">素材分类<InfoTip label="素材分类说明" :text="artSettingHelp.categories"/><small class="art-field-kind">可选，可跳过</small></span></legend>
      <div class="art-tabs" role="group" aria-label="美术素材类别"><button v-for="item in ART_CATEGORIES" :key="item" type="button" :aria-pressed="category===item" @click="category=item">{{ labels[item] }}</button></div>
      <div class="art-grid"><label v-for="field in categoryFields[category]" :key="`${category}-${field}`"><span class="art-field-title">{{ fieldLabels[field] }}<InfoTip :label="`${fieldLabels[field]}说明`" :text="artValueHelp[field]"/><small class="art-field-kind">可选</small></span><span v-if="lock(field,category)!==undefined" class="art-lock">继承锁定</span><input :value="shown(field,category)" :disabled="lock(field,category)!==undefined" :aria-label="`${labels[category]}${fieldLabels[field]}`" maxlength="1500" @input="update($event,field,category)"></label></div>
    </fieldset>
       <template v-if="section===3"><dl class="art-confirm-summary"><dt>当前项目</dt><dd>{{ store.draft.project.name }}</dd><dt>视觉表现</dt><dd>{{ store.draft.project.visualMode?.toUpperCase() ?? '未指定（旧规范）' }}</dd><dt>设计画布</dt><dd>{{ store.draft.project.designResolution.width }} × {{ store.draft.project.designResolution.height }}</dd><dt>继承方式</dt><dd>{{ store.draft.inheritance.mode==='canon' ? '固定版本的全局设定' : '项目自身设定' }}</dd><dt>本次保存</dt><dd>{{ changedSections.join('、') || '无更改' }}</dd><dt>工程内文件</dt><dd>{{ project?.id }}.art-spec.json</dd></dl><p v-if="store.legacyVersion!==null" class="art-secondary">将保留原图标文件，另存项目美术规范（版本 {{ store.legacyVersion+1 }}）。</p></template>
       <ul v-if="friendlyErrors.length" role="alert"><li v-for="error in friendlyErrors" :key="error">{{ error }}</li></ul>
       <div v-if="section<3" class="art-actions"><button v-if="section>0" type="button" :disabled="store.pending || store.blocked" @click="section--">返回修改</button><button type="button" :disabled="store.pending || store.blocked || !!currentErrors.length" @click="next">{{ section===2 ? '继续核对' : '继续' }}</button><button v-if="section===2" type="button" :disabled="store.pending || store.blocked || !!currentErrors.length" @click="next">跳过分类</button></div>
       <div v-else class="art-final-section"><label class="art-check"><input v-model="store.confirmed" aria-label="确认美术规范保存" aria-required="true" type="checkbox" :disabled="!writer || store.pending || store.blocked || !!store.errors.length">已核对当前工程和本次更改。<span class="art-required" aria-hidden="true">*</span><InfoTip label="保存确认说明" :text="artSettingHelp.confirm"/></label><div class="art-actions"><button type="button" :disabled="store.pending || store.blocked" @click="section--">返回修改</button><button type="button" :disabled="!store.canSave" @click="saveAndRead">{{ store.base ? '保存修改' : '创建美术规范' }}</button><button v-if="store.blocked" type="button" :disabled="store.pending || !writer" @click="store.recover">核对原保存结果</button><small v-if="store.hash===undefined">尚未读取工程原文件，不能保存。</small></div></div>
     </div>
    </div>
   </template>

  </el-dialog>
</section>
</template>
<style scoped>
.project-art-spec{display:grid;gap:14px}.art-heading,.art-heading>div:first-child,.art-actions,.art-tabs{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.art-heading{justify-content:space-between}.art-heading h2{margin:0}.art-phase{font-size:12px;padding:4px 8px;border-radius:5px;background:var(--el-fill-color,#f0f2f5)}.art-phase.saved{color:var(--el-color-success,#529b2e)}.art-phase.unknown,.art-notice{color:var(--el-color-warning-dark-2,#996515)}.art-phase.error{color:var(--el-color-danger,#c45656)}fieldset{margin:0;min-width:0;border:1px solid var(--el-border-color,#dcdfe6);border-radius:6px;padding:16px;display:grid;gap:12px}legend{font-weight:600;padding:0 6px}.art-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}label{display:grid;gap:6px;font-size:13px}.art-check{display:flex;align-items:center;gap:7px}.art-check input{width:auto}input,textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--el-border-color,#dcdfe6);border-radius:4px;color:inherit;background:var(--el-bg-color,#fff);font:inherit}input:disabled{background:var(--el-fill-color-light,#f5f7fa)}button{padding:7px 12px;border:1px solid var(--el-border-color,#dcdfe6);border-radius:4px;background:var(--el-bg-color,#fff);color:inherit;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}button[aria-pressed=true]{border-color:var(--el-color-primary,#409eff);color:var(--el-color-primary,#409eff)}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--el-color-primary,#409eff);outline-offset:2px}.art-lock{color:var(--el-text-color-secondary,#606266);font-size:12px}.art-source{overflow-wrap:anywhere}.art-source p,.art-source small{margin:4px 0;font-size:12px}.art-secondary,.art-project{font-size:12px;color:var(--el-text-color-secondary,#606266)}summary{cursor:pointer;margin-bottom:10px}
</style>

<style scoped>.art-saved-summary{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.art-confirm-summary{display:grid;grid-template-columns:100px 1fr;gap:8px}.art-confirm-summary dd{margin:0;overflow-wrap:anywhere}.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style>

<style scoped>.art-spec-dialog :deep(.el-steps){margin:8px 0 16px}.art-spec-dialog :deep(.el-step__title){font-size:14px}.art-spec-dialog :deep(.el-step__description){font-size:12px}.art-spec-dialog :deep(.el-step){cursor:default}.art-spec-dialog select{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--el-border-color);border-radius:4px;background:var(--el-bg-color);color:inherit;font:inherit}.art-spec-dialog input[readonly]{background:var(--el-fill-color-light)}@media(max-width:520px){.art-spec-dialog :deep(.el-step__title){font-size:12px}.art-spec-dialog :deep(.el-step__description){font-size:11px}.art-grid{grid-template-columns:1fr}}</style>

<style scoped>
.art-wizard-layout{display:grid;grid-template-columns:140px minmax(0,1fr);gap:20px;margin-top:16px;align-items:start}
.art-wizard-steps{position:sticky;top:12px;min-width:0}.art-wizard-steps :deep(.el-steps){min-height:240px;margin:0}.art-wizard-body{display:grid;gap:12px;min-width:0}
.art-step-button{padding:0;border:0;background:transparent;text-align:left;line-height:1.5;font:inherit;color:inherit}.art-step-button[aria-current=step]{font-weight:600;color:var(--el-color-primary)}
.art-field-title{display:flex;align-items:center;gap:3px;flex-wrap:wrap}.art-field-kind{font-size:11px;color:var(--el-text-color-secondary);font-weight:400}.art-required{color:var(--el-color-danger);margin-left:3px}.art-category-choice{margin:0}
@media(max-width:600px){.art-wizard-layout{grid-template-columns:92px minmax(0,1fr);gap:10px}.art-wizard-body .art-grid{grid-template-columns:minmax(0,1fr)}.art-wizard-body fieldset{padding:10px}.art-wizard-steps :deep(.el-step__main){padding-left:6px}.art-wizard-steps :deep(.el-step__title){line-height:1.5}.art-step-button{font-size:12px}.art-field-kind{font-size:10px}}
</style>

<style scoped>
.art-dialog-title{display:flex;align-items:center;gap:6px;min-width:0;padding-right:24px}.art-optional-advanced{border:1px solid var(--el-border-color);border-radius:6px;padding:12px}.art-optional-advanced>summary{font-weight:600;margin:0;cursor:pointer}.art-optional-advanced[open]>summary{margin-bottom:12px}.art-advanced-content{display:grid;gap:12px}.art-final-section{display:grid;gap:12px}
</style>
