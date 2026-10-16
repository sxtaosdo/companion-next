# 1.3.171 服务状态真实读取

## 来源与展示边界

专用 Companion 构建以及已登记真实 reader 的普通开发页不读取通用 workspace 示例服务。来源缺失、读取失败和缺少某工程状态分别显示为未知，不伪造“全部健康”、离线或零工程。仅有效空登记响应可显示 0 个已登记工程。非专用、没有真实 reader 的原示例分支保持原行为。

复用现有已核 adapter/provider，不新增端点或传输：

- Companion：`loadProjects()` 的有效登记响应仅显示“API 已响应”。正常 workspace reader 请求 GET `/api/projects`、`/api/status`，其已有配置关闭 Dashboard 发现。
- Creator / Bridge：只逐项展示已登记工程的八种原始运行状态；缺少状态显示 unknown。展示原响应的 Creator 版本、工程要求版本、Bridge 能力与运行 sessionId。孤立状态与未登记 Dashboard 发现不会创建工程行。
- 知识服务与模型启动器：只调用 `loadServiceStates()`，对应 GET `/api/knowledge-service/status` 和 `/api/model-service/status`。从不调用会执行 CLI / sync 探测的 `status()`，也不调用知识查询、模型列表、对话、启动或停止接口。
- `running=true` 只显示服务/启动器可达；`running=false` 显示“探测未达”，不证明进程退出。`frameable` 仅展示返回的页面嵌入标记，不嵌入后台。
- ComfyUI：原8090启动器已有详细状态，但已核v150 Companion同源接口只返回启动器可达，没有透传Comfy健康详情，因此本页保持未知。不能从模型启动器可达推导 ComfyUI、模型、GPU 或生成链路就绪。

每个有效来源展示 provider label、实际合同路径及本次客户端完成读取的 ISO 时间；这些时间不是服务端心跳或健康保证。知识或模型其中一项失败时，成功项保留自己的数据，缺失项没有有效读取时间。部分错误以短提示配可聚焦、Escape 可关闭的 InfoTip 展示。

## 读取生命周期与操作安全

`service-status` 是展示协调 store，复用原 provider 与 domain 类型，独立持有页面快照。它不修改 `companion-browser` 的 provider、连接状态、工程数组、observedAt 或 projectSnapshotRevision，不调用工程写入、计数、日志、SSE、live polling 或任何操作恢复动作。

正常 workspace 仅在 `companionProjectEntryProvider === companionBrowserProvider` 的既有 opt-in 下做一次页面入场读取。不会轮询、失败重试循环或在工程 lane 释放时补读。显式按钮刷新/重试覆盖所有已经接入的服务读取。刷新开始清空此前成功证据；读失败不会保留旧成功或回退为示例。

同一刷新期间点击和 provider 同步重入合并为单次 flight。来源替换（含 A→B→A）、页面离开、KeepAlive 停用、隐藏时取消当前请求；迟到回包不能回填，也不能清除另一个来源的新 busy 标记。隐藏后不会自动补读。

手动与自动路径都检查共享工程读忙、暂停确认、Creator/setup 冻结确认、操作 lane 和 UNKNOWN 屏障。新忙状态同步取消页面请求并清除成功证据；既有工程读取不会被服务页取消。服务页不会关闭确认、释放 lease、修改回执或替代原工程页的未知结果核对。

## 被动只读构建

不接受 probe-enabled reader；仅调用明确 `runtimeProbesEnabled=false` 的既有 reader，其合同只读 GET `/api/projects`。即使错误地登记了知识 provider，也不会调用知识或模型服务。没有正常 workspace entry opt-in，因此保留手动读取。

## 本地验证

`npm test -- --run tests/service-status.test.ts`：20 项定向 store / DOM 测试通过。覆盖四条实际 adapter GET、八态、零/缺失/孤立数据、部分失败、来源/时间、运行可达不等于健康、单飞同步重入、A→B→A、隐藏/卸载取消、错误无自动重试、共享读取不被取消、lane / Creator UNKNOWN / setup UNKNOWN 回执隔离、冻结确认以及 readonly 负向边界。

所有 provider 响应来自本地 mock，没有连接真实服务、启动后台、访问 Windows、安装依赖或部署。此报告不代表真实浏览器布局、Windows 服务连通或完整构建验收；全量检查由主任务统一执行。
