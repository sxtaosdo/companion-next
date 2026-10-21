# Version source correction, 2026-10-21

Status: deployed as part of source0973966 / internal checkpoint.200; frontend product1.3.173 is unchanged.

User sees 1.3.173 correctly. package.json.version drives frontendIdentity and the served Next header/sidebar/About/copy payload. VERSION 1.3.173.196 and documentation checkpoint .197 are four-part internal Git records, not user-facing product versions. The prior delivery wording mixed these meanings; this is not evidence of stale browser assets.

Read-only old source inspection: cocos-mcp/web/src/app.ts applyVersion writes the same APP_VERSION to appVersion and aboutVersion; web/scripts/build.mjs substitutes web/package.json.version. In-place served old web/app.js contains APP_VERSION=0.3.142, and about HTML separately declares Bridge protocol0.4.0. These do not establish a backend product version. The user's remembered earlier frontend/backend pair has not been located in this installed old build; do not claim that history was disproven.

The authenticated current /v1/daemon/inflight response includes schemaVersion and identity.nodeVersion but no backend product-version field or version response header. Its schema marker and Node version are not daemon product versions. hostBase0.3.150/Next23 are frontend build inputs; the installed package version0.3.142 is not a verified running-daemon product-version response. No value is inferred from these sources.

Minimal UI correction: sidebar/About explicitly distinguish frontend1.3.173 and backend current-interface-not-provided. About no longer permanently claims backend version was merely not read. Copy text uses the same labels, retaining the original safe support details. No new host API or read/write request is introduced. Real backend numeric version remains unavailable until the host exposes authoritative metadata; this correction must not be reported as restoration of an actual backend version number.

Checkpoint checkpoints/version-semantics-20261021 is 0c7d0ae / .197. Three source files and focused help/About copy assertions are changed. Independent reviewer /root/review_ui_refinement re-read final diff and found no P1/P2; this is a prompt-defined read-only role, not a claimed hard sandbox. No user tab, service restart, inference or real business operation. Screenshot upload has been canceled; no Library investigation or upload will continue.

Candidate browser acceptance also found that the existing tooltip intercepted Enter on the copy icon. Explicit Enter/Space handlers now prevent the tooltip/default action from swallowing copy; real-browser tests use an in-context mock clipboard, never the user clipboard. The initial source198 candidate was not deployed.

Final verification is in model-art-ui-20261021.md: deployed UI labels and mocked Enter/Space copy passed, source198/199 candidates were never independently deployed. The installed original /app.js still serves frontend APP_VERSION0.3.142; that value remains separate from the unavailable daemon product version.
