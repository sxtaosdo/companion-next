# 当前迁移对齐矩阵（2026-10-18）

状态：Accepted；仅 companion-next 与旧 cocos-mcp Companion，不代表全部验收完成。

| 分类 | 当前结论 | 证据及剩余 |
| --- | --- | --- |
| 已实现且验证 | Preview、刷新、Profiler | preview-profiler-approved-20261018.md；d87a5e2；不重跑。 |
| 已实现且验证 | 96变体、真实清单、原生保存 | 复用专项报告及c80b890；不重复导入或启动Creator。 |
| 已实现且验证 | 预设主要增删改、导入导出、分配、引用保护 | remaining-real-acceptance-20261018.md；单项覆盖及并发未随之通过。 |
| 已实现，实机未验证 | 原生目录选取和取消 | project-directory-local.md仅有受控回执，无真实FolderBrowserDialog证据。 |
| 已实现且验证 | 仅登记、移除登记 | 本轮任务自有目录真实Next 201→200，通过后登记表恢复原字节，见下方证据。 |
| 已实现，待独立实机验收 | 打开目录、实际窗口聚焦 | 本轮未执行；不属于新功能授权需求。 |
| 已实现，身份阻塞 | 知识库正向只读查询 | 10:35 UTC：CLI可用且兼容source-v0.8.2，auth=missing；服务running=true、frameable=false。 |
| 已实现，当前不执行 | Agent问答、知识同步、模型启停/切换 | 问答可能推理并写会话；同步no_source、writerEnabled=false、schedulerEnabled=false。 |
| 已实现，具体授权后实测 | 持久客户端安装/配置、真实IDE prompt投递 | 可能修改用户配置或触发推理，不为补验收自动授权。 |
| 实施缺口 | 尚无新的已证实纯Next漏迁控件 | 路由及操作存在不等于真实全流程通过，保留未验证项。 |
| 新需求，非漏迁 | Codex会话自动导入、自动收口/同步调度 | 另行方案与授权。 |

续验前检查点：工作树干净，HEAD d87a5e2；daemon PID20116、epoch 613ef7f2-f58f-45c9-b398-8f9f6ec71895。未重启共享服务。readiness证据暂存任务Temp companion-closeout-safe-20261018/readiness.json；后续结果另记。
## 本切片结果（10:39 UTC）

“仅登记 → 移除登记”已通过真实32180 Next页面：POST /api/projects 返回201；DELETE /api/projects/54ba670cf4156b0c 返回200、removed=true；自动化确认两个回执元素可见；截图分别记录登记后新项目ID及移除removed=true界面，登记成功回执正文未完整入画。任务自有目录为 Temp/companion-closeout-safe-20261018/next-registration-only-fixture，保留 assets 空目录及 package.json 作为证据，未安装Bridge、未启动Creator、未写客户端配置。

操作后 projects.json 恢复原字节，tool-presets.json 原字节未变；任务工程 package.json 未变、assets仍空。原工程操作前后均 ready，PID18252、session e04e7299-680f-4109-a829-8cac07a51bd4 未变；daemon身份未变。cocos-mcp、原游戏、既有96变体工程的 HEAD/status/工作区diff/暂存diff哈希前后相同。上述证明没有覆盖额外未跟踪文件内容的逐文件哈希，不扩张为整个磁盘逐字节证明。

执行器先遇到 Git 大diff默认缓冲上限、两个输入定位失败；均发生在业务请求前。调整执行器缓冲及使用现有输入placeholder定位后通过，未改产品代码、未降低API/页面保护。最终只允许两笔业务请求，blocked=[]，没有失败后的补偿DELETE。

已验证项现增加：仅登记和移除登记。仍未验收：真实系统目录选择/取消、打开目录、实际窗口聚焦、预设单项覆盖及并发、长时段日志/SSE完整覆盖、客户端真实持久配置及IDE投递、知识正向内容查询。已有局部验证不能泛化为整项完成。

### 需要具体确认的动作及原因

- 知识正向查询需要由Owner提供现有可用的只读登录/授权方式；当前auth=missing。未创建或持久保存凭据，也未修改安全策略。
- 客户端持久配置需要明确客户端与工程范围，因为会改用户配置；IDE prompt若自动投递给模型，还需明确解除该动作的暂停。
- Agent问答/模型启停需明确解除当前暂停；知识同步需明确数据源、目标与写入范围。当前不执行这些动作。
- 原生目录窗口、打开目录、窗口聚焦属于既有范围的实机验收，不新增功能授权需求；本切片尚未执行，不虚构为权限阻塞。
- 没有证据表明必须重启共享daemon或修改旧后台；本切片也未申请或执行。

原始业务证明和readiness已归档 docs/evidence/parity-remaining-safe-20261018-*.json，附真实页面截图。旧报告中的“待验收”以本表新增结果更新，但不覆盖历史时点记录。
