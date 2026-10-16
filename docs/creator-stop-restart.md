# 停止 / 重启：原合同、保护与未核边界

0.1.15只增加正常工程模式的stop/restart源码，不修改后台、不实际启停。0.1.14正常模式候选已经独立冻结；旧readonly模式仍不注册Creator操作能力。全部能力不是全功能迁移完成。

## 已核与未核证据分开

父任务通过原维护线程确认v150两个POST路径（`/api/projects/:id/stop`与`restart`）、空JSON、RuntimeStatus响应、停止回执不证明退出，以及无Bridge而Dashboard报告运行时拒重启。沿用v150合同bundle SHA256 `39e88c9045e5d8266b059ce2b1ceb48cf522c5d0afc5f4596658c4545ae6641e`。

下列精确实现来自已物化、按SHA核过的**v148**，2026-10-15原维护线程已确认v150也存在两层Boolean转换；真实Creator返回值未观察，未执行stop/restart。精确行号/片段仍待父任务补齐，不能把源码核查当实机保存保护验收。本页不能将v148细节伪称v150已实证，更不能承诺后台已被改成强安全检查。

## 原stop

v148 `mcp/src/companion/creator-lifecycle.ts:193–208`：取当前PID或fallback PID；缺PID抛普通Error；调用未保存检查；true抛 `Creator 有未保存的 Scene 或 Prefab，已取消停止`；随后更新stopping并发送SIGTERM，ESRCH忽略，其他kill错误抛出；最后立即更新并返回 `{projectId,state:"stopped",launchSource:"dashboard"}`。它没有等待进程退出。

`companion-daemon.ts:149–156`实际将Bridge `creator.hasUnsavedChanges`结果用Boolean转换。查询调用抛错可阻断后续SIGTERM，但null/0/空串会被转换false，所以不能宣传“所有未知返回均失败关闭”。v150两层Boolean转换已另行确认，因此同样不能承诺非布尔未知值会拒绝。前端没有新增调用该检查，也不提供force/discard/skip字段。用户须先保存需要保留的Scene/Prefab；确认弹窗明确前端没有验证保存状态。

`companion-daemon.ts:330–343`对非“未保存”错误会尝试refresh Bridge并用其PID再stop。fallback非“未保存”异常可能被第一次无PID错误遮蔽；不根据原错误猜测实际未发生任何影响。

## 原restart

v148 `companion-daemon.ts:345–361`：先真实状态；ready时stop，再waitForStopped；非ready则查询Dashboard，若running则结构化409 `DASHBOARD_OPEN_WITHOUT_BRIDGE`、retryable:false，之后不继续强制打开。此前通过才start。

`creator-lifecycle.ts:211–212`及`dashboard-launcher.ts:110–117`中的等待仅是Dashboard报告running=false或条目不存在（默认10秒/250ms轮询），不是OS退出证明；进程枚举失败也可能影响Dashboard观察。等待失败会阻断后续start，无补偿回滚。v150这项内部实现尚未重核。

stop已发出而等待/重新启动失败时可能有部分影响，返回失败不能说工程保持原状。无总请求deadline；多个Bridge连接/查询、Dashboard等待/导入、启动等有各自预算，浏览器120秒等待上限不是后台总执行上限。

## 前端响应与安全边界

- 四个动作共用冻结工程id/name/path/版本与来源、快照revision、一次确认、传输单飞、离页取消等待和迟到拒绝。不会在后台失败或retryable:true时自动重放。
- stop只在最近已读ready/crashed/incompatible/error时可准备；restart额外允许stopped。缺状态/unknown/启动中/等Bridge/停止中先刷新。不要求前端PID一定存在，因为原后台有Bridge fallback。按钮可点击不等于已核安全，后台仍是动作权威。
- stop响应必须对应原工程且state=stopped；保留原回执，不写入卡片状态。弹窗明文“不证明操作系统进程已退出”，仍以另一次读取显示当前状态。
- restart响应只作为原RuntimeStatus回执，不补造ready或原进程已退出。
- 已核Dashboard无Bridge错误显示Bridge问题并要求新真实状态回读。相同DASHBOARD_OPEN_WITHOUT_BRIDGE也可能在重开后等待Bridge失败时产生，因此回执不猜是启动前拒绝还是已打开后失败；不把原API改成强制重启，也不承诺执行前后无副作用。
- v148普通未保存错误由 `http-server.ts:516`映射500 `{error}`，没有稳定UNSAVED_CHANGES业务码。v150精确原文未核。仅对stop/restart中合法普通500错误文本提到“未保存”提炼本地提示；仍保留UNKNOWN，不推导已安全取消，不回显任意后台HTML/路径/秘密，不伪造后端code。
- Bridge UNSUPPORTED/REVISION_CONFLICT等非本片已核结构化Dashboard错误保持未知，不猜保护是否已执行。前端停止等待不是后端取消。
- UNKNOWN或报告失败必须在该结果产生后发起并完成一次原工程真实状态读取，才可再次明确确认；旧在途GET不能解锁。刷新页面会丢失内存保护记录，不承诺跨刷新或跨tab幂等。

## 源码测试与真实验收

fake验证请求固定路径/空body、对应工程、stop回执形状、未保存提示UNKNOWN、无Bridge错误的阶段未知提示、并发/取消/晚回执/上下文变化以及读取屏障。它们测试前端行为，不测试旧后台真正发SIGTERM或安全检查质量。既有原v148测试仅覆盖fake clean/dirty/externalPID等局部；未声称已覆盖所有restart路径。

本轮不实际调用任何用户工程、模型、GPU、Windows或部署。v150真实保存检查返回、等待细节、真实浏览器/原生进程行为以及正常模式部署仍待明确验收。最终执行证据记录在 `validation.md`。


## 2026-10-15：v150精确只读补证

原维护线程核查实际v0.3.150 / 46ec45d部署，未执行stop/restart。`mcp/dist/companion/companion-daemon.js`（下称A）及同目录`creator-ai-bridge-bundle/dist/main.js`（B）：

- B21739：`Boolean(await Editor.Message.request("scene", "query-dirty"))`；A38938再做`Boolean(await new BridgeClient(connection).call("creator.hasUnsavedChanges"))`。B18559包装result，A28180返回response.result，并非对整个响应对象作Boolean。
- null / 0 / 空字符串 / undefined可能在插件层变成false而放行；对象/数组转true可能误拦。A28139限定JSON不修复这个转换，undefined在插件转换后已是合法false。真实Creator返回值没有观察。
- A32770–32785先dirty检查再SIGTERM，立即标stopped，不证明退出。A39128–39140失败可刷新PID重试检查，查询异常不直接绕过；没有force参数。
- A39142–39158在ready时stop、等待、经Dashboard重开，Bridge不可用但Dashboard运行时拒绝；未见原子文档revision复核。B19683–19689场景切换另用严格dirty===false，不能把这一保证移植描述到停止接口。

因此页面进一步明确异常空值可能漏拦，操作前自行保存。此补证只更新新前端风险说明，未修改旧插件/宿主逻辑；源码fake测试不等于真实保存保护通过。父任务保留本机maintenance-resume-20261015-034517.md/json核查证据，本dot任务没有读取Windows或重复运行检查。
