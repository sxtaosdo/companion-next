<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { AiReferencePreview, AiResourceReadProvider } from '../domain/ai-resource-read'
import { verifyAiReferencePreview } from '../domain/ai-resource-read'
import type { WorkbenchReference, WorkbenchReferenceScope } from '../domain/art-workbench'
import { acceptSavedReferenceLibrarySelection, copySavedLibraryIdentity, copySavedLibraryReference, copySavedLibraryTarget, normalizeSavedLibraryEntries, savedLibraryEntryKey, savedLibraryTargetMatches, savedReferenceLibraryKey, type SavedReferenceLibraryEntry, type SavedReferenceLibraryIdentity, type SavedReferenceLibrarySelection } from '../adapters/saved-reference-library'

defineOptions({ name: 'SavedReferenceLibraryPicker' })
const props = withDefaults(defineProps<{
  identity: SavedReferenceLibraryIdentity | null
  entries: readonly SavedReferenceLibraryEntry[]
  target: WorkbenchReferenceScope | null
  existingReferences: readonly WorkbenchReference[]
  reader?: AiResourceReadProvider | null
  disabled?: boolean
  active?: boolean
  maxReferences?: number
}>(), { reader: null, disabled: true, active: true, maxReferences: 4 })
const emit = defineEmits<{ select: [selection: SavedReferenceLibrarySelection] }>()
const query = ref(''), selectedKey = ref(''), preview = shallowRef<AiReferencePreview | null>(null), displayed = ref(false), loading = ref(false), error = ref(''), notice = ref(''), selectionSent = ref(false)
let epoch = 0, controller: AbortController | null = null
const previewToken = ref(0)
const library = computed(() => {
  try {
    if (props.identity === null) { if (props.entries.length) throw Error(); return { value: null, invalid: false } }
    const identity = copySavedLibraryIdentity(props.identity), entries = normalizeSavedLibraryEntries(props.entries)
    return { value: { identity, entries, key: savedReferenceLibraryKey(identity, entries) }, invalid: false }
  } catch { return { value: null, invalid: true } }
})
const existing = computed(() => { try { if (!Array.isArray(props.existingReferences) || props.existingReferences.length > 4) return null; return props.existingReferences.map(copySavedLibraryReference) } catch { return null } })
const targetKey = computed(() => { try { return props.target ? JSON.stringify(copySavedLibraryTarget(props.target)) : '' } catch { return 'invalid' } })
const targetMatches = computed(() => { try { return !!library.value.value && !!props.target && savedLibraryTargetMatches(library.value.value.identity, props.target) } catch { return false } })
const full = computed(() => !existing.value || existing.value.length >= 4)
const blocked = computed(() => props.disabled || !props.active || !targetMatches.value || full.value || props.maxReferences !== 4 || !props.reader || props.reader.referencePreviewEnabled === false || !library.value.value)
const entries = computed(() => library.value.value?.entries ?? [])
const filtered = computed(() => { const search = query.value.trim().toLowerCase(); return entries.value.filter(entry => !search || [entry.reference.name, entry.reference.relativePath, ...entry.origins].some(value => value.toLowerCase().includes(search))) })
const selected = computed(() => entries.value.find(entry => savedLibraryEntryKey(entry.reference) === selectedKey.value))
const duplicate = (entry: SavedReferenceLibraryEntry) => existing.value?.some(reference => reference.sha256 === entry.reference.sha256) === true
const conflictingPath = (entry: SavedReferenceLibraryEntry) => entries.value.some(other => other.reference.relativePath === entry.reference.relativePath && other.reference.sha256 !== entry.reference.sha256)
const canSelect = computed(() => !blocked.value && !loading.value && !selectionSent.value && !!selected.value && !duplicate(selected.value) && !!preview.value && displayed.value && preview.value.sha256 === selected.value.reference.sha256)
function reset() { epoch++; controller?.abort(); controller = null; previewToken.value++; selectedKey.value = ''; preview.value = null; displayed.value = false; loading.value = false; selectionSent.value = false; error.value = ''; notice.value = '' }
watch([() => props.identity, () => props.identity?.source, () => props.identity?.projectId, () => props.identity?.projectPath, () => props.identity?.resourceDomainId, () => props.identity?.workbenchHash, () => library.value.value?.key, () => library.value.invalid, targetKey, () => props.target, () => props.reader, () => props.reader?.referencePreviewEnabled, () => props.disabled, () => props.active, () => props.maxReferences, () => JSON.stringify(existing.value)], reset, { flush: 'sync' })
onBeforeUnmount(reset)
async function readPreview(entry: SavedReferenceLibraryEntry) {
  const current = library.value.value, reader = props.reader
  if (blocked.value || loading.value || duplicate(entry) || !current || !reader) return
  reset(); const token = epoch, key = savedLibraryEntryKey(entry.reference), identity = current.identity, listKey = current.key
  selectedKey.value = key; loading.value = true; controller = new AbortController(); const signal = controller.signal
  try {
    const raw = await reader.previewReference(identity.projectId, entry.reference.relativePath, signal)
    const verified = await verifyAiReferencePreview(raw)
    if (token !== epoch || !props.active || props.disabled || library.value.value?.key !== listKey || props.identity?.source !== identity.source || selectedKey.value !== key) return
    if (verified.sha256 !== entry.reference.sha256) { error.value = '规范化预览摘要与已保存原文件摘要不同；原路径和 SHA 均保留，不能选用此项。'; return }
    preview.value = Object.freeze(verified)
  } catch { if (token === epoch) error.value = '参考图预览未完成字节校验或暂不可用；没有替换保存账本中的原路径与 SHA。' }
  finally { if (token === epoch) { loading.value = false; controller = null } }
}
function imageLoaded(event: Event) {
  const image = event.currentTarget as HTMLImageElement, value = preview.value
  if (blocked.value || !value || Number(image.dataset.previewToken) !== previewToken.value || image.getAttribute('src') !== 'data:image/png;base64,' + value.base64 || !selected.value || selected.value.reference.sha256 !== value.sha256) return
  if (image.naturalWidth !== value.width || image.naturalHeight !== value.height) { imageFailed(event); return }
  displayed.value = true
}
function imageFailed(event: Event) {
  if (Number((event.currentTarget as HTMLImageElement).dataset.previewToken) !== previewToken.value) return
  preview.value = null; displayed.value = false; error.value = '图片没有成功显示；已撤销选用条件，原保存引用未改动。'
}
function select() {
  const current = library.value.value, entry = selected.value, image = preview.value, target = props.target
  if (!canSelect.value || !current || !entry || !image || !target) return
  try {
    const selection: SavedReferenceLibrarySelection = Object.freeze({ schemaVersion: 'saved-reference-library-selection-v1', identity: current.identity, listKey: current.key, target: copySavedLibraryTarget(target), reference: copySavedLibraryReference(entry.reference), preview: Object.freeze({ sha256: image.sha256, width: image.width, height: image.height, displayed: true }) })
    acceptSavedReferenceLibrarySelection({ selection, identity: props.identity, entries: props.entries, target, existingReferences: props.existingReferences, disabled: props.disabled || !props.active, maxReferences: props.maxReferences })
    selectionSent.value = true; notice.value = '已发出选用请求；尚未确认草稿关联，未保存，也未自动成为模型输入。'; emit('select', selection)
  } catch { displayed.value = false; error.value = '保存列表、当前目标或草稿参考数已变化；请重新核对后选用。' }
}
</script>

<template>
  <section class="saved-reference-library" data-testid="saved-reference-library" aria-label="已保存参考素材">
    <header><h3>已保存参考素材</h3><p>来源为当前保存账本；原文件摘要来自保存记录，预览成功不代表原文件当前状态未变。</p></header>
    <p v-if="library.invalid" role="alert">保存账本身份或条目未核对；没有显示其他来源或示例素材。</p>
    <p v-else-if="!library.value" role="status">尚无已核对的保存账本；请由当前工作台先读取。</p>
    <template v-else>
      <p>当前来源域：{{ library.value.identity.resourceDomainId ?? '原工程范围' }} · 保存账本 SHA {{ library.value.identity.workbenchHash }}</p>
      <p v-if="!targetMatches" role="status">当前目标与素材库来源的工程、路径或资源域不一致；不能跨域关联。</p>
      <p v-else-if="disabled || !active" role="status">当前目标未开放选择；原参考和目标均未改动。</p>
      <p v-if="full" role="status">当前草稿已达四张上限或参考记录未核对；不能新增。</p>
      <p v-if="maxReferences !== 4" role="alert">参考数量合同未核对；现有上限为四张。</p>
      <p v-if="!reader || reader.referencePreviewEnabled === false" role="status">当前参考图预览未接通；不能把空预览当成可选素材。</p>
      <p>当前草稿参考：{{ existing?.length ?? '待核对' }} / 4；这里不自动保存。</p>
      <label>查找已保存引用<input v-model="query" data-testid="saved-library-query" type="search" placeholder="名称、来源或相对路径"></label>
      <p v-if="!entries.length" role="status" data-testid="saved-library-empty">当前保存账本没有参考素材。</p><p v-else-if="!filtered.length" role="status">没有匹配的已保存引用。</p>
      <ul class="saved-library-list"><li v-for="entry in filtered" :key="savedLibraryEntryKey(entry.reference)" data-testid="saved-library-entry"><strong>{{ entry.reference.name }}</strong><small>{{ entry.reference.relativePath }}</small><small>已保存原文件 SHA-256 {{ entry.reference.sha256 }}</small><span>{{ entry.origins.join('；') }}</span><span v-if="conflictingPath(entry)">同路径有不同保存摘要；分别保留，未推定哪个是当前文件。</span><span v-if="duplicate(entry)">已在当前草稿关联相同摘要。</span><button type="button" data-testid="saved-library-preview" :disabled="blocked || loading || duplicate(entry)" @click="readPreview(entry)">读取此项预览</button></li></ul>
    </template>
    <p v-if="loading" role="status">正在读取并核对规范化预览字节…</p><p v-if="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <section v-if="selected" class="saved-library-selection"><strong>本次明确选用：{{ selected.reference.name }}</strong><small>原路径 {{ selected.reference.relativePath }} · 原摘要 {{ selected.reference.sha256 }}</small><img v-if="preview" :key="previewToken" data-testid="saved-library-image" :data-preview-token="previewToken" :src="'data:image/png;base64,' + preview.base64" :alt="'已核对预览：' + selected.reference.name" @load="imageLoaded" @error="imageFailed"><p v-if="preview">{{ displayed ? '预览字节与保存摘要相符，图片已显示；选用仍只请求关联当前草稿。' : '预览字节已核对，图片尚未确认显示。' }}</p><button type="button" data-testid="saved-library-select" :disabled="!canSelect" @click="select">选用到当前草稿</button></section>
  </section>
</template>

<style scoped>
.saved-reference-library,.saved-reference-library header,.saved-library-selection{display:grid;gap:10px;min-width:0}.saved-reference-library h3,.saved-reference-library p{margin:0}.saved-reference-library label{display:grid;gap:6px}.saved-reference-library input{font:inherit;width:100%;box-sizing:border-box}.saved-library-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;padding:0;list-style:none}.saved-library-list li{display:grid;gap:8px;min-width:0;padding:12px;border:1px solid var(--el-border-color);border-radius:6px}.saved-reference-library small,.saved-reference-library p,.saved-reference-library span{overflow-wrap:anywhere}.saved-library-selection{border-top:1px solid var(--el-border-color);padding-top:12px}.saved-library-selection img{max-width:100%;max-height:320px;object-fit:contain}.saved-reference-library button{font:inherit;padding:7px 12px}.saved-reference-library button:disabled{opacity:.5}.saved-reference-library :focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
</style>
