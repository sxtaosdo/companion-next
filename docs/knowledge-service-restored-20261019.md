# Knowledge service restored and manual reader setup — 2026-10-19

8081 is restored. At 00:14 UTC the existing WeKnora PID16812 listens only on 127.0.0.1:8081 and GET /health returns status=ok. Companion PID8844 listens only on 127.0.0.1:32180. This final check reused both processes, with zero start requests. See [socket and health receipt](evidence/knowledge-service-restored-20261019/port-bindings.json).

The earlier real Edge check reached /login, HTTP200, title WeKnora, with a password input; no credentials were submitted. Companion reported auth=missing, keyword=unverified, writerEnabled=false and schedulerEnabled=false. No real reader was loaded or its credential-file path configured. See [bounded verification](evidence/knowledge-service-restored-20261019/restore-result-r3.json) and [blank login](evidence/knowledge-service-restored-20261019/login-blank.png).

## Recovery and preserved failures

The first original API start returned503: the preceding deployment's child PATH omitted WindowsPowerShell/v1.0, so powershell.exe failed ENOENT before the original startup script ran. This was our deployment environment omission. After two idle snapshots (all counters zero, no unknown work), the original guarded CLI restarted Companion2772 to8844 with the same daemon SHA9d2d01747eb2830d0b4d7c6b8456846fc02c131b9a1d4625839b4a4214f99fa5. Only the child PATH was corrected; there was no global environment or product source change and no forced kill. All four existing Owner environment paths were retained.

The next original API start returned200 and launched WeKnora once. Its following verification failed because our native-fetch script used h.status() instead of h.status. The corrected verifier detected the running instance and made zero start requests. The [503 receipt](evidence/knowledge-service-restored-20261019/restore-result.json), [guarded restart](evidence/knowledge-service-restored-20261019/companion-path-restart.json), and [200 followed by verifier error](evidence/knowledge-service-restored-20261019/restore-result-r2.json) remain archived.

Recovery used the existing D:/services/weknora/Start-PilotAccess.ps1 (SHA d5d799ea341e0bd4bc77fbb39f7d673e9e9200cfb1a021c93cc7b8a9737ed233) and original binary (SHA b05899bc8ccaf299f8d5b5bb7c131cedf81491e51b02906b4321d72c10d6ce64). Its guarded child configuration keeps AUTO_MIGRATE=false, AUTO_RECOVER_DIRTY=false and WEKNORA_HOUSEKEEPING_ENABLED=false. Normal startup reads its own database/JWT configuration; the agent did not extract or print secret values. No historical recovery, migration, indexing, Creator or model operation was requested.

The first cold original readonly state-check timed out at30s; its guard was not bypassed. The same original inspect_database routine then passed with a100s diagnostic budget in10.55s, using SQLite mode=ro/query_only/BEGIN. The post-check passed in0.38s. [Before](evidence/knowledge-service-restored-20261019/metadata-before.json) and [after](evidence/knowledge-service-restored-20261019/metadata-after.json) selected snapshots are deeply equal: schema30/dirty0, quick_check=ok, guarded trigger counts0, knowledges1650/chunks59433/lite_embeddings2272/auth_tokens38/users2/tenants2; selected knowledge-state SHA2bdae1ba12dad8adb3ce61a25fa57366081821e40af1abb4a236277fa2c7e2b5. This proves only the sampled fields and counts, not every document's metadata/body or database bytes. [Preservation](evidence/knowledge-service-restored-20261019/preservation.json) confirms original registries byte-equal and shared cocos-mcp HEAD/status/diff unchanged.

## User-local PowerShell commands — prepared, NOT executed by the agent

Run this block yourself in a local PowerShell window. It clears plaintext-key variables only in this shell and passes the existing DPAPI file path without reading its contents. The four Owner values preserve the current working Owner configuration during daemon replacement; a fresh shell otherwise lacks them.

```powershell
Remove-Item Env:WEKNORA_API_KEY, Env:KNOWLEDGE_SYNC_API_KEY -ErrorAction SilentlyContinue
$env:COMPANION_KNOWLEDGE_CREDENTIAL_FILE = 'D:/services/weknora/cli/private/pilot-recovery-reader.dpapi'
$env:PATH = "$env:SystemRoot\System32\WindowsPowerShell\v1.0;$env:PATH"
$env:CREATOR_AI_OWNER_PYTHON = 'C:/Users/33272/miniconda3/python.exe'
$env:CREATOR_AI_OWNER_BRIDGE_ROOT = 'D:/code/shidai3/P8000/companion-next'
$env:CREATOR_AI_OWNER_REVIEW_ROOT = 'D:/code/shidai3/P8000/public-image-review'
$env:CREATOR_AI_OWNER_CACHE = 'C:/Users/33272/AppData/Local/Temp/companion-owner-host-implementation-20261018/directed-acceptance-cache'
& 'C:/Program Files/nodejs/node.exe' 'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js' daemon start --restart --json
if ($LASTEXITCODE -ne 0) { throw 'Guarded Companion restart did not succeed; stop here.' }
& 'C:/Program Files/nodejs/node.exe' 'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js' ui
```

The guarded restart drains work and may refuse busy/unknown activity; it changes daemon identity and requires fresh UI authorization. Existing SSE/MCP/browser sessions may reconnect. It does not restart8081, Creator or models, change system environment, or write a plaintext API key. Do not use the old Enter-PilotCli.ps1 search helper. In the newly authorized browser session, open http://127.0.0.1:32180/next/index.html#/knowledge. Merely configuring the path is not proof of successful authentication: the private worker decrypts only upon a reader operation.

Choose the existing knowledge-list read action and confirm the sole allowed library ID da1051a5-3fff-4198-ba55-017ea79df9c3; optionally read at most3 document-list entries. The existing reader is keyID3, tenant1, retrieve-only, full_access=false, expiring2026-11-08T01:25:46Z. No key creation/renewal or permission expansion is included. This reader is an API identity, not a native Web-login JWT. Permitted reads include scoped library/document/chunk/original data and keyword search with --no-vector; no chat/Agent/inference/write/sync writer/ingestion/recovery is enabled.

Successful list/metadata reads would establish only that bounded integration. Keyword relevance, exact source reading, Agent/answers, sync and full legacy feature alignment need separate acceptance. The agent has not performed any real-reader positive read in this task.

## Review and limits

Independent reviewer found no P1/P2 in the restore receipts or manual plan, confirmed selected-snapshot equality and fresh-UI-authorization requirement. The final socket receipt closes its evidence-format concern. No preset/SSE/Creator suites were repeated; previous passes remain bounded to their recorded scope. No source patch, upload, push, new listening service, software install or security-permission change was made in this stage.
