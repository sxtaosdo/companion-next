# 原 AI 工程规范与参考只读片（Next 0.1.8）

0.1.13构建边界：companion-readonly仅保留显式resource-config文件读取；referencePreview:false在transport前拒绝参考处理且UI禁用。原preview会启动本地Python/Pillow，不能因无persist写盘而称无进程。以下完整preview合同保留于其他专用源码构建，均非本次部署授权。见passive-readonly-013.md。

## 真实入口与已核源码

新入口为侧栏原有功能 → AI 图标（`#/ai-icons`）。先到工程页显式读取原 Companion 登记，再选择完整工程 ID；页面只按原 Cookie 同源身份读取。普通示例或 Picker 宿主不注册这个 provider，构造、注册、进入页面、切工程都不联网。

本片复用此前已批准并核 SHA 的 v148 原项目合同，无新 GitHub 项目、依赖、SDK、凭据或权限。源 HEAD `f6dcac804fb9ad806e8094594c7820a71cfab7b8`：

- `mcp/src/companion/http-server.ts:235–247,581–592`：浏览器 session / Host / Origin 与路由。
- `icon-adapter.ts:115–132`：登记归属、原 IconConfig 可用性和两读取操作分派。
- `icon-resource-config.ts:58–64,83–106,125–135,147–202`：配置读取、检测、v1/v2 和建议草稿。
- `icon-image-assets.ts:16–20,48–129,181–214`：参考路径、只读文件与固定 CPU 内存归一化。
- `web/src/ai-icons-page.ts:165–179,207–239`：原界面预览与刷新语义；没有照搬自动预览或会话 fence 写入。

只有以下两个固定端点，都是原协议定义的逻辑读取 POST：

| 路由 | body | 实际读取 |
| --- | --- | --- |
| `/api/icons/{16位小写hex}/resource-config` | `{}` | 工程配置、工程设计设置、资产 manifest 元信息、既有资源目录与参考文件存在性 |
| `/api/icons/{16位小写hex}/reference-preview` | `{relativePath}` | 所选工程内已保存配置列出的参考图；本地 CPU 子进程归一化到内存 PNG |

无 query、base URL、任意路径 fetch、Bearer、重试、写操作、轮询或自动查询。`mode:'same-origin'`、`credentials:'same-origin'`、`redirect:'error'`、`cache:'no-store'`；不读取或搬运 session。两路必须原后台已有合法 IconConfig；503 不表示应启动模型或自动补配置。

## 数据保真

- 成功 envelope 是 `schemaVersion:'companion-icons-v1'`，没有 HTTP `ok/data` 包装。
- `valid / missing / invalid` 来自实际读取，网络失败不会显示 missing 或空成功。版本、hash、原文件路径和读取时间独立展示。
- config 是已保存内容；draft 是后台内存建议，绝不填充成已保存规范。缺文件时 draft 允许 0×0、空风格；原 v1 多尺寸迁移建议可能保留大于4096的旧尺寸、重复旧参考或0×0待确认。本片不迁移、不保存、不覆写浏览器现有规范草稿。
- v1 只读保留全部原预设，显示需显式迁移；v2 展示默认单尺寸、设计画布、风格、背景、留白、Creator目录与尺寸导出目录。
- 原配置虽能解析，也可因工程画布改变或参考缺失而为 invalid；仍保留其已保存内容与问题，不把建议修正当实际文件修复。
- 母图1024×1024 PNG、禁止覆盖、参考不作为模型图像输入均为原合同，不扩成生成服务已连通或技术验收通过。
- strict projection 丢弃未知响应字段，核对工程归属、状态/版本/hash/问题/草稿的一致性。内部错误、路径诊断或响应原文不进入UI。

## 参考预览

用户点选配置内具体参考后才读取；不能输入任意URL或新增路径。预览返回归一化字节，不直接请求远程资源。PNG允许最多4MiB、4096×4096且不超过16M像素；验证canonical base64、PNG签名、IHDR尺寸、RGBA格式、chunk边界/CRC和SHA-256。只接受原归一化程序产生的IHDR/IDAT/IEND；浏览器失败时清图并给出失败态，不放宽CSP。

预览 hash 是当前文件归一化 PNG 的 hash，不是原图片hash或旧任务封存证据。没有上传、参考封存、模型图像输入、下载、批准选图或Creator导入。原 v148 Companion HTTP 源未设置CSP；不能把这种数据图渲染能力推断到另有严格CSP的Picker宿主。

预算：配置响应128KiB / 默认4s，预览JSON6MiB / 默认20s（原CPU解码15s），至多4096响应chunks、3并发；显式超时上限20s。取消独立于注入fetch是否配合，取消后的响应不显示；HTTP取消不能证明原后台CPU过程已停止。

## 上下文与重复流程

- 同一工程名/ID/路径与登记provider共同绑定；工程、元数据、登记身份、reader替换、离页、清空、取消都递增代次并取消旧读取。
- A→B→A也不接纳旧A回执；新刷新先清旧规范与参考，失败不会保留为当前真实结果。
- 读取中的重复点击不再次请求；预览只显示一张，关闭或刷新使晚到图片失效。
- 断开登记或移除工程清空上下文；正常相同登记轮询不会误清当前结果。
- 页面无localStorage/sessionStorage持久化，无写入/生成操作按钮，不通过缺少按钮声称原六步全迁完。

## 精确未完成项

`jobs / status / candidate` 都调用外部 `{studioRoot}/project/tools/local-icons/companion_api.py`（icon-adapter.ts:183,210–225），当前已交TS源码闭包没有这段Python。操作名或GET不能证明它不创建store/修复队列/改租约。需要实际部署同版本入口及其本地直接读取依赖和jobs/status/candidate测试的只读源包、路径/长度/SHA，不需要缓存、图片、env、token或真实任务数据。当前未注册这些端点，未构造空历史冒充已迁。

`resume` 更不能当普通查询：原adapter会派发后台工作。配置保存、参考上传、inspect/enqueue/adopt、GPU执行、批准选图、导入、尺寸导出需各自原合同/明确操作边界，不能借本片逻辑读取POST一并放开。

宿主真实会话、Python/Pillow CPU预览、系统浏览器渲染与Windows接通本片未实测。隔离host binder仍按其原只读白名单，不因前端新增页而增加能力。现已交Owner的0.1.4静态包不变；新增源码不代表已部署。
