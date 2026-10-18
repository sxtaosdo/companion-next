# Creator-only installation acceptance (2026-10-18)

Status: the bounded 10 combination and production different-options conflict passed. Source checkpoint 5152a24 / 1.3.173.110. No product source changed for this acceptance.

## Actual Next workflow

The existing formal-session Next wizard submitted startCreator=true and configureCodex=false for fixture a79f4915296f4091. POST /api/setup/options-v1 returned 202, operation 6066d613-099c-480c-9595-4e3b70e066c0, reused=false. Bridge was already current at 0.3.138; its 12 managed files matched the installed bundle before the run. Stages reached installing-bridge, opening-dashboard, then complete.

The fixture became ready as Creator PID17476/session0401dbc7-e767-4886-b15a-541930bf7c42. The normal setup dependencies verified creator.projectInfo fingerprint and creator.ping. The real Next completion receipt was visible and captured. This does not repeat the earlier Preview/Profiler or 96-variant acceptance.

While 10 was active, a direct formal-cookie API request for 00 returned 409 SETUP_OPTIONS_CONFLICT, retryable=false, and the same active operation ID with effective options still 10. The conflict request was an API call, not another UI click. No Codex persistent configuration was written.

## Failure, recovery and environment repair

Attempt1 used an incorrect helper lifecycle route and stopped at 404 before any state change. The helper was corrected to the existing /api/projects/:id/stop and start routes.

Attempt2 exposed an operational mistake in our previous restricted daemon launch environment: it omitted ProgramFiles, ProgramFiles(x86) and ProgramW6432, which the existing Dashboard discovery uses. Setup failed explicitly with DASHBOARD_NOT_FOUND. The installed Dashboard itself was present. No lifecycle/product/security code change was made. The normal API start also returned 409 with the same Dashboard discovery defect. The original project was then recovered through the already-running Dashboard's supported Project.open renderer IPC, returning ready PID7808, unsaved=false.

After two idle/inflight snapshots with all counts zero and unknown=[], the original guarded CLI stopped and restarted Companion with those three ordinary system path variables restored. PID17672 became PID18036; bundle SHA remained 148f28ad4989a038de1825beae197c4db9947f3209a8f22cf07ec330047df526. Creator7808 kept its PID/session during that daemon restart. Exact-environment Dashboard discovery and the original CLI UI entry both passed. No knowledge credential was injected. Three existing Companion tabs were refreshed/reauthed; all nine original tab IDs and selected tab were preserved. The archived browser receipt proves the final refresh/preservation result; it records closedOnlyNewAuthTabs=[] and does not separately prove intermediate tab closure or refresh-control fallback events. Raw failed-attempt journals remain in task Temp and have not been rewritten.

Attempt3 then passed the full 10 workflow above.

## Restoration and limits

The original project was ready and unsaved=false before the authorized switch. The fixture was also unsaved=false before normal stop. After its process and listener release, its server profile was restored to the original bytes. The original project was reopened normally and returned ready PID21004/session b0471fa2-0879-4f30-b27f-7038dd6ef8cc, unsaved=false. Its PID/session necessarily changed through this approved stop/reopen.

The fixture temporarily reused the existing Creator preview binding ::7456. Additional bridge/debug bindings were loopback only; no new broader/public binding was accepted. Existing model processes and WeKnora were not operated. projects.json, bridge-installs.json and tool-presets.json ended byte-identical. Protected cocos-mcp, original game and variant fixture HEAD/status/work/index snapshots were unchanged. The daemon remained18036 throughout attempt3; restorationErrors=[], blocked=[], pageErrors=[].

This closes 10 and production differing-options409 only. Codex-enabled 01/11, real persistent client conflicts/partial failures, native IDE delivery, knowledge ingestion/retrieval and real model operations remain separate unverified items. Overall migration alignment is not complete.

## Evidence

- [Execution](evidence/creator-only-real-20261018-execution.json) and [journal](evidence/creator-only-real-20261018-journal.json).
- [Actual Next completion](evidence/creator-only-real-20261018-next-complete.png).
- [Environment repair](evidence/creator-only-real-20261018-env-repair.json), [Dashboard recovery](evidence/creator-only-real-20261018-dashboard-recovery.json), [browser preservation](evidence/creator-only-real-20261018-browser-restored.json).
- [Archive hashes](evidence/creator-only-real-20261018-manifest.json). Original attempts/backups remain under Temp/companion-creator-only-real-20261018 and Temp/companion-env-repair-20261018.

Independent readonly review confirmed the bounded 10/API409/restoration conclusions and all six archive hashes. Its browser-event evidence concern was resolved by narrowing the claim to the archived final receipt.
