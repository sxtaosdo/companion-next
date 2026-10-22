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
