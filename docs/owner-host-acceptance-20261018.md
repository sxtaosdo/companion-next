# Owner host / AssetDB inventory acceptance — 2026-10-18

The developer backend is **not fully aligned** with the original backend. This slice implements only explicitly approved B+C from [the boundary audit](owner-resource-boundary-audit-20261018.md). Original keyword/history/retry/recycle workflows are not silently enabled in this narrow formal host. Automatic Codex artifact recovery remains excluded.

| Original capability | Current implementation and verified evidence | Remaining boundary |
| --- | --- | --- |
| Owner current state, thumbnail/full preview | Formal32180 cookie routes; process token stays in Node memory. Real original pinned Owner, PNG/thumbnail SHA and browser decode passed on isolated cache. Six deployed static files returned200 with exact hashes. | Isolated task cache only; original user's cache was not switched or written. |
| Persisted current-task selection | Original guarded select, expected task+unique IDs, exact server readback; actual page checkboxes and reconnect restored selection. Separate selection capability; full workflow remains false. | No search/download/import/recycle proxy added. |
| Native directory save + provenance | Original native dialog selected taskTemp; original exporter wrote byte-identical PNG and `.source.json`, verified SHA. Original90s proxy expiration discovered during this real run; fixed to350s around original300s chooser, >91s regression passed. | **Stable successful page receipt not accepted.** Second same-operation test's native chooser never exposed a window before its original300s timeout; no new output. Browser automation could not read the failed response body. No replay/forced kill; handler/busy/unknown returned to zero. |
| Registered-project AssetDB inventory summary | Fixed selected-project `asset.list` → original `createAssetInventorySummary`; no resource rows/approvals. Fixture aggregation and route guards passed. Real registered project68a5dccc481a8588 returned503; actual page showed unavailable without invented zero. | Positive live Bridge summary unverified: Creator/Bridge currently unavailable, Creator was not started. |
| Owner shutdown/cache lease | Existing daemon drain observes actual handlers/busy/worker via private stdio. Python lease-order test and Node EPIPE test passed. Actual guarded stop of18544 also gracefully exited owned Owner21892 before replacement. | Owned20080 remains idle under running daemon25288 by design; no standalone test host remains. |
| Original full Owner workflow in normal Next host | Capability explicitly false; existing original source/UI unchanged. | Search/history/retry/stop/recycle/restore/import are outside approved narrow-host scope and remain disabled here. |
| Codex automatic artifact recovery | Not implemented, no session scan/token extraction/cloud upload. | Excluded from authorization; not counted as aligned. |

## Sources and running identity

- Next implementation `e2367bead5e076c595e95627829c4cd7f3a90778` / internal1.3.173.83, product1.3.173. Later documentation-only checkpoint does not require a static rebuild.
- Host narrow integration `3b35cb9af7f0d22b4f0e25070e85f7602b27ea15`; native-wait correction `6ff44f5574ed2f1b81741e86c3ca1210c6c0085a`.
- Formal loopback32180 Node25 PID25288, runtime SHA256 `35225eb5ddb4d415457a9cad960c8e22d14c4b4a0de321fb8b8aa51adc4af699`.
- CLI SHA256 unchanged `6085072c7c9c7901b1a77d9392785209f9b80c00334a509afd9947f72cde87b8`.
- Current Owner uses explicit process environment (Python, Next bridge root, pinned original root, task-isolated cache). No persistent startup or client configuration was written. A later independently launched daemon needs the same explicit configuration; missing configuration honestly returns OWNER_UNCONFIGURED.

## Verification

Next145 unique focused tests passed, strict types and workspace build passed. New host11 tests passed, including asynchronous stdin failure and save beyond91seconds; final host source plus both new test files passed strict types. Python shutdown/lease-order test passed. Related legacy tests24 passed after using Node25 for its existing SQLite ABI; one existing CLI drain fixture assertion still fails because its fallback reads the real daemon locator instead of only fixturePID123. CLI/source/test hashes were already dirty before this task and are unchanged; no unrelated fix was staged. Final read-only architecture review found no remaining source blocker.

Both deployments reproduced their immediately preceding runtime byte-for-byte before narrow overlays. First baseline0b9c2e28 → cdca2749 changed only http-server/daemon plus Owner/inventory modules. Second cdca2749 →35225eb5 changed only owner-review-host wait budget. Original CLI stop succeeded only after two consecutive all-zero/unknown-empty snapshots. Old process/listener exit was verified before atomic file replacement. Original CLI start/ui restored both original browser tabs, selected tab and realtime; only task-created authentication tabs were closed. Original user's Edge window was preserved.

Original22 dirty paths and every non-overlap hash remain unchanged. Overlapping HTTP/daemon/changelog bytes equal their frozen original working bytes plus task-only transformations. Original Owner source pins, CLI, package and lock are unchanged. No Creator, models, downloads, dependency installs, user-project writes, pushes, releases or cloud uploads.

## Evidence

Evidence directory: `C:/Users/33272/AppData/Local/Temp/companion-owner-host-implementation-20261018`.

- `formal-readback-proof.json`: final identity, six HTTP hashes, real preview, restored selection, actual inventory503/page assertion; no external requests or pagePOSTs.
- `formal-owner-final-readback.png`, `formal-inventory-unavailable.png`: actual deployed page screenshots.
- `real-child-proof.json`: pinned original Owner child, SHA, persisted selection, lease conflict refusal and graceful close.
- `native-output-proof.json` + `native-chooser-export/`: original native dialog PNG/sidecar proof. Original PNG SHA256 `6b905642db196dc7e2ddfa7282485918f06f9e2f418f330c2599ad57af487fb6`.
- `chooser-busy-observation.json`, `live-observation.json`: active chooser remained busy; final Owner counters0/unknown[].
- `verified-build-proof.json`, `save-budget-build-proof.json`: baseline reproduction and approved source closure.
- `save-budget-deploy/`: second all-zero snapshots, guarded stop, old+owned process exit, replacement, start/ui and original-tab/realtime restoration.
- `final-protection.json`: original22 dirty paths/bytes, original Owner pins, package/lock/CLI/static protection.

Do not repeat native save or the96-variant acceptance merely to turn an unverified boundary green. Investigate the original chooser's startup/window availability separately if requested; retain original scope and guards.
