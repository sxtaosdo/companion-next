# Existing AI job actions, source-only revision 022

## Scope and evidence

This slice restores the existing original-task buttons. It does not add routes, service lifecycle, arbitrary operations, a new generator, batch selection, automatic approval or publication. The frozen 1.3.171 package remains untouched. No live API, model, GPU, Windows host or real browser was used.

Source evidence inspected:

- Original v148 `mcp/src/companion/icon-adapter.ts`: strict request schemas, lines 28–43; export state/selection/SHA recheck, lines 133–149; asynchronous dispatch and original revision/state rules, lines 166–181; response projection, lines 183–209.
- Original `mcp/src/companion/icon-image-assets.ts`: CPU-only variant schema/Pillow pipeline and exact filename/hash/quality receipt, lines 23–30 and 233–251.
- Original `web/src/ai-icons-page.ts`: original action fences, lines 234–247; job buttons, unique selection/import and single default/custom-size flow, lines 279–325 and 390–415.
- The verified v150 handoff establishes that the four original icon modules did not change between v148 and v150. It also separates deployed operations from later source-only documentation.

The facade's complete Python state machine was not available in this workspace. Accordingly, ambiguous effects remain UNKNOWN; this client does not invent rollback, replay, state transitions, generalized recovery or CAS guarantees.

## Restored actions

| Action | Original wire body | Client/UI gate |
| --- | --- | --- |
| run-next | jobId, revision, gpuUseApproved:true | queued/waiting_service; explicitly known generation mode; separate explicit GPU confirmation |
| resume | jobId, revision | unknown/running only; explicit original-task confirmation; no new generation submission |
| select | jobId, revision, selectedIds, approved:true | awaiting_selection/selected; UI keeps original one-candidate workflow; selected candidate must have displayed verified PNG bytes and matching current SHA |
| import | jobId, revision, approved:true | selected with exactly one saved candidate in UI; independent explicit import confirmation |
| export-variant | jobId, revision, candidateId, width, height, allowUpscale, expectedTargetSha256:null, approved:true | selected/imported_pending_verification; exactly one saved candidate and valid sealed v2 snapshot; original default or one custom size; independent upscale consent |

The transport preserves the original strict backend 1–2 candidate schema for compatibility, while the restored UI allows only one candidate. Missing generation mode does not imply permission. Vue's optional Boolean prop has an explicit undefined default, preventing absent mode from silently becoming generation-enabled.

## Frozen consent and original context

Every confirmation binds the full registered project identity (ID/name/path), exact source/reader/writer object identities, jobId, revision, requestHash, sourceRevision, assets, selected candidate hashes, sealed configuration and variant dimensions. Only the original body fields go over the wire; internal consent/context are not serialized. Any context, selection, revision or permitted-stage change cancels approval. A read refresh also cancels an outstanding confirmation.

Candidate proof is held per original context/job/revision and SHA. It is recorded only after the original preview image has fired `load` and the action store independently verifies the PNG and SHA again. Seeing byte-valid pixels is not semantic or Owner approval; the selection confirmation remains separate. Replacing context discards preview proof, and no thumbnail URL is fetched.

All five endpoints are fixed same-origin POST paths, use existing UI cookies, `mode/credentials: same-origin`, `redirect:error`, and no cache. There is no token extraction, global-fetch fallback, URL/path submission, direct Python/Comfy access, background retry, poller, model start or new dependency.

## Dispatch and observed status

`run-next`, `resume` and `import` return a pre-execution snapshot plus dispatchAccepted:true. This is displayed as acceptance only, never completion. After the transport settles, the store makes one same-job status read using the original reader, retaining the same shared lock and project lane through that read and its underlying I/O drainage. It emits `{snapshot, project, source, reader}` using frozen start/read identities; the parent must reject old contexts and regressing revisions. A status read is observation, not proof that this particular client request caused a change.

Selection and variant receipts are independently validated. Variant HTTP envelopes are `companion-icons-v1`; the `companion-icon-variant-v1` schema belongs to the on-disk receipt, not the HTTP result. The client pins the exact original derived filename, source hash, dimensions, upscaled flag and known quality-limit text. Variant export does not import into Creator, change the job state, modify assets/.meta, bind a scene, or establish runtime/production acceptance.

## Cross-tab and UNKNOWN protection

`src/domain/ai-write-coordination.ts` is shared with the enqueue/adopt slice:

- Web Lock: `companion-next:ai-write-v1`, exclusive and ifAvailable; no queued automatic replay.
- localStorage key: `companion-next.ai-write-fences.v1`.
- Exact records: key, projectId, jobId, operation, revision, requestHash, sourceRevision.
- At most 100 records / 64 KiB. Strict shape, identifier/hash/revision constraints, duplicate-key rejection, write readback verification and parse verification.
- Existing actions require positive revision and SHA. Enqueue/adopt use revision 0 and may have unknown compiled requestHash.
- No image bytes, credential/token, project name/path or user text is persisted.
- Missing/denied/corrupt storage or absent Web Locks fails closed for writes; reads remain available. No reset-all operation is exposed.

Mutation requires both writer and jobs reader tracked `waitForIdle` support. Before any write, the shared callback drains the bound reader; missing drain prevents approval; a still-pending or rejected drain after lock acquisition retains both the global lock and project lane, including after context changes/unmount. Rejected pre-write cleanup is labeled not-sent and creates no job UNKNOWN fence. Readback waits for its underlying read cleanup before reconciling any fence or emitting a snapshot. Rejected automatic read cleanup retains both shared locks and the original write marker, including when the returned snapshot itself appears newer; selection/variant receipt fences are cleared only after that cleanup has been confirmed. The callback writes its fence before dispatch and holds both the shared Web Lock and the existing same-Pinia project-operation lane until the provider's transport, outstanding body reads and late body cancellation finish. Timeout, cancellation, page leave, source/provider replacement, and late headers do not free these leases. A cleanup contract rejection retains the lock rather than asserting cleanup completed. Reload preserves UNKNOWN markers; cross-tab coordination is local to cooperating clients and does not replace backend revision/state checks or provide a server transaction/CAS promise.

Only proven pre-effect errors are classified rejected/conflict. Ambiguous backend/schema/transport/write faults retain UNKNOWN; raw diagnostics are not shown. Nothing retries a write automatically.

A fresh same-job/source/request-hash status must have a strictly higher revision before any existing-action marker can be reconciled:

- run-next/resume do not reconcile into queued, waiting_service or import_unknown. An observed unknown/running job can only use the separately confirmed original resume flow.
- select additionally requires selected state.
- import additionally requires both top-level and nested import state imported_pending_verification, effectApplied=true and leaseState=RELEASED. A higher revision, selected state, unknown effect or unknown/retained lease alone cannot clear it.
- export-variant never reconciles from job status because export leaves job state/revision unchanged.
- enqueue/adopt markers are never cleared by the existing-job action reconciler.

Reconciliation does not invent a successful receipt or Creator acceptance. Unchanged/ambiguous evidence keeps the block. The shared creation slice also must refuse new jobs while existing history contains unknown/running/import_unknown, even after original resume becomes available.

## Component integration

`AiJobActionsPanel` accepts project, source, job, reader, optional provider (otherwise integration ref), preview, previewShown, offlineOnly and allowedOperations. The parent owns the read panel, preservation of `job.resourceSnapshot`, generation mode and phase-specific operation list. An absent allowedOperations list preserves all original action choices; an empty list exposes none. Only an explicitly registered writer should mount the action panel.

`readback` carries frozen `AiJobActionReadback`. The parent read store owns status application and candidate-display events. Creation and existing-action writers share the same coordination helper; no second lock namespace or private ledger is used.

## Verification

Direct preinstalled binaries only:

- `node node_modules/vitest/vitest.mjs run tests/ai-job-actions-adapter.test.ts tests/ai-job-actions-store.test.ts tests/ai-job-actions-coordination.test.ts tests/ai-job-actions-ui.test.ts`
- `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`

Focused coverage includes exact five wire shapes, state gates, offline/missing mode, strict data and derived receipts, per-action consent, original single-selection scope, custom/upscaled variants, image-load plus SHA requirement, context/provider/revision/stage invalidation, dispatch-vs-completion, old-context response isolation, status monotonicity, import effect/lease fencing, shared create/action guards, corrupt/denied/oversized ledger, absent/busy Web Locks, ignored aborts, unresolved reads/cancellations and late-body cleanup. No real browser or production pipeline validation is claimed. Parent owns the final aggregate suite/build/commit/package decision.
