# Creator退出防复发措施落地（2026-10-19）

已补齐“异步退出窗口直接回归”和“安全错误码进入持久错误”两点。补丁2994d14已部署，当前daemon PID3860、epoch 2d198c64-75c0-4e6b-b3b5-2eac2015bf78、entry SHA 71cbf7d8bc200fdcc867da7ed3d671f00721e3cc025098624ba54a15ba8a167f，map SHA 212ba55f65e4216c11fd896433ac275c764061ae26de2cb6b62687b47d4e19ea。这是退出helper/测试窄修，没有改界面或扩大维护框架，也不声称证明首候选500的唯一原因。

## 已落地

|措施|当前状态与证据|
|---|---|
|同一固定句柄只发一次终止请求|55256cb已有terminationRequested；本轮直接回归生产C# Stop方法，只替换两个OS调用：Gone连续保持false，调用5次Stop仍仅一次终止请求，随后模拟退出再调用也不重发|
|安全阶段和整数原生码不在状态边界丢失|2994d14将经过白名单/整数校验的阶段及Win32码写入固定错误消息，CreatorLifecycle原有errorMessage即可在lastError及其现有日志/错误响应保留；未改lifecycle或HTTP接口|
|子进程失败与收据失败可区分|无有效结构化子进程诊断标subprocess；成功输出无法解析或收据不合法标receipt；不附原始输出|
|敏感信息不进入诊断|离线测试注入恶意stage、非整数码和SENSITIVE stderr/命令/额外字段，验证不会透传；只保留白名单阶段和安全整数码|
|中间父退出/身份丢失保护|此前两条回归仍在本次22项测试内，已捕获父句柄继续用于追踪孙进程，取不到已观测身份则拒绝成功|

原18条没有直接覆盖生产C#延迟退出窗口，也未验证原生码穿过lifecycle lastError；不能把它们说成已经覆盖。本次新增4条，针对性文件22/22通过、tsconfig.build --noEmit通过，复审无P1/P2；不重跑其他37项或整套真实生命周期。

新增具体测试名：

- `requests termination once while the real native Stop method waits for delayed exit`
- `retains the whitelisted stage and integer Win32 code in the lifecycle lastError`
- `rejects untrusted failure stages and noninteger codes without leaking raw child diagnostics`
- `labels malformed or invalid success receipts without persisting their content`

这些是离线模拟OS边界/子进程回调，不触及真实进程。延迟测试执行生产Stop方法而非复制其状态机；单次终止请求守卫移除后第二次请求会使该shim明确报错。PS与C#实际退出算法源码与55256cb逐字节一致，本轮改动仅Node错误诊断和收据校验；既有真实连续启动→重启→重启→停止证据复用，不再执行。

## 最小部署及健康核对

基线1984698c从实际安装源码图重建逐字节一致；候选只改helper实际内容，允许overlay仍限原3源码，其他条目逐项比对。按既有精确应用交接许可：PID20332身份/固定句柄/epoch一致，冻结时业务专项与HTTP均0，确认退出后保留该已知writer锁，UNKNOWN2不清除。从原入口及同一reader引用恢复32180，只替换daemon.js/.map，其余310文件不变。

最小健康核对：新实例OPEN、nativeAwaiting0/nativeUncertain0/UNKNOWN2；原授权KB状态200、元数据200；Next静态JS200且SHA仍b2b29887dbc1e62e9f25fd1856afac8dc49dc0d6232de12346b2e00e90b5eda9。通过APIRequestContext完成，没有启动浏览器页面，生命周期调用0、模型调用0；没有新增监听或系统重启。

最终保护核对：共享22项修改及21源文件、9业务表、配置和UNKNOWN journal、fixture原tracked/settings/server profile均保持，Creator0。Next实际UI仍a8e88ac/内部1.3.173.146、产品1.3.173；安装MCP常量0.3.142不变，隔离补丁package0.3.150不代表全安装包升级。本报告的Next文档检查点也不代表UI部署。

## 仍只是建议或未知

- 首候选500的唯一触发点仍未知；不再制造调用追因，也不以本轮离线测试或先前真实成功倒推历史原因。
- 若自然再发生失败，先保存现有lastError中的阶段/整数码和实例hash，再决定下一步；这是后续操作建议，没有新建监控、自动重试或恢复平台。
- 原生码只在子进程确实取得有效Win32码时存在；subprocess/receipt等失败不能凭空生成原生码。没有记录敏感命令、环境、原始stderr或完整进程快照，也不承诺仅凭阶段码可唯一解释所有故障。
- 离线延迟模型验证单句柄守卫，不等同于长时Windows压力测试；所属树的历史孤儿边界不变，模型及其他暂停任务不重启。

矩阵仍13通过/6部分/2暂停；本轮没有新增功能项或追加完整验收进度。

证据：[22条测试名与结果](evidence/creator-exit-diagnostics-20261019/targeted-tests.json)、[最小补丁](evidence/creator-exit-diagnostics-20261019/safe-diagnostics.patch)、[退出算法未变](evidence/creator-exit-diagnostics-20261019/unchanged-exit-algorithm.json)、[最小健康](evidence/creator-exit-diagnostics-20261019/minimal-health.json)、[保护核对](evidence/creator-exit-diagnostics-20261019/preservation-final.json)、[SHA清单](evidence/creator-exit-diagnostics-20261019/sha256.json)。
