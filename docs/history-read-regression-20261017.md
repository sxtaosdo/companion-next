# 运行验收后历史任务读取回归

状态：Accepted；本片接续2026-10-17父任务“继续无需新增UI审批、无需本地模型的既有功能修复/回归”。总功能差距仍以feature-parity-current.md为准，本文件只记录本片执行。

## 目标与边界

新Companion起点a74a7f24ff358b263e67a2bc860cbbe85998cc96 / 1.3.173.26，Vue3/TypeScript。已部署代码3074d37/.25、页面产品1.3.173不变。只复核已有历史读取/变体预览在工程HEAD前进后仍保留原任务来源和真实PNG，不造新功能或改UI流程。

隔离工程a79f4915296f4091现为c80b890/.18，已有新96资源的场景/Preview/Build/Smoke已另行实证；原任务STUDIO-RUN-icon-mvc3kj0s-b2d4ee94导入源796a233不能重标。只读原status、variant-preview与必要jobs；所有任务、PNG/meta与冻结UNKNOWN保持，不重导、不触发模型或Creator、不做真实问答。累计7458预算仍554154/1800000ms、active=null，不为本片启动窗口。

允许修改：本片测试/真实读取fixture、本文件、README/LOCAL_DEVELOPMENT和当前功能差距/原变体交接的准确状态段。业务src、依赖、部署和共享cocos-mcp并行22dirty先不改；若复现具体缺陷再精确记录最小范围。禁止game-ops-admin/7470/7471、启动/停止模型、云上传、push/tag/父pin、账号/安全权限变化。

## 阶段、验收和回滚

| 阶段 | 验收 | 状态 |
| --- | --- | --- |
| H0 | 核干净N HEAD与已有覆盖，记录本片边界 | 已完成；code-mapper未找到确切逻辑缺陷，不制造功能改动 |
| H1 | 原支持接口只读原任务，确认historyOnly.currentSourceRevision=c80b890而sourceRevision仍796a233、r6、变体原operation/收据/PNG SHA不变，原task字节保持 | 待执行 |
| H2 | 新真实响应经既有Next读取适配/解码/PNG SHA验证回归；同样验证错误任务/操作/收据仍拒绝，不调用网络或模型的离线测试 | 待执行 |
| H3 | 按影响测试、类型、reviewer/OCR；精确本地检查点，更新旧文档中的历史“未验”范围 | 待执行 |

若只读真实服务失败，保留准确错误，不改sourceRevision、任务或自动重试写入；普通可恢复测试故障只修测试入口/证据判断。成功读取不等于新UI流程或所有旧功能已迁入。

回滚只逆向本片新增测试/说明并新增W，不改任务、原导入资源、运行验收工程或共享服务。全部证据仅本地保存；没有新的运行进程应关闭。

下一步：执行H1，再用真实响应进行H2；无需新增UI或模型授权。
