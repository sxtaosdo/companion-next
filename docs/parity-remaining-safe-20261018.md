2026-10-18 13:32 UTC: production Creator-only (10) Next wizard reached complete/current and ready; a differing-options request while active returned production409. Original project restored ready/unsaved=false, registries/profile and protected repository snapshots preserved. Earlier restricted launch environment omission was corrected through the guarded restart without a bundle change. Codex-enabled01/11 and knowledge/model execution remain unverified. See [bounded acceptance](creator-only-real-20261018.md).

2026-10-18 13:13 UTC: production Bridge-only (00) Next wizard installation, complete/current readback and managed-file conflict rejection have real receipts; original state restored. Other combinations and production different-options409 remain unverified. See [bounded acceptance](bridge-only-real-20261018.md).

2026-10-18 最新：[Windows聚焦修复](windows-focus-fix-20261018.md)已部署，真实Next按钮200且实际Creator前台回读通过并恢复。知识库多天未闭环原因、1647文档/1493遗留未完成及官方方案比较见[只读复盘](knowledge-retrospective-20261018.md)；知识身份仍未注入。

当前原生窗口/IDE续验以[native-ui-receipt-20261018.md](native-ui-receipt-20261018.md)为准：目录取消、默认桌面目录确认、真实Explorer、Cursor接收后取消已通过；聚焦原失败已修复，真实Next前台回读已通过（见顶部最新回执），Codex因可能覆盖现有草稿未投递。知识库已有受限reader可复用候选，当前有效性未查，不需默认新建密钥。

# 当前迁移对齐矩阵（2026-10-18）

状态：Accepted；仅 companion-next 与旧 cocos-mcp Companion，不代表全部验收完成。

| 分类 | 当前结论 | 证据及剩余 |
| --- | --- | --- |
| 已实现且验证 | Preview、刷新、Profiler | preview-profiler-approved-20261018.md；d87a5e2；不重跑。 |
| 已实现且验证 | 96变体、真实清单、原生保存 | 复用专项报告及c80b890；不重复导入或启动Creator。 |
| 已实现且验证 | 预设主要增删改、导入导出、分配、引用保护 | remaining-real-acceptance-20261018.md；单项覆盖及并发未随之通过。 |
| 已实现且验证有限实机范围 | 原生目录取消、默认目录确认 | 本轮真实系统窗口200并正确回填；任意目录树导航未覆盖，见原生续验报告。 |
| 已实现且验证 | 仅登记、移除登记 | 本轮任务自有目录真实Next 201→200，通过后登记表恢复原字节，见下方证据。 |
| 已实现且实机验证 | 打开目录 | 新Explorer窗口规范路径核对后仅关闭该窗口。 |
| 已修复且真实Next验证 | 聚焦Creator | 新宿主实际前台PID18252/窗口459944核对通过并恢复；原失败和修复证据分别保留。 |
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

- 知识正向查询可复用既有受限reader候选；当前daemon auth=missing，reader今日有效性尚未查，不能用网页Cookie替代。未创建或持久保存凭据，也未修改安全策略。
- 客户端持久配置需要明确客户端与工程范围，因为会改用户配置；IDE prompt若自动投递给模型，还需明确解除该动作的暂停。
- Agent问答/模型启停需明确解除当前暂停；知识同步需明确数据源、目标与写入范围。当前不执行这些动作。
- 原生目录窗口、打开目录、窗口聚焦属于既有范围的实机验收，不新增功能授权需求；本切片尚未执行，不虚构为权限阻塞。
- 没有证据表明必须重启共享daemon或修改旧后台；本切片也未申请或执行。

原始业务证明和readiness已归档 docs/evidence/parity-remaining-safe-20261018-*.json，附真实页面截图。旧报告中的“待验收”以本表新增结果更新，但不覆盖历史时点记录。

## 用户要求的并行推进（10:40–10:45 UTC）

已在同一本地任务实际并行启动四个独立 lane 与一个只读审查 lane；未新建重复主任务。根协调者独占 Git 索引、提交和产品文案文件；子 agent 只读取仓库，在各自专属 Temp 写证据。没有让知识身份阻塞安装/客户端核对。

| lane | 本轮真实执行及结果 | 仍未证明 / 边界 |
| --- | --- | --- |
| 安装接入与冲突 | 原安装器/SetupService源码转译到独占Temp，使用合成两文件扩展包；六个真实隔离文件/服务断言通过：Bridge-only、相同选项复用、不同选项409且无第二副作用、current、受管手改拒绝且原字节不变、未登记目录接管保留额外文件。 | 未运行生产安装接口；不是完整真实扩展加载，也不是四组合生产安装/客户端冲突通过。Creator、Codex配置、监听、生产HTTP均0。 |
| 客户端/编辑器 | 实际读取系统协议和包注册；Cursor和Codex均已注册、对应可执行文件存在。Codex为packaged handler，不能因shell command为空误判缺失。执行新旧纯函数18例离线对比，全一致。 | 关闭旧“Codex未注册”阻塞；未证明具体子路由或prompt真实接收，更未启动应用/投递prompt。 |
| 模型服务 | 只读核对源码和既有.94证据；状态GET、服务确认流、8090固定原iframe已实现。复用旧9卡片只读证据，不重复测试。 | 未新增实机操作；真实启停会影响共享launcher/客户端，仍未执行。未启动模型实验或Comfy任务。 |
| 知识库/Agent | 原cookie+Origin实际只读POST kb/list与agent/list，均401 AUTH_MISSING。缺身份拒绝路径通过。 | 正向内容未通过；未问答、未同步、未创建凭据。原search检查no-vector能力但派发未带该参数，不能未经确认把真实搜索称为无推理。 |
| 证据审查 | 独立只读review支持仅登记/移除结论；纠正矩阵历史状态冲突及“始终ready/回执截图”措辞。文案修复review无P1/P2。 | 审查不是新的业务实机验收；不扩张既有证据。 |

安装lane发现并由根修复已批准向导的文案缺陷：严格选项下原说明错误要求五项全勾选，校验提示也称必须完整接入。现根据strict/legacy显示真实要求：严格模式Bridge安装、任务复用及工具范围必选，Creator/Codex独立可选；旧完整接入仍五项必选。条件、选项、请求、UNKNOWN保护均未变，权威更新日志已同步。源码提交908d68c / 1.3.173.104；定向2文件57测试、类型检查、workspace构建通过。沿用原部署流程仅更新Next静态文件，不重启daemon，保留原hash资产及备份。

**精确剩余授权边界更新：** 知识正向元数据读需明确允许的现有API身份与KB范围；当前daemon在构造时捕获身份，原8081浏览器登录不能代替API身份。按现实现还需协调一次共享daemon重启，仅将身份注入该进程环境；本轮未执行，也不默认持久保存/创建凭据。先解决旧检索CLI的向量行为再决定是否可在无推理边界下搜索。真实问答、同步、共享模型启停、持久客户端写入分别按原限制处理。协议注册和安装隔离测试自身不需要上述额外权限。

正式cookie实页复核：6个静态资源HTTP200且SHA与构建一致；strict可选说明可见，旧全选说明未显示；5个checkbox均未勾选，pageErrors=[]、blocked=[]、daemon身份未变。证据parity-setup-copy-real-20261018.json及PNG；没有刷新或关闭用户窗口。
