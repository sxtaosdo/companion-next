/** Closed projection of original icon-acceptance.ts. No receipt URL/path or
 * automatic production-pass state is part of this server contract. */
export type AiJobProductAcceptance = {
  state: 'unavailable'; reasonCode: 'ACCEPTANCE_EVIDENCE_UNCONFIRMED'
} | {
  state: 'blocked'; reasonCode: 'UI_TRANSACTION_UNKNOWN'; recordedAt: string; receiptSha256: string; operationId: string
  scene: 'partial'; compile: 'passed'; preview: 'not_run'; build: 'not_run'
  designResolution: { width: 750; height: 1334; verified: false }
} | {
  state: 'owner_manual_passed'; recordedAt: string; receiptSha256: string; operationId: string
  ownerReportedAt: string; sourceMessageId: string; scope: 'import_and_runtime_visibility'; automationState: 'unknown'
}
const invalid = () => new Error('Invalid original acceptance metadata')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
function matches(value: unknown, pattern: RegExp, max: number): string {
  if (typeof value !== 'string' || value.length > max || !pattern.test(value)) throw invalid()
  return value
}
function time(value: unknown): string {
  const result = matches(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, 60)
  if (!Number.isFinite(Date.parse(result))) throw invalid()
  return result
}
export function decodeAiJobProductAcceptance(value: unknown): AiJobProductAcceptance {
  const raw = record(value)
  if (raw.state === 'unavailable' && raw.reasonCode === 'ACCEPTANCE_EVIDENCE_UNCONFIRMED') return { state: 'unavailable', reasonCode: raw.reasonCode }
  const common = { recordedAt: time(raw.recordedAt), receiptSha256: matches(raw.receiptSha256, /^[a-f0-9]{64}$/, 64), operationId: matches(raw.operationId, /^[A-Za-z0-9._:-]{1,200}$/, 200) }
  if (raw.state === 'blocked') {
    const size = record(raw.designResolution)
    if (raw.reasonCode !== 'UI_TRANSACTION_UNKNOWN' || raw.scene !== 'partial' || raw.compile !== 'passed' || raw.preview !== 'not_run'
      || raw.build !== 'not_run' || size.width !== 750 || size.height !== 1334 || size.verified !== false) throw invalid()
    return { state: 'blocked', reasonCode: 'UI_TRANSACTION_UNKNOWN', ...common, scene: 'partial', compile: 'passed', preview: 'not_run', build: 'not_run', designResolution: { width: 750, height: 1334, verified: false } }
  }
  if (raw.state === 'owner_manual_passed' && raw.scope === 'import_and_runtime_visibility' && raw.automationState === 'unknown') {
    return { state: 'owner_manual_passed', ...common, ownerReportedAt: time(raw.ownerReportedAt), sourceMessageId: matches(raw.sourceMessageId, /^Sentinel_[a-f0-9]{32}$/, 41), scope: raw.scope, automationState: raw.automationState }
  }
  throw invalid()
}
