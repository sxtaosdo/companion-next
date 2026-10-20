# 新旧Companion：Vue迁移验收矩阵

2026-10-20范围纠正：本矩阵判断页面、按钮、导航、参数、返回状态和错误反馈的迁移，**不要求继承宿主、Cursor或模型业务全部重新运行**。此前13/6/2混合了前端与业务集成，不再作为Vue完成度；不换算新的总百分比。

本轮三处实际交互缺陷已修复并以源码3438b08/检查点1.3.173.175完成本机Next静态交付。下表结论限已核主流程，既有通过证据复用须保持源码连续性；隔离证据不会冒称真实业务通过。

| # | 旧功能组 | Vue迁移证据结论 | 证据与宿主边界 |
| --- | --- | --- | --- |
| 1 | 帮助/关于/版本/历史 | 入口、原文、复制/换行、分类及版本信息已核；帮助工程保持缺陷已修 | help-about-navigation、help-project-context-navigation；外部客户端接收不是门槛 |
| 2 | 概览默认真实工程 | 已核默认首个真实登记工程、显式工程与无效工程保护 | registered-project-views、既有7工程真实证据 |
| 3 | 工程状态/筛选/折叠 | 已核状态显示、同页更新、未知态与折叠保留 | companion-browser-ui、既有真实状态/SSE证据；不等于Creator业务全部可用 |
| 4 | 添加/导入/登记/脚手架 | 已核页面来源、目标参数、确认与取消/迟到保护 | project-setup-ui、project-directory及既有脚手架证据；本轮不写真实工程 |
| 5 | 安装向导四组合 | 已核00/10/01/11的Vue选项、请求、完成/错误/UNKNOWN分支；B卡路径混杂已修 | 本轮66项相关UI/目录回归；生产01/11另列宿主集成 |
| 6 | Creator控制入口 | 既有原启动/聚焦/停止/重启按钮及参数/回执/错误合同保留 | creator-operations已有合同及真实生命周期证据；本轮不操作Creator |
| 7 | 打开目录/移除登记 | 既有目标工程与确认/取消合同保留 | 原真实导航/隔离登记移除证据；不需要本轮删除真实登记 |
| 8 | Preview/刷新/Profiler | 既有按钮、ready门禁、原参数和返回反馈已核 | preview-actions及既有真实Preview/848样本；本轮不启动引擎 |
| 9 | 日志筛选/暂停/滚到底 | 已核筛选、手动读取、暂停/恢复及滚动合同 | companion-browser-ui、live-store及既有真实SSE/滚动证据 |
| 10 | 日志清空/导出/诊断 | 已核确认范围、取消、精确DELETE参数及错误/未知回执 | log-tools-ui/adapter与旧app参数对照；真实清空禁止只影响业务验收 |
| 11 | 调用记录/分页/详情 | 已核50+1、失败50+16、防重复、错误恢复、旧回执丢弃；中文标签已修 | 4个新DOM→adapter→store场景；真实失败详情/静态交付页面已核；自然51不是前端门槛 |
| 12 | 局部实时更新/恢复 | 已核同页/离页、单流、状态和焦点保留等限定合同 | live-store、network-recovery及既有真实SSE；未承诺长时零丢失 |
| 13 | CLI说明/复制/交接入口 | 已核原提示、绑定工程、换行/复制/关闭及明确点击交接合同 | cli-use-ui、agent-handoff及既有证据；Cursor启动/对话/额度完全移出迁移门槛 |
| 14 | 客户端MCP登记UI | 已核五目标chooser、单独确认、原endpoint/body和回执/错误处理；旧/Node+JS格式兼容已部署 | project-connections；旧宿主writer缺陷独立记录，未部署候选 |
| 15 | 工具目录/范围/预设 | 已核目录/草稿/CRUD/导入导出/工程范围；帮助分类工程保持已修 | help-project-context-navigation与既有真实工具范围证据 |
| 16 | AI资源六步/任务/编辑/导入 | 已核既有主要入口和UI/请求/错误合同，既有资源读回与导入证据保留 | 本轮资源UI回归与96变体专项；不外推未穷尽高级分支或真实模型生成 |
| 17 | 工程资源库存 | 既有真实工程绑定、只读库存和汇总对应已核 | registered-project-views与既有733项实际读取；733不是固定当前值 |
| 18 | Owner窄入口 | 已批准预览/选择/保存限定迁移证据保留 | 既有真实窄入口；独立图片工具扩展和旧数据搬迁已排除 |
| 19 | KB列表/文档/分片/原文/搜索 | 既有读取入口及adapter/store/UI合同已核 | knowledge-read既有合同、原reader真实限定证据；不声称全库/写入通过 |
| 20 | Agent/会话/问答/同步 | 已核旧页面对应入口、字段、会话、取消/UNKNOWN和跨功能互斥 | 本轮Agent/会话/sync UI及源码连续性；真实对话/同步按用户暂停，非Vue失败 |
| 21 | 模型服务/管理面板 | 已核原启停合同、状态反馈与8081/8090原面板生命周期 | local-service-operations-ui、既有模型页证据及源码连续性；本轮不启停/切换模型 |

真实集成缺口及宿主独立缺陷统一见[既有跳过项文档](skipped-and-open-issues-20261020.md)。本轮没有修改旧宿主writer、操作Cursor、模型、Creator或清真实日志。

当次证据：[Vue根验收](evidence/vue-root-20261020-0718/source-verification.json)、[安装](evidence/vue-setup-20261020-0718/result.json)、[分页与日志](evidence/vue-history-20261020-0718/result.json)、[导航](evidence/vue-navigation-20261020-0718/result.json)、[Agent/模型UI映射](evidence/vue-model-ui-20261020-0718/audit-result.json)、[静态交付](evidence/vue-root-20261020-0718/delivery-summary.json)、[部署后页面](evidence/vue-root-20261020-0718/browser-result.json)。历史真实业务记录见migration-status-21-20261019.md，按原时点和范围阅读。
