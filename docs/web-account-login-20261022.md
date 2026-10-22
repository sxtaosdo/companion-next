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
