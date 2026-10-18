# 当前迁移对齐矩阵（2026-10-18）

状态：Accepted；仅 companion-next 与旧 cocos-mcp Companion，不代表全部验收完成。

| 分类 | 当前结论 | 证据及剩余 |
| --- | --- | --- |
| 已实现且验证 | Preview、刷新、Profiler | preview-profiler-approved-20261018.md；d87a5e2；不重跑。 |
| 已实现且验证 | 96变体、真实清单、原生保存 | 复用专项报告及c80b890；不重复导入或启动Creator。 |
| 已实现且验证 | 预设主要增删改、导入导出、分配、引用保护 | remaining-real-acceptance-20261018.md；单项覆盖及并发未随之通过。 |
| 已实现，实机未验证 | 原生目录选取和取消 | project-directory-local.md仅有受控回执，无真实FolderBrowserDialog证据。 |
| 已实现，待独立实机验收 | 仅登记、移除登记、打开目录、实际聚焦 | 下一安全切片使用任务自有目录，不安装、不启动Creator、不写客户端配置。 |
| 已实现，身份阻塞 | 知识库正向只读查询 | 10:35 UTC：CLI可用且兼容source-v0.8.2，auth=missing；服务running=true、frameable=false。 |
| 已实现，当前不执行 | Agent问答、知识同步、模型启停/切换 | 问答可能推理并写会话；同步no_source、writerEnabled=false、schedulerEnabled=false。 |
| 已实现，具体授权后实测 | 持久客户端安装/配置、真实IDE prompt投递 | 可能修改用户配置或触发推理，不为补验收自动授权。 |
| 实施缺口 | 尚无新的已证实纯Next漏迁控件 | 路由及操作存在不等于真实全流程通过，保留未验证项。 |
| 新需求，非漏迁 | Codex会话自动导入、自动收口/同步调度 | 另行方案与授权。 |

续验前检查点：工作树干净，HEAD d87a5e2；daemon PID20116、epoch 613ef7f2-f58f-45c9-b398-8f9f6ec71895。未重启共享服务。readiness证据暂存任务Temp companion-closeout-safe-20261018/readiness.json；后续结果另记。