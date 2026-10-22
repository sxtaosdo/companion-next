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
- Integrated regression: 271/271 tests, full vue-tsc exit 0. Handoff focused final regression 141/141. Crop actual Edge canvas fixture 23/23; handoff actual Edge fixture 19/19 (local HTTP, clipboard and Blob interception). Fixtures never count as current-service import success.

## Remaining real acceptance

Current 32180 keeps eight projects and offline_import_only. Its task/adoption lists are empty. Existing generated PNG is retained outside the current store, but enabling the official adoption manifest exposes that source to all registered projects; this separate scope and service-only restart were explicitly approved after initial preflight. Configuration and service loading still require separate verified execution; approval alone is not deployment. No new GPU request is needed. Current-service open/import/PNG/meta/UUID and adding/install full flow remain pending; historical 32181 results are not substitutes.

## Evidence locations

Task evidence root: `C:/Users/33272/Documents/Codex/2026-10-17/task/migration-fixes-20261022/` (integrated report, pointer before/after, current-service preflight). Skill receipt: `../vue-testing-skill-install/installed-receipt.json`. Crop fixture: `../reference-crop-20261022/render-result.json`. Release/HTTP evidence is recorded separately after actual static update; source edits alone are not deployment.
