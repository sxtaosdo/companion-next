<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ART_CATEGORIES, type ArtCategory, type ArtValues } from '../domain/project-art-spec'
import type { AiResourceConfigV2 } from '../domain/ai-resource-read'
import { projectArtSpecProvider, type ProjectArtSpecProvider } from '../project-art-spec-integration'
import { useProjectArtSpecStore } from '../stores/project-art-spec'
const props = defineProps<{ project: { id: string; name: string; path: string } | null; source: object | null; legacy?: AiResourceConfigV2 | null; provider?: ProjectArtSpecProvider | null }>()
const store = useProjectArtSpecStore(), category = ref<ArtCategory>('icon')
const writer = computed(() => props.provider === undefined ? projectArtSpecProvider.value : props.provider)
watch([() => props.project, () => props.source, writer], () => store.bind(props.project && props.source ? { projectId: props.project.id, projectPath: props.project.path, source: props.source } : null, writer.value), { immediate: true, flush: 'sync' })
onBeforeUnmount(store.leave)
const labels: Record<ArtCategory, string> = { ip: '人物 IP', equipment: '装备', skill: '技能', ui: 'UI', icon: '图标' }
const fieldLabels: Record<keyof ArtValues, string> = { renderingLanguage: '表现形式', proportions: '比例', realism: '写实程度', materials: '材质', lighting: '光照', palette: '色彩', subject: '主体内容', identity: '身份 / 角色编号', allowedChanges: '允许变化', purpose: '用途', view: '视角', state: '状态', textSafeArea: '文本安全区', destination: 'Creator 资源目录', width: '成品宽', height: '成品高', paddingPercent: '居中留白百分比', transparent: '透明 PNG' }
const styleFields = ['renderingLanguage', 'proportions', 'realism', 'materials', 'lighting', 'palette'] as const
const categoryFields: Record<ArtCategory, (keyof ArtValues)[]> = { ip: ['subject', 'identity', 'allowedChanges', 'view'], equipment: ['subject', 'purpose', 'view'], skill: ['subject', 'purpose', 'state'], ui: ['subject', 'state', 'textSafeArea'], icon: ['subject', 'purpose'] }
const phaseLabels = { idle: '尚未读取', reading: '正在读取', editing: '未保存草稿', saving: '正在保存', saved: '已保存到工程', unknown: '保存结果未知', error: '需核对' }
const available = computed(() => store.authorities.filter(item => item.status === 'Accepted' && item.projectIds.includes(props.project?.id ?? '')))
const selected = computed(() => store.draft?.inheritance.mode === 'canon' ? store.draft.inheritance.sources : [])
const chosenAuthorities = computed(() => available.value.filter(item => selected.value.some(pin => pin.path === item.source.path && pin.revision === item.source.revision)))
function chosen(path: string) { return selected.value.some(item => item.path === path) }
function selectSource(index: number, checked: boolean) {
  if (!store.draft || store.pending) return
  const pin = available.value[index]?.source; if (!pin) return
  const sources = selected.value.filter(item => item.path !== pin.path)
  if (checked) sources.push({ ...pin })
  store.draft.inheritance = sources.length ? { mode: 'canon', sources } : { mode: 'none', reason: '' }; store.touch()
}
function independent() { if (store.draft) { store.draft.inheritance = { mode: 'none', reason: '' }; store.touch() } }
function lock(field: keyof ArtValues, layer: 'project' | ArtCategory): string | number | boolean | undefined {
  return chosenAuthorities.value.filter(item => layer === 'project' || item.categories.includes(layer)).find(item => Object.hasOwn(item.locked, field))?.locked[field]
}
function shown(field: keyof ArtValues, layer: 'project' | ArtCategory) { return lock(field, layer) ?? (layer === 'project' ? store.draft?.overrides[field] : store.draft?.categories[layer]?.[field]) ?? '' }
function effective(field: keyof ArtValues) {
  const inherited = chosenAuthorities.value.filter(item => item.categories.includes(category.value))
  return lock(field, category.value) ?? store.draft?.categories[category.value]?.[field] ?? store.draft?.overrides[field] ?? inherited.find(item => Object.hasOwn(item.defaults, field))?.defaults[field]
}
function valueSource(field: keyof ArtValues) {
  if (lock(field,category.value) !== undefined) return '全局锁定'
  if (Object.hasOwn(store.draft?.categories[category.value] ?? {},field)) return '当前分类'
  if (Object.hasOwn(store.draft?.overrides ?? {},field)) return '项目设定'
  return effective(field) === undefined ? '未填写' : '全局默认'
}
function categoryTransparent(event: Event) { const value = (event.target as HTMLSelectElement).value; store.setValue(category.value,'transparent',value === '' ? '' : value === 'true') }
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
const friendlyErrors = computed(() => store.errors.map(error => {
  if (error.startsWith('INHERITANCE_CHANGE')) return '已保存的继承范围与固定版本不能在此移除，请先审阅迁移。'
  if (error.startsWith('LOCKED_OVERRIDE')) return '存在与继承锁定项不同的设定，请核对。'
  if (error.startsWith('SOURCE_') || error.startsWith('CANON_')) return '继承来源尚未完整核实，请选择适用的固定版本接口。'
  return '请补齐项目名称、内容、画布及继承说明，并核对尺寸和目录。'
}).filter((item, index, all) => all.indexOf(item) === index))
</script>
<template>
<section class="project-art-spec section-card" data-testid="project-art-spec-panel" aria-label="项目美术规范">
  <header class="art-heading"><div><h2>美术规范</h2><span class="art-phase" :class="store.phase" role="status">{{ phaseLabels[store.phase] }}</span></div><div class="art-actions"><button type="button" :disabled="!store.context || !writer || store.pending" @click="store.read">读取 / 刷新美术规范</button><button type="button" :disabled="!store.context || !!store.draft || store.pending || store.blocked" @click="store.startDraft(project?.name ?? '')">编写项目美术草稿</button></div></header>
  <p v-if="!project">请先选择已登记工程。</p>
  <p v-else class="art-project">{{ project.name }} · {{ project.path }}</p>
  <p v-if="!writer" class="art-notice" role="status">工程保存接口未接入；可编写候选草稿，尚不能保存到工程。</p>
  <p v-if="store.message" role="status">{{ store.message }}</p><button v-if="store.blocked" type="button" :disabled="store.pending || !writer" @click="store.recover">核对原保存结果</button>
  <p v-if="store.retained">有保留的未保存草稿。<button type="button" :disabled="store.pending || store.blocked || store.retained.context.projectId !== project?.id || store.retained.context.projectPath !== project?.path || store.retained.context.source !== source" @click="store.restoreRetained">恢复此工程草稿</button></p>
  <p v-if="legacy">原图标规范 v{{ legacy.version }} · {{ legacy.iconSize.width }} × {{ legacy.iconSize.height }}；原配置和图标流程在下方保留，不自动迁移。</p>
  <template v-if="store.draft">
    <fieldset :disabled="store.pending || store.blocked" data-testid="art-global-section"><legend>全局继承</legend>
      <label class="art-check"><input type="radio" name="art-inheritance" :disabled="store.base?.inheritance.mode === 'canon'" :checked="store.draft.inheritance.mode === 'none'" @change="independent">不继承共享 Canon</label>
      <label v-if="store.draft.inheritance.mode === 'none'">适用范围说明<input v-model="store.draft.inheritance.reason" aria-label="不继承原因" maxlength="1500" @input="store.touch"></label>
      <p v-if="!available.length">尚无经过后台核实的适用来源；不能手工填写权威或锁定项。</p>
      <article v-for="(authority,index) in available" :key="authority.source.path" class="art-source"><label class="art-check"><input type="checkbox" :checked="chosen(authority.source.path)" :disabled="store.base?.inheritance.mode === 'canon' && store.base.inheritance.sources.some(pin => pin.path === authority.source.path)" :aria-label="`继承 ${authority.source.path}`" @change="selectSource(index,($event.target as HTMLInputElement).checked)">{{ authority.source.path }}</label><small>固定版本 {{ authority.source.revision }} · {{ authority.categories.map(value => labels[value]).join('、') }}</small>
        <p v-if="Object.keys(authority.locked).length">锁定：{{ Object.keys(authority.locked).map(key => fieldLabels[key as keyof ArtValues] ?? key).join('、') }}</p><p v-if="Object.keys(authority.defaults).length">可覆盖默认：{{ Object.keys(authority.defaults).map(key => fieldLabels[key as keyof ArtValues] ?? key).join('、') }}</p>
      </article>
    </fieldset>
    <fieldset :disabled="store.pending || store.blocked" data-testid="art-project-section"><legend>项目设定</legend>
      <div class="art-grid"><label>项目名称<input v-model="store.draft.project.name" aria-label="美术项目名称" maxlength="128" @input="store.touch"></label><label>引擎<input value="Cocos Creator" readonly></label></div>
      <label>项目内容说明<textarea v-model="store.draft.project.content" aria-label="美术项目内容" rows="2" maxlength="1500" @input="store.touch"/></label>
      <div class="art-grid"><label>设计画布宽<input v-model.number="store.draft.project.designResolution.width" aria-label="美术画布宽" type="number" min="1" max="8192" @input="store.touch"></label><label>设计画布高<input v-model.number="store.draft.project.designResolution.height" aria-label="美术画布高" type="number" min="1" max="8192" @input="store.touch"></label></div>
      <details><summary>画风与表现 · 仅保存项目差异</summary><div class="art-grid"><label v-for="field in styleFields" :key="field">{{ fieldLabels[field] }}<span v-if="lock(field,'project') !== undefined" class="art-lock">继承锁定</span><input :value="shown(field,'project')" :disabled="lock(field,'project') !== undefined" :aria-label="`项目${fieldLabels[field]}`" maxlength="1500" placeholder="未填写则沿用适用默认" @input="update($event,field,'project')"></label></div></details>
      <div class="art-grid"><label v-for="field in (['width','height','paddingPercent'] as const)" :key="field">{{ fieldLabels[field] }}<input :value="shown(field,'project')" :disabled="lock(field,'project') !== undefined" :aria-label="`项目${fieldLabels[field]}`" type="number" :min="field==='paddingPercent'?0:1" :max="field==='paddingPercent'?40:4096" @input="update($event,field,'project',true)"></label><label>Creator 资源目录<input :value="shown('destination','project')" :disabled="lock('destination','project') !== undefined" aria-label="项目资源目录" placeholder="assets/art" @input="update($event,'destination','project')"></label></div>
      <label class="art-check"><input type="checkbox" :checked="shown('transparent','project') === true" :disabled="lock('transparent','project') !== undefined" @change="store.setValue('project','transparent',($event.target as HTMLInputElement).checked)">透明 PNG</label>
    </fieldset>
    <fieldset :disabled="store.pending || store.blocked" data-testid="art-category-section"><legend>素材分类</legend>
      <div class="art-tabs" role="group" aria-label="美术素材类别"><button v-for="item in ART_CATEGORIES" :key="item" type="button" :aria-pressed="category === item" @click="category=item">{{ labels[item] }}</button></div>
      <div class="art-grid"><label v-for="field in categoryFields[category]" :key="`${category}-${field}`">{{ fieldLabels[field] }}<span v-if="lock(field,category)!==undefined" class="art-lock">继承锁定</span><input :value="shown(field,category)" :disabled="lock(field,category)!==undefined" :aria-label="`${labels[category]}${fieldLabels[field]}`" maxlength="1500" placeholder="此类别的内容要求或差异" @input="update($event,field,category)"></label></div>
      <div class="art-grid" data-testid="art-category-technical"><label v-for="field in (['width','height'] as const)" :key="field">{{ labels[category] }}{{ fieldLabels[field] }}<input :value="store.draft.categories[category]?.[field] ?? ''" :disabled="lock(field,category)!==undefined" :aria-label="`${labels[category]}${fieldLabels[field]}`" type="number" min="1" max="4096" :placeholder="String(effective(field) ?? '沿用项目')" @input="update($event,field,category,true)"><small>有效值 {{ effective(field) ?? '未填写' }} · {{ valueSource(field) }}</small></label>
        <label>{{ labels[category] }}透明背景<select :value="store.draft.categories[category]?.transparent === undefined ? '' : String(store.draft.categories[category]?.transparent)" :disabled="lock('transparent',category)!==undefined" :aria-label="`${labels[category]}透明背景`" @change="categoryTransparent"><option value="">沿用项目 / 全局</option><option value="true">透明 PNG</option><option value="false">不透明</option></select><small>有效值 {{ effective('transparent') === undefined ? '未填写' : effective('transparent') ? '透明' : '不透明' }} · {{ valueSource('transparent') }}</small></label>
        <label>{{ labels[category] }}资源目录<input :value="store.draft.categories[category]?.destination ?? ''" :disabled="lock('destination',category)!==undefined" :aria-label="`${labels[category]}资源目录`" :placeholder="String(effective('destination') ?? 'assets/art')" @input="update($event,'destination',category)"><small>有效值 {{ effective('destination') ?? '未填写' }} · {{ valueSource('destination') }}</small></label>
      </div>
      <p class="art-secondary">类别配置不代表生成器已支持该类别；人物一致性与参考图入模仍未实现。</p>
    </fieldset>
    <ul v-if="friendlyErrors.length" role="alert"><li v-for="error in friendlyErrors" :key="error">{{ error }}</li></ul>
    <p v-if="store.dirty" class="art-secondary" aria-label="美术规范待保存差异">待保存：{{ changedSections.join('、') }}</p>
    <footer><p v-if="store.legacyVersion !== null" class="art-secondary">本次确认将保留原图标文件，并创建统一美术规范（版本 {{ store.legacyVersion + 1 }}）。</p><label class="art-check"><input v-model="store.confirmed" aria-label="确认美术规范保存" type="checkbox" :disabled="!writer || store.pending || store.blocked || !!store.errors.length">我已核对当前工程、继承来源和项目差异，批准本次保存。</label><button type="button" :disabled="!store.canSave" @click="store.save">保存美术规范到工程</button><small v-if="store.hash === undefined">尚未读取工程原文件，不能保存。</small></footer>
  </template>
</section>
</template>
<style scoped>
.project-art-spec{display:grid;gap:14px}.art-heading,.art-heading>div:first-child,.art-actions,.art-tabs{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.art-heading{justify-content:space-between}.art-heading h2{margin:0}.art-phase{font-size:12px;padding:4px 8px;border-radius:5px;background:var(--el-fill-color,#f0f2f5)}.art-phase.saved{color:var(--el-color-success,#529b2e)}.art-phase.unknown,.art-notice{color:var(--el-color-warning-dark-2,#996515)}.art-phase.error{color:var(--el-color-danger,#c45656)}fieldset{margin:0;min-width:0;border:1px solid var(--el-border-color,#dcdfe6);border-radius:6px;padding:16px;display:grid;gap:12px}legend{font-weight:600;padding:0 6px}.art-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}label{display:grid;gap:6px;font-size:13px}.art-check{display:flex;align-items:center;gap:7px}.art-check input{width:auto}input,textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--el-border-color,#dcdfe6);border-radius:4px;color:inherit;background:var(--el-bg-color,#fff);font:inherit}input:disabled{background:var(--el-fill-color-light,#f5f7fa)}button{padding:7px 12px;border:1px solid var(--el-border-color,#dcdfe6);border-radius:4px;background:var(--el-bg-color,#fff);color:inherit;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}button[aria-pressed=true]{border-color:var(--el-color-primary,#409eff);color:var(--el-color-primary,#409eff)}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--el-color-primary,#409eff);outline-offset:2px}.art-lock{color:var(--el-text-color-secondary,#606266);font-size:12px}.art-source{overflow-wrap:anywhere}.art-source p,.art-source small{margin:4px 0;font-size:12px}.art-secondary,.art-project,footer small{font-size:12px;color:var(--el-text-color-secondary,#606266)}footer{display:grid;justify-items:start;gap:10px}summary{cursor:pointer;margin-bottom:10px}
</style>
