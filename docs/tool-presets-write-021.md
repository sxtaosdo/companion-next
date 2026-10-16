# 1.3.171 工具预设正式持久化

## 已核实的原合同与副作用

只复用用户项目现有 v148 实现和新后台已有克隆、编辑、导入、导出代码；没有外部项目、依赖、凭据或新 API。

核对来源：原 `source/mcp/src/companion/http-server.ts:349–397,489–490`、`tool-preset-store.ts`、`paths.ts:28`，原 `source/web/src/app.ts:1008–1111`。核对时读取 `/workspace/shared/companion-next/.test-artifacts/v148-host-reference/` 和 `v148-reference/` 下的原源码，没有运行后端。

| 操作 | 原请求 | 原回执与实际影响 |
| --- | --- | --- |
| 创建 / 克隆 | POST `/api/tool-presets`，name/baseProfile/enabled/disabled | 201，单个自定义预设。宿主生成新 ID；写入全宿主自定义集合。 |
| 改名 / 保存 | PATCH `/api/tool-presets/:id`，同上完整可编辑字段 | 200，更新项。覆盖该预设；所有选用它的工程可能受到影响，API 不返回完整关联工程列表。 |
| 批量导入 | POST `/api/tool-presets/import`，schemaVersion:1 + presets | 201，只返回批次首项；实现先校验整批、写入整批，再返回。UI 仍要求显式回读核对完整批次。 |
| 分配工程 | POST `/api/projects/:id/tool-preset`，仅 presetId | 200，所选预设。持久化工程选择。没有 setupOperationId，没有自动跳过原 webCall。 |
| 普通删除 | DELETE `/api/tool-presets/:id`，无 body、无 confirm 参数 | 未使用时 200 `{deleted:true,projectIds:[]}`；在用时 409 与关联 projectIds，未删除。 |

原仓库把自定义项和工程选择保存在 Companion 数据目录的 `tool-presets.json`，写临时文件后 rename，目录模式 0700、文件模式 0600。该文件替换方式不是并发事务：读改写之间没有 CAS/hash/fencing。前端绝不宣称可防止另一页面或服务覆盖，也没有新增文件权限接口。

工程分配是持久变化，不只是预览。旧 UI 克隆后会自动分配；本实现把创建和工程分配拆为两个明确确认的原请求，创建回执不能代替分配授权。工具可见范围不提升 Creator Bridge 权限；已连接 MCP 客户端需要重连后使用新范围，不会自动重连或注册 MCP。

## 强制删除的保守边界

原 DELETE `?confirm=true` 会删除指定自定义预设，并把它当时的所有关联工程改为 full。这可能扩大工具可见集合。原协议无法把预先看到的关联工程列表作为原子前置条件；409 到强制请求之间关联范围仍能变化。

因此本片只恢复普通删除：每次先展示具体预设并要求确认。遇到格式有效的 409 只展示经过校验的关联工程 ID 和风险，不自动重试，不生成 confirm=true，也没有隐藏的强制删除按钮。用户可逐个核对工程、确认分配所需范围，刷新后重新执行普通删除；新的并发关联仍会使普通删除拒绝。此边界不能描述成已完整恢复强制删除。

## 来源与确认

- 入口仍在原“帮助 / 工具清单”页，没有新页面或导航。现有 `ToolPresetDraftPanel` 继续提供克隆、编辑和 JSON 暂存；新 `ToolPresetWritePanel` 接受这些候选，真正调用持久化接口。原导出入口不变。
- 只有正常同源 workspace 注册 `createToolPresetWriteProvider` / `registerToolPresetWriteProvider`。构造、注册、挂载、准备确认和切换预览均不发写请求；未注册 writer 的只读构建保持原说明且无写入口。
- 每个确认冻结完整操作、来源 reader、具体工程 ID / 名称 / 路径 / 登记来源、原预设和更新内容；覆盖已有预设时同时记录原页面草稿 ID，避免把来源草稿与目标 ID 混淆。
- 工程登记必须来自当前 `companionBrowserProvider`，且与 `projects.provider` 相同并已成功连接。确认绑定完整 ManagedProject（包括 path）、登记 provider 身份和快照 revision。相同 ID / 名称但路径改变、登记来源替换、A→B→A、目录刷新、工程切换、预览切换、草稿编辑、关闭页面均撤销旧确认。每次真正分配必须再勾选具体操作确认。
- 原接口分配请求仅能传 projectId，不能对服务端路径作原子约束。UI 显示并行登记变化风险，不宣称冻结前端路径可以锁住宿主。
- 没有 hash 或 If-Match；不凭空添加伪并发字段。固定内容使用显式 name/baseProfile/enabled/disabled，创建不依赖可能变动的 sourcePresetId 默认值。

## 输入、回执与预算

- 复用严格草稿和读取校验，保留 core/full 内置保护、40 字名称限制、英文保留名、大小写无关的自定义重名检查、20 项自定义上限、ID 冲突、未知工具、重复或交叉 override 检查。
- 请求只允许固定相对端点，same-origin Cookie 会话、redirect:error、cache:no-store。没有可配置 base URL、认证 header、客户端注册、凭据存储或新服务调用。
- 请求及回执 1 MiB，回执至多 2048 chunks，严格 UTF-8；默认 / 最大 20 秒覆盖 headers 与 body。原读取 adapter 继续使用原读取预算。
- 回执重新核验目标 ID、名称、baseProfile、overrides、内置属性；仅创建允许服务端新 ID，更新允许更新时间变化。导入首项必须与批次首项完全匹配；分配回执必须与被确认的预设完全一致；普通删除仅接受空 projectIds。
- 401/403 和合法删除 in-use 409 作为明确拒绝；其余不确定状态、损坏回执、错误 MIME、超限、网络失败、发送后取消与超时全部保留 UNKNOWN。不会回显原错误响应、路径、token 或内部诊断。

## 单飞和 UNKNOWN

writer 同时最多一项操作。lease 追踪 fetch、每个 reader.read、reader.cancel 和晚到 response 的 body.cancel；逻辑超时不释放尚未真正结算的 I/O。`waitForIdle()` 只在所有 I/O 完结后结算。

store 在确认调用结果和原 writer lease 都结算前一直保留 sending，哪怕离页、换源、收到逻辑 timeout 或取消等待。不能通过新 provider、回读或 UNKNOWN 确认绕过旧请求。晚到成功回执不会改写已经取消的 UNKNOWN。

显式“回读核对上次操作”固定使用原 reader 与原工程，回读区始终显示冻结原来源、登记来源及工程完整路径，即使当前页面已切到同ID不同路径/来源；只展示当前快照是否与预期对应；不自动把 UNKNOWN 改成成功，不重试写入。全部旧 I/O 已结算且显式回读完成后，用户可以确认自己已核查原宿主；原操作仍声明未知。开始新操作还必须刷新目录和预设，再准备一次新的明确确认。成功回执后的下一项写入也必须刷新读取快照。

## 验证范围

仅注入 fake fetch、fake provider、ReadableStream 和 Vue 测试。没有调用真实服务、Windows、Creator、客户端注册、权限配置或实际工具预设库。没有 build、全测或提交。

Focused：

`npx vitest run tests/tool-presets-write-adapter.test.ts tests/tool-presets-write-store.test.ts tests/tool-presets-write-ui.test.ts tests/tool-presets-read-ui.test.ts tests/tool-preset-drafts-ui.test.ts`

覆盖固定路由和 body、默认零请求、每次确认、内置/重名/未知工具/大小、批量首项回执、普通删除拒绝强制重试、wrong receipt、取消/超时/坏 UTF-8、body/read/cancel 分别挂起、跨换源/离页保留 lease、登记 path/source/revision 变化、草稿变化、UNKNOWN 显式回读、原只读和草稿 UI 回归。

`npx vue-tsc --noEmit --pretty false` 在本片完成时通过。真实 v148 Windows 同源写入及浏览器人工点击尚未验证，不把 fake 回执当真实持久化验收。
