# Companion 整体迁移只读核对（2026-10-22）

## 本轮补齐结果（2026-10-22）

下表是实施前的34项审计基线。用户已批准的三处缺项现已补齐源码和针对测试；引用预设删除恢复明确确认，日志仍按批准保留手动查询。当前32180已更新前端1.3.184，70项隔离真实渲染、31项现场只读检查通过；同后台UI已完成e2e打开、规范保存回读、采用既有母图、预览选用、导出与Creator导入及PNG/meta/UUID回读。添加向导的实际宿主任务complete；最终Agent跳过/提示词页仅隔离渲染验证，未冒充现场全部通过。详细证据及未完成边界以[本轮交付](migration-completion-20261022.md)和[OpenSpec任务](../openspec/changes/complete-approved-companion-migration/tasks.md)为准；其他未触及行不因安装工具而自动升级验收状态。


本表回答“旧功能是否整体迁过来”，不是新增功能实施计划，也不宣布迁移全部完成。本轮状态 UI 已先交付：当前唯一32180为前端1.3.183、构建516ab9af+working、后端0.3.144；PID28744/OPEN、8工程保持。30项现场只读检查与75项隔离真实浏览器渲染检查，不代表全部业务流程验收。

旧基线为当前受保护的 `P8000/cocos-mcp/web` 实际源码，非猜测的远端版本。旧index.html、app.ts、ai-icons-page.ts、icon-handoff-dialog.ts及CSS的SHA256见[evidence](evidence/whole-migration-audit-20261022.json)。Next代码基线为516ab9af，后续文档提交不改变运行产物。既有10/18—10/21文档只作为其日期和限定工程的历史实证，不沿用13/6/2等旧比例，不推定当前全部仍通过。

## 已发现的重要差距

1. **旧参考图裁剪及原请求查询没有找到新版对应接线。** 旧页真实可达：文件选择→预览画布→坐标/保存/查询。新版完整参考图上传不能代替该流程。是否有意移除未找到批准记录，标待核对，不称用户已批准删除。
2. **旧图标任务绑定的 Agent/Cocos 交接包没有找到同合同入口。** 旧交接包含任务、候选、hash与目标绑定；新版通用草稿导出/Agent文本发送不能自动视为等价。
3. **添加项目完成页遗漏使用示例、换行和复制便捷区。** 全站工程卡的“使用CLI”还在，不能称CLI整项缺失。
4. **被引用工具预设的确认删除能力有差异。** 旧版确认后使关联工程回退full，新版仅允许无引用普通删除。恢复涉及工具范围变化，先确认行为，不能为“照搬”自行放宽授权。
5. **日志关键字从输入即查询变成显式查询。** 代码可证实，未核实该差异的批准记录；先列差异，不擅改请求频率。
6. **当前32180完整资源链仍未真实验收。** 历史32181有规范→真实图标生成→预览→选用→96导出证据；不能代替本后台UI打开→Creator导入→PNG/meta/UUID回读。旧独立96变体导入也不能代替本次生成物的闭环。

这些结论区分遗漏、行为差异和未验收；没有把它们都归结成样式问题。

## 逐项矩阵

路径简写：旧为 `P8000/cocos-mcp/web/`，新为 `P8000/companion-next/src/`。行号为本轮只读代码位置，后续修改可能移动；处理函数名用于稳定定位。“代码对应”只表示找到可达实现，真实业务另列。“待核对”表示未找到该差异明确批准，不能据此断言擅改。

| 项目 | 旧入口/处理 | 新入口/处理 | 结论与实证界限 |
|---|---|---|---|
| 主导航、旧链接 | index.html:22；app.ts:2857 showCompanionPage、2977 initCompanionPages | App.vue:68、153；router.ts:17起 | 代码对应。看板首项、工程第二、美术单入口和旧深链接重定向是批准差异；183现场7路由只读渲染通过。 |
| 工程列表、搜索、筛选、折叠、复制 | index.html:38；app.ts:1531 toggleProjectCardExpanded、1638 renderProjects、3442/3446 | CompanionBrowserView.vue:86 matching、92 isExpanded、93 toggle、105 copy、137 | 代码对应。真实最近打开排序、未启动默认折叠是批准调整；本次未穷举当前所有筛选/折叠组合。 |
| Creator启动/聚焦/停止/重启 | app.ts:364 action、3363派发 | CompanionBrowserView.vue:40 directCreator、162；CreatorOperationDialog.vue:16 open、17 confirm；stores/creator-operations.ts | 代码对应；历史有有限UI生命周期实证，当前全部失败/未保存/未知路径未重验。受理与ready分开。本轮不触发Creator。 |
| Preview、刷新、Profiler | app.ts:587 preview、612 profilerCapture | ProjectPreviewActions.vue:14 | 有接线及历史有限Preview/Profiler实证；本轮未执行，不能泛化到全部工程与异常分支。 |
| 打开目录、移除登记 | app.ts:3377、3406 | CompanionBrowserView.vue:146/153；CreatorOperationDialog.vue:28/29；creator-operations.ts:344 send | 有对应；历史目录→Explorer和登记删除有限实证。本轮未删除、未打开窗口；确认交互区别保留为安全边界。 |
| 添加来源与安装主线 | index.html:220；app.ts:2743 resetAddFeatureModal、2778 goToSelectProject、2787 goToLaunchStep、3222 | ProjectAddWizard.vue:27 show、30 nextProject、48 launch、58五步；stores/project-setup-add.ts:41 start | 旧五步、四来源、工具范围及可跳过Agent已恢复；最新完整安装仅隔离回归，当前真实完整安装未验。入口仍写“添加已有工程”但内部可新建/初始化，可识别性差异待核对。 |
| 添加完成使用示例 | index.html:427–430 promptText/复制/换行；app.ts:3135 | ProjectAddWizard.vue:64完成段；工程卡另有CliUseDialog | 明确步骤内交互遗漏；不能用工程卡另有CLI掩盖。 |
| 已登记工程安装/更新接入 | app.ts:3478→3486 startSetup | CompanionBrowserView.vue:149；ProjectSetupWizard.vue:104 showMaintenance、170 prepareFull、171 submitFull | 代码对应，Next保留显式选项和原任务恢复。历史部分失败/旧版本实证不能直接判当前同缺陷，也不能认当前修复已全验。 |
| MCP客户端登记 | app.ts:2416 openMcpRegisterModal、2452 registerMcp、3464 | ProjectClientRegistration.vue:12；AgentRegistrationPanel.vue:10；stores/project-connections.ts:39/51 | Codex/Cursor/Trae/Kiro/VS Code代码对应。路径读取/模拟writer不是所有真实客户端安装和执行通过；当前完整客户端验收未覆盖。 |
| CLI、复制、发送Agent | app.ts:2435 openCliUseModal、3135派发 | CompanionBrowserView.vue:68；CliUseDialog.vue:28/50；AgentHandoffButtons.vue:9 | 有对应；复制文本、拉起客户端和真实工具可执行是不同验收，不混记。 |
| 工具目录、预设CRUD与范围 | app.ts:790 renderTools、994 openToolPresetsForProject、1076 deleteToolPreset；1080 confirm=true | CompanionBrowserView.vue:64/142；ToolPresetsReadPanel.vue:75/83/84；ToolPresetWritePanel.vue:29/64 | 主体有对应及历史有限CRUD、覆盖保存及冲突拒绝实证；引用预设确认删除并回退full无同等入口，行为差异待确认。 |
| 日志查询/筛选/暂停/滚到底 | index.html:54/66–83；app.ts:546 loadLogs、3489/3491/3499/3500/3528 | CompanionBrowserView.vue:72–74、178–179；adapters/companion-browser.ts:309 | 有对应及历史17条实际DOM证据；旧关键字input即读与新手动查询差异待核对。 |
| 清日志、诊断与保存 | app.ts:2510 DELETE；3507诊断 | LogTools.vue:18–21；adapters/log-tools.ts:95 | 已接线；生产真实清空仍未验证，不为补证据删除日志。诊断保存为已有批准便捷能力，模拟不替代现场。 |
| 统计、调用记录、失败详情、分页 | app.ts:2016 loadCallCounts、2050 renderCallRecords、2098 loadCallPage、2131 | CompanionBrowserView.vue:106–108；adapters/companion-browser.ts:314/315 | 有对应。历史自然19条及2失败摘要已验；正式limit50第二页缺≥51自然数据，仍未验，不造数据补比例。/history是版本边界页。 |
| SSE与局部实时更新 | app.ts:3540 EventSource及open/message处理 | stores/companion-browser.ts:170 stopLiveTransport、172 stopLive、236 startLive及原事件adapter | 有对应及历史跨页恢复/局部更新实证；本次未做长时间压力或所有重连组合，不将静态哈希等同实时更新验收。 |
| 帮助目录、原文、工具说明 | index.html:443；app.ts:2379 showHelp、2409 openHelpGuide、3068 | HelpView.vue:20 choose、24 copy、39–42；domain/legacy-v148-help.json | 目录层级为批准调整，原文/代码展开复制/发送有对应；本轮未逐字比较全部正文。 |
| 关于、版本、更新记录 | index.html:664/716；app.ts:2202 applyVersion、3074–3088 | AboutView.vue:20/28/37–43；App.vue:166；stores/product-version.ts:10；ChangelogView.vue | 有对应。183实际前端/构建/后端字段已现场核验，非固定占位；复制图标、按天聚合是批准变化。 |
| 图标六阶段资源流程 | index.html:22→app.ts:3059；ai-icons-page.ts:51 | router.ts:18–25；ArtWorkspaceView.vue:38–49；ArtProductionFlow.vue | 合并与渐进正文是批准差异，不恢复三套页面。三个任务标签不表示三类都能生成。 |
| 旧图标规范读取/保存 | ai-icons-page.ts:54–81、236 refresh、374–393保存 | AiResourceReadView.vue:23；AiResourceConfigDialog.vue:22；stores/ai-resource-editor.ts:185 | 旧文件兼容及辅助编辑接线存在；主流程改项目美术规范是批准扩展。历史测试实例规范保存不等于当前工作台全链。 |
| 参考图上传/预览 | ai-icons-page.ts:64–66、395–420 | 工作台“参考素材”→AiResourceReadView、AiReferenceUploadPanel.vue:23/53；stores/ai-reference-upload.ts:179/213 | 当前辅助区可达；保存路径/SHA留证，不是参考图入模。旧新版均不能据上传称条件生成完成。 |
| 参考裁剪、查询原请求 | ai-icons-page.ts:67–74画布/坐标、139–141绑定IconReferenceEditor、448/461保存查询 | src未找到reference-crop/reference-crop-status或对应裁剪组件 | 旧真实可达，Next代码缺口；批准移除记录待核对。 |
| 准备/检查/排队/采用PNG | ai-icons-page.ts:88–98、516提交 | ArtProductionFlow.vue:101→AiTaskCreationPanel；stores/ai-task-creation.ts:109/128/147 | 原合同+项目规范绑定有隔离测试；历史UI排队有实证，当前32180完整链未重验。 |
| 原任务执行、恢复 | ai-icons-page.ts:314–317、270 action | AiJobsReadPanel.vue:34；stores/ai-job-actions.ts:99/105/182/221 | 有接线；受理不是终态，UNKNOWN仅查原任务。本次仅状态渲染夹具，不执行。 |
| 候选预览、选用 | ai-icons-page.ts:319–337 | AiJobsReadPanel.vue:18/22/34；ai-job-actions.ts:66/107/221 | 历史32181真实通过；当前候选DOM状态夹具不能代替现生成物验收。 |
| 默认/自定义尺寸导出 | ai-icons-page.ts:82–87、475 exportVariant、497确认 | AiJobActionsPanel.vue:32/37；ai-job-actions.ts:111/221 | 历史96导出有PNG/SHA，不代表已导入Creator工程。 |
| 母图/变体导入及重读 | ai-icons-page.ts:278 renderJobs、270 action | AiJobsReadPanel.vue:34；ai-job-actions.ts:106/118/160/221 | 有代码。当前同32180生成物→UI打开→导入→PNG/meta/UUID回读未通过完整验收；旧独立96测试不能替代。 |
| 图标任务Agent/Cocos交接包 | ai-icons-page.ts:308–310可达按钮、133–138；icon-handoff-dialog.ts:77–99 | GenerationSourcePanel.vue:26通用草稿、AgentHandoffButtons.vue:23文本 | 未找到旧任务/候选/hash/目标绑定的同合同入口；通用交接不能自动等价。差异批准待核对。 |
| 模型状态、启停、原面板 | index.html:191–205；app.ts:2964/3019/3033 | /knowledge?tab=models→KnowledgeReadView.vue:14/22、LocalServiceControls.vue | 有原启停及8090面板接线；183真实渲染不代表启停/模型加载/GPU就绪。 |
| 知识服务启停与管理 | app.ts:2925/2984/2998及8081 iframe | KnowledgeManageView.vue:21；LocalServiceControls.vue:66/75/96/106 | 有对应；历史服务恢复与不可嵌时外链有记录，当前管理登录及完整操作未据此通过。 |
| KB/文档/分片/原文/检索 | knowledge-page.ts:511–528/652/684–724 | KnowledgeReadView.vue:35–40；stores/knowledge-read.ts:54–71 | 有对应；10/20原reader有限正向读取已验，当前三子页全套未重验，不能用服务可达替代检索。 |
| 问答、续问、重置 | knowledge-page.ts:729–744 | KnowledgeConversationPanel.vue:30；knowledge-conversation.ts:131/144 | 代码及隔离测试存在；当前真实问答完整验收未找到，不发请求补证据。 |
| Agent列表/问答/续问 | knowledge-page.ts:664/749–766 | KnowledgeAgentPanel.vue:37/48；knowledge-agent.ts:134/147 | 有对应；目录读取不等于Agent执行通过，真实问答未验。 |
| 同步演练/执行 | knowledge-page.ts:559/574/576 | KnowledgeSyncPanel.vue:27/74；adapters/knowledge-sync.ts:99 | 有对应；真实来源写入/重建索引未验，演练不能算执行。 |
| 独立素材采集与后台审阅 | 独立public-image-review/index.html、ui.js；不是旧Companion同一页面 | ArtWorkspaceView.vue:45辅助区；PublicImageCollectorFrame.vue:15/23；CompanionImageReviewPanel.vue:82/91 | 嵌入是批准扩展，原审阅保留；静态与握手模拟不等于真实搜索/下载/保存全链。 |

旧版没有核实到独立“全站设置”页；相关能力实际是安装接入、MCP登记、工具范围，已分别列明。未知开源悬浮按钮的来源仍未唯一确认，不能当作已恢复，也不据此新造功能。

## 已批准扩展与旧迁移分别验收

- 看板布局、工程排序/折叠、知识库三子页、美术单入口/公共头/六步骤/三任务标签、仅当前正文、三步规范弹窗、画布预设、按钮实际状态、版本格式及本轮状态统一均有用户批准，不能因为与旧页不同一律回退。
- 新项目美术规范、P0001适用范围/版本锁定、覆盖校验、持久化及生成输入绑定已有代码/隔离证据；这是新体系，不是旧图标规范已等价覆盖所有美术类别的证明。
- UI与人物目前有规划/规范界面，到生成阶段明确未支持。参考图条件输入未实现。此两项属于真实能力边界，不应在“旧迁移完成”中虚计，也不在本次只读审计中扩建。
- 正常网页登录属于后续明确批准的Midway认证复用；用户2026-10-22 05:17 UTC亲自确认登录成功。本轮未操作密码、注销或会话，不要求再次登录验收。

## 建议处理批次（本轮未执行）

1. **先收敛迁移缺口。** 对参考裁剪、任务交接包、添加完成示例按旧真实UI和原合同给最小恢复差异，复用现有provider/store；同时核对是否有明确批准删减记录。工具预设引用删除会改变关联工程权限范围，单列确认；日志查询触发方式先确认用户期望。
2. **再做必要完整流程验收。** 优先同32180测试工程：添加/安装真实完整回执与部分失败恢复；资源链仅使用既有生成物完成经后台UI打开/导入/UUID及文件回读，再讨论当前offline模式下真实生成所需批准。不得再开32181或绕UI，也不为了计数重复生成。
3. **保留受限与自然数据缺口。** 真模型启停、QA/Agent、同步/重建及清日志需遵守各自现有暂停/写入边界；正式50条历史第二页等自然数据，不伪造任务。没有新授权就明确未验，不改成通过。
4. **同一清单逐项关单。** 每项记录来源函数、对应新入口、批准差异、测试、真实回执、当前生效产物。缺口关闭后更新本表；历史文档仅保留时间证据，不继续叠加旧比例。开工规则见[来源与能力复用规范](source-and-reuse-policy.md#整体迁移开工与闭环)。

## 主要证据索引

- 当前状态交付：[规范执行证据](source-and-reuse-policy.md#2026-10-22-状态统一执行证据)；本机 `status-ui-20261022/deployed183.json`（30现场只读）、`render-status.json`（63渲染）、`render-tasks.json`（12渲染）。
- 添加旧流程：[project-add-legacy-parity-20261021.md](project-add-legacy-parity-20261021.md)；安装/客户端历史：[wizard](wizard-acceptance-20261020-0634.md)、[registration](registration-acceptance-20261020-0634.md)。
- 当前统一工作台与批准边界：[art-workspace-20261022.md](art-workspace-20261022.md)；历史真实出图/导出及导入缺口：[resource-flow-acceptance-20261021.md](resource-flow-acceptance-20261021.md)；[single-live记录](companion-single-live-delivery-20261021.md)中的后续新授权/代码合入须与当前运行区分。
- 日志/导航/目录：[readonly-live-navigation-acceptance-20261018.md](readonly-live-navigation-acceptance-20261018.md)；工具范围有限实证：[tool-presets-page-acceptance-20261019.md](tool-presets-page-acceptance-20261019.md)；调用历史实证：[history-acceptance-20261020-0634.md](history-acceptance-20261020-0634.md)；知识只读：[startup-reader-fixes-20261020.md](startup-reader-fixes-20261020.md)。

本审计只读旧/新代码和已有证据；没有启动Creator/模型、生成、下载、同步、清日志或写工程规范。缺口和建议尚未实施，不用代码存在冒充真实流程已验。
