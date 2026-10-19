# 停止展示最小修复：操作前检查点（2026-10-19）

原后台同样会在正常stop后将Bridge不可达显示异常；根因是宿主丢失停止因果，非Next特有状态回归。Next只在同项目/同来源、成功stop回执、结果之后开始的新读取、通用Bridge不可达且无新PID/session的限定场景显示“已请求停止”，保留raw error和原说明，不宣称OS退出。不改真实状态、筛选、操作保护或接口；新运行观察/其他动作/来源与会话变化后撤销提示。

子进程根因在旧宿主mcp/src/companion/creator-lifecycle.ts stop193–208，仅kill主PID并立即返回；restart只等Dashboard运行标记。最小产品修复需要该文件和生命周期测试，可能复用或新增小范围Windows进程终止helper；此前明确禁止旧宿主生命周期修改，本批先报告具体范围、不擅自改共享22文件或装载候选。

两项独立只读分析已实际并行：stop_display_review与creator_child_review。当前Creator0，原服务4264/0.3.147 OPEN；后续仅修Next展示，定向回归及静态部署串行，再按原自有fixture实机一次，不重复KB。

候选实现：仅Next三个源码文件（creator-operations.ts、ProjectStatusTag.vue、CompanionBrowserView.vue）增加展示上下文，两个现有测试文件补充回归。精确结果之后的新读、同session/provider/projectKey，raw error和lastError保留；新PID/session/version、项目身份A→B→A、来源/会话变化、新操作或其他错误永久撤销。三文件334/334、vue-tsc无错误；独立复审P2边界修复后未见剩余P1/P2。尚未部署/实机，后续统一静态装载后仅启动→停止一轮。
