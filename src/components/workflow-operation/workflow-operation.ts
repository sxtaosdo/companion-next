export type WorkflowBusinessType='game'|'mcp'|'other'
export type WorkflowDeliveryMode='sample'|'source-patch'
export interface WorkflowSourceGrant {policyId:string;policyDigest:string;grantedAt:string}
export interface WorkflowSourcePolicy {id:string;policyDigest:string;files:{id:string;root:string;path:string;sha256:string}[]}
export interface WorkflowPatchPolicy {targetRoot:string;files:{id:string;path:string;sha256:string}[];policyDigest:string}
export interface WorkflowSourcePolicies {patchPolicy?:WorkflowPatchPolicy|null;workflowId:string;revision:number;projectId:string;policies:WorkflowSourcePolicy[];binding:{state:'none'|'static'|'dynamic'|'conflict'|'unverified';files:WorkflowSourcePolicy['files'];policyId?:string;policyDigest?:string;reason?:string}}
/** Frontend projection only. Goal and plan content remain GSD/OpenSpec authority. */
export type WorkflowOperationState='draft'|'planning'|'review'|'ready'|'starting'|'queued'|'running'|'pause-requested'|'paused'|'resuming'|'completed'|'failed'|'unknown'|'accepted'|'abandoned'
export interface SourceBinding<K extends 'gsd'|'openspec'> {source:K;ref:string;digest:string;version:string|null}
export type WorkflowCapability='restricted-readonly-model-output'|'task-directory-workspace-write'
export type WorkflowExecutionScope='technical-sample'|'task-directory'|'unverified'
export interface WorkflowTaskWorkspace {relativePath:string;baselineDigest:string;policyDigest:string}
export interface WorkflowStage {id:string;title:string;outcome:string;taskRefs:{planDigest:string;taskId:string}[]}
export interface WorkflowManagement {revision:number;trashedAt:string|null;stages:WorkflowStage[]}
export interface WorkflowConversation {phase:'planning'|'execution';requestId:string|null;threadId:string|null;turnId:string|null;lastKnownState:WorkflowOperationState;observedAt:string|null}
export interface WorkflowRun {selectedTaskId?:string;conversation?:WorkflowConversation;capability?:WorkflowCapability|'unverified';scope?:WorkflowExecutionScope;taskWorkspace?:WorkflowTaskWorkspace;id:string;operationId:string;planDigest:string;goalDigest:string;state:WorkflowOperationState;executionId:string|null;lastObservedAt:string|null;reason?:string;logRefs:string[];evidenceRefs:string[];acceptance:null|{planDigest:string;goalDigest:string;evidenceDigests:string[];acceptedAt:string;reviewNote?:string;patchInspection?:SourcePatchInspection;scope?:'technical-sample'|'task-directory'}}
export interface IndependentChannel {state:'independent-unverified';channelId:string;newGoalId:string;originalOperationId:string;activity:'unverified';outcome:'not-accepted';resourceGuard:'quarantined';directoryRelativePath:string;at:string}
export interface IndependentContinuation {state:'continued-unverified';channelId:string;priorGoalId:string;newGoalId:string;activity:'unverified';resourceGuard:'quarantined';at:string}
export interface ContinueChannelInput {operationId:string;expectedAnchorRevision:number;expectedChildRevision:number;priorGoalId:string;priorChannelId:string;confirmation:'CONTINUE_KEEP_OLD_UNVERIFIED';protocol:'CONTINUATION_INTENT_V2';title:string;description:string;projectId:string}
export interface IndependentChannelInput {operationId:string;expectedRevision:number;originalOperationId:string;confirmation:'OPEN_INDEPENDENT_KEEP_OLD_UNVERIFIED';title:string;description:string;projectId:string}
export interface IndependentChannelResult {channel:IndependentChannel;record:WorkflowOperationRecord}
export interface FinishedDisposition {state:'ended-unaccepted';dispositionId:string;originalOperationId:string;executionId:string;directoryRelativePath:string;resourceGuard:'quarantined';at:string}
export interface FinishUnacceptedInput {operationId:string;expectedRevision:number;originalOperationId:string;confirmation:'END_UNACCEPTED_KEEP_EVIDENCE'}
export interface WorkflowTracking {state:'detached-by-user';outcome:'unknown';resourceGuard:'quarantined';dispositionId:string;originalOperationId:string;at:string;directoryRelativePath:string;lateObservationCount:number}
export interface StopTrackingInput {operationId:string;expectedRevision:number;originalOperationId:string;confirmation:'STOP_TRACKING_KEEP_UNKNOWN'}
export interface WorkflowOperationRecord {management?:WorkflowManagement;createdAt?:string;updatedAt?:string;sourceGrant?:WorkflowSourceGrant;deliveryMode?:WorkflowDeliveryMode;businessType?:WorkflowBusinessType;planningConversation?:WorkflowConversation;independentContinuation?:IndependentContinuation;independentChannel?:IndependentChannel;finishedDisposition?:FinishedDisposition;tracking?:WorkflowTracking;capability?:WorkflowCapability;schemaVersion:'workflow-operation-v1';id:string;revision:number;projectId?:string;goal:SourceBinding<'gsd'>;plan:SourceBinding<'openspec'>|null;state:WorkflowOperationState;review:null|{planDigest:string;goalDigest:string;reviewedAt:string;patchPolicyDigest?:string;readiness?:ReviewReadiness};activeRunId:string|null;runs:WorkflowRun[];presentation?:{title:string;description?:string;planText?:string}}
export interface SourcePatchInspection {schemaVersion:'workflow-source-patch-inspection-v1';workflowId:string;goalDigest:string;planDigest:string;runId:string;sourceFingerprint:string;policyDigest:string;patchDigest:string;descriptionDigest:string;reportDigest:string;taskFilesDigest:string;terminalEvidenceDigest:string;observedAt:string;state:'passed';validity:'point-in-time';activity:'unverified';tests:'not-verified';applied:'unverified';accepted:false}
export interface ExecutionRead {record:WorkflowOperationRecord;logs?:{ref:string;digest:string;summary?:string;at?:string}[];evidence?:{ref:string;digest:string;kind:string;state:string;summary?:string}[]}
export interface PreparationRead {operationId:string;state:'pending'|'settled'|'unknown';scope:'technical-sample';evidence:{sourceFingerprint?:string|null;patchPolicyDigest?:string;workflowId:string;operationId:string;phase:'plan'|'start'|'resume';goalDigest:string;planDigest:string|null;status:'ready';evidenceRef:string;roles:{id:string;configDigest:string;mode:'read'|'prompt'|'native';evidenceRef:string}[];kb:{status:'hit'|'zero-hit';requestId:string;responseId:string;queryDigest:string;documents:{id:string;version:string|null;digest:string}[]};knowledgeUse:'retrieved-and-linked-not-model-adoption'}}
export type WorkflowApprovalState='pending'|'responding'|'resolved'|'expired'|'disconnected'|'unknown'
export interface WorkflowApproval {id:string;version:number;approvalDigest:string;state:WorkflowApprovalState;kind:'command'|'fileChange';summary:string;display:{command?:string;relativePaths?:string[]};expiresAt:string;threadId:string;turnId:string;itemId:string;connectionId:string;canRespond:boolean}
export interface ApprovalRead {workflowId:string;capability:'disabled'|'restricted-single-use-approval';enabled:boolean;scope:'technical-sample'|'task-directory';observedAt:string;approvals:WorkflowApproval[]}
export interface ApprovalDecision {operationId:string;approvalId:string;expectedVersion:number;approvalDigest:string;decision:'accept'|'decline'}
export interface ReviewReadiness {id:string;ref:string;digest:string;version:'1';ownerScope:string;workflowId:string;goalDigest:string;goalVersion:string|null;planDigest:string;selectedTaskId:string;expiresAt:string;actor:{kind:'authenticated-principal'|'isolated-control-harness';principalDigest:string}}
export interface WorkflowDeliveryPreview {schemaVersion:'workflow-delivery-preview-v1';workflowId:string;goalDigest:string;planDigest:string;runId:string;sourceFingerprint:string;policyDigest:string;patchDigest:string;descriptionDigest:string;reportDigest:string;taskFilesDigest:string;terminalEvidenceDigest:string;targetRoot:string;files:{path:string;baselineDigest:string}[];previewDigest:string;patch:string;observedAt:string;activity:'unverified';tests:'not-verified';applied:'unverified'}
export interface WorkflowDeliveryStatus {schemaVersion:'workflow-delivery-status-v1';workflowId:string;operationId:string;state:'not-applied'|'applied'|'partial'|'unknown'|'rolled-back';observedDigest:string|null;files:{path:string;baselineDigest:string;appliedDigest:string;currentDigest:string;state:'baseline'|'applied'|'changed'}[];observedAt:string;tests:'not-verified'}
export interface WorkflowDeliveryValidation {schemaVersion:'workflow-delivery-validation-v1';workflowId:string;operationId:string;applyOperationId:string;state:'passed'|'failed'|'unknown';checks:{id:'unit-test'|'typecheck'|'build';state:'passed'|'failed'|'not-run';exitCode:number|null;output?:string;truncated?:boolean}[];observedDigest:string;startedAt:string;completedAt:string|null;nodeVersion?:string;executableSha256?:string}
export interface WorkflowArtNeed {needId:string;name:string;needDigest:string;status:'unverified'}
export interface WorkflowArtNeeds {schemaVersion:'workflow-art-needs-v1';workflowId:string;projectId:string;resourceDomainId:null|'ant'|'cook';workbenchHash:string|null;needs:WorkflowArtNeed[]}
export interface WorkflowArtLink {planDigest:string;taskId:string;artProjectId:string;resourceDomainId:null|'ant'|'cook';needId:string;workbenchHash:string;needDigest:string;state:'current'|'stale'|'unavailable';needName?:string|null}
export interface WorkflowArtLinks {schemaVersion:'workflow-art-links-v1';workflowId:string;revision:number;links:WorkflowArtLink[]}
export interface WorkflowArtLinkInput {operationId:string;expectedRevision:number;planDigest:string;taskId:string;artProjectId:string;resourceDomainId:null|'ant'|'cook';needId:string;workbenchHash:string;needDigest:string}
export interface WorkflowPlanTask {taskId:string;text:string;digest:string;runId:string|null;executionState:'not-started'|'unknown'|'starting'|'queued'|'running'|'pause-requested'|'paused'|'resuming'|'completed'|'failed'|'accepted';acceptance:'accepted'|'not-accepted'|'unknown';acceptanceScope?:'task-directory'|'technical-sample'|'unverified'}
export interface WorkflowPlanTasks {schemaVersion:'workflow-plan-tasks-v1';workflowId:string;planDigest:string|null;summary:string|null;tasks:WorkflowPlanTask[];unboundRuns:boolean;readiness:'fresh'|'stale'|'missing'|'unavailable'}
export interface ReadinessTask {id:string;text:string;digest:string;artifactDigest:string;requiredDependencies:string[]|null}
export interface ReadinessSource {id:string;label:string;taskId:string|null;digest:string;expiresAt:string|null;resolves:string[];remaining:string[];status:'verified'|'blocked';reason:string|null}
export interface ReadinessCatalogue {schemaVersion:'workflow-readiness-catalogue-v1';workflowId:string;goalDigest:string;goalVersion:string|null;planDigest:string|null;availability:'configured'|'unconfigured';tasks:ReadinessTask[];sources:ReadinessSource[];current:ReviewReadiness|null;currentStatus:'missing'|'fresh'|'stale'}
export interface ReviewCommand extends CommandEnvelope {selectedTaskId:string;sourceIds:string[];note:string;patchPolicyDigest?:string}
export interface CommandEnvelope {operationId:string;expectedRevision:number;planDigest?:string}
export interface OperationRead {operationId:string;workflowId:string|null;state:'pending'|'settled'|'unknown'|'not-observed'|'rejected';outcome?:'not-dispatched'|'not-applied';code?:string;record?:WorkflowOperationRecord;result?:{workflowId:string;purged:true;operationId:string}}
export interface RecoveryPreflight {schemaVersion:'workflow-recovery-preflight-v1';workflowId:string;revision:number;originalOperationId:string|null;scope:'local-records-only';observedAt:string;canAbandon:false;canRequestVerification:boolean;checks:{id:string;status:'recorded'|'missing'|'unverified';message:string}[];readError:string|null;sourceDigests:{executor:string;events:string}|null}
export interface OriginalSettlementInput {operationId:string;originalOperationId:string;priorGoalId:string;priorChannelId:string;expectedAnchorRevision:number;expectedChildRevision:number;expectedRecordSetDigest:string;confirmation:'KEEP_ORIGINAL_UNKNOWN_NO_REPLAY'}
export interface OriginalSettlementReceipt {kind:'original-barrier-unresolved';workflowId:string;operationId:string;originalOperationId:string;priorGoalId:string;priorChannelId:string;fromRevision:number;childRevision:number;recordSetDigest:string;requestDigest:string;runtimeEvidenceDigest:string;outcome:'unknown';replay:'prohibited';resourceGuard:'quarantined';at:string;digest:string}
export interface LostBarrierPreview {anchorId:string;priorGoalId:string;anchorRevision:number;childRevision:number;recordSetDigest:string}
export interface LostBarrier {operationId:string;workflowId:string;priorGoalId:string;priorChannelId:string;fromRevision:number;childRevision:number;recordSetDigest:string;outcome:'unknown';requestId:'lost';replay:'prohibited';resourceGuard:'quarantined';digest:string}
export interface LostBarrierInput {operationId:string;expectedAnchorRevision:number;expectedChildRevision:number;priorGoalId:string;priorChannelId:string;expectedRecordSetDigest:string;confirmation:'RECORD_UNKNOWN_DO_NOT_REPLAY'}
export interface ContinuationIntent {operationId:string;anchorId:string;priorGoalId:string;priorChannelId:string;projectId:string;expectedAnchorRevision:number;expectedChildRevision:number;state:'pending'|'unknown'|'rejected'|'settled';at:string;code?:string}
export interface WorkflowOperationProvider {
 listRequestIngress?(id:string):Promise<{workflowId:string;operationId:string;state:'pending'|'settled'|'rejected'|'unknown';kind:string;code?:string}[]>;
 readRequestIngress?(id:string,operationId:string):Promise<{state:'pending'|'settled'|'rejected'|'unknown'|'not-observed';kind?:string;code?:string}>;
 readIngressProof?(id:string,operationId:string):Promise<{schemaVersion:'workflow-ingress-proof-v1';workflowId:string;operationId:string;state:'pending'|'settled'|'rejected'|'unknown'|'not-observed';kind:'delivery-mode'|'source-grant'|null;requestDigest:string|null;code?:string}>;
 listContinuationIntents?(id:string):Promise<ContinuationIntent[]>;
 readBarrierIntent?(id:string,operationId:string):Promise<{state:'pending'|'unknown'|'rejected'|'settled'|'not-observed';code?:string}>;
 readLostBarrierPreview?(id:string,childId:string):Promise<LostBarrierPreview>;
 settleOriginalBarrierUnknown?(id:string,input:OriginalSettlementInput):Promise<OriginalSettlementReceipt>;
 reconcilePrewriteFailure?(id:string,input:OriginalSettlementInput):Promise<{workflowId:string;operationId:string;state:'confirmed-before-write';revision:number}>;
  reconcileAdvancePrewriteFailure?:(id:string,input:{operationId:string;priorGoalId:string;priorChannelId:string;expectedAnchorRevision:number;expectedChildRevision:number;expectedRecordSetDigest:string;confirmation:'CONFIRM_ADVANCE_PREWRITE_KEEP_UNKNOWN'})=>Promise<{workflowId:string;operationId:string;state:'confirmed-before-write';revision:number}>
  readAdvancePrewriteResolution?:(id:string,op:string)=>Promise<{workflowId:string;operationId:string;state:'confirmed-before-write'|'not-observed';revision:number}>
 readPrewriteResolution?(id:string,operationId:string):Promise<{workflowId:string;operationId:string;state:'confirmed-before-write'|'not-observed';revision:number}>;
 recordLostBarrier?(id:string,input:LostBarrierInput):Promise<{barrier:LostBarrier;record:WorkflowOperationRecord}>;
 readLostBarrier?(id:string,operationId:string):Promise<{state:'recorded'|'not-observed';barrier:LostBarrier|null}>;
 stopTracking?(id:string,input:StopTrackingInput):Promise<WorkflowOperationRecord>;
 finishUnaccepted?(id:string,input:FinishUnacceptedInput):Promise<WorkflowOperationRecord>;
 createIndependentChannelGoal?(id:string,input:IndependentChannelInput):Promise<IndependentChannelResult>;
 advanceIndependentChannel?(id:string,input:ContinueChannelInput):Promise<{continuation:IndependentContinuation;record:WorkflowOperationRecord}>;
 readRecoveryPreflight?(id:string):Promise<RecoveryPreflight>;
 recoverPlanningTransport?(id:string,input:{operationId:string;expectedRevision:number}):Promise<{schemaVersion:'planning-restart-recovery-result-v1';workflowId:string;originalOperationId:string;state:'verified';meaning:'original-local-transport-ended-by-system-restart';originalEOFClaimed:false}>;
 abandonBeforeTurn?(id:string,input:{operationId:string;expectedRevision:number}):Promise<WorkflowOperationRecord>;
 list():Promise<WorkflowOperationRecord[]>;
 createGoal(input:{title:string;description:string;projectId?:string;businessType?:WorkflowBusinessType;deliveryMode?:WorkflowDeliveryMode;operationId:string}):Promise<WorkflowOperationRecord>;
 getGoal(id:string):Promise<WorkflowOperationRecord>;
 updateStages?(id:string,input:{operationId:string;expectedRevision:number;stages:WorkflowStage[]}):Promise<WorkflowOperationRecord>;
 trashGoal?(id:string,input:{operationId:string;expectedRevision:number}):Promise<WorkflowOperationRecord>;
 restoreGoal?(id:string,input:{operationId:string;expectedRevision:number}):Promise<WorkflowOperationRecord>;
 purgeGoal?(id:string,input:{operationId:string;expectedRevision:number}):Promise<{workflowId:string;purged:true;operationId:string}>;
 changeDeliveryMode?(id:string,input:{operationId:string;expectedRevision:number;deliveryMode:WorkflowDeliveryMode}):Promise<WorkflowOperationRecord>;
 readSourcePolicies?(id:string):Promise<WorkflowSourcePolicies>;
 grantSourcePolicy?(id:string,input:{operationId:string;expectedRevision:number;policyId:string;policyDigest:string}):Promise<WorkflowOperationRecord>;
 generatePlan(id:string,command:CommandEnvelope):Promise<WorkflowOperationRecord>;
 reviewPlan(id:string,command:ReviewCommand):Promise<WorkflowOperationRecord>;
 start(id:string,command:CommandEnvelope):Promise<WorkflowOperationRecord>;
 readSourcePatchInspection?(id:string):Promise<SourcePatchInspection>;
 readExecution(id:string):Promise<ExecutionRead>;
 readArtNeeds?(id:string,projectId:string,domain:'shared'|'ant'|'cook'):Promise<WorkflowArtNeeds>;
 readArtLinks?(id:string):Promise<WorkflowArtLinks>;
 createArtLink?(id:string,input:WorkflowArtLinkInput):Promise<WorkflowArtLinks>;
 readDeliveryValidation?(id:string,operationId:string):Promise<WorkflowDeliveryValidation>;
 validateDelivery?(id:string,input:{operationId:string;applyOperationId:string;observedDigest:string;confirmation:'RUN_FIXED_VALIDATION'}):Promise<WorkflowDeliveryValidation>;
 readDeliveryPreview?(id:string):Promise<WorkflowDeliveryPreview>;
 readDeliveryStatus?(id:string,applyOperationId:string):Promise<WorkflowDeliveryStatus>;
 applyDelivery?(id:string,input:{operationId:string;previewDigest:string;confirmation:'APPLY_REVIEWED_PATCH'}):Promise<WorkflowDeliveryStatus>;
 continueDelivery?(id:string,input:{operationId:string;applyOperationId:string;observedDigest:string;confirmation:'CONTINUE_REVIEWED_PATCH'}):Promise<WorkflowDeliveryStatus>;
 rollbackDelivery?(id:string,input:{operationId:string;applyOperationId:string;observedDigest:string;confirmation:'ROLLBACK_REVIEWED_PATCH'}):Promise<WorkflowDeliveryStatus>;
 readPlanTasks?(id:string):Promise<WorkflowPlanTasks>;
 readReadiness?(id:string):Promise<ReadinessCatalogue>;
 readPreparation?(id:string):Promise<PreparationRead[]>;
 readApprovals?(id:string):Promise<ApprovalRead>;
 decideApproval?(id:string,decision:ApprovalDecision):Promise<WorkflowOperationRecord>;
 requestPause(id:string,command:CommandEnvelope):Promise<WorkflowOperationRecord>;
 resume(id:string,command:CommandEnvelope):Promise<WorkflowOperationRecord>;
 accept(id:string,command:CommandEnvelope&{evidenceDigests:string[];note:string}):Promise<WorkflowOperationRecord>;
 getOperation(operationId:string,workflowId?:string):Promise<OperationRead>;
}
export const operationLabels:Record<WorkflowOperationState,string>={draft:'目标已保存',planning:'计划生成中',review:'计划待审阅',ready:'已审阅，待启动',starting:'启动已受理，待确认',queued:'执行已排队',running:'执行中','pause-requested':'已请求安全边界暂停',paused:'已暂停',resuming:'恢复已受理，待确认',completed:'执行结束，待验收',failed:'失败',unknown:'结果未知，待核对',abandoned:'已放弃（未派发回合）',accepted:'已验收（按执行范围）'}
export function activeRun(record:WorkflowOperationRecord){return record.runs.find(run=>run.id===record.activeRunId)}
export function displayedState(record:WorkflowOperationRecord):WorkflowOperationState {
 if(record.state==='accepted'&&!['technical-sample','task-directory'].includes(verifiedAcceptanceScope(record)))return 'unknown'
 if(['running','queued'].includes(record.state)&&!activeRun(record)?.executionId)return 'unknown'
 return record.state
}

/** Top-level capability is configuration only; a formal run needs its own task binding. */
export function taskDirectoryRun(record:WorkflowOperationRecord):WorkflowRun|undefined {
 const run=activeRun(record),workspace=run?.taskWorkspace
 return run?.capability==='task-directory-workspace-write'&&run.scope==='task-directory'&&workspace
  &&workspace.relativePath===`.companion/tasks/${record.id}`&&/^[a-zA-Z0-9_-]+$/.test(record.id)
  &&/^[a-f0-9]{64}$/i.test(workspace.baselineDigest)&&/^[a-f0-9]{64}$/i.test(workspace.policyDigest)?run:undefined
}
export function verifiedAcceptanceScope(record:WorkflowOperationRecord):WorkflowExecutionScope {
 const run=activeRun(record)
 if(!run?.acceptance||!run.executionId||run.acceptance.goalDigest!==run.goalDigest||run.acceptance.planDigest!==run.planDigest||record.goal.digest!==run.goalDigest||record.plan?.digest!==run.planDigest)return 'unverified'
 if(run.acceptance.scope==='technical-sample'&&run.capability==='restricted-readonly-model-output')return 'technical-sample'
 if(run?.acceptance?.scope==='task-directory'&&taskDirectoryRun(record))return 'task-directory'
 return 'unverified'
}
export function workflowOperationLabel(record:WorkflowOperationRecord):string {
 const state=displayedState(record)
 return state!=='accepted'?operationLabels[state]:verifiedAcceptanceScope(record)==='task-directory'?'任务目录已验收（非游戏验收）':'技术样例已验收（非业务/游戏验收）'
}
export function reviewMatches(record:WorkflowOperationRecord){return !!record.plan&&record.review?.planDigest===record.plan.digest&&record.review?.goalDigest===record.goal.digest}
export function canStart(record:WorkflowOperationRecord){return record.state==='ready'&&reviewMatches(record)}
/** Only an explicit rejected receipt proves non-execution. Generic failures remain unknown. */
export class WorkflowCommandError extends Error {constructor(readonly outcome:'rejected'|'unknown',readonly reason:string,readonly code?:string,readonly httpStatus?:number){super(reason);this.name='WorkflowCommandError'}}
