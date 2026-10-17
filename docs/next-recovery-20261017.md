# 2026-10-17 中断恢复与本片部署回执

状态：Accepted；本机已交付，未推送、打标签或更新父仓指针。

后续02:00 UTC增量：独立fixture已完成单张96×96变体真实导入、UUID/元数据回读和正常关闭；原sourceId、旧UNKNOWN及Next产物均保持。7项离线检查与后续场景/Preview/Build清单见[隔离资源验收](isolated-variant-acceptance-20261017.md)。目标已获准，新监听窗口待协调；下文“未导入”仅描述00:37 UTC恢复切片的历史状态，不代表最新结果。

本轮只完成此前已批准的创建/初始化切片部署与资源接口恢复验证，没有增加UI范围、安装依赖、修改旧Windows Companion源码或四后台产物，也没有执行关机。

恢复只读核对确认昨晚静态部署派发及结果标记均不存在，旧入口SHA为`74ff66517075dc484dd73dfea2dcbab92487fafdee4684a02e1b01f15e83e922`；本轮没有把昨晚断连当成成功。daemon当时ECONNREFUSED。Next HEAD仍为`5419ace06f5f25f4a3f4300dcfab2a85255edc68`（`1.3.173.11`）。335份跟踪文件中仅README全零，33534字节Git索引也全零，其余334份及封存功能输入、构建六产物均匹配。

先保存损坏README与索引原件，在私有索引上从固定HEAD重建并比较；确认唯一差异README、无暂存/未跟踪并行工作后，以原哈希CAS和独占index.lock仅恢复这两个路径。335份跟踪文件最终全部匹配HEAD，Git工作树/暂存区干净，锁释放；没有reset、清理Owner工作或覆盖其它文件。损坏原因本轮没有诊断或推定。

2026-10-17 00:37 UTC用原封存部署helper一次实际执行：只新建两个带hash的JS/CSS，最后原子切换Next/index.html，原16项均已备份，旧hash资源继续保留。六项实际HTTP200且SHA/字节匹配，构建源码仍为5419ace，产品版本1.3.173；之后的文档提交不重标构建源。

| 产物 | SHA256 |
| --- | --- |
| index.html | `4717a68ace5df9c95fe65ca67783b85d1069d95e83de053d7e618fccfc9808ab` |
| assets/index-Dtx9Hd6p.js | `5041e6e1b2ec30a4da9a7e50b97fc2cd074005007cd9cee7ee1b346c69843dbf` |
| assets/index-OCidcyQv.css | `828a3d01cf0cb9b7e1f79e8a0be28f065af0408aad58099c61913f52bdf69ac4` |

原资源候选检查点`79dbaecd3ecece4f8678eb7cb8cc21518d28540c`的四运行产物保持。用恢复目录独立wx派发/结果记录执行原CLI普通daemon start一次，保留昨晚启动回执，没有restart/force kill/模型lease或endpoint。当前PID16140、epoch`4e1af6ae-0131-4c17-9998-2a68d2c7ea41`，daemon SHA`ac1f2f5f0958f091935d905793d6fe8db9747e5a9cc04b3a000c86f72e8ac141`，仅监听127.0.0.1:32180；最终OPEN、全部活动计数0。

job列表、resource-config、原new job状态均HTTP200，new job仍revision3/selected。variant-import-status为409 INVALID_INPUT，表示原job尚无latestImport操作；没有伪造操作ID、准备或执行导入。当前六工程登记与预设hash保持；Creator状态error/不可达不是已ready，本轮没有启动Creator或模型。资源候选源码仍以精确补丁/107输入清单归档，共享源码未合入；不能把本机加载写成上游正式发布。

实际认证Edge在1440×1080从当前同源地址加载页面，检查四来源、创建请求预览和初始化表单并保存截图；所有业务写请求均拦截，实际为0，页面错误0。没有最终确认创建、原生窗口、真实安装、持久客户端配置或真实资源导入。此前92文件3840项/类型/正常构建及两个Temp工程201证据按原范围复用，因为全部冻结功能输入与产物未变，本轮不重复完整回归。

保护回读：1779基线保护范围中四个已批准资源产物按当前候选SHA单独核对，其余项未变；共享22条原dirty、110源码及45份原工程/任务文件未变。coordination固定非敏感元数据3 leases/632 operations/292 dispatches/2 resolutions前后完全一致，SHA`4c9698c9ac74f7ea7f06004aace81404ee39de7da112482054738943cf34d16c`，历史UNKNOWN未清除、未重放。未读取payload或凭据。

恢复和启动包装器经实际`/root/companion_next_reviewer`只读审查，无有证据的P1/P2阻断；该角色为prompt-emulated，未声称注册preset或硬权限隔离。已读本地.agents/skills：creator-ai仅服务P1060，archify用于图表，均不适用本轮恢复，未调用。

证据：`C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/interface-load-20261016-phase2/recovery-20261017`下audit.json、preserved-index.bin、preserved-worktree/README.md、own-next-restored.json、startup-{dispatched,result}.json、active-api-static-receipt.json、active-browser-receipt.json、active-next-create-1440.png、active-final-daemon.json、recovery-coordination-{before,after}.json、delivery.json。上一级保留next-scaffold-deployment-{prepared,dispatched,result}.json及backup-before-next-scaffold。

回滚仅针对本片Next：先核实当前入口仍为上述新SHA，再用已核备份原子恢复旧index.html，保留所有hash资源和当前后台四产物，不重启daemon。完整迁移与真实资源导入未在本轮完成，剩余范围见[唯一差距清单](feature-parity-current.md)。
