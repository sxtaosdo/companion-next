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
| H1 | 原支持接口只读原任务，确认historyOnly.currentSourceRevision=c80b890而sourceRevision仍796a233、r6、变体原operation/收据/PNG SHA不变，原task字节保持 | 已通过，两项真实业务读取200，三task字节保持 |
| H2 | 新真实响应经既有Next读取适配/解码/PNG SHA验证回归；同样验证错误任务/操作/收据仍拒绝，不调用网络或模型的离线测试 | 已通过，新文件3例；错误任务/操作/收据复用原既有边界覆盖，共82项 |
| H3 | 按影响测试、类型、reviewer/OCR；精确本地检查点，更新旧文档中的历史“未验”范围 | 82项/strict类型通过、reviewer与OCR宿主审读完成；代码fb4842d/.28，说明本次提交 |

若只读真实服务失败，保留准确错误，不改sourceRevision、任务或自动重试写入；普通可恢复测试故障只修测试入口/证据判断。成功读取不等于新UI流程或所有旧功能已迁入。

回滚只逆向本片新增测试/说明并新增W，不改任务、原导入资源、运行验收工程或共享服务。全部证据仅本地保存；没有新的运行进程应关闭。

本片已完成，未发现需更改业务src的确切缺陷。真实H1使用原SDK的/v1支持接口；H2将其原响应注入Next既有/api适配，只是离线回归，不冒称Owner资源页面真实点击。新增3例分别验证来源/当前HEAD分离与全部写屏障、真实彩色PNG经有界适配验SHA、拒绝重标来源。原79项提供错误身份/操作/收据、取消/超时等边界，未声称新增这79项。未改src、依赖或部署，沿用既有3883完整回归；本片不为测试/说明重新构建产品。

首轮Vitest因沙盒Temp缓存rename EPERM，0用例执行；测试误用node:fs类型，已改用既有resolveJsonModule导入，不改TS配置/依赖。正常授权宿主只重跑同一3文件，82/82通过，vue-tsc --noEmit退出0。新JSON文件CRLF导致diff --check拒绝，已仅归一为LF并断言JSON内容不变，再精准提交；原服务回执SHA对应原始E文件，不受fixture格式影响。

## 开发者后台打开与3595协调

用户随后要求“开发者后台启动下”。10:40 UTC原127.0.0.1:32180/PID4092仍由Node25运行，未重复实例或重启。正常creator-ai ui返回PASSED/opened=true，再打开正确Next地址`http://127.0.0.1:32180/next/index.html`。独立正常认证Edge实际渲染200，页面1.3.173、部署源3074d37/.25，六HTTP资源SHA一致，pageError/consoleError/意外业务写均0；核验浏览器关闭，用户要求打开的窗口保留。没有读取用户浏览器内容或导出Cookie/auth code，不以此称Owner业务操作验收。

只读协调发现3595无监听、当前Creator0；32180是独立Node25 Companion daemon，SDK发现仍32180。P1060登记存在，经32180查询为error，原文“Creator Bridge不可达；当前文档和进程状态未确认，请先查询日志”。本代码的项目Bridge由对应Creator及其connection/session身份绑定；当前源没有固定3595配置，无法仅凭当前无监听断言历史3595归属。若要恢复项目Bridge，由原项目线程走批准的Dashboard启动并核验，而非重启当前32180或另起3595。本片没有启动任何项目或新端口；读取时用户页面可有普通HTTP在途，不能把它称为完全idle。UNKNOWN空、各写操作/Build/setup/sidecar计数0。

本地回执见[evidence/history-read-regression-20261017.json](evidence/history-read-regression-20261017.json)及Temp `companion-variant-runtime-20261017`。下一待办仍是主差距清单中的真实Owner功能验收和需确认的新UI流程；本地模型不继续启动，已有资源实证不扩大到整产品完成。
