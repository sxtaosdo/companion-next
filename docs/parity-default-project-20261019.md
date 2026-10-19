# Companion Next 对齐续核与默认工程修复（2026-10-19）

2026-10-19 12:28 UTC 最新结论见[更新后21项矩阵](post-host-closeout-20261019.md)：0.3.147五项回滚修复已装载且93项隔离通过；新增VSCode配置格式缺陷未修，真实客户端接入仍未验。下文保留原核对时点，旧5项失败不再代表当前运行包；keyword已经限定真实验证。

仅开发者 Companion Next 与旧 cocos-mcp/web；不涉及运营后台。**尚未全部真实验收对齐**。实现、离线验证、历史实机证据分别记录，不把占位当完成。

2026-10-19 10:04 UTC续核：默认真实首工程已随 `c44d847 / 1.3.173.129` 部署并通过真实7工程页面验收；帮助过时状态已修。日志/SSE和知识只读并行回归及仍未验边界见[三模块最终交付](parallel-delivery-20261019.md)。本文下方“未部署”为原检查点时点；当前结论以本段及最终交付为准。

2026-10-19 续核：纯关键词真实正向/空结果/越界已验；日志网络恢复修复ecabe7e/.131已部署，有限4标记SSE/补读、来源筛选与恢复期停止通过。下表知识“本轮真实请求0”和日志旧边界为上一批时点，当前精确结论以[本批证据](knowledge-sse-live-20261019.md)为准；Agent/问答/索引和长时完整性仍未验。

2026-10-19 客户端/安装续核：19项客户端正向检查通过、5项预期失败复现旧宿主回滚缺口；01/11部署源码隔离8项、Next选项21项通过，均不代替真实客户端持久配置或Creator安装。没有状态GET，不能POST探测。详见[本批隔离证据及待确认动作](client-setup-isolated-20261019.md)。

基线：Next a6b0f25 / 1.3.173.127，工作树干净；修复前创建 checkpoint/companion-next-parity-default-20261019-a6b0f25。旧源码只读，无服务、Creator、模型或浏览器控制操作。PID4092/Node25为交接历史值，本轮未冒用为当前探测。现存21项矩阵已有dc9a7c3提交，本轮续核不重复旧资产或事务验收。

明确发现：registered-project.ts 的 resolveSelection 对空 requestedId 直接返回；Overview 的调用未提供默认首项行为。这与用户已批准的默认首个真实工程要求不符，故不沿用旧矩阵“没有新确认缺陷”的结论。

## 逐项矩阵

| 旧入口 / 操作 | 新实现 / 原合同 | 状态与证据 | 精确剩余 |
| --- | --- | --- | --- |
| 帮助、关于、版本、历史 | `/help`、`/about`、`/changelog`；HelpView/AboutView、legacy-v148-help/changelog，product-information | 已实现；原文、复制、图标/二维码与版本单一来源保留；c44d847已部署并通过帮助/矩阵/历史/关于真实页面核验 | 过期状态已按限定专项修正；不以页面版本代替daemon/Creator版本，不外推全部业务通过 |
| 概览默认入口与真实工程 | `/`→`/overview`，RegisteredProjectOverview、registered-project store；原GET projects/status | 已修复并部署c44d847；真实7工程默认首项、明确第二项、未知/空/重复参数和资源页明确上下文已验 | 未读取字段显示未知，不用示例充库存；原检查点47f310e的“未部署”已由本次交付接续 |
| 工程列表、搜索、筛选、折叠 | `/projects`、CompanionBrowserView；原列表/状态接口 | 已实现；工程UI/状态/空列表回归，正式状态API→UI曾验，见[只读批量](readonly-live-navigation-acceptance-20261018.md) | 未逐个覆盖全部异常状态；旧停止折叠/ready展开与手动偏好不能由一个成功状态泛化 |
| 添加已有、Dashboard、创建、初始化 | ProjectSetupWizard、project-scaffold/setup；pick-directory、dashboard/projects、projects/scaffold | 已实现；[仅登记/移除](parity-remaining-safe-20261018.md)、[原生窗口](native-ui-receipt-20261018.md)、scaffold隔离工程实证 | 任意目录树导航及所有创建失败分支未完整实测 |
| 安装五步、选项、旧配色、完成用法 | ProjectSetupWizard、SetupCompletionUsage、project-setup-theme；原setup及严格options-v1 | 已实现且部分实机已验：[00](bridge-only-real-20261018.md)、[10](creator-only-real-20261018.md)，异项进行中409 | 01/11（configureCodex=true）、真实客户端持久配置未验；00/10不扩成四组合通过 |
| Creator启动/聚焦/停止/重启 | CreatorOperationDialog、creator-operations；原各POST | 已实现；[聚焦](windows-focus-fix-20261018.md)、[10安装](creator-only-real-20261018.md)、[预览切换恢复](preview-profiler-approved-20261018.md) | 各异常/未保存/重启与普遍OS退出安全分支未全验 |
| 打开目录、移除登记 | 同原open-folder和DELETE projects/:id | 已实现且限定实机通过：[批量](readonly-live-navigation-acceptance-20261018.md)、[登记移除](parity-remaining-safe-20261018.md) | 不表示删除工程或停止Creator，原生窗口证据限定当次目标 |
| Preview探针/启动/状态/刷新、Profiler | ProjectPreviewActions、preview-actions，五项对应旧app.ts:1841–1848 | 已实现；正式Next启动、刷新、848样本Profiler与恢复[已验](preview-profiler-approved-20261018.md) | 探针/状态独立分支、生产性能与所有浏览器刷新效果未全验 |
| 日志筛选、刷新、暂停、滚最新 | `/projects?tab=logs`、companion-browser、LogTools；GET logs/SSE | 已实现；[日志交付](log-tools-20261017.md)实际滚动与只读日志，[过滤上下文](log-filter-diagnostic-context-20261018.md) | 长时间多源/跨重连完整性未全验，协议没有事件回放保证 |
| 清空、导出、诊断 | log-tools adapter；原DELETE logs、POST diagnostic | 已实现；[日志工具](log-tools-20261017.md)隔离清除与真实诊断下载 | 生产DELETE未执行；清除仅按工程影响内存记录，NDJSON保留，不按当前关键字缩小范围 |
| 调用计数、全部/失败、更多、摘要 | `/projects?tab=calls`；原counts与每页50/before | 已实现；既有读取/实时合并回归；[历史读取82项](history-read-regression-20261017.md)是资源任务读取专项 | 后者不能当全部调用UI实机验收；不重放旧调用，长时并发/全部会话分支未全验 |
| 实时更新、跨页、隐藏/返回 | companion-events、companion-browser store；原SSE/串行状态读取 | 已实现；原返回off已修，[真实恢复及主动停止](sse-navigation-resume-fix-20261018.md) | 不保证离线事件无遗漏；继续保留来源切换、迟到、UNKNOWN与主动停止 |
| CLI复制与IDE交接 | CliUseDialog、AgentHandoffButtons；旧CLI文本及固定协议 | 已实现；[Codex实际完整标记预填与清理](reader-precision-codex-receipt-20261019.md)、[原生Cursor](native-ui-receipt-20261018.md) | 预填没有发送任务；协议成功不等于任意客户端状态下都已接收或执行 |
| 五客户端MCP注册 | ProjectClientRegistration、AgentRegistrationPanel；原mcp/register | 已实现；成功/UNKNOWN/旧客户端提示离线覆盖，见[safe modules](safe-parity-modules-20261019.md) | 五客户端真实持久配置与全部冲突回滚未验，不能因有按钮而通过 |
| 工具目录、范围、预设CRUD/交换/分配 | Help tools、ToolPresetWritePanel；原tools/tool-presets/tool-preset | 已实现；[真实主要操作](remaining-real-acceptance-20261018.md)、[预设竞态](parallel-modules-20261018.md) | 单项覆盖/并发、客户端重连后实际生效未全验；旧更新没有hash原子保护 |
| AI六步、参考图、采用/生成、审阅、导入、尺寸变体 | `/ai-icons`和RegisteredProjectResources；ai-resource/ai-task/ai-job同名adapter | 已实现且部分已验；复用用户指定3074d37、c80b890及[历史读取](history-read-regression-20261017.md)：96PNG/meta/UUID、场景保存重开、Preview/Build/Smoke | 当前GPU生成、所选Python/CLI/Pillow依赖及所有失败恢复未全验；productionVerified不因历史证据自动变true |
| 真实工程库存 | asset-inventory、AssetInventorySummary，原只读AssetDB聚合 | 已实现；[733项接口/聚合/页面对应](owner-host-acceptance-20261018.md) | 733仅当次工程/会话读取；不是当前库存常量、逐项批准或概览中未知字段已读 |
| 图片预览、持久选择、原生保存 | `/image-assets`、同源Owner窄宿主 | 已实现且限定实机已验，见[Owner验收](owner-host-acceptance-20261018.md) | 原图片库未切换；搜索/下载/历史切换/重试/停止/回收恢复未在本窄宿主开放，见[收口分类](migration-closeout-classification-20261018.md)，不伪装完成 |
| 知识库/文档/切片/原文/检索 | `/knowledge`、knowledge-read；原knowledge各查询 | 已实现；[受限reader元数据200](reader-precision-codex-receipt-20261019.md)，本轮115项定向回归（新增6项）见[模块记录](knowledge-read-parallel-20261019.md) | 元数据不等于正文/关键词/问答已验；keyword未验证状态不禁用入口，不能保证检索不触发向量/推理，本轮真实知识请求0 |
| Agent单会话问答、KB问答、同步 | KnowledgeAgent/Conversation/SyncPanel；原ask/chat/dry-run/run | 源码已接、隔离回归通过，见[Agent](knowledge-agent-parity-20261018.md)、[同步](knowledge-sync-parity-20261018.md) | 真实Agent/KB问答、来源写入/索引和模型调用未验，本轮继续暂停；queued不是索引完成 |
| 知识服务、模型启动器及原管理页 | `/knowledge`与tab=models，local-service-operations；原status/start/stop及固定iframe | 入口已接；[知识服务恢复](knowledge-service-restored-20261019.md)、[模型管理只读证据](model-service-parity-20261018.md) | 当前运行状态未重新探测；模型启停/切换及生成继续暂停，不把running当GPU就绪 |

## 本轮修复和交付边界

仅概览且未提供 project 参数时启用首次默认选择，真实登记响应到达后绑定首项ID/路径/来源。不会写URL、启动Creator、读取资源或添加网络请求。显式未知、空或重复参数不回退；资源页保持明确工程选择；已绑定工程被移除、换路径或换来源后不自动跳到别的工程。

最终定向 registered-project-views 与 help-about-navigation 共67项通过；vue-tsc --noEmit 退出0；正式workspace模式构建至任务自有Temp成功（原大chunk提示保留）；独立只读 reviewer /root/default_project_review 未发现具体缺陷。新增两例覆盖异步默认选择、排序稳定/移除失效及显式无效参数，既有测试继续覆盖资源页、来源替换、空列表和读取失败。

未部署、未重启共享服务、未改旧WindowsCompanionUI/生命周期，未触发安装、同步、配置写入或资源导入，未启动模型/Creator或新监听；没有推送、发布或云上传。本片不把剩余实机验收扩成新功能，也不重复96变体与历史82项验收。

构建目录：C:/Users/33272/AppData/Local/Temp/companion-next-default-project-20261019-build，JS assets/index-BdO8ybxm.js。共享cocos-mcp只读status仍为原22项；本任务未写该仓，未证明其并发文件内容完全未变。
