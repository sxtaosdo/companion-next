# Preview / Profiler 原入口恢复（2026-10-18）

状态：Accepted。403已按原正式会话流程恢复（7df480c/.46），现继续已批准的旧入口恢复。只写Next，不改旧Companion，不启动真实Creator/模型、非loopback监听，不执行真实Preview或Profiler。

旧app.ts:587、612、1840左右：ready卡片提供预览start（target=browser）、probe、status、reload和Profiler采集（operationId=web-profiler时间戳）；聚焦/停止/重启是已有Creator生命周期，Preview.stop虽有后端路由但Creator3.8.8无官方stop，不新增按钮。结果以JSON文本展示/隐藏，Profiler区分待命、采集中、采集成功/失败，不把回执冒充真实运行。

运行daemon静态路由companion-daemon.js:37181及源http-server.ts:430–450已有POST /api/projects/:id/preview/(probe|start|status|reload|stop)与/profiler/capture，经managementCall按工程转发。Preview回执是protocol.ts PreviewStatus（available/running/stopSupported等），Profiler为profiler-evidence-v1，含statusHint/evidencePath/metrics/findings。现服务字节不改。

计划：在Next独立有界同源适配、内存store和卡片组件恢复5按钮及文本回执；普通模式才注册，Creator真实ready且来源/登记匹配才可点击，复用项目操作lane，不自动请求/重试。换源/换工程/离开取消等待并拒绝迟到结果，未知结果不自动重放。测试用固定隔离响应验证请求合同、权限条件、互斥、脱敏和失败；串行类型/构建、本地只读review后既定静态发布与隔离Edge。真实Creator运行验收明确留空。


## 本地验证与当前边界

四文件330项（适配/UI/Creator共享lane回归/原工程UI）单worker通过；帮助/普通与只读模式三文件46项通过。严格类型通过，静态56项55通过/1Windows大小写碰撞fixture跳过。workspace构建通过，保留原chunk体积提示。帮助状态同步发生在首构建后；一次文案精确匹配失败导致额外串行构建，最终说明已按准确topic更新并重建，未并行压力构建。初始严格类型提示一个未使用import和状态fixture缺capabilityProfile，已修正。

独立只读review发现并修正UNKNOWN跨收起/离页保护：屏障与结果展示分开，同连接会话下收起、离页或其他工程变化不解除。取消在途请求同样建立屏障；仅新登记/操作来源或重新连接后才能重新核对。物理清理前不释放共享lane。修正后复核无具体发现。外部OCR因前轮自动审批拒绝而未重试，不声称通过。

成功后恢复原refreshProjects/计数局部读取，保留日志，不整页刷新。ready条件不等于运行验收；本片真实Preview/Profiler/Creator启动全部为0。

## 部分安装与五客户端只读合同核对

setup-service.ts:50–60按activeByPath复用任务，复用前不比较startCreator/configureCodex；SetupOperation不回显选项。http-server.ts:394–410支持POST /api/setup传false，但GET /api/setup/:operationId仅读旧快照，无法证明“严格只装Bridge且不启动/不写Codex”。因此不以新勾选项假称严格保证，不调用真实安装。

http-server.ts:456–465与v1的mcp/register只支持POST，target为codex/cursor/trae/kiro/vscode；未找到客户端配置状态GET。项目/daemon状态GET不等于这五种持久配置的读取证据，不能调用register写入来冒充查询；本轮配置读写均0。后续若需补齐安全读取合同，须先提修改旧后端的方案，当前只改Next边界下不自行扩展。
