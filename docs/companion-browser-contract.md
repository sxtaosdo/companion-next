# Companion v148 browser read contract

0.1.13 mode boundary: `companion-readonly` constructs with `runtimeProbes:false`, so loadProjects requests ONLY `/api/projects`, returns empty statuses/dashboard with an explicit unprobed warning. Connect then reads counts; polling shares this same frozen profile. The three-GET behavior below is retained only in the other dedicated builds. Missing state is unknown, not stopped. See passive-readonly-013.md.

## Scope and evidence

This slice migrates real read contracts for registered projects, runtime status, Dashboard projects, daemon ring-buffer logs and call history. It is not a full backend migration, real deployment verification, Creator launch or lifecycle migration. The adapter is passive at construction and reads only when a caller explicitly invokes a method. The HTTP adapter remains passive. Next 0.1.5 adds a separate opt-in event adapter and visible-page scheduler; see companion-live-refresh.md. Registration and page entry do not subscribe.

The contract was checked against the supplied, SHA-verified v148 reference files:

- `source/mcp/src/companion/http-server.ts`: GET routes, repeated log filters and call-history query validation (lines 273–322).
- `source/mcp/src/companion/types.ts`: ProjectRecord, eight RuntimeState values, ProjectRuntimeStatus and DebugEvent.
- `source/mcp/src/protocol.ts`: CapabilityProfile (`read-only`, `authoring`, `full-control`).
- `source/mcp/src/companion/dashboard-projects.ts`: Dashboard project fields and numeric profile timestamps.
- `source/mcp/src/companion/log-store.ts`: ring-buffer query OR/AND and last-N semantics.
- `source/mcp/src/companion/call-history.ts`: session ID, total/retained counts, latest summaries, descending sequence pages, 50-record page and 1000-record retention limits, summary redaction.
- `source/mcp/src/companion-daemon.ts`: GET ring-buffer log producers versus management `debug.getLogs` console merging.
- `source/web/src/call-history.ts`: the pure `mergeCalls` rule was reused with readonly inputs, including not allowing a stale `running` entry to replace a completed one. This is existing approved project code, not a newly adopted third-party project.

`filterLogs` follows the existing v148 `log-store.ts` query semantics. The display-only text redactor adapts the existing v148 call-history `cleanText` patterns. No dependency was installed.

## Transport boundary

`createCompanionBrowserProvider({ fetch, timeoutMs? })` requires an explicitly injected fetch. It accepts no base URL, token, headers, proxy, persistence or credential-registration mechanism. Supplying extra such options has no effect. The provider has only a label and four read methods.

Every request uses `GET`, `mode: same-origin`, `credentials: same-origin`, `redirect: error`, `cache: no-store`, and the fixed `Accept: application/json` header. Existing browser same-origin session cookies are used; the adapter does not acquire credentials. The host remains responsible for authorizing and configuring same-origin deployment. A successful HTTP read proves only that particular read, not that Creator, model services, knowledge services or authoring work is ready.

Allowed paths are generated inside the client:

| Method | Fixed path | Parameters |
| --- | --- | --- |
| loadProjects | `/api/projects`, `/api/status`, `/api/dashboard/projects` | None |
| loadLogs | `/api/logs` | Repeated projectId/source/level, literal search, limit |
| loadCounts | `/api/calls/counts` | None |
| loadCalls | `/api/projects/{validated-id}/calls` | limit=50, optional status=failed and positive integer before |

No arbitrary URL, path, POST, DELETE, directory opening, project registration, restart, launch, preview control, token flow, model request or third-party service call is exposed. Queries are encoded by URLSearchParams; path IDs use the bounded ID grammar and encodeURIComponent. Input objects do not become request bodies or headers. Call options and normalized unknown-log filters are snapshotted so later caller mutation cannot reinterpret a pending result.

## Domain projection and partial reads

All remote objects pass through explicit field projection. Unknown fields, executable/connection paths, preview URLs, raw payloads and credentials are not copied. Project path itself is deliberately retained as requested display data; it is never executed or opened.

- ManagedProject: id, name, path, optional requiredCreatorVersion.
- ManagedStatus: projectId, state, capabilityProfile, optional creatorVersion, launchSource=dashboard, dashboardVersion/progress, instanceId, pid, sessionId, lastError. Unknown or missing runtime/capability values become `unknown`; none become ready or stopped. Common credential patterns in lastError are redacted.
- DashboardProject: path, name, version, lastOpenedAt, source, exists, progress, state, running, pid. The numeric lastOpenedAt is preserved as supplied; the adapter does not assume seconds versus milliseconds or fabricate a timestamp. Unknown source becomes `unknown`.
- DebugEvent/LogRecord: id, projectId, source, level, time, message, optional instanceId/sessionId/operationId. Unknown source and level are normalized to `unknown`, not preserved as raw strings for CSS or labels. Message text receives common credential-pattern redaction. The UI must still render all text through escaped text bindings, never innerHTML.
- CallRecord: id, sequence, projectId, operation, operationNameZh, source, startedAt, status, durationMs, inputSummary, resultSummary, errorSummary. Only v148 mcp/cli/web and running/success/failed values are accepted. Display summaries are bounded and receive credential-pattern redaction in addition to backend redaction.

The registration read is required. If `/api/projects` fails or is malformed, loadProjects rejects; it does not return invented zero registrations. Status and Dashboard are independent optional reads. Either can fail while confirmed registrations remain usable for logs and calls; the corresponding list is empty **with an explicit failure warning**. Consumers must show warnings, treat missing per-project status as unknown, and must not label an unsuccessful status read as zero services or stopped projects. Dashboard failure is explicitly distinguished from confirmed zero Dashboard projects. Orphan statuses are retained without synthesizing registered projects.

An explicit caller abort rejects the complete operation even if some project reads already succeeded. No partial stale snapshot is published after cancellation. A timeout on status/Dashboard may produce a warned partial project read. Real empty arrays on successfully decoded endpoints remain valid empty evidence.

## Logs are a bounded existing ring-buffer read

GET `/api/logs` directly queries `options.logs` (http-server.ts:312–322). The daemon append sites at lines 209, 481, 504 and 1112 do not supply IDs; DebugLogStore assigns UUIDs. This is why the GET client accepts bounded ID-style DebugEvent identifiers. The `scene-console:{time}:{message}` and `preview-console:{time}:{message}` IDs at daemon.ts:798 and 846 belong to local `merged.push` arrays inside management `debug.getLogs`, not this GET store. The client does not invoke that management method, query Creator console, attach a preview console watcher or open a browser tab. A successful log query must not be described as complete console collection.

Project/source/level facets are OR within a facet and AND between facets. Empty facets mean no restriction. Search is literal case-insensitive message matching in the backend. For the client-only `unknown` source/level option, that facet is omitted in the bounded server request and the normalized response is filtered locally; this can yield fewer matching entries than the limit because filtering happens within the latest bounded window. No older-page completeness is inferred. The standalone `filterLogs` pure function has the same normal facet semantics and preserves chronological order while retaining the last N matches.

## Call history

CallCounts returns sessionId, per-project all-call totals and latest call metadata. Count maps have null prototypes. CallPage preserves sessionId, total, retained, records and optional nextBefore. These values are not interchangeable: total is all calls in this daemon session, retained is all retained records irrespective of a failed filter, and records is one page. Zero total is accepted only from a valid response. The client rejects negative/unsafe numbers, retained > total or >1000, over-50 pages, duplicate IDs, non-descending or duplicate sequences, cross-project rows, rows outside the before/failed query, and non-progressing nextBefore cursors.

`mergeCalls` deduplicates by ID, sorts descending by sequence, caps the result at 1000, and prevents stale running responses from replacing completed entries. The caller must reset accumulated calls on session changes, project changes or filter changes, and reject stale asynchronous responses. The adapter does not persist call history or automatically request more pages. The session ID is an opaque daemon session identity, not a credential.

## Limits and failures

- Default request timeout: 4000 ms; explicit timeout range: 1–10000 ms.
- At most six concurrent requests per provider; three for one project read, one for other methods.
- Per response: 1 MiB of actual streamed bytes and 2048 chunks, including empty chunks. Content-Length is an early rejection hint only.
- Project/status/count maps: 200 entries; Dashboard: 500; logs: requested limit, default 200, maximum 1000; call page: 50.
- Filters: at most 200 entries per facet; search: at most 512 characters; IDs: at most 128 bounded ASCII ID characters; paths: at most 4096 characters; log/lastError text: at most 8192; call summaries: at most 2000.
- JSON content type is required. Redirected/opaque success, malformed JSON/UTF-8, invalid shapes, duplicate primary IDs and over-budget data fail closed.

Both fetch and body reads race cancellation. A transport ignoring AbortSignal still settles at abort/timeout. A late response is disposed, incomplete streams are cancelled, abort listeners/timers are removed, and aborted request slots are freed synchronously for a replacement read. Duplicate cancel/finally cleanup does not consume another request's slot.

CompanionBrowserError exposes only a static error code, fixed endpoint category, optional HTTP status and fixed explanation. It never includes the raw response body, original exception/cause, URL/query, path, token or authentication header. Ordinary display text redaction recognizes common credential patterns but is not a guarantee that arbitrary unlabelled secrets can be detected; the contract does not represent successful project/log content as secret-free.

## Verification boundary

`tests/companion-browser-adapter.test.ts` uses injected fetch/Response streams and v148-shaped fixtures. It covers field projection; all eight states plus unknown; valid zero and failed/partial reads; encoded filters; unknown log-source normalization; counts/session/retention/cursor semantics; stale-running merges; invalid queries; response budgets; 401/403/network/shape failures; redaction; fetch/body timeout; pre-abort; late response disposal; partial cancellation; and concurrency replacement.

These deterministic tests verify the client contract, not a live Windows Companion installation. The slice neither starts nor changes that installation. SSE client source and offline lifecycle tests were added in 0.1.5. Real browser/host SSE, Owner authentication and end-to-end Creator operations remain unverified by this client slice.
