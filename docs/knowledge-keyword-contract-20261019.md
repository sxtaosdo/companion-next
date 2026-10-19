# 已部署知识库纯关键词合同核对（2026-10-19）

根会话后续已通过原入口恢复知识服务并完成4次有界真实页面检索，正向3条、零命中0、越界403顶层AUTH_DENIED。下文为本lane只读核对时点；“服务未运行”和“尚不能确认断言错误”已由[后续实测](knowledge-sse-live-20261019.md)及安全回执闭环。该lane没有自行发API，实测由根会话串行完成。

模块K执行者 `/root/next_knowledge_read`。本轮只读核对实际部署产物、原CLI help、原启动guard和匹配源码，未执行search/API/浏览器/服务启停，未读取凭据内容或改索引。未重复上一批115项回归。

**结论：生产worker已经固定纯关键词开关，先前仅凭共享源码无法确认的边界现已收窄。沿用原支持启动入口恢复8081后，可由主会话在唯一已授权主KB进行有界纯关键词验收；本lane没有发出真实查询。三个既有合成文档所在隔离KB不在当前reader权限内，不能用它们做Next正向验收，也不应为验收扩大权限。**

## 已实际核实的路径

| 层 | 实际文件及证据 | 结论 |
| --- | --- | --- |
| worker安装字节 | `cocos-mcp/mcp/dist/companion/knowledge-worker.js` SHA256 `07c4861de1716058f79866df3b15e64286b1281da8478e5f8feef192964013d4`；map `8431aff6da611a4d836fa4b34f04e1629e0f1cb00baaa56cdb65e43e84cecb2c` | 与先前受保护worker一致，未改字节 |
| worker实际构建源码 | map sourcesContent 的 knowledge-worker-core.ts：productionReaderWorker.backend创建 `KnowledgeAdapter({apiKey:key, keywordOnly:true})`；knowledge-adapter.ts:262按keywordOnly追加`--no-vector` | 共享源缺该overlay，不能代表已部署行为；生产明确禁vector |
| reader边界 | map validReaderIdentity固定key3/tenant1/tenant scope/full_access=false/retrieve/唯一KB `da1051a5-3fff-4198-ba55-017ea79df9c3`，精确既有期限；serveReaderWorker先拒绝外kbId；IsolatedKnowledgeAdapter拒绝chat/Agent推理 | 不需要也不允许创建密钥或扩大授权KB；身份内容由现有正式流程处理 |
| CLI/profile | 实际CLI SHA256 `2c95e68e92a6de647e3c5ab82b767f8725e06934fe3a143c74123f578b74bec8`，与既有交付一致；实际 `search chunks --help`退出0，明确`--no-vector`禁vector。worker cliArgs追加原`--profile shidai3-pilot`；非秘密config仅该profile及127.0.0.1:8081 | help不执行search；CLI源码cmd/search/chunks.go:146将NoVector映射DisableVectorMatch，SDK字段为disable_vector_match |
| CLI线报文既有证据 | `D:/services/weknora/cli/evidence/mock-contract.json` 原7/7合成server测试，记录disable_vector_match=true、disable_keywords_match=false、单KB/上限3、零命中和401/403无重试 | 复用历史合同证据，本轮未新开监听或重跑mock |
| 服务安装EXE | `D:/services/weknora/normal-reader-recovery-v0.8.2/weknora.exe`实际SHA256 `b05899bc8ccaf299f8d5b5bb7c131cedf81491e51b02906b4321d72c10d6ce64`，219052032字节，与当前deployment-evidence.files一致 | 当前为后续chunk-edit修复b469ba0；不是旧277acc4的11ab产物，不误用过时指纹 |
| 服务构建源码 | Temp/companion-parallel-knowledge-20261018/keyword-fix/worktree 的 knowledgebase_search.go SHA `c15c6b97603d3b72d83a5f89efbce6f75b1ada5ee594f22c5471ba497a8f6257`；SQLite repository.go SHA `a496ad5c0dbc86ba92ac37857b5bc1002a85a8e133fb6bd1c138820b2cef38d2`；hybrid indexer SHA `e7ea5fb40fc9df6f388c6550c58fa713627c5dfb71789409ebe9e44a2e0f9d6d` | 三项实算均与部署manifest source_hashes匹配 |
| 不构造embedding路径 | 匹配knowledgebase_search.go:212–215预生成embedding要求!DisableVectorMatch；:425 vector参数构造同样要求!DisableVectorMatch；:462–470仅建立KeywordsRetrieverType | no-vector跳过两条embedding入口；HybridSearch处理路径没有rerank可执行调用，只有注释提到下游chat可能rerank |
| 本地SQLite路径 | SQLite repository.go:266按RetrieverType分派，KeywordsRetrieverType仅进keywordsRetrieve；:296–315执行本地FTS5 MATCH、bm25和有界LIMIT；service retriever的Retrieve只转发仓储 | 此路径不构造模型客户端、不执行vector查询、不进入问答重排 |
| 启动guard | 原 `D:/services/weknora/Start-PilotAccess.ps1` 保留端口占用拒绝、五运行文件SHA、state-check和历史knowledge_state_sha256比较；RETRIEVE_DRIVER=sqlite、AUTO_MIGRATE=false、HOUSEKEEPING=false、CONVERSATION_ENABLE_RERANK=false | 未执行启动脚本，也未修改guard或历史基线 |

## 当前阻塞与最小接续

正常宿主的只读OS检查未发现8081监听，也没有weknora.exe进程。磁盘产物匹配不等于服务当前可用。主会话如要验真实入口，需通过已有受支持知识服务启动入口恢复；若guard拒绝，保留拒绝并报告，不覆盖检查点、修改权限或启动模型。

既有三篇合成TXT位于 `c5f0a1bd-5748-4716-ab5c-36f08378a3c0`，当前reader仅允许主KB `da1051a5-3fff-4198-ba55-017ea79df9c3`。两者不相同。历史三篇索引/检索证据仍仅代表原生Owner会话范围，不是当前Next reader成功证据。只允许主会话在主KB选择适当已有词进行上限3查询、零命中、已存在且确有命中的有界查询，并仅归档ID/类型/命中数/哈希，不留真实标题正文。

本轮没有需要修改Next只读adapter/store的确切缺陷；现有Next会发原search合同，生产worker已经负责纯keyword。不能仅根据keyword=unverified标签擅自改变禁用流程。业务代码、Git索引、已安装daemon/worker、凭据、数据库和启动项均未修改。

## 唯一授权主KB的正向／零命中选词（后续只读补核）

本lane通过SQLite `mode=ro`、`PRAGMA query_only=ON`及只读事务补核索引映射，未SELECT标题或content，未发API。主KB的2269条lite_embeddings均有FTS rowid映射，共510个knowledge ID；按实际 `isSearchableChunk` 条件（启用、index_status非processing/failed、未删除）仍为2269条／510文档。整数chunk.status不是该函数的检索门禁，不能凭status数值猜测可见性。

无需读取真实标题/正文即可选用历史公开非敏感查询词：

| 查询词 | 同主KB、可检索映射的FTS MATCH计数 | 建议Next断言 |
| --- | --- | --- |
| `shidai3` | 79 | limit=3，返回1至3条；ID合法且属于唯一主KB，不归档真实标题/正文 |
| `COMPANIONNEXTNOHIT20261019K7Q9` | 0 | limit=3，成功返回count=0，无旧结果 |

正向元数据示例knowledge ID：`0472ca65-a2e1-4412-b800-7d39b11c115e`、`97493dd4-8deb-49ae-85f5-0991ac0452e8`、`a5714d57-be62-4dbd-b31d-37e75ca99700`。这只是存在性样本，API采用实际bm25及合并排序，不要求其前三返回恰好等于此顺序。该补核只执行FTS只读MATCH并返回count及至多3个ID，没有导出任何正文、标题或向量，没有构建索引或新增文档。实际Next请求由主会话串行执行，不能把本地索引存在性当成真实reader/UI已通过。

## 跨KB负向回执合同（实际daemon/worker map只读复核）

合法JSON请求通过Companion会话和Origin校验后，worker-core.ts:92检测外kbId并在读取凭据前抛出AUTH_DENIED/403；其IPC回执为`{settled:true,ok:false,code:"AUTH_DENIED",status:403}`。实际daemon map的knowledge-isolation.ts:125将code/status还原为KnowledgeFault，http-server.ts:625–629返回HTTP403与**顶层**`{code:"AUTH_DENIED",error:<固定静态说明>}`。不是`error.code`，也不是HTTP200 error envelope。

更早的层可以产生其它明确失败：会话或POST Origin不合法时，http-server.ts:272–273 / forbidden:921直接403 `{error:"Forbidden"}`，没有code；URL带query string时:585为400 SCHEMA_INVALID；JSON体无效/超过4096字节时:607–608同为400 SCHEMA_INVALID；路径/动词不支持为404；reader正在运行或已有unknown worker为429 BUSY。它们不能替代“已经到达reader外KB检查”的验收证据。

根验收脚本第三次断言失败时未先保存安全响应摘要，因此目前不能断言是授权缺陷，也不能证明必然是断言错误。本lane未发API。最小接续应先核请求构造与实际顶层字段，每步先持久化HTTP/status/closed code等安全摘要，再做断言；不要把任意HTTP失败宽松视为跨KB保护通过，不盲重试整个正向／空结果序列。
