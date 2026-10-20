# Isolated reader error classification

The baseline checkpoint contains all four owned source-map sources from installed
knowledge-worker.js SHA256 `07c4861de1716058f79866df3b15e64286b1281da8478e5f8feef192964013d4`
and map SHA256 `8431aff6da611a4d836fa4b34f04e1629e0f1cb00baaa56cdb65e43e84cecb2c`.
Only `mcp/src/companion/knowledge-worker-core.ts` changes production behavior.

The classification is scoped to the phase that fails:

| Failure | Existing code/status |
| --- | --- |
| Local reader file/decryptor/loading unavailable | AUTH_MISSING / 401 |
| Known fetch/response transport code, including ECONNREFUSED | UPSTREAM_UNAVAILABLE / 503 |
| Caller cancellation | CANCELLED / 499 |
| Request deadline or explicit transport timeout code | TIMEOUT / 504 |
| Actual upstream HTTP 401/403 | AUTH_DENIED / 403 |
| Identity/KB/scope/capability/expiry refusal | AUTH_DENIED / 403 |
| Other unsuccessful upstream HTTP status | UPSTREAM_UNAVAILABLE / 503 |
| Invalid JSON, missing body, unknown unexpected failure | SCHEMA_INVALID / 502 |
| Identity response exceeds the existing 16 KiB bound | OUTPUT_LIMIT / 502 |

AUTH_MISSING here means that local reader loading is unavailable. It does not
assert that the credential file is missing. Filesystem, ACL, crypto, child
process, transport messages and causes are not returned. An arbitrary TypeError
does not establish a network failure. Only the fetch/response-I/O catch inspects
a bounded chain of known errno/Undici codes. Existing HTTP 401 and 403 both
continue to use the normalized AUTH_DENIED/403 response.

No protocol codes are added. The current host and Next already recognize these
codes. There are no host status-cache or UI changes. Identity validation,
credential security checks, output redaction, cancellation lifecycle and the
settled/child-close acknowledgement remain intact.

The 64 tests execute the extracted core with the real KnowledgeFault class.
Filesystem, decryptor child, fetch, backend and stdio are explicitly fake.
They do not load a real credential, open a listener, execute a CLI/decryptor,
or contact a real service. The test's only real filesystem read is its own
isolated core source. Dependencies are read from the existing installation;
Vitest cache and test output stay in this task's Temp directory.

The tests cover local access/crypto failures, malformed local data, known
network and timeout codes, caller cancellation and late response boundaries,
HTTP status classification, malformed/oversized identity responses, valid 200,
strict identity restrictions, and unknown TypeErrors at distinct phases.
Strict TypeScript checking also passes for all four extracted sources and the
new tests.

Historical 403's first failing phase remains unknown. This fix does not prove
that an earlier request reached fetch or that earlier DPAPI loading succeeded.
This isolated candidate has not been built, deployed, or run against live data.

Run from the `mcp` directory with NODE_OPTIONS=--no-experimental-webstorage:

```
node D:/code/shidai3/P8000/cocos-mcp/mcp/node_modules/vitest/vitest.mjs run --config ../vitest.config.mjs
node D:/code/shidai3/P8000/cocos-mcp/mcp/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Raw source hashes, baseline Git identity, test report and tool versions are
recorded in `evidence/bindings.json`. Candidate edits remain uncommitted for
the parent thread's independent review and unified delivery.
