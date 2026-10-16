# v148 knowledge read and service status contract

0.1.13构建边界：companion-readonly暂不注册本provider，因为connect/status会执行原CLI/sync查询，模型标签也走该链。其他原专用源码构建保留本功能，真实部署/调用仍须对应范围批准。此更改不表示服务离线或功能永久移除。见passive-readonly-013.md。

This adapter implements only verified read operations from the supplied v148 backend snapshot. It does not claim that a live Windows installation, CLI, credential, knowledge index, model, or service has been tested. It introduces no dependency or credential. Construction is passive.

## Evidence and reuse

The parent task verified the 29-file SHA inventory before implementation. The implementation was checked against these supplied reference files; no external GitHub project was adopted:

- `.test-artifacts/v148-backend-reference/source/mcp/src/companion/knowledge-adapter.ts`: status, request schemas, field projection, actual CLI read operations and temporary-file download behavior.
- `.test-artifacts/v148-backend-reference/source/mcp/src/companion/http-server.ts`: exact routes, Cookie-only UI authorization, same-Origin POST requirement, 4096-byte body cap and cancellation on disconnect.
- `.test-artifacts/v148-backend-reference/source/mcp/src/companion/knowledge-service-client.ts` and `ai-launcher-client.ts`: limited meanings of `running` and `frameable`.
- Corresponding original `knowledge-adapter.test.ts`, `knowledge-http.test.ts`, and service tests: expected envelopes and isolation boundaries.
- `.test-artifacts/v148-reference/source/source/web/src/knowledge-page.ts`: existing 2 MiB response cap and 30/45-second read deadlines.
- The current project's `src/adapters/companion-browser.ts`: same-origin transport, bounded stream handling, cancellation race and late-response disposal pattern.

The old UI's schema-only pass-through is deliberately not reused. Every result is constructed from checked fields; opaque configuration, credentials, diagnostics, model instructions and extra objects are omitted.

## Invocation contract

`createKnowledgeReadProvider({ fetch, timeoutMs? })` accepts an explicitly injected browser transport. There is no base URL, token, host, Authorization header, automatic setup, polling, EventSource or storage option. Configuration is captured at construction. The provider object is frozen.

All requests use relative fixed paths, `mode: same-origin`, `credentials: same-origin`, `redirect: error`, `cache: no-store`, and `Accept: application/json`. POST requests additionally use `Content-Type: application/json`. The browser supplies its existing Cookie and Origin; the client does not read or synthesize them.

| Method | Route | Verb | JSON request |
| --- | --- | --- | --- |
| `status(signal?)` | `/api/knowledge/status` | GET | None |
| `loadServiceStates(signal?)` | `/api/knowledge-service/status` and `/api/model-service/status` | GET | None |
| `search(input, signal?)` | `/api/knowledge/search` | POST | `query`, optional `kbId`, `limit` |
| `listKnowledgeBases(signal?)` | `/api/knowledge/kb/list` | POST | `{}` |
| `viewKnowledgeBase(input, signal?)` | `/api/knowledge/kb/view` | POST | `kbId` |
| `listDocuments(input, signal?)` | `/api/knowledge/doc/list` | POST | Optional `kbId`, `keyword`, `limit` |
| `viewDocument(input, signal?)` | `/api/knowledge/doc/view` | POST | `id` |
| `downloadDocument(input, signal?)` | `/api/knowledge/doc/download` | POST | `id` |
| `listChunks(input, signal?)` | `/api/knowledge/chunk/list` | POST | `id`, optional `limit` |
| `listAgents(signal?)` | `/api/knowledge/agent/list` | POST | `{}` |

Each POST requires a separate explicit user action in the page. Status refresh does not perform a search or list request. Creating/injecting this provider does not dispatch anything. There are no lifecycle, credential/setup, chat, agent-ask, synchronization run/dry-run, upload, delete or write methods. Exposing existing status booleans does not authorize those operations.

All inputs are validated and explicitly projected before fetch. Unsupported input keys are rejected. Request identifiers use the backend's `^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$` contract. Trimmed queries/keywords must have 1–512 UTF-16 code units, must not start with `-`, and must not contain C0 or DEL controls. A missing optional query stays omitted; an explicitly empty keyword is rejected. Integer limits are search 1–1000 (backend default 10), document list 1–100 (default 20), and chunk list 1–1000 (default 50). Encoded request JSON must fit 4096 bytes.

## Bounded finite projections

Successful knowledge responses must have `schemaVersion: companion-knowledge-v1`. This marker is checked and omitted from the domain return value. Service status responses have no schema marker in v148.

- Knowledge status: CLI availability/compatibility/version and a local fixed error description; retrieval `auth`, `keyword`, request-safe `kbId`, and the verified fixed `http://127.0.0.1:8081` display endpoint. The endpoint is never used for navigation or fetch.
- Sync status: availability/writer/scheduler booleans; at most 100 registered source summaries; source IDs/channels, labels, freshness enum, pending count, full 40–64-digit hexadecimal SHAs, and at most 10 job summaries with closed status values. Duplicate source/channel pairs or job IDs are rejected. Source error `message` is generated locally from a closed code; raw errors are discarded.
- Search: at most the caller-selected limit, unique IDs of at most 160 characters, titles of at most 200, content of at most 4000, optional knowledge ID of at most 160, and a finite source projection. Source paths must be relative, at most 512 characters and contain no `..` segment; no path is dereferenced. Repository IDs are at most 100 and SHAs require 40–64 hex digits. `count` must equal result length.
- KB list: `id`, optional `name`, `description`, `type`, `knowledge_count`, `chunk_count`, `is_pinned`, `updated_at`. KB detail alone may include `embedding_model_id`.
- Document list: `id`, optional `title`, `file_name`, `parse_status`, `file_type`, `file_size`, `updated_at`, with a required boolean `truncated`. Detail alone may include `description`.
- Chunk list: `id`, optional `chunk_index`, `content`, `is_enabled`, and a required boolean `truncated`.
- Agent list: `id`, optional `name`, `description`, `is_builtin`. It is metadata only, with no ask/chat/session capability.
- Metadata strings follow the backend's 200-character limit, except description/content which have 4000. Counters must be safe nonnegative integers; booleans must be actual booleans. List IDs must be unique. KB/agent lists retain the backend projection's hard 1000-row bound (the CLI command asks for 100); document/chunk lists are further bounded by the requested limit. Known fields with a wrong type are rejected rather than coerced. Optional missing fields remain missing.
- Detail result IDs must match the requested ID. Display-only result IDs can exceed the request-safe contract; `isKnowledgeRequestId` must gate any follow-on detail action.

Text is untrusted content and must render as inert text. There is no HTML or Markdown execution, rich preview, iframe or automatic hyperlink dereference. Do not persist queries, result bodies, original document contents, sessions or response errors.

## Meaning of status and verification

`GET /api/knowledge/status` checks the CLI version/schema and reads the registered-source/sync ledger overview. It also reports process-local retrieval state last updated by the backend's actual search. It does not itself run a retrieval or establish indexing success. `available`, a matching completed SHA, or a `done` ledger job must not be relabeled as a newly verified search/index result.

Knowledge-service `running` reports the backend probe's service reachability; `frameable` is display-only metadata and does not enable embedding. Model-service `running` reports launcher reachability only, with no evidence about individual models being loaded or inference-ready. These are kept separate from CLI compatibility, credential configuration, and retrieval `verified`.

`loadServiceStates` preserves each successful independent read. A failed or malformed service result is omitted and accompanied by a fixed warning. Missing is unknown, not stopped; an explicit valid `running: false` means the probe reports unreachable, not proof that every underlying process stopped.

## Original-content operation and side effects

Despite its logical-read purpose, the existing backend's `/doc/download` operation creates a temporary `companion-kb-*` directory, downloads the document to a temporary `payload` file through the CLI, reads it, and removes that directory in a `finally` block. The UI must explain this backend temporary-file behavior before the user initiates the operation.

The response is an in-memory original-content preview only. The adapter checks `docId`, basename `fileName`, byte count up to 1 MiB, `truncated`, `isBase64`, and bounded `content`. Binary data uses checked base64 length/shape and matching byte count. Text may contain replacement characters from the backend's UTF-8 decode; the source is not rewritten. A truncated response must report the full 1 MiB slice. The 2 MiB response budget accommodates the roughly 1.4 MiB base64 representation of a 1 MiB slice.

No browser download link, Blob URL, external URL, file save, user-directory write or file-system handle is created. The UI must not call a preview “saved” or imply a full file exists locally. Cancellation does not prove backend temporary-file cleanup completed; that is the backend's responsibility.

## Transport, cancellation and errors

- Response stream cap: 2 MiB and 4096 chunks, including zero-length chunks. Oversized announced length is rejected without consuming the body. Streamed bytes are counted independently of headers; UTF-8 decoding is strict.
- Default total deadline: 30 seconds for normal reads, 45 seconds for original-content preview. It covers both headers and body. A test/host override is validated within 1–45000 milliseconds and captured immutably at construction.
- Knowledge status and all POST operations share one active slot to avoid overloading the backend's limited subprocess slots. The knowledge-service and model-service status GETs have separate single-flight slots, allowing the three status reads in parallel.
- Each call accepts `AbortSignal`; even a signal-unaware injected fetch or stalled stream settles on timeout/cancel. Rejected/late response bodies are discarded. Cancellation releases the logical client slot after the call settles; it is not proof a remote subprocess has exited. No automatic retry follows cancellation, timeout, busy or backend error.
- The UI/store owns selection and navigation generations: abort and clear stale content on KB/document/query changes, closing, route changes or provider replacement. A response from an older generation must never overwrite the current selection, even for a custom provider that ignores signals.
- Redirected, opaque, non-JSON, malformed, duplicate, oversized or contradictory responses fail closed. HTTP error bodies are read only within the same cap to extract a recognized code; raw diagnostic text, URLs, queries, tokens, stacks and nested fields never enter the returned error. HTTP 401/403/429 map to unauthorized/forbidden/busy; other statuses remain HTTP failures. Transport exceptions become fixed network text.

## Verification

`tests/knowledge-read-adapter.test.ts` uses injected fake transports and controlled `ReadableStream` instances only. It covers the exact 11 paths/verbs, passive construction, Cookie-only options, strict input/output projection, independent evidence semantics, partial status failure, identifier/limit bounds, traversal/provenance checks, preview accounting, errors, redirects/invalid JSON/UTF-8, body/declared/chunk budgets, single-flight, cancellation, signal-ignorant late responses, 30/45-second deadlines and no retries. It never starts the reference backend, CLI, sync bridge or Windows services.

Live same-origin Cookie deployment and real CLI/index/model behavior remain unverified until separately authorized and performed on the target environment.
