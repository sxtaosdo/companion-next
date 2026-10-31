<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { CircleCheck, CircleClose, Loading, Minus, Warning } from '@element-plus/icons-vue'
import { createIconSceneBindingState } from '../stores/icon-scene-binding'
import { ICON_SCENE_TEST_URL,ICON_SCENE_TEST_NODE_NAME,sceneBindingSourceFromPacket, type IconSceneBindingProvider } from '../domain/icon-scene-binding'
import type { IconHandoff } from '../domain/icon-handoff'
import type { AiJobSnapshot } from '../domain/ai-jobs-read'
const props=withDefaults(defineProps<{project:{id:string;path:string}|null;packet:IconHandoff|null;job:AiJobSnapshot|null;provider:IconSceneBindingProvider|null;active?:boolean;ready?:boolean}>(),{active:true,ready:false})
const source=computed(()=>sceneBindingSourceFromPacket(props.packet,props.job)),store=reactive(createIconSceneBindingState())
watch(()=>[props.project,source.value,props.provider,props.active,props.ready],()=>store.bind(props.project&&source.value&&props.provider?{projectId:props.project.id,projectPath:props.project.path,source:source.value,provider:props.provider,active:props.active,ready:props.ready}:null),{immediate:true,deep:true,flush:'sync'})
const feedback=computed(()=>store.phase==='reading'?{label:'核对中',tone:'primary' as const,icon:Loading}:store.phase==='bound'?{label:'绑定已回读',tone:'success' as const,icon:CircleCheck}:store.phase==='unknown'?{label:'结果待核对',tone:'warning' as const,icon:Warning}:store.phase==='error'?{label:'读取失败',tone:'danger' as const,icon:CircleClose}:{label:store.phase==='ready'?'已读取，待选择':'尚未读取',tone:'info' as const,icon:Minus})
onBeforeUnmount(store.leave)
</script>
<template>
 <section class="scene-binding" aria-label="真实场景 SpriteFrame 绑定">
  <h4>绑定已导入图片到场景</h4>
  <p v-if="!source" class="form-help">本阶段仅授权测试工程中已有真实导入回执的 PNG。请先在原任务完成导入并重新准备交接包；不自动导入或创建 Sprite。</p>
  <template v-else>
   <p>{{ source.assetUrl }} · SHA256 {{ source.assetSha256 }} · {{ source.jobId }} r{{ source.revision }}</p>
   <el-button :disabled="store.blocked" @click="store.list">读取真实场景</el-button>
   <label>场景<select v-model="store.sceneUrl" aria-label="绑定场景" :disabled="store.blocked" @change="store.chooseScene"><option value="">请选择场景</option><option v-for="scene in store.scenes" :key="scene.url" :value="scene.url">{{ scene.name }} · {{ scene.url }}</option></select></label>
   <el-button :disabled="store.blocked || !store.sceneUrl" @click="store.open">打开所选场景并读取节点</el-button>
   <details v-if="provider?.create"><summary>明确创建新的空场景</summary><label>新场景 URL<input v-model="store.createUrl" aria-label="新空场景URL" placeholder="db://assets/scenes/e2e-binding.scene" :disabled="store.blocked" maxlength="260"></label><label><input v-model="store.createConfirmed" aria-label="确认创建空场景" type="checkbox" :disabled="store.blocked">确认在该路径创建并打开空场景，不覆盖已有场景</label><el-button :disabled="store.blocked || !store.createConfirmed || !store.createUrl" @click="store.create">创建并打开空场景</el-button><p class="form-help">空场景没有 Sprite；本阶段不会自动增加节点或组件。</p></details>
   <template v-if="store.tree"><p>场景 {{ store.tree.sceneUrl }} · revision {{ store.tree.revision }}</p><label>已有节点<select v-model="store.nodeKey" aria-label="绑定节点" :disabled="store.blocked" @change="store.edit"><option value="">请选择已有 Sprite 节点</option><option v-for="node in store.tree.nodes" :key="node.key" :value="node.key" :disabled="!node.hasSprite">{{ node.path }} · {{ node.key }}{{ node.hasSprite?'':'（缺少 cc.Sprite）' }}</option></select></label><p v-if="!store.tree.nodes.some(n=>n.hasSprite)" class="form-help">当前场景没有 cc.Sprite，请通过已有 Creator UI 准备节点后重新读取。</p></template>
   <section v-if="store.testSpriteAvailable" class="test-sprite-preparation" aria-label="测试节点准备">
    <h5>测试节点准备</h5><p>{{ ICON_SCENE_TEST_URL }} · {{ ICON_SCENE_TEST_NODE_NAME }} · 100 × 100</p>
    <p>仅在上述测试空场景创建一个未绑定图片的 Sprite。既有工具会创建 Canvas 和 UI Camera 并一并保存；原 Main Camera 保留。设计分辨率缺失或场景含其他内容时由后台拒绝。</p>
    <p v-if="!store.testSpriteSceneReady" role="status">请先从上方明确创建或打开固定测试场景并读取节点；已有 Sprite 或其他内容时不重复创建。</p>
    <label><input v-model="store.testSpriteConfirmed" aria-label="确认创建测试Sprite" type="checkbox" :disabled="store.blocked || !store.testSpriteSceneReady">确认仅创建上述测试节点及所需 Canvas、UI Camera 并保存，此步骤不绑定图片</label>
    <el-button :disabled="!store.canCreateTestSprite" @click="store.createTestSprite">创建测试 Sprite</el-button>
    <p v-if="store.testSpriteResult">原操作 {{ store.testSpriteResult.operationId }} · {{ store.testSpriteResult.operationStatus }} · {{ store.testSpriteResult.state }}<span v-if="store.testSpriteResult.nodeKey"> · 节点 {{ store.testSpriteResult.nodeKey }}</span></p>
   </section>
   <el-button :disabled="store.blocked" @click="store.resolve">解析真实 SpriteFrame</el-button>
   <template v-if="store.resolution"><p>PNG UUID：{{ store.resolution.pngUuid }}</p><label>SpriteFrame<select v-model="store.frameUuid" aria-label="绑定SpriteFrame" :disabled="store.blocked" @change="store.edit"><option value="">请选择 SpriteFrame 子资源</option><option v-for="frame in store.resolution.spriteFrames" :key="frame.uuid" :value="frame.uuid">{{ frame.url }} · {{ frame.uuid }}</option></select></label></template>
   <p v-if="store.selectedNode && store.selectedFrame">将 {{ store.selectedFrame.url }}（{{ store.selectedFrame.uuid }}）绑定到 {{ store.sceneUrl }} / {{ store.selectedNode.path }}（{{ store.nodeKey }}）的 cc.Sprite.spriteFrame。预期 revision：{{ store.tree?.revision }}</p>
   <label><input v-model="store.confirmed" aria-label="确认SpriteFrame绑定" type="checkbox" :disabled="store.blocked">确认上述来源、场景、节点与 SpriteFrame，执行一次绑定并保存</label>
   <el-button :disabled="!store.canBind" @click="store.submit">确认绑定并回读</el-button>
   <el-tag class="companion-status-tag" :type="feedback.tone" role="status"><el-icon class="companion-status-icon" :class="{'is-loading':store.busy}"><component :is="feedback.icon"/></el-icon>{{ feedback.label }}</el-tag><p role="status">{{ store.message }}</p>
   <p v-if="store.pending">保留原操作：{{ store.pending.operationId }} · {{ store.pending.action }} · {{ store.pending.sceneUrl }}{{ store.pending.nodeKey?' / '+store.pending.nodeKey:'' }}</p><el-button v-if="store.pending" :disabled="!store.canRecover" @click="store.recover">{{ store.pending.action==='create-test-sprite'?'核对原节点创建操作（不重放）':'只读核对原目标（不重放）' }}</el-button>
   <details v-if="store.result?.receipt"><summary>真实绑定回读回执</summary><pre>{{ JSON.stringify(store.result.receipt,null,2) }}</pre></details>
   <p class="form-help">真实上传或引用记录不代表已入模。绑定回读不等于画面可见或产品验收；请继续使用已有预览入口核对。</p>
  </template>
 </section>
</template>
<style scoped>
.scene-binding{display:grid;gap:12px;border-top:1px solid var(--el-border-color);padding-top:16px}.scene-binding h4,.scene-binding p{margin:0;overflow-wrap:anywhere}.scene-binding label{display:grid;gap:6px;font-size:13px}.scene-binding input:not([type=checkbox]),.scene-binding select{width:100%;padding:8px;box-sizing:border-box;background:var(--el-bg-color);color:inherit;border:1px solid var(--el-border-color);border-radius:4px;font:inherit}.scene-binding label:has(input[type=checkbox]){display:flex;align-items:center}.scene-binding details{display:grid;gap:10px}.scene-binding pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto}.scene-binding :focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
</style>
