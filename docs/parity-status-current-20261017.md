# Companion Next 当前对齐矩阵（2026-10-17）

状态：Accepted。结论：**尚未全部对齐**。仅开发者Companion，当前部署源4aaeedf/.59，产品页1.3.173，32180/PID2100；文档提交版本不等于构建源。旧真实路由及逐项原始证据见[初始25项审计](parity-audit-20261017.md)，其表格明确保留修改前时点。本表区分真实验证、隔离测试与缺失，帮助文字/占位不计成功。

| 功能 | 已实现且验证的范围 | 缺失 / 未验证 | 证据 |
| --- | --- | --- | --- |
| 原四页导航 | Next对应真实路由、离线UI | 页面内部缺口分别列下 | src/router.ts；初始审计 |
| 帮助/关于/版本/更新记录 | 原文、复制换行、图标二维码、版本来源及UI | 帮助中的业务描述不能替代功能 | docs/migration-parity-v148.md |
| 工程列表/概览默认真实首项 | 真实登记、选择与卡片源代码/回归 | 完整真实状态切换未逐一复验 | RegisteredProjectOverview、CompanionBrowserView |
| 状态同步/折叠/过滤/复制 | 原状态映射、折叠和局部更新回归 | 用户长会话所有状态组合未验 | tests/companion-browser-ui、companion-live-store |
| Dashboard/目录选择 | 真实只读8条/6登记匹配；系统选择适配及UI | 真实系统选择点击未验 | dashboard-discovery-local.md；project-directory-local.md |
| 添加/初始化工程布局 | 原Creator3.8.8 scaffold；隔离Temp工程201真实接口及UI | 无实际Creator启动验收 | project-scaffold-local.md |
| 打开/停止/重启/唤起/目录/移除 | 生命周期适配、操作隔离与UI回执 | 本轮不启动Creator，完整真实动作未验 | creator-operations与其测试 |
| Preview/Profiler控制入口 | ready工程预览/探测/状态/刷新及Profiler已接原接口，330+46分组测试、六文件HTTP SHA及隔离Edge6操作通过 | **真实运行待验**；本轮无真实Creator/Preview/Profiler执行，历史96资源验收不能替代入口真实运行 | preview-profiler-entry-20261018.md；9319ddd/.48 |
| 登记/完整安装接入 | 旧配色/布局、确认与任务轮询已接，隔离UI | 严格部分安装尚受旧复用任务合同限制，真实安装/客户端配置未执行 | ProjectSetupWizard；setup-completion-usage-20261017.md |
| 安装完成使用示例 | 原文/缺省/复制/换行、失败不显示、断开不复活，三分支Edge | 完成回执不证明本次选项执行或真实连接 | d982a34/.42；setup-completion-usage-20261017.md |
| 工程空态/最近调用本地计时 | 已核实空登记可开原添加向导，筛选无匹配同时清空两个本地筛选；运行100ms/结束1s本地更新耗时；67项回归和Edge3分支已部署 | 不以读取失败冒充空工程；没有为本地计时新增请求 | project-empty-call-meta-20261018.md，f903bc2/.54 |
| 弹窗内斜杠焦点 | CLI、安装、Creator及可见modal保留焦点，关闭后恢复工程搜索；92项回归及Edge5场景已部署 | 外部客户端协议唤起仍未迁移 | modal-search-shortcut-20261018.md，2524d9b/.50 |
| 日志查询/刷新/暂停/滚到底 | 保留DOM/滚动、过滤、工具条回归，已部署 | 长会话/真实200条布局组合未完全验 | log-tools-20261017.md |
| 日志筛选即时查询/诊断目标上下文 | .56已部署；63项回归、strict/构建；Edge核验关闭实时筛选单次GET、Preview默认目标、显式工程优先；六文件HTTP SHA一致 | 真实诊断发送0，Preview回执为独立浏览器受控fixture；不能替代真实Creator验收 | log-filter-diagnostic-context-20261018.md，7bc072d/.56 |
| 日志清理/诊断 | 内存清理隔离实例验证磁盘不变；真实诊断一次下载583B | 生产DELETE=0；诊断如实保留Bridge不可达 | log-tools-20261017.md |
| 调用历史/分页/最近调用跳转 | 历史82项回归；准确工程鼠标/Enter/Space受控Edge | 长会话并发/SSE组合未完全验 | history-read-regression-20261017.md；837b43f/.40 |
| 工具目录/当前范围/工程直达 | 卡片带精确工程；源绑定、迟到取消；70项回归及两工程Edge | 本次浏览器业务GET为隔离数据，未证明客户端即时工具集 | project-tool-scope-entry-20261017.md；a8813ac/.44 |
| 工具类别折叠/全选/半选 | 完整类别而非搜索子集批量选择；未知覆盖保留；100项回归、strict、构建及Edge4场景已部署 | 真实持久写入未验；此批量修改只改草稿 | tool-scope-selection-20261018.md，dcd9d70/.52 |
| 工具预设草稿/CRUD/导入/分配 | 原适配与明确确认写入流程，离线/隔离测试 | 真实持久写入未验；旧API无expectedHash，不能承诺并行原子保护 | ToolPresetWritePanel；tool-presets-write测试 |
| 发送到Cursor/Codex本机编辑器 | .59恢复帮助、CLI及安装完成原copy-block入口；完整复制后固定本地协议，迟到失效/失败阻断；78项必要回归、strict/构建、Edge受控传输及六文件HTTP SHA通过 | 真实OS协议应用唤起未执行；长文本回退本批为针对测试证据，非浏览器长文本实机证据 | editor-handoff-owner-bytes-20261018.md，4aaeedf/.59 |
| CLI提示词/复制 | 文本与复制UI已接 | 复制不执行命令或验证Agent | CliUseDialog |
| 五MCP客户端注册/冲突处理 | 原合同已核 | **未完整迁入**；缺可验证配置读取合同，未实写配置 | 初始审计；log-tools-20261017.md |
| 知识库/文档/原文/切片读取 | 有界读取与原文展示适配/测试 | 真实8081当前未通验，二进制读取无新增 | KnowledgeReadView；knowledge-read |
| 知识服务/内嵌页面/外开 | 原启停回执、固定8081外开，running且frameable才内嵌；受控验证 | 真实running=false，未启动模型/服务通验iframe | 8aace09/.38；LocalServiceControls |
| KB问答/停止/新会话 | 原sender与UNKNOWN会话隔离测试 | 真实模型链路暂停，不宣称通过 | KnowledgeConversationPanel |
| Agent问答/新会话 | Agent列表读取 | **问答/停止/新会话未迁入** | 初始审计 |
| 知识同步计划/执行/源管理 | 同步状态读取 | **计划/执行/源管理未迁入**，需先核源授权合同 | route-production-audit-021.md |
| 模型服务 | 只读状态、启停适配/隔离测试 | 原页/可工作iframe缺；用户暂停全部本地模型工作 | 初始审计 |
| AI图标/变体/资源导入 | 真实96变体PNG/meta/UUID、独立场景重开/Preview/Build/Smoke已通过 | 不覆盖全部图标生成、上传和通用资源流程；真实生成暂停 | variant-ui-import-20261017.md；历史RUNTIME-96证据 |
| 通用资源规划/会话交接 | 规划草稿/来源切换/回执列表 | 真实会话字节回收与资源链路未全闭环 | RegisteredProjectResources、AiJobActionsPanel |
| 图片素材/owner字节 | 独立页面与适配存在 | **正常Companion provider与owner真实字节预览/保存链路未闭环** | src/main.ts；ImageAssetsView |
| 实时更新 | 局部轮询和SSE、暂停/迟到拒绝回归 | 真实长会话未完全验，不整页刷新已实现 | companion-live-store测试 |

最新两片交付均只改Next代码和其静态文件，无推送/云上传/安装软件，无旧WindowsCompanionUI或生命周期修改。共享22项改动保护通过，模型/Creator未启动。外部OCR被自动审批拒绝，原因是可能联网检查更新/传源码；未重试，已用本地检查和独立只读review，不能声称OCR通过。

2026-10-18 收口：.56日志筛选关闭实时/暂停时即时查询与最近Preview诊断目标已实现，63项回归、strict、构建、独立只读review通过；实际页面3场景及六文件HTTP SHA通过，证据见 log-filter-diagnostic-context-20261018.md。普通只读构建保持手动边界。旧帮助发送到Cursor/Codex（app.ts2253–2299）已在.59恢复固定本地协议及受控传输验收，未真实启动应用。模型、Agent问答、知识同步继续暂停。最终有界只读查漏未确认其它可在当前接口及授权边界内独立补齐的小项，不代表全量功能验收通过。

2026-10-18第二批收口：.59编辑器交接已部署，.60为文档版本；图片真实owner缓存字节只读核对通过，当前32180正式session下三owner路由404，最小接入方案在 editor-handoff-owner-bytes-20261018.md，未改旧daemon或新增监听/代理。仍未全量对齐。
