# Next预览、刷新及Profiler真实验收（2026-10-18）

状态：Accepted。本轮目标已完成；不代表整个旧后台迁移全部验收完成。执行前检查点 `96e9596 / 1.3.173.99`，回执保留修复与实际静态部署 `3815f19 / .100`；daemon未重启。本批没有操作模型或知识服务。

## 授权和实际前置

用户在2026-10-18 07:37:26 UTC明确回复“准许”临时切换至现有隔离工程，实际测试预览和性能分析，结束恢复原工程；10:03:50 UTC说明重启Codex并要求再试。本轮自动审批已放行，旧的缺授权拒绝不再作为待办。

首次实查原工程68a5dccc481a8588、隔离工程a79f4915296f4091均state=error、无PID，也无Creator进程或预览监听。因此没有假称初始“未保存检查通过”；没有活实例可查其内存状态。后续恢复和正式切换的实际实例均通过Bridge查得未保存=false后才停止。

## 实际通过项

| Next实际入口 / 操作 | 原回执及可见结果 | 验证边界 |
| --- | --- | --- |
| 预览启动 | 原POST200，available=true/running=true，session与fixture23032一致；成功回执留在页面。实际本机画布可见且pageErrors=[]，截图可见隔离资源图标 | 原返回本机LAN地址已按OS网卡确认；自有验证页用127.0.0.1访问同一7456，不改原服务地址或安全设置 |
| 刷新 | 原POST200，running=true、connections=1，返回同一fixture session；成功回执可见 | 证明实际按钮→原reload IPC链；未单独录制默认OS预览页的DOM重载事件计数，不以此断言所有浏览器的刷新效果 |
| Profiler采集 | 原POST200，UI“采集成功”和JSON结果持续可见；原evidence-v1文件存在并读回 | 原采集默认warmup3秒、采样15秒，848样本，findings=[]、consoleErrors=[]；只代表本次隔离场景采集，不等于生产工程性能验收 |
| 结束恢复 | fixture原stop200，停止前unsaved=false且进程已退出；临时server profile恢复原完整bytes；原工程原start200后ready，PID18252/session e04e7299，unsaved=false | 当前对外预览仍为原::7456；fixture无活进程，原实例PID变化属于明确授权的恢复 |

Profiler摘要：平均FPS约56.55；frameMs平均0.473、p95约0.700；该采样窗口overBudgetCount=0。原证据SHA `bea4715475a0c42f0192544cdccc333fbe5d60e308042f54aa4f6ab26acba147`，848样本与回执一致。指标仅属于此次环境与场景。

## 已解决的失败与未执行分支

1. 测试客户端首批生命周期请求漏Origin头，被原同源安全检查403拒绝，未执行启动。保留该回执，补齐合法同源请求头；没有改变后台校验或权限。自动审批本轮没有再次拒绝。
2. 首个有效fixture启动自身沿用历史profiles/v2/packages/server.json的server_port7458，**确实短暂出现::7458监听**。守卫在任何Next按钮前发现，立即通过原接口停止干净实例17144，并恢复原工程23828。该轮预览、刷新、Profiler均未执行，不能宣称整批从未出现过7458。
3. 找准该本地profile后，完整备份并临时仅将fixture端口改为7456复用原范围；并非把绑定改为回环。后续检查同时核对原允许地址、7456及本轮实际Creator PID。原业务工程profile、安全权限、全局网络设置均未改。最终profile恢复原SHA `2bf78c603be78c9b070891c15ac07bc62403703c3e23a2f73d271e9d5ecfc44a`；恢复的是原历史配置，当前fixture已停止。
4. 修复前的下一轮Next预览原POST200/running=true，但成功回执被自带工程刷新清掉，截图确无结果。原store在成功后调用refreshProjects(true)；额外状态读取一旦失败/快照变化，会触发现有fingerprint失效并清结果，ready-only组件卸载也可再次清结果。只读code-mapper确认该路径；旧运行未捕获具体触发字段，不能把lastCall、计数或某一状态字段猜成已证根因。该轮验证脚本还误拒本机LAN URL，故刷新/Profiler未执行；已干净停fixture、恢复profile与原工程20540后再推进。
5. 最小Next修复仅去掉成功后的多余Creator状态重读，保留调用统计刷新及全部既有来源/路径/PID/session/instance/UNKNOWN/离页保护。新增回归在旧实现失败，修复后UI+adapter共41项通过；严格类型、实际workspace构建及离线候选构建通过（原大chunk提示），真实reviewer无P1/P2。已同步前端权威更新记录。
6. 静态部署只新增新hash JS并原子切换Next index，保留全部旧hash资源和完整回滚备份；正式认证六HTTP文件SHA验证通过。之后正式Next启动/刷新/Profiler各一次均通过，未重跑预设或Preview探测/状态。

## 保护和长期证据

最终核对：旧后台HEAD/status、22项原脏文件、暂存/未暂存补丁不变；隔离工程69个已跟踪文件、7项原修改及补丁不变；原工程1053个已跟踪文件、226项原修改及补丁不变。这里不包括Creator正常的ignored缓存/窗口布局，不能扩展为整个磁盘字节不变。临时fixture server.json另外逐字节恢复。原daemon20116/epoch613ef7f2、bundle SHA35225eb5及CLI SHA6085072c不变；六静态文件仍匹配部署SHA。

原WindowsCompanionUI、旧生命周期实现、业务场景/prefab/meta均未修改；无安全权限、安装、MCP配置、模型/知识操作、推送或发布。只关闭自有headless浏览器，保留原Creator及用户窗口；原预览动作正常打开的默认浏览器窗口未用进程级清理关闭。

- [真实回执、失败分支、部署及保护摘要](evidence/preview-profiler-approved-20261018.json)
- [完整原Profiler evidence-v1](evidence/preview-profiler-capture-20261018.json)
- [Next成功回执截图](evidence/preview-profiler-next-ui-20261018.png)
- [实际隔离画布截图](evidence/preview-profiler-canvas-20261018.png)

完整原始脚本、快照和旧失败截图保留在 `C:/Users/33272/AppData/Local/Temp/companion-preview-approved-20261018/`；长期JSON记录每份原始证据SHA。后续审查仅核对这批结果，不再重复已通过的实机动作。

收尾真实reviewer已只读核对最终三项回执、恢复、保护、完整capture与截图SHA，未发现P1/P2或越界结论；未修改文件或执行实机动作。实际只读权限隔离未验证；本轮沿用既有角色会话，未额外覆盖模型配置。
