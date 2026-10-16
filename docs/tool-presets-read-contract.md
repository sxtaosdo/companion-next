# v148 工具目录与工具范围只读合同

> 0.1.11新增独立页面内存草稿弹窗，复用本读取快照进行副本编辑与严格批量JSON交换，详见 `tool-preset-drafts.md`。下文适配器仍只有原三个GET，没有增加宿主写入接口。

## 已核实的原实现

- `.test-artifacts/v148-host-reference/source/mcp/src/companion/http-server.ts:331–365`：目录、方案列表、单方案导出三个 GET。
- 同目录 `tool-preset-store.ts`：读取时合并内置方案，持久化自定义 schema、名称/ID/override 校验、导出内置 clone。
- 同目录 `tool-specs.ts`、`ecosystem-tool-specs.ts`、`tool-profiles.ts`：工具名、core/full 与 override 可见性语义。
- `.test-artifacts/v148-reference/source/source/web/src/app.ts:644–914`：展示标签、有效工具集合与 Creator 权限说明。

本片复用仓库已有 `companion-browser.ts` 的显式注入、固定路径、有界流式 GET 模式；不改动旧适配器，不引入依赖。

## 公开接口与范围

`ToolPresetReadProvider` 只有 `label`、`loadTools(signal?)`、`loadPresets(projectId | undefined, signal?)` 和 `exportPreset(presetId, signal?)`。构造不产生请求，必须显式注入 fetch。调用者控制连接、刷新、项目登记约束、晚到数据的视图归属，以及用户触发的导出下载。

| 方法 | 固定相对路径 | 输出 |
| --- | --- | --- |
| loadTools | GET `/api/tools` | `ToolCatalogEntry[]` |
| loadPresets | GET `/api/tool-presets` 或 `?projectId=<安全ID>` | `{ presets, selectedPresetId }` |
| exportPreset | GET `/api/tool-presets/<安全ID>/export` | `{ schemaVersion: 1, presets: [一个自定义方案] }` |

全部使用 `mode/credentials: same-origin`、`redirect: error`、`cache: no-store`，只有 Accept JSON 请求头，没有请求体、token、Authorization 或显式 Cookie。没有 POST/PATCH/DELETE、创建、重命名、保存、删除、导入、项目方案设置、manage-tools 或权限调整接口。无 base URL、自动轮询、重试、EventSource 或自动连接。

项目 ID 使用现有 Companion 只读投影的 `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`；方案 ID 使用原存储 schema 的 `[A-Za-z0-9_-]{1,80}`。所有输入在 dispatch 前校验。

## 投影与 fail-closed 校验

- tools 最多 512 个，当前原实现约 117 项，不把当前数量硬编码为协议版本。数组必须非空、名称唯一；只保留 name/displayNameZh/description/profile/scope/access。profile 严格 core/full，access 严格 read/write。受控文本长度、控制字符和双向覆盖字符校验。
- access 是原 HTTP 层按工具名正则给出的启发式标签。包括 editor_set_selection 等工具可能有副作用而仍被标 read；不得把该字段当权限判断。
- 列表必须包含 core/full 两个内置方案，共最多 22 项；ID 唯一，自定义方案之间名称不区分大小写唯一。内置 ID、中文名、baseProfile、空 overrides、builtIn=true 与固定 epoch 更新时间必须一致。遵循原 validateStore，自定义名称可以等于中文内置标签，UI 以 ID 与 builtIn 区分。
- 自定义项完整保留 id/name/baseProfile/enabled/disabled/builtIn/updatedAt，名称 1–40 字符且已 trim，ID 不得占用 core/full，名称不得为 core/full。builtIn 必须 false；UTC ISO 时间含有效日期，支持原 z.iso.datetime 的分钟、秒及小数精度。前端另加有界长度与安全文本限制。
- enabled/disabled 各最多 512 项，工具名先做词法校验，不能重复或交叉。没有工具目录时不谎称已验证成员关系。
- `validateToolPresetCatalog` 对完整 schema 和目录成员关系作二次验证；`effectiveToolNames` 基于 core/full 减 disabled 加 enabled。目录缺失/非法或引用未知工具时抛固定安全错误，调用者必须显示未知，不得回退为 full。
- selectedPresetId 必须存在于列表；缺失/陈旧选择拒绝整个读取，要求刷新，绝不悄悄选择 full。
- `decodeToolCatalog`、`decodeToolPreset`、`decodeToolPresetRead`、`decodeToolPresetExport` 都只构造白名单字段。附加字段被丢弃。`serializeToolPresetExport` 再次投影后才 JSON 序列化，避免注入 provider 或原响应的附加数据进入文件。

GET 带 projectId 并不验证工程登记：原后端对于没有选择的任意项目 ID 都会返回 full。store 必须根据真实 Companion 项目列表限制可查询的工程，并把 Dashboard/本地草稿与已登记项目区别开。

原目录端点没有 total/version/完整性证明。本片能确认非空、有效、有界目录及 override 引用，不能从一份格式有效的非空响应证明后端没漏掉未引用的工具；不会宣称拥有这样的证明。

## 导出对应性

原导出不是直接返回内置 ID。core/full 会被克隆成 `preset-<UUID>`，名称加 ` copy`、builtIn=false、更新时间变为导出时刻。自定义导出保留源 ID 与原方案。

adapter 只接受 schemaVersion=1、恰好一个合法 custom 方案，不能一概要求返回 ID 等于请求 ID。store 须拿用户所选源方案进一步验证：自定义源须与先前读取的 ID / 名称 / baseProfile / overrides / 更新时间语义一致，否则先刷新；内置源须不占用当前任何已知预设 ID、不沿用内置 epoch 时间，并核对预期 baseProfile、空 overrides 与 copy 名称。目录可用时同时校验 override 成员关系；断线、选择变化、取消或 stale source 时不得下载。adapter 本身不创建 Blob/下载或落盘。

## 安全预算与错误

- 每次请求 1 MiB，最多 2048 chunks，包括空 chunks；超大单帧在 decode 前拒绝。
- 4 秒默认与上限，涵盖 headers 和 body；测试可缩短。单个 provider 最多 3 个并行请求，无排队或自动重试。
- Content-Length 预检加真实累计字节检查；严格 UTF-8 流式解码，跨帧字符正确合并。拒绝空/无 body、非法 JSON/MIME、重定向、opaque 响应。
- 取消与超时独立于 fetch 是否遵守 signal；及时结算调用、释放槽位，取消未读 body，丢弃晚到 response。单次取消不影响其他请求。
- `ToolPresetReadError` 只保存闭集 code/endpoint 与数字 HTTP status。401/403/500、传输异常与 schema 错误使用固定本地文案，不回显响应体、后端 error、URL、项目 ID、文件路径或凭据。

## 离线测试

`tests/tool-presets-read-adapter.test.ts` 使用合成数据与注入的 fetch/ReadableStream，无真实 endpoint、登录信息、服务启动或磁盘导出。覆盖三端点白名单、构造零网络、非法输入、字段投影、117/512 数量预算、22 方案边界、内置一致性、陈旧选择、未知引用、导出 clone、损坏 JSON/UTF-8、大小/帧限制、4s 超时、并发隔离与取消晚到。UI/store 的项目登记、连接、选择与下载生命周期由其专门测试覆盖。


## 已接前端与宿主边界

帮助 → 工具清单挂载独立只读组件，页面进入和 provider 注册不联网。目录和预设读取相互独立；已有 Companion 实际登记列表约束可选工程，没有登记身份时只允许查默认范围。返回 full 也可能是后端 fallback，不证明曾显式保存。目录分类可折叠，搜索 / profile 筛选仅影响本地显示；未知范围不默认全开，未启用工具仍列出。

store 赋值前再次投影；不透传任意 Error.message。本地预览与后端当前选择分别标示，切换预览没有分配请求。目录读取中禁用导出并使既有准备句柄失效，不能跨过新的目录快照。导出终点复核元信息 / 目录引用；已读目录引用不一致时阻止下载；没有目录时只导出通过 schema 和来源对应性校验的元信息，不宣称有效工具范围已核验。JSON 序列化后再限 1 MiB；浏览器仅显示已请求下载，不将其描述成磁盘已保存、服务器写入或权限已生效。

工程 / 预览变更、A→B→A、源替换、断开 / 离页和刷新会取消旧下载准备；结果返回前后都有身份代次校验，Blob URL 请求下载后撤销。现有隔离 `host/v148-runtime-binder.ts` 的 presets 方法继续默认拒绝，本片没有扩充宿主权限或创建预设存储。旧 v148 活宿主已存在这些 GET，但 Windows 同源读取、真实浏览器文件下载尚未验证。原有 Library 交付未替换。
