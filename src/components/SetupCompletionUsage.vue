<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { SetupCompletionUsage } from '../domain/project-setup'
const props=defineProps<{usage:SetupCompletionUsage}>()
const wrap=ref(true),copying=ref(false),notice=ref('')
let alive=true,generation=0
watch(()=>props.usage,()=>{generation++;notice.value='';wrap.value=true},{flush:'sync'})
onBeforeUnmount(()=>{alive=false;generation++})
async function copyPrompt(){
 if(copying.value)return
 const value=props.usage,epoch=generation
 copying.value=true;notice.value=''
 try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(value.prompt);if(alive&&generation===epoch&&props.usage===value)notice.value='已复制提示词；未执行连接检查或修改配置。'}
 catch{if(alive&&generation===epoch&&props.usage===value)notice.value='复制未完成，可手动选择使用示例；未执行命令。'}
 finally{copying.value=false}
}
</script>
<template>
 <section class="setup-completion-usage" data-testid="setup-completion-usage">
  <h4>使用示例</h4><p>{{ usage.project.name }} · {{ usage.project.id }}</p>
  <div class="usage-toolbar"><span>提示词</span><el-button size="small" :aria-pressed="wrap" @click="wrap=!wrap">{{ wrap?'自动换行':'不换行' }}</el-button><el-button size="small" :disabled="copying" @click="copyPrompt">{{ copying?'等待剪贴板':'复制提示词' }}</el-button></div>
  <textarea readonly :value="usage.prompt" :wrap="wrap?'soft':'off'" rows="4" aria-label="接入完成使用示例"></textarea>
  <p v-if="notice" role="status">{{ notice }}</p>
 </section>
</template>
<style scoped>
.setup-completion-usage{display:grid;gap:8px}.setup-completion-usage h4,.setup-completion-usage p{margin:0}.usage-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.usage-toolbar span{margin-right:auto}.usage-toolbar .el-button{margin-left:0}.setup-completion-usage textarea{box-sizing:border-box;width:100%;resize:vertical;line-height:1.6;padding:10px;border:1px solid var(--el-border-color);border-radius:6px;background:var(--el-fill-color-blank);color:var(--el-text-color-primary);font:inherit}
</style>
