# Workflow knowledge-evidence gate — C-only candidate

## Status and reuse

Standalone exported `verifyWorkflowEvidence(evidence, options)` in workflow-evidence-gate.mjs, Node built-ins only. Matches the existing scripts/task-preflight.mjs model: explicit caller expectations + declared byte/hash checks, fail closed, no discovery/calls/editor actions. The existing execution-checklist remains the workflow authority; this candidate does not replace authorization, scope/HEAD/file-baseline or delivery gates. Root must separately approve/integrate the import/CLI branch into the existing entry. No D file or service was changed here.

33 isolated node:test cases pass, including all four paths and tampering/rejection cases. Initial30 also passed, then three independent expectation-anchor checks were added and the affected33 rerun. tests-final.log is the actual final output. Tests and fixture wire bodies are explicitly **isolated/simulated**, not a successful real knowledge call or activated model.

## Phases and caller contract (independent expectation anchors)

CLI policy must explicitly choose phase `start` or `delivery`, echoed in every result. Start validates the real plan only; adoption.delivery may be null, only plan citations allowed, zero-hit/not-applicable reasons need only appear in plan. Delivery still requires actual plan and delivery files and both-stage adoption/reasons. The both-file/both-stage requirements below describe delivery phase. Pure function callers omitting phase retain the prior strict delivery behavior. A start pass never means task delivery complete.

```js
verifyWorkflowEvidence(evidence, {
  taskId: 'approved-task-id',
  mode: 'isolated', // production only with separately reviewed real capture
  phase: 'start', // CLI policy explicit; final acceptance uses delivery
  applicabilityState: 'applicable', // or not-applicable from task policy
  presetId: 'approved-existing-agent-preset',
  configDigest: '<SHA256 of canonical resolved requested config>',
  collectorSha256: '<reviewed capture/normalization script SHA256>',
  files: new Map([['declared-file-key', Buffer.from(bytes)]])
})
```

Do not copy expectation anchors from the evidence being checked. The actual preflight loader should load only explicitly declared regular files, apply existing size/symlink controls and compare capture script bytes to its separately fixed SHA. This pure module performs no filesystem IO and cannot inspect symlinks or identify which process produced files. `mode: isolated` cannot pass `mode: production`; original wire and normalized records must also match that mode. There is no auto-upgrade, automatic query/retry or automatic not-applicable fallback.

## Evidence top level

All listed evidence keys are required; unknown keys rejected. Phase is an independent caller-policy field, not selected by evidence:

- schemaVersion: workflow-evidence-v1; mode: isolated|production; taskId.
- applicability: {state: applicable|not-applicable, reason: nonempty}. Must match independent task applicability.
- runtime: {model: unverified, role: unverified, reason: nonempty}. `verified: true`/activated claims are rejected. The recorded config represents requested/resolved settings only. Current gate has no supported host role/model activation attestation; this is deliberately not an activation-success gate.
- preset: {id, version: string|null, summary: string|null, source: FileRef, resolvedConfig: FileRef, configDigest}. Version or summary required. source normalized JSON includes id/version/summary/configDigest exactly matching these values. resolvedConfig is the actual parsed requested config JSON; configDigest is SHA256(workflowCanonical(config)), recursively key-sorted. Do not include secrets.
- retrieval: {collectorSha256, request: FileRef, response: FileRef, wireRequest: FileRef, wireResponse: FileRef}.
- adoption: {plan: FileRef, delivery: FileRef, citations: [], zeroHitReason: string|null}.

FileRef = {path: exact caller map key, sha256: lowercase64}; bytes must exist, be nonempty, at most2MiB and exact SHA. No paths are followed by this module.

## Capture wrapper normalized envelope

The real API need not expose synthetic IDs or change its schema. Reviewed capture wrapper retains original non-secret wire request/response bytes, and records these separate normalized JSON artifacts:

Request keys: {schemaVersion: workflow-kb-request-v1, mode, taskId, id: stable request correlation ID, query, presetId, configDigest, wireSha256}.

Response keys: {schemaVersion: workflow-kb-response-v1, mode, taskId, id: stable response correlation ID, requestId, query, status: hit|zero|failed, error: null|string, hits: [], wireSha256}. requestId/query/task/mode/config/preset and wire hashes must match exactly. Wrapper IDs are correlation IDs, **not falsely represented as server-issued IDs**. If upstream provides genuine IDs, wrapper can use them while preserving origin in its capture notes.

Hit keys: {documentId, version: string|null, sha256, content: FileRef}. Every hit must have an exact content SHA even when source has no version; IDs unique. Capture must obtain actual cited bytes from the existing supported endpoint/local authoritative document, never substitute title-only/snippets unless those are explicitly the entire bounded cited document and labeled so. Do not hash a claimed title and call it source contents.

The capture wrapper must faithfully normalize actual wire data; pinning a collector digest and linking bytes is **not cryptographic proof that a real service produced the bytes**. This checker cannot independently reconstruct arbitrary KB adapter semantics, authenticate service identity, verify timestamps or prove internal model causality. Real-call capture and interface mapping review remain separate evidence. Never relabel the isolated fixture real.

## Four outcomes

1. Hit: nonempty hit list, error null. At least one exact hit reference adopted in **both** plan and delivery; citation {stage: plan|delivery, documentId, version, sha256, quote}. Quote must occur in both the exact hit content and the specified hashed plan/delivery file. Retrieval hitCount and adoptedDocuments returned separately; no claim every hit influenced output. Text inclusion proves recorded linkage, not reasoning quality/causality.
2. Zero: empty hits, error null, no fake citations. Nonempty zeroHitReason must occur in both plan and delivery. Returns zero-hit-recorded, not “knowledge found/adopted”. A task that requires nonzero policy evidence must still block at its own task gate.
3. Failed/unavailable: explicit error + empty hits; throws KNOWLEDGE_SERVICE_BLOCKED. Cannot silently degrade to zero or not-applicable.
4. Not-applicable: independently expected and reason in both plan/delivery; preset/retrieval null, no citations/zero reason. Missing/blank reason rejected.

## Verification limits

All samples synthetic; no live KB request, password/token handling, network, dependency installation, new backend, security change, game plan, Creator/GPU action or business development occurred. Gate result intentionally says only captured-byte integrity, correlation and quoted adoption; actual model/role activation remains UNVERIFIED in every returned outcome.

## Existing preflight integration

Use --workflow <absolute evidence JSON> --workflow-policy <independent absolute policy JSON> as a pair. Every --manifest task invocation requires this pair and has no scope-only bypass; policy.taskId must also match the actually verified scope task (explicit mismatch rejected before Git and checked again after verification); pure verifyManifest remains a limited file/HEAD check. Standalone --delivery remains offline artifact validation. The policy loader checks explicit file mappings and actual collector script bytes; no discovery/calls/retries. Policy authority is either manifest-pin to the same already-verified manifest evidence/protected entry or explicit reviewed-caller-policy attribution. The latter attribution is not mechanically authenticated. An unavailable real KB/config blocks actual applicable tasks; passing synthetic fixtures do not unblock them.

At task start use policy.phase=start with real plan evidence; final acceptance uses phase=delivery with actual delivery bytes. The gate does not create fake delivery artifacts to solve pre-task circularity.
