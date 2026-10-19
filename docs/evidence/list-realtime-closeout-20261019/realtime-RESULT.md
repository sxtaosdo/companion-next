# #12局部更新/跨页恢复：有限离线DOM补证

2026-10-19。仅模拟DOM行为，不新增真实SSE、登录或业务请求。仓库源码/docs未改。配合独立realtime-audit-20261019/audit.json中既有真实导航/SSE和ecabe7e源码连续性，用于有限主流程收口，不将模拟事件冒充真实投递。

已部署安装目录Next静态字节由route.fulfill原样提供，每个文件SHA记录在dom-proof.json；所有HTTP API完整模拟；EventSource在自有Context初始化为EventTarget实现，无原生连接。Playwright msedge headless禁GPU、pipe，无新监听。首次运行通过，自有browser正常关闭，用户窗口未触碰。

实际观察：
- 工程状态从模拟stopped到error的一次正常3秒后台快照更新：document对象/文档token、搜索input节点、工程card节点、原停止按钮节点均保持；搜索input焦点与本地草稿“模拟 DOM”保留。未把旧ready展示当最新。
- 日志一次模拟compile/warning提示→原adapter触发GET快照更新由1条变2条：document、关键字input、日志pane、原第一行DOM均保持；输入焦点和“DOM_KEEP”草稿不丢。此处草稿未点击手动查询，既有实时筛选队列仍按原行为可读取；不声称字段值从未影响任何筛选请求。
- 内部RouterLink离开帮助：所有模拟流关闭，无额外后台API；返回工程只新增一条模拟流。主动停止后再帮助往返保持off，没有再建流。
- 整段仅初始1次document请求，performance navigation条目1，文档token不变；最大同时活动流1，最终活动流0。

statusDOM及logDOM的12项节点/焦点/草稿断言全部true；blocked=[]、pageErrors=[]。actualNetworkRequests/sessionPosts/realSseRequests/businessWrites均0。

截图simulated-local-log-update.png已查看，内容均为明确合成fixture。可复现脚本dom-probe.mjs，精确请求/静态SHA/断言见dom-proof.json。

限制：本片不证明当前真实服务产生日志，不验证全事件零遗漏、环形淘汰后的补回、真实live调用或Creator/模型。主流程的真实已验部分仍引用原real-sse-http-proof.json和knowledge-sse-live log-live-proof.json，不能用此模拟回执替代它们。
