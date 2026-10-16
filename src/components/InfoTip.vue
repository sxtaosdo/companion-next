<script setup lang="ts">
import { ref,useId } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
defineProps<{label:string;text:string}>()
const visible=ref(false),focused=ref(false),id=`info-${useId()}`
function escape(event:KeyboardEvent){if(visible.value){visible.value=false;event.stopPropagation();event.preventDefault()}}
</script>
<template><el-tooltip :visible="visible" placement="top" :show-after="0" :hide-after="0" popper-class="compact-info-tooltip"><template #content><span :id="id">{{ text }}</span></template><button type="button" class="inline-info-tip" :aria-label="label" :aria-describedby="visible?id:undefined" @focus="focused=true;visible=true" @blur="focused=false;visible=false" @mouseenter="visible=true" @mouseleave="!focused&&(visible=false)" @click="visible=true" @keydown.esc="escape"><el-icon aria-hidden="true"><QuestionFilled/></el-icon></button></el-tooltip></template>
<style scoped>.inline-info-tip{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--el-text-color-secondary);padding:4px;cursor:help;vertical-align:middle;border-radius:5px;flex-shrink:0}.inline-info-tip:hover{color:var(--el-color-primary)}.inline-info-tip:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}</style>
<style>.compact-info-tooltip{max-width:min(360px,calc(100vw - 32px));line-height:1.6;overflow-wrap:anywhere}</style>
