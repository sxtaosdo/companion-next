# Companion 功能迁移对照：v148 静态基线

> 2026-10-14 当前纠偏：旧功能全保留才是完成标准；0.1.13仅显式只读切片。最新覆盖/缺口以 [当前功能对照](feature-parity-current.md) 为准，0.1.14正常工程模式合同见 [状态与Creator操作](creator-operations.md)。下文保留各阶段原始证据。

2026-10-14 更新：0.1.13仅收窄 companion-readonly 的探测行为。工程登记/日志/调用和工具读取保留；状态、Dashboard/CIM、知识CLI和参考Python不由此只读候选触发。其他模式源码能力仍在，待独立部署/实机验证。见 `passive-readonly-013.md`；v150现场合同核验不等同全部v148功能实测。


> 知识问答源码增量（2026-10-13，Next 0.1.12）：仅KB提问 / 回答与文本引用 / 续问 / 新会话取消，逐次冻结确认、UNKNOWN保留与底层单飞保护。发送只在独立 companion-knowledge-chat 构建注册，普通/只读/配置编辑/Picker均不注册，本轮无真实发送或部署。Agent、同步、服务启停仍未迁。见 `knowledge-conversation.md`。

> 本地预设增量（2026-10-13，Next 0.1.11）：克隆新身份、名称/基础范围/工具覆盖编辑、严格批量JSON导入页面草稿与验证后导出已接源码。离页保留、刷新丢失，替换确认加一次备份；读取快照变化撤销导出。宿主CRUD/import/assign和MCP注册仍未迁入，不增加真实请求或权限。见 `tool-preset-drafts.md`。

> 原参考上传增量（2026-10-13，Next 0.1.10）：本地文件选择/Canvas预览、逐次确认、严格双文件回执及只附配置草稿、UNKNOWN与重复保护源码已接。只在独立编辑构建注册，普通/只读/Picker不上传；实际部署、Pillow/磁盘/浏览器仍未验。裁剪和原任务链不包含于此片。见 `ai-reference-upload.md`。

> 原配置编辑增量（2026-10-13，Next 0.1.9）：共用新建 / v1迁移 / v2编辑弹窗、差异确认、expectedHash保存与UNKNOWN显式回读源码已实现。普通 / Picker / companion-readonly 仍仅预览；独立 companion-config-editor 构建本轮只做dot fake验证，未获准部署或保存生产配置。见 `ai-resource-config-editor.md`。


> 原 AI 读取增量（2026-10-13，Next 0.1.8）：已实现 `#/ai-icons` 工程已保存规范 / 缺失无效态 / v1待迁移 / 后台建议草稿分开显示与显式参考预览。仅原 resource-config、reference-preview 逻辑读取；未编辑保存或生成。jobs/status/candidate 依赖未取得的实际 Studio companion_api.py 读取闭包，仍未接入。见 `ai-resource-read-contract.md`；源码与真实部署验证分开。


> CLI 源码增量（2026-10-13，Next 0.1.7）：真实登记工程的两段提示词、四条检查命令、全文复制 / 换行 / 折叠已迁入；完整 ID 与安全元数据校验、工程 / 来源变更失效有离线回归。纯文本不执行 CLI、不创建 Skill、不注册 MCP、不打开外部 Agent；实际执行和自动发现仍未完成。原“CLI 尚未迁入”的历史条目由此更新，但不能扩成配置写入已迁。见 `cli-use-copy.md`。

> 后续源码增量（2026-10-13，Next 0.1.6）：帮助工具清单已接真实目录 / 当前范围读取、本地预设预览和单预设 JSON 导出。三类同源 GET 保持原合同；标签非授权、下拉非分配、导出非服务器保存。写操作、MCP 注册与实际浏览器 / Windows 接通仍未完成；隔离 binder 未放开预设，现有 Library 静态包不变。详见 `tool-presets-read-contract.md`。

> 当前源码增量（2026-10-13，Next 0.1.5）：工程可见页约 3 秒串行刷新、日志提示合流 / 暂停恢复、调用 SSE 合并与有界重连已实现。仍需显式连接并启用；没有实际宿主 / Windows 实时验收。当前原 0.1.4 静态交付保持不变。以下旧审计矩阵保留其检查点语义，后续完成门以本增量和 `companion-live-refresh.md` 为准。v148 完整宿主来源闭包已在前序片取得，本片不再请求旧文中的源码包。

## 1. 核对范围与证据等级

- 核对日期：2026-10-12。旧版目标已更新为 **0.3.148**；v133 是历史参考，v142 是历史冻结信息，都不能代替这次目标。
- 旧版交接包：`.test-artifacts/v148-reference/source/`。该目录内还有一层 `source/`，因此本文 `旧 web/…` 的实际根是 `.test-artifacts/v148-reference/source/source/web/`。
- 旧版源码 HEAD：`f6dcac804fb9ad806e8094594c7820a71cfab7b8`。包内 `README.md` 和 `manifest.json` 记录源目录与部署目录均为 v0.3.148、源码工作区未变、4 个部署静态资产逐字节匹配，以及部署 sourcemap 内全部 10 个 TypeScript sourcesContent 与所交付源码逐字节匹配。
- 本次在当前工作区对 manifest 列出的 **16 个源文件重新计算长度和 SHA-256，全部一致**。这是本地包完整性复核。部署比对依赖交接包的原始审计记录，本次没有重新访问 Windows 或部署目录。
- Next 核对基点：`2e7adcc472dcad273ca77105ac2dd3bec446222a`，前端版本 `0.1.1`。本文的 Next 行号和状态固定对应这个提交；后续代码变化需另行复核，不能把本文件自动视为最新运行状态。
- 本轮只读代码、核验文件字节并新增本文；没有运行服务、编译旧源码、生成/下载/导入图片、修改权限、改旧文件或提交 Git。保留 `migration-parity-v133.md` 作为历史审计。
- **源码/部署字节已核，不等于当前进程和当前浏览器标签页已核。** 原包明确说明本次未重验在线服务，标签页 URL/端口未确认；本文不把 v148 源码版本当作实时 daemon、Creator 或 Bridge 响应。
- 下文 `旧` 为交付的 v148 Web 源码；`新` 为上述 Next 提交。后端源码没有包含在这个 UI 包里：涉及后端独立校验、生命周期或图像算法的说明，以包内 README 对应章节的只读审计为来源，不能冒称本轮独立运行验证。

## 2. 总结

v148 的正式主导航有 **AI 图标、工程、知识库、模型服务四页**，默认进入工程。Next 已补上全局帮助、关于、前端版本和更新记录，但还不是这四页业务的完整替换。尤其 **AI 图标是 v148 已有正式功能**，不能继续把它的六步流程全部归成 Next 的新增设想。

Next 的项目适配器仍只有 `/api/projects` 与 `/api/status` 的有界只读快照（新 `src/adapters/same-origin-readonly.ts:3–4,51–56`）。Next 的资源规范草稿、资源规划、人工 PNG 回收、Picker 图片审阅不能替代旧版工程配置写入、图标原任务、GPU 执行、审阅批准、Creator 导入或知识/模型服务管理。

## 3. 四个主导航与全局入口

| ID / 保留项 | v148 真实入口与行为 | Next 2e7adcc 状态与证据 |
| --- | --- | --- |
| `icons-page` AI 图标 | 顶栏第一项；动态挂载正式业务页；切入调用 onShow；六步流程与原任务结果。旧 `web/index.html:22,209`、`web/src/app.ts:2854–2873,3058–3060,3560`、`web/src/ai-icons-page.ts:38–84` | **未迁入原业务**。新 `src/router.ts:12–24` 没有原 AI 图标路由；`ResourcesView.vue:17,45–50` 是另一个六步骨架，生成/批准/导入绑定/运行未接通；迁移表 `src/domain/product-information.ts:31–44` 尚未单列原 AI 图标 |
| `projects-page` 工程 | 默认主页面；工程列表、连接操作、日志中心和各弹窗。旧 `web/index.html:23,29–90`、`web/src/app.ts:2857–2873` | **仅部分读取**。新 `src/App.vue:36` 提供项目选择，`src/views/OverviewView.vue:14–20` 提供概览；不含完整工程管理和日志操作 |
| `knowledge-page` 知识库 | 独立主页面，进入时刷新服务状态；运行后显示检索、文档、对话、同步。旧 `web/index.html:24,91–190`、`web/src/app.ts:2871,2877–2935` | **尚未迁入**。新路由 `src/router.ts:12–24` 无知识库页；仅在帮助/保留表描述缺口（`src/domain/product-information.ts:26–27,36`） |
| `models-page` 模型服务 | 独立主页面，进入时刷新本机启动器状态，启动后 iframe 嵌入。旧 `web/index.html:25,191–207`、`web/src/app.ts:2938–2974,3019–3051` | **尚未迁入**。新 `src/views/ServicesView.vue:12–14` 只有只读服务状态；不是启动器管理页 |
| `global-help` 帮助 | 页头问号；四大类/十二小节；复制提示词、换行/展开、Agent 交接、CLI/MCP 定向跳转和工具目录。旧 `web/index.html:19,443–661`、`web/src/app.ts:2245–2302,2319–2412,3068–3073,3111–3163` | **入口及说明目录已补，原内容/动作不完整**。新 `src/App.vue:27,33`、`src/router.ts:19`；`src/views/HelpView.vue:12–15` 和 `src/domain/product-information.ts:12–29` 是迁移说明，不含原完整提示词交互或真实工具目录 |
| `global-about` 关于 | 品牌图标和标题均可打开；动态版本、协议、兼容说明、用途、数据范围、反馈复制、原图标/二维码、免费/禁二售及下载入口。旧 `web/index.html:12–15,664–708`、`web/src/app.ts:3074–3088` | **入口与部分文案已补，原资产未展示**。新 `src/views/AboutView.vue:22–25`，原 Logo 仍只去概览（`src/App.vue:24`）。v148 原 SVG/二维码现在已在包中，旧“等待取得资产”是该提交时的状态，不再是本次包的缺失 |
| `global-version` 可见版本与单一来源 | 页头版本与关于版本由 package 编译常量统一填入；旧 `web/package.json:3`、`web/scripts/build.mjs:8–9,24–25`、`web/src/app.ts:2202–2208` | **前端版本已补且单一来源**。新 `src/domain/product-information.ts:1–5` 从 package 引入 0.1.1，顶栏/侧栏/关于消费该值（`src/App.vue:28,33`、`src/views/AboutView.vue:22–23`）；应继续与旧 0.3.148、实时 daemon、Creator、静态 Bridge 文案分别显示 |
| `global-changelog` 原更新日志 | 版本徽标打开真实历史条目；顶条目 0.3.148；**北京时间日历日**合并，保留当天最新版本/时间。旧 `web/index.html:16,713–727`、`web/src/app.ts:3076–3079`、`web/src/changelog.ts:14–24,903–970` | **前端更新入口已补，旧历史未迁入**。新 `src/views/ChangelogView.vue:5–7` 只渲染 Next 两条记录；新记录不能顶替旧更新列表。旧函数仍叫 mergeChangelogWithinWindow，但已不是 v133 的滚动 24 小时合并 |

### 必须保留的帮助目录

- 运行时：性能诊断、自动试玩与构建、动画与输入（旧 `web/index.html:453,459–485`）。
- Cocos Bridge：工程管理、CLI 接入、MCP 接入、场景与 Prefab、资源与脚本、UI 制作、工具清单（旧 `web/index.html:487–624`）。
- 知识库：能做的事、不会做的事（旧 `web/index.html:626–651`）。
- 模型服务：服务说明，无二级小节（旧 `web/index.html:653–657`）。

这些帮助小节说明工具能力，不是额外主导航页面。Next 可以改变布局，但目录、原正文/提示词、可复制内容、定向导航和工具可见性应分别验收；仅存在同名标题不算全部保留。Next 当前默认“新版使用”也不同于旧帮助打开时默认“运行时/性能诊断”（新 `HelpView.vue:8`；旧 `app.ts:2370–2376`），属于需要明确选择的交互变化。

## 4. AI 图标真实六步与附属操作

旧 `web/src/ai-icons-page.ts` 是本节直接证据。以下所有旧写操作都不是本次执行范围。

| ID / 步骤或操作 | v148 行为与批准/真实性语义 | Next 现状 |
| --- | --- | --- |
| `icons-project` 1 工程 | 明确选工程；刷新任务与资源配置；展示 projectId/path/sourceRevision；切换清理原 UI 与批准。旧 `ai-icons-page.ts:41–46,207–239,455–459` | 项目选择存在，但未连接旧图标工程身份/原任务合同。新 `src/App.vue:36`、`src/stores/workspace.ts:24–52` |
| `icons-config` 2 资源配置 | 只读摘要；新建/编辑共用弹窗；设计分辨率、单图成品尺寸、统一风格、透明/底色、居中留白、Creator 目录、art/final 导出目录、kebab-case；检测到工程设计尺寸时只读；保存需要独立批准并携带 expectedHash；保存不准备/生成/导入。旧 `ai-icons-page.ts:47–65,176–205,329–360` | Next 有统一规范弹窗和本地草稿，但未写对应工程资源配置、未消费旧 hash/version。新 `src/components/SpecDialog.vue`、`src/stores/workspace.ts:70–78` |
| `icons-references` 参考图 | 独立批准上传；最多 4 张，4 MiB/张，每边≤4096；哈希/原任务保护；预览、移除引用；上传后仍要单独保存配置；**仅保存和封存，不作为模型图像输入**。旧 `ai-icons-page.ts:56–58,162–174,362–388` | 没有迁入对应项目参考图上传/封存链。Picker URL 下载或手动 PNG 回收并不等价。新 `src/views/ImageAssetsView.vue:53–83`、`src/domain/product-information.ts:14–15` |
| `icons-brief` 3 图标需求 | 名称、用途、画面；Advanced 内标识、目标路径、只读风格和配置版本/hash/sourceRevision；单张图标。旧 `ai-icons-page.ts:72–79,151–161,418–429` | Next 资源规划是独立计划合同；未绑定旧 resourceBinding 或单图原任务。新 `src/views/ResourcesView.vue:45–47`、`src/components/ResourcePlanner.vue` |
| `icons-prepare` 4 准备与进度 | inspect 检查目标缺口/禁止覆盖；批准明确范围后 enqueue 或采用已登记 sourceId；固定 1024×1024 PNG、一图一候选、一次提交；offline_import_only 仅采用可信已有 PNG，关闭新生成与 GPU；不接受任意来源路径。旧 `ai-icons-page.ts:80–84,129–148,207–230,431–454` | 未接旧 inspect/enqueue/adopt。Next ComfyUI/Codex 来源选择与人工文件回收不是旧可信离线采用。新 `src/views/ResourcesView.vue:47`、`src/domain/product-information.ts:14` |
| `icons-execute` 原任务执行/恢复 | queued/waiting_service 要另批 GPU 后 run-next；running/unknown 只恢复原任务查询；接收请求不等于生成或导入完成。旧 `ai-icons-page.ts:241–247,281–284` | 无旧执行/恢复接口和任务列表。新生成按钮明确未接通（`src/views/ResourcesView.vue:47`） |
| `icons-review` 5 审阅 | 原任务 candidate 受控 PNG 预览；只选一张；单独批准保存选图；变更选择撤销批准。旧 `ai-icons-page.ts:285–298` | Next 存在示例资源审阅和 Picker 保留选择，但不是旧已封存任务的视觉批准。新 `src/views/ResourcesView.vue:48`、`src/views/ImageAssetsView.vue:76–79` |
| `icons-import` 6 导入 | 单独批准工程新目标路径；仅原任务已保存选图的 1024 母图；禁止覆盖；不重试未知导入；可返回审阅。旧 `ai-icons-page.ts:300–305` | 未迁入。新 `src/views/ResourcesView.vue:49` 的导入绑定按钮禁用；图片目录保存不产生 Creator 导入回执 |
| `icons-export` 默认/其他尺寸 | 从原任务已选母图导出；默认尺寸来自封存 v2 配置，其他尺寸在独立弹窗；不重新生成、不调用模型、不导入 Creator；保存和放大分别批准；禁止覆盖；缺 v2 封存的旧任务仅可读。旧 `ai-icons-page.ts:66–71,307–324,390–417` | 未迁入旧 export-variant 与源图/回执校验。规划附加尺寸不等于实际导出。**按原包后端审计，这是 contain 等比缩放、居中留边，不是裁剪；旧 UI 没有 crop 控件或 crop API** |
| `icons-receipts` 原任务/验收 | revision/requestHash/sourceRevision、封存规格、导入 operationId/租约、验收 SHA；import_unknown、blocked、imported_pending_verification 分开；Owner 手工确认只涵盖导入与运行可见，自动化仍 UNKNOWN、productionVerified 仍 false。旧 `ai-icons-page.ts:21–34,249–276` | Next 自己的文件回收记录与 Picker 保存回执不能顶替这些旧任务证据。新 `src/components/GenerationReceiptPanel.vue`、`src/views/ImageAssetsView.vue:81–83` |
| `icons-unknown` 重复/未知操作保护 | sessionStorage 保存 action/enqueue/auxiliary fence；不可写时停止所有写操作仍允许查原任务；不盲重发未知生成/导入/参考上传/导出；切工程/改表单/改变选图清批准。旧 `ai-icons-page.ts:99–148,223–227,241–247,374–387,396–408,418–455` | 新模块有其自己的保护，但未映射原任务 fence、revision 和请求摘要，因此不能宣布旧操作恢复语义已迁入 |

### AI 图标不能误写的细节

1. “六步”在旧版是 **工程→资源配置→需求→准备与进度→审阅→导入**；Next 的 **规范→规划→生成→视觉审阅→导入绑定→运行验收** 是不同分步，不能仅按数字六判断功能等价。
2. contain 会保持整张母图比例，空白区域按透明/底色处理；它不是裁边、ROI 编辑或去背景。源包后端审计定位为 `icon-image-assets.ts:79,249`，该后端文件未包含在 UI 包中，本次没有执行图像算法。前端只核到本地缩放说明、尺寸请求和结果核验。
3. 固定 1024×1024 母图 contain 导出时，旧 UI 的放大判定为 **width>1024 且 height>1024**（`ai-icons-page.ts:313,395,403`），不是任一边超过就一定放大。不可把此语义改写成裁剪的比例模型。
4. v2 页面固定 `presetId="default"`（`ai-icons-page.ts:436`）。兼容旧 v1 多预设的数据类型（`:2–7`）不等于当前页面有多预设编辑入口。
5. 参考图封存不证明模型获得图像输入；配置保存、参考上传、生成/采用、GPU 使用、选图、导入、尺寸导出分别有边界。不能以批准其中一步替代余下批准。

## 5. 工程、知识库、模型与工具的保留矩阵

| ID / 保留项 | v148 真实交互与来源 | Next 状态 |
| --- | --- | --- |
| `projects-list` 工程列表 | 名称/路径/ID 搜索、状态筛选、展开、状态提示、复制路径/ID、最近打开、目录打开、移除注册；`/` 聚焦搜索。旧 `web/index.html:29–52`、`web/src/app.ts:1638–1858,3306–3462` | **部分只读界面**；新项目选择/概览没有完整管理动作（新 `src/App.vue:36`、`src/views/OverviewView.vue:14–20`） |
| `projects-setup` 添加与接入 | 四来源：目录、Dashboard、创建、初始化；五步：来源→工程→启动/工具范围→Agent→完成；进度、失败、取消。旧 `web/index.html:212–440`、`web/src/app.ts:378–475,1954–1979,3180–3302` | **尚未迁入**；无目录/脚手架/setup 合同 |
| `creator-actions` 生命周期/Preview/Profiler | Dashboard 启动、聚焦、停止、重启；ready 才预览/探针/状态/刷新/取证；结果可收起。旧 `web/src/app.ts:364–375,587–642,1825–1854,3333–3359,3427–3428` | **尚未迁入**；新服务页仅重新读取，资源页运行按钮禁用（新 `src/views/ServicesView.vue:12–14`、`src/views/ResourcesView.vue:50`） |
| `logs` 日志与诊断 | 工程/来源/级别多选、搜索、刷新、暂停/恢复、滚最新、清空、诊断结果。**清空实际只传工程筛选，不能称仅删当前来源/级别/关键字可见项**。旧 `web/index.html:54–89`、`web/src/app.ts:546–584,2508–2518,3489–3528` | **尚未迁入**；新无日志路由/端点，版本页面不是日志 |
| `calls` 调用历史 | 最近调用进入弹窗；全部/失败、刷新、每页50/更多、摘要展开、会话重置、实时合并；不重放调用。旧 `web/index.html:799–809`、`web/src/app.ts:1808–1815,1982–2162,3540–3555` | **尚未迁入**；新 `src/views/HistoryView.vue` 是版本与边界，不能代替调用记录 |
| `tools` 工具目录/范围 | 工程标签进帮助工具管理；分类/单工具开关；分配、克隆、改名、保存、删除、导入/导出；内置范围不可编辑；生效需 MCP 客户端重连。旧 `web/index.html:599–623`、`web/src/app.ts:790–895,994–1113` | **尚未迁入**；新帮助只是说明（新 `src/domain/product-information.ts:25,40`） |
| `mcp-cli` MCP 注册/CLI 交接 | MCP 五客户端配置写入；CLI 工程绑定命令/Skill提示词复制、换行展开、复制后打开Agent；网页不执行所复制命令。旧 `web/index.html:732–797`、`web/src/app.ts:2245–2302,2416–2487,3135–3163,3464–3476` | **尚未迁入**；新 `src/domain/product-information.ts:20–21,38–39` 只保留说明 |
| `knowledge-service` 知识服务控制 | 刷新/启动/关闭；运行后工具可见；iframe 不允许时外开8081；只停止本页拉起进程。旧 `web/index.html:91–111,644–649`、`web/src/app.ts:2877–2935,2984–3018` | **尚未迁入**；没有对应页或服务控制合同 |
| `knowledge-read` 库/检索/文档 | 选库与详情；混合检索默认10/最多1000、取消、来源元数据；文档列表/详情/原文/开头分块。**“下载原文”在网页实际显示返回正文，非浏览器保存文件**。旧 `web/index.html:113–148`、`web/src/knowledge-page.ts:314–339,503–535,635–710` | **尚未迁入**；Picker 关键词/图片也不能替代知识检索 |
| `knowledge-chat` KB/Agent 会话 | 两类提问及追问/新会话；选择Agent/刷新；无对话权限或库未配模型时，不一并宣布检索不可用。旧 `web/index.html:149–172,644–649`、`web/src/knowledge-page.ts:575–755` | **KB问答源码已接，实机未验**；已核原chat合同，独立问答构建逐次确认、续问/新会话和UNKNOWN保护。未部署/调用真实模型；Agent问答仍未迁，见 `knowledge-conversation.md` |
| `knowledge-sync` 同步 | 默认折叠、登记来源/状态/试运行/执行；不跟随当前检索库；允许入队不等于写库完成；scheduler 策略开启不等于有运行worker。旧 `web/index.html:174–186`、`web/src/knowledge-page.ts:234–272,537–558,672` | **尚未迁入**。迁移成功提示必须保留“已持久化入队，未证明写入完成”；不能把 HTTP 成功或试运行当索引成功 |
| `model-service` 模型启动器 | 状态、启动/关闭、运行后内嵌；**关闭服务仅关闭启动器，不证明面板启动的模型停止**。旧 `web/index.html:191–205,653–656`、`web/src/app.ts:2938–2974,3019–3051` | **尚未迁入**；新服务卡不拥有启动器或GPU生命周期 |
| `live-refresh` 实时状态 | 可见时3秒工程状态轮询；SSE日志/调用；重连刷新调用统计；暂停日志不停止工程状态轮询。旧 `web/src/app.ts:2500–2505,3491–3497,3534–3559` | **尚未迁入**；新为手动有界快照（新 `src/adapters/same-origin-readonly.ts:51–56`） |

## 6. 权限与结果语义必须保留

- **工具范围和 Creator 权限分开。** core/full/自定义是 MCP 工具可见集合；实际 read-only/authoring/full-control 由 Bridge 独立控制。没有 ready 或未知响应时不能推定具有权限。旧 `web/src/app.ts:661–685,738–753,1013–1026`。
- 原工程 setup、创建/初始化、MCP 注册及服务启停有真实副作用，不能为了界面可点就接入未经核对的请求。原包 README“工程页”记录：setup 可安装/更新 Bridge、启动 Creator、配置客户端；移除仅删登记、不删工程；生命周期复用 Dashboard，并保护未保存内容。本轮没有独立执行后端验证。
- 原包 README“隐藏项、独立后端与迁移检查”记录 Web `/api` 的本机 Host、session 与非 GET 同源 Origin 校验，以及机器 `/v1` 的 Bearer 边界。不能把 Next 图片审阅宿主 token 当 Companion v148 会话，也不能新建通用代理绕开边界。
- **知识同步成功只表示入队。** 前端显式写出未证明写入完成（旧 `web/src/knowledge-page.ts:551`）；writerEnabled 显示允许入队、schedulerEnabled 只显示策略状态（`:243–244`）。包内后端审计另记录需校验 queuedOnly=true / writePerformed=false；完整索引完成还需真实收据/完成 SHA。这不是“点执行同步即写库成功”。
- **生成接收、图片保存、Creator 导入、视觉批准、运行可见、自动化终态、生产验收分开。** 旧 AI 任务接受请求后要求刷新原任务；手工验收不消除 UNKNOWN。不得把 Next 的 DOM/单元测试、人工 PNG 元数据或 Picker 保存回执转为这些结论。
- **保留条件隐藏。** 工具范围管理器在工程标签入口、知识同步在运行时折叠区、AI技术字段在 Advanced；暂时隐藏不等于不存在，可以改善可发现性但不能删除功能。

## 7. 独立 public-image-review：关键词搜索缺口

这是另外一个图片搜索/审阅服务的迁移缺口，**不属于 Companion v148 的 `/api/icons` 图标链，也不证明二者是同一服务**。

主任务已实核消费者侧：Next 图片素材页当前只接受 Picker JSON 导入，关键词搜索尚未接通。本次直接复核到：

- 新 `src/adapters/image-review.ts:12–17` 拒绝不是 `browser_import` 的任务。状态枚举含 `searching`（`:7`）不代表支持搜索任务模式。
- 新 `src/adapters/image-review.ts:49` 的 JSON 端点只有 `/api/state`、`/api/import`、`/api/companion/capabilities`、`/api/companion/export`；`:67` 实现候选清单导入，没有关键词提交。
- 新 `src/views/ImageAssetsView.vue:53–67` 提供选择/粘贴 Picker JSON、解析、明确确认后下载，没有关键词表单和搜索提交；`:76–83` 是候选预览/选择/目录保存。

| ID | 状态 | 缺口与不能跨越的边界 |
| --- | --- | --- |
| `public-image-keyword-search` | **尚未接通；文本合同已核、完整投影待核** | 已取得原只读审计的请求/状态/取消/冷却合同，详见 `public-image-review-parity.md`；精确来源/历史/冷却字段仍需按原源码补核，再接用户可见关键词搜索。不能根据端点命名猜 API，不能只放一个不可执行搜索框就标完成，也不能调用 v148 图标生成代替公开图片搜索 |

Next 现有 Picker 导入、受控同源预览和带任务/选择一致性检查的保存仍应保留；新增搜索不得退化这些保护。此处只登记消费者缺口，没有推断独立服务所有搜索源、许可或返回字段。

## 8. 当前需要纠正的迁移标记与验收口径

1. Next 2e7adcc 的 `src/domain/product-information.ts:5`、`HelpView.vue:12`、`AboutView.vue:7,25`、`ChangelogView.vue:7`、`MigrationView.vue:16` 仍按 v133 参考/v148待核表述。本次静态证据已更新，应在后续 UI 变更中改成“v148源码/部署字节已核，实时服务与业务迁移未验收”，不能直接改成全部完成。
2. `migrationFeatures` 尚需单列旧 AI 图标及其真实六步、配置/参考图、原任务与尺寸导出；不能以 `resource-flow` 的“新版独立功能”一行吞并（新 `src/domain/product-information.ts:31–44`）。
3. 关于原资产现已取得且校验一致：SVG SHA-256 `09a1630732db59daab65a89c7636f7a5f2350c20052446c479306e61797b8228`；二维码 SHA-256 `1f6aa2f20c8375196cdd61e30fc2bbc75e8b98fa41f7a28a36e8671c53a1b1e1`。后续展示要保留原字节，不重绘或改变收款内容。本轮只核字节，没有对二维码像素进行视觉验收。
4. 旧关于“仅处理本机工程与日志，不上传工程数据”应作为原版文案与适用范围呈现，不能扩大成模型、知识库、AI 图标、公开图片服务绝不外发的总承诺。静态 Bridge 0.4.0 和 Creator 3.8.8 文案也不是实时兼容认证。
5. 真正“只改UI、功能全保留”应逐项验收旧入口→新入口、旧动作→新合同、正常/拒绝/失败/取消/重复/未知结果、上下文切换与真实回执；本文件、帮助目录恢复、Picker单页通过和前端构建均不足以单独证明完整迁移。


## 9. 本片修复后状态（0.1.1）

以上矩阵保留 2e7adcc 的审计快照与原源码行号，不追溯改写历史状态。本片后续变更已将当前参考改为 v148；加入原四主入口的迁移状态链接；单列原 AI 图标和独立图片关键词搜索。帮助13节静态正文、完整代码复制、按块换行/展开已恢复；原关于图标/二维码保持字节且二维码已实际查看，反馈邮件/复制及品牌关于入口恢复；114条原发布记录按原规则显示27日组。动态工具目录、原“发送到 Cursor / Codex”交接及所有未接业务操作仍未迁入。完整当前检验见 `validation.md`。

这些变化关闭的是信息入口与原静态内容缺失，并不把业务矩阵中的未迁项改为完成；新前端不替换原 Windows 四页功能。


## 10. 独立图片审阅迁入（0.1.2，未替换 v5 实机基线）

基于独立审阅 v0.1.0.20 的 7 个原文件及逐文件 SHA，公开图片关键词 / 来源多选与报告、历史、1.2 秒串行状态读取、来源许可 / 缩略图 / 原图、单张重试、停止请求、持久化全反取消选择和可恢复回收已迁入源码。保留 Picker browser_import、过滤合同、原子 expected-task / selection 保存与逐项回执。选择使用新受保护端点即时写入 task.selected，读回 / 重开采用服务选择；不回退无任务守卫的旧接口。

当前关闭的是本独立图片服务的这些源码与离线回归缺口，并未改变矩阵中 Companion v148 工程、知识、模型、日志、CLI/MCP 或 AI 图标真实链路的未迁状态。新代码没有在 Windows 消费或真实联网；其实际浏览器 / CSP、来源下载、冷却、历史恢复、跨标签与原生目录验收仍待独立取证。已有 v5 帮助版验收不等于本片验收。详见 public-image-review-parity.md、bridge-review-controls.md、validation.md。


## 11. 原工程 / 日志 / 调用手动读取（0.1.3）

新独立 `/projects` 页面与专用 Cookie 同源构建按已核v148后端实现六类GET：登记 / 状态 / Dashboard、环形日志、调用统计与分页。保留搜索筛选、折叠 / 复制 / 最近打开、摘要 / 更多和session重置；缺状态为未知，日志/调用迟到隔离。新增功能是实际读客户端与可操作UI，未在真实daemon中运行，不能当已完成实际接通。

原实时SSE / 3秒轮询、目录/创建/setup/MCP/生命周期/Preview/诊断、知识/模型、AI图标等业务仍在前述未迁清单。源码片不修改Windows v5验收或此前v6图片交付；后端类webRoot与daemon无参数转发的真实宿主缺口已记录。见 `companion-read-workspace.md` 和最终验证记录。

## 12. 知识只读查询 / 模型状态（0.1.4）

`/knowledge` 已有真实合同的 3 GET 和 8 逻辑只读 POST 客户端与 UI：CLI / 认证 / 检索验证，服务 / 模型启动器可达，知识库 / 文档 / 切片 / Agent 列表与详情、关键词检索与原文内存预览。每个查询均明确触发，不嵌入 iframe；输入、页面、provider 变化隔离旧请求。二进制原文不执行，后端临时文件副作用有明确说明。

这里只关闭只读源码入口缺口。真实宿主未装配；知识问答 / Agent 执行、同步、服务启停和模型启动器管理仍待迁入。没有改动 Library v6 或 Windows v5。宿主缺失闭包、Cookie 端口边界和持久 locator 问题见 `companion-host-assembly.md`，不能把新前端白名单称作只读后端。
