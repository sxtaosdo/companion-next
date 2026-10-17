# Companion Next 旧功能逐项核对（2026-10-17）

状态：Accepted。结论：尚未全部对齐。只核对开发者 Companion，不涉及 game-ops-admin、7470/7471。

## 基线与证据分级

Next 起点 `fab6ebf` / 本地 `1.3.173.29`，工作树干净；产品 `1.3.173`，既有部署 `3074d37/.25`。旧共享仓只读基线 `4fcfe82`，22 条既有 dirty 保留。现存 `cocos-mcp/web/index.html`、`web/src/app.ts`、`web/src/knowledge-page.ts` 为本轮真实旧 UI 对照；宿主既有 v150 合同和已部署候选另计，不能把共享未提交源码算作运行服务。

下表“已实现且验证”逐项标明验证层级：源码/离线不是实机；“缺失”表示 Next 用户入口或动作链未恢复；“未验证”表示不能给出整体完成结论。文案、占位、CLI 提示和注册 provider 均不充当业务通过。

## 对齐矩阵（修复前）

| 旧真实入口 / 操作证据 | 已实现且验证 | 缺失 | 未验证 / 限制与 Next 证据 |
| --- | --- | --- | --- |
| 顶部四页：icons/projects/knowledge/models；旧 index.html:22–25 | Next 对应 `/ai-icons`、`/projects`、`/knowledge`、`/knowledge?tab=models` 已接路由 | 下面所列页内操作仍缺，不能以导航代替 | src/router.ts:18；src/App.vue:29；原导航交互并非逐项实机通过 |
| 帮助、关于、版本；旧 index.html 帮助及关于弹窗、web/src/changelog.ts | 帮助正文、复制、原图标/二维码、更新记录及持续显示产品版本已有离线验证 | 业务功能缺失不能靠帮助目录补足 | src/views/HelpView.vue、AboutView.vue、ChangelogView.vue；静态记录见 docs/migration-parity-v148.md；Owner逐项UI未验 |
| 工程登记/搜索/状态/展开/复制；旧 index.html:29–52，app.ts 工程卡与 render | 真实登记概览默认首项导航、选工程上下文、工程筛选/复制/折叠及状态源码，已有离线回归 | 无以示例工程冒充正式数据 | src/views/OverviewView.vue、components/RegisteredProjectOverview.vue、CompanionBrowserView.vue:54–84；真实状态切换、全部窗口交互未逐项验 |
| Dashboard发现与选路径；旧 app.ts:1899–1957 | 已恢复手动发现，真实只读8项/6登记匹配及受控UI验证 | 无自动登记承诺 | docs/dashboard-discovery-local.md；原生目录真实系统窗口未验，docs/project-directory-local.md |
| 四来源添加/创建/初始化；旧 index.html:212–440，app.ts setup/scaffold | 四来源、原scaffold、登记及独立setup，合成Temp工程201与表单验证已有证据 | 完整原五步、多Agent选择及严格部分setup未齐 | components/ProjectSetupWizard.vue、stores/project-setup.ts；真实Bridge安装/持久客户端配置/活跃任务复用未验；不能将202当完成 |
| Creator启动/聚焦/停止/重启/目录/移除；旧 app.ts 生命周期动作 | 原同源六动作、目标绑定、UNKNOWN和回读已接，有离线验证 | 旧卡主启动走setup与Next直接start仍语义有别；独立安装入口不能省略 | adapters/creator-operations.ts、components/CreatorOperationDialog.vue；实际生命周期/原生窗口/所有工程未验。本轮禁止启动Creator |
| Preview探针/启停/刷新/状态；旧 app.ts:587起 `/api/projects/:id/preview/:name` | 单资产运行验收已完成并留档 | **Next工程卡没有原Preview操作栏/结果链** | 资产运行证据不等于Next按钮迁移；CompanionBrowserView.vue 当前只有六生命周期/管理动作 |
| Profiler取证；旧 app.ts:617起 `/api/projects/:id/profiler/capture` | 既有隔离资产Profiler846采样已通过 | **Next缺原取证按钮、状态和结果链** | 不重复启动Creator；docs/variant-ui-followup-20261017.md、外部RUNTIME-96记录 |
| 日志筛选/刷新/暂停/最新；旧 index.html:54–89，app.ts:546–584 | 日志读取、筛选、SSE、暂停及“↓最新”源码与既有离线回归 | **手动刷新先清空DOM，会丢失滚动位置及跟随最新**，旧版响应后替换 | CompanionBrowserView.vue:54–61/日志工具条；stores/companion-browser.ts refreshLogs；本轮选择修复这一已批准交互缺陷 |
| 清除日志；旧 app.ts:2508–2518 `DELETE /api/logs[?projectId=…]` | 无 | **Next未提供真实删除动作** | 旧删除只带工程筛选，不带来源/级别/关键字。不能把可见页清空当后台清除；本轮不删除真实日志 |
| 导出诊断；旧 app.ts `/api/projects/:id/diagnostic` POST与结果 | 无 | **Next未恢复诊断操作与结果展示/导出** | 后端结果含日志须核语义；不以服务状态页代替诊断导出 |
| 调用记录/统计/失败/分页/摘要/session/SSE；旧 index.html:799起、app.ts:1982–2162 | Next `/projects?tab=calls` 原合同读取已接，有适配/store/UI回归 | 不支持重放（旧版也非重放） | CompanionBrowserView.vue 调用区、adapters/companion-browser.ts；真实session重启/重连与并发到达未验 |
| 工具预设目录/范围/CRUD/import/assign；旧 index.html:599–623、app.ts预设管理 | `/help?topic=tools` 读取、导出与宿主持久写合同已接且离线验证 | 不能以页面草稿或下拉选择算宿主保存/分配 | components/ToolPresetWritePanel.vue、adapters/tool-presets-write.ts；真实持久写回未验，无expectedHash并发保证 |
| MCP五客户端注册/冲突处理；旧 app.ts `/api/projects/:id/mcp/register`、index.html:732–797 | CLI提示词、检查命令和复制已有离线验证 | **独立MCP客户端配置/冲突处理、实际Agent交接未迁** | components/CliUseDialog.vue只给文本；不能算已注册或已执行 |
| 知识库/文档/原文/切片/检索；旧 index.html:113–148、knowledge-page.ts | `/knowledge` 原读取合同与文本原文展示已接，离线验证 | 无任意文件读取能力 | views/KnowledgeReadView.vue、adapters/knowledge-read.ts；实际8081当前不可达的历史证据保留，本轮未探测/启动 |
| KB问答/续问/新会话；旧 knowledge-page.ts | 原KB问答sender正常模式已接，UNKNOWN/会话隔离离线验证 | 无真实模型通过证据 | components/KnowledgeConversationPanel.vue；真实问答暂停，不启动本地模型 |
| 自定义Agent提问/续问/新会话；旧 knowledge-page.ts:756 `/api/knowledge/agent/ask` | Agent列表可读 | **Agent问答入口/发送与会话未迁** | Agent列表不等于Agent问答；本轮不发送问题 |
| 知识同步试运行/执行/来源；旧 index.html:174–186、knowledge-page.ts同步事件 | 同步状态可读 | **试运行/执行/逐来源控制未迁** | 原队列不等于索引写入完成；当前缺逐来源授权合同，docs/route-production-audit-021.md:确切边界5 |
| 知识服务启停/iframe/外开；旧 index.html:91–111、app.ts:2877起 | 原启停及不可嵌入8081外链已接且离线/受控UI通过 | **旧管理iframe未恢复** | components/LocalServiceControls.vue；真实服务启停/认证未验 |
| 模型启动器启停/iframe；旧 index.html:191–205、app.ts:2938起 | 启动器状态及关闭源码与离线验证 | **原启动和管理iframe未齐** | 原启动有LAN/代理副作用；当前用户暂停全部本地模型工作，不在本轮开放或验证 |
| AI图标规范/上传/任务/生成/选择/导入/尺寸；旧 ai-icons-page.ts与/api/icons合同 | 正常模式原六步、变体导入已接；3074d37/.25已有3883回归；单个96变体PNG/meta/UUID和场景重开/Preview/Build/Smoke实际通过 | 单资产通过不能覆盖所有资源/全部旧动作 | components/RegisteredProjectResources.vue及AiJobActionsPanel.vue；docs/variant-ui-import-20261017.md、history-read-regression-20261017.md；productionVerified仍false；真实模型生成暂停 |
| 新资源规划/Codex/Comfy流程（新版附加） | 草稿/规划/来源切换和回收清单已在 | 原流程数据接通、真实会话回收/来源引用全链仍缺 | 不虚构Codex网页API；不是旧图标全功能的替代品 |
| 图片素材审阅/保存（独立宿主） | 独立审阅宿主代码已在 | **正常Companion中未注册图片审阅provider，Owner字节审图保存全链未闭合** | src/main.ts:图片provider仅在独立/companion路径分支；views/ImageAssetsView.vue。不再开发搜索/爬取 |
| 实时更新；旧 app.ts:2500–2505、3491–3559 | Next可见页约3秒工程轮询、SSE日志/调用、暂停及局部渲染源码已测 | 不保证无遗漏或重放 | stores/companion-browser.ts、tests/companion-live-store.test.ts；Owner生产会话长时重连未验 |

## 本轮可做项与边界

先以本文件提交任务检查点，再修日志手动刷新保留快照。仅改 Next 对应日志按钮、定向UI回归、用户更新记录和本文件；不新增交互，不发送DELETE，不改旧宿主或生命周期，不部署共享目录。源码修复完成与运行网页仍为旧部署分别交付。

其余缺失仍应逐项恢复，不能宣称“功能已对齐”。Preview/Profiler、日志清除/诊断、MCP/Agent/同步需按旧合同分别推进；模型工作暂停。既有96验收、82历史回归不重复执行。
