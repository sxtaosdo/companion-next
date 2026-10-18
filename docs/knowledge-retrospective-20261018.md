# 知识库长期未交付闭环：只读复盘与官方方案调查（2026-10-18）

## 结论

当前问题不是“完全没部署知识库”，也不能说“库能打开所以已经可用”。已有单机WeKnora、存量文档、受限reader和过去真实关键词命中证据；但Next→Companion→WeKnora身份尚未接通，历史文档大部分未完成，真实问答与生产同步没有交付验收。多个独立局部修复没有汇成用户每天能用的一条完整链。

建议先停止扩大外围验收，明确一个最小交付切片并给它明确的退出条件：若目标是查资料，完成同一用户入口的受限身份、无向量关键词检索、来源可追溯和重开后可用；若目标是自然语言问答，还必须批准并验收模型调用/会话效果。只恢复网页、做更多假provider测试或升级UI都不足以闭环。当前禁止推理/写同步，仍应尊重；不能把未批准动作偷做，也不能把这条限制当成产品已完成。

## 1. 实际技术栈及版本边界

| 层 | 本机实际实现 | 来源和限制 |
| --- | --- | --- |
| 知识底座 | Tencent/WeKnora v0.8.2，upstream commit 3e8b0bfc80b845b2d4b2ed683994748741450a97 | deployment-evidence.json与CLI合同固定该commit；不是今日upstream main，也不是未经改动官方镜像 |
| Windows运行层 | normal-reader-recovery-v0.8.2/weknora.exe，本机自建Go服务，Go module1.26；Gin、GORM等 | Go单进程，SQLite/本地文件/in-memory stream，本机127.0.0.1:8081；当前运行产物manifest SHA d2a17caf94f3615d75bce831a85248b140dfb705add0aee069bea767f0d90863 |
| 原管理界面 | WeKnora frontend0.8.2，Vue3/Pinia/TDesign/Vite，web-reader-recovery-v0.8.2静态文件 | 与Next是两个不同前端。官方网页shell200不代表Owner登录成功 |
| 本机扩展 | reader-recovery-v1；keyword guard、SQLite关键词修补、reader-identity与受限API-key gate、旧密钥列表降级、自定义SPA/认证保护等 | manifest列出25个源/测试路径；不是上游标准现成功能的原样部署，不应把兼容成本隐藏成官方产品特性 |
| 命令行 | 官方WeKnora CLI，源码v0.8.2/source-v0.8.2，同一commit；本机已编译Windows.exe | 公共交接记载CLI源码未改；Enter-PilotCli.ps1/metadata guard是本机自建流程，不是官方CLI自带命令 |
| Companion适配 | Node/TypeScript KnowledgeAdapter，固定CLI路径、profile、8081、pilot默认KB，输出schema companion-knowledge-v1 | 自建适配；不是WeKnora官方API。读取和对话经CLI，源同步另转Python bridge |
| 新后台 | companion-next1.3.173，Vue3.5.43/Pinia2.3.1/ElementPlus2.11.1/Vite6.4.4 | UI/adapters/stores恢复旧Companion操作，测试/拦截验证不等于真实知识库业务成功 |
| 源同步 | 独立D:/code/shidai3/P8000/knowledge-sync/companion_api.py +策略/账本/生产adapter接口 | 本机自建，不是已启用的上游数据源同步。当前sources=[]、writer/scheduler=false |

本机启动显式DB_DRIVER=sqlite、RETRIEVE_DRIVER=sqlite、STORAGE_TYPE=local、STREAM_MANAGER_TYPE=memory；无Redis持久队列，未启用GraphRAG/Neo4j；AUTO_MIGRATE=false、AUTO_RECOVER_DIRTY=false、WEKNORA_HOUSEKEEPING_ENABLED=false。这些来自非敏感启动脚本源码，不是读取进程秘密或.env。

## 2. 新鲜存量统计（仅只读聚合，非正文）

11:13:49UTC，SQLite mode=ro + PRAGMA query_only=ON +事务快照，允许表COUNT及状态分组；未读正文/凭据列、未dump、未恢复任务。

| 指标 | 数值 | 不能推导的结论 |
| --- | ---: | --- |
| 知识库 | 2个，均未软删除 | reader仅允许pilot一个，不代表可跨库查阅 |
| 文档 | 1647，全在pilot KB | 有记录不等于解析/索引完成 |
| completed | 154（约9.35%） | 不保证检索质量/来源新鲜度 |
| finalizing | 356 | 不是正在运行的进度证明 |
| processing | 1137 | 不是当前后台worker仍执行 |
| chunk总记录 | 59428 | 包含软删除历史 |
| 活跃chunk（deleted_at IS NULL） | 20160 | 不代表每条都有可用索引 |
| lite_embeddings行数 | 2269 | 不是2269份文档，不是全量向量就绪证明 |
| sessions/custom_agents/models记录 | 3 / 1 / 2 | 只证明配置/记录存在，不证明可问答或模型ready |
| data_sources/sync_logs/task_pending_ops | 0 / 0 / 0 | 不能宣称后台同步正在运行 |
| migration | version30, dirty0 | 不代表业务解析完成 |

11:15:48UTC追加聚合：三种parse_status的更新时间均在2026-09-20；356条finalizing均有pending_subtasks_count=1，总356槽；1137条processing pending=0。task_pending_ops、data_sources、sync_logs、temporary_documents、fork_snapshot_leases、tenant_skills均0。原时间列混用UTC/+08:00表示，报告只判定日期，不将SQL字典序MIN/MAX当跨时区严格先后。

证据：current-aggregate-stats.json、unfinished-aggregate.json及对应独占Temp脚本。历史10月15日已有受限CLI关键词3命中，但那是有限查询，不证明1647文档全量可用。

## 3. 1493未完成的可证因果与未知

明确可证：当前运行配置有意保护/保留历史状态，并未恢复1493条任务；记录上的processing/finalizing不能视为后台仍在跑。

- build/source-v0.8.2/internal/container/container.go:912-950：AUTO_MIGRATE=false跳过自动迁移以及其中的resolveStorageProviderPending调用。resolveStorageProviderPending末尾:999才调用resetPendingTasks。所以该启动路径不把历史孤儿状态重标failed。
- reset_pending_tasks.go:19-31明确说明Lite无Redis的普通任务位于进程内存，重启后processing通常成为孤儿；默认reset逻辑将孤儿标failed并清pending，供后续处理，不是自动把所有文档成功重做。
- knowledge_housekeeping.go:98-100、731-745：WEKNORA_HOUSEKEEPING_ENABLED=false禁用周期stale sweep。这个sweep主要识别/标记卡住状态，也不是完成索引的替代。
- AUTO_RECOVER_DIRTY只传入数据库迁移的AutoRecoverDirty选项；不能称它为“恢复文档队列开关”。
- 原state-check.py要求migration30/dirty0、触发表空并核对历史状态hash；启动器比较前后hash，历史状态变更会拒绝继续。保护数据不乱改的验收通过，与让历史解析完成是不同目标。

仍未知：2026-09-20最初卡住的准确原因。本轮没有逐文档正文/错误轨迹或原执行日志证据，不能直接归因缺embedding、GPU不足、模型坏掉或某一个worker。仅有2个model记录不能证明配置正确；无真实受控重试不能断言重跑会好。恢复历史任务需另立有限批次、有快照、可验证结果的批准范围，不能为消除spinner直接改DB状态或全量重跑。

## 4. 实际能力/交付状态

| 能力 | 实现状态 | 真实可用性 |
| --- | --- | --- |
| 原服务启动和页面外开 | 已实现；10-18修复WindowsPS5.1继承PS7模块导致Get-FileHash找不到/503 | 已真实恢复8081；不能代表登录/检索 |
| Next知识/Agent列表、详情/原文/切片、关键词查询 | 固定路由与边界已实现；曾有定向测试/拦截验证 | 10-18两条实际列表均401 AUTH_MISSING，未交付正向Next读 |
| 受限CLI关键词检索 | 官方CLI+本机受保护reader入口已存在 | 10-15已真实3命中；该入口是CLI不是Next，每次默认还会跑检索，不能当无副作用认证探针 |
| 身份 | 既有reader ID3仅tenant1/pilot/retrieve，到期11-08 | 未注入当前Companion；既有凭据当前是否撤销未重新验证；不需默认新建key |
| KB/Agent问答 | 旧接口/CLI/Next单会话问答、结果/追问/本地reset已实现 | 没有本轮实际问答验收；retrieve身份不能当问答权限；当前推理/会话写入边界仍禁止 |
| 原源同步UI | source选择/dry-run/run/status/queue receipt已迁入 | sources=[]/writer/scheduler=false；fake queue receipt不是生产索引完成；真实写同步未获批准 |
| 生产增量源→索引→查询闭环 | 自建knowledge-sync有策略/来源/ledger/adapter设计和回归 | 无真实源、生产索引证明及当前准许writer，不是已交付可用系统 |
| 模型、索引后台状态 | 有历史配置和数据 | 本轮未启动模型、未跑推理、未恢复解析，不宣称ready |

原API没有的服务端会话CRUD、流式答案UI和自动调度，不能伪称“旧功能漏迁”来扩大任务。

## 5. 为什么多个阶段仍没交付：证据与判断分开

实证一：10-09公开CLI交接已写“CLI reader通过，Companion wiring blocked”，当时共享产物归属不明，不覆盖/重启。这条身份接线在10-18仍AUTH_MISSING。实证二：knowledge-sync README记载10-11 Owner登录脚本401；用户直接进入网页或匿名SPA shell200被后来文档明确纠正为“未证明新密码Owner认证”。实证三：10-18修好了知识服务启动503，但服务启动与reader注入独立；原iframe被XFO/CSP阻止时正确外开，不能用降低安全头代替认证。实证四：Next问答/同步迁移主要是fake provider/业务拦截与静态hash，报告已写真实调用0；这些证明实现而非使用闭环。实证五：保护历史文档状态通过，却没有批准/执行解析恢复和生产同步。

工程复盘判断：交付目标被分拆成过多局部“passed”，缺少固定的用户入口→身份→真实可检索样本→可追溯来源→重开可复用的验收闸门。并行保护/安全边界本身必要，但不能用它们掩盖终端目标仍未完成。报告应直接承认最小闭环缺口，不应继续用“又通过N项测试”替代真实业务结果。这是基于留存报告的判断，不推断所有早期操作者的动机。

## 6. 官方核对（本轮只查阅，未采用/安装/升级）

官方域名从Tencent/WeKnora README确认是weknora.weixin.qq.com。本轮直接官网安装/quickstart/config页工具无法抓取，改读同官方仓库website-docs原文；不是拿第三方转载当官方。另有初次错误试探weknora.ai未成功，不将其认作官方。

- [官方v0.8.2安装文档](https://github.com/Tencent/WeKnora/blob/v0.8.2/website-docs/01-getting-started/02-installation.md)：标准版Docker/Helm用ParadeDB(PostgreSQL)、Redis/Asynq、docreader；Lite用SQLite FTS5/sqlite-vec、内存。官方强调升级沿用SYSTEM_AES_KEY，否则旧加密凭据不可解密。本机走Windows原生自建/局部guard路径，与标准compose有明显运维差异。
- [官方CLI v0.8.2](https://github.com/Tencent/WeKnora/blob/v0.8.2/cli/README.md)：已有stateless环境认证、只读MCP工具面、list/view/search、session/agent命令以及doctor/status/check。Next自建bridge并非唯一上游能力入口；但换用它仍需明确身份/权限及客户端配置，不能跳过边界。
- [官方v0.8.3版本说明](https://github.com/Tencent/WeKnora/blob/main/website-docs/07-releases/v0.8.3.md)：2026-10-14发布，包含检索/解析/同步/CLI修复；升级需保留原AES/JWT/签名密钥并备份，SQLite新增31-36迁移。本机当前30且AUTO_MIGRATE=false，不能把替换exe当无数据影响升级。
- [官方Lite与标准差异](https://github.com/Tencent/WeKnora/blob/main/docs/LITE.md)：Lite更轻、单空间、解析能力有范围；标准适合完整协作/解析但服务更多。不能期待改名字成Lite自动处理本机已有受限身份、历史孤儿或旧AES。

搜索技术复核：本机KnowledgeAdapter.search args缺--no-vector；官方本机源码cli/cmd/search/chunks.go把NoVector默认false并传给DisableVectorMatch；原受限helper显式--no-vector。保持“真实搜索是否推理”未验收，不能因页面叫关键词就当纯关键词。修复需要明确原adapter范围，不能偷偷改旧后台。

## 7. 继续修还是改方案：基于证据的选择

| 路径 | 能解决什么 | 仍需付出的闭环成本/当前判断 |
| --- | --- | --- |
| 先收口现有v0.8.2有限查资料路径 | 复用已存reader/数据/CLI，最少新增依赖，定位当前缺身份和无向量参数 | 最小技术切片更小；须确认身份受控接线/共享daemon维护，真实读与来源验收；不能承诺恢复全库和问答。当前优先候选，明确停损点而非无限修补 |
| 有计划回归官方当前WeKnora部署/升级 | 减少本机自建偏差，接纳上游解析检索修复 | 必须数据/文件/原密钥备份、迁移30→31-36及自建guard语义兼容验证；不会自动修Companion身份。可规划，不能直接执行 |
| [AnythingLLM官方](https://docs.useanything.com/introduction) / [API](https://docs.useanything.com/features/api) | Windows桌面/本地文档问答以及API产品入口，更贴近单机使用目标 | 需独立样本验收、模型/embedding资源、原库迁移/重索引、认证和Next API重接；不能承诺沿用WeKnora SQLite。只列调查候选，未下载/采用 |
| [Dify官方](https://dify.ai/) / [官方源码部署](https://github.com/langgenius/dify) | 现成工作流/知识pipeline/发布API，适合希望减少自建工作流的平台 | Docker多服务、模型/身份/权限/重索引和迁移仍需解决；不是当前Windows共享后台的免成本替换 |
| [RAGFlow官方](https://ragflow.io/) / [官方MCP](https://ragflow.io/docs/use_ragflow_as_mcp_server) | 以数据加工/检索为核心，现成API/MCP入口 | 仍需部署/鉴权、样本解析质量与性能验收、模型资源和迁移；官方MCP也明确需要credential，不会消除身份接线 |

上述替换方向仅官方产品事实，不是本机兼容/性能实测。没有足够证据证明当前失败由WeKnora产品根本不适配造成；也没有证据证明换成熟产品就不用认证、模型、重索引和迁移。建议先以一个固定小样本验收门决定是否继续：若在明确授权的小范围下仍无法达成可检索/可追溯/可重开，再用同样样本对候选做对比；不在生产库上试装。

## 8. 最小剩余交付清单与边界

1. 根先确定“查资料”还是“问答”作为这次完成定义；问答需要用户解除对应推理/会话限制，不能由代理代选。
2. 复用既有ID3，只读身份metadata验证，不建新key；通过后收口Next身份接线。现有构造捕获env意味着需guarded daemon重启或另批准旧adapter热加载实现。凭据生命周期/环境继承和清理见confirmation-scope.md；不承诺内存无残留。
3. 真正查资料闭环还需把检索明确约束为no-vector，绑定pilot、有限结果和来源；当前仅列表401验收不足。
4. 1493历史状态单列恢复任务：批准受限样本、快照/回滚/验收后再扩，先查实际错误轨迹；不全量强制恢复、不直接改completed。
5. 全量新源同步另需真实source/target、writer、外发/删除规则、完成索引证明；仍保持禁用。不能让它阻塞独立只读接线，也不能把空source当同步已成功。

本轮执行：公开源码/交接/冻结metadata审查，官网及官方仓库/替代产品官网检索，两次只读DB aggregate；未读正文/凭据列/.env/秘密文件，无登录、reader解密/传输、问答、搜索、同步、服务/模型/配置变更，无安装、升级、下载或仓库/Git修改。


归档证据：[当前聚合统计](evidence/knowledge-retrospective-20261018-stats.json)、[遗留状态聚合](evidence/knowledge-retrospective-20261018-unfinished.json)。统计属于只读规模/状态证据，不是正向检索、问答、模型或同步成功验收。身份使用与进程环境影响见[精确确认范围](knowledge-reader-confirmation-20261018.md)。聚焦维护授权不包含知识身份注入。
