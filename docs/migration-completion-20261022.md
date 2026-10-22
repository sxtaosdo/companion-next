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

## Resolved post-import handoff409 — actual32180 verification

Exact original error: HTTP409 `VARIANT_PROVENANCE_UNAVAILABLE`. Export proof binds task revision3; import progressed task to revision6. The old handler reconstructed the receipt with revision6 instead of consulting the exact durable import operation. The fix reuses that original operation/receipt while retaining current task revision, selected candidate/asset, project, request/config/target, file and receipt SHA validation and final snapshot stability. It never rewrites the receipt or replays import.

Shared host commit `d3376a5ca6cad15814c91658b5045f727f63b78f`, product **0.3.145**. 75/75 targeted tests pass, full build-source typecheck exits0; original fixture first demonstrated the revision3/revision6 failure. Both CLI/daemon bundles use existing official esbuild options. Only six installed host files were replaced; static UI stays **1.3.184 / 0b2532e8+working**. Preexisting dirty shared and Next files were preserved, no push.

Official guarded stop passed, operation `3d5ad761-22b3-4ff3-955a-f91b4d3d2066`. Single npm start returned LOCAL_START_FAILED before discovery, but subsequent observation confirmed the same32180 service OPEN, PID3988, backend0.3.145 build `d3376a5ca6ca-902429bc8328`, same eight project IDs, current activity zero, historical UNKNOWN2 retained. No second start, force stop, history deletion, Windows restart or Creator action. Existing Creator PID31024 stayed alive.

Actual original resource UI: continue existing task → prepare Agent/Cocos handoff → select96px exported PNG → correct destination → prepare read-only. HTTP200, verified packet rendered, copy button enabled, no blocked requests or page errors. Wrong destination from the same normal UI rejects HTTP409 `VARIANT_BINDING_MISMATCH`. Separate negative transport test changed only the UI read-only handoff request revision to3; actual host rejects409 `STALE_JOB`. That negative injection is contract evidence, not a normal user-success flow.

The task JSON, exported PNG, imported PNG and meta all retain exact before-test SHA; task remains revision6. Handoff asset SHA `bc7898630727c26da62ee196da99652a6f9b0d2f9b64ba7cfcd5ed6891ff33ce`, receipt SHA `6c1c7c36ae88f3824a5eb9aa77b622451928b5688308969bd47512e0b5dd239e`. No clipboard change, download or Agent dispatch. Packet still reports imported/bound evidence not_proven and runtime not_run; it does not invent scene or runtime proof from file import.

Evidence: `C:/Users/33272/Documents/Codex/2026-10-17/task/handoff409-20261022/` → `targeted-tests-final.json`, `build-evidence.json`, `preflight.json`, `running145.json`, `ui145.json/png`, `ui145-wrong-target.json`, `ui145-stale-revision.json`, `immutable-after.json`. Backup: `before145-installed/`; rollback after a normal guarded stop restores these same six files and uses the original npm start. No package/data recovery is needed now.

Adding setup was not rerun: previous setup completed, final Agent-skip/completion page cannot be resumed from the closed ephemeral page without replay. It remains fixture-verified, not current-service final-page verified. Reference conditioning, scene binding, runtime verification and new generation remain outside this result. The newly approved seven-day/captcha login change is a separate task, not included in this host release.
