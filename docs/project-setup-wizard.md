# 已有工程登记与完整安装接入（Next 0.1.17）

范围：dot 独立源码 / fake 传输 / jsdom。没有调用真实登记、安装、启动、Codex 配置或 Windows；没有部署。原 0.1.14 冻结候选 ZIP 不变。仅 `companion-workspace` 正常工程构建注册此能力；普通 / Picker、被动只读、配置编辑、知识问答构建不注册。

## 用户路径

1. 连接原同源工程会话；点击“添加已有工程”，输入已有 Cocos 工程绝对路径，核对后明确“仅登记”。这不是新建工程，也没有目录选择器。
2. 原后台返回规范路径，可能与输入不同。回执保留两者；成功后重读工程与真实状态，再选择已登记工程。不会自动 setup。状态读取会探测 Bridge，可能更新后台状态与诊断日志。
3. “安装 / 更新接入”单独打开同一向导。三项效果均默认不勾选：安装 / 更新 / 接管 Bridge 扩展及登记；经 Dashboard 启动 / 复用 Creator 并验证；持久配置 / 迁移 Codex MCP 接入。
4. 另行承认工具范围与任务复用限制：无绑定时原后台默认 full；本向导不修改工具绑定。重加工程不会恢复删除的旧绑定。原任务可能采用不同选项，返回值不能核验。
5. 五项全部主动选择，冻结工程完整身份、来源、读取版本；再次确认才提交。编辑任一选项、切换工程 / 来源、刷新快照会撤销待发送确认。
6. 202 只表示取得任务 ID。每秒串行读取已返回的同一 ID；只有匹配工程的 complete / failed 是任务终态。complete 仍不证明本次选项执行、当前 Creator 就绪或 Codex 配置存在。
7. 停止等待 / 隐藏 / 离页只暂停查询，不取消后台；已知任务可在原上下文显式恢复 GET。15 分钟等待预算到期也仅暂停。状态错误不自动重试；未知 POST 且无 ID 不再发送，需原宿主核对。

## 原始合同与副作用证据

本片逐项审阅已提供的 v148 原源码（f6dcac804fb9ad806e8094594c7820a71cfab7b8），而不是依靠端点名称猜测。v150 的 setup 默认 true / 同路径任务复用大合同由维护线程此前只读核实；本片未执行 v150 登记 / setup 场景。

| 固定请求 | 原实现 | 返回与实际效果 |
| --- | --- | --- |
| POST `/api/projects` `{path}` | `http-server.ts:306–309`，daemon `:281–284`，`project-registry.ts:26–46` | 201 裸工程记录。验证既有 Cocos 工程，realpath 后 SHA 派生 ID，已有 ID 返回原记录，写项目注册表；不安装 / 启动 / 配置。前端只投影 id/name/path/requiredCreatorVersion |
| POST `/api/setup` `{projectId,startCreator:true,configureCodex:true}` | `http-server.ts:398–409`，daemon `:412–421` | 202 `{operationId}`；不接受前端 codexPath，也不同时传 projectPath 与 projectId |
| GET `/api/setup/:operationId` | daemon `:423–426`，`setup-service.ts:7–23,43–66,84–110` | 原内存任务快照。未知 ID 普通 500，不臆造 404。没有取消、回滚、原选项、复用标识或持久操作日志 |

完整 setup 顺序：登记、安装 Bridge、按选项启动 Creator、按选项配置 Codex、按选项验证。原 `activeByPath` 按输入 trim 字符串复用活跃任务，复用发生在新选项检查之前，路径别名还可能绕过复用。即使本次 true/true，也可能复用此前 false 的任务。本片不声称它提供跨客户端幂等或原子权限复核。

`bridge-installer.ts:34–101` 可接管未登记的保留扩展目录；已经管理且预期文件 hash 被修改时拒绝，但新增文件不构成同样保护。替换备份只覆盖局部失败，不是整个 setup 事务。

`codex-configurator.ts:107–141` 会执行 mcp get/add/remove、迁移匹配的旧条目并持久写配置；未知同名条目拒绝。回滚只是尽力而为，add 在部分回滚 try 之外，不能保证失败后原配置完整恢复。验证用 Bridge projectInfo/ping，不能宣传全面身份认证或严格权限证明。

严格“仅装 Bridge”或“保证不配置 Codex”目前不能安全提交：原服务可能复用范围更大的已有任务。需要原后端原子校验执行选项 / 任务身份或提供可核验选项的专用合同；前端传 false 或先查状态都不解决竞态。此限制单列，不把全量 setup 当部分模式。

## 防重复、读取和权限边界

- 共享同一 Pinia 工程操作通道覆盖六项既有动作、登记及 setup。审批一次性，先消耗再调用 provider，底层 fetch / body / cancel 真正清理完才允许释放。
- setup 202 后仍持有通道，直到匹配任务终态且传输清理结束。UNKNOWN 无 ID / 源变化 / 清理失败不擅自解锁。known-ID 暂停保持通道；恢复只 GET，不重新 POST。
- 同页锁不锁别的标签页、CLI、原后台或其它客户端。记录仅页面内存；刷新会丢失前端 fence，用户不能把刷新当取消或安全重试。原服务无稳定客户端幂等键 / lease / CAS。
- 登记 UNKNOWN 保留原路径，至少需要结果之后发起并成功完成的原来源登记回读，才允许重新明确确认；回读不把旧 UNKNOWN 升级成功。
- 弹窗开启暂停自动工程轮询，避免周期刷新不断撤销确认。手动刷新仍有效并撤销确认。关闭 / 切换弹窗不会错误提前恢复另一弹窗的工程轮询。
- 仅原 Cookie 会话 / 127.0.0.1 Host / 严格 Origin；不新增 token、代理、跨域、持久凭据或授权默认值。localhost 本身不是用户授权；真正部署和每次副作用仍需既有宿主权限及明确选择。
- 原响应被严格有限投影；不渲染原 HTML，不显示原 error/details、connectionPath、可执行路径、token/session/PID。所有显示为 Vue 文本。
- 128 KiB / 512 块 / UTF-8 严格解析 / 120 秒传输预算；精确 UUIDv4 与工程 ID；不自动重试 POST。

## 仍未覆盖与实机验收

本片是旧功能恢复的一部分：尚未提供目录选择、新建 / scaffold / 多来源五步向导、工具预设实际分配、其他 Agent 配置、严格部分 setup。原未保存状态 Boolean 保护缺陷仍见 `creator-stop-restart.md`，本片不修改旧后台。

未来正常模式部署获准后，须验证真实 Cookie/Origin、注册规范路径、Bridge 原目录保护、旧 Codex 条目冲突 / 部分失败、任务复用与进程重启、真实 Creator 状态。任何创建持久接入的真实执行都需用户当次明确允许；当前全部测试使用 fake，没有配置账号或权限。真实浏览器视觉 / Windows 文件与进程结果不能由 jsdom 通过替代。
