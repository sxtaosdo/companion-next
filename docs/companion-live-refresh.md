# v148 可见页刷新与实时记录

0.1.13构建边界：companion-readonly的项目轮询仅请求登记projects，不请求status/Bridge或dashboard/CIM；事件流和计数/日志/调用回读保持原流程。其他专用构建保留原探测语义。见passive-readonly-013.md。

Next 0.1.5，2026-10-13；任务基线 `4d1429c`，修改前检查点 `1a72b2f`。仅 dot 已批准工程内代码，不增加依赖、权限、持久凭据、后端路由、发布或 Windows 动作。

## 已核原合同

- 原来源提交 `f6dcac804fb9ad806e8094594c7820a71cfab7b8`，已物化的 `mcp/src/companion/http-server.ts:744–759`。GET `/api/events` 沿原同源 session Cookie，默认 `message` data 是 DebugEvent，命名 `call` data 是 `{ sessionId, total, record }`。
- 原 `web/src/app.ts:2490–2505,3491–3497,3534–3559`：可见页 3 秒工程刷新，日志暂停独立，默认 SSE 提示重查日志，call 合并，open 重查 counts / 当前调用。
- 无 event id / replay / heartbeat。`total` 是工程累计 begin 数；旧调用 finish 时可能携带更新后的 total，不能把这条 finish 一律当 latest。

## 实现与限制

1. 独立 `companion-readonly` 构建才注册固定相对 `/api/events` 工厂。普通 / Picker 构建无注册。仅点连接先读 HTTP；再次点启用才创建 EventSource。没有 URL 输入或 token 读取 / 转发。
2. 64 KiB UTF-8 单帧预算。默认日志字段严格校验后只发无内容提示；调用复用现有脱敏 DTO 解码。未知具名事件不监听；坏帧立即移除监听并关闭。错误只暴露固定安全文案。回调关闭后惰性丢弃，不允许原生无限重连。
3. 工程刷新完成后再等约 3 秒；同一工程请求进行中，手动刷新不另发一轮。日志 burst 在 400 ms 合流；未完成不叠加日志请求。保留当前筛选；变化立即作废旧读取。日志暂停停止实时日志待发 / 进行中读取，恢复补一次；手动查询不受其限制。
4. `open` 重新核对统计和当前调用首批，日志重读有限窗口。HTTP 与 call 竞争保留终态和较新累计数；较新 total 没有对应 sequence 时 latest 未知，不把旧摘要冒充最新。跨服务 session 清旧 counts / 详情 / cursor；HTTP 发现新 session 立即关闭旧流、重新订阅，旧排队事件失效。
5. 隐藏页面、离页、断开和 provider 更换会关闭 stream / timer、abort 查询、拒绝旧响应。可见恢复重读工程并重开事件流。8 秒未 open 算连接失败；1 / 2 / 4 秒最多三次重连，不因一次 open 或隐藏 / 显示重置预算。坏帧不重连；明确重新启用才复位。事件停止时已启用的工程轮询独立继续；工程必需读取失败则清旧状态、停止实时模式。
6. 已验证事件也不证明 Creator 在线、任务执行成功或数据绝不缺失。断线重新读取最多 200 条日志 / 首批 50 条调用，不能补回所有历史；事件状态不代表服务心跳。最多保留 1000 条详情；事件只为已登记工程建立 counts 项。

## 验收

测试注入内存 HTTP provider、EventSource 双，不做网络。范围包括显式开启、串行刷新、可见性、取消 / 换源、超时 / 冷却上限、日志合流 / 暂停 / 筛选、call 终态竞争、旧完成 latest、跨 session 及 DOM 控件。最终实际命令结果见 `validation.md`。

前序独立 `host/v148-runtime-binder.ts` 的原 HTTP / Cookie / SSE 21 组测试仍有效，使用独立实例测试数据；不可运行的 `companion-read-assembly.ts` facade 不能拿去直接 listen。本片未将新的前端事件 adapter 接上真实宿主复验。

尚未验收：真实浏览器 EventSource / 可见性调度、原宿主 Cookie 会话实际连接、Windows 实时变更、断网恢复时可见效果。没有更换前序 Library 包或 Windows 服务。管理操作 / 清日志 / 诊断导出仍待迁。
