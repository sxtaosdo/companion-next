后续独立修复：知识服务503已定位并恢复，Next原启动200、原登录页只读验证通过；受原SAMEORIGIN/self策略限制，正确显示外开链接而不嵌入。详见[知识启动恢复](knowledge-start-recovery-20261018.md)。下表503保留为当批历史结果，Creator切换仍未执行。

# 剩余迁移真实验收（2026-10-18）

状态：Accepted。任务检查点 `7ebb2ef / 1.3.173.96` 后进行本批验收。静态产品仍是 `9af5813 / .94`；本批无产品代码或部署变更。**整体尚未验收对齐**，不能把已接按钮、受控回执或旧96资源验证当作本批实机通过。

## 本批逐项结果

| 原操作 / Next 入口 | 已实现且真实验证 | 缺失或未验证 | 证据 |
| --- | --- | --- | --- |
| 正式工具预设新建、改名、草稿保存 | Next UI → 原 POST201、改名PATCH200；追加“用当前草稿保存”PATCH200，名称和core→full落盘回读通过 | 工具覆盖项修改、多项保存未测试，不能用基础范围保存代替 | preset-real-proof、preset-draft-save-resume-proof |
| 正式预设导出、导入 | 实际浏览器下载并解析 JSON；任务专用 JSON 经页面候选确认 → 原 import 201 | 未测试多项导入或并发写冲突；旧 API 无 CAS，不能宣称并发保护 | 两份 preset proof |
| 工程预设分配、引用删除保护、删除 | 只绑定已登记隔离工程 a79f4915296f4091，分配200；普通删除409拒绝；清理后两项删除200；从未发送 confirm=true | MCP 客户端实时生效不在此证据范围 | 两份 preset proof |
| Next Preview 探测、状态 | 实际运行工程 colony-flow-food-hunt 上各一次200；原 Creator23740、session和三个监听前后相同 | 两份回包均 running=false、connections=0、stopSupported=false，不能写成预览已运行或可停止 | preview-probe-status-real-proof |
| Next Preview start / reload / Profiler | 已有界面和原接口；本批未执行 | 切换 Creator 执行请求被自动审批拒绝，未启动隔离工程、未发这些按钮请求。历史96验收不能替代 Next 本次按钮验证 | approval、preview proof |
| 知识服务启动、实际 iframe | Next 确认后实际 POST 一次，503，running=false | 原启动失败；8081真实 iframe、Owner登录、问答、Agent、同步均未通过本批验收 | knowledge-real-proof |
| 编辑器 payload 交接 | 保留先前受控协议验证：Cursor 已注册，Codex 未注册 | 本批无实际 payload 交接或应用接收证据；不安装、不注册协议，也不把“已复制/尝试打开”算接收成功 | editor-handoff-owner-bytes-20261018.md |

完整原操作矩阵仍见 [parity-status-current-20261017.md](parity-status-current-20261017.md)，本节覆盖相应旧的“本批未验证”状态，其余项目保留各自边界。

## 中断、续跑和清理

首次预设测试在正式创建/改名/导出/分配/409后，因自动化定位器的按钮名称不匹配中断。没有重放这些写请求；续跑只完成导入和清理。随后为覆盖独立草稿保存分支，再创建任务临时项；选项定位失败后同样续跑该现存项，没有重复导入，实际保存PATCH200并回读名称和core→full，最后普通DELETE200清理。所有真实写均经 Next 原确认 UI；原 ToolPresetRepository.removeProjectSelection 只用于去掉本次创建的 fixture 显式绑定，其余项目绑定不变，再经 Next 普通删除自有任务预设。最终 `tool-presets.json` **语义和完整字节均等于任务前副本**，任务项剩余0，fixture恢复原隐式full。未用整文件备份覆盖恢复，也未强制删除。

知识启动第一次自动化复选框定位失败时 dispatched=0；修正后正式请求一次，返回503。原程序及四项依赖的 manifest 哈希相符。使用原 state-check.py 的只读 SQLite 模式、输出到任务 Temp，确认 migration30/dirty0、quick_check=ok、启动触发表为空、历史状态哈希与原基线一致。原 metadata-prestart 和服务日志时间仍为10月16日。只读 PowerShell 子进程的 ignore/pipe stdin均正常退出。这些排除了部分猜测，**不足以确定启动失败根因或证明尝试绝无副作用**；没有重试原启动、绕过守卫、修数据库或改原后台启动器。

自动审批明确拒绝临时停原 Creator 并启动隔离工程：依据原始委托“不启动 Creator 或新监听”，认为有共享服务中断和监听变化风险。拒绝后未运行切换脚本；安全替代仅执行已有工程的 probe/status。当前提供给本任务的用户原文仍含该禁令；读取父线程未取回可核实的后续解除授权。继续实际 start/reload/Profiler 需要明确批准具体隔离工程切换及原工程恢复，并保持不新增监听约束；不通过旁路规避拒绝。

## 保护核对与证据

收尾 protection-after：旧 cocos-mcp、隔离工程、原工程的 HEAD、Git status、原脏文件哈希及暂存/未暂存原始补丁均等于本批基线；隔离工程全部已跟踪文件哈希也相同。状态条目与文件数量不同，不沿用历史267等数量作本批断言。

收尾 runtime-after：daemon20116/epoch613ef7f2/SHA35225eb5、CLI入口 creator-ai.js SHA6085072c；原 Creator23740/session d4e9a8b9仍ready；fixture无PID；模型状态投影与本批前相同，GPU仍heretic。无共享 daemon重启、模型启停、安装、MCP配置写入或发布。验证只关闭自有 headless Edge，上述进程证据不等于对全部系统进程的穷举。

长期证据：[本批真实回执与保护比较](evidence/remaining-real-acceptance-20261018.json)。完整原始文件、截图及脚本保留在 `C:/Users/33272/AppData/Local/Temp/companion-remaining-real-acceptance-20261018/`，JSON内记录原始证据SHA。临时脚本的定位错误属于验证工具问题，本批未发现可据此认定的产品代码缺陷。

真实 reviewer 只读审查了上述证据，要求限定 Preview/知识结论并补齐收尾保护；已据此修正文档。配置角色 reviewer，实际权限隔离未验证。追加草稿保存回执单独保留，收尾再次核对预设完整字节相同。仅文档/证据更新，不重复已有产品206测试，不把它们计为本批实机测试。
