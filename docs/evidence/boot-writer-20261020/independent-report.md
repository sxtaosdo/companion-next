# Independent writer admission results

Final run: 35 passed, 0 failed, 0 skipped on Windows. See results-final.json and source-binding-final.json.

All fixtures live under this independent Temp directory. No installed daemon, actual lock/history, service, Creator, OS setting or product file was changed. Existing Node/Vitest dependencies were reused.

Verified coverage:
- Legacy binding absent or mismatched anchor/session/hash/size/identity refuses; any present legacy PID and failed observation refuse.
- Exact bound absent legacy owner recovers the same canonical GUID path while retaining inode/bytes and preserving journal/head/legacy bytes.
- V2 exact live owner refuses; known PID reuse permits writer-only transfer without process control. Current owner post-open does not recover itself.
- Session changes refuse. Interrupted retention and competing wx opens admit one writer.
- Real Windows retention keeps exact filename/inode/bytes despite poisoned inherited PSModulePath; wrong hash/size, hardlink, junction and existing destination refuse.
- Existing destination tested ten times with source/target byte checks and no random filename suffix; two native retainers race with exactly one success.
- Actual NativeMaintenance.open uses a valid hash-chain journal and synthetic OS observation seam. Native retention is real on Temp files. New schemaVersion 2 lock and post-open owner check pass.
- UNKNOWN remains historical 2, archived 0, unproven 2. observeHistory retains NATIVE_PRIOR_EPOCH_UNVERIFIED; verifyExit refuses; journal/head/legacy remain byte-identical.
- Reverse boot inconsistency/foreign machine refuse; writer-only recovery cannot grant native quiescence.

Defect found, fixed by parent: initial FILE_RENAME_INFO lacked terminating WCHAR. One allocation renamed to desired name plus three random Unicode characters while returning success; original existing destination remained intact. Evidence destination-evidence.json and destination-raw.json. Parent added two zero bytes outside FileNameLength and included them in buffer length. All 35 final tests pass.

Limits: boot/process observations are injected fixtures. No HTTP or installed-service startup/deployment tested here. Other compatibility paths remain parent validation scope.
