# 图片审阅受保护操作合同

本次只修改独立 Companion 的桥接源与离线合同测试；没有启动图片审阅服务、绑定端口、联网搜索、下载图片、打开目录选择器或写用户图片。没有改 Windows 原工程、原服务源码、token、CORS、CSP、依赖、权限，也没有推送或部署。v5 固定交付不在本文件的运行验收范围内。

## 源码核对与复用边界

核对的原审阅版本是 `v0.1.0.20`，提交 `776b7ea4de6d03b6dde408fcf27b51490967f367`。本轮七个参考文件的原字节长度及 SHA-256 均与提供清单匹配；仅作为只读参考，没有导入或启动这些文件。它们不是完整 runtime，缺少原依赖与帮助程序，不能据此宣布真实后端集成通过。

桥接启动器原有三核心文件 SHA 固定值保持不变：

- `app.py`：`26e9e7cad8519c54fab2378eccd9e1833d23c51875fd552da0c7ecf3e62ad959`
- `publicImages.py`：`4838d7c068cfcdbce5ca54a4c05618f93be783016313acaa2d3958cb669276b0`
- `taskStore.py`：`41aa8936543b3d0117b0773871e61b6bcea8f78960b9b481fb9e43b7b71905a1`

原 `ImageApplication.lock` 是不可重入的 `threading.Lock`；原 `TaskStore.lock` 是 `threading.RLock`。统一锁序为应用锁 → store 锁。在持有应用锁时，不调用会再次获取它的原 `claim/select/export/change_task/recycle` 包装方法。

新桥直接复用原 `store.select`、`store.recycle`、`store.load`；导出继续复用原 chooser 与 `store.export`。搜索与重试复用原 `start_search/retry` 的函数实现、来源校验、冷却检查、worker、下载器与报告更新；没有重新实现搜索器、网络抓取或缓存服务。

## 鉴权和能力

`GET /api/companion/capabilities` 继续经过原 `api_allowed()`，返回：

```json
{"schema_version":1,"guarded_export":true,"guarded_review_actions":true,"guarded_selection":true}
```

`schema_version` 和 `guarded_export` 不变。布尔 `guarded_review_actions: true` 表示 recycle/restore/stop/retry/task/search 六个操作端点可用；新增独立布尔 `guarded_selection: true` 表示受保护选择持久化可用，不能用已有 guarded_review_actions 推断新选择接口已实现。前端只有确认对应字段严格为 `true` 且成功读取最新真实 state 后才能启用，不能因为旧路由存在就回退成“先 select 再 recycle”。

所有新 POST 仍使用原同源主机、Origin、`X-Review-Token` 校验和原响应方法。保留原安全响应头。没有另取/保存 token，没有新增 CORS、代理或 CSP 例外。

请求使用最多 8192 字节 UTF-8 JSON，必须恰好一个 Content-Length 与 Content-Type；拒绝 Transfer-Encoding、重复 JSON 键、非标准 NaN/Infinity、额外字段、不完整/超限 body。任务和图片 ID 均为 32 位小写十六进制字符串。不接受网页传入本地路径。

## 七个 POST 端点

### `/api/companion/select`

```json
{"expected_task_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","selected_ids":["11111111111111111111111111111111"]}
```

`expected_task_id` 必须为当前任务 ID，不允许 null；`selected_ids` 为 0–30 个唯一图片 ID。空列表清空选择。每次勾选/全选可通过此端点调用原 `store.select` 保存 task.selected，包含原 ready、过滤策略和持久化校验。

expected task 核对与 `store.select` 处于同一应用锁 → store 锁临界区。保留原 `ImageApplication.select` 的并发规则：idle 可选择；busy 时只允许 operation 为 search/retry/import，其他 busy 返回 409。选择不新建 claim、不清 cancel、不释放下载 worker 的 busy 状态。

禁止退回无 expected 守卫的旧 `/api/select`。独立持久化选择成功也不能替代 export/recycle 请求内的原子任务与选择核对；这两个端点继续携带完整 selected_ids 并在自己的临界区冻结使用。跨标签页选择会按服务器取得锁的顺序落地，前端应串行提交本页变更并刷新真实回执；这里不声称以本地点击时间实现跨页版本比较。

### `/api/companion/recycle`

```json
{"expected_task_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","selected_ids":["11111111111111111111111111111111"]}
```

`selected_ids` 为 0–30 个唯一图片 ID，含义为保留列表。空列表会淘汰当前任务全部 ready 图片，前端必须明确向用户说明该效果。原 `store.select` 继续验证 ready 状态、过滤策略与持久化。

在同一应用锁 → store 锁临界区内核对当前任务、应用该请求保留列表并调用原 `store.recycle(False)`。其他标签页不能在选择和回收之间替换选择或切任务。不是两个 HTTP 请求。

### `/api/companion/restore`

```json
{"expected_task_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
```

调用原 `store.recycle(True)`，恢复当前任务的全部 trash 图片，不是只恢复本地勾选图片。不会替换保留列表。

### `/api/companion/stop`

```json
{"expected_task_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
```

在同一锁序下核对任务后仅 `cancel.set()`。即使 busy 也允许请求；不会清 busy、释放别的操作、停止原生 chooser、终止线程，或承诺下载立即结束。chooser 已打开时必须由用户在原生窗口取消；stop 不阻止 chooser 之后的正常原导出。

### `/api/companion/retry`

```json
{"expected_task_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","id":"33333333333333333333333333333333"}
```

任务与候选必须匹配，候选必须为 failed。只启动明确的单张人工重试；原主机冷却、持久冷却、下载检查、来源报告更新不变。不会自动清冷却或自动再次发起请求。

### `/api/companion/task`

```json
{"expected_task_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
```

`id` 是目标历史任务；`expected_task_id` 是点击时的当前任务。确实无当前任务时可传 `null`，不能把 null 当作忽略任务核对。复用原 `store.load`，包括缓存检查、恢复中断状态和保存。切任务可能修复缓存文件或写清单，不应描述成纯读取。

### `/api/companion/search`

```json
{"expected_task_id":null,"query":"forest","limit":20,"source_ids":["openverse","commons"]}
```

搜索明确新建任务，不是过滤当前列表。已有任务时必须携带其 ID；只有确无当前任务才允许 null。query 保留原 1–200 字和控制字符限制；limit 必须为 1–30 的整数且不小于来源数；来源必须唯一，最终由原 `source_info` 校验已接入来源。固定使用 `source_ids` 字段，不接受混用 `source`。

保留原搜索间隔、来源额度拆分、受限响应、持久冷却、去重和下载流程；桥本身不发网络请求。人工确认搜索后原 worker 会执行原来允许的公开来源请求。

## 单次 claim 适配与并发

不能在锁外先检查任务再调用原 `retry/start_search`，因为另一个标签页可在原 claim 前切任务；也不能持应用锁直接调用它们的普通绑定方法，否则原 claim 会死锁。

桥接为这一次函数调用提供只覆盖 claim 的轻量 receiver。普通属性读写与方法仍指向真实 application；没有修改原实例的 claim、类方法或锁。进入原函数时不持应用锁。原函数调用 receiver.claim 时，才按应用锁 → store 锁核对 busy、expected task、单张重试状态并预留 operation。

应用锁持续到原方法完成 worker 启动、返回或抛出异常后，在 finally 释放。已核对的原方法在 claim 后同步段不再次获取应用锁，也不等待 worker 完成。这样受保护搜索的 claim 与新任务发布之间，携带旧 expected_task_id 的 /api/companion/stop 不会匹配旧任务却取消新搜索。异步 worker 的存储锁、状态写入和 busy 完成仍归原实现；桥不做统一的异步 busy 清理，以免在未知结果时释放别人的操作。

普通搜索 worker 是绑定真实 application 的原方法；retry 闭包通过 receiver 的字段转发写回真实 application，不会把 busy、worker 或下载结果留在临时副本。未经过 claim 的不兼容方法不能返回成功。

这些合同依赖已固定版本的方法结构，不是允许任意 backend 的通用代理。如果后续原方法改变锁行为，应重新审核并更新固定版本，不能忽略 SHA 检查。

## 回执和副作用

七个端点成功统一返回 `{"ok":true}`。select 表示原 store.select 已返回；retry/search 表示已接受且完成原 worker 启动，不是检索/下载完成凭据，结果仍需读取真实 `/api/state`。stop 只表示取消信号已请求。

- 400 `bad_input`：格式/字段拒绝，或已核源码中确定在副作用之前的选择、来源或重试状态拒绝。
- 403 `forbidden`：原鉴权拒绝，发生在读取 body 和执行动作之前。
- 409 `busy` / `stale_task`：未通过受保护前置条件，不会替换选择、切任务、发起 worker 或打开 chooser。
- 500 `review_action_failed`：操作结果未知。导出对应错误码仍为 `export_failed`。所有执行期 ValueError、原回调意外抛出的 BridgeError、序列化失败和其他异常均不向网页泄露异常细节。

`store.select` 在校验完毕后先替换 task.selected 列表，再调用 save。因此不能把全部 ValueError 当作 400。桥在持锁下记录旧列表对象身份；只有任务和列表对象均未被替换的原选择 ValueError 才视为验证拒绝。替换后保存失败，即便所选 ID 与旧列表完全相同，也返回 500。此修正同样适用于既有 guarded_export。

原 recycle 是逐个图片/缩略图文件对移动并逐项保存。失败可能已完成前面若干项；原回滚只覆盖当前文件对，不是全任务事务。load 也可能先修复缓存再遇到错误。桥不额外回退文件，不触碰已导出文件，不承诺整体原子回滚。search/retry 在 claim 后的冷却、创建、保存、线程启动等错误也保守归 500；前端应刷新实际状态、提示结果未知，由用户决定后续，不能自动重试或把请求失败当作未发生任何改变。

## 仍保留的边界

- 原 `/api/*` 路由继续由原 Handler 处理，并未新增 expected-task 守卫。新合同不能推导出旧 `/api/search`、`/api/import`、`/api/stop` 等入口也已获得跨标签页保证。尤其旧 task 创建入口本身仍有 claim 后到新 task 发布前的转场窗口。
- `/api/import` 本轮不改；原导入在 claim 后可写任务/清单才失败。旧路由返回 400 不足以证明“没有副作用”，前端应保守刷新，不能拿新受控路由的错误分类套用旧导入。
- guarded_export 的同源原生目录选择、目录/缓存严格隔离、过滤策略、大小/SHA 复核及独占图片/source.json 写入仍由原实现负责。
- 本轮离线测试不证明原完整 runtime、原依赖、真实缓存租约、浏览器 CSP/视觉、Windows 原生 chooser、真实下载或导出已经通过验收。需要另行获准的完整环境验证。

## 离线验证

```sh
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -p test_picker_bridge.py -v
```

本轮新增 guarded selection 后，最终桥接代码 106 项通过，原 59 项保留（能力响应断言增加新字段），另增 47 项。此验证是新最终代码的独立离线运行，不使用此前未知 aggregate 执行结果。全程禁止创建 socket，worker 仅为内存测试替身；未运行参考源码服务。覆盖七端点鉴权与 HTTP framing、严格 body、busy/stale/null 任务、选择持久化/清空、下载中选择和原 ready/策略校验、保留列表与回收同锁、跨标签页切换/选择、选择与导出/切任务并发、搜索发布窗口与 stop、chooser 不被 stop 关闭、原方法复用/字段转发、前后 claim 的错误阶段、逐项部分副作用、同值选择保存失败、异常释放锁与不误清 busy，以及原静态/导出/启动器回归。

原 `/api/stop`（参考 app.py:145–146）直接设置 cancel，不取得 app.lock；即使新搜索走 guarded 路由，旧 `/api/stop` 仍可干扰它。新保护不会追溯改变原站点操作语义，不能称整个进程的所有旧入口均具备任务绑定。
