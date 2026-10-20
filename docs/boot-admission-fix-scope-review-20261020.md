后续状态：用户已明确批准本文件所述窄修，实际实现与未通过项见[2026-10-20修复结果](boot-writer-recovery-closeout-20261020.md)。下文保留为批准前的历史评审，不再代表当前等待授权。

# 开机准入窄修范围：只读审查，等待批准（2026-10-20）

本文件是待批准的修复边界与验收条件，不是实现或部署结果。父线程已向用户请求批准，尚未答复；现有批准仍只覆盖既有Creator例外。没有修改、绕过或关闭守卫，没有改锚点/锁/UNKNOWN。

## 已证实的应用逻辑边界

实际错误来自NativeBootAuthority.prepareWriter。当前machine/bootId与锚点相同，而System创建时刻不同，现有等价性断言立即拒绝，早于writer lock获取和HTTP listen。WindowsBootSession原样只读采样验证了这一组合。

这是应用证明写入者排他性及原生工作者生命周期的可靠性/一致性守卫，不是Windows Defender、防火墙、UAC、安全策略、账户权限、系统快速启动开关或其他系统安全设置。无需也不得以“关防护”作为修复。快速/混合启动仅为未证假设，本轮不改变启动设置或重启电脑。

## 必须明确的最小改动面

1. `mcp/src/companion/native-boot-authority.ts`：`prepareWriter`中比较元组、写入者准入和已有handoff校验是直接目标。应显式区分同一可验证会话、双标识均变化、标识组合不一致；不把不一致默认为新boot或旧boot。若批准恢复服务，应只在可信构造边界持有**精确旧writer归属且其OS实例已退出**的独立证据时允许writer-only交接；不能仅凭PID、文件mtime、时间变化或调用者提交清单。
2. 与上述变化配套的`persistWriterHandoff`/`validHandoff`：必须核对当前归属绑定，不能让不一致元组伪装成旧same-boot回执。具体是否可复用现有收据格式仍需设计验证，不能在审批前承诺仅删除一行即可安全恢复。
3. `mcp/src/companion/native-epoch-journal.ts`目前仅允许旧`.lock`或`.boot-<GUID>.lock`，用wx+获取排他锁，锁只有schemaVersion/writer/pid/openedAt，不能独立提供OS创建身份。仅放宽prepareWriter将继续遇到同GUID旧锁；更不能盲删它。若沿用该格式，需精确锁归属验证、原字节保留及竞态下单writer获取；若设计确需变格式，该文件及对应严格路径校验/兼容测试才进入批准范围，不先扩展路径格式。
4. `windows-boot-session.ts`当前采样已返回一致可验证字段，不存在已证实的解析缺陷。原则上保留，只在离线设计能证明必要时进入范围；不把clock/LastBootUpTime单独提升为quiescence证明。
5. 对应native-boot-authority/native-maintenance/native-epoch-journal的离线测试。无需改Next界面、CLI、客户端注册器、Creator退出算法或搭建维护平台；构建部署继续使用实际安装map的精确overlay，不覆盖共享22修改和既有知识/Creator修复。

必须保持`newBoot()/proof()/trustedVerifier`的原生静默证明与writer-only归属分离：即使已证明旧daemon writer退出，也不能声明其工作者已终止，更不能把UNKNOWN变成功、归档、清零或为不一致boot元组签发quiescence证据。原锚点/历史journal/head/legacy锁与已有未知记录均需保留。

## 获准后所需验收（当前尚未执行）

- 同bootId且同System时刻的既有启动路径保持；旧writer仍活、归属不足或OS观察失败均拒绝。
- 本次“同bootId/不同System时刻”夹具：无独立可信writer退出证据时保持拒绝；若设计允许writer-only恢复，必须给出精确旧OS身份与锁绑定证明，且UNKNOWN2与原生quiescence证据计数不变。
- 不同机器、单标识异常、采样字段缺失、采样期间变化、伪造/不匹配收据和非普通/重解析路径均拒绝，不能默认放行。
- 两进程并发抢占及交接前后崩溃：最多一个wx writer；其他writer锁不可改写，旧已知锁原字节可追溯保留；不能通过更名放出第二个未知writer。
- 不一致元组的proof/verifyExit仍拒绝归档UNKNOWN；同一新writer启动成功不构成native quiescence证明。
- 原journal链校验、旧历史可读性、已有handoff相容性与缺失数据拒绝均保持。
- 最小实机只恢复同一32180应用，核对新PID/epoch/entry SHA及OPEN、原reader元数据200、Next静态hash不变、共享22修改和9业务表保持；不重启电脑、不触Creator/模型/P1060或真实客户端配置，不重新跑整套无关功能。

## 当前状态

测试交付提交812c3f7/内部1.3.173.158：调用5/5、安装9/9、严格类型检查通过；新部署0。当前32180无监听，KB实际认证今天未验证。旧历史Creator首500唯一原因仍未知。下一步修改旧宿主开机准入须等待用户批准，不能把本审查作为授权。
