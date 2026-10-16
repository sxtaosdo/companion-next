# v148 剩余功能的可执行迁移顺序

> 2026-10-15 / Next 0.1.17：已有工程仅登记与单独完整安装接入源码已迁，真实副作用逐项选择，任务复用/UNKNOWN/部分失败明确。目录选择、scaffold、严格部分setup、工具写入与其它客户端仍缺；部署和实机未执行。详见 [安装接入合同](project-setup-wizard.md)。

> 2026-10-15 / Next 0.1.16：正常模式基本生命周期源码已在0.1.14–15恢复；本片新增目录打开与移除登记源码，固定原v148接口、逐次确认、非原子风险和UNKNOWN登记回读。实机操作/正常模式部署尚未验收，添加/安装接入向导及其他原功能仍待迁；当前总差距以 [功能对照](feature-parity-current.md) 为准。详细合同见 [目录与登记动作](project-registration-actions.md)。以下旧阶段清单保留历史，不代表当前源码仍缺这些已补按钮。

> 2026-10-14 当前纠偏：旧功能全保留才是完成标准；0.1.13仅显式只读切片。最新覆盖/缺口以 [当前功能对照](feature-parity-current.md) 为准，0.1.14正常工程模式合同见 [状态与Creator操作](creator-operations.md)。下文保留各阶段原始证据。

2026-10-14 更新：0.1.13仅收窄 companion-readonly 的探测行为。工程登记/日志/调用和工具读取保留；状态、Dashboard/CIM、知识CLI和参考Python不由此只读候选触发。其他模式源码能力仍在，待独立部署/实机验证。见 `passive-readonly-013.md`；v150现场合同核验不等同全部v148功能实测。


> 知识问答源码增量（2026-10-13，Next 0.1.12）：仅KB提问 / 回答与文本引用 / 续问 / 新会话取消，逐次冻结确认、UNKNOWN保留与底层单飞保护。发送只在独立 companion-knowledge-chat 构建注册，普通/只读/配置编辑/Picker均不注册，本轮无真实发送或部署。Agent、同步、服务启停仍未迁。见 `knowledge-conversation.md`。

> 本地预设增量（2026-10-13，Next 0.1.11）：克隆新身份、名称/基础范围/工具覆盖编辑、严格批量JSON导入页面草稿与验证后导出已接源码。离页保留、刷新丢失，替换确认加一次备份；读取快照变化撤销导出。宿主CRUD/import/assign和MCP注册仍未迁入，不增加真实请求或权限。见 `tool-preset-drafts.md`。

> 原参考上传增量（2026-10-13，Next 0.1.10）：本地文件选择/Canvas预览、逐次确认、严格双文件回执及只附配置草稿、UNKNOWN与重复保护源码已接。只在独立编辑构建注册，普通/只读/Picker不上传；实际部署、Pillow/磁盘/浏览器仍未验。裁剪和原任务链不包含于此片。见 `ai-reference-upload.md`。

> 原配置编辑增量（2026-10-13，Next 0.1.9）：共用新建 / v1迁移 / v2编辑弹窗、差异确认、expectedHash保存与UNKNOWN显式回读源码已实现。普通 / Picker / companion-readonly 仍仅预览；独立 companion-config-editor 构建本轮只做dot fake验证，未获准部署或保存生产配置。见 `ai-resource-config-editor.md`。


> 原 AI 读取增量（2026-10-13，Next 0.1.8）：已实现 `#/ai-icons` 工程已保存规范 / 缺失无效态 / v1待迁移 / 后台建议草稿分开显示与显式参考预览。仅原 resource-config、reference-preview 逻辑读取；未编辑保存或生成。jobs/status/candidate 依赖未取得的实际 Studio companion_api.py 读取闭包，仍未接入。见 `ai-resource-read-contract.md`；源码与真实部署验证分开。


> CLI 源码增量（2026-10-13，Next 0.1.7）：真实登记工程的两段提示词、四条检查命令、全文复制 / 换行 / 折叠已迁入；完整 ID 与安全元数据校验、工程 / 来源变更失效有离线回归。纯文本不执行 CLI、不创建 Skill、不注册 MCP、不打开外部 Agent；实际执行和自动发现仍未完成。原“CLI 尚未迁入”的历史条目由此更新，但不能扩成配置写入已迁。见 `cli-use-copy.md`。

> 后续源码增量（2026-10-13，Next 0.1.6）：帮助工具清单已接真实目录 / 当前范围读取、本地预设预览和单预设 JSON 导出。三类同源 GET 保持原合同；标签非授权、下拉非分配、导出非服务器保存。写操作、MCP 注册与实际浏览器 / Windows 接通仍未完成；隔离 binder 未放开预设，现有 Library 静态包不变。详见 `tool-presets-read-contract.md`。

> 当前源码增量（2026-10-13，Next 0.1.5）：工程可见页约 3 秒串行刷新、日志提示合流 / 暂停恢复、调用 SSE 合并与有界重连已实现。仍需显式连接并启用；没有实际宿主 / Windows 实时验收。当前原 0.1.4 静态交付保持不变。以下旧审计矩阵保留其检查点语义，后续完成门以本增量和 `companion-live-refresh.md` 为准。v148 完整宿主来源闭包已在前序片取得，本片不再请求旧文中的源码包。

核对日期：2026-10-12。当前业务源码检查点 `eeefa0950660a7d485a87b5e4fca3f49ec51b469`（Next 0.1.2 / Library v6）；本审计先建 `688fa0a` 检查点。Windows 的 v5 验收独立进行，本文件没有要求覆盖它。旧业务总表见 `migration-parity-v148.md`；以下是推进顺序，不是完成清单。

## 证据和真实宿主前置

已消费的 v148 包提供 16 个 Web 文件及报告，来源 HEAD `f6dcac804fb9ad806e8094594c7820a71cfab7b8`，没有提供 mcp 后端。精确请求和响应证据见 `remaining-api-inventory.md`。其 UI 请求、纯函数与展示语义可复用；目前本地另有 v133 部分后端，不能将其当作 v148 后端兼容证据。

两个本地服务的身份不得混用：

- Companion Web `/api/*` 使用原 HttpOnly session Cookie；机器 `/v1/*` 是另一个 Bearer 边界，前端不读取或转交它。
- 图片审阅使用原进程 `X-Review-Token`；v6 的 Python 图片桥不是 Companion daemon，不能拿它的端口或凭据访问工程 / 知识 / 模型 API。
- 历史 `CompanionHttpServerOptions.webRoot` 可指定独立 dist，静态与 API 同源且 hash 路由不要求新 fallback。这是优先复用方向，必须在 v148 server/daemon 确认参数传播、静态限制与启动副作用后才能称可用。不新增通用代理、跨域凭据或另一套后台。
- 新的注册 / 静态入口要明确宿主种类，不在普通 Vite 或 Picker 宿主盲调 Companion API。没有后端时显示未连接，不能用静态版本或示例代替运行状态。
- 实机启动不是源码开发的自动副作用。即使另开进程，也需确认定位文件、日志、registry、cache、租约及已运行 Creator 的冲突边界，不能借“隔离端口”推断整个后台已隔离。

## 先取的最小只读源码包

均取同一个 v148 HEAD 原始字节，附路径、长度和 SHA-256；不附 env、运行配置、凭据、DB、原始日志或 session 数据。

### A. 工程 / 日志 / 调用与同源入口（最先）

- `mcp/src/companion/http-server.ts`
- `mcp/src/companion/types.ts`
- `mcp/src/companion/project-registry.ts`
- `mcp/src/companion/dashboard-projects.ts`（完整工程卡片的最近打开 / running 发现）
- `mcp/src/companion/log-store.ts`
- `mcp/src/companion/call-history.ts`
- `mcp/src/companion-daemon.ts`
- 同版本 `mcp/package.json`；存在的 `mcp/tests/companion-http.test.ts`、`call-history-http.test.ts`、`companion-daemon.test.ts` 及其直接合同 fixture。

这组用于核路由 / session / static、原始工程字段、状态读取是否带 watcher 或生命周期副作用、SSE / 日志 / 调用的分页与会话语义。不能仅从 UI 类型或端点名补造字段。

### B. 知识 / 模型（可并行交接）

- `mcp/src/companion/knowledge-adapter.ts`
- `mcp/src/companion/knowledge-service-client.ts`
- `mcp/src/companion/ai-launcher-client.ts`
- `mcp/src/companion/local-process.ts`
- `knowledge-adapter.ts` 的本地直接合同 / 类型 / CLI runner 依赖；A 组的 server/daemon 共用。
- 存在的 knowledge-http / knowledge-adapter / knowledge-service-client / ai-launcher-client / local-process 相关测试。

知识列表 / 文档读取也使用 POST；需按实际 action 的副作用区分，不能把所有 POST 当写入或把名为“读取”的临时下载当零外发。reader 与 sync writer 来源、固定 CLI、取消、响应投影、队列收据均须后端核验。不要取实际密钥或启动配置。

### C. 以后按操作补取，不阻塞 A 组读取

工程 setup / 创建 / 初始化 / 生命周期需要 `setup-service.ts`、`project-scaffold.ts`（以实际 import 文件名为准）、`bridge-installer.ts`、`creator-lifecycle.ts`、Dashboard adapter、原 MCP configurator、tool-preset-store 与各自测试。它们决定磁盘写入、未保存场景保护、配置冲突 / 回滚、范围与 Creator 权限边界。

AI 图标另取原 `icon-adapter.ts`、`icon-resource-config.ts`、`icon-image-assets.ts`、`local-icon-import.ts`、`icon-acceptance.ts` 及直接合同/测试。资源配置 expectedHash、参考图批准、任务 fence、离线来源登记、GPU 批准、选图、导入和导出均不能从 Next 规划 manifest 猜造。

## 推进片段及明确完成门

| 顺序 | 可执行内容 | 现成可复用 | 接通前必须补证 / 验收 |
| --- | --- | --- | --- |
| 1 工程读取 | 名称 / 路径 / ID 搜索，全部 / 运行 / 停止筛选，展开偏好，实际状态、最近打开、路径 / ID 复制；3 秒可见页串行读取 | v148 project-list.ts / time-format.ts / app.ts；现有有界 GET 与取消隔离模式 | A 组字段及同源宿主；不以可用/降级服务卡反推八态 runtime，不提供假生命周期按钮 |
| 2 日志 / 调用 | 工程 / 来源 / 级别 / 关键字筛选、刷新、暂停 / 恢复、滚最新；调用全部 / 失败、每页50、更多、展开摘要、SSE 合并与重连恢复 | v148 call-history.ts / call-meta.ts 与原日志展示逻辑 | A 组 query/SSE/session；测试旧页迟到、filter变化、session重置、断流；不重放工具调用。清空日志与诊断动作单独排入5 |
| 3 知识读取 | 服务 / adapter 状态，KB列表 / 详情、显式检索、文档列表 / 详情 / 原文 / 开头分块、取消与来源元数据 | v148 knowledge-page.ts 的严格解析和表单状态；不复制其中 DOM 结构 | B 组固定 CLI / 外发 / 限额 / 取消；明确用户点检索才发送查询；只读成功不是模型对话可用或索引完成 |
| 4 服务与知识动作 | 原知识服务 / 模型启动器状态和启停、嵌入 / 外开；KB / Agent 会话、追问 / 新会话；同步状态 / 来源 / dry-run / run | 已有前端请求与报告说明 | 先核 B 组启动器 ownership、CLI / 网络 / writer 队列语义；保留原显式动作确认。关闭启动器不证明模型停止；sync成功只入队，不宣称索引完成 |
| 5 工程操作 | 添加四来源 / 五步向导、目录与Dashboard、创建 / 初始化、Creator启动 / 聚焦 / 停止 / 重启、Preview / Profiler、诊断、移除注册；日志清空 | v148 app.ts 的操作流程与提示文案 | C 组及 daemon actions；操作失败 / 取消 / 未知 / 重复 / 跨工程均验。清日志要按真实删除范围确认，不以当前可见筛选欺骗用户 |
| 6 工具 / Agent | 范围分配 / 克隆 / 改名 / 保存 / 删除 / 导入导出、分类 / 单工具；MCP五客户端注册；CLI提示词 / Skill与Agent交接 | 已有 v148原帮助、agent-handoff.ts、cli-use-copy.ts与工具UI | 原配置写入/冲突/回滚、内置范围不可写、工具集合≠Creator权限；复制命令不自动执行或安装 |
| 7 原AI与统一资源流程 | 旧AI图标工程规范、参考上传、需求、inspect/enqueue/adopt、原任务查询 / GPU、选图批准、母图导入、默认 / 其它尺寸导出和验收回执；随后与新来源规划结合 | 已批准旧六步及 Next规划/来源/人工回收模块 | 原图标后端合同和每步独立批准；contain留边不冒充裁剪，Codex会话能力不冒充网页API，保留UNKNOWN与Owner约束 |

每片完成需同时记录：旧入口→新入口、真实输入 / 响应、正常 / 失败 / 取消 / 重复 / 迟到 / 上下文切换、实际结果证据。源码测试、只读页或禁用入口不算整个业务已经迁入；真实宿主和功能验收另行记录，不用 v5 或 Picker 的证据抵扣。

## 现在不等新包也能推进的工作

1. 从已核 v148 UI 提取准确交互映射与请求字段，复用已有纯函数而非从零另造业务。
2. 建立数据投影 / 取消 / 分页 / SSE会话回归清单，保留示例与未连接边界；不注册到不相干宿主。
3. 将现有资源 Project 概念与旧工程管理身份分清：现有只读 adapter 只保留 name/id/Creator版本，丢弃 path/runtime/capability。后续扩展工程管理投影，不能通过模型/知识 unknown 状态卡冒充全量项目。
4. 先核上述源包再实现下一片真实读接口；如包尚未到，不发布只有禁用操作的新“已迁移工程页”。

本片为迁移实施合同审计，没有启动真实服务、发送知识查询、改旧工程、启停模型、清日志、配置MCP或新增权限。v6交付字节与Windows v5验收基线保持不变。

## 最容易误迁的已核数据语义

- v148 UI 的普通 SSE message 触发日志重新 GET，命名 call 事件直接合并；重连拉 counts 与当前页。v133 SSE 未提供事件 ID、重放游标或心跳，不能承诺断线无丢失；v148 后端是否变化待 A 组确认。
- 调用最多每页 50 条，before 为严格更小的 sequence；total 为本次服务启动累计调用数，不是失败过滤后的条数。每工程保留1000条是历史后端证据，session变化要清旧页与游标；旧 running 响应不能覆盖终态。
- 日志清空只按工程范围，不能承诺仅删除当前来源 / 级别 / 关键字可见项；历史实现清内存，不清NDJSON。全选 / 空选工程都可能省略过滤而清全 store，因此清空需显示真实范围并核 v148 实现。
- 旧知识 / 模型页面运行后自动嵌入完整可交互 8081 / 8090 面板，iframe 不是只读功能。新只读首阶段不自动加载它；实际嵌入和外开必须保留明确服务身份 / 副作用说明。
- 旧知识 UI 的 chatSession / agentSession 会跨 KB / Agent 选择沿用，不能把这个上下文混用延续为新功能保证。新会话应按所选对象隔离，切换取消与迟到回应要单独验收；不丢失用户输入，也不向错误对象追问。
- abort 当前 HTTP 不证明后台 CLI 已停止或同步队列已撤销。同步 run 失去回执仍是未知，不自动重试。queuedOnly=true / writePerformed=false 只是入队证据，绝不代替索引完成收据。


## 本轮补证已到（0.1.3 源码片）

v148 后端参考包已取得并按29文件长度/SHA复核；A/B组和小依赖闭包已具备，详见 `companion-browser-contract.md`。原表“待补”是提出请求时的状态，不再把知识adapter或local-process列为未取得。较宽server/daemon仍不是完整运行依赖闭包，C组业务实现与实际宿主部署继续逐项补齐。

本片已实现工程、环形日志、调用手动读取与严格同源适配，独立构建入口、当前/要求版本分开、部分状态失败不丢真实工程、会话/分页/取消隔离均进入验证。SSE、自动轮询、setup、管理写动作、知识/模型业务尚未在新UI实施，不因合同已读就改成已迁。完整本片边界见 `companion-read-workspace.md`。

## 知识只读与模型状态进展（0.1.4）

已用 B 组真实合同实现只读列表、详情、检索与原文预览及模型启动器状态。没有执行问答、Agent、同步、生命周期或嵌入；也没有启动任何服务。来源登记失败显示未知与错误，不冒充成功空来源。输入和页面变化取消并丢弃旧结果。后续知识写动作需继续按原安全语义单独实施，而非借只读入口顺带启用。

当前无阻塞源码片已形成检查点；运行宿主仍缺完整本地 import 闭包以及禁止持久 locator 的启动方式。详细最小需求和不能用换端口解决的 Cookie 边界见 `companion-host-assembly.md`。在取得前不提供虚构运行命令、不替换现有部署。
