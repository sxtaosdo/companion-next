/** Selection is planning metadata, never a connection or an execution grant. */
export type GenerationSource = 'unselected' | 'comfyui' | 'codex-native'
export const GENERATION_SOURCES: readonly GenerationSource[] = ['unselected', 'comfyui', 'codex-native']
export function generationCapability(source: GenerationSource) {
  const common = { source, automaticExecutionAvailable: false as const, currentPlanOutput: 'none' as const }
  if (source === 'codex-native') return { ...common, label: 'Codex 原生', mode: 'session-handoff' as const, status: '半自动 · 会话生成 / 人工回收', detail: '原生会话已有单次测试通过；本网页没有已验证的自动调用或产物回收接口。导出交接草稿后，在已授权会话生成，再回收文件核验。', dataBoundary: '在原生会话中选定并发送的参考图会交给 OpenAI；此页不上传素材、不读取订阅 token，也不切换到付费 Image API。' }
  if (source === 'comfyui') return { ...common, label: '本地 ComfyUI', mode: 'local-workflow-unverified' as const, status: '本网页未连接 · 工作流协议待核', detail: '现有只读适配器仅查询项目 / Creator 状态，没有 ComfyUI 作业、模型或 GPU 协议。既有本机流程需另行核对，不能从本页状态推断已可执行。', dataBoundary: '拟由本地工作流处理参考图；本页不发送文件或连接任何 ComfyUI 地址。' }
  return { ...common, label: '尚未选择', mode: 'unselected' as const, status: '请选择生成来源', detail: '两条路线共用同一规范、需求、参考裁切、审阅和工程交接条件。选择只保存在计划草稿中。', dataBoundary: '没有上传参考图或提交任务。' }
}
