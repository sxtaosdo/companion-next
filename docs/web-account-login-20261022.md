# Browser account login implementation — 2026-10-22

## Status

Source implementation is complete in the existing Companion repositories, but is not deployed. The running single backend remains 127.0.0.1:32180, PID 33432, frontend 1.3.179 and backend 0.3.143. Its previous terminal authorization guide is not the requested final experience. No second Companion instance was started.

## Reuse and implementation

The login and captcha interaction are adapted from the existing MIT-licensed Cool-admin Vue 8.x implementation in game-ops-admin; attribution and license are retained in src/login/. The independent upstream is https://github.com/cool-team-official/cool-admin-vue/tree/8.x with its Midway backend. This is not a claim that Cool-admin was the original Companion Next template. Companion upstream and source limitations remain recorded in source-and-reuse-policy.md.

The existing Midway provider verifies passwords and accounts. Companion adds a fixed same-origin bridge for configuration, captcha, login and local logout. Provider JWTs remain server-side. HttpOnly, SameSite=Strict browser sessions are bounded by provider expiry and checked against current user identity, status and revocation. There is no refresh-token persistence, new password algorithm, account database, signing key copy, or default allowed account.

Only login.js and login.css are public login assets. Existing Host/Origin controls remain. Safe internal return targets preserve Next hash/query without allowing external redirects. Login errors refresh captcha and clear the submitted password. Success requires a subsequent authenticated session check. Existing input retention remains in memory; writes are not replayed. Logout removes only the Companion mapping.

The example companion-web-login.example.json has an empty allowlist. The local policy file has not been created because the permitted username has not been supplied.

## Verification

- Backend focused suite: 71/71 passed, covering provider contracts, expiry/revocation, deny-by-default policy, HTTP security boundaries, static allowlist and historical-stop regression.
- Backend full TypeScript check and direct isolated CLI/daemon bundles passed. The shared build script that stops a daemon was not invoked.
- Login/recovery frontend suite: 59/59 passed; Vue type checking and dedicated login/workspace builds passed.
- Headless Edge login render: 19/19 fixture checks passed, no page/CSP errors. Logout render: 3/3 passed. These are isolated fixtures, not successful authentication against a real account. Hash landing was tested; real provider HTTP redirect/account login remains unverified.

Evidence: C:/Users/33272/Documents/Codex/2026-10-17/task/login-guidance-20261022/account-login-render.json and logout-render.json; isolated backend builds and provider logs are under task/web-account-login-20261022/. No credentials are included in these records.

## Actual provider startup and blockers

One startup of the existing server/local-start.cjs using the existing Node 22 runtime was attempted. It failed with listen EACCES at 127.0.0.1:8001. Read-only OS inspection found FlClashCore.exe PID 11836 holding a Bound socket on 0.0.0.0:8001. No retry, port change, FlClash stop or network modification was performed. Only our failed wrapper/child (35160/23088) were cleaned up after identity checks; both are absent.

The provider configuration has synchronize=false, initDB=false and initMenu=false. The existing protected signing configuration was reused internally by the official launcher. No account setup, schema initialization, migration command or credential generation was executed. This is configuration/log evidence, not a byte-for-byte database audit. The failed bootstrap may have opened the existing database before binding failed; no real login/captcha requests were sent.

Read-only port check: 18001 currently has no TCP entry; 8002 is also Bound and is not a usable recommendation. Port availability is only a snapshot and must be rechecked before an approved start. Using 18001 would require changing both the existing provider local port configuration and the Companion fixed provider endpoint, with tests updated to the same exact address. It would remain loopback-only; no change has been made.

Remaining prerequisites: an explicitly permitted existing username, and a decision resolving the provider port conflict. Deployment and real browser login acceptance follow only after these prerequisites; do not substitute a mock account result or leave an unusable login page on the running backend.

## Approved port change and actual readiness

The user subsequently approved 127.0.0.1:18001. The original binding and executable consumers were backed up in task/web-account-login-20261022/port18001-before/manifest.json. Provider source and installed config now bind only that address. Existing launcher/listener checks and operations frontend proxy targets use the same exact port. Companion's source adapter target is also18001; the running32180 bundle has not been replaced.

The official protected-config launcher started wrapper5548/backend32848. Actual version and captcha endpoints returned HTTP200 and business code1000. Captcha verification recorded only presence/format, not challenge contents. Actual adapter readiness returned available=true/configured=false, and default-policy captcha access was denied. No credentials/login were submitted. Current provider build metadata remains0.1.0.19; this port configuration update is not represented as a new complete product build.

Read-only account inventory returned one existing enabled username, sxaosdo, role label gameops-owner. It has NOT been granted Companion access. No password/hash, signing values or personal fields were read. The user must explicitly choose an allowed username.

Next npm start now calls the existing Node22 launcher in backend-only mode before Companion startup. It reuses existing process ownership/readiness inspection, never invokes account initialization, opens no9000 frontend or browser, and does not restart an existing provider. Missing accounts/config or unknown ownership stops the dependency path. Cold/reuse behavior is simulated in tests; real reuse returned ready=true/port18001/PID32848.

Fresh regression: provider launcher34/34, Next startup16/16, Companion auth71/71. The source adapter's real provider connection also passed with empty allowlist. No extra Companion instance, Creator action, model request, FlClash change or32180 restart occurred. Full real account login/deployment remains blocked only by the permitted username.

Rollback: preserve all account data and protected secrets. Restore only the backed-up configuration/launcher files and source target if a rollback is approved, then use normal identity-checked service lifecycle; do not restore a database or stop FlClash. The original8001 conflict would remain, so rollback is not a functioning port workaround.

Observed side-effect boundary: operations web build/cool/eps.d.ts and eps.json are dirty generated API metadata. No initial web-worktree baseline was captured in this port phase, so this record cannot attribute every difference to startup. These files were neither staged nor reverted. Existing provider EPS remains enabled; no database initialization or credential generation command was executed.

## Approved account and live delivery

The user explicitly approved sxaosdo. Its exact existing identity and enabled status were verified using only id/username/status; the local ignored policy now contains only that username. No password, account, role or credential was changed.

Normal guarded daemon stop returned PASSED; oldPID33432 exited normally. Matched CLI/daemon/manifest/package and Next/login assets were installed in the same existing path after hash-verified backups. One npm start was issued with --no-browser. NewPID28744, epoch181145b3-7214-440e-91e2-a94ce4c5b617, is OPEN at32180; providerPID32848 remains at18001. HistoricalUNKNOWN2 and all8 registrations remain. No force kill, Windows restart, new backend port or Creator action occurred.

Actual served versions: frontend1.3.180, sourcec328ffd; backend0.3.144, sourcec14014f2df6b6ecdbd0e5387e5b5214926a108c8, buildc14014f2df6b-c17649c862cf. DaemonSHA256c17649c862cfa0986f2b9d6eabf64dbe741862347fac8bb01b33c7069be0bd69.

Real headless Edge acceptance passed27 checks: username/password/captcha rendering without terminal instructions, real provider readiness and captcha refresh, exact allowlist and synthetic nonlisted-account rejection,401/403 boundaries, safe hash/query return, original trusted one-time Cookie compatibility,8 projects, actual product versions, expired-session input retention and account-login iframe, logout, and no script errors. No actual account password was submitted. User password/captcha success remains the one user acceptance step. Evidence: task/web-account-login-20261022/live-account-login.json.

The initial npm command reported LOCAL_START_FAILED at its final confirmation even though it had started the daemon. No second start was issued. Independent authenticated reads confirmed OPEN and8 projects; the exact post-start read-only confirmation is checked separately. This command anomaly must not be represented as a failed service or hidden by repeating restart.

Entry: http://127.0.0.1:32180/next/index.html . Use sxaosdo with the existing password and the displayed captcha; never send the password to the agent.

## User-confirmed login acceptance

2026-10-22 05:17 UTC: the user personally confirmed real account login success. Exact messages: “好了” (Sentinel_eff446e6f96c8191a6ffffb5807a0f05) and “已经登录成功了” (Sentinel_d0ec514bf61881918e39ad2ca5fbc950).

The password/captcha login was completed by the user. The agent did not read, submit, reset or modify account credentials. Password-recovery investigation/planning is stopped; no additional logout, session test or service restart was performed for this confirmation. This closes the login acceptance task only; outstanding art/resource-generation tasks retain their separate status and are not marked complete.


## 2026-10-23 fixed-seven-day delivery and Codex reconnect check

User-approved scope: Companion-only password login without captcha, fixed seven-day lifetime across refresh/service restart, immediate explicit logout; existing account/password, exact allowlist and operational login remain unchanged. Provider uses its existing verifyPassword/user status/passwordV/role checks and CoolCacheStore under a separate Companion namespace. No operational JWT/SSO cache or login/captcha route was modified. New scoped routes retain loopback/precise Host and reject browser Origin. No password or static credential was read, reset or created.

Source checkpoints: Next `f1d5c1f` (product1.3.185; internal245), host `2b09bc3` (0.3.146), provider `638e08f` followed by actual-bootstrap registration fix `a98e5a4` (0.1.0.25). The first provider build omitted explicit component registration while bootstrap disables directory scanning: health returned DI injection failure. Reused its existing Configuration component list, added the missing service and a bootstrap-contract regression, then updated only that dependency. This runtime wiring failure was real; domain tests alone did not catch it.

Verification: frontend29/29; host22/22; provider10/10 including actual temporary-directory CoolCacheStore persistence with fresh service/store objects, fixed expiry boundary/no sliding, durable logout, password/disabled/role/identity revocation and bounded failed attempts. Frontend, host and complete provider typechecks exited0. Compiled desktop/mobile fixture14 checks; real deployed Edge18 checks. Real page showed only username/password and seven-day notice, no captcha. Actual public login asset hashes matched; unauthenticated navigation/401, unsafe return400, foreign Origin403 and provider direct-route rejection retained. No real account password was submitted and the user's browser/session was not explicitly logged out. Real new account login remains user acceptance, not asserted by mocks or trusted-local automation.

At **2026-10-23 01:31 UTC**, original32180 was OPEN/PID26176, frontend1.3.185/buildf1d5c1f+working, backend0.3.146/build2b09bc3b43ae-407510f34676; provider18001/PID25820/version0.1.0.25. All original eight IDs remained and a preexisting additional golden_horse_86_cocos388 made nine. No registration, resource, Creator or model action was performed for this task.

Deployment-order defect: a preflight returned `Preflight busy or identity changed` but the subsequent official guarded stop was still dispatched (operation b220ec0f-447c-4ce7-9ea6-ddd9de897ae9, PASSED). The exact failed snapshot was not retained; the hard-coded eight-project assertion definitely disagreed with the actual nine, but other contemporaneous conditions cannot be reconstructed. Do not claim a retained zero-activity preflight. Backups were completed after guarded stop and before any replacement. The gate itself was not weakened; actual recovery readings showed all current work counters zero and historical UNKNOWN2 retained. No task replay/deletion or unprotected task loss was observed. Future dependent stop must run only after inspecting and accepting the actual preflight result.

**Reconnect result, 2026-10-23 01:34:33 UTC:** /login and /api/auth/config on32180 and provider/version on18001 all returned ECONNREFUSED; prior PIDs26176/25820 no longer existed. Cause of process exit is not proven. This task's reconnect scope explicitly prohibited repeated start/deploy/stop, so none was issued. Installed20 file hashes still match Next1.3.185, host0.3.146 and provider0.1.0.25; installed bytes are not runtime health. The original npm start -- --no-browser is the next recovery action if authorized, after identity/conflict checking. Do not tell the user the page is currently available based on the earlier success.

Evidence: C:/Users/33272/Documents/Codex/2026-10-17/task/login-week-20261022/ → frontend-tests.json, host-tests-final.json, provider-tests-final.json, render-fixture.json, live-state.json, live-browser.json, live-login185.png, post-codex-restart-health.json and post-recovery-installed-hashes.json. Backups: before-week-installed/ (19 initial files), before-provider25/ (six dependency files). Original deployment-plan offline pre-stop snapshot fields are unavailable, not evidence of zero projects. Restore backed-up files only after an appropriate service stop; no database/account migration is needed. No screenshots uploaded.


### Subsequent read-only observation after recovery

At 2026-10-23T01:38:05.224Z, without any start/stop/deploy issued by this reconnect pass, both original endpoints were again HTTP200. Authenticated observation confirmed32180/PID9264/OPEN/backend0.3.146/build2b09bc3b43ae-407510f34676, provider18001/PID23848/version0.1.0.25; all original eight registrations plus the additional existing project remained (nine). /api/auth/config reports available:true, configured:true, captchaRequired:false. Installed20 file hashes match the previously accepted Next1.3.185/host0.3.146/provider0.1.0.25 artifacts. The source of this intervening service start is not proven and is not attributed to this task. This later observation supersedes the earlier refusal as the latest health evidence; earlier failed checks remain historical facts. Real password login still belongs to the user; no user logout/password operation was performed. The previously saved blank deployed login screenshot was visually reviewed after reconnection and shows the two-field form and seven-day notice.
