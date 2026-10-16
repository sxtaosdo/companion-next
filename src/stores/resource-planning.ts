import { parseResourcePlan } from '../domain/resource-plan-import'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project, ProjectSpec } from '../domain/contracts'
import type { GenerationSource } from '../domain/generation-source'
import type { RequirementInput, ResourcePlan } from '../domain/resource-planning'
import { addRequirement, createResourcePlan, planBatch, updateRequirement, removeRequirement, cancelPlannedBatch, selectGenerationSource } from '../domain/resource-planning'
const semanticString = (input: unknown): string => JSON.stringify(input, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
const keyFor = (mode: 'demo' | 'live', projectId: string) => JSON.stringify([mode, projectId])
/** This store is deliberately memory-only. Refresh discards drafts; JSON export is explicit. */
export const useResourcePlanningStore = defineStore('resource-planning', () => {
  const plans = ref<Record<string, ResourcePlan>>({})
  const backups = ref<Record<string, ResourcePlan[]>>({})
  function get(mode: 'demo' | 'live', projectId: string) { return plans.value[keyFor(mode, projectId)] }
  function begin(project: Project, spec: ProjectSpec, mode: 'demo' | 'live', source: 'local-draft' | 'read-only') {
    const key = keyFor(mode, project.id)
    if (plans.value[key]) throw new Error('本项目已有规划草稿，不自动覆盖；可继续编辑或导出')
    plans.value[key] = createResourcePlan(project, spec, mode, source)
  }
  function add(mode: 'demo' | 'live', projectId: string, input: RequirementInput) {
    const key = keyFor(mode, projectId)
    const plan = plans.value[key]
    if (!plan) throw new Error('请先建立规划草稿')
    plans.value[key] = addRequirement(plan, input)
  }
  function batch(mode: 'demo' | 'live', projectId: string, name: string, ids: string[]) {
    const key = keyFor(mode, projectId)
    const plan = plans.value[key]
    if (!plan) throw new Error('请先建立规划草稿')
    plans.value[key] = planBatch(plan, name, ids)
  }
  function edit(mode: 'demo' | 'live', projectId: string, requirementId: string, input: RequirementInput) {
    const key=keyFor(mode,projectId);const plan=plans.value[key];if(!plan)throw new Error('请先建立规划草稿')
    plans.value[key]=updateRequirement(plan,requirementId,input)
  }
  function remove(mode: 'demo' | 'live', projectId: string, requirementId: string) {
    const key=keyFor(mode,projectId);const plan=plans.value[key];if(!plan)throw new Error('请先建立规划草稿')
    plans.value[key]=removeRequirement(plan,requirementId)
  }
  function cancelBatch(mode: 'demo' | 'live', projectId: string, batchId: string) {
    const key=keyFor(mode,projectId);const plan=plans.value[key];if(!plan)throw new Error('请先建立规划草稿')
    plans.value[key]=cancelPlannedBatch(plan,batchId)
  }
  function selectSource(mode: 'demo' | 'live', projectId: string, source: GenerationSource) {
    const key=keyFor(mode,projectId);const plan=plans.value[key];if(!plan)throw new Error('请先建立规划草稿')
    plans.value[key]=selectGenerationSource(plan,source)
  }
  function getBackups(mode: 'demo' | 'live', projectId: string) { return backups.value[keyFor(mode,projectId)]??[] }
  function restore(project: Project, mode: 'demo' | 'live', contents: string, confirmReplace=false) {
    const imported=parseResourcePlan(contents)
    if(imported.scope.projectId!==project.id||imported.scope.mode!==mode||imported.scope.projectName!==project.name)throw new Error('导入计划与当前项目 / 数据模式不匹配')
    const key=keyFor(mode,project.id);const current=plans.value[key]
    if(current){
      if(!confirmReplace)throw new Error('当前已有草稿，请明确确认替换；旧草稿将保留为页面内备份')
      const bindingEqual = semanticString(current.binding) === semanticString(imported.binding)
      if(current.binding.id===imported.binding.id && !bindingEqual)throw new Error('相同规范绑定 ID 不能指向不同快照，未恢复或覆盖草稿')
      const protectedItems=current.requirements.filter((r)=>r.ownerProtected)
      if(protectedItems.length && !bindingEqual)throw new Error('已有 Owner 保护项的规范绑定不能改写或重绑定')
      for(const protectedItem of protectedItems){
        const next=imported.requirements.find((r)=>r.id===protectedItem.id)
        if(!next||semanticString(next)!==semanticString(protectedItem))throw new Error('导入不能移除、改写或解除已有 Owner 保护项')
      }
      const history=backups.value[key]??[]
      if(history.length>=5)throw new Error('页面内备份已达 5 份，请先导出备份，勿继续覆盖')
      backups.value[key]=[...history,JSON.parse(JSON.stringify(current)) as ResourcePlan]
    }
    plans.value[key]=imported
  }
  return { plans, backups, get, begin, add, batch, edit, remove, cancelBatch, selectSource, getBackups, restore }
})
