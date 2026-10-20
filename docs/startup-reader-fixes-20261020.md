# 当前结果（2026-10-20 02:54 UTC）

两处已批准窄修已部署，完整CLI普通冷启动入口返回exit0/PASSED，耗时11171ms；已运行实例幂等复用另有578ms exit0回执。最终Companion PID6564，32180，OPEN；daemon SHA70df42a8…不变，Nodev25.2.1。CLI最终SHA8ba06c76…，worker SHA9a02abcd…。UI仍为已部署a8e88ac/内部1.3.173.146、页面1.3.173；本轮文档检查点1.3.173.166不是UI重部署。WeKnora PID600/8081、EXE b05899bc…及创建时间保持，未重启电脑。

原reader通过六个有界只读POST和两个状态GET：KB元数据、limit1文档列表、固定文档详情、limit1分片、2235B完整原文和limit1关键词检索。原文SHA3f232d48…与此前一致，auth/keyword verified，writer/scheduler仍false。未归档正文、未替换凭据或扩大权限、无模型/Creator动作。[最终实读](evidence/startup-reader-fixes-20261020/cold-entry-acceptance/reader-result.json)。

完整CLI26项、worker64项、Next受影响合同115项通过，worker严格tsc通过，独立审查无剩余P1/P2；每轮从实际安装map重建基线JS逐字节相同，候选只改各自一处源码，依赖保持。第二轮仅CLI/map两文件变化，worker、daemon、静态等310文件保持；相对任务起点只CLI/worker及maps四文件变化。最终冷验收无代码变化，312运行文件全部保持。共享22项修改、21个受保护源、9业务表、KB状态/计数/公开key3权限保持。canonical同一路径v2锁，旧锁原字节及file object保留；UNKNOWN2、quiescence0，未放宽启动重采样。[最终保护](evidence/startup-reader-fixes-20261020/cold-entry-acceptance/final-protection.json)。

前两次communicate管道观察分别55/110秒未取得退出回执，原entry/CLI之后消失，但退出码仍UNKNOWN，记录没有被覆盖。后续代码复查修复了额外的无界完整调用点；隔离反例不能反推真实等待唯一原因。取证修正为临时文件输出及process.wait后，原正常入口幂等复用exit0，另存检查点的无代码变化冷验收取得新exit0/PASSED回执。不能由新回执追认前两次退出码；底层不可取消文件IO的Promise超时也不构成该IO已退出证明。

整体旧功能仍未全部对齐：13通过/6部分/2暂停，只代表限定主流程历史验收。见[21项逐项矩阵](parity-matrix-20261020.md)，不能把本轮回归项数当整体功能通过率。

---

以下为按时间保存的候选及首轮过程，当前状态以上文及最终回执为准。

当前补充：完整CLI候选已部署，后台18408/OPEN，原reader再次限定实读8步全200、auth/keyword verified，保护核对通过。修正取证为临时文件输出+process.wait后，现有实例的原正常入口578ms exit0/PASSED，PID/epoch不变。前两次communicate管道观察仍记UNKNOWN，未追认冷启动退出码。现保存无代码变化的受控冷启动验收检查点，按既有精确应用重启授权，只验证一次完整正常入口退出，不重启WeKnora/电脑、不改任何运行文件。

21项结果见[清晰逐项矩阵](parity-matrix-20261020.md)。

阶段更新：首轮4产物已安装，Companion10940/32180/OPEN，原reader六个有界只读POST及两个状态GET均200，原文2235B同SHA、auth/keyword verified；共享22修改、9业务表、KB状态/公开权限及UI哈希保持。首轮正常入口55秒未取得退出回执，随后原entry/CLI均确认消失，但退出码仍UNKNOWN，不追认为成功。原回执完整保留。

完整调用复查发现既有实例初检和成功后的第二次status仍可能无界。新候选增加初检10秒上限、直接复用已验证status，普通启动逻辑最坏约50秒；端口占用仍零spawn，停止守卫不变。26项测试含旧完整命令60秒仍挂起反例、新完整execute验证及原18项。独立复审无P1/P2，当前安装3b9f基线再次逐字节重建，依赖及其余45源保持。该补修候选尚未部署，下一步仅替换CLI/map，再按既有授权精确应用重启验证。它是新候选部署，不是盲重发首次操作。[第二轮证据](evidence/startup-reader-fixes-20261020/full-entry/round2-reason.json)。

# Companion 启动等待与 reader 错误分类窄修（2026-10-20）

用户已明确批准延长有上限的启动等待，并区分服务未启动与权限拒绝。任务检查点 `5709053` 保存实际安装、312个运行文件、9张业务表、共享22项修改和原reader公开权限元数据。

本检查点保存已审查候选，尚未部署：CLI `3ceb49c`，worker `19c9923`。CLI预检10秒、spawn后30秒单调预算，单次spawn，超时明确后台可能继续；固定安全诊断不输出原异常或进程命令。Worker按本地加载、fetch/响应、格式、取消和真实身份拒绝分阶段使用既有码，不改变身份、范围、有效期或权限。

| 验证 | 结果 | 限制 |
| --- | --- | --- |
| CLI隔离回归 | 18/18 | 假时钟和假进程/IO；尚非真实启动 |
| Worker隔离回归 | 64/64，严格tsc通过 | 假文件、解密、网络、stdio；未读取真实凭据 |
| Next读接口/状态/UI合同 | 115/115 | 既有测试，非真实后台负例 |
| 精确安装重建 | CLI及worker基线JS逐字节相同 | 仅两处源码overlay；依赖和其余源码集合保持 |
| 独立审查 | 无剩余P1/P2 | CLI预检预算、时钟和迟到探测问题已修正 |

只拟替换CLI、worker及各自map共4文件，daemon和Next静态UI不变。下一步按原应用精确进程重启授权部署，保留同一canonical锁、启动重采样及UNKNOWN2；不重启电脑、不重启已恢复的WeKnora、不启Creator或模型。历史403首个失败阶段仍未知，不能由分类测试反推历史请求已成功加载凭据或已到达fetch。

整体对齐仍为13项通过、6项部分完成、2项暂停；该数字是限定主流程历史验收，不能当作当前可用率或工作量完成度。剩余项包括实际客户端接入、真实清空（禁止删除真实日志）、自然调用分页/失败详情，以及暂停的模型/Agent链路。详见[逐项矩阵](migration-status-21-20261019.md)及[本轮证据](evidence/startup-reader-fixes-20261020/checkpoint.json)。
