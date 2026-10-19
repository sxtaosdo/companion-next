# 首候选restart500只读追溯与共同根因复核（2026-10-19）

本次只读已有请求记录、fixture落盘日志、首次部署备份、两版源码图与版本标记；没有新增HTTP、生命周期、模型或服务操作，没有重新部署。当前连续验收已闭环，不重跑。

## 首次500可确定到哪里

1. 原验收仅派发start1次、restart1次，失败即停；不是脚本重复发送restart。start于17:02:51.943Z记录ready，PID468、会话c18a91f7-cb5c-4132-877a-78300e3355a7；restart派发17:02:54.145Z。
2. fixture持久日志17:02:57.115Z进入stopping，17:03:00.019Z记录通用“Creator所属进程退出未能确认”，HTTP500于17:03:00.031Z。停止确认阶段约2904ms；不符合常规20s进程树deadline或30s exec超时的时间线。
3. 对照首次实际源码，只有在工程路径已取得、未保存检查已通过后才记录stopping；错误来自stop helper或其Node收据边界。没有随后launching/bridge-wait记录，失败发生于重启的停止段，未进入重新启动段。不能归为UI按钮未派发、未保存取消或新Creator启动失败。
4. 首候选备份JS哈希确为006f4bfa94ea81ff0931e190b07d7e6cf783cffb168a04e22bf2f7ac04637c9a；首次脚本预检绑定该entry SHA，验收后312文件保护核对一致。当前与首候选82个自有源码条目中只有creator-process-stop.ts内容变化，daemon和CreatorLifecycle内容相同。没有发现首候选装错包或两版UI差异的证据。
5. 事后实际Creator0只证明事后观测无Creator，不能证明首轮在返回500前完成了全部身份/退出检查，也不能把该轮改记成功。

结论：已定位为宿主停止helper/收据确认失败；现存证据不足以唯一确定触发语句，不能给出“已证实单一根因”。

## 原因候选与证据缺口

|判断|依据|因果强度|
|---|---|---|
|重复终止处于退出中的句柄，是首要代码嫌疑|首候选root.Stop后立即遍历含root的held集合；Gone尚未成立时还会再次TerminateProcess。当前版记录terminationRequested，每句柄只发一次|代码路径确实存在；没有当次Win32错误/句柄时序，不能证明500发生在这里|
|身份查询/后代重扫的退出竞态，或Node JSON/收据拒绝仍不能排除|这些失败都被同一catch折叠；没有当次stdout/exitCode或失败阶段|未证实，不能凭后续通过排除|
|中间父进程退出导致漏孙进程是另一个独立实现问题|旧版Gone或Hold=null直接跳过；复审用隔离回归指出可错误确认成功|已在当前版修复并有回归；它本身更直接解释漏查/假成功，不能直接解释这次快速500|
|测试环境掩盖异步退出窗口|原fake Stop立即令Gone=true，所以重复终止窗口在原测试中不存在|已证实覆盖缺口；不是生产失败触发条件的证明|
|部署差异、key过期、硬件/模型是本次500原因|既有安装hash、单请求及状态日志不支持这些解释|没有证据，不采用|

首候选execFile回调丢弃原error、exitCode/signal及stdout/stderr；外围catch又把解析/收据异常统一变成CreatorStopFault。持久fixture日志和首次call摘要只剩通用文字。CallHistoryStore是进程内存，首次实例已按授权交接退出；幸存摘要已归档，但不能从SQLite恢复不存在的子进程诊断。

当次缺失：PowerShell失败阶段、原生错误码、失败时held后代身份及逐句柄终止/退出时序、子进程退出码/stdout。没有这些，继续只读不能重建唯一触发点。当前版已有白名单失败阶段、原生码保留到异常对象及原错误码及时捕获；持久lastError/通用HTTP仍以消息为主，不能承诺任何未来故障都有完整原生诊断。无需为追因新增业务调用或全量维护框架。

## 共同根因及最小防复发检查

|边界|已证实问题|最小检查（复用现有能力）|
|---|---|---|
|启动配置|原401是新进程丢失临时credential路径，worker之前拒绝；503是PS5.1继承PS7模块路径|正常入口启动后核对新实例身份、同一非秘密引用存在及原授权KB一次元数据200；PowerShell模块路径只限定子进程。不得以旧实例成功代证新实例|
|进程交接|旧Creator stop只通知根PID便返回stopped；普通guarded stop受历史UNKNOWN与writer锁约束|动作回执同时核对旧OS身份/所属树退出；daemon交接只用已授权精确身份、业务计数和已知writer锁保留，UNKNOWN不清零、不盲删锁|
|UI状态|Bridge不可达raw error与已确认OS停止不是同一事实；按钮成功不等于进程树无残留|保留raw状态和操作回执，核对fixture ID/路径及OS结果；不为了显示绿色改写raw error。当前停止中性展示复用.146|
|版本谱系|Git源码、安装bundle、MCP常量和Next静态版本不同，普通全量build可能覆盖既有知识接线|每次只读记录entry SHA、候选commit、允许overlay列表、未变文件hash和实际静态JS hash；版本称谓按下表分开|
|验证覆盖|旧实例成功外推新实例；原停止测试仅杀根/假句柄立即退出；单轮HTTP通过漏掉子进程|离线边界覆盖异步请求/退出及中间父消失；实机只做已批准连续启动→重启→重启→停止并逐轮OS核对，本轮已通过则复用，不为追因重跑|
|诊断边界|首候选把不同失败折成通用错误，无法事后唯一归因|保留已有白名单阶段；若自然再失败，先归档该次阶段和已有回执再判断，禁止自动换PID或盲重试。尚缺的历史原生时序明确留空|

这是一组边界验证与证据保留问题，不是已证明由单一配置、GPU、模型或上游权限造成的共同故障。没有发现需要本次继续修改的已证实当前功能缺陷；测试覆盖及诊断粒度的限制如实保留。

## 实际版本与部署字段

|对象/字段|核对结果|含义|
|---|---|---|
|首次失败产物|补丁9fbf317；daemon SHA006f4bfa94ea81ff0931e190b07d7e6cf783cffb168a04e22bf2f7ac04637c9a|已归档失败，未改记成功|
|当前补丁|独立工作树55256cb；其package元数据0.3.150|隔离补丁版本，不表示共享源码或所有安装文件升级到0.3.150|
|当前daemon实际身份|PID20332，epoch eced9fac-c162-4b9d-8f6e-e2756c40e2db；entry SHA1984698ce8b2ec524d1e9e2b0d4d8733075ea4783bfa0f0e9d72b8dad8b6ce94|磁盘locator身份与实际entry文件hash一致；本次未新增HTTP健康查询|
|当前daemon map|91e9c88026f959285cfb0761f046314351f7350961e30cae587bd04a3f90b68f|仅允许3源码overlay；两版之间只有helper实际内容改变|
|宿主独立release semver字段|当前daemon bundle无独立release semver常量|以entry SHA/补丁commit报告；不能把Git.147/.150标签当它已返回的新版本字段|
|实际安装CLI中的COMPANION_MCP_VERSION|0.3.142|MCP server版本常量，不把它错误称为daemon补丁版本；CLI本轮未替换|
|共享源码mcp/package.json|0.3.142|共享工作树原状态保留。历史9b8f979的该字段为0.3.147，历史报告“原.147”应按Git谱系标签理解|
|旧UI bundle顶项CHANGELOG_ENTRIES[0].version|0.3.142|旧UI未改；不表示新Next版本|
|实际Next运行UI|提交a8e88ac，内部1.3.173.146，产品页1.3.173；index-Dx563SKg.js SHA b2b29887dbc1e62e9f25fd1856afac8dc49dc0d6232de12346b2e00e90b5eda9|沿用已有部署证据和本轮真实静态回执/磁盘hash；没有重新部署UI|
|Next文档检查点|ebab2bb/1.3.173.154；本只读报告提交将继续递增文档检查点|源码/文档版本，不冒充运行UI.146已经升级|

完整迁移矩阵仍13通过/6部分/2暂停，不因本次只读追溯改变。后续模型、真实客户端配置、日志清空、历史搬迁等原暂停/禁止范围保持。

证据：[首轮时间窗、差异及版本事实](evidence/creator-process-tree-20261019/first-500-readonly-audit.json)、[首次请求/失败](evidence/creator-process-tree-20261019/first-failed-journal.json)、[首次状态摘要](evidence/creator-process-tree-20261019/first-failure-status.json)、[后续连续通过](evidence/creator-process-tree-20261019/continuous-proof.json)。
