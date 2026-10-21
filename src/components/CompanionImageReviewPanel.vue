<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Picture, Refresh } from '@element-plus/icons-vue'
import { useImageReviewStore } from '../stores/image-review'
import { imageReviewProvider } from '../image-review-integration'
import { PICKER_IMPORT_MAX_BYTES } from '../domain/picker-import'
import { cooldownLabel, reviewCooldownUntil, safeReviewLink } from '../domain/image-review-workflow'
const props=withDefaults(defineProps<{active?:boolean}>(),{active:true})
const review=useImageReviewStore()
const { importDraftText: importText, parsedDraftText: stagedText, searchDraft }=storeToRefs(review)
const now=ref(Date.now())
const pageVisible=ref(props.active&&document.visibilityState!=='hidden')
const searchReady=computed(()=>review.connected&&review.workflowGuardVerified&&!review.locked&&!review.snapshot.busy&&!review.uncertain&&!review.awaitingTask&&now.value>=review.nextSubmitAt)
const controlReady=computed(()=>review.connected&&review.workflowGuardVerified&&!review.locked&&!review.uncertain&&!review.awaitingTask)
const selectedHistory=ref('')
const thumbnails=ref<Record<string,string>>({})
let thumbnailEpoch=0
let thumbnailController:AbortController|null=null
let pollTimer:ReturnType<typeof setTimeout>|undefined
let pollEpoch=0
function stopPolling(){pollEpoch++;if(pollTimer!==undefined)clearTimeout(pollTimer);pollTimer=undefined}
function schedulePoll(){
 if(pollTimer!==undefined||!pageVisible.value||!review.provider||review.mutation!=='none')return
 const epoch=pollEpoch
 pollTimer=setTimeout(async()=>{pollTimer=undefined;now.value=Date.now();if(review.connected&&!review.locked)await review.refresh();if(epoch===pollEpoch)schedulePoll()},1200)
}
function visibilityChanged(){pageVisible.value=props.active&&document.visibilityState!=='hidden';if(!pageVisible.value)review.cancelPendingRead()}
watch(()=>props.active,visibilityChanged,{flush:'sync'})
document.addEventListener('visibilitychange',visibilityChanged)
watch([()=>review.provider,()=>review.mutation,()=>pageVisible.value],()=>{stopPolling();schedulePoll()},{immediate:true})
watch(()=>review.snapshot.taskId,()=>{selectedHistory.value=review.snapshot.taskId??''})
function cooldownFor(id:string){const item=review.snapshot.items.find(item=>item.id===id);return item?reviewCooldownUntil(item,review.snapshot.cooldowns??[]):0}
function validPreviewPath(path:string,id:string,variant:'thumb'|'full'){return path===`/owner-review/image/${id}/${variant}`||new RegExp(`^/image/[A-Za-z0-9_-]{16,256}/${id}/${variant}$`).test(path)}
async function loadThumbnails(){
 if(!pageVisible.value){thumbnailEpoch++;thumbnailController?.abort();return}
 const epoch=++thumbnailEpoch;thumbnailController?.abort();thumbnailController=new AbortController();thumbnails.value={}
 const active=review.provider;if(!active||!review.connected)return
 await Promise.all(review.snapshot.items.filter(item=>['ready','trash'].includes(item.status)).map(async item=>{try{const source=await active.loadPreview(item.id,'thumb',thumbnailController!.signal);if(epoch===thumbnailEpoch&&source.kind==='same-origin-image'&&validPreviewPath(source.path,item.id,'thumb'))thumbnails.value={...thumbnails.value,[item.id]:source.path}}catch{/* unavailable previews never become success evidence */}}))
}
watch([()=>review.provider,()=>review.connected,()=>review.snapshot.taskId,()=>review.snapshot.items.map(item=>`${item.id}:${item.status}`).join('|'),()=>pageVisible.value],loadThumbnails,{immediate:true})
const inputError=ref('')
const reading=ref(false)
const downloadConfirmed=ref(false)
watch(()=>props.active,active=>{if(!active){downloadConfirmed.value=false;readVersion++;reading.value=false}},{flush:'sync'})
let readVersion=0
const focusedId=ref('')
const previewUrl=ref('')
const previewError=ref('')
const previewLoading=ref(false)
let previewVersion=0
let previewController:AbortController|null=null
const readyCount=computed(()=>review.snapshot.items.filter(item=>item.status==='ready').length)
function attempt(action:()=>unknown) { inputError.value=''; try{const result=action();if(result instanceof Promise)result.catch(cause=>{inputError.value=cause instanceof Error?cause.message:'操作未完成'})}catch(cause){inputError.value=cause instanceof Error?cause.message:'操作未完成'} }
function clearPreview(){previewVersion++;previewController?.abort();previewController=null;previewUrl.value='';focusedId.value='';previewError.value='';previewLoading.value=false}
watch([()=>review.provider,()=>review.snapshot.taskId,()=>review.connected],clearPreview)
watch(()=>review.snapshot.items,()=>{if(focusedId.value&&!review.snapshot.items.some(item=>item.id===focusedId.value&&['ready','trash'].includes(item.status)))clearPreview()})
watch(()=>[imageReviewProvider.value,review.mutation],()=>{if(review.provider!==imageReviewProvider.value){clearPreview();if(review.mutation==='none')attempt(()=>review.disconnect())}},{immediate:true})
watch(importText,()=>{downloadConfirmed.value=false})
async function readFile(event:Event){
 const version=++readVersion;importText.value='';reading.value=false;inputError.value=''
 const file=(event.target as HTMLInputElement).files?.[0];if(!file)return
 if(file.size>PICKER_IMPORT_MAX_BYTES){inputError.value='Picker 清单超过 256 KiB 上限；原候选未改变';return}
 reading.value=true
 try{const text=await file.text();if(version===readVersion)importText.value=text}catch{if(version===readVersion)inputError.value='清单读取失败；原候选未改变'}finally{if(version===readVersion)reading.value=false}
}
function editText(){readVersion++;reading.value=false;downloadConfirmed.value=false}
function stage(){attempt(()=>{review.stage(importText.value);stagedText.value=importText.value;downloadConfirmed.value=false})}
async function preview(id:string){
 clearPreview()
 if(!review.connected||!review.provider||!review.snapshot.items.some(item=>item.id===id&&['ready','trash'].includes(item.status)))return
 focusedId.value=id;previewLoading.value=true;previewController=new AbortController();const version=previewVersion
 try{
  const source=await review.provider.loadPreview(id,'full',previewController.signal)
  if(version!==previewVersion)return
  if(source.kind!=='same-origin-image'||!validPreviewPath(source.path,id,'full'))throw new Error('预览地址不属于当前候选的受控同源路径')
  previewUrl.value=source.path
 }catch(cause){if(version===previewVersion)previewError.value=cause instanceof Error?cause.message:'预览读取失败'}finally{if(version===previewVersion)previewLoading.value=false}
}
function imageFailed(){previewUrl.value='';previewError.value='浏览器无法解码该图片，未形成视觉审阅结论'}
function statusLabel(status:string){return ({ready:'已下载 · 待审阅',trash:'回收区',waiting:'排队中',downloading:'下载中',failed:'下载失败',duplicate:'重复图片'} as Record<string,string>)[status]??`服务状态：${status}`}
onBeforeUnmount(()=>{readVersion++;clearPreview();stopPolling();review.cancelPendingRead();thumbnailEpoch++;thumbnailController?.abort();document.removeEventListener('visibilitychange',visibilityChanged)})
</script>
<template>
  <section class="image-assets-page" data-testid="companion-image-review-panel">
    <el-alert title="图片素材审阅 · 独立于项目示例资料" type="info" :closable="false" show-icon description="关键词搜索会由本机服务检索并下载；Picker JSON 导入先解析、确认后下载。只有显式连接后才读取状态和受控同源预览，不直接加载候选远程图片。"/>
    <section class="panel image-search-panel"><div class="section-heading"><div><span class="section-kicker">PUBLIC IMAGE SEARCH</span><h2>关键词搜索并下载</h2><p class="form-help">沿用 Openverse / Wikimedia Commons 原有来源。点击才访问所选来源并下载，无翻页、不因失败补搜。</p></div><el-tag type="info">{{ review.workflowGuardVerified?'任务绑定合同已核':'等待本机受保护接口' }}</el-tag></div>
      <div class="image-search-inputs"><el-input v-model="searchDraft.query" :disabled="review.locked" aria-label="图片搜索关键词" placeholder="输入 1–200 字关键词" @keydown.enter.prevent="searchReady && attempt(()=>review.search(searchDraft))"/><el-input-number v-model="searchDraft.limit" :min="1" :max="30" :precision="0" :disabled="review.locked" aria-label="搜索合并总上限"/><el-button type="primary" :disabled="!searchReady || !searchDraft.query.trim() || !searchDraft.sourceIds.length" :loading="review.mutation==='search'" @click="attempt(()=>review.search(searchDraft))">搜索并下载到审阅区</el-button></div>
      <el-checkbox-group v-model="searchDraft.sourceIds" :disabled="review.locked" aria-label="图片搜索来源"><el-checkbox v-for="source in review.snapshot.sources??[]" :key="source.id" :value="source.id">{{ source.label }}</el-checkbox></el-checkbox-group><p v-for="source in review.snapshot.sources??[]" :key="source.id" class="form-help">服务原说明（不代表本次可用性验证）：{{ source.label }} · {{ source.description }}</p>
      <p class="form-help">搜索 / 导入间隔至少 10 秒；冷却到期只允许用户重试。{{ now < review.nextSubmitAt ? '上次提交间隔尚未结束。' : '' }} 未连接时不展示假来源状态。</p><p class="image-external-links"><a href="https://image.baidu.com/" target="_blank" rel="noopener noreferrer">打开百度图片 ↗</a><a href="https://images.google.com/" target="_blank" rel="noopener noreferrer">打开 Google 图片 ↗</a><span>手动输入关键词，用 Picker 导出后再导入；不会自动转交输入内容。</span></p>
    </section>
    <section class="panel image-assets-intro">
      <div class="section-heading"><div><span class="section-kicker">PICKER REVIEW</span><h2>候选图片，先看清再保留</h2><p class="form-help">导入候选 → 页内预览 → 勾选保留 → 核对本地保存结果</p></div><el-tag :type="review.connected?'success':'info'">{{ review.connected?'已读取审阅服务':'审阅服务未连接' }}</el-tag></div>
      <div class="planner-import-actions"><el-button v-if="imageReviewProvider" :disabled="review.locked" @click="attempt(()=>review.connect(imageReviewProvider!))">连接本机审阅服务</el-button><el-button :icon="Refresh" :loading="review.loading" :disabled="!review.provider || review.mutation!=='none'" @click="review.refresh()">刷新真实状态</el-button><el-button :disabled="!review.provider || review.mutation!=='none'" @click="attempt(()=>review.disconnect())">断开审阅服务</el-button><span>{{ review.provider?.label || '尚未注册受控同源接口；下载与目录保存不可用' }}</span></div>
      <p class="form-help">不填写服务地址或 token，不跨端口连接。导入文件是公开图片地址清单，不含图片字节。</p>
      <input type="file" accept=".json,application/json" aria-label="选择 Picker 候选 JSON" :disabled="review.locked" @change="readFile"/>
      <el-input v-model="importText" type="textarea" :rows="5" :maxlength="PICKER_IMPORT_MAX_BYTES" :disabled="reading || review.locked" @input="editText" aria-label="Picker 候选 JSON" placeholder="选择公开图片-待审清单.json，或粘贴其完整内容"/>
      <div class="planner-import-actions"><el-button type="primary" :disabled="reading || review.locked || !importText.trim()" @click="stage">解析候选清单（不下载）</el-button><span>schema 1 · 1–30 张 · 最多 256 KiB</span></div>
      <el-alert v-if="inputError" :title="inputError" type="error" :closable="false"/>
      <template v-if="review.manifest">
        <h3>本页候选地址 {{ review.manifest.images.length }} 项</h3>
        <p v-if="review.manifest.filter_policy" class="form-help">过滤：最小 {{ review.manifest.filter_policy.min_width }} × {{ review.manifest.filter_policy.min_height }}；排除 {{ review.manifest.filter_policy.exclude_formats.join(' / ') || '无' }}。是否符合条件由下载后的实际像素验证。</p>
        <ol class="picker-address-list"><li v-for="(candidate,index) in review.manifest.images" :key="index"><strong>{{ candidate.title || `候选 ${index+1}` }}</strong><span>{{ candidate.image_url }}</span><small>来源：{{ candidate.source_page }}</small></li></ol>
        <el-checkbox v-model="downloadConfirmed" :disabled="review.locked || reading || importText!==stagedText">确认由本机审阅服务访问上述公开图片及来源；不绕过登录或版权限制</el-checkbox>
        <div class="planner-import-actions"><el-button :loading="review.mutation==='import'" :disabled="review.provider?.candidateImportEnabled===false || !review.connected || review.locked || reading || importText!==stagedText || review.snapshot.busy || review.uncertain || review.awaitingTask || now < review.nextSubmitAt || review.importAccepted || !downloadConfirmed" @click="attempt(()=>review.submitImport(downloadConfirmed))">导入并下载到审阅区</el-button><span>{{ review.importAccepted?'这份清单已受理，不会重复提交；请刷新状态或在原服务重试失败项。':'仅入队不等于下载成功，完成后刷新查看真实结果。' }}</span></div>
      </template>
      <el-empty v-else description="尚未导入候选图片，不展示示例或假保存记录" :image-size="70"><template #image><el-icon :size="60"><Picture/></el-icon></template></el-empty>
    </section>
    <el-alert v-if="review.error" :title="review.error" type="error" :closable="false" class="planner-alert"/>
    <el-alert v-if="review.uncertain" title="上次写入结果待核对，后续提交已暂停；请在原审阅服务核实，勿重复发起。" type="warning" :closable="false" class="planner-alert"/>
    <el-alert v-if="review.awaitingTask" title="请求已受理，尚未读取到目标任务；不会根据旧空闲快照重复提交。" type="info" :closable="false"/>
    <div v-if="review.awaitingTask" class="planner-import-actions"><el-button :disabled="!review.canAdoptObservedTask" @click="attempt(()=>review.adoptObservedTask(true))">采用当前已读任务；不会重发原请求</el-button><span>{{ review.snapshot.task?.query || '当前无任务' }} · {{ review.snapshot.taskId?.slice(0,8) || '空' }}</span></div>
    <p v-if="review.notice" role="status" class="form-help">{{ review.notice }}</p>
    <section class="panel image-task-status"><div class="section-heading"><h3>当前任务与历史</h3><span>{{ review.connected ? (review.snapshot.busy?'服务忙碌':'最近读取为空闲') : '未读取' }}</span></div><p v-if="review.snapshot.task" class="form-help">{{ review.snapshot.task.mode==='search'?'关键词搜索':'Picker 导入' }} · {{ review.snapshot.task.query }} · {{ review.snapshot.task.status }} · {{ review.snapshot.task.createdAt }}<br/>任务 done 可包含下载失败，不代表图片全成功。</p><p v-if="review.snapshot.cache" class="form-help">待审缓存：{{ review.snapshot.cache }}</p><p v-if="review.snapshot.task?.error" role="status">{{ review.snapshot.task.error }}</p>
      <div class="planner-import-actions"><el-select v-model="selectedHistory" :disabled="!controlReady || review.snapshot.busy" aria-label="选择审阅历史任务" placeholder="选择已登记任务"><el-option v-for="task in review.snapshot.history??[]" :key="task.id" :value="task.id" :label="`${task.query} · ${task.provider} · ${task.createdAt}`"/></el-select><el-button :disabled="!controlReady || review.snapshot.busy || !selectedHistory || selectedHistory===review.snapshot.taskId" @click="attempt(()=>review.switchTask(selectedHistory))">切换历史任务</el-button><el-button :disabled="!controlReady || !review.snapshot.busy || review.stopRequestedTaskId===review.snapshot.taskId" @click="attempt(()=>review.stop())">请求停止下载</el-button><span>已连接且页面可见时，串行约 1.2 秒读取；写入 / 保存窗口期间暂停。</span></div>
      <div class="review-source-reports"><article v-for="report in review.snapshot.task?.reports??[]" :key="report.sourceId"><strong>{{ report.label || report.sourceId }} · {{ report.status }}</strong><p>预算 {{ report.requested??'未记录' }} · 候选 {{ report.returned??'未记录' }} · 下载 {{ report.downloaded??'未记录' }} · 失败 {{ report.downloadFailed??'未记录' }} · URL 去重 {{ report.duplicateUrls??'未记录' }} · 内容去重 {{ report.duplicateContents??'未记录' }}</p><p>{{ [report.error,...report.reasons].filter(Boolean).join('；') }}</p><p v-if="report.nextAllowedAt || report.manualHold">{{ cooldownLabel(report.manualHold?Infinity:report.nextAllowedAt,now) }}</p></article><article v-for="entry in review.snapshot.cooldowns??[]" :key="entry.key"><strong>{{ entry.key }} · 冷却记录</strong><p>{{ cooldownLabel(entry.manualHold?Infinity:entry.nextAllowedAt,now) }}</p><p>{{ entry.retryAfter ? `来源 Retry-After：${entry.retryAfter}` : '来源未给有效等待时间，按本机保守退避；取消或重启仍保留。' }}</p></article></div>
    </section>
    <section class="image-review-workspace">
      <div class="panel image-review-list"><div class="section-heading"><h3>服务候选 {{ review.connected ? `${review.snapshot.items.length} 项` : '未读取' }}</h3><span v-if="review.connected">{{ readyCount }} 项可审阅 · {{ review.selectedIds.length }} 项选中 · {{ review.snapshot.items.filter(item=>item.status==='failed').length }} 项失败 · {{ review.snapshot.items.filter(item=>item.status==='trash').length }} 项回收 · {{ review.snapshot.busy?'服务忙碌':'以最近读取为准' }}</span></div>
        <p v-if="review.connected&&!review.selectionGuardVerified" class="form-help">当前桥接没有任务绑定的选择持久化合同，勾选暂不可用。</p><div class="planner-import-actions"><el-button :disabled="!review.canSelect || !readyCount" @click="attempt(()=>review.persistSelectMany('all'))">全选</el-button><el-button :disabled="!review.canSelect || !readyCount" @click="attempt(()=>review.persistSelectMany('invert'))">反选</el-button><el-button :disabled="!review.canSelect || !readyCount" @click="attempt(()=>review.persistSelectMany('none'))">取消选择</el-button></div>
        <div v-for="item in review.snapshot.items" :key="item.id" class="image-review-row"><img v-if="thumbnails[item.id]" :src="thumbnails[item.id]" :alt="`${item.title} 缩略图`" class="review-thumbnail" loading="lazy" @error="delete thumbnails[item.id]"/><el-checkbox :model-value="review.selectedIds.includes(item.id)" :disabled="item.status!=='ready' || !review.canSelect" :aria-label="`保留${item.title || item.id}`" @change="attempt(()=>review.persistSelect(item.id,Boolean($event)))"><span class="sr-only">保留 {{ item.title || item.id }}</span></el-checkbox><div><strong>{{ item.title || item.id }}</strong><small>{{ statusLabel(item.status) }} · {{ item.width ?? '未知宽' }} × {{ item.height ?? '未知高' }}</small><small>{{ item.contentType || '格式待核' }} · {{ item.bytes==null?'字节未记录':`${item.bytes} B` }}</small><small>{{ item.sourceWebsite || '来源未知' }} · {{ item.sourceLabel || '公开来源未记录' }} · {{ item.creator || '作者未核' }}</small><small>许可：{{ item.license || '未知' }} {{ item.licenseVersion || '' }}</small><small v-if="item.candidateKind">{{ item.candidateKind }} · {{ item.discoveryMethod }} · 原图 / 作者未因此证实</small><div class="review-metadata-links"><a v-if="safeReviewLink(item.sourcePage)" :href="safeReviewLink(item.sourcePage)!" target="_blank" rel="noopener noreferrer">打开来源页 ↗</a><a v-if="safeReviewLink(item.licenseUrl)" :href="safeReviewLink(item.licenseUrl)!" target="_blank" rel="noopener noreferrer">查看许可 ↗</a></div><small v-if="item.error">{{ item.error }}</small><small v-if="item.status==='failed'&&cooldownFor(item.id)">{{ cooldownLabel(cooldownFor(item.id),now) }}</small><el-button v-if="item.status==='failed'" :disabled="!controlReady || review.snapshot.busy || cooldownFor(item.id)*1000>now" @click="attempt(()=>review.retry(item.id))">重试此张</el-button></div><el-button :disabled="!['ready','trash'].includes(item.status) || !review.connected" @click="preview(item.id)">页内查看</el-button></div>
        <el-empty v-if="!review.snapshot.items.length" description="尚无审阅服务返回的图片" :image-size="60"/>
      </div>
      <aside class="panel image-review-preview"><h3>页内预览</h3><div v-loading="previewLoading" class="image-review-canvas"><img v-if="previewUrl" :src="previewUrl" alt="当前选中候选的受控图片预览" @error="imageFailed"/><el-empty v-else :description="previewError || '选择服务候选，在这里查看原图'" :image-size="70"/></div><p class="form-help">不会直接加载候选远程 URL；勾选会按当前任务持久化到本机审阅服务，刷新 / 重开以服务选择为准；不构成视觉批准或工程导入。</p></aside>
    </section>
    <section class="panel image-assets-intro"><h3>可恢复回收区</h3><p class="form-help">仅移动当前任务未勾选的 ready 图片到原缓存回收区；保留勾选集与任务 ID 在服务器同锁核对，不清理导出目录。</p><div class="planner-import-actions"><el-button :disabled="!controlReady || review.snapshot.busy || !review.snapshot.items.some(item=>item.status==='ready'&&!review.selectedIds.includes(item.id))" @click="attempt(()=>review.recycle())">未选中移到回收区</el-button><el-button :disabled="!controlReady || review.snapshot.busy || !review.snapshot.items.some(item=>item.status==='trash')" @click="attempt(()=>review.restore())">恢复回收区图片</el-button></div></section>
    <section class="panel image-assets-intro"><div class="section-heading"><div><h3>保存勾选图片到本地目录</h3><p class="form-help">由原审阅服务打开原生目录选择器，保存原图及来源记录，同名不覆盖。取消不会标为保存成功。</p></div><el-button type="primary" :loading="review.mutation==='save'" :disabled="!review.canSave" @click="attempt(()=>review.save())">保存选中 · 选择目录</el-button></div>
      <el-alert v-if="!review.saveGuardVerified" title="保存当前不可用：同源会话与任务 / 选择一致性保护尚未接通验证" type="info" :closable="false"/>
      <div v-if="review.receipt"><h4>上次保存回执（不代表当前任务已保存）</h4><p>{{ review.receipt.cancelled?'目录选择已取消':`服务回执目录：${review.receipt.directory}` }}</p><ul><li v-for="row in review.receipt.results" :key="row.id">{{ row.id }}：{{ row.ok?`已保存 ${row.filename}`:`失败 ${row.error || '服务未给出原因'}` }}</li></ul><p class="form-help">这是图片目录保存回执，不代表写入项目配置、导入 Cocos 或完成绑定。</p></div>
    </section>
  </section>
</template>
