# Owner 保存与真实库存验收 — 2026-10-18

本轮已批准的 Owner 预览/选择/原生保存与工程库存两项已完成定向闭环。**整体旧后台迁移仍不能据此宣称全部对齐**：正式窄宿主未开放搜索/下载/历史切换/重试/停止/回收/恢复工作流，Codex 自动产物回收仍排除。其他功能沿用 [逐项矩阵](parity-audit-20261017.md) 的已有证据。

| 项目 | 当前已实现并验证 | 边界 |
| --- | --- | --- |
| Owner 原图/缩略图、选择持久化 | 正式32180 cookie 路由；真实 pinned Owner；PNG/缩略图 SHA 和浏览器解码、选择服务回读通过。token 只在 Node 内存。 | 仅任务隔离缓存；未读取/切换用户原缓存。 |
| 原生保存：取消 | 正式页面返回200，cancelled=true、results=[]；UI显示取消，目标0文件，原导出历史不增加。 | 不把取消算成功。 |
| 原生保存：已知失败 | 隔离样本故意声明不匹配SHA；原 exporter 返回200/ok=false；UI失败文字与原错误一致，目标0文件。 | 没有把已知行失败当未知，也没有重放。 |
| 原生保存：成功 | 正式页面返回200/ok=true；UI文件名、实际PNG和.source.json一致；PNG SHA=6b905642db196dc7e2ddfa7282485918f06f9e2f418f330c2599ad57af487fb6。 | 仅任务Temp输出；不写项目、不把保存等同导入/视觉批准。 |
| 原生弹窗启动阻塞 | 已证实 Windows 维护stdin继承导致子进程0CPU无窗口；NUL标准句柄隔离保留sys.stdin/CRT fd0和原chooser。原生三种页面结果均在16秒内完成。 | 原Owner源码、原chooser/helper、UI流程、权限均未改。 |
| 真实库存 | 原CLI启动同一 colony-flow-food-hunt；Creator PID23740/3.8.8，Bridge新会话及127.0.0.1:12625有效。原asset.list=733行，与原聚合器、库存API200、正式页面全部相符：总733/已导入733/未导入0/未知类型0。 | 仅只读AssetDB汇总；无安装、资源导入、游戏业务写入。 |
| 生命周期 | 两次全零检查后原guarded CLI停止；旧25288及owned20080正常退出。新daemon20116保持OPEN，Owner/业务计数0、unknown[]；原两标签、选中项、实时更新恢复。 | HTTP=1是保留的原实时连接；没有清零/绕过守卫或强杀。 |

## 保存根因与修复

90秒代理等待早于原300秒chooser预算，已由宿主6ff44f5调整350秒并通过>91秒回归。但稳定启动的实际根因在Windows stdin：原Python Popen 默认继承正在被主线程ReadFile的维护pipe。无缓存/无保存对照中，同一子进程在控制读取阻塞时0CPU且无窗口；仅在20秒释放控制输入后立即执行并显示原窗口。

Next b82ef59/.85 的 `isolated_child_stdin` 仅在 owned host 内把 Windows STD_INPUT_HANDLE 指向保持打开的NUL；sys.stdin和CRT fd0继续读原维护pipe。作用域覆盖完整serve、handler/busy/worker排空和lease释放；先恢复旧标准句柄再关闭NUL，成功恢复后才发送closed确认。未dup2、未关闭原pipe、未改原Owner或安全设置。修复对照里chooser先完成取消，维护读取之后才释放。两项Python定向测试、实际句柄/异常恢复及只读架构复核通过。

正式三种用例的原生控制只使用原窗口按钮，不发送控制observe输入帮助弹窗启动。已知失败使用任务自有的坏SHA样本，成功使用有效本地PNG，所有结果与真实原exporter、UI回执和物理输出交叉匹配。取消和失败均没有输出；成功恰为PNG+来源文件两项。没有重跑此前145项Next/11项宿主整组或96变体验收。

## 库存恢复与工程保护

恢复前选中工程68a5dccc481a8588，路径 `D:/code/shidai3/P4000/colony-flow-food-hunt`。旧连接来自2026-10-15，指向127.0.0.1:12219；路径/指纹一致，实际ECONNREFUSED，原日志明确asset.list连接拒绝。没有猜端口或改连接文件。

用户随后明确授权自行启动/修复Creator Bridge并可正常重启服务。先核对无现存Creator/Dashboard实例，冻结该工程267个原修改文件与暂存/工作patch，再用原 `creator start --project 68a5dccc481a8588`。原Dashboard2.2.2启动Creator3.8.8一次，原Bridge自行更新连接到12625，新session=d4e9a8b9-39e9-4e6b-8fe5-3c237b04c42d；路径、指纹、版本、会话和端口连通性均核实。

Creator23740与原Dashboard22140继续运行供该工程使用，没有重复实例。Bridge及原Dashboard调试入口均只监听loopback，未改防火墙/账户/安全设置，未操作7470/7471。原267个修改文件SHA、暂存patch、工作patch、Git状态和HEAD完全一致；未直接编辑.scene/.prefab/.meta，也未执行安装、资源导入、模型或游戏业务写入。

## 当前源码、运行与授权记录

- Next Python修复：b82ef5934aa1d4978310f72f32f15e809f45d2c9 / .85；后续为文档检查点。正式静态仍为未变的e2367be/.83，产品版本1.3.173。
- 宿主：3b35cb9、6ff44f5574ed2f1b81741e86c3ca1210c6c0085a。当前Node25 daemon PID20116，runtime SHA35225eb5ddb4d415457a9cad960c8e22d14c4b4a0de321fb8b8aa51adc4af699。
- 本轮只重启以加载自有Python修复，bundle/map、CLI、静态均未替换；CLI SHA6085072c7c9c7901b1a77d9392785209f9b80c00334a509afd9947f72cde87b8保持。
- 最初停止命令被自动审批按旧“不重启”限制拒绝，未执行且立即恢复原标签；收到新的明确服务重启授权后，重试同一原guarded流程成功。没有通过替代方式绕过拒绝或守卫。
- 原cocos-mcp22项并行修改逐字节保护，重叠文件等于冻结原字节+任务增量。原Owner源码pins、package/lock/CLI、六个静态哈希保持。Next工作树已提交；未推送、发布、上传或安装。
- Owner当前使用显式进程配置及任务隔离缓存，未持久写启动或客户端配置。后来独立启动daemon仍需同样明确配置，缺失时返回OWNER_UNCONFIGURED。该测试缓存含明确标记的坏SHA样本，最后只选择有效样本。

## 证据

目录：`C:/Users/33272/AppData/Local/Temp/companion-owner-host-implementation-20261018`。

- `directed-formal-proof.json`、`directed-{cancel,failure,success}-proof.json` 与同名PNG：正式页面三种结果、原生按钮及物理输出。
- `directed-success/`：真实PNG与.source.json；`directed-cancel/`、`directed-failure/`均为空。
- `native-inherited-stdin-{before,after,proof}.json`、`native-nul-{stdin,window}-proof.json`：根因及修复因果对照。
- `native-stdin-deploy-approved/`：新授权后的全零快照、guarded停止、旧及owned进程退出、原CLI启动/ui与原标签实时恢复。
- `bridge-recovery/creator-start-result.json`、`inventory-before-start-captured.json`、`inventory-after-start.json`、`real-inventory-proof.json`、`real-inventory-page.png`：旧503原因、新连接、原AssetDB交叉核对及正式页面。
- `bridge-recovery/project-protection-{before,after}.json`及patch：267个原工程修改保护；`listener-proof.json`验证loopback。
- `final-protection.json`、`live-observation.json`：旧22项保护与最终空闲业务/unknown状态。
