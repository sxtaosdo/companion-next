<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AiEditorContext } from '../stores/ai-resource-editor'
import { useAiResourceEditorStore } from '../stores/ai-resource-editor'
import { useAiReferenceUploadStore } from '../stores/ai-reference-upload'
import type { AiResourceReadProvider } from '../domain/ai-resource-read'
import type { AiResourceSaveProvider } from '../domain/ai-resource-save'
import { aiReferenceUploadProvider } from '../ai-reference-upload-integration'
const props = defineProps<{ context: AiEditorContext | null; reader: AiResourceReadProvider | null; writer: AiResourceSaveProvider | null }>()
const editor = useAiResourceEditorStore(), upload = useAiReferenceUploadStore()
const canvas = ref<HTMLCanvasElement | null>(null), previewReady = ref(false), previewError = ref(''), fileName = ref(''), attachConfirmed = ref(false)
let previewEpoch = 0
const pickerDisabled = computed(() => upload.busy || editor.busy || !editor.isOpen || !editor.contextValid)
function clearPreview() {
  previewEpoch++; previewReady.value = false; previewError.value = ''; fileName.value = ''; attachConfirmed.value = false
  if (canvas.value) { canvas.value.width = 1; canvas.value.height = 1 }
}
watch([() => editor.isOpen, () => props.context, () => props.reader, () => props.writer, aiReferenceUploadProvider], () => {
  clearPreview()
  if (editor.isOpen && props.context && props.reader) upload.bind(props.context, props.reader, props.writer, aiReferenceUploadProvider.value)
  else upload.leave()
}, { immediate: true, flush: 'sync' })
async function choose(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  input.value = ''; if (pickerDisabled.value) return
  clearPreview(); upload.clearSelection()
  if (!file) return
  const identity = previewEpoch
  let bitmap: ImageBitmap | null = null
  try {
    if (typeof globalThis.createImageBitmap !== 'function') throw new Error('decode-unavailable')
    const prepared = await upload.selectFile(file, { decode: async blob => {
      const decoded = await createImageBitmap(blob)
      if (identity !== previewEpoch || !editor.isOpen) { decoded.close(); throw new Error('stale-preview') }
      bitmap = decoded
      return { width: decoded.width, height: decoded.height }
    } })
    if (!prepared || identity !== previewEpoch || !bitmap || !upload.selected) return
    await nextTick()
    if (identity !== previewEpoch || !canvas.value) return
    const decoded = bitmap as ImageBitmap, scale = Math.min(1, 512 / decoded.width, 384 / decoded.height)
    canvas.value.width = Math.max(1, Math.round(decoded.width * scale)); canvas.value.height = Math.max(1, Math.round(decoded.height * scale))
    const context = canvas.value.getContext('2d')
    if (!context) throw new Error('canvas-unavailable')
    context.drawImage(decoded, 0, 0, canvas.value.width, canvas.value.height)
    previewReady.value = true; fileName.value = file.name.slice(0, 512)
  } catch {
    if (identity === previewEpoch) { upload.clearSelection(); previewError.value = '当前文件无法完成本地位图解码或 Canvas 预览，已禁止上传。请检查图片或使用支持这些能力的浏览器。' }
  } finally { if (bitmap) (bitmap as ImageBitmap).close() }
}
function clear() { if (upload.busy) return; clearPreview(); upload.clearSelection() }
function confirm(value: string | number | boolean) { upload.setConfirmed(value === true && previewReady.value) }
async function send() {
  if (!previewReady.value || !props.context || !props.reader || !props.writer || !aiReferenceUploadProvider.value) return
  attachConfirmed.value = false
  await upload.upload(props.context, props.reader, props.writer, aiReferenceUploadProvider.value)
}
onBeforeUnmount(() => { clearPreview(); upload.leave() })
</script>
<template>
  <section class="reference-upload-panel" aria-label="原工程参考图上传">
    <h3>选择并上传参考图</h3>
    <p>PNG / JPEG / WebP 静态图片，最多 4 MiB、每边 4096、总像素 16,000,000。此处只预览，不裁剪或生成图片。</p>
    <el-alert type="warning" :closable="false" title="上传会保存原文件和另一份去元数据 PNG" description="原文件可能保留 EXIF、拍摄位置、ICC 或文字等信息。原后台另存经过方向纠正和去元数据的 PNG，但不会清除保留原图中的信息。请先核对素材内容及使用权限。"/>
    <p v-if="!aiReferenceUploadProvider || !props.writer" class="form-help">当前构建仅本地选择 / 预览，没有注册参考上传接口；不会上传或写入工程。</p>
    <label class="reference-file-picker">选择本地参考图<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择本地参考图" :disabled="pickerDisabled" @change="choose"/></label>
    <el-button :disabled="upload.busy || (!upload.selected && !previewError)" @click="clear">清除本地选择</el-button>
    <canvas v-if="upload.selected" ref="canvas" :aria-hidden="!previewReady" class="reference-local-canvas" aria-label="本地参考图缩略预览" role="img"/>
    <p v-if="previewReady && upload.selected">{{ fileName }} · {{ upload.selected.width }} × {{ upload.selected.height }} · {{ upload.selected.byteLength }} 字节<br/>原文件 SHA-256：{{ upload.selected.sha256 }}</p>
    <p v-if="previewReady" class="form-help">已在浏览器本地解码并画到 Canvas，没有从外部图源加载。缩略预览不代表风格、透明像素或视觉验收通过；原后台仍需复验。</p>
    <el-alert v-if="previewError" type="error" :closable="false" :title="previewError"/>
    <el-checkbox :model-value="upload.confirmed" :disabled="!previewReady || upload.busy || !aiReferenceUploadProvider || !props.writer" aria-label="确认本次参考图上传" @update:model-value="confirm">我已核对当前完整工程和这张图片，批准本次保存原图及去元数据 PNG（不保存配置、不生成图像）</el-checkbox>
    <div class="reference-upload-actions"><el-button type="primary" :disabled="!previewReady || !upload.canUpload" :loading="upload.busy" @click="send">确认上传本张参考图</el-button></div>
    <p role="status">{{ upload.error }}</p><p v-if="upload.recoveryMessage && upload.recoveryMessage !== upload.error">{{ upload.recoveryMessage }}</p>
    <p v-if="upload.storageBlocked" class="form-help">会话操作保护不可用，上传已关闭。不要清除记录、换页面或重发来绕过未知结果。</p>
    <section v-if="upload.receipt" class="reference-receipt" aria-label="参考上传回执">
      <h4>服务回执 · 不等于配置已保存</h4>
      <p>{{ upload.receiptProject?.name }} · {{ upload.receiptProject?.id }}<br/>{{ upload.receiptProject?.path }}</p>
      <dl><dt>归一化 PNG</dt><dd>{{ upload.receipt.relativePath }}</dd><dt>PNG SHA-256</dt><dd>{{ upload.receipt.sha256 }}</dd><dt>原文件</dt><dd>{{ upload.receipt.originalRelativePath }}</dd><dt>原文件 SHA-256</dt><dd>{{ upload.receipt.originalSha256 }}</dd></dl>
      <p v-if="upload.receiptAttached">参考路径已加入本弹窗草稿；项目配置尚未因此保存。</p>
      <p>只有同一工程、仍有效的编辑草稿才能接收此引用。即使引用已进入草稿，也须另行核对差异并确认保存配置；没有准备或提交生成任务。</p>
      <template v-if="upload.canAttachReceipt"><el-checkbox v-model="attachConfirmed" aria-label="确认将回执引用加入草稿">将本回执的参考路径加入当前同工程编辑草稿</el-checkbox><el-button :disabled="!attachConfirmed || upload.busy" @click="upload.appendRetainedReceipt(attachConfirmed);attachConfirmed=false">只加入配置草稿</el-button></template>
    </section>
  </section>
</template>
<style scoped>
.reference-upload-panel{border:1px solid #dce4ee;border-radius:10px;padding:16px;margin:18px 0}.reference-upload-panel p{line-height:1.65;overflow-wrap:anywhere}.reference-file-picker{display:grid;gap:8px;margin:16px 0}.reference-file-picker input{max-width:100%}.reference-local-canvas{display:block;max-width:100%;height:auto;border:1px solid #dce4ee;margin:16px 0;background:#eff2f7}.reference-upload-actions{margin-top:12px}.reference-receipt{padding:12px;background:#f4f7fb;margin-top:16px}.reference-receipt dl{display:grid;grid-template-columns:140px minmax(0,1fr);gap:8px}.reference-receipt dd{margin:0;overflow-wrap:anywhere}@media(max-width:600px){.reference-receipt dl{grid-template-columns:1fr}.reference-receipt dd{margin-bottom:8px}}
</style>
