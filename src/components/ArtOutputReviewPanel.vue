<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { WorkbenchContext } from '../adapters/art-workbench'
import { ArtOutputReviewError, decodeArtOutputReviewSnapshot, type ArtOutputReviewProvider, type ArtOutputReviewSnapshot, type ArtOutputVersionPreview, type ArtOutputOperationIntent } from '../adapters/art-output-review'
import { ArtOutputReviewRecovery, artOutputPendingId, type ArtOutputPending, type ArtOutputPendingStorage } from '../stores/art-output-review-pending'
import { artOutputVersionId, assertArtOutputPreview, compareArtOutputVersions, getArtOutputVersion, decodeArtOutputScope, sameArtOutputScope, type ArtOutputVersion } from '../domain/art-output-history'
import { artVisualReviewState, type ArtVisualDecision } from '../domain/art-visual-review'
import type { WorkbenchNeed } from '../domain/art-workbench'
import type { AiJobSnapshot } from '../domain/ai-jobs-read'
import ArtReviewLayout from './ArtReviewLayout.vue'
import type { ArtNeedVisualObservation } from '../domain/art-need-visual-status'

const props = withDefaults(defineProps<{ context: WorkbenchContext | null; need: WorkbenchNeed | null; job: AiJobSnapshot | null; provider?: ArtOutputReviewProvider | null; active?: boolean; storage?: ArtOutputPendingStorage | null }>(), { active: true })
const emit=defineEmits<{'visual-observation':[value:ArtNeedVisualObservation]}>()
const snapshot = shallowRef<ArtOutputReviewSnapshot | null>(null), stale = ref(true), reading = ref(false), writing = ref(false), looking = ref(false), error = ref(''), notice = ref(''), storageBlocked = ref(false)
const pending = shallowRef<ArtOutputPending | null>(null), recovery = shallowRef<ArtOutputReviewRecovery | null>(null)
const selectedId = ref(''), candidateId = ref(''), leftId = ref(''), rightId = ref(''), comparing = ref(false), confirmed = ref(false), comment = ref('')
type Preview = { readonly dto: ArtOutputVersionPreview; readonly shown: boolean; readonly error: boolean }
const previews = shallowRef<Record<string, Preview>>({}), previewBusy = ref<string[]>([])
let epoch = 0, previewEpoch = 0
const controllers = new Set<AbortController>()
const scope = computed(() => props.context && props.need ? decodeArtOutputScope({ projectId: props.context.projectId, projectPath: props.context.projectPath, resourceDomainId: props.context.resourceDomainId ?? null, needId: props.need.id }) : null)
const connected = computed(() => !!props.provider && !!props.context && !!props.need && props.active)
const versions = computed(() => snapshot.value?.history?.versions ?? [])
const selected = computed(() => versions.value.find(version => version.versionId === selectedId.value))
const locked = computed(() => !connected.value || writing.value || looking.value || !!pending.value || storageBlocked.value)
const fresh = computed(() => !!snapshot.value && !stale.value && !reading.value)
const knownJob = computed(() => !!props.job && props.job.jobId === props.need?.jobId && props.job.projectId === props.context?.projectId && !props.job.historyOnly && ['reusable', 'awaiting_selection', 'selected', 'imported_pending_verification'].includes(props.job.state))
const currentJob = computed(() => knownJob.value && props.job!.jobId === snapshot.value?.snapshot.currentJobId && props.job!.sourceRevision === snapshot.value?.snapshot.currentSourceRevision)
const candidates = computed(() => knownJob.value ? props.job!.candidates.filter(candidate => candidate.assetId === props.need?.id) : [])
const candidate = computed(() => candidates.value.find(value => value.candidateId === candidateId.value))
const alreadyRegistered = computed(() => !!candidate.value && !!props.job && versions.value.some(version => version.versionId === artOutputVersionId(props.job!.jobId, candidate.value!.candidateId)))
const canRegister = computed(() => !locked.value && fresh.value && !props.context?.readOnly && snapshot.value?.capabilities.registerOutput && !!snapshot.value.history && currentJob.value && !!candidate.value && !alreadyRegistered.value)
const selectedPreview = computed(() => selectedId.value ? previews.value[selectedId.value] : undefined)
const reviewReady = computed(() => !locked.value && fresh.value && !props.context?.readOnly && snapshot.value?.capabilities.review && !!snapshot.value.history && !!snapshot.value.reviews && currentJob.value && selected.value?.jobId === props.need?.jobId && !!selectedPreview.value?.shown && !selectedPreview.value.error && selectedPreview.value.dto.sourceRevision === snapshot.value.snapshot.currentSourceRevision && selectedPreview.value.dto.jobRevision === props.job?.revision)
const comparison = computed(() => {
  const history = snapshot.value?.history, source = snapshot.value?.snapshot.currentSourceRevision
  if (!comparing.value || !history || !leftId.value || !rightId.value || leftId.value === rightId.value) return null
  if (source) return compareArtOutputVersions(history, leftId.value, rightId.value, source)
  const left = getArtOutputVersion(history, leftId.value), right = getArtOutputVersion(history, rightId.value)
  return { left, right, sameContent: left.fileSha256 === right.fileSha256, bindingChanged: JSON.stringify(left.binding) !== JSON.stringify(right.binding), leftHistorical: null, rightHistorical: null }
})
const visibleVersions = computed(() => comparison.value ? [comparison.value.left, comparison.value.right] : selected.value ? [selected.value] : [])
const pendingId = computed(() => pending.value ? artOutputPendingId(pending.value) : '')
function current(token: number) { return token === epoch && props.active }
function controller() { const value = new AbortController(); controllers.add(value); return value }
function invalidatePreviews() { previewEpoch++; previews.value = {}; previewBusy.value = []; confirmed.value = false }
function syncPending(session = recovery.value) {
  try { pending.value = session?.load() ?? null } catch { storageBlocked.value = true; error.value = '恢复记录无法可靠读取；已禁止写入，原记录未清除。' }
}
function reset() {
  epoch++; for (const value of controllers) value.abort(); controllers.clear(); invalidatePreviews()
  snapshot.value = null; stale.value = true; reading.value = false; writing.value = false; looking.value = false; error.value = ''; notice.value = ''; selectedId.value = ''; candidateId.value = ''; leftId.value = ''; rightId.value = ''; comparing.value = false; comment.value = ''; recovery.value = null; pending.value = null; storageBlocked.value = false
  if (!props.provider || !scope.value) return
  try {
    const storage = props.storage === undefined ? globalThis.sessionStorage : props.storage
    if (!storage) throw Error()
    recovery.value = new ArtOutputReviewRecovery(props.provider.endpoint, scope.value, storage); syncPending()
  } catch { storageBlocked.value = true; error.value = '本地恢复记录不可用；可以读取接口，写入已禁用。' }
}
watch([() => props.context?.projectId, () => props.context?.projectPath, () => props.context?.resourceDomainId, () => props.context?.source, () => props.context?.readOnly, () => props.need?.id, () => props.need?.jobId, () => props.provider, () => props.active, () => props.storage], reset, { immediate: true, flush: 'sync' })
watch([() => props.job?.jobId, () => props.job?.revision, () => props.job?.state, () => props.job?.sourceRevision, () => props.job?.historyOnly], () => { epoch++; for (const value of controllers) value.abort(); controllers.clear(); reading.value = false; writing.value = false; looking.value = false; invalidatePreviews(); stale.value = true; syncPending() }, { flush: 'sync' })
watch([snapshot,stale,reading,writing,looking,pending,storageBlocked],()=>{
  if(!props.active||!props.context||!props.need)return
  emit('visual-observation',{context:props.context,needId:props.need.id,jobId:props.need.jobId??null,phase:pending.value||storageBlocked.value||writing.value||looking.value?'unknown':reading.value?'reading':stale.value?(snapshot.value?'error':'unread'):'ready',snapshot:snapshot.value})
},{flush:'post'})
watch(selectedId, () => { confirmed.value = false; comment.value = '' })
watch([leftId, rightId], () => { comparing.value = false })
onBeforeUnmount(() => { epoch++; for (const value of controllers) value.abort(); controllers.clear(); invalidatePreviews() })
function applySnapshot(value: ArtOutputReviewSnapshot) {
  if (!scope.value) throw Error()
  comparing.value = false
  snapshot.value = decodeArtOutputReviewSnapshot(value, scope.value); stale.value = false; invalidatePreviews()
  const ids = new Set(snapshot.value.history?.versions.map(version => version.versionId) ?? [])
  if (!ids.has(selectedId.value)) selectedId.value = ''
  if (!ids.has(leftId.value)) leftId.value = ''
  if (!ids.has(rightId.value)) rightId.value = ''
  comparing.value = false
}
async function read() {
  const context = props.context, provider = props.provider, need = props.need, token = epoch
  if (!connected.value || !context || !provider || !need || reading.value || writing.value || looking.value) return
  const work = controller(); reading.value = true; error.value = ''; notice.value = ''
  try { const result = await provider.read(context, need.id, work.signal); if (current(token)) { applySnapshot(result); syncPending() } }
  catch { if (current(token)) { stale.value = true; invalidatePreviews(); error.value = snapshot.value ? '读取失败；保留上次记录并标记待核对，已禁止写入。' : '审阅接口未接通或读取失败；尚无已核对记录。' } }
  finally { controllers.delete(work); if (current(token)) reading.value = false }
}
function canPreview(version: ArtOutputVersion) { return connected.value && fresh.value && !writing.value && !looking.value && snapshot.value?.capabilities.immutablePreview && !previewBusy.value.includes(version.versionId) && (version.sourceRevision === snapshot.value.snapshot.currentSourceRevision || snapshot.value.capabilities.historicalPreview) }
async function preview(version: ArtOutputVersion) {
  const context = props.context, provider = props.provider, history = snapshot.value?.history, token = epoch, imageToken = previewEpoch
  if (!context || !provider || !history || !canPreview(version)) return
  const work = controller(); previewBusy.value = [...previewBusy.value, version.versionId]; confirmed.value = false; error.value = ''
  const next = { ...previews.value }; delete next[version.versionId]; previews.value = next
  try {
    const result = await provider.previewVersion(context, { needId: version.scope.needId, versionId: version.versionId, sha256: version.fileSha256, history }, work.signal)
    if (!current(token) || imageToken !== previewEpoch || !sameArtOutputScope(result.scope, version.scope) || result.versionId !== version.versionId || snapshot.value?.history?.versions.find(row => row.versionId === version.versionId)?.fileSha256 !== version.fileSha256) return
    assertArtOutputPreview(version, result.preview); previews.value = { ...previews.value, [version.versionId]: { dto: result, shown: false, error: false } }
  } catch { if (current(token) && imageToken === previewEpoch) error.value = '预览未通过读取或字节校验；未确认图片显示，也未提交审阅。' }
  finally { controllers.delete(work); if (current(token) && imageToken === previewEpoch) previewBusy.value = previewBusy.value.filter(id => id !== version.versionId) }
}
function imageLoaded(version: ArtOutputVersion, event: Event) {
  const image = event.currentTarget as HTMLImageElement, value = previews.value[version.versionId]
  if (!props.active || !value || image.dataset.receipt !== value.dto.previewReceipt.id || image.getAttribute('src') !== 'data:image/png;base64,' + value.dto.preview.base64) return
  if (image.naturalWidth !== version.width || image.naturalHeight !== version.height) { imageFailed(version, event); return }
  previews.value = { ...previews.value, [version.versionId]: { ...value, shown: true, error: false } }
}
function imageFailed(version: ArtOutputVersion, event: Event) {
  const value = previews.value[version.versionId]
  if (!value || (event.currentTarget as HTMLImageElement).dataset.receipt !== value.dto.previewReceipt.id) return
  previews.value = { ...previews.value, [version.versionId]: { ...value, shown: false, error: true } }; confirmed.value = false; error.value = '浏览器未能显示该图片；已撤销显示确认。'
}
function stateLabel(version: ArtOutputVersion) {
  if (!snapshot.value?.history || !snapshot.value.reviews) return '审阅记录未读取'
  const value = artVisualReviewState(snapshot.value.reviews, snapshot.value.history, version.versionId).state
  return { accepted: '视觉通过', rework: '退回修改', unreviewed: '尚未审阅' }[value]
}
function operationId(prefix: 'save' | 'review') { if (!globalThis.crypto?.randomUUID) throw new ArtOutputReviewError('identity-unavailable', 'not-sent'); return 'art-' + prefix + '-' + globalThis.crypto.randomUUID().replaceAll('-', '') }
async function mutate(intent: ArtOutputOperationIntent) {
  const context = props.context, provider = props.provider, session = recovery.value, token = epoch
  if (!context || !provider || !session || locked.value) return
  let original: ArtOutputPending
  try { original = session.begin(intent); pending.value = original } catch { storageBlocked.value = true; error.value = '无法先保存并回读原操作恢复记录；本次未发送。'; return }
  const id = artOutputPendingId(original), work = controller(); writing.value = true; error.value = ''; notice.value = ''; confirmed.value = false
  try {
    const result = intent.kind === 'register' ? await provider.registerOutput(context, intent.input, work.signal) : await provider.review(context, intent.input, work.signal)
    if (!current(token)) { session.retainLate(result); return }
    const nextSnapshot = result.snapshot && decodeArtOutputReviewSnapshot(result.snapshot, original.scope)
    const terminal = session.settle(result); syncPending(session)
    if (nextSnapshot) applySnapshot(nextSnapshot)
    notice.value = !terminal ? result.state === 'not-observed' ? '尚未观察到原操作；结果仍待核对，不能重提。' : '原操作结果未知；未自动重发。' : result.state === 'rejected' ? '后台明确拒绝了原操作；未记录新的通过或退回。' : intent.kind === 'register' ? '已回读原候选的不可变版本登记；没有生成图片。' : '已回读人工视觉审阅决定；导入和运行验收状态另行核对。'
  } catch (cause) {
    try { if (cause instanceof ArtOutputReviewError && cause.outcome !== 'unknown') session.knownUnsentOrRejected(id); else session.markUnknown(id) } catch { if (current(token)) storageBlocked.value = true }
    if (current(token)) { syncPending(session); stale.value = true; invalidatePreviews(); error.value = cause instanceof ArtOutputReviewError && cause.outcome === 'not-sent' ? '本次操作未发送；请核对接口和当前状态。' : cause instanceof ArtOutputReviewError && cause.outcome === 'rejected' ? '后台明确在派发前拒绝；未记作成功。' : '写入结果待核对；原范围和操作标识已保留，禁止重提。' }
  } finally { controllers.delete(work); if (current(token)) writing.value = false }
}
async function register() {
  if (!canRegister.value || !props.need || !props.job || !candidate.value || !snapshot.value?.history) return
  try { await mutate({ kind: 'register', expectedFileSha256: candidate.value.fileSha256, input: { needId: props.need.id, operationId: operationId('save'), expectedHistoryRevision: snapshot.value.history.revision, jobId: props.job.jobId, candidateId: candidate.value.candidateId, observedJobRevision: props.job.revision } }) } catch { error.value = '无法建立原操作标识；未发送。' }
}
async function decide(decision: ArtVisualDecision) {
  const value = selectedPreview.value, version = selected.value, currentSnapshot = snapshot.value
  if (!reviewReady.value || !confirmed.value || !value || !version || !currentSnapshot?.history || !currentSnapshot.reviews || !props.need) return
  try {
    const receipt = value.dto.previewReceipt
    await mutate({ kind: 'review', expectedFileSha256: version.fileSha256, input: { needId: props.need.id,
      command: { operationId: operationId('review'), versionId: version.versionId, fileSha256: version.fileSha256, expectedHistoryRevision: currentSnapshot.history.revision, expectedReviewRevision: currentSnapshot.reviews.revision, observedJobRevision: value.dto.jobRevision, decision, comment: comment.value, approved: true },
      displayAcknowledgement: { receiptId: receipt.id, versionId: receipt.versionId, fileSha256: receipt.fileSha256, jobRevision: receipt.jobRevision, sourceRevision: receipt.sourceRevision, displayed: true } } })
  } catch { error.value = '无法建立明确审阅操作；未发送。' }
}
async function lookup() {
  const context = props.context, provider = props.provider, original = pending.value, session = recovery.value, token = epoch
  if (!connected.value || !context || !provider || !original || !session || looking.value || writing.value || reading.value) return
  const work = controller(); looking.value = true; error.value = ''; notice.value = ''
  try {
    const result = await provider.lookup(context, { needId: original.scope.needId, operationId: artOutputPendingId(original) }, work.signal)
    if (!current(token)) { session.retainLate(result); return }
    const nextSnapshot = result.snapshot && decodeArtOutputReviewSnapshot(result.snapshot, original.scope)
    const terminal = session.settle(result); syncPending(session); if (nextSnapshot) applySnapshot(nextSnapshot)
    notice.value = terminal ? result.state === 'committed' ? '已核对原操作的持久化回执。' : '原操作已明确拒绝。' : '原操作仍未知或未观察到；保留恢复记录，不允许重提。'
  } catch { if (current(token)) { syncPending(session); stale.value = true; invalidatePreviews(); error.value = '原操作查询失败；没有解除 UNKNOWN，也没有重新发送。' } }
  finally { controllers.delete(work); if (current(token)) looking.value = false }
}
</script>

<template>
  <section class="output-review" data-testid="art-output-review-panel" aria-label="版本比较与人工视觉审阅">
    <header><h3>版本比较与人工视觉审阅</h3><button type="button" data-testid="review-read" :disabled="!connected || reading || writing || looking" @click="read">读取 / 刷新审阅记录</button></header>
    <p>人工视觉通过与当前任务、导入和运行验收分别记录；登记已有候选不会生成图片。</p>
    <p v-if="!provider" role="status">当前未接通审阅接口。</p><p v-else-if="!context || !need" role="status">请选择已绑定真实任务的素材需求。</p>
    <p>当前已读任务：{{ job?.jobId || '未读取' }} · {{ job?.state || '待核对' }}</p>
    <p v-if="reading || writing || looking" role="status">{{ writing ? '正在等待原操作回执…' : looking ? '正在查询原操作…' : '正在读取…' }}</p>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="storageBlocked" role="status">本地恢复记录不可用；写入已禁用，原记录未清除。</p>
    <section v-if="pending" class="pending-review" data-testid="review-pending"><strong>原操作待核对 · {{ pending.kind }}</strong><code>{{ pendingId }}</code><p>原范围：{{ pending.scope.projectId }} / {{ pending.scope.resourceDomainId ?? '原工程' }} / {{ pending.scope.needId }}</p><p v-if="recovery?.hasLateReceipt()">原范围已有晚到回执；尚未应用到当前面板，请明确核对。</p><button type="button" data-testid="review-lookup" :disabled="!connected || writing || looking || reading" @click="lookup">核对原操作（不重发）</button></section>
    <template v-if="snapshot">
      <p v-if="stale" role="status" data-testid="review-stale">上次记录 / 当前待核对；禁止写入。</p>
      <p v-if="!currentJob" role="status">当前任务观察尚未与审阅记录一致；请先核对任务，再提交决定。</p>
      <p>观察时间：{{ snapshot.observedAt }} · 历史修订 {{ snapshot.history?.revision ?? '未读取' }} · 审阅修订 {{ snapshot.reviews?.revision ?? '未读取' }}</p>
      <p v-if="snapshot.capabilities.blockedReason" role="status">当前能力未开通：{{ snapshot.capabilities.blockedReason }}</p>
      <fieldset><legend>登记已有候选版本</legend><label>当前任务候选<select v-model="candidateId" data-testid="review-candidate" :disabled="locked || !fresh"><option value="">明确选择候选</option><option v-for="item in candidates" :key="item.candidateId" :value="item.candidateId">{{ item.candidateId }}</option></select></label><button type="button" data-testid="review-register" :disabled="!canRegister" @click="register">登记已有候选版本</button><p v-if="alreadyRegistered">该候选标识已有登记；如内容变化须核对原记录，不能覆盖。</p></fieldset>
      <p v-if="!snapshot.history">尚无已核对版本历史。</p><p v-else-if="!versions.length">后台历史记录为空；尚未登记版本。</p>
      <ArtReviewLayout :title="need?.name??'视觉审阅'" :comparing="!!comparison" :can-compare="!!comparison||(fresh&&!!leftId&&!!rightId&&leftId!==rightId)" @toggle-compare="comparing=!comparing">
        <template #toolbar><label>本次审阅版本<select v-model="selectedId" data-testid="review-version" :disabled="writing || looking"><option value="">明确选择版本，不自动采用最新</option><option v-for="version in versions" :key="version.versionId" :value="version.versionId">#{{ version.ordinal }} · {{ version.versionId }}</option></select></label><fieldset><legend>明确选择两个版本比较</legend><label>左侧<select v-model="leftId" data-testid="review-left"><option value="">选择版本</option><option v-for="version in versions" :key="version.versionId" :value="version.versionId">#{{ version.ordinal }} · {{ version.versionId }}</option></select></label><label>右侧<select v-model="rightId" data-testid="review-right"><option value="">选择版本</option><option v-for="version in versions" :key="version.versionId" :value="version.versionId">#{{ version.ordinal }} · {{ version.versionId }}</option></select></label><p v-if="comparison" data-testid="review-comparison">只读比较 · {{ comparison.sameContent ? '图片内容相同' : '图片内容不同' }} · {{ comparison.bindingChanged ? '冻结输入不同' : '冻结输入相同' }} · 左侧{{ comparison.leftHistorical === null ? '来源待核对' : comparison.leftHistorical ? '历史来源' : '当前来源' }} / 右侧{{ comparison.rightHistorical === null ? '来源待核对' : comparison.rightHistorical ? '历史来源' : '当前来源' }}</p></fieldset><details><summary>已登记版本与来源</summary><ul class="version-list"><li v-for="version in versions" :key="version.versionId"><strong>登记序号 #{{ version.ordinal }}（非生成时间）</strong><span>{{ stateLabel(version) }}</span><code>{{ version.versionId }}</code><span>{{ version.origin }} · {{ version.width }} × {{ version.height }} · 规格 {{ version.binding.specId }} v{{ version.binding.specVersion }}</span><small>SHA-256 {{ version.fileSha256 }}</small><small>源提交 {{ version.sourceRevision }} · 源创建时间 {{ version.createdAt }}</small></li></ul></details></template>
        <template #images><div class="version-previews" :class="{comparing:!!comparison}"><article v-for="version in visibleVersions" :key="version.versionId"><h4>登记序号 #{{ version.ordinal }}</h4><button type="button" :data-testid="'review-preview-' + version.ordinal" :disabled="!canPreview(version)" @click="preview(version)">读取并校验此版本图片</button><p v-if="version.sourceRevision !== snapshot.snapshot.currentSourceRevision && !snapshot.capabilities.historicalPreview">历史来源图片预览尚未支持；没有占位成功图片。</p><div class="version-canvas"><template v-if="previews[version.versionId]"><img v-if="!previews[version.versionId]!.error" :key="previews[version.versionId]!.dto.previewReceipt.id" data-testid="review-preview-image" :data-receipt="previews[version.versionId]!.dto.previewReceipt.id" :src="'data:image/png;base64,' + previews[version.versionId]!.dto.preview.base64" :alt="'已校验候选版本 #' + version.ordinal" @load="imageLoaded(version, $event)" @error="imageFailed(version, $event)"></template></div><p v-if="previews[version.versionId]">{{ previews[version.versionId]!.shown ? '字节已校验，图片已显示；尚需人工确认。' : '尚未确认图片成功显示。' }}</p></article></div><p v-if="!visibleVersions.length">请选择已登记版本，再读取并校验图片；这里没有占位成功图片。</p></template>
        <template #summary><dl v-if="selected"><dt>引用规格</dt><dd>{{ selected.binding.specId }} v{{ selected.binding.specVersion }}</dd><dt>需求版本</dt><dd>v{{ selected.binding.needVersion }}</dd><dt>图片尺寸</dt><dd>{{ selected.width }} × {{ selected.height }}</dd><dt>图片一致性</dt><dd>{{ selectedPreview?.shown&&!selectedPreview.error?'字节已校验，图片已显示':'尚未确认图片显示' }}</dd><dt>风格与可读性</dt><dd>由人工结合图片明确核对</dd></dl><p>透明像素、导入和运行验收须依据各自真实检查；视觉通过不代替这些结果。</p></template>
        <template #decisions><label>审阅备注（可选）<textarea v-model="comment" data-testid="review-comment" maxlength="2048" :disabled="locked" rows="2" /></label><label><input v-model="confirmed" data-testid="review-confirm" type="checkbox" :disabled="!reviewReady">我已核对当前所选版本的图片，明确提交本次视觉决定。</label><div class="decisions"><button type="button" data-testid="review-accept" :disabled="!reviewReady || !confirmed" @click="decide('accepted')">视觉通过</button><button type="button" data-testid="review-return" :disabled="!reviewReady || !confirmed" @click="decide('rework')">退回修改</button></div></template>
      </ArtReviewLayout>
    </template>
  </section>
</template>

<style scoped>
.output-review{display:grid;gap:12px;border-top:1px solid var(--el-border-color);padding-top:16px;min-width:0}.output-review header,.decisions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.output-review h3,.output-review h4,.output-review p{margin:0}.output-review label,.output-review fieldset,.pending-review,.version-list li{display:grid;gap:8px;min-width:0}.output-review fieldset,.pending-review{border:1px solid var(--el-border-color);border-radius:6px;padding:12px}.output-review code,.output-review small,.output-review p{overflow-wrap:anywhere}.output-review select,.output-review textarea{font:inherit;max-width:100%;min-width:0;box-sizing:border-box}.version-list{display:grid;gap:12px;padding-left:20px}.version-previews{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}.version-previews article{display:grid;gap:8px;min-width:0}.version-previews img{max-width:100%;max-height:360px;object-fit:contain}.output-review button{font:inherit;padding:7px 12px}.output-review button:disabled{opacity:.5}.output-review :focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}

/* Declaration bodies below are reused from the approved prototype. */
.output-review{--primary:#7058df;--line:#e2e7f0;--muted:#718098;border-top:0;padding-top:0}.version-previews{grid-template-columns:1fr}.version-previews.comparing{grid-template-columns:1fr 1fr;gap:12px}
.version-canvas{min-height:370px;border:1px solid #e4e7ef;border-radius:8px;background:repeating-conic-gradient(#eceef4 0% 25%,#fff 0% 50%) 0/24px 24px;display:grid;place-items:center}
.version-canvas img{width:60%;max-height:300px}
.version-previews.comparing .version-canvas{min-height:300px}
@media (max-width:700px) {.version-canvas{min-height:260px}
}
@media (max-width:700px) {.version-previews.comparing .version-canvas{min-height:190px}
}
.version-canvas img{display:block;object-fit:contain;margin:auto}.output-review textarea{padding:9px 10px;border:1px solid #dce2ee;border-radius:6px;resize:vertical;min-height:78px}
</style>
