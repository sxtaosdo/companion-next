# Keyword file ingestion follow-up: coordinator handoff

Checkpoint: 0a13df4 (prior deployed fix 9eebef8); final clean source commit: 277acc4fac665a73298373688dd2513e3e8eb93c.

Candidate: candidate-round2/weknora.exe
SHA256: 11abf6df9abe6503f3da8bd542cf3cf907ce90f311ad6dd6ad0d97b7d870cbe3
Bytes: 219049472
Manifest: candidate-round2/deployment-evidence.json
Manifest SHA256: ba9f794517afd97efc819d66baa8a14fb07c2f74335e05b9cf30fb285bff0e20

This supersedes the first candidate's file-ingestion behavior. Runtime upload had exposed GetEmbeddingModel client construction before the earlier channel filter. Both processChunks and synchronous ReparseKnowledge cleanup now read existing tenant-scoped model Dimension metadata via GetModelByID without creating an embedding client for keyword-only. The production hybrid keyword index accepts a nil embedder; vector-enabled paths still construct the original model. Cleanup retains 1024 (or the existing configured positive dimension), including dimension-addressed stores. Missing/nil/nonpositive dimension or repository errors fail before keyword cleanup; this is not a claim that every possible reparse failure retains old content.

Offline tests: old9eebef8 reproduces failure of 6TXT +2 file-worker cases when GetEmbeddingModel fails. New focused27 top-level tests pass across7 packages; final followup9 top-level pass includes metadata failures3cases, fileworker->ReparseKnowledge->actual queued fileworker bound/unbound, and cleanup dimensions [1024,1024,1024]. Six TXT cases complete real disabled-enrichment postprocess. Original source dirty/index/working diffs unchanged;25/25 reader-recovery overlay files byte-identical. No full-suite or live acceptance claim. The INVALID encoding log is excluded from regression evidence.

Deployment remains coordinator-only: back up current deployed3c6b2e...EXE and full original manifest. Replace only D:/services/weknora/normal-reader-recovery-v0.8.2/weknora.exe, update original manifest.files.weknora.exe and append fix evidence. Preserve all DLLs and other historical fields. Candidate manifest is proof, not a full historical-manifest replacement. Start-PilotAccess.ps1 remains unchanged; launcher.original_sha256=d5d799ea341e0bd4bc77fbb39f7d673e9e9200cfb1a021c93cc7b8a9737ed233 remains available for CAS. Parent manages its approved exact3doc startup checkpoint separately.

Reparse ONLY these already-uploaded own documents in KB c5f0a1bd-5748-4716-ab5c-36f08378a3c0; do not upload again:
-420b32ba-7b7c-4e02-b217-67dae10290a1
-597308d8-4b49-49e4-8bc9-910283ad2ec5
-c3f20493-a45a-4ec6-a5ae-2b58ce4645b0
Protect original1647 documents and356 finalizing indexes. No SSRF/config/tenant/housekeeping changes. No model, service, browser, API, DB or credential operation occurred in this lane.

Evidence: round2-validation-summary.json; round2-red-tests.jsonl; round2-focused-tests.jsonl; round2-followup-tests.jsonl; round2-build-receipt.json; round2-build-metadata.txt; overlay-preservation.json. Go executable has no embedded vcs.revision; local fix provenance is clean commit + source hashes + receipt + manifest. handler.CommitID remains upstream3e8b0b...

Remaining gap: chunk.go syncChunkIndex (chunk editing), summary refresh, retrieval inference and unrelated pipelines were not modified/tested here. Next runtime acceptance of exactly3docs is pending coordinator. Roll back EXE+manifest via approved coordinator maintenance flow if necessary; never restore a historical DB.
