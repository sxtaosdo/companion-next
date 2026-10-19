# Native带身份观测与严格终态对账候选

状态：Accepted（离线候选范围）；2026-10-19。目标只在Companion Next自有代码准备候选，不部署、不修改旧Windows Companion/daemon、不启动监听或重启共享服务。**P1060仍未恢复实机验收条件。**

## 基线与位置

本地基线 `dc9a7c3 / v1.3.173.125`，工作树干净，检查点分支 `checkpoint/native-observation-candidate-20261019`。候选 `host/native-observation-candidate.ts` 只被单元测试导入，没有接入main、binder、HTTP、旧tracker或运行bundle。无依赖变更、文件/网络/进程操作、后台计时器、重试、reset/drop API。

现有daemon epoch `62e066f5-5081-43e4-a19c-242889e46a90` 的匿名2仍是UNKNOWN。05:15:20.887为0、05:19:41.233为2；07:54:37.908支持接口仍为2，bundle SHA `4b0cc563b6e96bf6c609f6012092595017dc558a6017f85838ab7134930433e7`。P1060历史32/32、4060历史55/55已分页补齐，无running。ECONNREFUSED发生于发送前，不能解释计数；scene.getTree INTERNAL_ERROR仅是候选关联，不是逐项绑定。后续事务PASSED不解决匿名计数。

本候选以显式 `legacyUnknown[]` 保留旧epoch、count、原观测时间、证据引用及证据SHA；不虚构两个请求ID、不自动推断工程。新请求、新epoch或任何已知请求成功都不减少这2。总blocking包含全部epoch的等待、具名UNKNOWN和legacy aggregate。调用方不得用单独的当前epoch计数替代总blocking。

## 请求状态与证据

每个新观测必须有真实 `daemonEpoch/requestId/operationId/projectId/sessionId/method/inputSha256`；字段缺失、空白/控制字符、无效哈希或同epoch复用wire requestId被拒绝。operationId是外层操作关联，requestId是实际Native RPC请求ID，二者与公开日志的随机关联ID不能混淆。参数只存hash，不存输入、凭据、响应原文。

| 事件 | 状态及规则 |
| --- | --- |
| begin | awaiting-send；记录UTC时间及单调时钟起点 |
| 确定失败且从未尝试send | 本地terminal，保留失败原因；没有伪造Native终态收据。错误字符串本身不能证明“未发送”。必须经过受控状态机 |
| dispatch | 同步登记sendAttemptedAt，再且仅一次调用transport callback；已结算或已尝试的请求不能再dispatch |
| 发送抛错/断开/超时/取消/协议损坏 | UNKNOWN；关闭本地等待不是Native取消。即使发送同步抛错也保守处理 |
| 绕过dispatch发生迟到send登记 | 原“发送前失败”结论失效，重新UNKNOWN；不隐藏已发生的错误顺序 |
| 有效迟到终态 | 只收敛完整身份匹配的具名观测；旧epoch的收据不能用来结算新epoch同名请求 |
| 重复相同收据 | 幂等；仍追加重复到达审计，不减少其它记录 |
| 矛盾的有效收据 | 保留原终态和冲突摘要，转UNKNOWN；重复原收据不能自动抹去冲突 |

可信 `verifyTerminal` 是**未来宿主接入的信任边界**。候选没有生产验证器，测试使用隔离的opaque-token→证明映射。实际接入必须从Native执行回执/可信journal确定执行已完成或明确拒绝，而不是接受HTTP请求提交的布尔值、UI勾选、外层PASSED、202、任务排队或随意构造的对象。验证器必须校验来源真实性、方法完成语义、实际请求参数hash及工程/会话绑定；这些不能由本纯内存模块自行证明。

验证器返回完整证明后，模块再次核对完整身份、实际原始响应中的wire ID、成功/失败分类、响应字节SHA256、send≤responseObservedAt≤verifiedAt和本地单调时间。输入响应最多1MiB，复制后计算真实SHA256，审计不保留原文。TIMEOUT/INTERNAL_ERROR及未知错误码永不作为终态；本候选失败终态白名单仅INVALID_REQUEST/NOT_FOUND/UNSUPPORTED/READ_ONLY/VERSION_MISMATCH，扩大前需核方法合同。Native取消确认尚无验证合同，本地abort始终UNKNOWN。

审计、旧aggregate、观测和终态/冲突摘要均只追加/保留；snapshot提供独立副本。没有持久化、checkpoint导入、跨进程恢复、Native排空探针或维护放行接口。**内存快照不是持久审计**：未来接入必须先实现原子追加journal与完整重载/防漏载验证，不能用新建空实例替代旧进程历史。未满足前不得部署本候选为生产恢复机制。

## 受控维护的最小证明与权限

| 门槛 | 可由工具核实的证据 | 确需另行授权的动作 |
| --- | --- | --- |
| 固定运行代 | 支持inflight的PID、startupEpoch、入口SHA、generation、完整counts/unknown；保存现有两份报告与公开日志hash，不读取凭据 | 无；这些是已授权只读查询 |
| 固定操作全集 | 支持历史before分页直至无nextBefore，核total/retained、去重、running、终态/dispatch收据；项目与会话身份分别对应 | 无；但高层无running不能代替Native终态 |
| 每个具名Native已完成 | 可信Native原始终态/receipt绑定epoch、wire ID、session、参数hash；或经验证的原Native执行上下文排空收据 | 当前旧tracker无此逐项观测，不能凭本候选或后续成功制造证明 |
| 匿名旧epoch确无执行存活 | 必须覆盖该epoch可能触达的所有Native上下文，逐实例核PID+创建时间+session、拥有的worker/异步队列，并证明排空或旧实例已退出。停止回执、进程名匹配、lease释放、健康GET都不能单独证明 | 若需停止任何Creator/worker，必须单独批准确切实例和窗口，先走原未保存内容保护；不能停用户正在使用的P1060作为本轮默认动作 |
| 可审计归档/接续 | 旧匿名2及所有具名未知保留到持久记录，历史UNKNOWN与“已证无在途”分别表达；新epoch不能覆盖旧记录 | 归档对账和epoch接续仍缺正式实现/验证；需另行审查接入方案。本候选没有放行该门槛 |
| 共享服务切换 | 原守卫检查、原状态备份/校验、候选bundle精确hash、其它任务窗口协调；只认支持接口返回 | **共享daemon停/启或部署必须另行明确授权**。当前未知会使原guarded stop拒绝；不得kill进程、改权限、手改DB或绕过守卫 |

因此当前最小行动仍是离线候选与证据交付，P1060保持阻塞。当前公开接口无法生成匿名旧epoch的充分排空证明；若未来仍不能补齐，维护门槛保持失败，不要求用户猜测未知请求归属。只增加观测能力不会凭空恢复这两项身份。

## 回退步骤

1. 本轮未接入运行环境，停止候选开发即可回到原行为；后续若回退源代码，用基线及本任务精准diff生成新提交，只逆向候选、测试和本片说明，不重置仓库或覆盖其它任务。
2. 未来获批接入前，先备份原bundle/配置字节和持久观测journal，记录原epoch与所有UNKNOWN；不备份/导出凭据。先离线模拟退出、重载、截断journal和冲突回执，失败不得切换。
3. 若获批切换后失败，停止新增业务派发；先通过同样的Native排空及原守卫，才能按已批准维护窗口恢复原bundle。守卫不能通过就保持停止派发与诊断，不能用强杀“完成回退”。
4. 恢复原bundle也必须保留新旧epoch的UNKNOWN及审计，不能把无法识别的新格式丢弃为0；无兼容读取能力时必须拒绝回退接管。核原始字节hash及支持接口身份后，只能报告实际恢复的范围，P1060须另行取得新鲜入场证明。

## 验证与审查

测试仅使用隔离身份、固定时钟、假验证器映射和真实WebCrypto哈希，零服务/Creator/模型/监听。覆盖发送前失败、发送同步抛错、发送后超时/断线/取消、迟到终态、七字段串账、响应字节/哈希/时间不匹配、重复/矛盾/并发收据、旧epoch匿名2跨新epoch保留及snapshot防外部改写。最终结果在交付时补记。


### 最终验证与本地交付

- 候选源码/单元测试/权威更新日志本地提交：`00f9e5c / v1.3.173.126`。新增候选38项单元测试通过；最终三个受影响测试文件共**90/90通过**（7.79秒）：native-observation-candidate、companion-host-assembly、help-about-navigation。`vue-tsc --noEmit` 退出0，最终diff空白检查通过。
- 测试命令：仅该次进程 `NODE_OPTIONS=--no-experimental-webstorage` 后执行 `node node_modules/vitest/vitest.mjs run tests/native-observation-candidate.test.ts tests/companion-host-assembly.test.ts tests/help-about-navigation.test.ts`。没有修改系统环境；测试内使用真实内置WebCrypto，验证器和Native身份是隔离fixture。
- 首轮32例中25通过、7条终态路径失败：structuredClone返回的跨realm Uint8Array不满足instanceof。改为真实ArrayBuffer view和Uint8Array品牌校验，再复制/解码/真实hash；补具体拒绝原因断言，避免负测因早期类型拒绝而虚假通过。
- 真实只读`/root/native_tracker_readonly_review`做设计、代码及最终复审；首审两项P2（同收据遗漏时间比较、响应envelope不严格）已修复并增加6项回归。复审确认P2关闭、无新增P1/P2。审查未运行测试或调用服务，不把审查当实机证明。未调用外部OCR。
- 候选SHA256：`f69ff1d5e0a71182898f6cc2e88ebe73eb328f5f806b07d6f5d8ccc401e7bc2e`；测试SHA256：`b6cb8494f40966b7ac861ecafd06e038396ba0b2d627be9b639817df98b5310a`。未接入前端源代码引用，无bundle/监听/部署变化，不为内部候选重建或替换线上页面。
- 本文为后续独立文档提交；仓库版本镜像由原钩子维护。没有读写旧协调DB、清计数、抹历史、重放未知事务、Creator/模型操作、共享服务启停、云上传、推送或安装依赖。

剩余门槛是生产可信验证器、持久journal/重载，以及旧匿名epoch的充分排空证据和经批准的维护窗口；都不能由本轮38项单元测试替代。**当前P1060阻塞保持，原匿名2没有得到对账解决。**
