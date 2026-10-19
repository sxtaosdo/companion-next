# 三路只读收口（2026-10-19）

状态：限定只读核对完成；非全部迁移完成。三个现有独立代理确实并行审阅，UI登录因单pending code串行。default_project_review负责状态UI及生命周期证据；next_log_sse负责知识链；credential_architecture_review负责候选装载依赖。没有新增功能代码。

## 当前状态与生命周期、Preview

实际安装包全局status会读connection.json、探测creator.projectInfo，并更新内存连接缓存/断连状态及观察日志；并非纯内存读取，但不会启动、聚焦、停止或修改工程。Creator getProjectInfo仅返回身份信息。P1060开发暂停不禁止此类只读查询，撤回前次过严判断；单工程GET /v1/projects/:id/status也存在。

当前真实两次status均7个error。UI的ID、名称、中文标签、rawstate及版本缺省全部对应（14次版本字段比较，不是14工程）；error不算stopped。一次真实手动刷新后同页折叠保留，未承诺跨整页保存。首次验收脚本在折叠后读取v-if详情导致定位超时，修正脚本后通过；累计session POST2次，未伪装成一次。业务/Creator生命周期/模型操作0，blocked/pageErrors0，自有Edge关闭。#3按有限主流程关闭，不推及ready转换/长时同步。

default_project_review复核原三组真实Preview/UI/canvas证据SHA，start200/runningtrue/canvas可见、reload200/connections1、Profiler200/848 samples成立；相关五个Next源码文件从既有验收到当前无差异。安装宿主Preview转发相同，但准入守卫已变化，因此仅复用既有真实验收，不称为新宿主重跑。#8按有限主流程关闭；Creator3.8.8无官方Preview stop，不新增需求。来源：preview-profiler-approved-20261018.md、remaining-real-acceptance-20261018.md、windows-focus-fix-20261018.md。

#6仍部分：真实Next聚焦与OS前台证据保留。setup/恢复脚本启动、停止不能代替Next主按钮；最小后续是自有fixture的Next启动→重启→停止，不扩大到全部错误分支。本批未执行。

## 知识文档链：当前身份阻塞

真实知识status200，唯一kb/list请求401/top-level AUTH_MISSING；文档/分片/原文读取尚未开始。读语义端点为POST，不应因方法名当作业务写入。未遍历1647原资料，未归档正文，未改用高权限身份或重试越权库。

实际安装companion-daemon.js.map中的knowledge-isolation.ts:40–43在构造时记录credentialFile，:66–67缺引用直接抛AUTH_MISSING，发生在worker读取之前。daemon在启动时从COMPANION_KNOWLEDGE_CREDENTIAL_FILE构造适配器，未发现热更新入口。既有连接脚本引用D:/services/weknora/cli/private/pilot-recovery-reader.dpapi，文件存在620B；仅查元数据，未读取blob/密钥。上次启动脚本继承环境，未明确恢复该引用。故本次错误已定位为实例缺启动凭据引用，不是已证明密钥损坏或scope403。

以后在已授权且安全的应用重启中携带同一个现有文件引用，再仅核对允许KB内一个小文档→一页chunk→满足元数据小文件条件的原文；不扩大身份/范围。本批没有重启修复。原始脱敏结果位于Temp/companion-next-knowledge-document-chain-20261019/{incomplete.json,RESULT.md}。#19保持部分。

## VS Code候选：依赖通过，部署路径有具体缺口

隔离候选dacb89b67c2fa197a357b049510b996f3cccdc3c /0.3.148干净，直接父版9b8f979/0.3.147；16文件补丁及33文件清单、源码绑定、4构建载荷SHA全部匹配。33文件manifest SHA256：2719a1b326f2b2f749fde8d177f321270095b987877d60ec09e0bd5d9ddaff70；source-bindings SHA256：5fae83a3cf425049947544fe6f6642297ddc7ea93b87948d323cf051bd38dd7f。

复用114/114及类型/构建既有结果，没有重跑全套。依赖声明和lock依赖未变，无安装；最小替换仅companion-daemon.js及map，CLI无需替换。候选配置实现外Native六模块、atomic/security均与安装包一致。共享22处修改、21受保护源码及308其他运行文件须保留。本批未部署、未改配置、未重启。

具体缺口：正常close在验证本进程lock身份后会unlink当前boot lock；但普通guardedClose和信号关闭均要求UNKNOWN/各计数为0，现有历史UNKNOWN2在close前阻止关闭。若用已授权进程强退，会留下10820的boot lock；候选只具旧previousOwner7832的单次legacy handoff，不能接管后继锁。单改previousOwner为10820又与legacy lock仍为7832冲突。需要精确证明已退出后继writer及交接回执路径，保留UNKNOWN与关闭守卫，不能删锁或清UNKNOWN绕过。相关位置native-drain-controller.ts:203–224、native-epoch-journal.ts:244–254、native-boot-authority.ts。此批仅依赖核对，不实施扩展维护框架。

候选部署与应用重启已经授权，不应再问同一授权；当前批明确不执行部署/重启，且上述代码路径需先解决。真实VSCode写入/连接仍未验。候选持久交付：C:/Users/33272/Documents/Codex/2026-10-17/task/companion-vscode-format-candidate-20261019。

## 版本与边界

实测运行PID10820，epoch7601ac9d-a500-46d8-8db0-9a0f28e7569c，OPEN，Native awaiting/uncertain0、历史UNKNOWN2不变。宿主仍9b8f979/0.3.147，已部署Next仍ecabe7e/内部1.3.173.131、页面1.3.173；当前Next源码与部署版src无diff。本批仅文档/脱敏证据，未触碰用户窗口、旧数据、真实客户端配置、Creator或模型。

统计从8/11/2更新10/9/2，仅#3/#8闭环；47.6%是21组等权通过率，不是工程工作量进度。仍有实际宿主锁交接代码缺口、知识实例凭据引用缺失，以及已实现功能的最小真实操作待验。不能宣称新后台已全对齐旧后台。
