# Full daemon start chain follow-up

The first deployed CLI 3b9fb28a... map source is verified equal after newline normalization to previous candidate 3ceb49c (DEPLOYED-BEFORE-FOLLOWUP.json). The 55-second outer communicate timeout, missing stdout/exitcode and subsequently absent entry/CLI do not establish their success, failure or exact waiting stage. Their outcome remains UNKNOWN; no start/restart was issued in this task.

Confirmed gaps beyond the previous private-function tests: executeCompanionCommand initially awaited discover and runningClient.status without a bound; after private start verified readiness it awaited started.client.status a second time without a bound. CompanionApiClient.request awaits fetch and response.text. Either unresolved operation can leave the command promise unsettled. An unsettled promise alone does not prove that Node stayed alive; actual process/resource lifetime is not captured by the fake-clock test. No evidence here attributes the observed 55 seconds to HTTP keep-alive.

Repair in this candidate only:
- Add private runningDaemonStatus with a 10-second remaining timer/race around initial discovery/request and a fetch AbortSignal. Raw errors are replaced with fixed safe text.
- Probe failure still enters the existing bounded port/locator preflight before any single spawn. An occupied port remains a refusal, not a reason to spawn twice.
- Private start returns its already verified status with the existing client/PID. Both start and restart print this value without an extra unbounded HTTP request. Restart stop/identity/receipt guard code is unchanged.
- Total nonrestart async wait budgets: initial probe 10s + preflight 10s + post-spawn 30s. This is not a real-time guarantee for synchronous execution, OS scheduling, stdout or the enclosing PowerShell wrapper. Restart's protected stop phase is outside this change.

Validation: 26 isolated tests pass. The original 18 private/preflight tests remain. Six full execute tests cover slow start/output reuse, healthy existing instance with zero spawn, initial discover/request hangs plus occupied port refusal, unresolved request/body completion under both initial/new probe budgets, and late initial discovery without request. Two exact previous execute-source counterexamples remain unsettled at 60 virtual seconds in initial or redundant status, proving the formerly uncovered await gaps. Fakes create no network/listener/daemon and do not prove Node process handle cleanup. Existing public client API and business statuses are unchanged; parent owns whole-module build/typecheck and real entry acceptance under a fresh controlled checkpoint.

Deliverable source.patch is cumulative against original 2bb48bf. followup.patch is just the full-chain change against deployed-equivalent 3ceb49c. Complete source and before-full-chain-fix.ts are bound in SOURCE-BINDINGS.json. No production/shared source changes or service operations were performed.
