import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { parsePickerImport } from '../domain/picker-import'
import type { PickerImport } from '../domain/picker-import'
import { validateImageSearch, reviewCooldownUntil } from '../domain/image-review-workflow'
import type { ImageSearchRequest } from '../domain/image-review-workflow'
import { ImageReviewRejection } from '../domain/image-review'
import type { ImageReviewProvider, ImageReviewSnapshot, ImageSaveReceipt } from '../domain/image-review'
const empty = (): ImageReviewSnapshot => ({ taskId:null, busy:false, items:[], task:null, sources:[], history:[], cooldowns:[] })
export const useImageReviewStore = defineStore('image-review', () => {
  const manifest = shallowRef<PickerImport | null>(null)
  // Keep unsent input across global Help/About navigation; no disk persistence.
  const importDraftText = ref('')
  const parsedDraftText = ref('')
  const snapshot = shallowRef<ImageReviewSnapshot>(empty())
  const selectedIds = ref<string[]>([])
  const connected = ref(false)
  // Provider capability is a plain getter. Commit it reactively with the latest
  // validated read; otherwise a pending refresh can leave canSave cached false.
  const saveGuardVerified = ref(false)
  const workflowGuardVerified = ref(false)
  const selectionGuardVerified = ref(false)
  const searchDraft = ref<ImageSearchRequest>({query:'',limit:10,sourceIds:['openverse']})
  const nextSubmitAt = ref(0)
  const awaitingTask = ref<{kind:'search'|'history';before:string|null;target?:string;afterRead:number}|null>(null)
  const readSerial=ref(0)
  const canAdoptObservedTask=computed(()=>Boolean(awaitingTask.value&&connected.value&&workflowGuardVerified.value&&!locked.value&&!uncertain.value&&readSerial.value>awaitingTask.value.afterRead))
  const stopRequestedTaskId = ref<string|null>(null)
  const loading = ref(false)
  const mutation = ref<'none' | 'import' | 'save' | 'search' | 'history' | 'retry' | 'stop' | 'recycle' | 'restore' | 'select'>('none')
  const uncertain = ref(false)
  const acceptedManifest = ref('')
  const importAccepted = computed(() => Boolean(manifest.value && JSON.stringify(manifest.value)===acceptedManifest.value))
  const error = ref('')
  const notice = ref('')
  const receipt = shallowRef<ImageSaveReceipt | null>(null)
  const provider = shallowRef<ImageReviewProvider | null>(null)
  let version = 0
  let controller: AbortController | null = null
  const locked = computed(() => loading.value || mutation.value !== 'none')
  const canSelect = computed(()=>connected.value && selectionGuardVerified.value && !locked.value && !uncertain.value && !awaitingTask.value && Boolean(snapshot.value.taskId))
  const canSave = computed(() => connected.value && saveGuardVerified.value && !snapshot.value.busy && !locked.value && !uncertain.value && !awaitingTask.value && selectedIds.value.length>0 && Boolean(snapshot.value.taskId))
  function stage(contents: string) {
    if (locked.value) throw new Error('当前操作尚未结束，候选清单未替换')
    const parsed = parsePickerImport(contents)
    manifest.value = parsed
    error.value = ''; notice.value = '已在浏览器解析地址清单，尚未下载图片。'
  }
  async function connect(next: ImageReviewProvider) {
    if (mutation.value !== 'none') throw new Error('写入请求尚未结束，不能切换审阅服务')
    ++version; controller?.abort(); saveGuardVerified.value=false;workflowGuardVerified.value=false;selectionGuardVerified.value=false; next.resetSession?.(); provider.value=next; connected.value=false; snapshot.value=empty(); selectedIds.value=[]; receipt.value=null
    await refresh()
  }
  function disconnect() {
    if (mutation.value !== 'none') throw new Error('写入请求尚未结束，不能断开并丢弃结果')
    ++version;controller?.abort();saveGuardVerified.value=false;workflowGuardVerified.value=false;selectionGuardVerified.value=false;provider.value=null;connected.value=false;loading.value=false;snapshot.value=empty();selectedIds.value=[]
    notice.value='审阅连接已清空；浏览器候选清单仍保留。'
  }
  async function refresh() {
    if (!provider.value || mutation.value !== 'none') return
    const activeProvider=provider.value
    const current=++version;controller?.abort();controller=new AbortController();saveGuardVerified.value=false;workflowGuardVerified.value=false;selectionGuardVerified.value=false;loading.value=true;if(!uncertain.value)error.value=''
    try {
      const data=await activeProvider.loadState(controller.signal)
      if(current!==version)return
      if(typeof data.busy!=='boolean' || (data.taskId!==null && (typeof data.taskId!=='string'||!(/^[a-f0-9]{32}$/).test(data.taskId))) || !Array.isArray(data.items) || data.items.length>30 || new Set(data.items.map(item=>item.id)).size!==data.items.length || data.items.some(item=>typeof item.id!=='string'||!(/^[a-f0-9]{32}$/).test(item.id)||typeof item.status!=='string'||typeof item.selected!=='boolean'||typeof item.title!=='string'))throw new Error('审阅状态响应未通过校验')
      const sameTask=data.taskId===snapshot.value.taskId
      snapshot.value=data;connected.value=true;readSerial.value++
      const ready=new Set(data.items.filter(item=>item.status==='ready').map(item=>item.id))
      selectedIds.value=(sameTask&&activeProvider.selectionGuard!=='verified'?selectedIds.value:data.items.filter(item=>item.selected).map(item=>item.id)).filter(id=>ready.has(id))
      if(!sameTask)receipt.value=null
      saveGuardVerified.value=activeProvider.saveSelectionGuard==='verified'
      workflowGuardVerified.value=activeProvider.workflowGuard==='verified'
      selectionGuardVerified.value=activeProvider.selectionGuard==='verified'
      if(awaitingTask.value && (awaitingTask.value.kind==='search' ? Boolean(data.taskId && data.taskId!==awaitingTask.value.before) : data.taskId===awaitingTask.value.target)) awaitingTask.value=null
      if(!data.busy || data.taskId!==stopRequestedTaskId.value)stopRequestedTaskId.value=null
    } catch(cause) {
      if(current!==version)return
      saveGuardVerified.value=false;workflowGuardVerified.value=false;selectionGuardVerified.value=false;connected.value=false;snapshot.value=empty();selectedIds.value=[]
      error.value=cause instanceof Error?cause.message:'读取审阅服务失败'
    } finally {if(current===version)loading.value=false}
  }
  function cancelPendingRead() {
    if(mutation.value!=='none'||!loading.value)return
    ++version;controller?.abort();loading.value=false;saveGuardVerified.value=false;workflowGuardVerified.value=false;selectionGuardVerified.value=false
  }
  // Local selection helpers retained for legacy injected providers; hosted UI uses persist* only.
  function select(id:string,keep:boolean) {
    if(locked.value || !snapshot.value.items.some(item=>item.id===id&&item.status==='ready'))return
    selectedIds.value=keep?[...new Set([...selectedIds.value,id])]:selectedIds.value.filter(item=>item!==id)
    receipt.value=null
  }
  async function submitImport(confirmed:boolean) {
    if(!manifest.value||!provider.value||!connected.value||locked.value||snapshot.value.busy||uncertain.value||awaitingTask.value||importAccepted.value)throw new Error('审阅服务未就绪，未提交下载')
    if(!confirmed)throw new Error('请确认由本机审阅服务访问清单中的公开图片及来源')
    if(Date.now()<nextSubmitAt.value)throw new Error('搜索 / 导入间隔至少 10 秒，请稍候')
    mutation.value='import';nextSubmitAt.value=Date.now()+10000;error.value='';notice.value='';receipt.value=null
    let accepted=false
    try {const submitted=JSON.stringify(manifest.value);await provider.value.importCandidates(JSON.parse(submitted) as PickerImport);acceptedManifest.value=submitted;accepted=true;notice.value='下载任务已入队，图片是否可用须以服务状态为准。'}
    catch(cause){if(cause instanceof ImageReviewRejection)error.value=cause.message;else{uncertain.value=true;error.value=`提交结果未确认，请先到审阅服务核对，不会自动重试。${cause instanceof Error?cause.message:''}`}}
    finally{mutation.value='none'}
    if(accepted)await refresh()
  }
  function selectMany(kind:'all'|'invert'|'none') {
    if(locked.value)return
    const ready=snapshot.value.items.filter(item=>item.status==='ready').map(item=>item.id)
    selectedIds.value=kind==='none'?[]:kind==='all'?ready:ready.filter(id=>!selectedIds.value.includes(id))
    receipt.value=null
  }
  function requireWorkflow(allowBusy=false) {
    const active=provider.value
    if(!active||!connected.value||!workflowGuardVerified.value||active.workflowGuard!=='verified'||locked.value||uncertain.value||awaitingTask.value||(!allowBusy&&snapshot.value.busy))throw new Error('任务绑定操作未就绪，未提交请求')
    return active
  }
  async function runControl(kind:Exclude<typeof mutation.value,'none'|'import'|'save'>, action:()=>Promise<void>, acceptedNotice:string, onAccepted?:()=>void) {
    mutation.value=kind;error.value='';notice.value='';receipt.value=null
    let accepted=false;let rejected=''
    try {await action();accepted=true;onAccepted?.();notice.value=acceptedNotice}
    catch(cause){if(cause instanceof ImageReviewRejection){rejected=cause.message;error.value=rejected}else{uncertain.value=true;error.value=`操作结果未确认，已暂停后续提交，不会自动重试。${cause instanceof Error?cause.message:''}`}}
    finally{mutation.value='none'}
    if(accepted||rejected){await refresh();if(rejected)error.value=rejected}
  }
  async function persistSelected(ids:string[]) {
    const active=provider.value, taskId=snapshot.value.taskId
    if(!active||!canSelect.value||!taskId||active.selectionGuard!=='verified'||!active.persistSelection)throw new Error('选择持久化接口未就绪，未更改服务保留项')
    if(ids.length>30||new Set(ids).size!==ids.length||ids.some(id=>!snapshot.value.items.some(item=>item.id===id&&item.status==='ready')))throw new Error('只能保留当前任务已下载的图片')
    const frozen=[...ids]
    await runControl('select',()=>active.persistSelection!(taskId,frozen),'保留选择已提交；当前勾选以重新读取的服务选择为准。')
  }
  async function persistSelect(id:string,keep:boolean) {
    if(!snapshot.value.items.some(item=>item.id===id&&item.status==='ready'))throw new Error('只能选择已下载的当前图片')
    await persistSelected(keep?[...new Set([...selectedIds.value,id])]:selectedIds.value.filter(item=>item!==id))
  }
  async function persistSelectMany(kind:'all'|'invert'|'none') {
    const ready=snapshot.value.items.filter(item=>item.status==='ready').map(item=>item.id)
    await persistSelected(kind==='none'?[]:kind==='all'?ready:ready.filter(id=>!selectedIds.value.includes(id)))
  }
  async function search(input:ImageSearchRequest) {
    const checked=validateImageSearch(input), active=requireWorkflow()
    if(!active.searchImages)throw new Error('关键词接口尚未接入')
    if(checked.sourceIds.some(id=>!snapshot.value.sources?.some(source=>source.id===id)))throw new Error('所选来源未由当前服务声明')
    if(Date.now()<nextSubmitAt.value)throw new Error('搜索 / 导入间隔至少 10 秒，请稍候')
    if(snapshot.value.cooldowns?.some(entry=>checked.sourceIds.some(id=>entry.key===`source:${id}`)&&(entry.manualHold||entry.nextAllowedAt*1000>Date.now())))throw new Error('所选来源仍在冷却；不会自动请求')
    const before=snapshot.value.taskId
    nextSubmitAt.value=Date.now()+10000
    await runControl('search',()=>active.searchImages!(before,checked),'搜索已受理；下载、失败和限制以真实任务状态为准。',()=>{awaitingTask.value={kind:'search',before,afterRead:readSerial.value}})
  }
  async function switchTask(taskId:string) {
    const active=requireWorkflow()
    if(!active.switchTask||!snapshot.value.history?.some(task=>task.id===taskId)||taskId===snapshot.value.taskId)throw new Error('请选择服务已登记的其他历史任务')
    const before=snapshot.value.taskId
    await runControl('history',()=>active.switchTask!(before,taskId),'历史切换已受理；读到目标任务前不能继续写入。',()=>{awaitingTask.value={kind:'history',before,target:taskId,afterRead:readSerial.value}})
  }
  function adoptObservedTask(confirmed:boolean) {
    if(!confirmed||!canAdoptObservedTask.value)throw new Error('需先成功读取受理后的当前任务，并明确选择采用；未知结果不能这样解除')
    awaitingTask.value=null;selectedIds.value=snapshot.value.items.filter(item=>item.selected&&item.status==='ready').map(item=>item.id);receipt.value=null
    notice.value='已采用当前已读任务；没有重发原请求，也没有改变服务任务。'
  }
  async function retry(id:string) {
    const active=requireWorkflow(), taskId=snapshot.value.taskId
    const item=snapshot.value.items.find(item=>item.id===id&&item.status==='failed')
    if(!taskId||!active.retryImage||!item)throw new Error('只能重试当前任务的失败图片')
    if(reviewCooldownUntil(item,snapshot.value.cooldowns??[])*1000>Date.now())throw new Error('该图片仍在冷却；不会自动重试')
    await runControl('retry',()=>active.retryImage!(taskId,id),'单张重试已受理，不重新搜索或补充候选；以下载状态为准。')
  }
  async function stop() {
    const active=requireWorkflow(true), taskId=snapshot.value.taskId
    if(!active.requestStop||!taskId||!snapshot.value.busy||stopRequestedTaskId.value===taskId)throw new Error('没有可请求停止的任务，或已请求停止')
    await runControl('stop',()=>active.requestStop!(taskId),'已请求停止；当前有限超时请求结束后才会停，不关闭保存选择器。',()=>{stopRequestedTaskId.value=taskId})
  }
  async function recycle() {
    const active=requireWorkflow(), taskId=snapshot.value.taskId
    if(!active.recycleUnselected||!taskId||!snapshot.value.items.some(item=>item.status==='ready'&&!selectedIds.value.includes(item.id)))throw new Error('没有未选中的已下载图片可回收')
    const ids=[...selectedIds.value]
    await runControl('recycle',()=>active.recycleUnselected!(taskId,ids),'回收操作完成；未选中的已下载图片移入可恢复区，导出目录不受影响。')
  }
  async function restore() {
    const active=requireWorkflow(), taskId=snapshot.value.taskId
    if(!active.restoreImages||!taskId||!snapshot.value.items.some(item=>item.status==='trash'))throw new Error('当前任务没有可恢复图片')
    await runControl('restore',()=>active.restoreImages!(taskId),'恢复操作完成；请核对当前任务中的图片状态。')
  }
  async function save() {
    if(!canSave.value||!provider.value||provider.value.saveSelectionGuard!=='verified'||!snapshot.value.taskId)throw new Error('保存接口或所选项未就绪，没有写入目录')
    const expected={taskId:snapshot.value.taskId,ids:[...selectedIds.value]}
    mutation.value='save';error.value='';notice.value='';receipt.value=null
    try {
      const result=await provider.value.saveSelected(expected)
      const ids=new Set(expected.ids)
      if(typeof result.cancelled!=='boolean'||!Array.isArray(result.results)||result.results.some(row=>!ids.has(row.id)||typeof row.ok!=='boolean'||(row.ok&&(!row.filename||typeof row.filename!=='string')))||new Set(result.results.map(row=>row.id)).size!==result.results.length||(result.cancelled&&result.results.length)||( !result.cancelled&&(typeof result.directory!=='string'||!result.directory||result.results.length!==expected.ids.length)))throw new Error('保存回执与本次选择不匹配，结果需人工核对')
      receipt.value=result
      notice.value=result.cancelled?'已取消目录选择，没有返回保存文件。':`服务确认保存 ${result.results.filter(row=>row.ok).length} 项，失败 ${result.results.filter(row=>!row.ok).length} 项。`
    }catch(cause){if(cause instanceof ImageReviewRejection)error.value=cause.message;else{uncertain.value=true;error.value=`保存结果未确认，不会自动重试。${cause instanceof Error?cause.message:''}`}}
    finally{mutation.value='none'}
  }
  return { manifest,importDraftText,parsedDraftText,snapshot,selectedIds,connected,saveGuardVerified,loading,mutation,uncertain,importAccepted,error,notice,receipt,provider,locked,canSave,cancelPendingRead,workflowGuardVerified,selectionGuardVerified,canSelect,persistSelected,persistSelect,persistSelectMany,searchDraft,nextSubmitAt,awaitingTask,canAdoptObservedTask,adoptObservedTask,stopRequestedTaskId,selectMany,search,switchTask,retry,stop,recycle,restore,stage,connect,disconnect,refresh,select,submitImport,save }
})
