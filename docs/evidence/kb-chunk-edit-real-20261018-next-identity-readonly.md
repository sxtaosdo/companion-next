# Next knowledge identity: bounded source review

Reviewer: /root/reviewer. Date: 2026-10-18. This is source/evidence review only, not a positive runtime authentication result.

No credential file, credential environment value, browser authentication material, database, service, desktop or business test was accessed or run. This task-owned report is the sole write in this review lane.

## Confirmed path

- Next `src/adapters/knowledge-read.ts:246` sends same-origin Companion requests with the Companion cookie. It does not forward the native WeKnora browser session.
- `cocos-mcp/mcp/src/companion-daemon.ts:197-200` captures `WEKNORA_API_KEY` once when constructing KnowledgeAdapter. No hot identity setter was found in this bounded path.
- `knowledge-adapter.ts:454-461` requires that independent key for logical reads and supplies it to the official CLI child through a restricted environment. Native frontend success does not establish this path.
- Metadata commands call `command()` (446-451), which checks ready(), invokes the CLI and projects its response. Current `auth=verified` and `keyword=verified` are set only by search (262-263), not successful KB metadata reads. A metadata-only acceptance must not invoke search just to change these flags.
- WeKnora `routes_auth_tenant.go:232-233` registers GET `/api/v1/auth/reader-identity`. Its gate rejects JWT and full/platform principals; `reader_identity.go:13-35` returns only bounded nonsecret grants after authenticated restricted-reader and expiry checks. Historical key metadata, including revoked=null, is not current authentication proof.

## What existing authorization supports

Existing source and sanitized receipts can establish provider wiring, service reachability, CLI compatibility, missing-auth/denied failure boundaries, and the already accepted native keyword workflow. None proves current reader validity or positive Next KB reads. This lane has performed no new runtime checks.

## Remaining positive-path boundary

`docs/knowledge-reader-confirmation-20261018.md` is explicitly proposed scope, not executed approval/result. It identifies the existing reader, single allowed KB, retrieve-only/non-full scope and metadata-only validation. Current authorization for this lane expressly forbids reading or supplying credentials, so the prerequisite cannot be performed here.

A separately authorized positive run would require current authenticated reader self-metadata validation, a guarded Companion maintenance window to provide the existing reader to a new daemon, only the approved bounded KB list/metadata reads, then a credential-free guarded restart and reconnection checks. It must preserve the allowed KB/capability bounds and must not substitute the native owner session or a broader key. Existing child launch paths may inherit daemon environment; do not claim universal child isolation or proven memory zeroization.

No source change is required merely to prove an existing authorized reader path. Current positive validity, scope-denial behavior under that real reader, and Next metadata success remain unverified. Full knowledge migration, chunk editing, contents, original downloads, search, Agent/chat, sync and model operations are outside this identity review.
