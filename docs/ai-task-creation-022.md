# 022 · Original single-icon inspect / enqueue / adopt slice

## Scope and evidence

This is source-only restoration of the original Companion single-icon form, not a new batch feature or navigation entry. No daemon, Windows, Python facade, GPU, Creator, real project write, network call, build, deployment, or release is demonstrated by this change. The four icon modules are unchanged from the reviewed v148 source through the supplied v150 runtime handoff.

Reviewed self-owned references:

- `v148-host-reference/source/mcp/src/companion/icon-adapter.ts`: request envelopes, browser inspection projection, enqueue/adopt persistence boundary and loose server response identity checks.
- `v148-host-reference/source/mcp/src/companion/icon-resource-config.ts`: R42–46 request schema, binding, server-compiled visualSpec and prompt suffix, sealed capsule identity.
- `v148-reference/source/source/web/src/ai-icons-page.ts`: the original one-name/purpose/prompt form, Advanced technical fields, explicit approval, original run-ID generation, enqueue fences and trusted source selection.
- `v150-formal-contract-handoff-20261015.md`: existing deployed operations and unverified runtime selection boundaries.

The exact selected Python facade source, runtime paths/hashes, installed Pillow and end-to-end execution remain unverified. TS capsule idempotency is not generalized into permission to retry enqueue/adopt.

## Files and host integration

- `src/domain/ai-task-creation.ts`: exact single-asset request construction, strict projection, compiled length budgets, result identity and SHA validation.
- `src/adapters/ai-task-creation.ts`: explicit injected same-origin POST transport for inspect/enqueue/adopt only.
- `src/stores/ai-task-creation.ts`: frozen approval, inspect/recheck/write/readback transaction and original-ID recovery.
- `src/ai-task-creation-integration.ts`: passive provider ref/registration.
- `src/components/AiTaskCreationPanel.vue`: compact original single-icon form.

Panel props:

- `project: { id, name, path } | null`, `source: object | null` from current registered selection.
- Optional `resourceReader`, `jobsReader`, `provider`; an omitted prop uses the respective passive integration ref, while explicit null disables it.
- Optional `active` (defaults true); kept-mounted hidden steps must pass false to revoke approval/epoch and block reads, prepare, submit and recovery while preserving the brief and UNKNOWN identity. Returning requires explicit confirmation again.
- Optional `configDirty`; the parent must derive it only for the same project ID/path/source, never from an unrelated retained editor draft.

Event: `created({ snapshot, project, source, jobsReader, recovered?: true })`. It fires only after original status readback, full identity verification, actual I/O drain, matching own-fence removal and a final context/epoch check. It is evidence of the observed original job, not GPU completion or production acceptance. Recovery events explicitly describe a later observation, not the success time of an earlier lost response.

Only normal-workspace registration is intended; parent integration owns build-mode gating and the existing history-panel handoff. No main/routes/delivery/version files are modified by this slice.

## Exact contract and user flow

1. Nothing reads or writes on mount, registration, project selection or field editing. The user explicitly loads persisted v2 config and jobs HEAD. Missing/invalid/legacy config, draft-only configuration and same-project dirty config cannot authorize creation.
2. The original fields are resource name, purpose and picture description. Advanced exposes asset ID, derived readonly target, readonly saved style and observed config version/hash/HEAD. There is exactly one asset and no batch control.
3. Target is exactly `saved.destination.directory + '/' + assetId + '.png'`. Windows reserved basenames are blocked in addition to the original identifier regex.
4. Trusted existing PNG selection contains only the latest jobs `adoptionSources` IDs. No local bytes, paths, URL, endpoint or executable are accepted. Offline mode cannot enqueue generation.
5. Preparing freezes one original-format run ID: `STUDIO-RUN-icon-${Date.now().toString(36)}-${4 cryptographic random bytes in lowercase hex}`. Repeated prepare does not replace an unchanged prepared identity. Editing revokes approval before sending.
6. A separate per-form checkbox approves the exact frozen one-icon scope. Submit performs inspect first, checks the public `gap: { requiredMissing, blockedExisting, existingTargets }` projection, and rejects all existing targets including REUSABLE. There is no browser `gap.assets` contract.
7. Re-read the saved config and complete jobs view, then compare frozen project/path/source/provider identities, config/hash/version, observed HEAD, source catalog, profile/mode, jobs history and form. Running/unknown/import_unknown history blocks new tasks.
8. Persist and read-verify the shared minimal identity fence before the single enqueue/adopt POST. The POST sends only strict `request`, `resourceBinding: { version, hash, presetId: 'default' }`, `approved: true`, plus catalog `sourceId` for adopt.
9. Verify the receipt and explicitly read the same original job again. Both must match run ID, sourceRevision, asset ID/path, profile and sealed saved config/binding. The exact server-compiled request is reconstructed using sealed reference hashes and the verified original suffix; its SHA-256 must equal job.requestHash. Adopt additionally requires exactly one correctly bound candidate with SHA equal to the frozen trusted catalog SHA.
10. Only after true I/O drain and strict original readback is the exact own fence removed and the parent notified. No import, GPU run, candidate selection, export, service start or auto retry occurs here.

The compiled prompt budget is 4096 characters after the server style/padding suffix. visualSpec is readonly and replaced by the server; its 2000-character compiled budget includes fixed text and all reference path/SHA rows. Reference hashes are sealing evidence, not model image input. Configured opaque export backgrounds do not change the original transparent 1024×1024 generation mother image.

## Shared coordination and UNKNOWN

Uses the actions worker's same Web Lock `companion-next:ai-write-v1` and bounded localStorage ledger `companion-next.ai-write-fences.v1`, plus the existing same-Pinia project-operation lane. The ledger stores only key, project ID, job ID, operation, revision 0, original uncompiled input SHA and sourceRevision. No prompt, user bytes, file paths, names, credential or image is persisted.

Missing Web Locks, unavailable/corrupt storage, readback-mismatched ledger, or missing reader-drain support fail closed. Old read-only providers may still read; both readers and the creation provider must offer `waitForIdle` for the mutation pipeline. Fetch, body read, cancellation, late response disposal and digest work retain transport leases until settled. Writer and both reader drains finish before fence removal; a hanging/rejected cleanup retains the shared lock and project lane instead of falsely freeing capacity.

Any error after dispatch, malformed response, readback failure, source/context change or leaving retains original ID and UNKNOWN fence. No new ID, automatic retry, reset-all or re-enqueue recovery exists.

An explicit “read original task” recovery is available only while the full original frozen request and original provider/source/project binding remain in memory. It acquires the same locks and reads status only; exact request/config/hash/catalog evidence and the exact own ledger record must match. Stale epochs and cross-context replies cannot clear or emit. Returning to the original binding allows another explicit read.

After reload only minimal identity fences remain. Original protected IDs are shown; an uncompiled input hash is never mistaken for the server's compiled requestHash. Without the original frozen evidence, this slice deliberately does not guess or clear the marker. A verified receipt does not imply Preview, Build, scene binding or production acceptance.

## Local verification

Only direct preinstalled Node binaries are used, with deterministic fake providers/transports and no real services:

- `node node_modules/vitest/vitest.mjs run tests/ai-task-creation-domain.test.ts tests/ai-task-creation-adapter.test.ts tests/ai-task-creation-store.test.ts tests/ai-task-creation-ui.test.ts`
- `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`

The focused tests cover strict one-asset schema, reserved targets, saved-config enforcement, compiled budgets, trusted/offline sources, public gap shape and REUSABLE, response/compiled hash identity, existing Cookie transport, all post-dispatch error classes, noncooperative fetch/read/cancel cleanup, explicit UI approval, same/global lane exclusion, cross-context epochs, durable minimal UNKNOWN, scoped original-ID recovery, adversarial sealed/catalog/ledger evidence, reload limitations and missing/hanging/rejected cleanup capabilities.

These are source/fake contract checks, not live acceptance or a full-suite/build claim.
