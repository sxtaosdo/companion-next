# Companion 同源只读适配器

## 当前交付边界

`src/adapters/same-origin-readonly.ts` 实现已有 `ReadOnlyCompanionProvider`，只提供一次性快照读取。它是可供后续部署接线的兼容适配器，**当前默认不注册、不联网**。构造适配器不会执行请求，仓库的默认启动也没有注册真实数据源。

本次只使用注入的测试 transport；没有从 dot 工作区访问用户的 `127.0.0.1`，没有连接真实 Companion、操作 Windows 工程、修改原后端或发布部署。测试通过只证明所述 adapter 行为，不是运行中的 v138 / 冻结的 v142 集成验证。

## 证据与版本缺口

适配依据：远端 v0.3.133，提交 `e1bd5824e6c10a495b32891da0e1a1b8abd70962`。

- [http-server.ts](https://github.com/sxtaosdo/cocos-mcp/blob/e1bd5824e6c10a495b32891da0e1a1b8abd70962/mcp/src/companion/http-server.ts)：257 行 `GET /api/projects`；272 行 `GET /api/status`；约 199–208 行 Host / cookie / Origin 条件；627–643 行一次性启动码与 cookie。
- [types.ts](https://github.com/sxtaosdo/cocos-mcp/blob/e1bd5824e6c10a495b32891da0e1a1b8abd70962/mcp/src/companion/types.ts)：`ProjectRecord` 与 `ProjectRuntimeStatus`。
- [companion-daemon.ts](https://github.com/sxtaosdo/cocos-mcp/blob/e1bd5824e6c10a495b32891da0e1a1b8abd70962/mcp/src/companion-daemon.ts)：225、260 行回调绑定，586 行起 `resolvedStatus`。
- [web/src/app.ts](https://github.com/sxtaosdo/cocos-mcp/blob/e1bd5824e6c10a495b32891da0e1a1b8abd70962/web/src/app.ts)：2169–2170 行旧前端使用两个相对 GET；3537 行起旧 SSE。

基线检查已对 54 个参考文件逐一核对 Git blob SHA。用户本机最新冻结 v142 尚未提供可核对源码；用户报告运行的版本为 v138，不能据 v133 断言两者兼容。资源规划 preflight 接口也未在这份证据中建立。adapter 永远不把新前端版本、这份参考提交、响应中的同名猜测字段当成正在运行的后端修订号。

“只读”指仅调用已核实的观察接口，不执行工程或配置动作。旧后端的 `listStatuses` 会 refresh Bridge，并在断连时清理连接缓存、更新生命周期状态；这里不承诺后端内存完全没有维护变化。

## 接线与同源前提

只有未来已获授权的集成阶段才能显式接线；本次不修改默认入口、不部署适配器。宿主先确认新前端由既有 Companion **同一个 origin** 提供，并沿用其既有登录会话，再注入浏览器原生 fetch。

未来调用方式示例（**不要添加到当前默认入口**）：

```ts
import { createSameOriginReadOnlyProvider } from './adapters/same-origin-readonly'
import { registerLiveProvider } from './integration'

const provider = createSameOriginReadOnlyProvider({
  fetch: (path, init) => window.fetch(path, init),
})
registerLiveProvider(provider)
// 注册不联网；用户显式选择并连接 provider 后才读取。
```

部署约束：

- v133 仅绑定 `127.0.0.1`，Host 接受 `127.0.0.1[:port]`，不接受 `localhost` 作为别名。
- `/api/*` 使用已有 `creator_ai_session`，由浏览器管理，`HttpOnly; SameSite=Strict; Path=/`。adapter 不获取、读取、存储或重建 cookie。
- `/auth` 一次性启动码仍由既有流程处理；adapter 不登录、不生成新会话、不刷新权限。
- **不接受 baseURL / token / 自定义认证头**；不支持外部地址、跨域代理、宽 CORS、新安全设置或 localStorage / sessionStorage 中的 Bearer。
- 独立 Vite 端口与旧 daemon 是不同 origin，不能直接把这份 demo 页面改成跨域请求用户 daemon。需后续审查明确的同源部署安排。
- 旧静态服务没有 SPA history fallback，当前 hash 路由更适合不改后端的部署。
- `/v1/status` 的 `{ running, projects }` 是机器 API 结构，与 `/api/status` 的数组不同。该 adapter 不请求 `/v1/*`，不会宽松接受错误接口的包装结构。

注入 transport 是宿主的可信依赖边界，用于测试与浏览器调用；宿主不可把它替换成添加凭据、代理或重写目的地的 wrapper。

## 请求与资源预算

每次 `loadSnapshot(signal?)`：

- 最多同时请求固定的两个路径：`/api/projects`、`/api/status`。
- `method: GET`，`mode: same-origin`，`credentials: same-origin`，`redirect: error`，`cache: no-store`，`Accept: application/json`，无请求体。
- 两次读取共享 4 秒默认 deadline；可显式配置 1–10000 毫秒，不接受无限超时。
- 每个响应最多 128 KiB、1024 个流块、200 条记录。先检查可用 Content-Length，再按流实际计数；不调用无界 `response.text()`。
- 同一个 provider 同时只允许一次 load，重复请求以 `busy` 拒绝，不新增网络请求；完成或取消后可重新读取。
- 不自动重试、不缓存上一次数据、不轮询、不创建 SSE。调用方负责取消旧读取和最新请求保护。
- 成功、失败、超时和取消后清除 deadline 与调用方 abort listener；未完成响应会取消 body。注入 transport 即使忽略 signal，调用也会在 abort/deadline 后及时结束。恶意 transport 自己创建的外部副作用不属于此 adapter 的可控范围。

## 最小数据投影

工程：只读 `id`、`name`、可选 `requiredCreatorVersion`。只向 UI 投影 `id`、`name`、`engineVersion`，并将 `styleApproval` 设为 `unknown`、`protectedAssets` 设为 `null`。不读取或展示 `path`、`connectionPath`、`creatorExecutable`。

运行状态：只读 `projectId`、`state`、可选 `creatorVersion`。未知状态、错误类型、重复 ID 或错误包装结构使该端点失效；不会把 `running: true`、`ready: true`、`status: 'ready'` 当成 `state: 'ready'`。

- `ready` → 此工程 Creator / Bridge `available`，并明确没有运行验收。
- `launching` / `bridge-wait` / `stopping` / `incompatible` → `degraded`。
- `stopped` / `crashed` / `error` → `unavailable`。
- 工程缺少对应状态 → `unknown`，无 `checkedAt`。
- 没有工程登记的状态仍以“未关联工程”显示，不据此伪造工程记录。

Companion 只读接口的 `available` 仅表示两个响应完成并通过解码；部分成功为 `degraded`。模型与知识库明确保持 `unknown`，不会由 HTTP 200 推断就绪。原始错误文本、session ID、PID、preview URL 和额外字段均不投影。

资源列表始终为空；`spec` 与 `revision` 始终缺省。没有样板资源、默认审批、导入、绑定、视觉校验或运行测试结果混入真实数据。

`source.observedAt` 只在至少一次实际请求成功且通过解码后生成，表示本次最后一次有效读取的完成时刻；它不是 daemon 事件时间，也不是全局一致性版本。每条已取得的 Creator / Bridge 状态使用状态端点实际成功时间作为 `checkedAt`。两次查询非原子同步；登记/运行状态缺失匹配会提示。

## 失败契约

结构化错误为 `ReadOnlyAdapterError`；其 `failures` 仅含固定端点、分类与可选 HTTP status，没有响应正文或原始异常。

- `unauthorized`：401，防御性处理；已核实 v133 的拒绝通常是 403。
- `forbidden`：403，可能需要核实已有会话或 Host / 同源条件，不能断言一定是登录过期。
- `http-error`：其他非 2xx 状态。
- `network-error`：transport / 连接失败。
- `invalid-shape`：非 JSON、无效 UTF-8 / JSON、非预期数组、字段类型或枚举错误、重复 ID、记录数超限等。
- `response-too-large`：响应字节或流块预算超限。
- `timeout`：deadline 到达。
- `aborted`：调用方取消，Error name 同时是 `AbortError`。
- `busy`：同一 provider 的前一次读取尚未结束。
- `all-reads-failed`：两个接口均无有效数据，抛出错误而不是带伪造时间戳的空成功快照；具体原因在 `failures`。

一个端点失败时仍返回另一个端点的有效数据，`source.limitations` 明确标记失败路径、分类和 HTTP 状态（若有），接口服务降级，缺少状态的工程为未知。调用方主动取消时，纵使已有一个端点成功也不发布局部结果，以免旧操作覆盖新导航。完整失败与取消都不会返回上次快照。

## SSE 与后续核对

本适配器尚未实现 SSE。v133 `/api/events` 是日志 default message 与调用历史 `call` 事件，不是完整工程状态源，也没有 replay ID / cursor。未来实现须独立审查断线、重连、会话切换、旧响应丢弃、关闭清理与请求预算，不能通过创建永久 EventSource 冒充实时状态已完成。

接入用户当前版本前需要：取得授权的 v142 加相关工作树快照；逐一核对两个 GET、身份与同源条件、运行状态枚举；决定正式部署方式；再做真实会话失败 / 取消 / 局部失败 / 浏览器路由验证。资源规划的读取接口和验收证据另行核对。

## 验证

Focused suite：`npm test -- tests/readonly-adapter.test.ts`。全部请求由注入的假的 transport 处理，无真实网络读取。

覆盖默认不连接、两条相对 GET、字段最小投影、状态枚举、混淆结构、路径与错误正文不回显、空结果、缺失/孤立状态、401/403/其他 HTTP 错误、JSON/UTF-8/网络失败、响应预算、预先取消、读取中取消、忽略 signal 的 transport、fetch/body 超时、部分超时的时间语义、重复 load、listener/timer 清理及超时参数边界。

完整测试执行结果由本次交付报告记录；本文件不将仅有测试计划当成已经通过。
