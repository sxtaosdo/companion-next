# Precise proposed confirmation — existing reader, Next metadata-only validation

This is a proposed approval scope, not an executed operation. No credentials were read, supplied or transmitted during this audit.

## Human-readable confirmation text

Allow controlled local reuse of the EXISTING ID3 reader shidai3-cli-pilot-retrieve-recovery-20261008, tenant1, only shidai3-pilot KB da1051a5-3fff-4198-ba55-017ea79df9c3, retrieve capability, full_access=false, expiry 2026-11-08 01:25:46 UTC (09:25:46 Beijing). Target remains only the existing local WeKnora service http://127.0.0.1:8081. Do not create/renew a key, widen its scope, change security settings, or save a new credential/profile.

First validate that reader's current identity/scope/expiry with its original metadata endpoint only. If valid, coordinate a quiet maintenance window for the shared Companion daemon on32180, use its guarded stop/start mechanism, and supply this reader to the new daemon process through WEKNORA_API_KEY. Validate only Next's single permitted KB list and that KB's bounded metadata; no document contents, original downloads, chunks, search, Agent list/ask, chat, knowledge synchronization, or model operation.

This is a temporary validation window. After validation, coordinate a second guarded daemon restart without the reader to restore missing-auth state, then verify that status. Each restart interrupts Companion connections and invalidates its UI cookie; recover the existing page/session and connections afterward without closing user browser windows. If guarded draining is blocked or any outcome is unknown, stop and report it; do not kill processes or force the restart.

The credential will remain in the credential-bearing daemon's environment and adapter memory for that daemon's lifetime, and in the short-lived knowledge CLI child environment while a permitted read runs. Clearing the launcher's environment does not clear the running daemon. JavaScript strings/OS memory do not provide proven zeroization; do not promise no residual memory. Existing unrelated child-launch paths can inherit daemon environment by default, so no unrelated process-launch controls may run during this temporary window. If strict prevention of all such inheritance is required, that needs an explicitly scoped old-backend change and review before credential injection; it is not a pure Next change.

## Code evidence and practical impact

- Startup capture: companion-daemon.ts197-200 constructs KnowledgeAdapter from process.env.WEKNORA_API_KEY once. KnowledgeAdapter options retain the key; knowledge-adapter.ts454-461 ready()/cliEnv() uses it and passes it to the CLI. No existing hot-auth setter was found.
- Knowledge cliEnv uses a restricted base env plus the apiKey. Other system-open/folder/focus functions in platform.ts and DashboardLauncher spawn without explicit env and therefore can inherit the daemon environment. Do not represent all-child isolation as implemented.
- Daemon identity/generation guard: lifecycle-drain.ts122-164 binds the stop to the observed current instance and generation, closes admission, waits for all observed counts to be0 and unknown=[]; timeout refuses stop. Its snapshot explicitly reports creatorGlobalDrainVerified=false and nativeCancellationConfirmed=false. The guard is not proof all activity in the separate Creator process stopped.
- SSE: http-server.ts handles /api/events as an open HTTP response; HTTP work remains counted until response finish/close. Polling/SSE clients must pause and close their own streams for a quiet guarded window. New business requests receive DAEMON_DRAINING/503 during draining. The page must reconnect after restart.
- MCP: http-server.ts begins machine calls with drain.enter('mcp'), holds a map entry through completion, and releases it on the corresponding finish. Existing completion routes remain admissible during DRAINING; do not restart over an unfinished/unknown MCP action. Stop only after accepted fresh zero-count snapshot, not after guessing clients are idle.
- Owner child: http-server.close() awaits ownerReview.close() first. owner-review-host.ts observe()/close() refuses if busy/unknown, sends its owned child a graceful close command, and waits for exit plus closed acknowledgement; no forced child kill/restart is used. Its next authorized page request can recreate the same configured child/cache. No cache target switch is part of the requested approval.
- Shared browser automation: companion-daemon close() first calls closeSharedEdgeSession(); edge-session.ts closes daemon-owned headless contexts/browser and disconnects an external CDP client; it explicitly avoids closing Owner CDP pages/contexts. These owned automation sessions can be interrupted even though user windows are not intended to be closed.
- daemon close then closes HTTP server, coordination store and owned locator. It does not call Creator stop, knowledge-service stop, or model-service stop in this close path. Still verify Creator PID/Bridge readiness after reconnection; no unconditional continuity promise is made.
- New daemon creates a new random creator_ai_session and API token by default and a new in-memory CallHistoryStore. Existing UI cookie no longer authenticates; MCP clients need normal rediscovery; transient displayed call history can reset. Persistent registry/project files are not deleted by this close path. Persisted log files and in-memory call history must not be conflated.

## Scope decisions still needed

- Root should establish exact bounded validation duration/cleanup checkpoint, current in-flight state and other users before requesting a maintenance approval. If the approved scope permits only one restart, do not claim the reader is removed afterward; it remains until a credential-free restart/exit.
- Reader current validity remains unproven in this slice: October15 public nonsecret receipts proved exact ID3 scope then, not current revocation state. Do not send high-sensitivity credentials merely to prove a speculative transport.
- Positive reads failing due to genuine scope denial should remain denied; do not upgrade to an Owner/full-access key or extend capability to make a test pass.

All work here was source/public-metadata reading plus this task-owned Temp document. No repo/index/service/model/browser mutation or credential transmission was performed.
