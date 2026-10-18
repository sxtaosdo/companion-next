2026-10-18 13:32 UTC: production Creator-only (10) Next wizard reached complete/current and ready; a differing-options request while active returned production409. Original project restored ready/unsaved=false, registries/profile and protected repository snapshots preserved. Earlier restricted launch environment omission was corrected through the guarded restart without a bundle change. Codex-enabled01/11 and knowledge/model execution remain unverified. See [bounded acceptance](creator-only-real-20261018.md).

# 七项迁移状态与验收矩阵

2026-10-16本机继续功能还原：Dashboard独立手动发现与原点选路径进入登记向导已实现，真实只读后台连续两次8项、6项匹配登记；没有把它混入周期状态轮询或自动登记。当前实现与部署/浏览器边界见 [本机还原记录](dashboard-discovery-local.md)。下文172/173历史验收保留原时点；完整迁移仍未结束。

最新补充（资源接口与Next）：资源候选已安全加载，源码精确补丁与共享dirty隔离、实际只读路由/新查询未准备操作的409、daemon OPEN均有回执；只核过job列表、resource-config、job状态与variant-import-status，不据此宣称其它操作或真实导入已验收。原先“四操作未提供”是旧运行bundle时点，不再当当前候选缺失结论，新增路线仍须各自验收。Next恢复四来源与原创建/初始化，真实写验证仅两个Temp工程；92文件3840项通过，Creator、GPU、原生窗口与完整五步流程仍未验。参见[当前差距](feature-parity-current.md)和[本片记录](project-scaffold-local.md)。

核对日期：2026-10-16。源码基线 `59260de2de28fdb98e45e7bb53e22a544129395a` / 前端 `1.3.172`。本文不增加界面、接口、权限或功能，不作为部署/真实业务验收回执。

## 现场证据与源码证据分开

- 本次协调交接记录：2026-10-16 02:48 UTC 已完成 Next 六静态文件部署及校验；不是仍安装 0.1.20。
- 2026-10-16 03:25 UTC Owner 明确报告“看到新开发后台了”。这证明用户报告页面访问恢复，不能继续把较早 403 写为当前持续结论。
- 页面所见版本、认证后的资源响应哈希、真实服务状态及业务操作尚待各自验收。本源码审计没有操作 Windows，也没有独立观察上述页面或服务；服务恢复任务当时没有最终回执。
- 当前文档中的历史 0.1.x / 1.3.171 说明保留阶段含义。AI 写链“未迁入”等旧描述以 1.3.172 的 `ai-workflow-022.md` 和 `feature-parity-current.md` 补充为准，不能据历史段落重复实现。

## 当前七项

| 项目 | 已有源码或已确认结果 | 尚未实现 / 合同限制 | 尚待验收 |
| --- | --- | --- | --- |
| 1. 访问与版本 | 六静态文件部署有交接回执；Owner 报告可看到新后台 | 不新增认证绕行、凭据读取或版本推断 | 认证页面版本、资源响应哈希、服务恢复终态、正常入口实际使用 |
| 2. 服务管理真实联动 | 状态读取；知识服务启停；模型启动器关闭；知识运行且不可内嵌时的原固定外链 | 模型启动/生命周期、原管理iframe、Comfy细健康同源投影未接；模型原无外开按钮，新增需另确认；模型启动有LAN/代理副作用 | 真实8081当前ECONNREFUSED，知识后台打开/登录待验。启动器可达不等于GPU/模型就绪，关闭启动器不等于关闭全部模型 |
| 3. 原业务补齐 | 登记/状态/启动聚焦/停止重启/目录打开/移除；已有工程登记、原目录选择、四来源创建/初始化与全量 setup；日志/调用/SSE；工具预设持久操作 | 完整五步/多Agent选择、严格部分 setup、版本/客户端配置、Preview/Profiler/诊断导出、日志清空、五客户端 MCP/冲突处理、实际 Agent 交接仍缺 | 原生窗口、持久配置、预设写回、会话重连及相关真实动作，不以源码存在当全迁完成 |
| 4. 已确认工程 UI | toast/tip、启动聚焦直接执行、紧凑行/同行添加、图标展开、应用内返回、日志同行与最新、静默局部刷新、运行卡片折叠、向导旧配色 | 本项不新增侧栏折叠、导航重排或操作历史页 | 浏览器像素、等待态、输入/滚动保留、无闪动、实际折叠及弹窗交互 |
| 5. 概览与真实工程 | 概览首项和根默认入口；真实登记列表；点选进入工程上下文；资源页绑定相同工程 | 不自动选择第一个工程；没有通用工程资源库存读取接口，不以草稿/样例充库存 | 实际读取、选择/切换、深链接、来源变更和失效工程表现 |
| 6. AI 资源端到端 | 规范读写、参考上传、任务准备/入队或采用PNG、执行/恢复、候选预览选图、1024母图导入、单尺寸导出、原验收证据展示 | 通用库存、Codex真实会话回收与新资源流程接通仍缺；旧运行bundle曾缺 reference-crop、reference-crop-status、handoff、resource-plan-preview；当前已装候选源码含这些路线，但本轮没有分别调用核验 | 实际 Python/Studio/CLI/Pillow 路径与hash、GPU执行、像素视觉、真实导入、Creator引用/场景/Preview/Build。dispatchAccepted和人工证据不等于自动通过 |
| 7. KB/Agent | 库/文档/切片/检索/原文、KB问答/续问、Agent列表、知识服务启停 | Agent问答/执行、来源同步、交互后台入口仍缺；全局 writerEnabled 不授权逐来源写入 | 真实认证/会话/问答/服务动作；单文档修复是独立任务，旧固定窗口到期与正式写入0不能被UI接线覆盖 |

## 本轮只读切片筛选结果

帮助原文/复制、关于、前端版本、Creator 已返回版本均已有实现（`HelpView.vue`、`AboutView.vue`、`CompanionBrowserView.vue`）。工程卡第121行已经显示适配器脱敏后的 `lastError`，不是遗漏。

已核 v148 `http-server.ts` 没有可直接采用的同源 daemon/客户端版本 GET；不能新造协议。诊断是管理 POST，调用 `debug.exportDiagnostic`；Preview 的 `status`/`probe` 也走 `managementCall`，不是可以无权限变化包装的纯只读入口。

现有状态适配器保留 `dashboardVersion`/`dashboardProgress`，工程详情未展示。当前可读取的参考包没有原 Web `app.ts`，不足以证明其原位置/交互。若后续恢复该详情，应先取得旧 UI 基线，或向 Owner 说明最小展示方案并确认；本轮不为产生改动而添加 UI。

后续更新：2026-10-16 已通过协调任务取得旧 `app.ts:1364` 提示基线。1.3.173 仅恢复原状态标签悬浮/聚焦的 Dashboard 两条信息，不添加常驻详情；上述“待取得基线”是本页最初审计时点的限制，现已解除。详见 `project-status-tooltip-023.md`，其它业务缺口仍保持。

## 对应回归与现场验收门

- 工程/状态/导航：`companion-browser-*.test.ts`、`registered-project-views.test.ts` 及工程UI相关既有回归。
- 服务：`service-status.test.ts`、`local-service-operations-*.test.ts`，覆盖有限合同与禁止模型启动；不替代主机动作验收。
- 知识：`knowledge-read-*.test.ts`、`knowledge-conversation-*.test.ts`，列表/查询/问答不能扩大成 Agent 执行或同步。
- AI：`ai-jobs-read-*.test.ts`、`ai-task-creation-*.test.ts`、`ai-job-actions-*.test.ts`、`ai-job-acceptance.test.ts` 等，保持未知结果与真实交付证据独立。
- 本轮 `npm test`：88 文件、3737 项全部通过，耗时21.65秒；`vue-tsc --noEmit` 与 `git diff --check` 通过。没有安装依赖或运行升级。本轮只改文档，未重建/改动冻结包，未增加或修改测试、业务代码；执行的是既有全量回归。
- 测试均为源码/fake/jsdom，不能声称浏览器像素、GPU、服务启停、保存或 Creator 端到端通过。

依据：`feature-parity-current.md`、`local-service-operations-021.md`、`route-production-audit-021.md`、`ai-workflow-022.md`、`project-ui-019.md`、`project-ui-020.md`，以及上述页面/适配器源码。没有部署、发布或新功能实现。
