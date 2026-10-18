# Identity clarification — 2026-10-18

Supersedes generic wording that Owner must provide a new identity. No new credential is needed by default.

## Which identity produced 401?

There are three independent layers:

1. Companion UI access: local creator_ai_session cookie. The actual read-list requests passed this gate and same-Origin gate; either failure returns 403 before knowledge dispatch (old http-server.ts:268-269). Our existing UI bootstrap succeeded, so Companion access was valid at the 10:42 request time.
2. WeKnora native web Owner login: browser web session for 8081. This lane did not inspect the user's browser, cookies or storage, so its current validity is unknown. It is not the Companion API identity.
3. WeKnora retrieval API identity: KnowledgeAdapter apiKey option, supplied by daemon startup process.env.WEKNORA_API_KEY (companion-daemon.ts:197-200). Missing apiKey returns AUTH_MISSING/401 before CLI in ready() (knowledge-adapter.ts:454-457). This is precisely the identity missing from the live daemon; the denial does not prove an existing reader has expired or is revoked.

No source bridge forwards the Companion cookie or native WeKnora login token to KnowledgeAdapter. The HTTP knowledge handler passes only strict JSON input and AbortSignal to the backend. No current credential setter, refresh or login route was found in mcp/src. Therefore signing into 8081 or refreshing the Next page cannot fix this daemon's missing apiKey.

## Existing reader: reuse candidate, not a claim of current validity

Public nonsecret local handoff D:/services/weknora/cli/Owner-Cli-Handoff.md records existing Owner-approved ID3 shidai3-cli-pilot-retrieve-recovery-20261008:

- tenant1, only shidai3-pilot KB da1051a5-3fff-4198-ba55-017ea79df9c3;
- capabilities exactly ['retrieve'], full_access=false;
- expiry 2026-11-08T01:25:46.685460Z;
- Windows-user/machine-bound protected local recovery, not a new plaintext CLI profile;
- no need to copy a key from the browser, reset password, create a new key, widen scope or change ACL/security.

Read-only historical evidence:
D:/services/weknora/cli/evidence/pilot-readonly-smoke-metadata.json: checked 2026-10-15T04:04:12Z, credentialBindingVerified=true, exact reader/tenant/KB/expiry, keywordOnly=true.
D:/services/weknora/cli/evidence/reader-boundary-metadata.json: checked 2026-10-15T04:24:51Z, same identity bound, key-management and foreign-KB GET403, no writes or response bodies recorded.

These receipts show successful existing reader use on October15, not current revocation/auth validity on October18. Date is before expiry but revocation can change. This lane did not read protected secret files, private credentials, .env, process environment secrets, SQLite DB, user cookies, or plaintext credentials. No new metadata/auth query was necessary to re-prove the already confirmed daemon missing-key state.

## What can be proved without secrets?

- Current missing/configured/verified state inside daemon: existing GET /api/knowledge/status; parent already captured missing, so this lane did not repeat it.
- Existing reader grant and past authenticated success: public handoff and historical metadata receipts as above.
- Current live validity of that reader cannot be proven from an anonymous GET or the old expiry alone. ReaderMetadataGuard.py authenticate() uses GET /api/v1/auth/reader-identity with X-API-Key, returns only identity/scope/expiry metadata. It still needs controlled use of the protected reader; it is not unauthenticated validation.
- The existing --metadata-only guard reads nonsecret grant fields from SQLite but cannot prove the protected key binds to that row or is currently accepted. It was not executed: this lane is not rescanning the private DB.
- Enter-PilotCli.ps1 is NOT an appropriate readiness probe in this slice: it decrypts the protected reader and proceeds to keyword search plus evidence writes. Do not run it merely to check auth. The metadata-only HTTP identity request can be isolated later without search, but processing the protected credential is outside this lane's explicit no-key-read instruction.

## Minimal next action, without inventing a new feature

A. To establish current reader validity only: Owner authorizes controlled reuse of existing protected ID3 in a short-lived local process, solely GET reader-identity and exact scope/expiry validation, no printing/persistence/search/ask/sync. This requires neither daemon restart nor a new credential, and it does not by itself wire Next.

B. To validate actual Next positive reads: after A succeeds, authorize using that SAME existing restricted reader in the existing Companion process. Current implementation captures it at construction and has no hot-load contract, so a coordinated guarded daemon restart is required to supply WEKNORA_API_KEY only to that process. No WeKnora restart, Creator stop, model start, global/user environment setting, profile write, persistent authorization or new key is inherently required. Shared daemon and in-flight work still require root coordination. A hypothetical hot-load patch would change the old backend and is outside this approved Next-only slice.

C. Minimum data acceptance scope: start with the one permitted KB list/metadata (at most1 permitted ID), verify exact ID and read permission before inspecting any document contents; bounded document metadata only if separately selected. No cross-tenant enumeration, API-key management, broadened KB scope or full Owner key. Agent list authorization cannot be inferred merely from retrieve scope; observe allowed/403 only after identity wiring. Ask/chat additionally requires conversation capability/model/session-effect permission and is not authorized by this retrieve-only reader.

D. Existing search adapter omits --no-vector while the public controlled helper explicitly sets it. Do not treat identity wiring as approval to run search under the current no-inference rule; resolve that separate dispatch behavior first. No old backend modification was made.

No new current-auth success is claimed. No service restart, browser interaction, model inference, ask/chat, synchronization, source creation, configuration write or repository/Git change was performed.

