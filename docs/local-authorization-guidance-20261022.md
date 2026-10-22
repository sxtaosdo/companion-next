# Local authorization guidance - 2026-10-22

Status: source implementation and isolated verification complete; NOT deployed.

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

## Current runtime and deployment blocker

Fresh read-only check: sole listener127.0.0.1:32180 PID11604, epoch4b5a46e4-44f0-434b-952f-b3870736d9a9, OPEN. Eight registered projects remain readable. nativeEpochUnproven=2 and NATIVE_PRIOR_EPOCH_UNVERIFIED remain present. Existing daemon SHA256 acce4593a02e50e90eac0045d6b7dd26e03da47cf4b9d8744d8bd728c734a915. An unauthenticated GET /next/index.html still returns403/Forbidden with no code: the source fix is not live.

No stop/restart, installed bundle replacement, static deployment, extra backend/window, Creator operation or model request occurred in this task. Frontend product version remains1.3.178; no product release was invented for a pending patch.

## Minimum remaining step

Apply matching CLI, daemon and Next static artifacts together only after a legitimate normal shutdown/maintenance path is available and the current process is confirmed stopped. Preserve the installed originals and data; use the original single32180 startup path and verify navigation, expiry recovery, versions and eight projects on that instance. Do not retry the known blocked stop, clear historical records, forge exit evidence, inject running code or force-kill to deploy. No compatible static-only change can make unauthenticated host navigation work while the old handler still rejects it.

The previous task-only checkpoint branch is checkpoints/login-guidance-before-20261022 in both repositories. Shared pre-existing edits are preserved; no remote push.
