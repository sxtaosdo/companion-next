# 知识库关键词真实验收与剩余差距（2026-10-18）

结论：**隔离库的三TXT上传、关键词索引、来源检索和单篇重处理一致性已通过；新后台整体仍未全部对齐旧后台。** 本次原生WeKnora会话验收不能替代Next身份正向接入验收。

| 项目 | 当前结论 | 证据与边界 |
| --- | --- | --- |
| 原生上传3份虚构TXT | 请求成功，最终3篇completed | 只上传一次；首次处理失败后复用同3篇重新处理，没有重复上传 |
| 纯关键词索引 | 真实通过 | 3个ready文本分块、3条关键词索引、3个FTS映射、0个1024维向量映射，索引dimension=0 |
| 有界来源检索 | 真实通过 | 重处理前后各3次，match_count=3、disable_vector_match=true、精确knowledge_ids；每次仅命中预期文档1条，返回文件名、分块ID和位置 |
| 单篇重处理索引一致性 | 真实通过 | 仅01文档再次重处理；新分块ID替换旧ID，内容SHA相同，检索仅命中新ID；另两篇分块/索引快照不变 |
| Next知识身份正向链路 | 未验收 | 本轮使用原生前端已登录API；没有向Next注入或持久保存身份 |
| 分块手工编辑/索引更新 | 已确认代码差距，未修复 | chunk.go syncChunkIndex仍构造嵌入客户端，且尚未复用新通道策略；没有执行编辑或宣称内容更新通过 |
| Agent问答、语义检索、原库批量恢复、真实同步 | 未执行 | 不将关键词验收泛化为这些功能已通过 |

## 实际执行

隔离KB为 companion-keyword-3txt-20261018 / c5f0a1bd-5748-4716-ab5c-36f08378a3c0。三份文件为01-amber-lantern.txt（186字节）、02-moon-garden.txt（148字节中文）、03-copper-orbit.txt（239字节）。均为完全虚构内容；fixture-manifest保存原文件哈希。

通过原生前端模块的正常已登录API上传，未读取、打印、转存浏览器认证值，也未新建凭据。KB关闭vector/wiki/graph，上传与每次reparse明确关闭summary/multimodal/VLM/ASR/question generation/graph/extract。这里的“不推理”不等于“不读取模型元数据”：代码内部只读取现有模型Dimension，用于保留旧索引清理维度。

第一次定向修复9eebef8已通过离线测试并部署，但真实三份上传均failed：processChunks仍提前构造嵌入客户端，现有模型地址DNS解析被原SSRF校验拒绝。原始失败和部署回执完整保留，未改安全校验、模型配置或网络策略。随后修复文件处理与reparse清理入口，补充能在GetEmbeddingModel本身失败时复现的回归。

最终修复提交277acc4fac665a73298373688dd2513e3e8eb93c；27项顶级focused测试、9项followup及7包定向回执通过。模型元数据缺失/零维/读取错误在清理前拒绝；vector路径保留原行为，非SQLite清理仍收到原1024维。独立代码审查无未关闭P1/P2，11项原Windows修改及25项reader overlay保持。

最终EXE SHA256为11abf6df9abe6503f3da8bd542cf3cf907ce90f311ad6dd6ad0d97b7d870cbe3。使用原KnowledgeServiceClient正常stop/start，原路径替换EXE；四DLL和启动脚本原字节保留，完整历史manifest保留并追加修复证据。EXE未内嵌本地GoVCS提交，修复身份由clean构建记录、源码SHA和manifest绑定。

部署后对原3篇失败文档各reparse一次，全部completed、pending=0、summary=none。检索前后6次均通过；随后01文档的额外一次reparse验证源文件未改时的索引替换一致性。这里没有修改源TXT或手工编辑正文，不把重建一致性表述为“正文编辑通过”。

部署2原始deployment.json沿用了上一版脚本的testDocuments:0字段，这一字段计数错误，原回执保留未改。部署2 after.json实际记录3篇failed，精确3ID的检查点回执与后续completed快照为实际数量依据，不能引用该0值证明空库。\n\n具体请求参数和reparse关闭项来自[已执行脚本输入](evidence/kb-keyword-real-20261018-request-config.json)，其中保留原始输入字节SHA与源码。原生响应回执没有重复记录request body，本轮未另外抓取独立HTTP线报文；参数属于执行配置证据，不冒充网络抓包。\n\n## 原数据与运行保护

原KB da1051a5-3fff-4198-ba55-017ea79df9c3仍1647篇；所选状态元数据SHA保持400e49c75b77cc45e16cb96cd6d21ecc47bc0b5df144886fce698d400b68efcd。chunks59428、indexRows2269、vectorMappings2264不变；migration30/dirty0。没有查询原正文或批量重处理；本地停止后的数据库二进制备份保留在任务Temp，不提交数据库或EXE入Git。选定字段和计数不证明全部正文/索引内容逐字节相同。

原启动守卫的knowledge_state_sha256只覆盖id/parse_status/pending。为接受已批准3篇新文档的状态，先在同一个SQLite只读事务中排除精确3ID，验证原1647 triple hash、选定元数据与上述三计数不变；校验3篇KB归属、文件名、字节数和原文件hash；用同事务state-check输出生成候选运行检查点。备份原baseline并记SHA，替换前CAS。部署2的failed检查点在服务停止后更新；最终3篇completed且无写任务时以同规则更新检查点。没有放松守卫脚本、触发表、迁移/恢复/housekeeping或身份限制。

最终知识服务PID2492，只监听127.0.0.1:8081，原runtime路径保持。Companion18036身份及bundle保持；原Creator21004/session b0471fa2-0879-4f30-b27f-7038dd6ef8cc仍ready。原模型7292/3260未操作。三个登记文件字节与安装10前一致；cocos-mcp、原游戏与变体工程HEAD/status/work/index快照未变。

只刷新本任务原生KB标签；关闭自用DevTools，原9个标签保留、先前选择恢复，没有关闭原窗口。原生页面显示3篇已完成。fixtureFileLabels=[]来自UI显示去掉.txt扩展名，不能把该字段当全文名UIA断言通过；截图仅采集自有KB标题和3行，未包含无关侧栏。

## 交付

- [真实结果断言](evidence/kb-keyword-real-20261018-accepted-results.json)
- [原生上传回执](evidence/kb-keyword-real-20261018-browser-upload-receipts.json)、[检索与reparse回执](evidence/kb-keyword-real-20261018-browser-final-receipts.json)
- [原生3篇完成视图](evidence/kb-keyword-real-20261018-native-completed-3txt-content.png)
- [部署1](evidence/kb-keyword-real-20261018-deploy1-deployment.json)、[部署2](evidence/kb-keyword-real-20261018-deploy2-deployment.json)、[最终原数据快照](evidence/kb-keyword-real-20261018-deploy2-final.json)
- [最终候选清单](evidence/kb-keyword-real-20261018-candidate.json)、[离线回归](evidence/kb-keyword-real-20261018-offline-tests.json)
- [证据哈希](evidence/kb-keyword-real-20261018-manifest.json)

源码分支codex/weknora-keyword-only-20261018在独立本地worktree，未push。二进制、原始测试日志、运行备份及精确3TXT留于Temp/companion-parallel-knowledge-20261018、companion-keyword-runtime-deploy{,2}-20261018、companion-keyword-3txt-20261018；没有云上传或安装软件。

独立只读审查支持此局部验收；部署计数字段错误与请求参数证据来源已如实补注，未重跑业务。\n