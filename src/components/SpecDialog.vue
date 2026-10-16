<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Warning } from '@element-plus/icons-vue'
import { useWorkspaceStore } from '../stores/workspace'
import { createDefaultSpec, validateSpec } from '../domain/spec'
import { DraftConflictError } from '../domain/drafts'
const visible = defineModel<boolean>({ required: true })
const store = useWorkspaceStore()
const activeTab = ref('canvas')
const form = reactive(createDefaultSpec())
const errors = ref<string[]>([])
const saving = ref(false)
const conflict = ref(false)
const expectedRevision = ref<string | null>(null)
const hasCrossTabLock = typeof navigator !== 'undefined' && Boolean(navigator.locks?.request)
const isNew = computed(() => !store.spec)
watch(visible, (open) => {
  if (open) { Object.assign(form, store.spec ? { ...store.spec } : createDefaultSpec()); errors.value = []; conflict.value = false; expectedRevision.value = store.localDraft?.revision ?? null; activeTab.value = 'canvas' }
})
async function save() {
  errors.value = validateSpec(form)
  if (errors.value.length) return
  saving.value = true
  try { await store.saveLocalSpec({ ...form }, expectedRevision.value); visible.value = false; ElMessage.success('已保存到此浏览器本地草稿，未写入真实项目') }
  catch (error) { conflict.value = error instanceof DraftConflictError; errors.value = [error instanceof Error ? error.message : '本地存储不可用，草稿未保存'] }
  finally { saving.value = false }
}
function reloadLatest() {
  store.reloadLocalDraft()
  Object.assign(form, store.spec ? { ...store.spec } : createDefaultSpec())
  expectedRevision.value = store.localDraft?.revision ?? null
  errors.value = []
  conflict.value = false
}
</script>
<template>
  <el-dialog v-model="visible" :title="isNew ? '新建项目规范草稿' : '编辑项目规范草稿'" width="920px" align-center destroy-on-close class="spec-dialog" :close-on-click-modal="false">
    <template #header><div class="dialog-heading"><span class="eyebrow">PROJECT ART & UI SPEC</span><h2>{{ isNew ? '新建项目规范草稿' : '编辑项目规范草稿' }}</h2><p>{{ store.project?.name }} · 四个页签共享一次保存</p></div></template>
    <div class="local-notice"><el-icon><Document/></el-icon><span>仅保存到此浏览器，不写入项目 JSON、Git 或任何真实服务。清除浏览器数据会丢失草稿。</span></div>
    <p v-if="!hasCrossTabLock" class="form-help concurrency-note">此浏览器不支持跨页写锁。为保护其他页面的草稿，持久保存已禁用，表单内容仍保留供复制。请使用支持 Web Locks 的浏览器。</p>
    <el-tabs v-model="activeTab" class="spec-tabs" stretch>
      <el-tab-pane label="基础画布" name="canvas"><el-form label-position="top" class="spec-form"><div class="canvas-layout"><div><h3>设计画布</h3><div class="form-grid"><el-form-item label="宽度 / px"><el-input-number v-model="form.width" :min="64" :max="8192" controls-position="right" aria-label="画布宽度"/></el-form-item><el-form-item label="高度 / px"><el-input-number v-model="form.height" :min="64" :max="8192" controls-position="right" aria-label="画布高度"/></el-form-item></div><h3>安全区与间距</h3><div class="form-grid"><el-form-item label="水平安全边距 / px"><el-input-number v-model="form.safeHorizontal" :min="0" :max="2048" controls-position="right"/></el-form-item><el-form-item label="垂直安全边距 / px"><el-input-number v-model="form.safeVertical" :min="0" :max="2048" controls-position="right"/></el-form-item></div><el-form-item label="基础间距"><el-input v-model="form.spacing" maxlength="100"/></el-form-item><p class="form-help">适配效果以 Cocos 实际运行检查为准。</p></div><div class="canvas-preview"><span>{{ form.width || '—' }} px</span><div class="device-outline"><div class="safe-outline"><span>安全区</span><i class="preview-heading"></i><i class="preview-block"></i><i class="preview-button"></i></div></div><small>{{ form.height || '—' }} px · 比例示意</small></div></div><div class="form-separator"></div><h3>资源交付默认值</h3><div class="form-grid"><el-form-item label="默认 pivot"><el-input v-model="form.pivot" maxlength="100"/></el-form-item><el-form-item label="图集 / bundle"><el-input v-model="form.bundle" maxlength="160"/></el-form-item><el-form-item label="可拉伸面板"><el-input v-model="form.panelPolicy" maxlength="160"/></el-form-item><el-form-item label="尺寸策略"><el-input model-value="每资源一个默认尺寸" readonly/></el-form-item></div></el-form></el-tab-pane>
      <el-tab-pane label="风格样板" name="style"><el-form label-position="top" class="spec-form"><h3>让每份素材说同一种语言</h3><div class="form-grid"><el-form-item label="风格样板名称 *"><el-input v-model="form.styleName" placeholder="例如：暗黑母版" maxlength="100"/></el-form-item><el-form-item label="草稿版本 *"><el-input v-model="form.version" maxlength="60"/></el-form-item></div><el-form-item label="风格关键词"><el-input v-model="form.styleKeywords" type="textarea" :rows="3" placeholder="材质、光线、形状和需要避免的方向" maxlength="500" show-word-limit/></el-form-item><div class="guidance-card"><el-icon><Warning/></el-icon><div><strong>样板批准需要独立证据</strong><p>本地编辑不会更改样板批准状态。正式生产前，需人工批准样板并确认来源及许可证据。</p></div></div><div class="sample-palette"><span style="background:#252b3c"></span><span style="background:#4c5670"></span><span style="background:#91a4c7"></span><span style="background:#c6ab6b"></span><small>界面示例色板 · 非已批准设计 token</small></div></el-form></el-tab-pane>
      <el-tab-pane label="文字与按钮" name="type"><el-form label-position="top" class="spec-form"><h3>文字层级与可交互状态</h3><el-form-item label="字体 / 授权说明"><el-input v-model="form.fontFamily" maxlength="160"/></el-form-item><div class="form-grid"><el-form-item label="正文 / px"><el-input-number v-model="form.bodySize" :min="8" :max="256" controls-position="right"/></el-form-item><el-form-item label="标题 / px"><el-input-number v-model="form.headingSize" :min="8" :max="512" controls-position="right"/></el-form-item><el-form-item label="按钮高度 / px"><el-input-number v-model="form.buttonHeight" :min="16" :max="1024" controls-position="right"/></el-form-item><el-form-item label="按钮状态"><el-input v-model="form.buttonStates" maxlength="200"/></el-form-item></div><div class="guidance-card"><el-icon><Warning/></el-icon><div><strong>文字与状态由引擎组件承载</strong><p>不把动态数字或按钮文字烘焙进 AI 图片。默认、按下、禁用等状态需要逐一验证。</p></div></div></el-form></el-tab-pane>
      <el-tab-pane label="弹窗层级" name="layers"><el-form label-position="top" class="spec-form"><h3>明确遮挡与返回关系</h3><el-form-item label="层级与互斥策略"><el-input v-model="form.overlayPolicy" type="textarea" :rows="4" maxlength="500" show-word-limit/></el-form-item><div class="layer-diagram"><div>04 <strong>提示 / Toast</strong><span>短暂反馈</span></div><div>03 <strong>弹窗 / Modal</strong><span>遮罩 · 焦点</span></div><div>02 <strong>面板 / Panel</strong><span>同层互斥</span></div><div>01 <strong>基础页面</strong><span>导航与返回</span></div></div><p class="form-help">以上为建议层级示意，正式关系需在目标工程验证。</p></el-form></el-tab-pane>
    </el-tabs>
    <el-alert v-if="errors.length" type="error" :closable="false" title="草稿尚未保存" :description="errors.join('；')" show-icon/>
    <el-button v-if="conflict" class="conflict-reload" @click="reloadLatest">放弃本次编辑并重新载入</el-button>
    <template #footer><div class="dialog-footer"><div><strong>浏览器本地草稿</strong><span>不会改变真实项目规范或批准记录</span></div><div><el-button @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!hasCrossTabLock" @click="save">保存本地草稿</el-button></div></div></template>
  </el-dialog>
</template>
