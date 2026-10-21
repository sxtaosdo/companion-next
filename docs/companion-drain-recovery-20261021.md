# Companion 停止失败后的准入恢复候选

状态：隔离候选；未部署，现场尚未恢复。

## 根因与最小修复

安装包内的 lifecycle-drain.ts 在停止失败后复用严格停机 idle 判断恢复业务准入。两条历史 NATIVE_PRIOR_EPOCH_UNVERIFIED 因此让当前工作全部归零后仍永久停留 DRAINING。

候选仅增加单独的准入恢复判断：当前工作计数均为零、停止未进行、观察及验证均已结束，仅允许历史未确认原因。原 idle、guardedStop、退出证明、身份与 generation 防护不变；不清理历史 UNKNOWN，不授予退出许可。

## 验证与交付

- 安装 source map 提取的真实类：原版复现、候选恢复、停机仍拒绝及边界测试共 18/18 通过。
- 独立只读复审未发现确定 P1/P2。
- 隔离 Git 检查点：`7508ddbb5748ae6822d47be2dc64e21719e43786`。
- 目录：`C:/Users/33272/AppData/Local/Temp/companion-drain-recovery-20261021`，含原源码、candidate.patch、来源 SHA、测试、应用与回滚说明。
- 完整 daemon 隔离打包未通过：安装 map 缺少 `src/companion-mcp.ts`、`src/companion/tool-profiles.ts`、`src/companion/types.ts`。未从共享脏工作区拼接，也未用 stub 掩盖。

已限定核对现有 Git 历史：安装 map 指向 companion-client-rollback-fix-20261019 临时工作树；其记录提交 dacb89b 在归一换行后仅 74/85 个嵌入项目源匹配（原字节精确匹配 6/85），当前 main 6ff44f5 为 54/85，已知修复提交 2994d14 为 56/85。不存在已证明匹配的完整安装源码版本，因此没有从任一提交复制缺失文件混入。安装路径与旧 package 版本均不足以证明可重建版本；此次仅核对三个已知候选，没有穷尽全部 Git 历史。

## 现场边界

复核仍为原 PID 21872 / epoch aff8b2a9-97a7-4e58-a6b8-4d9fe1a2d5fe；普通业务返回 DAEMON_DRAINING。两条历史 UNKNOWN、零条退出证明保持原样；批准的离线绑定尚未在新进程生效。

当前进程没有公开恢复准入或热加载接口。官方停止证明已以 UNKNOWN_CONTEXT_COVERAGE 拒绝，不能重试同一动作或伪造证明。磁盘源码修复不会改变已加载的进程。当前批准范围排除强杀、注入、改数据库和整机重启，因此现场应用仍阻塞；需要先确定合规的进程替换路径及完整宿主构建来源。

本批未修改共享旧宿主源码、安装文件、数据库或进程，也未启动模型。

2026-10-21追加只读取证：安装版本OS采样与可信anchor比较为同机器、同kernel boot、不同System进程生命周期；退出验证要求后两者均不同，当前条件不满足。没有人工取消历史aggregate或公开resume入口。保留inflight/native-history与候选，由宿主维护方提供匹配完整源码和保留历史UNKNOWN的正式准入恢复及应用方案；当前没有获准的现场替换路径。未再次调用stop/proof/reconcile。

补充来源定位：已从既有修复回执确认当前70df daemon和a37eab map的安装来源，原build-candidate.mjs仍可只读取得；它依赖的companion-client-rollback-fix-20261019/mcp工作树及三份fallback源码已不存在。既有归档仅6份overlay，没有三模块的原源码hash/快照；不能运行限定旧71cb baseline的脚本冒称当前可重建。所需维护输入是该次构建的完整工作树快照或权威同版三模块及构建输入清单，再于隔离环境逐字节复现70df后考虑已审补丁。取证摘要及历史脚本已归档至[evidence/resource-flow-20261021/maintenance](evidence/resource-flow-20261021/maintenance/)。
