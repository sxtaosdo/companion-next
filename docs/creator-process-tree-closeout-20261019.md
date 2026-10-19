# Creator 所属进程退出修复与连续验收（2026-10-19）

已批准的旧宿主窄修完成。限定自有工程真实 Next 页面执行启动→重启→重启→停止，4次HTTP200，两个重启均更换PID和Bridge会话，每轮旧进程树均已退出，最终Creator进程0。第6项按限定主流程关闭；21项矩阵变为13通过、6部分、2暂停（等权61.9%，不是工作量完成度）。

## 修复与边界

独立工作树提交9fbf317、复审修正55256cb；共享旧仓库HEAD及22项修改、21个保护文件均保持，不把并行修改带入本补丁。只改CreatorLifecycle、必要Windows退出helper、daemon stop的工程路径及missing-PID fallback、相关测试；版本/变更说明只在隔离工作树。没有修改旧WindowsCompanionUI、CLI或实际客户端配置。

Windows用固定OS句柄绑定PID、创建时间、CocosCreator.exe绝对路径、精确工程参数及观测父链。先捕获已验证后代，再停止根及所属后代，有限重扫并等待确认；每个句柄只发一次终止请求。已退出但身份完整的中间句柄继续用于核对孙进程；已观测身份无法取得则拒绝成功。失败保留原PID/会话且不自动换PID重试；start/stop并发入口互斥。没有按进程名全杀或taskkill /T。

范围是本次可证明的所属Creator进程链；不能追溯本次观测前已丢失父身份的任意历史孤儿，不能将无法证明的退出当作成功。

## 首次失败与后续通过分别保留

首候选006f4bfa：启动200/ready PID468，首次restart500；事后Creator0不能改记成功。首次日志没有阶段信息，无法证实具体500由重复Terminate触发。后续修正增加白名单失败阶段与脱敏原生码、单句柄一次请求，并补两条已观测中间进程退出竞态回归。复审最终无剩余P1/P2；不把推测写成已证实根因。

第二候选1984698ce8b2ec524d1e9e2b0d4d8733075ea4783bfa0f0e9d72b8dad8b6ce94，map91e9c88026f959285cfb0761f046314351f7350961e30cae587bd04a3f90b68f。由当前安装源码图重建的基线与006f运行文件逐字节相同；82个自有源码条目逐项比对，只覆盖已批准3项。只换daemon.js/.map，其余310安装文件原样，Next静态仍a8e88ac/内部1.3.173.146，产品1.3.173；未混入VS Code候选或共享源码中的旧知识接线。

精确应用交接只针对已捕获PID20560，冻结时业务专项和HTTP均0，固定句柄确认退出后保留并重命名该writer已知boot锁，保留UNKNOWN2和其他未知锁/历史journal。由正常reader脚本恢复32180，当前PID20332、epoch eced9fac-c162-4b9d-8f6e-e2756c40e2db、phase OPEN。没有系统重启或新增服务。

|动作|HTTP|Creator PID|状态|
|---|---|---|---|
|启动|200|17924|ready|
|重启1|200|23452|ready，前树退出|
|重启2|200|22820|ready，前树退出|
|停止|200|无|stopped，前树退出，最终Creator0|

停止回执stopped；随后只读Bridge探测仍可能把raw状态记为error，页面详细区保留原值，正常已确认停止使用此前.146中性展示。没有将raw error篡改为stopped，也不以Bridge断连代替OS退出证明。

## 验证与保护

既有三文件集成37/37通过；新增两条竞态后边界18/18通过，tsconfig.build --noEmit通过。原生C#编译及PS语法在测试中验证，进程树边界测试使用内存假句柄；真实连续验收另有OS快照和UI回执，不以模拟代替实机。

验收前后共享22项、fixture原tracked/settings/server profile、登记和预设、已部署312文件一致；测试没有清空日志或业务记录。UNKNOWN2、nativeAwaiting0、nativeUncertain0保持，用户浏览器未接管，自有Edge已关闭。没有模型、P1060、Creator重新导入资源、历史搬迁、推送发布或云上传。

原reader同一持久引用保留，交接后status200、原授权KB元数据200。收尾脚本前两次漏传浏览器Origin头导致本地403（reader状态正常），补正常同源头后一次成功，未修改安全校验、凭据或权限；不是认证修复回退。未重跑全文、搜索、问答或模型。

## 只读根因复核

|现象|已证实|最小措施/仍未证实|
|---|---|---|
|知识401|新进程丢失临时credential路径；worker之前拒绝|同一非秘密路径User持久化、正常入口读回；双启动真实7接口证据复用。未证实key过期/上游权限失效|
|知识503|PS5.1继承PS7模块路径导致Get-FileHash不可用|只限定子进程系统Modules路径，不改全局权限|
|Creator残留|旧实现根PID发信号即宣称stopped，真实restart留下子进程|本次固定句柄所属树退出确认，连续真实验证通过；首候选500具体原因仍未证实|
|锁/进程交接|UNKNOWN与独占writer使普通guarded stop不同于授权精确交接|不清UNKNOWN、不盲删锁；精确身份/退出证据/已知锁保留|
|谱系漂移|共享源码、运行宿主、Next静态不同源，知识接线不同|从实际源码图精确overlay及运行hash，禁止普通全量build覆盖|
|验收缺口|旧实例成功曾被外推新实例；HTTP成功未查后代|新实例身份及连续重启/停止、OS退出核对，不重复所有功能|

证据：[连续实机](evidence/creator-process-tree-20261019/continuous-proof.json)、[首次失败](evidence/creator-process-tree-20261019/first-failed-journal.json)、[保护核对](evidence/creator-process-tree-20261019/continuous-protection-after.json)、[离线测试](evidence/creator-process-tree-20261019/test-summary.json)、[局部补丁](evidence/creator-process-tree-20261019/creator-lifecycle-local.patch)、[SHA清单](evidence/creator-process-tree-20261019/sha256.json)。

剩余仍为#5/#13/#14实际客户端接入，#10真实清空（本轮不执行），#11真实分页/失败详情，#16模型链部分；#20/#21模型相关暂停。原#11只读验收时6条成功是历史快照，本轮生命周期产生的新成功/失败记录尚未用于补验，不注入凑分页数据。
