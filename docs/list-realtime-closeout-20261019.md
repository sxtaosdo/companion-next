# 工程列表与局部实时更新：限定主流程收尾（2026-10-19）

结果：**第12项限定主流程通过；第3项列表交互通过，当前真实状态同步仍待验。** 没有发现需修的代码，不为完成率改UI或宿主。既有7项通过口径不动，本批只新增第12项，当前固定21项为8通过/11部分/2暂停阻塞，等权38.1%，不是工作量比例。

## 第3项：具体已验与唯一保留边界

准则限定为登记数据对应、名称/ID/路径搜索、无匹配/清除、状态显示/筛选、ready默认展开/stopped默认折叠、同页状态快照更新保留手动选择。无需穷尽全部异常和所有时序。

- 混合真实页面：现有后台真实7条登记与UI的ID/名称逐项匹配，只对任务自有fixture搜索/展开折叠/清除。真实registry/counts GET、登录POST1次，业务写0；本地筛选/折叠不新增API。截图仅目标卡片且路径遮罩；没有保存完整registry或其他工程原路径。
- **实际/api/status请求0次**。当前安装包listStatuses遍历所有登记→resolvedStatus/router.refresh→BridgeClient creator.projectInfo，包含暂停的P1060。本轮在浏览器上下文本地返回状态503，UI正确显示未知；不能把它说成当前真实状态同步验收。
- 全模拟已部署静态字节：ready/stopped/unknown区分、搜索/状态筛选/清除、默认折叠、同页快照更新保留手动折叠通过。脚本有page.reload，但新默认恰与原手动选择相同，**不能独立证明整页刷新/跨路由持久化偏好**，未计为通过。
- 2026-10-18真实ready状态→UI证据继续保留；adapter/domain/排序/状态标签未改，但读取生命周期和store后来改变，因此不强行据旧证据关闭“当前真实状态”。后续仅需允许状态探测的实机窗口；不为了凑通过启动Creator、调用P1060或增加宿主接口。

[真实登记混合页证据](evidence/list-realtime-closeout-20261019/project-list-registry-proof.json)、[模拟交互证据](evidence/list-realtime-closeout-20261019/project-list-simulated-proof.json)、[脚本](evidence/list-realtime-closeout-20261019/project-list.mjs)。首个受限环境Edge启动失败时未发API，后使用已有宿主Edge/pipe完成；没有安装或新增监听。

## 第12项：有限主流程证据链闭环

准则为同来源显式启用后的局部更新、离页/隐藏暂停、返回自动恢复单流、主动停止意图保留，以及有限网络失败后的新快照补读。不要求原协议不具备的事件重放或无限期零丢失。

- **既有真实证据复用**：81ea56c/.92实机启用→概览/帮助→返回自动open，最大活动流1，返回projects/status/counts/events各1；主动停止后往返仍off，业务写0。原回执SHA绑定并原样留存，没有重跑真实流。
- **已有.131真实有限恢复**：4个唯一标记、断流期间第4条未被stream接收而由新快照补齐，来源筛选/恢复期间停止通过。引用[原真实日志证据](knowledge-sse-live-20261019.md)，本轮不再制造任何日志或业务失败。
- **新离线DOM观测，仅一次browser-run**：已部署原HTML/JS/CSS由本地route提供，HTTP/EventSource全模拟；一次状态快照和一次日志提示后，同document、控件/卡片/日志节点、焦点与两个搜索/筛选输入值保留，12断言为true；document请求1、navigation entry1。顺带观察返回单流、主动停止不恢复。不是所有表单草稿保全，也不是当前真实live调用投递。
- 当前源码与已部署ecabe7e/.131全部src无diff，关键5文件SHA及既有真实回执绑定在[连续性审计](evidence/list-realtime-closeout-20261019/realtime-audit.json)。独立只读复审认可限定关闭；没有重复跑旧135/410项或重新构建部署。

[新DOM证据](evidence/list-realtime-closeout-20261019/realtime-dom-proof.json)、[专用脚本](evidence/list-realtime-closeout-20261019/realtime-dom-probe.mjs)、[复用真实导航回执](evidence/list-realtime-closeout-20261019/real-navigation-reused.json)、[SHA清单](evidence/list-realtime-closeout-20261019/manifest.json)。长期稳定、环形淘汰后的补齐、全部事件零遗漏、真实livecalls仍未验，不当作本项无限延期门槛。

## 本轮未触碰

两条浏览器路径均关闭自有Edge，用户窗口未动。混合页前后PID10820/epoch相同、OPEN、nativeAwaiting/Uncertain0、历史UNKNOWN2。没有全局状态或Creator/模型动作、P1060操作、真实客户端配置、项目文件写入、业务数据库迁移/备份、服务重启或宿主部署。VSCode dacb89b/0.3.148继续保持未部署；Owner草稿继续暂停。
