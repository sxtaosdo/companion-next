# Companion 功能迁移对照：v133 本地参考

## 范围与时间点

- 核对日期：2026-10-12。仅静态读取已批准的本地源码，没有启动旧 Companion、访问 Windows、调用旧服务或检索新的第三方工程。
- 当前实际目标版本为 **v148，待当前 Windows 只读审计**。这是本次主任务于 2026-10-12 确认的版本信息，本文件未取得或核验 v148 源码。**v142 仅是历史冻结信息，不是最终迁移基线。**
- 旧参考：`../companion-next-baseline/cocos-mcp/web/`，`package.json:3` 为 `0.3.133`。本地快照记录的来源修订为 `e1bd5824e6c10a495b32891da0e1a1b8abd70962`；见快照 `BASELINE-REPORT.md`。它是选择性参考快照，不是当前 Windows 完整源码。
- Next 核对基点：`61918a4cdfc5551371bf1cc9ac370180f2f8c425`。下表的“Next 现状”和行号是本轮帮助/关于/更新日志外壳补齐**之前**的状态。后续新增说明入口不能自动把业务功能记为完成。
- 本文件只记录查到的 UI 入口、前端交互和接线差异，**不是完整覆盖声明，也不是运行兼容性验收**。v133 到 v148 的新增、删除、变更仍待当前源码对照。
- 下文 `旧` 表示上述 v133 快照的 `web/`；`新` 表示 Next 核对基点。保留的意思包括正常、失败、取消、重复操作、权限及未知结果行为，不只保留菜单名称。

## 结论

旧版主导航是“工程 / 知识库 / 模型服务”，工程页同时包含工程管理和日志中心。帮助、关于和可点击版本更新日志是全局入口。Next 核对基点只有“项目概览 / 游戏资源 / 图片素材 / 服务状态 / 版本与边界”。这些页面并不覆盖旧版三页及其业务交互。

Next 工程适配器只接受 `/api/projects` 和 `/api/status` 两个读端点，且明确不接模型服务、知识库、轮询或 SSE（新 `src/adapters/same-origin-readonly.ts:3–4,51–56,196–201`）。服务页的“连接/断开”是前端数据源连接和清空视图，不等于旧版启动/停止 Creator 或其他服务（新 `src/stores/workspace.ts:29–66`）。

## 核心功能矩阵

状态只针对 Next 核对基点；“部分”不代表已达到功能一致。“未迁移”表示在所核前端路由、页面、合同和适配器里没有相应可执行业务链路。

| ID / 功能 | v133 真实入口与关键交互 | v133 证据 | Next 核对基点现状 / 证据 |
| --- | --- | --- | --- |
| `main-navigation` 主导航 | 工程、知识库、模型服务三页互斥切换；工程页含日志；打开知识库/模型页按需刷新对应状态 | 旧 `index.html:21–24,28–207`；`src/app.ts:2852–2871,2975–2981` | **未迁移**。五条新路由没有旧知识库或模型页；新 `src/router.ts:7–15`、`src/App.vue:10,24` |
| `project-list` 工程管理 | 名称/路径/ID 搜索；全部/运行中/已停止筛选；卡片展开；状态和权限提示；复制 ID/路径；打开目录；移除登记 | 旧 `index.html:37–50`；`src/app.ts:1710–1816,3303–3340,3374–3436,3439–3459`；`src/project-list.ts:18–103` | **部分**。只有项目选择、单项目概览与有限状态投影，合同不含工程路径或完整卡片行为；新 `src/App.vue:34`、`src/views/OverviewView.vue:14–20`、`src/domain/contracts.ts:29–37` |
| `project-setup` 添加与接入工程 | 自选目录、Dashboard、创建项目、初始化空目录四来源；五步流程；目录取消；通过 Dashboard 启动；工具范围；选择 Agent 或跳过；进度/失败/完成 | 旧 `index.html:210–438`；`src/app.ts:378–475,1954–1979,2777–2840,3177–3299` | **未迁移**。没有添加、目录选择、脚手架或接入流程；新路由及页面入口见 `src/router.ts:7–15`、`src/views/OverviewView.vue:14–20`；读合同仅 `loadSnapshot`（`src/domain/contracts.ts:83–87`） |
| `creator-actions` Creator 控制 | 工程未就绪时启动/接入；已就绪时聚焦、停止、重启；忙碌和状态提示 | 旧 `src/app.ts:364–375,1785–1792,1825–1850,3424–3425,3475–3483` | **未迁移**。服务页只有状态卡和重新读取，没有 Creator 操作；新 `src/views/ServicesView.vue:12–14` |
| `preview-profiler` 预览与性能取证 | 已就绪工程提供预览、探针、状态、刷新、Profiler 取证；展示结果、隐藏结果；未就绪拒绝执行 | 旧 `src/app.ts:587–642,1493–1515,1837–1854,3330–3358` | **未迁移**。资源页运行验收按钮禁用；新 `src/views/ResourcesView.vue:49–50`。图片素材预览是候选图片，不是 Creator Preview |
| `mcp-register` 注册 MCP | 工程卡入口；Codex/Cursor/Trae/Kiro/VS Code 五目标；工程标识；注册结果；跳转 MCP 帮助 | 旧 `index.html:730–767`；`src/app.ts:2415–2432,2451–2486,2618–2676,3414–3415,3461–3473` | **未迁移**。无注册弹窗/目标选择/写入合同；新 `src/domain/contracts.ts:83–87`、`src/router.ts:7–15` |
| `cli-use` CLI 使用与交接 | 工程绑定命令、给 Agent 的提示词、Skill 安装提示词；完整文本复制；换行/展开；复制后尝试打开 Cursor/Codex；不代替用户提交 | 旧 `index.html:770–795`；`src/app.ts:2244–2301,2434–2449,3132–3160,3416–3417`；`src/cli-use-copy.ts:15–120`、`src/agent-handoff.ts:1–12` | **未迁移**。资源交接模块不是旧 CLI 使用入口；新导航无相应入口（`src/App.vue:10,24`） |
| `logs` 日志中心 | 工程/来源/级别多选与搜索；刷新；暂停/恢复实时更新；滚到最新；清除；导出诊断结果 | 旧 `index.html:53–87`；`src/app.ts:546–584,2507–2517,3486–3525,3554–3556` | **未迁移**。没有日志视图或日志读端点；新 `src/router.ts:7–15`、`src/adapters/same-origin-readonly.ts:3–4`。注意旧“清除”实现只传工程筛选，未传来源/级别/搜索，不能照提示文案推定删除范围 |
| `call-history` 调用记录 | 工程详情最近调用可打开弹窗；运行中/成功/失败、耗时、来源、参数/结果/错误摘要；全部/失败筛选；刷新；每页 50 条；加载更多；会话重置和 SSE 合并 | 旧 `index.html:797–807`；`src/app.ts:1808–1815,1982–2047,2050–2162,3537–3552`；`src/call-history.ts:1–33`、`src/call-meta.ts:11–38` | **未迁移**。`HistoryView` 是版本依据/范围说明，没有调用记录；新 `src/views/HistoryView.vue:7–8`。不得以“版本与边界”替代调用历史 |
| `knowledge-service` 知识库服务 | 独立页状态刷新、启动/关闭；服务未运行隐藏工具；支持嵌入则 iframe，否则新页签；只结束本页拉起的进程 | 旧 `index.html:90–111,640–647`；`src/app.ts:2873–2933,2982–3016` | **未迁移**。Next 无知识库页，适配器明确没有读取知识库；新 `src/router.ts:7–15`、`src/adapters/same-origin-readonly.ts:54` |
| `knowledge-read` 检索与文档 | 选库/查看库；向量与关键词混合检索，默认 10、最多 1000；取消请求；显示来源通道与版本；列出/查看文档、下载最多 1 MiB 原文、查看开头分块 | 旧 `index.html:112–147,629–638`；`src/knowledge-page.ts:341–558,563–573,635–671,675–710` | **未迁移**。没有检索表单、文档/分块展示或接口合同；新 `src/router.ts:7–15`、`src/adapters/same-origin-readonly.ts:3–4,54` |
| `knowledge-chat` 知识库与 Agent 对话 | 向当前库提问并沿用会话；自定义 Agent 列表和提问；分别重置会话；列表/对话权限失败局部降级，不把检索一并关掉 | 旧 `index.html:148–171,640–647`；`src/knowledge-page.ts:575–755` | **未迁移**。没有知识库会话状态、Agent 选择或提问入口；新 `src/router.ts:7–15`、`src/adapters/same-origin-readonly.ts:54` |
| `knowledge-sync` 知识同步 | 默认收起；状态、登记来源、同步试运行、受策略约束的执行、计划/结果；同步不跟随当前选库，页面不能自行开启写库 | 旧 `index.html:173–185,640–647`；`src/knowledge-page.ts:341–558` | **未迁移**。没有来源、计划/回执或同步合同；新 `src/adapters/same-origin-readonly.ts:3–4,54` |
| `model-service` 模型服务 | 独立页查看启动器状态、启动/关闭启动器、页内嵌入；关闭不等于停止启动器中已运行模型 | 旧 `index.html:190–205,651–654`；`src/app.ts:2936–2972,3017–3049` | **未迁移**。Next 通用服务状态不是启动器页，只有重新读取；新 `src/views/ServicesView.vue:6–14`、`src/adapters/same-origin-readonly.ts:54` |
| `tool-presets` 工具清单与开关 | 帮助中浏览工具分类/名称/说明/读写属性；工程标签进入范围管理；分配预设；分类/单项开关；复制自定义/改名/保存/删除/导入/导出；内置不可编辑；改变后 MCP 客户端需重连，不提升 Creator 权限 | 旧 `index.html:597–621`；`src/app.ts:790–895,897–1113,1723–1744,3088–3106` | **未迁移**。无目录/预设/工具修改合同；新 `src/router.ts:7–15`、`src/domain/contracts.ts:83–87` |
| `help` 帮助中心 | 全局问号；四大类、十二小节；默认运行时/性能诊断；一次打开期间记忆小节；CLI/MCP 上下文跳转；提示词复制/换行/展开/Agent 交接 | 旧 `index.html:19,441–659`；`src/app.ts:2244–2301,2318–2411,3065–3069,3108–3160` | **未迁移**。核对基点无帮助入口；新 `src/App.vue:10,22–31`、`src/router.ts:7–15`。补静态目录只算入口/参考内容，不代表工具和业务交互可用 |
| `about` 关于 | 品牌标题/图标均可打开；产品版本/Bridge 协议；用途、兼容性、数据范围；反馈邮箱与复制；支持开发；免费/禁止二售；下载链接 | 旧 `index.html:12–15,662–706`；`src/app.ts:3071–3085` | **未迁移**。品牌只跳概览，没有关于；新 `src/App.vue:22,26`。旧二进制收款图不在选择性快照内，不能用假图代替；旧兼容性和数据承诺不能当作 v148/Next 已核结论 |
| `version-changelog` 版本与更新日志 | 页头可点击版本和关于版本同源于 package 编译常量；版本点击打开按版本排序的更新日志，展示合并同 24 小时窗口条目 | 旧 `package.json:3`、`scripts/build.mjs:8–9,23–25`、`index.html:16,671,711–725`、`src/app.ts:149,2201–2207,3073–3075`、`src/changelog.ts:13–45,885–946` | **部分**。package 为 0.1.0，App/HistoryView 另外硬编码；HistoryView 展示 v133/v142 历史依据，不是更新日志；新 `package.json:3`、`src/App.vue:26`、`src/views/HistoryView.vue:7–8` |
| `live-refresh` 实时更新 | 页面可见时每 3 秒刷新工程状态；SSE 更新日志/调用；调用会话重新连接后刷新计数与记录；暂停日志不等于停工程状态轮询 | 旧 `src/app.ts:2498–2504,3488–3494,3531–3556` | **未迁移**。明确为手动有界快照，没有 SSE 或自动轮询；新 `src/adapters/same-origin-readonly.ts:51–56,196–201`、`src/stores/workspace.ts:29–66` |

## 旧帮助目录原貌

| 大类 | 小节 | v133 入口行号 |
| --- | --- | --- |
| 运行时 | 性能诊断；自动试玩与构建；动画与输入 | 旧 `index.html:450–483` |
| Cocos Bridge | 工程管理；CLI 接入；MCP 接入；场景与 Prefab；资源与脚本；UI 制作；工具清单 | 旧 `index.html:485–622` |
| 知识库 | 能做的事；不会做的事 | 旧 `index.html:624–649` |
| 模型服务 | 单页服务说明，无二级小节 | 旧 `index.html:651–655` |

大类/小节映射和记忆逻辑在旧 `src/app.ts:2318–2399`。工程工具范围入口定向打开 Cocos Bridge → 工具清单（`994–1000`）；MCP/CLI 弹窗说明定向打开相应小节（`2408–2411`）。

## Next 已有能力与旧迁移的关系

- Next 已有项目规范本地草稿（`src/stores/workspace.ts:70–78`），资源规划、生成来源/回执及六步页面骨架（`src/views/ResourcesView.vue:17,45–50`）。这些能力有独立价值，但不能抵消上述旧功能缺口。
- 图片素材页支持 Picker JSON 解析、受控同源审阅服务连接、明确确认后导入下载、页内受控预览、选择保留和服务保存回执（`src/views/ImageAssetsView.vue:53–83`）。它不是旧工程目录选择器、Creator Preview、知识库文档页或完整 Companion 迁移。
- 工程接口与图片审阅合同彼此独立。图片保存回执不代表配置写入、Cocos 导入、Prefab 绑定或运行验收（`src/views/ImageAssetsView.vue:81–83`）。
- 生成/批准/导入绑定/运行按钮仍有明确未接通状态（`src/views/ResourcesView.vue:47–50`）。这份静态审计不改变或覆盖此前各模块的测试结论。

## 获取当前 v148 基线的最小只读清单

仅通过已经授权的 Windows 只读任务取得，不启动服务、不运行旧源码、不改变文件。相对旧工程根目录：

1. `web/package.json`：实际 Web 版本；同时取得当前 Git HEAD 和精确工作区状态，区分已提交与未提交内容。
2. `web/index.html`：真实主菜单、所有页/弹窗、帮助目录、关于字段和静态资产引用。
3. `web/src/app.ts`：菜单切换、事件绑定、版本来源、连接与写操作入口；若已拆文件，跟随其本地相对 import 获取实际路由/菜单/帮助/版本模块，不能假定仍无 router。
4. `web/src/changelog.ts`：版本对应的用户变更；不能从版本号推测内容。
5. `web/scripts/build.mjs`：编译版本注入及静态资源复制方式；若脚本已改名，以 package 的实际 build 脚本为准。

为核对本表全部关键交互，再补 `web/src/knowledge-page.ts`、`project-list.ts`、`call-history.ts`、`call-meta.ts`、`time-format.ts`、`cli-use-copy.ts`、`agent-handoff.ts`；若要比对视觉资产，补 `web/app.css`、`web/about-icon.svg` 及 `index.html` 实际引用、获准读取的本地图片。用户已有或并行的未提交修改必须保留并标记，不用旧远端文件覆盖它们。

这些文件仅能建立 UI 功能基线。要恢复可执行操作，还需核对当前后端端点、鉴权/权限、请求响应、取消/未知结果和写入保护。不能仅凭旧 v133 UI 的按钮或 URL 把 v148 写操作接通。

## 完成判定

帮助、关于、版本、更新日志和迁移对照入口可先在 Next 安全补齐，并清楚显示资料版本及未核边界。完整迁移还需逐项证明：当前 v148 真实入口与行为已核；Next 对应 UI 与合同相符；正常/失败/取消/重复/旧响应路径经过验证；真实工程的写入和运行结果有对应证据。静态菜单、Picker 单页测试或 Next 自身构建通过均不足以单独满足这些条件。
