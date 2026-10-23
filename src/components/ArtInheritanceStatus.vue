<script setup lang="ts">
import {computed} from 'vue'
import {CircleCheck,QuestionFilled,CircleClose,Loading,Minus} from '@element-plus/icons-vue'
import type {ArtAuthority,ProjectArtSpec} from '../domain/project-art-spec'
import type {ArtInheritanceResolution} from '../project-art-spec-integration'
const props=defineProps<{phase:string;resolution:ArtInheritanceResolution|null;inheritance:ProjectArtSpec['inheritance'];authorities:readonly ArtAuthority[];saved?:boolean}>()
const state=computed(()=>{
 if(props.phase==='reading')return {label:'读取中',tone:'primary' as const,icon:Loading,busy:true,detail:'正在核对当前工程的全局来源。'}
 if(props.phase==='error')return {label:'读取失败',tone:'danger' as const,icon:CircleClose,detail:'未能核实全局来源，请重新读取。'}
 if(props.phase==='unknown')return {label:'待核对',tone:'warning' as const,icon:QuestionFilled,detail:'原保存结果尚未核对，不据旧信息判断继承状态。'}
 const info=props.resolution
 if(!info)return {label:'尚未核对',tone:'warning' as const,icon:QuestionFilled,detail:'当前接口尚未提供已核实的关联状态。'}
 if(info.state==='not-applicable')return {label:'明确不适用',tone:'info' as const,icon:Minus,detail:'已核实的来源记录明确排除此工程；不由空列表推断。'}
 if(info.state==='unlinked')return {label:'尚未关联',tone:'info' as const,icon:Minus,detail:'当前工程尚未建立 P0001 来源关联，不表示 P0001 不适用。'}
 const inheritance=props.inheritance
 const matched=inheritance.mode==='canon'&&inheritance.sources.length>0&&inheritance.sources.every(pin=>info.sources.some(s=>s.path===pin.path&&s.revision===pin.revision)&&props.authorities.some(a=>a.source.path===pin.path&&a.source.revision===pin.revision&&a.status==='Accepted'))
 if(matched)return {label:props.saved?'已继承':'待保存继承',tone:props.saved?'success' as const:'primary' as const,icon:props.saved?CircleCheck:QuestionFilled,detail:'使用下列固定版本的来源，项目不能覆盖锁定要求。'}
 if(inheritance.mode==='canon')return {label:'来源待核对',tone:'warning' as const,icon:QuestionFilled,detail:'保存的来源与当前核实结果不一致，不能按已继承处理。'}
 return {label:'有可选来源',tone:'info' as const,icon:Minus,detail:'已核实下列来源可关联；尚未选择继承，不自动套用。'}
})
</script>
<template><section class="art-inheritance-status" aria-label="全局规范关联状态"><div><el-tag class="companion-status-tag" :type="state.tone" role="status"><el-icon class="companion-status-icon" :class="{'is-loading':state.busy}" aria-hidden="true"><component :is="state.icon"/></el-icon>{{state.label}}</el-tag><span>{{state.detail}}</span></div><ul v-if="resolution?.sources.length"><li v-for="source in resolution.sources" :key="source.path+'@'+source.revision"><span>{{source.path}}</span> · <code :title="source.revision">{{source.revision.slice(0,12)}}</code></li></ul></section></template>
<style scoped>.art-inheritance-status{font-size:12px;color:var(--el-text-color-secondary);line-height:1.6}.art-inheritance-status>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.art-inheritance-status ul{padding-left:18px;margin:6px 0 0;overflow-wrap:anywhere}</style>
