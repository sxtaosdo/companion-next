# Independent CLI startup wait investigation, 2026-10-20

Read-only product investigation; only independent Temp fixtures were written. No daemon, listener, Creator or model was started; PID 7156 was not signaled, restarted or replaced. No deployment/product edits.

## Confirmed mismatch

Installed creator-ai.js SHA256 bc1e15920a33e388a6d5cdc8347a9bec93fbe7cc719e7208cc8b112feeebca53; daemon SHA256 70df42a8f84e6bf9d32c050919fcb91565ff4b53ff9f85a3b1e50664d267ca65. Map content, not an unrelated checkout, was read.

CLI source-map source: current-source/mcp/src/companion-cli.ts, startDaemonAndDiscover lines 235-265 (bundle 36321-36347). It preflights the port, spawns detached with ignored stdio, unrefs, then sets Date.now()+8000. Every iteration sleeps 100 ms, checks child liveness, discovers locator/client and calls status. On expiry it throws did-not-become-ready-within-8-seconds, normalized as DAEMON_UNAVAILABLE/retryable and exit 1. It never kills the detached child. Thus CLI wait failure is not evidence of daemon startup failure; presentation does not tell the user that background startup may continue. Raw output confirms this exact branch with last fetch failed.

Evidence: Next docs/evidence/boot-writer-20261020/start-issued.json, start-output.txt, process-listener-proof.json and readonly-live-result.json.
- Start request at 01:33:35.8859777Z.
- OS process creation 01:33:36.2865950Z.
- daemon identity.startedAt 01:33:36.825Z.
- locator.createdAt 01:33:50.056Z.
- Creation-to-locator-object timestamp = 13,769.405 ms; identity-to-locator = 13,231 ms; creation-to-identity = 538.405 ms.
- Subsequent evidence has listener owner PID 7156, phase OPEN, same entry hash. No second start issued.

The 13,769.405 ms interval is NOT a measured exact listen-ready interval. daemon source src/companion-daemon.ts line 221 awaits server.listen(), line 226 captures createdAt, line 229 writes locator. Therefore listen happened by createdAt, while locator persistence/authenticated readiness verification happened afterward. Individual historical stage durations were not logged.

## Startup work and uncertainty

NativeMaintenance.open runs before listen (daemon line 165). Isolated actual open with a valid journal and injected OS observers confirms 10 boot samplings, 7 owner inspections and 1 real Windows lock-retention child in the initial legacy mismatch handoff path. Production boot/owner samplers each exec hidden PowerShell with CIM (boot also Add-Type); retention execs PowerShell/Add-Type. These are sequential calls on this path, not proof that any particular call consumed 13.769 seconds. This is a structural source of startup cost. File/journal verification, import/init, process scheduling and other constructor work also lie in the interval without per-stage timing.

open-call-counts.json and open-count-results.json record this isolated test. Four relevant module contents match the installed daemon map after newline normalization (open-installed-source-match.json). No live process-sampling benchmark was used to retroactively assign original durations.

A second confirmed issue: deadline is checked only around the loop. CompanionApiClient.status() source line 114 invokes request without AbortSignal; request lines 84-87 forwards a signal only when supplied. An in-progress status fetch can exceed the nominal 8-second deadline. Merely changing the numeric budget does not make waiting strictly bounded.

## Isolated installed-function simulation

cli-wait-simulation.mjs evaluates the exact installed JS function with fake clock/process/discovery; no process/network creation. cli-wait-results.json records six checked cases:
1. Ready at 13,769.405 virtual ms: existing function times out at 8000; one spawn, zero kills.
2. Never ready: times out at 8000.
3. Immediately ready: succeeds at first 100 ms poll.
4. Child exited: immediate-exit branch after first poll.
5. Proposed-only 30-second budget: same 13,769.405 readiness succeeds at 13,800 ms.
6. Probe taking 10 seconds: existing 8-second function returns success at 10,100 ms, demonstrating non-strict outer deadline.
The 30-second case is an experiment, not an implemented or validated production budget guarantee.

## Smallest proposed repair and authorization

The primary repair belongs to the shared CLI/host installation, not companion-next UI. In src/companion-cli.ts startDaemonAndDiscover: introduce a reviewed bounded startup budget large enough for the observed startup; enforce remaining budget on the readiness probe using existing client.request(..., AbortSignal); retain early child-exit behavior; clarify timeout as an unconfirmed readiness deadline with the launched PID/background process may continue. Keep authenticated readiness, global writer exclusivity, safety rechecks and UNKNOWN preservation. Do not silently kill/restart/re-spawn a still-starting child. Existing request accepts a signal, so this need not alter every client's default status behavior.

Do not optimize by removing/caching away boot or owner rechecks. Accurate optimization needs stage timings around existing checks first; optional debug timing is another proposed change, not permission to alter the protected sampling policy.

Current delegated authority covers read-only investigation and independent tests. Product edits to CLI wait duration/diagnostic behavior are outside the prior narrow boot-identity repair; parent should present this concrete scope for explicit approval before implementation/deployment. No Next UI change or platform decoupling is needed. Immediately independently completable work has been completed: exact installed source/line diagnosis, fake-time regression candidate, actual open call counts, and artifact-bound report. Historical per-stage attribution remains unavailable without instrumentation and a separately authorized future startup; it is not a reason to restart PID 7156 now.
