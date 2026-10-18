# Preview / Profiler 原入口恢复（2026-10-18）

状态：Accepted。403已按原正式会话流程恢复（7df480c/.46），现继续已批准的旧入口恢复。只写Next，不改旧Companion，不启动真实Creator/模型、非loopback监听，不执行真实Preview或Profiler。

旧app.ts:587、612、1840左右：ready卡片提供预览start（target=browser）、probe、status、reload和Profiler采集（operationId=web-profiler时间戳）；聚焦/停止/重启是已有Creator生命周期，Preview.stop虽有后端路由但Creator3.8.8无官方stop，不新增按钮。结果以JSON文本展示/隐藏，Profiler区分待命、采集中、采集成功/失败，不把回执冒充真实运行。

运行daemon静态路由companion-daemon.js:37181及源http-server.ts:430–450已有POST /api/projects/:id/preview/(probe|start|status|reload|stop)与/profiler/capture，经managementCall按工程转发。Preview回执是protocol.ts PreviewStatus（available/running/stopSupported等），Profiler为profiler-evidence-v1，含statusHint/evidencePath/metrics/findings。现服务字节不改。

计划：在Next独立有界同源适配、内存store和卡片组件恢复5按钮及文本回执；普通模式才注册，Creator真实ready且来源/登记匹配才可点击，复用项目操作lane，不自动请求/重试。换源/换工程/离开取消等待并拒绝迟到结果，未知结果不自动重放。测试用固定隔离响应验证请求合同、权限条件、互斥、脱敏和失败；串行类型/构建、本地只读review后既定静态发布与隔离Edge。真实Creator运行验收明确留空。
