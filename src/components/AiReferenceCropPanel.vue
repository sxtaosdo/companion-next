<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { IconReferenceEditor } from '../domain/icon-reference-editor'
import { useReferenceCropStore } from '../stores/ai-reference-crop'
import type { CropContext } from '../stores/ai-reference-crop'
const props=defineProps<{context:CropContext|null}>()
const store=useReferenceCropStore(),root=ref<HTMLElement|null>(null),file=ref<HTMLInputElement|null>(null),approved=ref(false),localNotice=ref('')
let editor:IconReferenceEditor|undefined,epoch=0
const blocked=computed(()=>store.blocked||!props.context)
watch(()=>props.context,next=>{epoch++;approved.value=false;localNotice.value='';editor?.reset();store.bind(next)},{immediate:true,flush:'sync'})
watch(blocked,value=>editor?.setBlocked(value),{flush:'sync'})
onMounted(()=>{if(!root.value||!file.value)return;editor=new IconReferenceEditor({root:root.value,fileInput:file.value,context:()=>String(epoch),approved:()=>approved.value,changed:()=>{approved.value=false;localNotice.value=''},notice:value=>{localNotice.value=value},save:async(input,id)=>{localNotice.value='';await store.save(input,id);approved.value=false}});editor.setBlocked(blocked.value)})
onBeforeUnmount(()=>{epoch++;editor?.reset();store.cancel()})
</script>
<template>
 <section class="reference-crop" data-testid="reference-crop-panel" aria-label="参考图裁剪保存">
  <h4>裁剪并保存参考图</h4>
  <p class="reference-note">仅保存全图、主体、原文件与裁剪回执，不会提交生成或导入。参考图尚未参与模型输入。</p>
  <p v-if="!context" role="status">请先读取当前工程的已保存参考配置，再选择图片。</p>
  <label>选择图片 <input ref="file" type="file" accept="image/png,image/jpeg,image/webp" :disabled="blocked" aria-label="选择裁剪参考图"></label>
  <p class="reference-note">PNG / JPEG / WebP，最大 4 MiB；每边不超过 4096 像素。</p>
  <section ref="root" hidden>
   <canvas data-icon-crop-canvas aria-label="全图拖框选主体"/>
   <div class="crop-coordinates"><label v-for="field in [{key:'x',label:'左上角 X',min:0},{key:'y',label:'左上角 Y',min:0},{key:'width',label:'主体宽度',min:1},{key:'height',label:'主体高度',min:1}]" :key="field.key">{{field.label}}<input :data-icon-crop-x="field.key==='x'?'':undefined" :data-icon-crop-y="field.key==='y'?'':undefined" :data-icon-crop-width="field.key==='width'?'':undefined" :data-icon-crop-height="field.key==='height'?'':undefined" type="number" :min="field.min" max="4096" step="1" :disabled="blocked"></label></div>
   <p data-icon-crop-size/>
   <canvas data-icon-crop-subject aria-label="裁剪主体预览"/>
   <label><input v-model="approved" type="checkbox" :disabled="blocked">确认将本次全图、主体和原文件保存到当前工程</label>
   <button type="button" data-icon-crop-save :disabled="blocked">保存全图与主体</button>
  </section>
  <p v-if="store.pending" role="status">正在等待裁剪回执，请勿重复保存。</p>
  <p v-if="localNotice||store.notice" role="status">{{localNotice||store.notice}}</p>
  <button v-if="store.pending" type="button" @click="store.cancel">停止等待</button>
  <ul v-if="store.matching.length" aria-label="待核对的原裁剪请求"><li v-for="pending in store.matching" :key="pending.cropId"><code>{{pending.cropId}}</code><button type="button" :disabled="store.pending" @click="store.query(pending.cropId)">查询原裁剪</button></li></ul>
  <section v-if="store.receipt" aria-label="裁剪保存回执"><p>裁剪保存回执已核验。尚未写入工程规范引用；可在已有规范编辑器中添加下列路径。</p><dl><dt>全图</dt><dd>{{store.receipt.context.relativePath}}</dd><dt>主体</dt><dd>{{store.receipt.subject.relativePath}}</dd><dt>原文件</dt><dd>{{store.receipt.original.relativePath}}</dd><dt>回执</dt><dd>{{store.receipt.receiptRelativePath}}</dd></dl></section>
 </section>
</template>
<style scoped>
.reference-crop{display:grid;gap:10px;margin-top:16px}.reference-crop p,.reference-crop h4{margin:0}.reference-crop canvas{display:block;max-width:100%;height:auto;touch-action:none;border:1px solid var(--el-border-color)}.reference-crop label{display:block}.crop-coordinates{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.crop-coordinates label{display:grid;gap:4px}.crop-coordinates input{width:90px}.reference-crop code,.reference-crop dd{overflow-wrap:anywhere}.reference-crop dd{margin:0 0 6px}.reference-note{font-size:12px;color:var(--el-text-color-secondary)}.reference-crop button{cursor:pointer;margin:6px 8px 6px 0}.reference-crop button:disabled{cursor:default}
</style>
