import type { WorkflowGoal, WorkflowReadSnapshot, WorkflowTask } from '../../domain/workflow-read'
import { displayedTaskState } from '../../domain/workflow-read'

export const workflowSections = [{id:'goals',label:'目标'},{id:'tasks',label:'任务'}] as const
// Legacy links remain readable; only goals/tasks occupy primary navigation.
export type WorkflowSection = 'overview'|'goals'|'specs'|'tasks'|'execution'|'acceptance'|'evidence'
export interface WorkflowTaskFilter { projectId?:string; goalId?:string; milestoneId?:string; state?:string; query?:string }

/** Filter source tasks using declared milestone membership; never infer execution from a mark. */
export function filterWorkflowTasks(snapshot:WorkflowReadSnapshot|null, filter:WorkflowTaskFilter):WorkflowTask[] {
 if(!snapshot)return []
 const goal=filter.goalId?snapshot.goals.find(item=>item.id===filter.goalId):undefined
 const milestone=filter.milestoneId?goal?.milestones.find(item=>item.id===filter.milestoneId):undefined
 if((filter.goalId&&!goal)||(filter.milestoneId&&!milestone))return []
 const query=(filter.query??'').trim().toLocaleLowerCase()
 return snapshot.tasks.filter(task=>(!filter.projectId||task.projectId===filter.projectId)
  &&(!goal||task.goalId===goal.id||!!milestone?.taskIds.includes(task.id))
  &&(!milestone||milestone.taskIds.includes(task.id))
  &&(!filter.state||displayedTaskState(task,snapshot)===filter.state)
  &&(!query||`${task.title}\n${task.id}\n${task.reason??''}`.toLocaleLowerCase().includes(query)))
}
export function goalsForProject(snapshot:WorkflowReadSnapshot|null, projectId:string):WorkflowGoal[] {
 return (snapshot?.goals??[]).filter(goal=>!projectId||goal.projectId===projectId)
}
export function evidenceForProject(snapshot:WorkflowReadSnapshot|null, projectId:string) {
 return (snapshot?.evidence??[]).filter(item=>!projectId||item.projectId===projectId
  ||snapshot?.tasks.some(task=>task.projectId===projectId&&task.evidenceIds.includes(item.id))
  ||snapshot?.goals.some(goal=>goal.projectId===projectId&&goal.milestones.some(m=>m.evidenceIds.includes(item.id))))
}
export function adjacentWorkflowSection(current:WorkflowSection,key:string):WorkflowSection {
 const index=workflowSections.findIndex(item=>item.id===current)
 if(key==='Home')return workflowSections[0].id
 if(key==='End')return workflowSections[workflowSections.length-1].id
 if(key==='ArrowRight')return workflowSections[(index+1)%workflowSections.length].id
 if(key==='ArrowLeft')return workflowSections[(index+workflowSections.length-1)%workflowSections.length].id
 return current
}
