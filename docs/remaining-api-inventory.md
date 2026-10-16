# v148 UI 已证请求与待补后端合同

> 2026-10-15 / 1.3.172：已据v150实际合同接入原AI单图inspect/enqueue/adopt及run-next/resume/select/import/export-variant源代码，jobs/status/candidate继续复用原读取。完整源实现与fake验证不证明当前选中Python/CLI/Pillow或实际GPU/Creator就绪；通用资产上传、裁剪、Codex网页API不存在已核合同，保持缺口。以下历史未迁项以 `feature-parity-current.md` 和 `ai-workflow-022.md` 当前记录为准。

> 2026-10-15 / Next 0.1.17：已有工程仅登记与单独完整安装接入源码已迁，真实副作用逐项选择，任务复用/UNKNOWN/部分失败明确。目录选择、scaffold、严格部分setup、工具写入与其它客户端仍缺；部署和实机未执行。详见 [安装接入合同](project-setup-wizard.md)。

> 2026-10-15 / Next 0.1.16：正常模式基本生命周期源码已在0.1.14–15恢复；本片新增目录打开与移除登记源码，固定原v148接口、逐次确认、非原子风险和UNKNOWN登记回读。实机操作/正常模式部署尚未验收，添加/安装接入向导及其他原功能仍待迁；当前总差距以 [功能对照](feature-parity-current.md) 为准。详细合同见 [目录与登记动作](project-registration-actions.md)。以下旧阶段清单保留历史，不代表当前源码仍缺这些已补按钮。

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

本清单仅来自已校验 v148 Web 源码以及明确注明的 v133 历史后端；不表示当前 Next 已发出这些请求。后端补源清单、分片顺序和实机完成门见 `migration-execution-order.md`。UI 的宽松类型不等于服务端保证，应在取得同版本源码后建立严格有限投影。

## 工程、日志和调用读取

| 请求 | v148 UI实际消费 / 参数 | 尚须v148后端确认 |
| --- | --- | --- |
| GET /api/projects | 数组 id/name/path | 附加Creator/connection字段与限制、登记身份 |
| GET /api/status | 数组 projectId/state；sessionId/creatorVersion/launchSource/dashboardVersion/dashboardProgress/capabilityProfile/lastError 可选 | 八态枚举、Bridge查询和内部状态变更；HTTP200不是运行验收 |
| GET /api/dashboard/projects | path/name/version?/lastOpenedAt?/source/exists/progress?/state?/running?/pid? | 发现和登记分离、平台路径归一化、最近打开来源 |
| GET /api/logs | 重复 projectId/source/level，search；UI不发limit，响应日志数组 | limit默认200/上限1000、同字段OR跨字段AND、消息大小写搜索及最新N条旧→新序（均为v133证据） |
| GET /api/calls/counts | sessionId，counts字典，latest可选摘要字典 | 缺工程键不保证有0；session是服务调用会话，不是Bridge会话 |
| GET /api/projects/:id/calls | limit=50；status只在失败筛选发failed；before取nextBefore | strict query、sequence游标、保留上限、总数/筛选语义 |
| GET /api/events | 普通message触发日志GET；命名call消费sessionId/total/record；open重拉counts/当前页 | framing与资源清理；v133无id/replay/retry/心跳，不能承诺断线无丢失 |

调用页：`{sessionId,total,retained,records,nextBefore?}`。记录：`id,sequence,projectId,operation,source(mcp/cli/web),operationNameZh,startedAt,status(running/success/failed),durationMs?,inputSummary,resultSummary?,errorSummary?`。旧纯函数保留终态不被迟到running覆盖；切工程/筛选/服务session清游标。v133每工程保留1000条、total累计不随保留量回落、before严格小于sequence、total/retained均不是失败筛选数量。未知工程可返回空页，不能单凭空页证明仍登记。

日志无HTTP before/since/cursor/nextPage，不造加载更早功能。原来源下拉缺 scene-console/preview-console，但全选时不过滤会返回它们；应允许未列出来源显示。旧loadLogs没有迟到保护，新迁移必须有请求代次与取消。

工程显示可直接复用v148 project-list纯函数：running筛选仅ready/starting，异常不归stopped；缺状态在Next保留未知。停止默认折叠、其它默认展开，ready强制展开；sessionStorage存逐工程1/0偏好。现适配器只保留name/id/版本，不能从ServiceState反推原runtime或Creator权限。

## 工程写操作不能合并成一个“启动”

- 目录选择：POST `/api/pick-directory {}`，返回path或cancelled。
- 创建/初始化：POST `/api/projects/scaffold`，create传mode/parentPath/projectName/creatorVersion，initialize传mode/path/creatorVersion；真实写工程。
- 接入：POST `/api/setup`，projectPath或projectId、startCreator、configureCodex；返回operationId后GET `/api/setup/:id`轮询。**旧v148卡片启动使用setup且configureCodex=true**；登记与安装Bridge不受两个开关省略，不得伪称单纯进程启动。
- 生命周期：POST `/api/projects/:id/start|focus|stop|restart {}`；不能用start替代原setup再声称行为完全等价。需未保存场景、已有实例、Dashboard与重启约束。
- 打开目录：POST `/api/projects/:id/open-folder {}`，真实打开文件管理器。
- 移除：DELETE `/api/projects/:id`，移除登记/关联而不是删除工程或停止Creator。
- Preview：POST `/api/projects/:id/preview/probe|start|status|reload|stop`；start为target=browser，其它为空。名称status不代表可绕过management权限。
- Profiler：POST `/api/projects/:id/profiler/capture`，显式operationId；响应statusHint/证据不能当生产验收。
- 诊断：POST `/api/projects/:id/diagnostic`，旧UI无body；涉及诊断导出，不是前端只读格式化。
- MCP：POST `/api/projects/:id/mcp/register {target}`，五客户端codex/cursor/trae/kiro/vscode；真实配置写入，保留冲突/回滚与独立确认。
- 清日志：DELETE `/api/logs`，只传工程筛选。v133清内存不清NDJSON，不按来源/级别/关键字；空/全工程都省略筛选可清整个store。

工具读取：GET `/api/tools`；GET `/api/tool-presets?projectId=…`；GET `/api/tool-presets/:id/export`。写入：POST `/api/tool-presets`、PATCH/DELETE `/api/tool-presets/:id`、POST `/api/tool-presets/import`、POST `/api/projects/:id/tool-preset {presetId,setupOperationId?}`。Preset含id/name/baseProfile/enabled/disabled/builtIn/updatedAt。内置不可编辑；删除在用范围与客户端重连的实际效果待同版store核验；工具范围不提升Creator权限。

## 知识与模型

服务GET：`/api/knowledge-service/status`消费running/frameable；`/api/model-service/status`消费running。对应POST start/stop传空对象。旧UI optional布尔不等于后端可省略；启动/停止的200/503与生命周期ownership须同版client核验。

GET `/api/knowledge/status` 严格 schemaVersion=`companion-knowledge-v1`，包括：

- cli.available/compatible布尔、version/error可选。
- retrieval.auth=missing/configured/verified/denied，keyword=unverified/verified，kbId/endpoint。
- sync.available/writerEnabled/schedulerEnabled布尔；最多100来源，id/label/channel(local/official)、targetSha/completedSha/freshness/pending/jobs/error有限字段。
- 状态可读、认证配置、真实检索verified、服务running和对话模型可用分别显示。无同步来源不禁用本来可用的检索。

| POST相对路径（均/api/knowledge/前缀） | v148请求 | UI证明的响应范围 |
| --- | --- | --- |
| search | query，kbId?，limit? | 严格schema/results/count=count.length；最多1000结果；id/title/content/knowledgeId?、source元数据 |
| kb/list | {} | schema与items数组；使用id/name，完整item结构待adapter |
| kb/view | {kbId} | schema后将整个JSON显示，完整投影待adapter |
| doc/list | {kbId?,keyword?} | 同上 |
| doc/view | {id} | 同上，不附当前kbId |
| doc/download | {id} | 同上及truncated；旧网页页内pre展示，不是浏览器保存文件 |
| chunk/list | {id} | 同上及truncated |
| agent/list | {} | schema与items，选项id/name |
| chat | {query,kbId?,sessionId?} | schema、string sessionId；answer/references完整模型待adapter |
| agent/ask | {query,agentId,sessionId?} | 同上 |
| sync/dry-run | {sourceId,channel} | schema/plan固定白名单摘要；来源来自status而不是所选检索KB |
| sync/run | {sourceId,channel} | 同上；后端必须核queuedOnly=true/writePerformed=false，不视作已索引 |

参数：UI query/keyword trim后1–512个JS code units；KB/doc/Agent ID选择限制为`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$`；limit1–1000整数，表单默认10。没有有效KB时省略字段交后端默认，不能伪造库。原文≤1MiB临时下载清理、完整各读取响应及队列收据目前只有报告/历史测试提示，必须取v148 adapter复核。

旧知识请求单飞：一般30秒，doc/download和sync/dry-run45秒，chat/agent/ask/sync/run75秒；解压响应2MiB、fatal UTF-8、JSON校验。不能照搬现项目GET适配器128KiB/4秒预算。取消只是abort HTTP；sync/run取消/超时/网络异常必须记未知。已解析AUTH_DENIED优先于取消，不能保留错误的verified状态。

旧UI两个会话变量未按KB/Agent隔离，新对话可在请求期间清空后又被晚响应写回；新实现必须补对象身份/请求代次/导航卸载保护。不要把查询/正文/回答/sessionId写工程日志或持久化草稿。

旧运行态自动iframe到8081/8090，属于完整可交互服务面板，不可标只读。v133知识stop按PID/端口和exe路径识别，没有页面ownership token；模型按8090命令行含launcher.py识别。v148报告的“只停本页启动”须实际代码复核，不能照旧说明直接承诺。start和stop是否互斥也待核。关闭模型启动器不证明它启动的模型全部关闭。

## 下一片的验收清单

- 先只读工程/调用手动查询，再日志与受控SSE；业务读成功不能依赖预设或知识服务也成功。
- 测断流、坏JSON、部分失败、同会话计数、服务重启、分页中新事件、迟到running、A→B→A、卸载清监听和日志事件合并。
- 不重放调用，不清日志，不在首片加载完整知识/模型iframe，不自动取后台凭据。
- 取得v148后端后逐条记录“相同 / 已变化 / 缺契约”，再实现真实同源注册；未连接始终不是0项目、0日志或服务停止的证明。


## 同版后端补证更新

现已消费v148后端29文件参考包，SHA见 `companion-read-workspace.md`。本片项目/状态/Dashboard/日志/调用六类GET已直接核同版源码；原文标为v133候选的读取合同，在新适配文档中记录实际v148一致点和预算。知识adapter与生命周期原实现也已到，但不在本片UI实施范围。

重要核实：知识stop确实没有页面ownership保证；模型只识别8090监听命令行含launcher.py。CompanionCookie不按端口隔离；HTTP类有webRoot，但daemon入口未暴露。不能把仅有后端类构造参数描述成现成可运行独立启动命令。
