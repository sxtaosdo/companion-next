# Native chooser stdin inheritance repair — 2026-10-18

No-cache/no-save diagnostic reproduced the cause: with a Windows parent blocked reading its private maintenance stdin pipe, original Python Popen inherited that same standard input and the chooser child stayed at zero user/kernel time with no window. Releasing only the control read20seconds later let that same child execute and show the original window. Direct chooser startup, Node minimal-env startup and Python normal worker startup all succeeded, ruling out missing Pillow/Tk and the minimal environment.

The owned hosted_owner now changes only its Windows process STD_INPUT_HANDLE table entry to a held NUL during the complete serve lifetime. Existing sys.stdin and CRT fd0 retain the original maintenance pipe. Subsequent original subprocess.run defaults inherit NUL. Restore the previous standard handle after handler/busy/worker drain and before closing NUL; closed acknowledgement is emitted after restoration. No dup2, original pipe close, original source/UI change, permissions change, new browser API or listener range.

Two Python tests passed (real Windows handle identity/restoration-on-error and existing handler/busy/worker lease order). NUL diagnostic showed original chooser ready while control ReadFile was still blocked; cancel completed before maintenance input was released. Private control EOF/close semantics remain. Architecture review approved this scope. Evidence is in taskTemp native-inherited-stdin-{before,after,proof}.json and native-nul-{stdin,window}-proof.json.

Inventory diagnosis: selected68a5dccc481a8588 colony-flow-food-hunt (P4000). Its path/fingerprint match, but connection file from2026-10-15 points to127.0.0.1:12219; direct TCP and original asset.list log show ECONNREFUSED. Restore only when authorized by opening that same project in Creator and restoring its Bridge extension/current connection; no Creator or new listener was started for this check.

Directed post-deployment cases are prepared in a fresh task-only cache: cancel, known hash-mismatch row failure without output, valid PNG+source success. Original user cache is never read or modified. These page outcomes are not claimed until their actual directed proof is complete.

Final formal verification passed all three native outcomes on daemon20116: cancel no output/history, known SHA row failure no output, success exact PNG+source and UI receipt. Real Bridge recovery and733-row inventory also passed. See owner-host-acceptance-20261018.md and taskTemp directed-formal-proof.json / bridge-recovery/real-inventory-proof.json.
