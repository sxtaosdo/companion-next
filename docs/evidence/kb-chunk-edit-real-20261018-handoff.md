# Keyword chunk edit candidate: coordinator handoff

Checkpoint:57d2497 (clean accepted file fix277acc4). Final clean commit:b469ba0fc6c5070cf752d0b33e7d0fdb97bed420.
Candidate:candidate-round3/weknora.exe
SHA256:b05899bc8ccaf299f8d5b5bb7c131cedf81491e51b02906b4321d72c10d6ce64
Bytes:219052032
Manifest:candidate-round3/deployment-evidence.json
Manifest SHA256:9ebea18ef3d1733eed7c830bb1b708e526810bcec89cbff3df0386f25b5687cf

This adds only the approved syncChunkIndex repair. Keyword-only UpdateDocumentChunk now uses the shared tenant-scoped GetModelByID Dimension helper without constructing an embedding client. Resolved ownership/store routing remains intact. The original composite cleans the index at its existing1024/example dimension; a strategy-filtered independent composite writes the new keyword index. An empty channel intersection fails before Delete/BatchIndex. Vector-enabled edits still construct the embedder and produce vectors. Keyword disable removes its index without model-client construction.

The existing summary function is unchanged. SummaryStatus none/empty enqueues no task; existing summary-enabled documents retain their summary task. The test's summary boolean models these status values, not a new override policy. No blanket assertion that every process override stops all future refresh paths is made.

UpdateDocumentChunk preserves its current partial-success contract: body/revision is saved before reindex; metadata or channel failure returns the saved body with index_status failed. Tests assert the old index remains when failure precedes Delete; there is no atomic body rollback or new transaction/UI.

Evidence:round3-red-tests.jsonl reproduces all4 keyword edit cases against pre-fix code. round3-focused-tests.jsonl passes13 top-level tests; final round3-followup-tests.jsonl passes15 top-level across only2 affected packages. This includes bound/unbound edits with SummaryStatus none/completed,2 empty-channel cases, metadata error, disabled chunk, vector behavior, existing image/parent edit tests and shared-helper file/reparse regressions. round3-validation-summary.json records original source/index/working diffs unchanged. overlay-preservation.json confirms25/25 exact reader overlays. No full-suite claim.

Deployment is parent-only. Preserve candidate-round2, original runtime path, unchanged launcher and original4DLLs. Back up current liveEXE+full manifest, replace only D:/services/weknora/normal-reader-recovery-v0.8.2/weknora.exe, update original manifest.files.weknora.exe SHA/size and append this targeted proof. Do not replace the full historical manifest with the standalone candidate manifest. launcher.original_sha256 remains d5d799ea341e0bd4bc77fbb39f7d673e9e9200cfb1a021c93cc7b8a9737ed233 for CAS. No new config, identity, permission, SSRF, tenant, housekeeping or startupguard change.

Approved live scope remains KB c5f0a1bd-5748-4716-ab5c-36f08378a3c0. Parent will edit ONLY01 current chunk c9c6635b-ade9-442a-9c51-00dfe0fdc7ea revision0->1 using one synthetic marker; confirm new keyword hit/old keyword absent. Restore ONLY its original document via ordinary reparse so the original source-derived whitespace also returns. SourceTXT unchanged, other2 test docs not written, original1647 untouched. This lane never performs these operations.

Build:existing offline toolchain, Build-KeywordFix-round3.ps1 -Phase build exit0 from clean committed source. round3-build-receipt.json records artifact SHA/bytes; round3-build-metadata.txt records go version -m. No embedded vcs.revision claim; handler.CommitID remains upstream. Provenance is clean source commit+source SHA+build receipt+candidate manifest. Independent reviewer final hash confirmation is coordinator follow-up.

No running service/API/browser/DB/model/credential operations occurred in this lane. Actual runtime edit/index search/restoration acceptance remains pending parent. Summary refresh inference and unrelated pipelines have not been expanded by this repair.
