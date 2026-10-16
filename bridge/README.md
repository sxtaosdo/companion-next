# Companion 同源桥接源（当前任务扩展尚未实机集成）

本目录只增加标准库 Python 桥接源与离线合同测试，没有复制或重写图片审阅后端。本次任务扩展的 dot 验证未启动真实后端、未绑定真实端口、未打开本机目录选择器、未进行真实图片导出，也未部署到 Windows。

## 基线与输入

启动器必须消费使用者明确提供的完整原始审阅目录。固定基线：

- 版本：`v0.1.0.20`
- 审阅提交：`776b7ea4de6d03b6dde408fcf27b51490967f367`
- `app.py` SHA-256：`26e9e7cad8519c54fab2378eccd9e1833d23c51875fd552da0c7ecf3e62ad959`
- `publicImages.py` SHA-256：`4838d7c068cfcdbce5ca54a4c05618f93be783016313acaa2d3958cb669276b0`
- `taskStore.py` SHA-256：`41aa8936543b3d0117b0773871e61b6bcea8f78960b9b481fb9e43b7b71905a1`

三个核心文件全部校验成功后才导入。执行的是已验证的源字节，不使用它们的 `.pyc`，也不在校验后重新读取它们。固定从 `taskStore.py` 取 `TaskStore`、`CacheLease`；从 `app.py` 取原 `ImageApplication`、`make_server`。任何缺失或不匹配都终止，没有绕过校验开关，也不会下载或安装依赖。

`imageManifest.py` 已确认是原 `app.py` 的本地依赖，因此也必须位于同一原目录，是普通、非符号链接的文件，按该目录的源字节导入。它没有已提供的审阅 SHA，不能把本桥的三文件校验描述为“完整后端所有文件均已校验”。其余原依赖仍须由完整原目录与原 Python 环境提供。已加载的同名核心模块和 `imageManifest` 会导致拒绝启动，避免复用其他来源的模块。完整目录不包含在本交付中。

## 在后续另行允许实际启动时使用

从 Companion 项目根目录执行（以下仅为使用说明，本轮没有执行）：

```sh
python -m bridge.launch_picker \
  --review-root /absolute/path/to/complete/review-source \
  --dist /absolute/path/to/companion-next/dist \
  --cache /absolute/path/to/review-cache
```

默认交由原 `make_server(application, port=0)` 分配本机端口；可明确传 `--port`。桥接不改变原主机绑定，也不增加 CORS、CSP、账号、凭据或外部服务设置。原服务器若不是 loopback 地址会被关闭，不进入服务循环。

启动顺序保持：`TaskStore(cache, restore=False)` → `CacheLease(store)` → `store.load_last()` → `ImageApplication(cache, store=store)` → 原 `make_server` → 替换为继承原 Handler 的桥接 Handler → `serve_forever()`。退出及异常时关闭服务器并执行 `lease.close()`。桥接本身不存取进程 token，也没有 token getter。

实际运行前仍必须验证：完整原目录与原依赖可导入、原缓存租约可获取、原方法签名和状态字段匹配、实际原 Handler 的鉴权/安全头符合审阅合同、原目录选择器可用、原 TaskStore 的完整导出与 `source.json` 行为，以及真浏览器中的 CSP 和同源请求。这些离线测试不能替代实机验证。启动器不修改原源文件，原后端对明确指定缓存与导出目录的正常写入仍会发生。

## 路由合同

- `GET /companion/`、`GET /companion/index.html`：原 `trusted_host()`，然后原 `send()`，保留 CSP、no-store、nosniff、no-referrer。
- `GET /assets/*`：启动时从 `dist/assets` 的实际普通文件生成固定白名单，连同文件字节形成不可变快照。请求期间不拼接文件路径；路径穿越、百分号变体、未知文件、查询参数变体不匹配白名单。拒绝符号链接，不映射其他 dist 根目录文件。
- 入口 HTML 必须使用白名单内的外部 JS/CSS 文件；拒绝 inline 脚本/样式、事件属性、外部资源、`base`、iframe 和间接资源属性。仍由原 CSP 强制资源的同源约束，不放宽 CSP。
- `GET /api/companion/capabilities`：原 `api_allowed()`，成功返回 `{"schema_version":1,"guarded_export":true,"guarded_review_actions":true,"guarded_selection":true}`。
- `POST /api/companion/export`：原 `api_allowed()`，最多 8192 字节 UTF-8 JSON。要求唯一 Content-Length、JSON Content-Type，不支持 Transfer-Encoding。只接受 `expected_task_id` 与 `selected_ids` 两个键；前者必须为 32 位小写十六进制 ID，后者必须为 1 至 30 个唯一的同格式 ID。拒绝重复 JSON 键、额外字段、非标准 JSON 数字等。
- 其他原路由继续由原 Handler 处理，包括 `/`、状态、图片、原选择与原导出路由。

前端按需从同源 `GET /` 的 `body[data-token]` 取得原进程 token，不执行旧页面脚本、不持久化、不跨端口。本桥没有另外复制 token、生成新 token 或绕过原鉴权。

## 原子选择与导出

锁顺序为 `application.lock` → `store.lock`。在同一个应用锁内先检查 busy，再在 store 锁内核对任务 ID、调用原 `store.select(ids)`，随后预留 `busy=True`、`operation='export'` 并清除 cancel event。原 `store.select` 继续执行 ready/subset、过滤策略与保存检查。

释放应用锁之后才调用原 `application.chooser()`。取消返回 `{"cancelled":true,"results":[]}`。正常选择目录后直接调用原 `store.export(directory)`，返回 `{"cancelled":false,"directory":...,"results":...}`。目录/缓存隔离、SHA/大小/策略复查、独占图片和 `source.json` 写入全部由原 exporter 负责。没有替代复制实现。

不在非重入应用锁内调用 `application.claim/select/export/snapshot`。目录选择及导出期间 busy 持续占用，并在 `finally` 中释放；取消也会保留本次已核验选择。

错误语义：

- 400：解析/参数校验失败，或原 `store.select` 在赋值前拒绝选择；不会打开目录选择器或调用导出。
- 403：原鉴权拒绝；不会进行选择或导出。
- 409：busy 或任务已变；不修改选择，不调用目录选择器。
- 500：其他异常，包括选择已赋值后的 save 失败，以及 chooser/export 中的 `ValueError`。可能已发生部分导出，前端必须按结果未知处理，不自动重试。响应不包含异常内容、token 或私有路径。

## 离线验证

```sh
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -p test_picker_bridge.py -v
```

测试使用明确命名的 fake store、fake handler 与 fake server，全程禁止创建 socket。覆盖严格 JSON/长度/字段、继承鉴权与安全头、不变静态白名单、路径/符号链接拒绝、stale/busy 不改选择、并发 busy、原 exporter 接口调用、取消、异常释放、错误结果未知语义、核心 SHA 不匹配拒绝、验证字节执行与启动/清理顺序。fake exporter 仅是单测 spy，不是生产实现。


## 任务绑定审阅动作

七个新动作（含选择持久化）及原始方法复用合同见 [bridge-review-controls](../docs/bridge-review-controls.md)。选择校验尚未赋值时的拒绝为 400；选择已替换后的 save 失败为 500、结果未知，不能据 ValueError 一概认定无副作用。旧未加守卫的路由继续保持原有行为，特别是原 `/api/stop` 可影响当前进程任务；本桥只保证新入口的 expected task 守卫。
