# Typed v148 runtime binder

`host/v148-runtime-binder.ts` is a thin construction binder for the supplied original Companion source at commit `f6dcac804fb9ad806e8094594c7820a71cfab7b8`. It uses the real `CompanionHttpServer`, `DebugLogStore`, and `ToolPresetRepository`. It does not contain another HTTP server, a CLI, a daemon entry point, or an automatic listener.

## Placement and compilation

Copy the binder unchanged into the **approved isolated copy** of the original package as:

`mcp/src/companion/v148-runtime-binder.ts`

Compile it together with that original package, retaining its NodeNext module layout and its locked dependencies. Its imports intentionally resolve beside the original `http-server.ts`, `log-store.ts`, `tool-preset-store.ts`, `knowledge-adapter.ts`, `ai-launcher-client.ts`, and `knowledge-service-client.ts`, and to `../errors.ts`. Do not import it into the Vue browser bundle. The original source tree is not vendored into `host/`, and the frontend build does not type-check this consumer-placed module.

Use `satisfies CompanionHttpActions`, `satisfies CompanionHttpServerOptions`, and `satisfies KnowledgeBackend` against the original declarations. No stand-in server interface, `unknown`-based method map, structural cast, or fabricated private member is used. The repository and log-store subclasses preserve their original nominal class types. Compile-time verification must be performed at the consumer placement above; standalone parsing is not type compatibility proof.

## Exports and inputs

Runtime exports:

- `V148_BINDER_SOURCE_HEAD`
- `V148IsolatedLogStore`
- `createV148IsolatedHost(input: V148IsolatedHostInput): V148IsolatedHost`

Type exports:

- `V148ProjectTestReaders`
- `V148KnowledgeReads`
- `V148TestReaders`
- `V148IsolatedHostInput`
- `V148HostCapabilities`
- `V148IsolatedHost`

`V148IsolatedHostInput` requires:

- `webRoot`: explicit absolute path to the chosen static UI build, such as the new `dist-companion` directory. No static-root discovery fallback is used.
- `isolatedStateDirectory`: explicit absolute path inside the approved isolated test directory. The denied tool repository receives only `<isolatedStateDirectory>/denied-tool-presets.json`; neither construction nor any overridden operation reads or writes it. Do not pass an Owner configuration directory.
- `testReaders`: an explicit object containing independent test-data readers. Its optional groups are `projects`, `aiLauncher`, and `knowledgeService`. A supplied group must provide all of its required methods. An absent group causes its reads to reject with the original `BridgeFault("UNSUPPORTED", ...)`, not to fabricate an empty project list or stopped service.

An optional `existingApprovedKnowledgeBackend` accepts only the nine original knowledge-read method signatures. Supplying the object does not authorize its access to any additional system; any real backend must already be approved for the test's data and destinations. The binder never creates `KnowledgeAdapter` or loads credentials.

There are no token, startup-code, port, configuration-path, or daemon options. Unrecognized top-level keys are rejected. Methods are captured and bound to their original receiver when constructing the host. The supplied reader implementations are the caller's trust boundary: the binder cannot prove that arbitrary callbacks are side-effect-free. For isolated verification, inject deterministic fixtures rather than platform, service, registry, or account probes.

The result contains `{ server, logs, capabilities }`. `server` is the original `CompanionHttpServer` instance. `logs` is the genuine memory-only subclass, useful for adding explicit synthetic test events. Call history belongs to `server.calls`, the original server's own new in-memory store. Neither store imports the old daemon's history.

## Bound behavior

- Project list, dashboard list, and aggregate statuses come only from `testReaders.projects`. Per-project status and all remaining business actions reject with `CAPABILITY_DENIED`.
- `V148IsolatedLogStore` inherits original `append`, `query`, `on`, and `off`. It has no disk directory. Only `clear` is overridden to reject with `CAPABILITY_DENIED`.
- SSE uses the original router and original emitter subscriptions. Do not substitute a facade whose `on` throws: v148 sends event-stream headers before calling `logs.on`, making that facade unsafe. On connection closure the original handler removes both log and call-history subscribers.
- The tool-presets subclass overrides all ten original public operations: `list`, `get`, `selectedForProject`, `create`, `update`, `delete`, `selectForProject`, `removeProjectSelection`, `export`, and `import`. Each rejects before original file access. The original class has no public `sessionForProject` method.
- Optional knowledge forwarding permits only `status`, `search`, `listKnowledgeBases`, `viewKnowledgeBase`, `listDocuments`, `viewDocument`, `downloadDocument`, `listChunks`, and `listAgents`. Bound receiver and abort-signal forwarding are preserved. `sync` (including dry-run), `chat`, and `askAgent` reject with original `KnowledgeFault("POLICY_DENIED", 403, "not_approved")` without invoking the supplied backend.
- Model and knowledge-service `status` are explicitly injected. Their `start` and `stop` always reject. The options always include these facades, so the original constructor cannot substitute installed Windows service clients.
- No icons backend is supplied. No bridge, project registry, dashboard discovery, setup service, or process manager is constructed.
- In-flight observation explicitly reports `EXISTING_DAEMON_AND_NATIVE_WORK_NOT_OBSERVED`. It is not evidence that existing native work has stopped or drained.

## Listener, authentication, and router limitations

Construction does not listen. The original constructor creates fresh in-memory authentication secrets, a new call store, and an HTTP server object; it also reads its own module bytes to identify this instance. It does not read Owner credentials. Do not print, persist, or include `server.apiToken`, `server.startupCode`, login URLs, or session cookies in test artifacts.

For a separately authorized short-lived test, the caller invokes `await server.listen()`. The binder fixes `port: 0`; the original method binds only `127.0.0.1` and returns the actual ephemeral port and one-time login URL. The caller must close live SSE readers before `await server.close()` in a `finally` block, and verify listener cleanup. Startup, cleanup, and execution supervision belong to the caller, not this module.

**This is not a closed read-only HTTP server.** The original router, authentication flow, tools metadata, drain routes, and in-memory call-history start/finish routes remain. Denied business callbacks can still be logged by the original router. Authenticated routes may change isolated in-memory state; malformed requests may be rejected before reaching a denied callback. `closedReadOnlyRouter` is explicitly `false`. There is no claim that this instance's log or call list reflects the user's existing daemon.

## Verification boundary

The binder module itself does not install dependencies, launch a listener, read Owner configuration, or exercise a real account. The separately approved build and HTTP runners now have actual isolated-runtime results, recorded below. An AST comparison verified that all ten original public tool-repository methods have overrides, with no extra or missing methods. TypeScript syntactic transpilation reported zero diagnostics; the binder contains no type assertions or `any` declarations. These are static checks, not semantic type-checking or runtime evidence.

Consumer-side original-package compilation and short-lived HTTP/session/SSE tests are separate verification steps. Their results must be recorded separately; frontend test success alone does not establish compatibility with the original runtime. If original development type dependencies are absent, successful transpilation and runtime tests must not be reported as a full original-package type-check.

## Approved original-HTTP validation (2026-10-12)

After explicit approval, exactly the three original locked roots (zod4.4.3, MCP SDK1.30.0, better-sqlite3 12.11.1) and their128-package dependency closure were installed in `.test-artifacts/v148-host-runtime` using `npm ci --ignore-scripts --no-audit --no-fund`. The main frontend dependency tree did not change. No native addon compilation, database construction or persistent locator was attempted.

`scripts/build-v148-test-runtime.mjs` validates the reference manifest SHA, all100 source byte hashes and installed root versions, copies this binder into the isolated source copy, then uses the existing approved esbuild to transpile/bundle original HTTP plus the current frontend read clients. It neither installs nor listens. `scripts/validate-v148-http.mjs` explicitly starts two original server instances on127.0.0.1 random ports, uses process-memory session cookies created solely for these fixtures, and closes both in finally. No auth code, Cookie or token is printed or persisted.

21 runtime groups pass: original one-time login and Cookie headers, missing auth / wrong Host / wrong or missing POST Origin rejection, cross-instance Cookie rejection, new UI static files, actual frontend adapter requests for projects/logs/calls and knowledge read routes, partial failure semantics, missing-reader rejection, original KnowledgeAdapter missing-identity401, denied knowledge writer/chat and service lifecycle methods, denied log clear and preset write, malformed/oversized payload rejection, request abort, actual SSE log plus named call events and subscription cleanup. Finally both ports explicitly yield ECONNREFUSED. The runner bounds reader-entry waits, globally aborts stream/request controllers, and attempts every server close with allSettled.

Business reads use unmistakably independent fixtures; successful search/download does not prove a real index, CLI, model or file save. The missing-identity case does instantiate original KnowledgeAdapter with fileAvailable alwaysfalse and runJson forbidden, so it exercises the genuine denial path without reading any config, using a key or spawning a subprocess. No Creator lifecycle, actual Owner service or browser visual behavior is claimed. The source class's router remains broader than a read-only API.

A semantic TypeScript check of the isolated binder's transitive original-source graph was attempted using the original build options and the already available TypeScript5.8.3 (not the old lock's5.9.3) and **did not pass**:214 diagnostics, dominated by missing Node/global/module declarations and excluded original development dependencies; the binder file itself reports missing node:path types. These declarations are not among the approved three runtime roots, and were not installed or shimmed. Original runtime transpilation and actual HTTP tests pass; this is not a full original-package build/typecheck. The frontend's own vue-tsc remains a separate passing result.

The earlier parameter-only module stays a non-starting design reference. Its deny-on/off map is not used by this binder. Runtime evidence is stored in `docs/evidence/v148-http-validation.json`; no Windows deployment or Library replacement occurred.

## Approved locked semantic check (2026-10-12, supersedes the 214-diagnostic binder limit)

Owner subsequently approved exactly TypeScript5.9.3, @types/node24.13.3, @types/better-sqlite3 7.6.13 and undici-types7.18.2 in the same isolated directory. Installation added exactly4 packages; all128 existing lock entries remained byte-for-byte equivalent as JSON. Versions and integrity match the original lock; only the original mirror tarball origin was changed to official registry.npmjs.org. `--ignore-scripts --no-audit --no-fund` was retained. The frontend package-lock and its TypeScript5.8.3 did not change.

`node scripts/typecheck-v148-runtime.mjs` verifies the original100 source hashes, current binder bytes, installed versions, the four approved lock additions and unchanged128 entries. It uses the original `tsconfig.build.json`, including its strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes / skipLibCheck settings, and the real configFilePath for NodeNext and type-library resolution. Only noEmit is added. No declarations or casts are fabricated and no original source is edited.

- Binder + imported original graph: **55 non-declaration source files, zero semantic diagnostics**, using TS5.9.3.
- Broader supplied source closure:88 roots /93 non-declaration source files, **15 diagnostics remain** in original Bridge / dashboard / Edge / playtest / profiler modules due to absent ws declarations and Playwright. This expanded scope is not a passing whole-package build. No additional dependencies were installed to hide that limit; the command intentionally exits1 while the broader result fails.

The55/93 counts include imported JSON. The initially ad-hoc API check omitted configFilePath and therefore still reported a missing `node` type-library entry despite the installed package; correcting project resolution removed that artifact, without weakening any compiler option. Final evidence is `docs/evidence/v148-typecheck-approved.json`. This check neither starts a service nor runs any original backend module. The separate static `next/` delivery reuses the already-built UI and an existing backend; it does not deploy this isolated binder or install server packages on Windows.
