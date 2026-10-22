# Local authorization guidance - 2026-10-22

Status: DEPLOYED and verified on the sole production loopback instance 127.0.0.1:32180. Frontend1.3.179 / backend0.3.143.

## Reuse and scope

See [source and reuse policy](source-and-reuse-policy.md), referenced by AGENTS.md. Reuse the existing Companion local CLI and single-use-code-to-HttpOnly-Cookie exchange. No password system, public credential issuer, credential persistence, LAN access, or permission changes were added.

Proven gaps: the host returned raw403 for missing browser sessions; the CLI had no safe Next return target; Next had no session-expiry UI. Added only guidance/return-path wiring and in-memory recovery presentation around existing authentication.

## Behavior

- Missing-session browser navigation to root/Next receives a local authorization guide. Existing Host rejection remains403.
- Only the existing Bearer-protected local entry can issue a one-use code. CLI ui --return-to selects a validated internal Next destination; the default old entry remains compatible.
- Missing UI sessions return401/UI_SESSION_REQUIRED. Host, Origin, API Bearer, and business denials are not converted to login success.
- The recovery dialog leaves the existing page/form mounted. It verifies the original browser Cookie before closing. No GET or mutation is automatically replayed.
- Return targets preserve valid internal query/hash and reject external paths, controls, and credential parameters. The iframe accepts only its own exact-origin, exact-source, single-field restoration message.
- Authorization in another browser profile cannot restore the original profile. Guidance states this limitation; no browser boundary is bypassed. Existing local entry is still required.

## Verification

- Backend: 25 new in-process handler/HTML-script tests plus23 original CLI tests:48/48 passed. No server.listen or Creator operation was used.
- Frontend:33 new recovery tests and53 existing App/navigation tests passed.
- Both TypeScript checks passed; Next workspace build and direct isolated CLI/daemon esbuild bundles passed. The shared build script was deliberately not invoked because it has a separate stop-previous-daemon side effect.
- Headless Edge:14/14 rendered checks passed, zero page errors, using actual loginGuidanceHtml and nonce CSP with route-fulfilled fixture APIs. Tested retained real form DOM/value,403 distinction, exactly one POST, failed authorization, explicit retry, same-context Cookie success and other-profile isolation. These are isolated browser tests, not live authorization acceptance.
- Independent read-only security review passed after fixing hash credential filtering.

Evidence directory: C:/Users/33272/Documents/Codex/2026-10-17/task/login-guidance-20261022/
Key files: session-recovery-render.json, session-recovery-render.mjs, build/creator-ai.js, build/companion-daemon.js. Local screenshots retained, not uploaded.

## Actual service recovery and deployment

User explicitly authorized service-only recovery, recoverable history cleanup if necessary, and termination of the exact verified idle daemon if its confirmed lifecycle bug prevented graceful exit. No Windows restart was performed.

The old normal stop returned409 with only prior history remaining. PID11604 was rechecked against its full startup identity, entry SHA256, OS creation identity, v2 writer owner, OPEN phase, and zero current activity. Only that PID was then terminated, without a process tree or other application. This is recorded as a bounded process termination, not a graceful close or cancellation proof.

Fix: service-local idle ignores only nativeEpochUnproven and NATIVE_PRIOR_EPOCH_UNVERIFIED. Current work, nativeUncertain, other unknown states, identities, generation, observations, and writer cleanup still protect stopping. No global Creator quiescence is claimed. Code and tests: shared commit dd3eacd477ac7e0e03e459f4874d5816134abe0b. Independent review passed. Backend targeted regression80/80 and TypeScript passed.

The six matching CLI/daemon/map/version files and Next static assets were backed up, installed offline and hash checked. The existing v2 protocol retained the exited old writer lock and acquired the canonical lock after OS identity verification. No manual lock deletion was used. Both historical UNKNOWN entries remain unchanged;0 history records deleted,0 quiescence proofs fabricated. User-authorized deletion proved unnecessary once the application lifecycle defect was fixed.

Current sole host PID33432, epoch c873e8c2-28fc-4b9d-a855-7be8023f479c, OPEN. /api/projects and /v1/projects both200 with the same8 registrations. Backend0.3.143, build dd3eacd477ac-ac2afa7a3e54, daemon SHA256 ac2afa7a3e541ed26f8400c235e8b15916898f26f4bc4862761307c79eebb013. Frontend1.3.179, static source e47c84d; HTTP index and JavaScript hashes match installed bytes. No new backend instance or visible browser window was created; no Creator/model/resource generation operations occurred.

Actual Edge acceptance15/15: unauthenticated navigation, preserved internal hash/query, official one-use exchange, Cookie authentication, one-use rejection, visible frontend version, Host/Origin/Bearer403 retained, expired Cookie401, actual project search input DOM/value preserved, failed authorization does not dismiss guidance, and successful same-session recovery. Earlier14 fixture render checks and33 new+53 existing frontend tests remain separate evidence, not substitutes for this live acceptance.

A readiness snapshot can race with normal page polling after successful startup. The entry now retries only409/DAEMON_GENERATION_CHANGED GET observations, at most5 times in10 seconds, never restarting again or retrying a mutation/permission denial. Startup tests14/14. The real npm run start:next -- --no-browser command exits0 and reuses PID33432. The frontend product/build are unchanged by this script-only follow-up.

## Backup, audit and recovery

Evidence root: C:/Users/33272/Documents/Codex/2026-10-17/task/login-guidance-20261022/

- deployment-live-verification.json: actual identity, versions, HTTP hashes and eight project IDs.
- live-login-browser-final.json:15 live browser checks; live-login-browser.mjs is the repeatable test.
- service-termination-audit.json: exact old PID identity, zero-current-work observation, normal-stop failure and narrowly authorized termination.
- deployment-before/: original six installed files and complete previous Next static folder; manifest.json records old hashes.
- history-backup/:5 copied historical maintenance files with JSON/readability/SHA256 validation, manifest and RESTORE.txt. No files were removed from live history.

Rollback only during an authorized service maintenance window after its normal guarded stop has completed and the exact process is confirmed exited. Restore the six matched deployment-before files and its Next folder together, then use the existing single32180 official startup entry. Preserve current configuration, projects and history. Do not restore old lock ownership into an active writer. The old version has the historical-stop defect, so rollback is an emergency fallback, not a reason to repeat the old maintenance loop.

Source/reuse rules remain centralized in source-and-reuse-policy.md and referenced by AGENTS.md. Prior task-only checkpoint branches and backups remain; no remote push.
