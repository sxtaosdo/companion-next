# 1.3.171 本机服务控制：已核知识启停与模型启动器关闭合同

## 完成范围与未完成范围

- 正常 Companion 工作区提供原有知识库服务、模型启动器的显式状态读取及逐次确认关闭；知识库还保留原启动流程。
- 未接入模型启动器启动、各模型生命周期操作、管理 iframe 或外部地址跳转。不能将本次交付描述为完整模型管理迁移。
- 不新增依赖、后台接口、认证能力、账户或网络设置。所有验证使用假传输；未在真实主机启停服务或模型。
- `main.ts` 的装配仅限 `companion-workspace` 且 `http://127.0.0.1`。只读、配置编辑、知识问答专用构建不注册服务操作 provider。

## v148 源码证据

参考既有自有源码闭包 `.test-artifacts/v148-host-reference/source/mcp/src/companion/`：

- `http-server.ts:229–271`：固定 Host 检查、会话鉴权以及写请求 Origin 校验先于服务控制；两个状态 GET 与四个启停 POST 路由。关闭返回 `running ? 503 : 200`。
- `knowledge-service-client.ts:8–11,59–67,93–107,162–194`：从固定 PID 文件、8081 监听者筛选候选，核对固定 `weknora.exe` 可执行路径后结束进程。匹配规则没有记录由哪个页面启动。旧错误文案中的“本页启动”不构成实例 ownership 证据，新界面明确更正。
- `ai-launcher-client.ts:55–62,80–95,123–134`：只结束 8090 监听者中命令行包含 `launcher.py` 的进程；任一监听者不匹配则不执行终止。不等待、不调用各运行模型退出。
- `local-process.ts:3–61`：PowerShell 查询监听 PID、可执行路径与命令行；`killPid()` 使用 SIGTERM，对已不存在进程忽略 ESRCH。停止可能影响所有使用该服务的客户端。
- 旧 UI 位于 `.test-artifacts/v148-reference/source/source/web/src/app.ts:2855–3053`，使用相同固定服务状态/启停路径和 `{}` 请求体。复用其服务级“关闭”语义，未自动恢复 iframe 与启动副作用。

## 原知识启动流程与模型启动限制

依据本次真实宿主只读审核交付 `v150-formal-contract-handoff-20261015.md` 第八节（第 541 行起）。此审核没有增加实时运行事实，最后允许的宿主状态证据为 2026-10-15 13:06:34 UTC；本实现没有发出真实启停请求。

知识库启动保持原 `POST /api/knowledge-service/start`，不复制脚本或秘密处理。宿主原调用为 `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File D:/services/weknora/Start-PilotAccess.ps1`，隐藏窗口、忽略 stdio、`shell:false`，脚本阶段限时 60 秒，随后原客户端最长等待服务状态 45 秒。

原有副作用已核：

- 拒绝 8081 已有监听，按既有部署清单验证文件 SHA；SQLite 以只读/query-only 检查，但写 metadata-prestart 摘要并比较既有基线。
- 清理该 PowerShell 进程中的非白名单环境。`Load-JwtSecret.ps1` 读取已有持久秘密文件并核验链接边界、SID 与 owner-only ACL，只将既有 JWT 加载到 Process 环境；不新建、改写秘密或 ACL。本次审查和前端均不收集或传输秘密值。
- 固定监听 `127.0.0.1:8081`，启动已有 `weknora.exe`，写 stdout/stderr 日志和 server.pid，沿用现有数据库/文件存储。
- 既有 `AUTO_MIGRATE=false`、`AUTO_RECOVER_DIRTY=false`、housekeeping=false、`DISABLE_REGISTRATION=true`。应用配置 `WEKNORA_SANDBOX_MODE=disabled`，不能声称所有沙箱均启用。
- 没有永久 Set-ExecutionPolicy、ACL/防火墙修改、Windows 服务注册或 User/Machine 环境持久化。Bypass 是原子进程参数，不能宣称没有该参数；也不能推断启动后二进制和业务请求永不写数据库。

模型启动器原启动后监听 `0.0.0.0:8090`，后台轮询发现 Denova 已运行时可能补启 8092 局域网代理，并写进程锁、PID 注册和代理日志（同一交付第八节模型启动器段）。启动涉及网络暴露，必须另行审批；缺少审批时不注册启动能力，也不放置假启动按钮。模型状态仍仅表示启动器可达，不表示 Comfy、GPU、模型或代理健康。关闭启动器不能描述为终止全部运行模型。

## 传输合同

`createLocalServiceOperationsProvider({ fetch, timeoutMs? })` 创建惰性 provider，不触发任何请求。公开表面仅 `label`、`run()`、`waitForIdle()`。

`run(input, signal?)` 接受的类型是 `{service:'knowledge', action:'start'|'stop'}` 或 `{service:'model', action:'stop'}`，仅允许：

- `POST /api/knowledge-service/start`
- `POST /api/knowledge-service/stop`
- `POST /api/model-service/stop`
- 精确 JSON 请求体 `{}`，`same-origin` 模式和凭据、禁止重定向、`no-store`。

没有任意 URL、路径、token、force、CLI、model start、retry 或轮询选项。拒绝扩展属性、非简单对象、符号字段及访问器输入。冻结和快照参数后才进入传输微任务。

回执规则：

- 200 必须达到目标状态：知识库启动 `running: true` 且 `frameable` 为布尔值；两种关闭必须 `running: false`，知识库关闭还必须 `frameable: false`。启动回执不证明登录、检索或索引就绪；关闭回执不证明所有相关进程已结束。
- 503 且结构符合原合同、running 与本次目标相反、有字符串 error 时为 `reported-failure`。可能已有部分进程受到影响，不推断回滚。原始诊断内容不进入 UI。
- 只有精确 403 `{ "error": "Forbidden" }` 是源码证明的操作前拒绝。
- 超时、取消、网络异常、异常状态码、坏格式、超预算回执均保留 UNKNOWN，不将失败伪装为没发出。
- 读取预算 8 KiB / 64 chunks，最大 120 秒（覆盖原知识启动 60 秒脚本加 45 秒状态等待）。严格 JSON、UTF-8、无跨域跳转。传输/reader 注入的伪造 Error 不能伪装成明确拒绝。
- `waitForIdle()` 仅证明本客户端 fetch、reader 和取消清理均已结束，绝不证明后台操作停止。无视 AbortSignal 的传输仍占用单飞通道。

## 页面和状态隔离

`LocalServiceControls.vue` 挂入既有 `KnowledgeReadView.vue`。正常知识页显示两个服务，模型页只显示模型启动器控制。知识库只在显式读取为不可达时显示实际启动控件；模型启动缺口准确显示原因，无假按钮。

- 状态读取只调用既有 `knowledgeReadProvider.loadServiceStates()`，由该 capability 发出两个服务 status GET。不会调用 `status()`，不会暗带知识 CLI / 同步查询。
- 进入页面、注册 provider、切换标签或更换来源均不自动读写。
- 只有当前独立快照明确显示服务可达才可准备关闭，明确不可达才可准备知识库启动；准备冻结服务、操作、来源与本次副作用，之后还需要独立勾选与执行。
- 每次执行同步消耗一次确认，并清除旧状态。下一次准备必须重新显式读取、重新确认。
- 路由、知识/模型标签、项目上下文或读写 provider 变化撤销确认；离开页面取消等待，保留原来源记录。
- 单飞跨两个服务、换来源及离页生效；等待停止不会放开底层请求。
- UNKNOWN 记录不可被晚回执、重新读取、共享服务卡状态或更换来源改写。当前应用内后续启停全部阻止，提示到原后台核对；没有解除 UNKNOWN 或自动重试按钮。
- 界面只呈现最近一次必要回执，不新增操作历史列表。状态、确认与最多 20 条内部回执仅驻留应用内存，不写 localStorage、sessionStorage 或磁盘。刷新整个应用会丢失内存记录，不代表取消后台操作。
- 服务概览卡与这里的独立状态/回执不互写，避免另一个页面刷新状态释放未知操作。

## 集成入口

正常工作区的装配使用：

```ts
import { createLocalServiceOperationsProvider } from './adapters/local-service-operations'
import { registerLocalServiceOperationsProvider } from './local-service-operations-integration'

// Only inside the verified normal workspace branch.
registerLocalServiceOperationsProvider(createLocalServiceOperationsProvider({
  fetch: (path, init) => fetch(path, init),
}))
```

`isCompanionLocalServiceHost(mode, location)` 提供仅正常工作区、HTTP、127.0.0.1 的精确传输构建判定；它不是认证或操作授权的替代。

## 验证

聚焦测试覆盖固定三条路径、被禁模型启动、原知识启动副作用与确认、传输预算、明确拒绝与未知、部分失败、两服务单飞、请求及 reader 的晚回执、取消清理、冻结确认、状态读取不执行 CLI、跨页/来源保护以及 UI 无 iframe/外链。

运行记录见本次交付报告；本节不把假传输测试当作真实主机验收。模型启动的网络暴露审批、真实主机启停和模型管理均不在已验证范围。知识启动脚本事实边界已核，但本次没有实际调用。
