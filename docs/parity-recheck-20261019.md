# Companion Next 与旧 Companion 逐项核对（2026-10-19）

状态：Accepted。本轮仅核对开发者后台 `companion-next` 与 `cocos-mcp/web`；没有操作运营后台。结论：**实现覆盖已大幅补齐，尚不能宣称全部真实验收对齐**。

## 基线与证据规则

修复前 Next HEAD `b7191bcaa8ba153a4c208addb65bef15d72bcfd9`，工作树干净。本地检查点分支 `checkpoint/companion-next-parity-20261019-b7191bc`。页面产品版本1.3.173与四段Git检查点版本分开。当前运行服务PID、部署版本和认证会话本轮未探测；交接中的PID4092属于历史时点，不能沿用作现状。

本表中的“已验”引用已归档的指定操作证据，**本轮未重新执行**。代码存在、离线假响应通过、HTTP接收和真实业务验收分别计；占位、示例或历史成功均不当作当前全流程通过。旧真实入口核对 `../cocos-mcp/web/index.html`、`web/src/app.ts`、`ai-icons-page.ts`、`knowledge-page.ts`；新入口核对 `src/router.ts`、组件及同名adapter/store。旧源码只读。

## 逐项矩阵

| 旧入口 / 操作 | 新实现 / 原合同 | 状态与证据 | 精确剩余 |
| --- | --- | --- | --- |
| 帮助、关于、版本、历史 | `/help`、`/about`、`/changelog`；HelpView/AboutView、legacy-v148-help/changelog，product-information | 已实现；既有help-about-navigation回归，原文、复制、图标/二维码与版本单一来源保留 | 当前页面文案仍有过期“待验”，本片修正；不以页面版本代替daemon/Creator版本 |
| 概览默认入口与真实工程 | `/`→`/overview`，RegisteredProjectOverview、registered-project store；原GET projects/status | 已实现；registered-project-views及历史页面验收 | 需要用户点选工程，不自动选第一工程；未读取字段显示未知，不用示例充库存 |
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
| 知识库/文档/切片/原文/检索 | `/knowledge`、knowledge-read；原knowledge各查询 | 已实现；[受限reader元数据200](reader-precision-codex-receipt-20261019.md)，原生关键词和切片编辑见独立专项 | 元数据成功不等于Next所有正文/关键词/问答已验；当前keyword仍未验证，不读取凭据或自动问答 |
| Agent单会话问答、KB问答、同步 | KnowledgeAgent/Conversation/SyncPanel；原ask/chat/dry-run/run | 源码已接、隔离回归通过，见[Agent](knowledge-agent-parity-20261018.md)、[同步](knowledge-sync-parity-20261018.md) | 真实Agent/KB问答、来源写入/索引和模型调用未验，本轮继续暂停；queued不是索引完成 |
| 知识服务、模型启动器及原管理页 | `/knowledge`与tab=models，local-service-operations；原status/start/stop及固定iframe | 入口已接；[知识服务恢复](knowledge-service-restored-20261019.md)、[模型管理只读证据](model-service-parity-20261018.md) | 当前运行状态未重新探测；模型启停/切换及生成继续暂停，不把running当GPU就绪 |

## 证实缺失与边界

没有发现可以据现有源码证据新增的纯Next旧工程工具条按钮。构建/截图原为帮助及CLI/MCP用法，不能杜撰成应迁移的独立弹窗。已证实未开放的是Owner窄宿主的完整图片任务动作和原库切换；现有Accepted分类将其作为原独立Owner范围/用户保留决定，不能未经确认扩大实现。Codex会话字节自动回收/自动收口未接，是新需求，不冒充旧后台已有能力。

本片具体缺陷是保留矩阵的过期“待验”标签：AI96专项、正式Preview/Profiler、00/10安装已通过却仍整项写待验。仅修复`src/domain/product-information.ts`对应说明并合并当天更新记录；不把其它未知项涂成通过。只读code-mapper `/root/next_parity_gap` 独立确认这三组冲突，未确认新增业务漏迁。

## 本轮验证与交付

本轮不重复96导入/Creator/Preview/Build，不启动模型、新监听，不重启共享服务，不操作用户浏览器或旧WindowsCompanionUI。Git检查点后只改上述文案与本报告；定向验证、类型检查和本地提交结果见最终交付。


### 最终结果

- 修复本地提交 `a38a588 / v1.3.173.124`：仅产品说明、三条既有文案断言，以及仓库钩子要求的VERSION/README版本镜像。帮助里的“采集未验收”和“无运行证据”也同步为相同的限定专项事实。
- 最终既有 `tests/help-about-navigation.test.ts` **32/32通过**（8.11秒）；`vue-tsc --noEmit` 退出0；正式workspace模式的Vite构建退出0。构建仍有原大chunk提示，未为文案任务拆包或改依赖。
- 首轮32项失败包含Node25实验webstorage与jsdom的localStorage冲突，以及旧状态文字断言。只给测试进程设置 `NODE_OPTIONS=--no-experimental-webstorage`，同步三处既有断言后通过；无系统环境或产品存储行为变化。最后两处帮助文字同步后再次验证的是最终源码，没有把先前通过冒充最终验证。
- 最终构建仅保存于 `C:/Users/33272/AppData/Local/Temp/companion-next-parity-20261019-build-final/`；JS为 `assets/index-Dlxy1x5u.js`。**未部署**，当前用户浏览器中的页面不因本片而更新。
- 真实只读reviewer `/root/parity_copy_review` 完成主差异、三处断言和最终两条帮助文案复审，无P1/P2；仅审源码及已有证据，未冒充实机或测试执行。未调用外部OCR。
- 本文列21项，不把“未验证”“已实现”“未开放”折算成一个全齐百分比。真实剩余仍是矩阵各项的未验分支与明确未开放能力；当前无新的纯Next业务漏迁证据，不为产生功能改动而造按钮。

最终只将本报告与版本镜像保存为后续本地文档提交；无推送、发布、云上传、依赖安装、安全权限变化、旧源码修改或共享服务重启。
