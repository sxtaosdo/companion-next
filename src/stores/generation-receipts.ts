import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { ResourcePlan } from '../domain/resource-planning'
import { contextMatchesPlan, createReceiptContext, exportGenerationReceipts, inspectGenerationFile, MAX_GENERATION_FILE_BYTES, MAX_GENERATION_RECEIPTS } from '../domain/generation-receipt'
import type { GenerationReceipt } from '../domain/generation-receipt'

export interface LocalGenerationFile { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }
const sameScope = (receipt: GenerationReceipt, mode: 'demo' | 'live', projectId: string) => receipt.context.scope.mode === mode && receipt.context.scope.projectId === projectId

/** Metadata only, page memory only. Files, credentials and external success claims are never persisted. */
export const useGenerationReceiptsStore = defineStore('generation-receipts', () => {
  const receipts = shallowRef<GenerationReceipt[]>([])
  const pending = ref(false)
  let epoch = 0
  function list(mode: 'demo' | 'live', projectId: string) { return receipts.value.filter((r) => sameScope(r, mode, projectId)) }
  function cancelPending() { epoch++; pending.value = false }
  async function receive(plan: ResourcePlan, requirementId: string, file: LocalGenerationFile, stillCurrent: () => ResourcePlan | undefined): Promise<GenerationReceipt | undefined> {
    if (pending.value) throw new Error('已有文件正在读取，请等待读取完成或取消')
    const context = createReceiptContext(plan, requirementId)
    const group = () => list(context.scope.mode, context.scope.projectId)
    if (group().length >= MAX_GENERATION_RECEIPTS) throw new Error('本项目最多保留 32 份内存回收记录，请先导出清单')
    if (!Number.isInteger(file.size) || file.size < 1 || file.size > MAX_GENERATION_FILE_BYTES) throw new Error('请选择不超过 16 MiB 的本地 PNG')
    const mine = ++epoch
    pending.value = true
    try {
      const buffer = await file.arrayBuffer()
      if (mine !== epoch) return
      if (buffer.byteLength !== file.size) throw new Error('文件读取长度发生变化，未登记')
      const receipt = await inspectGenerationFile(context, { name: file.name, bytes: new Uint8Array(buffer) })
      if (mine !== epoch) return
      if (!contextMatchesPlan(context, stillCurrent())) throw new Error('项目、来源、规范或需求已经变化，未登记晚到文件')
      const current = group()
      if (current.some((r) => contextMatchesPlan(r.context, plan) && r.context.requirement.id === requirementId && r.file.sha256 === receipt.file.sha256)) throw new Error('同一需求和来源已登记此文件，未重复加入')
      // Validate the complete export budget before committing any new metadata.
      exportGenerationReceipts([...current, receipt])
      receipts.value = [...receipts.value, receipt]
      return receipt
    } catch (cause) {
      if (mine !== epoch) return
      throw cause
    } finally { if (mine === epoch) pending.value = false }
  }
  function exportFor(mode: 'demo' | 'live', projectId: string) { return exportGenerationReceipts(list(mode, projectId)) }
  return { receipts, pending, list, receive, cancelPending, exportFor }
})
