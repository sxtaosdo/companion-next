<script setup lang="ts">
import { computed,onBeforeUnmount,watch } from 'vue'
import InfoTip from './InfoTip.vue'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { runtimeStateLabel } from '../domain/companion-browser'
import { creatorActionLabel,creatorActionConfirmation,type CreatorAction } from '../domain/creator-operations'
import { creatorOperationsProvider } from '../creator-operations-integration'
const store=useCreatorOperationsStore(),projects=useCompanionBrowserStore()
const target=computed(()=>store.prepared??store.receipt)
const registrationReadbackText=computed(()=>store.registrationReadback?({present:'原工程登记仍存在',absent:'本次登记列表未包含原工程',changed:'相同 ID 的工程登记信息已经变化'} as const)[store.registrationReadback.presence]:'尚未取得本次结果之后的有效登记回读')
let mounted=true,contextEpoch=0
watch(()=>[projects.provider,creatorOperationsProvider.value,projects.connected,JSON.stringify(projects.projects)],()=>{contextEpoch++},{flush:'sync'})
function toggleDialog(value:boolean){if(!value)store.closeDialog()}
function open(projectId:string,action:CreatorAction){store.prepare(projectId,action)}
async function confirm(){const prepared=store.prepared;if(!prepared)return;const epoch=contextEpoch,source=projects.provider;const acknowledged=await store.send(prepared,true);if(acknowledged&&mounted&&store.dialogOpen&&projects.connected&&source===projects.provider&&epoch===contextEpoch)await projects.refreshProjects()}
defineExpose({open})
onBeforeUnmount(()=>{mounted=false;store.leave()})
</script>
<template>
 <el-dialog :model-value="store.dialogOpen" :title="target?creatorActionLabel(target.action):'工程操作'" width="min(620px,calc(100vw - 32px))" :close-on-click-modal="false" @update:model-value="toggleDialog">
  <template v-if="target">
   <div class="operation-target"><strong>{{ target.project.name }}</strong><code>{{ target.project.id }}</code><span>{{ target.project.path }}</span><span>{{ target.runtime?runtimeStateLabel(target.runtime.state):'状态未读取' }}<InfoTip label="操作来源详情" :text="`读取：${target.source.readLabel}；操作：${target.source.operationLabel}；快照：${target.observedAt}`"/></span></div>
   <p v-if="target.action==='stop'">请先自行保存 Scene / Prefab。确认后请求停止此 Creator，返回 stopped 不证明进程已退出。</p>
   <p v-else-if="target.action==='restart'">请先保存 Scene / Prefab。确认后由后台停止、等待并重新打开；Bridge 不可用且 Dashboard 仍报告运行时会拒绝。重启回执不等于已就绪。</p>
   <el-alert v-if="target.action==='stop'||target.action==='restart'" type="warning" :closable="false" title="未保存内容须自行核查" description="原后台将查询值转为布尔值，异常空值可能被当作无修改；本页不能保证拦截，也不支持强制关闭。"/>
   <p v-if="target.action==='open-folder'">打开此工程的系统目录。只发送工程 ID；回执不证明文件管理器窗口已出现。</p>
   <template v-if="target.action==='remove-registration'"><p>移除 Companion 登记与工程工具预设绑定。不会删除工程文件、停止 Creator、卸载 Bridge 或移除客户端配置。</p><el-alert type="warning" :closable="false" title="移除不是原子操作，失败可能已部分完成" description="没有一键撤销。重新登记不会恢复旧工具绑定；缺少绑定时默认 full（全部工具），可能扩大工具可见范围。"/></template>
   <InfoTip label="等待与回执说明" text="确认时暂停工程自动轮询，手动刷新会撤销确认。停止等待或关窗不会取消后台动作；超时或断线先核对状态与日志，不自动重发。此操作不安装 Bridge、不配置 Codex。"/>
  </template>
  <el-alert v-if="store.error" :title="store.error" type="warning" :closable="false"/>
  <p v-if="store.receipt" class="operation-receipt" data-testid="operation-dialog-receipt">{{ store.display.message }}</p>
  <p v-if="store.receipt?.action==='remove-registration'&&store.receipt.id===store.lastReceipt?.id" data-testid="registration-dialog-readback">{{ registrationReadbackText }}。回读不改变原回执，也不证明工具绑定已清理。</p>
  <template #footer><el-button v-if="store.receipt?.action==='remove-registration'&&!store.pending" :disabled="!store.canRefreshRegistration" :loading="projects.projectLoading" @click="store.refreshRegistration()">核对登记与状态</el-button><el-button v-if="store.pending" @click="store.cancelWaiting">停止等待</el-button><el-button @click="store.closeDialog">{{ store.pending?'关闭并停止等待':'关闭' }}</el-button><el-button v-if="store.prepared" :type="store.prepared.action==='remove-registration'?'danger':'primary'" :disabled="store.pending||store.transportPending" @click="confirm">{{ creatorActionConfirmation(store.prepared.action) }}</el-button></template>
 </el-dialog>

</template>
<style scoped>.operation-target{display:grid;gap:5px;margin-bottom:14px;overflow-wrap:anywhere}.operation-target code{font-size:12px;color:var(--el-text-color-secondary)}.operation-receipt{font-size:13px;line-height:1.6}</style>
