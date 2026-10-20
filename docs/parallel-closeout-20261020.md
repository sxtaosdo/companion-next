# 2026-10-20 开机核对与三个独立模块并行交付

本轮可授权的离线验证、已有连接核查和证据整合已完成。新增可重复运行的测试代码，调用记录5/5与安装恢复9/9通过，项目严格类型检查通过，复审无P1/P2；没有发现需修改Next产品逻辑的缺陷。**共享后台当前启动受阻，32180无监听；没有部署新产物或宣称开机实机通过。**

历史功能矩阵仍13通过/6部分/2暂停；这是既有主流程证据状态，不表示当前服务可用。本次不以隔离测试提升实机完成比例，历史Creator首500唯一根因仍未知。

## 实际开机状态及精确阻塞

UTC00:39:45系统启动；初始无Companion daemon/Creator/Edge进程，32180无监听。旧locator仍为10/19的PID3860和epoch，不当作新进程身份。磁盘daemon SHA71cbf7d8bc200fdcc867da7ed3d671f00721e3cc025098624ba54a15ba8a167f、map212ba55f65e4216c11fd896433ac275c764061ae26de2cb6b62687b47d4e19ea、Next静态index-Dx563SKg.js SHA b2b29887dbc1e62e9f25fd1856afac8dc49dc0d6232de12346b2e00e90b5eda9均未变。磁盘预置UI仍a8e88ac/内部1.3.173.146、产品1.3.173；本次没有运行UI。安装MCP版本常量0.3.142与补丁2994d14/隔离package0.3.150保持各自含义，不混称。

原reader User非秘密引用仍存在，同一DPAPI文件620B、普通文件元数据可读；没有读取或解密凭据正文。因后台未启动，**本日KB实际认证/元数据健康未验证**，不沿用昨天200，也不把当前失败叫作401。

按授权原入口StartOnly/NoBrowser启动一次，CLI报daemon立即退出并给出通用端口提示。只读确认无进程/监听后，从实际CLI源码证实stdio:ignore丢弃子进程原因；于是仅作一次带stdout/stderr捕获的同entry/同正常环境诊断启动。PID20380明确退出1，stdout0B、stderr48B：`Kernel identity is inconsistent with the anchor`。此后未再尝试。

只读执行从安装map提取的纯OS采样函数（不实例化NativeMaintenance），得到：

|字段|旧锚点|本次实际|
|---|---|---|
|machine|同一机器|与锚点匹配，未归档MachineGuid正文|
|bootId|a49be189-172d-11f0-8a7d-8c9774127e68|相同|
|System进程创建时间|2026-10-19T09:37:39.8830320Z|2026-10-20T00:39:52.8919050Z|
|Win32 LastBootUpTime|本次不作为旧锚点字段|2026-10-20T00:39:45.5000000Z|

现装NativeBootAuthority.prepareWriter的判断 `sameBoot !== (current.systemProcessCreatedAt === anchor.systemProcessCreatedAt)` 因而明确拒绝，早于writer lock获取及HTTP监听。已证实这条启动拒绝路径；没有证据认定是Fast Startup、系统回滚或其他具体OS机制。不是端口冲突、Creator残留或知识库权限故障。

|动作/目标|结果|阻塞状态|
|---|---|---|
|正常启动已授权Companion应用32180|已执行，子进程退出，服务未恢复|已知失败，不是未知仍在执行|
|一次捕获原因的同entry启动|已执行并确认PID20380退出1|原因已取得，后续不盲重试|
|修改NativeBootAuthority/boot采样/锚点|未执行|旧宿主明确例外仅覆盖Creator窄修，新增范围尚未批准；不是工具权限拒绝|
|删除锁、重锚、清/归档UNKNOWN|未执行|不作为绕过措施，不扩大维护平台|

下一步应先明确是否增加“宿主开机身份与writer准入”窄修例外，再独立离线设计及验证；保持原锚点、历史journal、UNKNOWN不被改写，不能用时间变化直接代替原生进程已退出证明。本轮不自行改守卫，不重启电脑，不迁移历史。

## 已实际并行的模块与交付

|模块/执行标识|实质结果|当前边界|
|---|---|---|
|/root/calls_isolated_20261020|安装真实CallHistoryStore和原calls路由投影→Next adapter/store，新增5/5|仅离线，不等同完整HTTP鉴权/实机分页|
|/root/setup_completion_20261020|01/11失败重确认、同ID只读恢复、未知副作用屏障及异常完成回执，新增9/9|仅受控transport，不写真实配置/启动Creator|
|/root/clients_inventory_20261020|配置结构/hash、进程、既有专属握手日志脱敏核查完成|仅已有证据，未注册、未调用业务工具|

三个模块分别写独立Temp目录，不互写产品；主agent整合代码、定向验证与文档。另一次只读集成复审无P1/P2；其“分页循环加上限”建议已落实，避免游标回归导致验证无限循环。普通沙盒Git/CIM不可观测时采用必要只读提权，没有修Git配置/索引或当作客户端不存在。

## 代码完成与可重复运行方式

新增 `tests/project-setup-recovery.test.ts`，9条实际生产adapter/store回归已纳入普通测试发现。新增显式输入脚本 `scripts/verify-installed-call-history.mjs` 与文本夹具 `tests/fixtures/installed-call-history-contract.template.ts.txt`，从用户指定的daemon map提取宿主Store及原路由投影，无工作区宿主源码fallback；不导入daemon entry、不监听、不读取生产history，输出必须空目录，证据文件wx创建。

```powershell
node scripts/verify-installed-call-history.mjs --daemon D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/companion-daemon.js
node node_modules/vitest/vitest.mjs run tests/project-setup-recovery.test.ts
```

调用记录新覆盖：1032累计/1000保留跨20页，500保留失败跨10页，无重漏；成功/失败详情由真实Store脱敏后进入Next；running记录及被截断项迟到完成；原路由schema拒绝非法参数。新安装测试覆盖01/11失败后新确认才能POST、GET失败同ID恢复不重发POST、未选步骤返回效果保留UNKNOWN写屏障、complete带error/非法mcpName、409边界。集成后5/5、9/9、vue-tsc --noEmit均通过；没有重跑旧132/66或所有旧套件。

安装SetupService、Registry、BridgeInstaller、DashboardFault四源SHA与昨日8/8相同，编排证据复用；当前CodexConfigurator源不同于早期归档writer，不能沿用旧writer失败为现装缺陷。当前没有证据支持新的旧宿主writer修改。

## 实际客户端核查

- Codex有2项Companion相关stdio登记，其中P1060暂停；唯一非暂停ant-cook入口存在且有--project结构。本次见codex.exe PID16804、13528及ChatGPT进程，但这些不是成功Companion握手证据。
- Cursor有11项登记，其中P1060暂停；10个非暂停项中2个绝对入口存在，8个裸命令在本执行worker PATH不能解析，不能推定Cursor自身启动PATH相同。本次未见Cursor进程；最新专属日志目录仍10/19，10个日志均见历史-32000失败/closed，未发现成功初始化标记。
- Trae/Kiro原约定home配置路径不存在、未见相关进程；不外推用户未使用其他位置。VSCode专属按指令排除。
- 原配置读前后SHA一致，不改配置、不批量重登记、不启动客户端。#13/#14不能据此升为通过，也不引入必须测试全部五客户端的新门槛。后续应只确认用户实际使用客户端/工程，再观察其自然连接，按现有授权继续。

## 六项部分完成的本轮结论

|项|本轮可授权工作|剩余|
|---|---|---|
|#5安装|新增9条恢复/回执回归，复用相同编排源码证据|真实01/11涉及真实配置/Creator，本轮不执行|
|#10清空/导出诊断|复核旧隔离清空链全部SHA并绑定现装HTTP/LogStore源码完全相同；复用真实583B诊断|清空真实日志/业务数据仍禁止，不要求删除用户日志凑验收|
|#11调用记录|真实安装Store/原路由投影到Next的5项增量隔离|开机后内存history已丢失旧实例内容；本日生产分页/失败详情未验证，不造调用凑数。旧失败摘要已归档|
|#13 CLI/IDE交接|核现有登记、进程与专属历史日志|没有当前成功Companion握手/真实接收执行证明|
|#14 MCP登记|只读配置结构/入口/hash及日志核查|不擅自写真实配置或专属部署；以实际使用目标为准|
|#16资源|既有96变体/PNG/meta/UUID/场景/Preview/Build/Smoke有效证据复用|模型部分及#20/#21继续暂停；不重跑96或启动P1060|

#10复用证据明确保留原夹具中两次中断和分段完成记录，最终隔离成功不等同生产清空；无新增DELETE、诊断下载或端口监听。旧结果中的12/7/2是历史时点，当前13/6/2不因本次复用而增加。

## 最终保护及交付边界

共享22项及21保护源、已安装312文件、原配置/UNKNOWN journal、9业务表均一致；SQLite文件mtime变化不被误判为业务表变化。最终32180监听0、Companion daemon0、Creator0。未改锚点、未知锁、权限、电脑启动方式或系统配置；没有模型/P1060、真实客户端配置、旧数据迁移、GitHub方案、新UI、推送发布或云上传。

代码与隔离验证完成；新部署0；开机实机健康未通过。工作没有停在初始失败：三个模块和主线程证据复用/仓库化均已完成，唯共享后台启动恢复因明确旧宿主范围约束留下精确阻塞。

机器证据：[开机前置](evidence/parallel-20261020/boot-preflight.json)、[实际启动错误](evidence/parallel-20261020/diagnostic-start-error.txt)、[boot比较](evidence/parallel-20261020/boot-anchor-comparison.json)、[调用5项](evidence/parallel-20261020/calls-tests.json)、[安装9项](evidence/parallel-20261020/setup-tests.json)、[客户端清单](evidence/parallel-20261020/client-inventory.json)、[保护核对](evidence/parallel-20261020/preservation-final.json)、[SHA清单](evidence/parallel-20261020/sha256.json)。
