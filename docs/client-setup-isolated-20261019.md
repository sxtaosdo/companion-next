# 客户端注册与安装01/11隔离续核（2026-10-19）

本批只续核新 Companion 开发者后台的两项剩余验收，**未完成真实客户端接入或生产01/11安装**。基线c0e3dd9 /1.3.173.132，先建 checkpoint/next-client-setup-20261019-c0e3dd9；未重复纯检索、日志或96资源验收。

## 两路结果与精确剩余

| 项目 | 本轮实际证据 | 缺失或未验 |
| --- | --- | --- |
| 四JSON客户端配置 | Cursor/Trae/Kiro/VS Code的已安装写入器，在显式Temp路径执行真实parser/default fs I/O；不相关字段保留、幂等、异名冲突/坏JSON/写前失败不改原字节；实际回执经Next受控transport接受 | 不是用户真实配置写入、客户端接收或重连后生效；未执行生产注册POST |
| Codex配置 | 已安装configureCodexMcp经fictional exec ledger验证新项/no-op/冲突、回读验证失败恢复legacy的控制流 | 未执行真实CLI或配置parser；不能称真实持久化通过 |
| 客户端状态读取 | 已安装HTTP源码只有注册POST，没有正式状态GET；四home路径仅看存在性/字节数/SHA，前后完全相同 | 不存在状态GET是明确能力边界，不能用POST探测，也不能把文件存在当接入成功。未检查工程级VS Code或推测Codex配置路径 |
| 安装01/11 | 原SetupService+ProjectRegistry+BridgeInstaller在临时工程真实登记/落盘惰性Bridge fixture；Creator/Codex/verify显式受控；有效选项冻结、同项复用、三类异项409、四类失败终态和active释放通过 | 不是实际Bridge加载、Creator启动、Codex持久配置或生产安装；01/11真实运行仍未验 |
| 失败回滚 | 原编排器保留早期副作用；四JSON部分写入后与Codex legacy-remove后add失败的回滚保证明确未满足 | 两类旧宿主缺口未修，本批禁止覆盖ccc1341daemon；不能用Next按钮或expected-fail绿色结果伪装保证已实现 |

客户端专项最终24项：**19通过、5预期失败**，853ms、正常退出0。5项分别对应四JSON的部分写入回滚和Codex新增失败恢复；不是24项业务保证全部通过。安装部署源码隔离8/8，Next既有严格选项21/21；最终vue-tsc --noEmit退出0。没有产品源码修改，未重新构建或静态部署，运行前端保持ecabe7e/.131。

## 真实旧宿主缺口

测试对象固定安装daemon SHA `103ea371f13b784d7ec0263ae4714906a8ea67ebc4ddc7e0ac9c7cc5439b801c`，map SHA `64828d458dd0f327bfc65cf607f1271966258fc50da51c41a4bba28a19d92b0e`。五写入器、SetupService及Registry/BridgeInstaller均取实际map sourcesContent，非共享工作树的推测版本。逐源SHA见回执。

- Codex sourceContent:126–139：先remove legacy，:129的add在try之外；该add抛错不进入后面的验证失败回滚。fictional CLI注入add失败后legacy缺失，期望恢复的断言失败。
- 四JSON写入器直接ensureDir/writeText（Cursor sourceContent:103–105，同族实现同形）。默认真实I/O的写前失败保留原字节；另用writeText依赖注入写入19字符后抛EIO，四项均未恢复原字节。这是确定性的故障注入，不是真实磁盘故障测试。
- SetupService不是完整事务：后续失败后，登记及成功安装的Bridge保留；受控Codex写入后抛错或verify失败时，其临时副作用也保留。active释放只表示可受理另一明确请求，不能推断已回滚或自动重试安全。

没有改旧宿主，不能在本轮固定daemon约束下修复这些路径。若要修，应另行在隔离宿主准备原子配置写入/精确备份回滚及Codex remove/add/verify同一恢复范围的补丁，先复核故障注入测试，再安排明确的宿主交付窗口；当前共享22项修改和未知历史保持。

## 可复查执行与边界

新增Node专项 [tests/client-registration-isolated-20261019.test.mjs](../tests/client-registration-isolated-20261019.test.mjs)；vite.config.ts仅将该精确文件追加到既有test.include，未泛纳入其他node:test脚本。测试强绑定上述安装SHA；缺bundle/map时显式skip，SHA变化时失败要求重审，skip不能算已验。执行：NODE_OPTIONS=--no-experimental-webstorage，node node_modules/vitest/vitest.mjs run tests/client-registration-isolated-20261019.test.mjs --reporter=verbose。

初版TS专项先有19通过/5预期失败，随后项目类型检查因缺Node声明失败；仅去类型转换为MJS并补发现名单，最终重跑同24项及类型通过，无安装依赖或全局类型变更。lane普通sandbox两次缓存权限失败未导入用例；根正常宿主执行成功，未改权限。安装harness首次beforeExit证据写入导致自身不退出，修正test.after后8项自然退出；原过程见setup/SUMMARY.md，不影响共享进程。

并行实际lane：`/root/credential_architecture_review`负责客户端专项；`/root/next_project_help`负责安装隔离。根负责集中最终专项/类型、正式只读能力GET和保护元数据；没有实际桌面操作，故没有并发浏览器控制。安装完整测试与转译runtime作为证据保留，runtime只承载取自map的编排代码，扩展bundle仅惰性fixture。

正式只读能力GET两次均200，返回optionsContractVersion=1、strictOptions=true、same-effective-options；这只是能力协商，不是安装成功证据。四home路径中仅1文件存在，所有元数据前后相同，未解析配置字段。Codex路径未由原模块确定故不读取；VS Code工程配置未探测。没有注册/安装POST、CLI执行、Creator/模型、新监听、凭据或权限更改、云上传。

最终保护：共享HEAD/status/diff/index与21文件摘要一致，原22项修改、daemon PID7832/epoch及入口SHA、CLI/worker/旧UI、UNKNOWN journal保持；9张业务表前后相同，Native awaiting/uncertain=0，历史epoch unproven=2。自有临时夹具仅按已验证路径清理或保留证据，不触及用户配置。支持证据：[evidence/client-setup-isolated-20261019](evidence/client-setup-isolated-20261019)。

## 后续真实验收所需动作

1. 真实五客户端：先明确一个目标客户端和工程、允许写入的实际配置路径及备份/恢复边界，再通过原注册入口写入并回读，最后由该客户端验证连接。当前没有状态GET，不能由文件元数据代替；新增状态功能需先提方案。
2. 真实01：明确允许原Codex CLI持久配置写入与目标工程；真实11还需Creator运行窗口。本轮禁止Creator及实际客户端配置变更，因此仅隔离闭环，未发生产请求。
3. 完整回滚保证：受当前不替换ccc1341daemon约束阻塞，需独立宿主补丁/交付窗口；不是新增凭据可以解决的问题。

当前可独立完成的隔离验证已经完成；纯检索与日志上一批证据保持。Agent问答、同步索引及模型仍暂停，整体旧功能不能宣布全面对齐。

独立审查 `/root/default_project_review` 发现预期失败可被提前异常误触发的P2维护问题。已在不受it.fails包裹的afterAll强制校验四个不同JSON目标及Codex故障证据齐全、五项恢复结果均为false，且无论校验结果都按已核路径清理临时夹具。最终同24项复验仍为19通过/5预期失败、853ms、退出0；本改动只加强测试可信度，没有修复或隐藏旧宿主缺口。

最终独立只读复核确认该P2已关闭，无剩余新增P1/P2；最新归档21项SHA及专项测试SHA一致。此结论不关闭五项旧宿主回滚缺口，也不代替真实客户端/01/11验收。
