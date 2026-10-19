# Creator所属进程退出窄修与根因审查

用户已明确允许旧宿主Creator退出窄修。执行前检查点。

计划只改creator-lifecycle.ts、必要的creator-process-stop helper、原stop调用处传递工程及限制fallback、定向测试。共享22项修改不入提交、不覆盖；基于当前已安装daemon源码图叠加构建。保留原KB持久引用、UNKNOWN2、Next静态资源及所有非任务修改。

验收：PID/创建时间/工程/可执行路径绑定，所属树退出确认后才stopped，失败保留身份；定向回归和独立审查后应用进程交接，fixture连续restart→restart→stop逐轮无残留。禁止系统重启、P1060、模型、历史数据搬迁、VS Code候选。
