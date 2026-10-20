# Authorized writer-only boot admission repair — 2026-10-20

Baseline Git 5b39b55 contains the 82 owned source contents from the installed
71cbf7d8bc200fdcc867da7ed3d671f00721e3cc025098624ba54a15ba8a167f bundle map.
The shared source checkout and its 22 existing changes are not build inputs.
`build-candidate.mjs` reproduces the installed bundle byte-for-byte first, then
overlays exactly six reviewed files. No UI, CLI or other source is upgraded.

The observed OS tuple has the same boot GUID as the original anchor but a
different PID4 creation time. This permits only independently verified writer
ownership recovery. The original quiescence anchor, journal, head, legacy lock,
handoff and UNKNOWN outcomes are unchanged. Native exit proof still requires
both boot GUID and PID4 lifetime to change.

The first v1 migration freezes exact prior lock bytes/hash, old locator identity,
current session and original anchor digest in a separate WRITER_ONLY binding;
the old PID must be positively absent twice. Later v2 locks carry genuine OS
creation identity and daemon identity. A living original owner is refused;
an observed reused PID is never controlled. Recovery retains the exact old file
object through an exclusive Win32 handle, validates its hash and single-link
regular-file attributes, and renames without replacing an existing destination.
Every contender still obtains the same raw-GUID canonical lock with wx.

Independent native testing found a missing UTF16 terminator in the initial
candidate: the Win32 normalizer could append random Unicode characters to the
retained name. This occurred only with test files; that candidate was never
installed. The corrected buffer includes a zero WCHAR, with FileNameLength
excluding it. The independent suite passes 35/35, including ten existing-target
iterations and the actual NativeMaintenance.open path retaining UNKNOWN2.
The original journal suite passes 30/30. See integrated-results.json for the
combined rerun and build-result.json for exact bundle/source hashes.

Two independent read reviews found no remaining P1/P2; they do not replace native
tests. The change intentionally does not generalize every stale-lock/startup
case: v2 recovery applies to the same-GUID/different-PID4 branch. Other branches
keep their original behavior. CLI's generic startup error remains unchanged.

Commands (existing dependencies; no installation):

```powershell
$env:NODE_OPTIONS='--no-experimental-webstorage'
node node_modules/vitest/vitest.mjs run tests/native-epoch-journal.test.ts tests/native-writer-recovery.test.ts --reporter=json --outputFile=integrated-results.json
node node_modules/typescript/bin/tsc --noEmit
node build-candidate.mjs
```

The copied historical native-maintenance.test.ts is excluded: it imports a
native-process-proof module absent from the actual installed source graph. No
obsolete module was restored to make that test load. Its unavailable run is
not counted as a passing regression.

Deployment is centralized through deploy.py: capture, exact two-file install,
then normal StartOnly/NoBrowser entry. No direct lock cleanup, native proof
issuance, Creator/model launch, client configuration edit or Windows setting
change is part of deployment. predeploy.json captures 312 runtime files,
immutable configuration/history and business table hashes before modification.
