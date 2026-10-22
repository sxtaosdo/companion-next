# Approved migration completion — 2026-10-22

## Authority and scope

Use [source and reuse policy](source-and-reuse-policy.md), [34-item audit](whole-migration-audit-20261022.md) and [OpenSpec change](../openspec/changes/complete-approved-companion-migration/proposal.md). This records the user-approved missing behavior; the audit remains the authoritative complete matrix. No extra backend or automatic model/Creator actions.

## Tool delivery

- Vue testing Skill: `C:/Users/33272/.codex/skills/vue-testing-best-practices`, declared 1.0.0; official source `https://github.com/vuejs-ai/skills`, commit `f5d4b3b869bb8a86ddfea148196f7db64aeefeab`. All 12 Markdown files match source Git blobs; 11 local references exist. User-level document install only; current-session loading is not asserted.
- OpenSpec: official `@fission-ai/openspec@1.14.3` from npm registry, installed with lifecycle scripts disabled at `D:/CompanionTools/openspec`. Official sources: https://github.com/Fission-AI/OpenSpec and https://openspec.dev/docs/setup . Version verified. Package integrity: `sha512-ALFW1d5bSm6t27Kmcle93SDFuqUc8fLwy5ZdBfIiNffo0Yk9AEOJxw6xDqBv38eMM7l7TeOZBB/7C08luxYGfg==`.
- Project initialized for Codex only, six local skill workflows under `.agents/skills`; original AGENTS and policy preserved. Telemetry/update check disabled for invocation. No model, service, credential, system PATH or app dependencies changed.
- Existing cloud-provided webapp-testing / verification-before-completion / systematic-debugging were found in the session catalog, not duplicated into the Windows user skill root.
- Fixed change `complete-approved-companion-migration` maps all 34 audit rows to approved requirements/tasks/evidence. Strict OpenSpec validation passes; document validation is not business acceptance. Incomplete real E2E remains unchecked.

## Implementation and verification

- Completion prompt requires a matching complete registration receipt, operation and exact project identity; clipboard remains an explicit local action.
- Handoff uses the existing host route and validates task/candidate/revision/hash/target. It supports local copy and original JSON download; no automatic Agent dispatch or Creator call. UNKNOWN does not replay.
- Crop reuses the old canvas/ROI implementation and original save/status routes with deterministic cropId. Context changes discard stale replies. Saving a crop does not claim reference conditioning or automatically edit project specification references.
- Referenced-preset deletion uses the old `confirm=true` capability only after explicit affected-project confirmation. Ordinary deletion never silently upgrades after 409. No actual user preset has been deleted.
- Project hover actions covered Creator start: a real normal click timed out with zero start requests. CSS reserves the primary button and uses existing static actions on narrow screens; hit tests pass at 1440/1280/900/390.
- Integrated regression: 271/271 tests, full vue-tsc exit 0. Handoff focused final regression 141/141. Crop actual Edge canvas fixture 23/23; completion/preset actual Edge fixture 28/28; handoff actual Edge fixture 19/19 (local HTTP, clipboard and Blob interception). Fixtures never count as current-service import success.

## Actual current-service delivery

Frontend **1.3.184**, build **0b2532e8+working**, served at the original 32180; backend **0.3.144**, PID **31776**, epoch **9dbf1a79-01c2-4e29-bf0e-e0dd34d2ce06**, OPEN. Static backup has 122 files. Seven emitted files matched destination and authenticated HTTP SHA; 31 actual-page checks passed. The only preexisting user modification `docs/web-account-login-20261022.md` remains unstaged.

The approved fixed one-image catalog is loaded, still offline_import_only. Old PID28744 stopped using the official guarded daemon stop (operation ac4022e1-b2a7-4e84-ba7f-e635ee1d87fa); no force kill, history deletion or Windows restart. Ordinary npm startup returned LOCAL_START_FAILED, but only observation established PID31776 OPEN; no second start was issued. The generic error wrapper discarded the original exception, so its exact cause is unknown, not assumed to be generation contention.

Current 32180 real UI evidence:

- Project-page start button opened existing e2e-project; Creator3.8.8 PID31024, Bridge ready/authoring.
- Three-step art-spec dialog saved once; spec v2 SHA `6e50038a779f8fc4d1853cd904768bfe0ce3450e3123e0046ab9836ada944706` matches API and disk. No formal project spec was changed.
- Existing approved mother PNG adopted once by UI: job `STUDIO-RUN-icon-mvjaubwj-6a259b0c`, candidate `CANDIDATE-acceptance-blue-crystal-20261022-adopt-1`. No new GPU request. An over-restrictive test route initially blocked status POST; it was a harness error, not a failed adoption, and adoption was not resubmitted.
- Actual UI preview SHA, explicit selection, 96px CPU export, variant import and original-status readback succeeded. Export was explicitly re-observed once after test-browser teardown lost the in-memory receipt: created:false, same image/receipt SHA, no overwrite.
- Import operation `icon-import-a8938c1fde760f0a0a8f1de81538d802`: imported_pending_verification, effectApplied:true, active:false, lease RELEASED; asset_import / asset_get_info / asset_resolve_reference all PASSED. Disk PNG96x96 RGBA SHA `bc7898630727c26da62ee196da99652a6f9b0d2f9b64ba7cfcd5ed6891ff33ce`; meta asset UUID `0a3df2e3-4f29-444e-978d-683d31a90677`, SpriteFrame `0a3df2e3-4f29-444e-978d-683d31a90677@f9941`.
- Existing-path add wizard submitted setup `7dd8f6e2-7354-475a-be9b-2dc8c2c0c9f8`, effective startCreator:true/configureCodex:false. Actual task readback complete, Bridge current0.3.138, same Creator ready, eight exact registrations retained. Agent configuration was not submitted. The test failed to locate the next Agent-skip button and closed its own headless page; final completion prompt is therefore verified by the 28-case real-render fixture, not this current-service final page. Do not repeat completed setup merely to manufacture evidence.

Still not claimed: scene/prefab binding, Preview/Build/runtime production verification, fresh model generation, UI/character generation, reference conditioning, actual user-preset deletion, real user clipboard/Agent dispatch. Crop receipt does not automatically edit saved reference lists. No 32181 or extra visible browser window was created.

## Evidence locations

Task evidence root: `C:/Users/33272/Documents/Codex/2026-10-17/task/migration-fixes-20261022/` (integrated report, pointer before/after, current-service preflight). Skill receipt: `../vue-testing-skill-install/installed-receipt.json`. Crop fixture: `../reference-crop-20261022/render-result.json`. Release/HTTP evidence is recorded separately after actual static update; source edits alone are not deployment.

Browser rendering found a 375px overflow in the existing UNKNOWN preset manual-check checkbox. The shared panel checkbox wrapping now covers that section; actual Edge recheck passed. These checks use isolated responses and do not delete presets or operate Creator.

## Remaining host handoff defect

An additional actual UI prepare-handoff attempt for the imported variant returned HTTP409. Request was bound to the same project/job/candidate, current task revision6 and96px SHA. Browser response-body capture was unavailable; exact business error code is not established. Read-only source review suggests a revision mismatch: export receipt binds revision3, after import status is revision6, but handoff calls readVariant with the current revision. This is a hypothesis with code evidence, not a verified error-code diagnosis.

The initial repeat attempt was rejected by automatic approval review because original outcome/idempotency was not established; it did not execute. Full handler/readVariant inspection proved the route only reads task/candidate/config/receipts and constructs JSON, and the compiled running daemon contains the branch. A single evidence-backed retry was approved and confirmed409. No Agent dispatch, scene binding, new Creator operation or data write resulted.

Do not mark actual post-import variant handoff acceptance complete. Recommended smallest follow-up: preserve current task identity/revision checks, verify the original export receipt binding through durable imported-artifact evidence, and keep all candidate/source/config/target/SHA checks; then test and normally update only the same service. Do not fake current revision into an old receipt, relax hash checks, or redo generation/import to hide it. Current static UI delivery and real PNG/meta/UUID import evidence remain valid. Startup error detail loss is also documented, not silently labelled fixed.
