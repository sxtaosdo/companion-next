# 知识库原管理iframe恢复（2026-10-17）

状态：Accepted。接续用户已批准旧功能迁移与管理iframe中既有API可接部分；本片只恢复知识库，不启动服务/Creator/模型，不写客户端配置。

基线d471aa8/.36；运行Next9a6e952/.35、PID4092，旧仓22dirty保护。旧web/src/app.ts:showKnowledgeRunning（约2900–2922）在running/frameable为true时将#knowledgeServiceFrame.src设为固定http://127.0.0.1:8081/，否则移除src并显示原固定外链；旧index.html约111带title本机知识库、referrerpolicy=no-referrer。原CSS .model-frame为全宽、高度min(820px,100vh-220px)、min-height480px。

Next已有GET /api/knowledge-service/status的running/frameable解码、显式本机服务状态读取、状态/来源/路由清理、UNKNOWN锁及不可嵌外链；但LocalServiceControls未实现frameable分支。这是确定缺口，无需新增API。只改该组件与KnowledgeReadView实际能力描述、对应UI测试/更新记录及本文件。使用既有显式状态按钮后，仅正常workspace已有provider、知识库页、明确运行且可内嵌、无UNKNOWN时渲染固定URL iframe；不借响应提供任意URL。刷新/失败/停止/离页/来源或模型页切换销毁frame，不用旧快照证明当前运行。

安全验收：离线mock覆盖条件/失败/迟到/来源/UNKNOWN与模型页无frame。现有32180独立认证Edge的状态GET及8081 frame导航均拦截隔离，不给真实8081发请求，不起监听/模型。若真实既有状态不可达，如实记录，不为验收启动服务；不验证知识登录/检索/问答/管理写操作。阶段完成按既有六静态备份、保留hash、原子入口流程部署并核SHA与独立Edge，不关闭用户窗口或重启服务。

五步接入核对：现有四来源、登记及独立setup已在；原选工具范围、单独安装/启动、可跳过多Agent、完成示例分步与当前完整setup存在差异。Next provider.start固定完整安装/启动/Codex，旧后端复用任务不保证本次false选项，不能只加步骤外观便称完整迁移。真实安装/持久客户端配置按本轮限制不执行。MCP只读GET缺口继续保留，不调用注册POST探测。
