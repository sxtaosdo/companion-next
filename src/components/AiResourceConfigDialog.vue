<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AiReferenceUploadPanel from './AiReferenceUploadPanel.vue'
import { useAiResourceEditorStore } from '../stores/ai-resource-editor'
import type { AiEditorContext } from '../stores/ai-resource-editor'
import type { AiResourceReadProvider, AiResourceView, AiResourceConfigV2 } from '../domain/ai-resource-read'
import { aiResourceConfigChanges } from '../domain/ai-resource-save'
import type { AiResourceSaveProvider } from '../domain/ai-resource-save'
const props = defineProps<{ context: AiEditorContext | null; resource: AiResourceView | null; reader: AiResourceReadProvider | null; writer: AiResourceSaveProvider | null }>()
const emit = defineEmits<{ saved: [] }>()
const editor = useAiResourceEditorStore(), discardAsk = ref(false), adoptConfirmed = ref(false)
const title = computed(() => editor.mode === 'create' ? '新建工程资源配置' : editor.mode === 'migrate' ? '迁移旧版工程资源配置' : '编辑工程资源配置')
const draft = computed(() => editor.draft)
const readbackDiff = computed(() => editor.draft && editor.observedCurrent?.config?.schemaVersion === 'project-resource-config-v2' ? aiResourceConfigChanges(editor.draft, editor.observedCurrent.config) : [])
const disabled = computed(() => editor.busy || !props.context)
const phaseLabels: Record<string,string> = { idle:'尚未保存', editing:'编辑中 · 未写入', saving:'正在保存 · 请勿重复操作', saved:'保存回执已核验', rejected:'保存被拒绝', conflict:'配置冲突 · 请回读', unknown:'保存结果未知 · 请回读', preparing:'正在冻结确认范围', 'not-sent':'未发送保存', closed:'编辑器已关闭', 'observed-matching':'回读内容一致 · 不是本次保存回执', 'conflict-current':'回读发现不同配置', reconciling:'正在回读原工程', invalidated:'上下文已变化 · 草稿保留' }
function open() { if (props.context && props.resource && props.reader) { discardAsk.value = false; adoptConfirmed.value = false; editor.open(props.context, props.resource, props.reader, props.writer) } }
function update(change: (value: AiResourceConfigV2) => void) { if (disabled.value || !editor.draft) return; const value = JSON.parse(JSON.stringify(editor.draft)) as AiResourceConfigV2; change(value); editor.updateDraft(value); adoptConfirmed.value = false }
function dimensions(key: 'width'|'height', value: number|undefined, design=false) { update(config => { const target = design ? config.designResolution : config.iconSize; target[key] = value ?? 0; if (design) config.orientation = target.width === target.height ? 'square' : target.width > target.height ? 'landscape' : 'portrait' }) }
function close(discard=false) { if (editor.close(discard)) { discardAsk.value = false; return true } discardAsk.value = true; return false }
function beforeClose(done:()=>void) { if (close()) done() }
async function save() { if (props.context && props.reader && props.writer && await editor.save(props.context, props.reader, props.writer)) emit('saved') }
function reconcile() { if (props.context && props.reader) { adoptConfirmed.value = false; void editor.reconcile(props.context, props.reader, props.writer) } }
watch([()=>props.context,()=>props.reader,()=>props.writer],()=>{editor.invalidateContext(props.context, props.reader, props.writer);adoptConfirmed.value=false},{flush:'sync'})
onBeforeUnmount(()=>editor.leave())
function showRetained() { discardAsk.value = false; adoptConfirmed.value = false; editor.showRetained() }
defineExpose({open, showRetained})
</script>
<template>
  <el-dialog :model-value="editor.isOpen" :title="title" width="min(880px, 94vw)" :close-on-click-modal="false" :close-on-press-escape="false" :before-close="beforeClose" class="ai-config-editor-dialog">
    <template v-if="draft">
      <div class="editor-identity"><strong>{{ editor.project?.name }}</strong><span>ID {{ editor.project?.id }}</span><span>{{ editor.project?.path }}</span><span>冻结原文件 SHA：{{ editor.base?.hash ?? '尚无文件（expectedHash=null）' }}</span></div>
      <el-alert :type="props.writer ? 'warning' : 'info'" :closable="false" :title="props.writer ? '此构建支持写入当前工程配置；每次保存必须独立确认' : '仅编辑预览：此构建没有注册项目配置保存接口'" :description="props.writer ? '保存按钮只保存资源规范；参考图上传在下方另行确认，两者互斥。不会准备、生成、导入图像或启动 GPU。已有配置通过原文件 hash 防止覆盖并发修改。' : '可以填写、校验并查看差异；不会发送保存或把表单当成项目文件。'"/>
      <p v-if="editor.mode==='migrate'">迁移为默认单尺寸 v2。旧多预设记录不会在表单中自动批准：请明确核对单图尺寸；未保存前原文件不变。</p><ul v-if="editor.base?.config?.schemaVersion==='project-resource-config-v1'" aria-label="迁移前原尺寸预设"><li v-for="preset in editor.base.config.iconPresets" :key="preset.id">{{ preset.label }} · {{ preset.id }} · {{ preset.displaySize.width }} × {{ preset.displaySize.height }}</li></ul>
      <el-form @submit.prevent label-position="top" :disabled="disabled" class="ai-config-fields">
        <div class="editor-row"><el-form-item label="设计画布宽"><el-input-number :model-value="draft.designResolution.width" :min="1" :max="8192" :precision="0" :disabled="Boolean(editor.base?.detected.designResolution)" aria-label="规范设计宽" @update:model-value="(value:number|undefined)=>dimensions('width',value,true)"/></el-form-item><el-form-item label="设计画布高"><el-input-number :model-value="draft.designResolution.height" :min="1" :max="8192" :precision="0" :disabled="Boolean(editor.base?.detected.designResolution)" aria-label="规范设计高" @update:model-value="(value:number|undefined)=>dimensions('height',value,true)"/></el-form-item></div>
        <p v-if="editor.base?.detected.designResolution" class="form-help">设计画布来自原工程设置，只读；若工程设置改变，先回读核对。</p>
        <div class="editor-row"><el-form-item label="默认单图成品宽"><el-input-number :model-value="draft.iconSize.width" :min="1" :max="4096" :precision="0" aria-label="规范单图宽" @update:model-value="(value:number|undefined)=>dimensions('width',value)"/></el-form-item><el-form-item label="默认单图成品高"><el-input-number :model-value="draft.iconSize.height" :min="1" :max="4096" :precision="0" aria-label="规范单图高" @update:model-value="(value:number|undefined)=>dimensions('height',value)"/></el-form-item></div>
        <p class="form-help">母图固定 1024 × 1024；本地等比缩放留边与生成分开。成品总像素不得超过 16,000,000。</p>
        <el-form-item label="统一风格"><el-input :model-value="draft.style.description" type="textarea" :rows="4" maxlength="1500" show-word-limit aria-label="规范风格描述" @update:model-value="(value:string)=>update(config=>config.style.description=value)"/></el-form-item>
        <el-form-item label="已有参考相对路径（每行一个，最多四个）"><el-input :model-value="draft.style.references.join('\n')" type="textarea" :rows="3" maxlength="963" aria-label="规范参考路径" @update:model-value="(value:string)=>update(config=>config.style.references=value ? value.split('\n') : [])"/></el-form-item>
        <p class="form-help">只接受工程内 art/reference/ 或 assets/ 下 PNG / JPEG / WebP。保存会由原服务核查文件存在性；填写路径不会自动上传或封存。</p>
        <div class="editor-row"><el-form-item label="背景"><el-checkbox :model-value="draft.background.transparent" aria-label="规范透明背景" @update:model-value="(value:string|number|boolean)=>update(config=>config.background.transparent=Boolean(value))">透明 PNG</el-checkbox></el-form-item><el-form-item label="不透明背景色 #RRGGBB"><el-input :model-value="draft.background.color" maxlength="7" aria-label="规范背景色" @update:model-value="(value:string)=>update(config=>config.background.color=value)"/></el-form-item><el-form-item label="居中留白百分比"><el-input-number :model-value="draft.composition.paddingPercent" :min="0" :max="40" aria-label="规范留白" @update:model-value="(value:number|undefined)=>update(config=>config.composition.paddingPercent=value??0)"/></el-form-item></div>
        <el-form-item label="Creator 资源目录"><el-input :model-value="draft.destination.directory" maxlength="240" aria-label="规范Creator目录" @update:model-value="(value:string)=>update(config=>config.destination.directory=value)"/></el-form-item><el-form-item label="本地尺寸导出目录"><el-input :model-value="draft.destination.exportDirectory" maxlength="240" aria-label="规范导出目录" @update:model-value="(value:string)=>update(config=>config.destination.exportDirectory=value)"/></el-form-item>
      </el-form>
      <AiReferenceUploadPanel :context="props.context" :reader="props.reader" :writer="props.writer"/>
      <div v-if="editor.errors.length" role="alert"><h3>需修正后再保存</h3><ul><li v-for="(error,index) in editor.errors" :key="index">{{ error }}</li></ul></div>
      <section class="editor-diff"><h3>与已读取原配置的差异</h3><p>版本由后端从已保存版本递增；不是由页面自行确认写入。所有输入更改都会撤销本次保存确认。</p><p v-if="!editor.diff.length">没有可提交的差异，或表单尚未通过校验。</p><dl v-for="change in editor.diff" :key="change.field"><dt>{{ change.field }}</dt><dd><span>原值</span><pre>{{ change.before }}</pre><span>拟保存</span><pre>{{ change.after }}</pre></dd></dl></section>
      <el-checkbox :model-value="editor.confirmed" :disabled="disabled || !props.writer || !!editor.errors.length" aria-label="确认本次工程配置保存" @update:model-value="(value:string|number|boolean)=>editor.setConfirmed(Boolean(value))">我已核对完整目标工程及差异，批准本次保存资源配置（不生成或导入图像）</el-checkbox>
      <div class="editor-status" role="status"><strong>{{ phaseLabels[editor.phase] ?? editor.phase }}</strong><p v-if="editor.error">{{ editor.error }}</p><p v-if="editor.storageBlocked">操作保护记录不可用，已禁止写入；表单内容仍可查看。请勿通过清记录或换页面绕过未知保存结果。</p></div>
      <section v-if="editor.observedCurrent" class="editor-readback"><h3>本次回读当前文件</h3><p>版本 {{ editor.observedCurrent.version ?? '未识别' }} · SHA {{ editor.observedCurrent.hash ?? '无文件' }}</p><p>回读内容只证明当前文件状态，不自动证明原保存成功，也不会覆盖你的编辑内容。</p><p>回读状态：{{ editor.observedCurrent.state }}。下方明确采用后仅替换表单草稿，不直接保存文件。</p><h4>回读的已保存内容</h4><pre v-if="editor.observedCurrent.config" class="editor-readback-json" aria-label="回读已保存配置">{{ JSON.stringify(editor.observedCurrent.config, null, 2) }}</pre><p v-else>没有可解析的已保存内容；原文件不会因采用草稿而被覆盖。</p><details><summary>采用后表单建议值（未保存）</summary><pre class="editor-readback-json">{{ JSON.stringify(editor.observedCurrent.draft, null, 2) }}</pre></details><section v-if="readbackDiff.length" aria-label="回读与当前草稿差异"><h4>当前草稿 → 回读配置的差异</h4><dl v-for="change in readbackDiff" :key="change.field"><dt>{{ change.field }}</dt><dd><span>当前草稿</span><pre>{{ change.before }}</pre><span>回读文件</span><pre>{{ change.after }}</pre></dd></dl></section><el-checkbox v-model="adoptConfirmed" :disabled="editor.busy" aria-label="确认采用回读配置">我已核对回读结果，允许用它替换本弹窗编辑草稿</el-checkbox><el-button :disabled="!adoptConfirmed || editor.busy" @click="editor.adoptCurrent(adoptConfirmed);adoptConfirmed=false">采用回读配置重新编辑</el-button></section>
      <el-alert v-if="discardAsk" type="warning" :closable="false" title="确认关闭并放弃本弹窗编辑？" description="已经发送的配置保存或参考上传不能因关闭而撤销。结果未确认时操作保护仍保留；上传成功不等于配置已保存。"/>
    </template>
    <template #footer><div class="editor-footer"><el-button @click="close()">取消 / 返回</el-button><el-button v-if="discardAsk" type="warning" @click="close(true)">确认关闭</el-button><el-button :disabled="editor.busy || !props.context || !props.reader" @click="reconcile">回读原工程核对</el-button><el-button type="primary" :disabled="!editor.canSave || !props.writer" :loading="editor.phase==='saving'" @click="save">确认保存到工程</el-button></div></template>
  </el-dialog>
</template>
<style scoped>
.editor-identity{display:grid;gap:6px;overflow-wrap:anywhere;margin-bottom:16px}.ai-config-fields{margin-top:20px}.editor-row{display:flex;gap:20px;flex-wrap:wrap}.editor-row>*{flex:1;min-width:150px}.editor-diff{border:1px solid #e0e6ee;border-radius:10px;padding:16px;margin:16px 0}.editor-diff dl{border-bottom:1px solid #e9edf3;padding:8px 0}.editor-diff dd{margin:8px 0}.editor-diff pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 12px;padding:8px;background:#f5f7fa}.editor-diff dd span{color:#68778d}.editor-status{margin-top:16px}.editor-readback{border:1px solid #e0e6ee;border-radius:10px;padding:16px;margin-top:16px;overflow-wrap:anywhere}.editor-readback pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fa;padding:10px}.editor-readback-json{max-height:240px;overflow:auto}.editor-footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
</style>
