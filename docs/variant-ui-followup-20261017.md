# 96×96 变体：真实 UI 复核与后续边界

2026-10-17 07:51 UTC后续：Owner另行批准的尺寸变体“导入当前工程”入口已完成本机代码、部署及新独立任务真实验收，当前事实与唯一计划见[新增入口交付](variant-ui-import-20261017.md)。下列各段保留原时间，“当时未实现”不代表后续仍缺失。

状态：Accepted（本机事实及交接记录，不代表完整产品验收）

## 05:40 UTC 四个已有写按钮闭环完成

按明确的既有授权边界，官方同一Creator主进程自行建立的回环通信不视为新增局域网开放；7458仍是唯一获准全接口监听，其他非回环监听立即停止。不调用未知11097接口，不改绑定、认证、防火墙或系统权限。先核对原新任务仍selected/r3、import为null、目标不存在、原1024母PNG及96导出SHA一致，再继续同一任务，没有重新采用或换任务。

任务`STUDIO-RUN-icon-mvby1nsy-a46a962c`已从真实Next完成采用、候选显示/选图、CPU96×96导出、1024母图导入，四个写POST各一次、全部200。母图导入POST于05:40:17.892 UTC发出，原操作`icon-import-cc3f8d6093fd310e63864eb8e39b799e`经STARTED和VERIFICATION_PENDING只读推进至`imported_pending_verification/r6`，effectApplied=true、leaseState=RELEASED；没有因中间状态重发。账本独立核对asset_import=SUCCEEDED、dispatch=TERMINAL、fence9租约RELEASED。真实设计视口仍1440×1080，正常原会话、禁浏览器GPU、无mock，页面错误/被拦请求均为零。

实际母图为`assets/art/coin-pouch-next-ui-20261017.png`，1024×1024、522068字节，SHA `7100b11dd00bceb72147a606b1f048949a86f2ec3a9e253950fb3932ee83a756`；meta SHA `8b37c2b53e5b5a39a9b6362de5090d2fb693488cb5240bd86c96c1b1d5b3d499`。asset UUID `95806242-61c9-4057-8be4-a233724226ce`，SpriteFrame为该UUID加`@f9941`，文件、meta及两个原资产读取工具回读一致。96派生PNG仍是另一份文件，不是母图按钮导入的内容。

Creator3.8.8本次PID23512/session `489a8a9c-311a-423c-9408-61a302080565`，AssetDB经既有只读查询3次就绪才发送导入。观测到0.0.0.0:7458及同一已核主进程的127.0.0.1:2938/2950（2950有Bridge日志），没有额外非回环监听。完成即官方停止并核对全部自有进程/端口关闭，Edge关闭。窗口保守计34.289秒，跨尝试累计381067/1800000ms，剩余1418933ms、active=null；原daemon PID4092保持OPEN、零在途、unknown=[]。旧task/冻结元数据/manifest/部署入口及Owner共享dirty保持；记录前46个原跟踪文件和7个原settings一致，之后只归档任务资产与文档。

物理资产及回执已精确提交隔离仓`e182b6b2bd72d42f72fbbcf128e18319ee94a016` / `0.1.0.11`，仅原settings保持未跟踪。后续交付更正检查点为`796a233a424749ac0baecf5c7001a514ac8ef2d6` / `0.1.0.12`，只追加审计事实，不改物理PNG/meta。写入原sourceRevision仍为`a2ff18a013608dadf47b624eb58fba587b754fc7`，不重标为证据HEAD。提交后实际只读status仍返回r6和原导入收据，显式historyOnly指向e182b6b；新旧task字节都未因读取改写。历史任务写保护是预期结果，不能再导入来测试按钮。

- [四按钮原始回执、账本与收尾汇总](evidence/next-buttons-mother-20261017.json)
- [已查看的真实导入页面截图](evidence/next-buttons-mother-20261017.png)
- 截图仅作上述本地交付。曾误沿用更早Library交付要求上传一张截图，随后按本轮“无云外发”限制将该新建文件移入Library回收站，撤回操作成功，停止后续上传；不声称传输未发生或底层物理清除。汇总JSON保留原上传事实并追加撤回状态，完整回执存外置目录。

这是可信PNG离线采用分支的四个已有按钮及母图文件/资产闭环；真实GPU生成/enqueue未执行，新母图未新增场景、Preview或Build验收，既有96变体的运行证据继续按原sourceRevision保留。新增尺寸变体UI仍未实现，productionVerified固定false不变。本轮没有业务源码缺陷需要修改，修正仅在验收脚本；不重建部署、不改未知并行停服脚本、不操作冻结UNKNOWN、push/tag/父pin或关机。以下旧阻断及预算记录保留各自时间事实，已由本节推进。

## 05:35 UTC 11097监听只读归因

本轮仅查询既存进程/端口记录、项目日志、已安装Creator源码及文件版本；没有再启动Creator、连接端口、调用API或申请新增授权。以下结论替代把所有非7458端口视为新增局域网暴露的粗粒度判断；不会因此直接放行未归因的服务。此前提问不作为本轮启动依据。

| 项目 | 可证事实及限制 |
| --- | --- |
| 进程归属 | 05:21:54.911 UTC的TCP监听快照记录PID3356、127.0.0.1:11097。原启动回执和创建时间05:21:40.7950540Z将其绑定到本工程Creator3.8.8主进程；不是据端口号猜Owner。 |
| 具体用途 | 尚未确证。可读launch源码初始化了内部ProcessMainManager，但没有把11097关联到它；不能据此认定为正常IPC、持续服务或异常服务。只有一次正样本，也不能排除启动期临时端口探测。 |
| 协议 | 已证TCP/IPv4；HTTP、WebSocket、消息格式及具体监听调用均未核明。 |
| 认证 | 未核明，不能声称有token/会话鉴权，也不能断言匿名访问。没有读取connection/token、账户或凭据文件。 |
| 外部直接可达 | 观察到的socket只绑定127.0.0.1，没有绑定LAN接口；不能称为新增LAN或公网监听。未证明有外部直接可达路径，本轮也没有做主动探测；不据此保证主机所有潜在代理/转发路径不存在。 |
| 与7458的区别 | 7458为原批准的0.0.0.0监听，累计窗口仍有1453.222秒；工程未变、预算未耗尽。11097是同进程的另一项回环监听，不等同于扩展7458的全网卡授权。 |
| 与Bridge的区别 | project.log第4行明确原Bridge为127.0.0.1:11105。该Bridge是既有安装目标；没有证据把11097也认作Bridge。 |

安装包`C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar`的package及EXE文件版本均为3.8.8。只读ASAR索引确认`launch/dist/launch.js`加载`@editor/process-message`并注册`ProcessMainManager(process)`；该入口SHA为`33bc605c2d7b5ed23fbea2aa5b29f79bd91d8e71fa862c467b7435eac51b219e`。实际process-message管理器及creator的network/message/startup关键实现为不可读`.ccc`文件，未解码或执行；unpacked目录也没有对应可读实现。可读`v-electron-channel`使用Electron ipcMain，仍没有11097关联。项目日志仅387字节，只有引擎初始化和11105 Bridge监听，没有11097协议/认证记录。

因此本轮已核清“本工程Creator主进程、TCP回环绑定、与已知Bridge不同、不是已证LAN扩权”，但具体服务模块及认证仍缺少可读实现或既有明确日志，不能虚称用途已确认。最小进一步证据应直接关联模块、监听调用及认证处理；不靠再次启动、猜测端口号或泛化白名单代替。05:30:55 UTC再次只读核对Creator为0、旧身份无残留、7458/11097/11105无监听。预算仍346778/1800000ms、active=null；新任务selected/r3和母图POST0保持。

[机器证据、ASAR偏移/文件SHA及只读边界](evidence/creator-loopback-attribution-20261017.json)。code-mapper与reviewer任务分别为`/root/resource_source_git_mapper`、`/root/window_budget_reviewer`，普通子代理prompt-emulated，硬只读隔离未核验；两者均未运行进程、连接端口或修改文件。主会话保存证据和文档。

## 05:25 UTC 已有按钮真实写验收

本轮获准在既有隔离工程中使用独立新任务，实际点击已有采用、选图、尺寸导出和母图导入按钮；不实现新增尺寸变体导入UI。新任务`STUDIO-RUN-icon-mvby1nsy-a46a962c`绑定工程`a79f4915296f4091`、HEAD `a2ff18a013608dadf47b624eb58fba587b754fc7`，新目标`assets/art/coin-pouch-next-ui-20261017.png`。原保存v2配置版本1及SHA复用，不改配置；仅采用原manifest的`coin-pouch-existing-20261010`，无生成、云调用、费用或新凭据。

1440×1080真实正常会话Edge、禁浏览器GPU、无mock，以下已有写按钮已实际逐项确认：采用POST一次（awaiting_selection/r2），候选1024图显示并校验后选图POST一次（selected/r3），自定义96×96 CPU导出POST一次。三个写请求均200，无页面错误/被拦请求；采用完成后从历史明确读取同一新任务继续，没有重发采用。导出文件`art/final/companion/coin-pouch-next-ui-20261017-96x96-7100b11dd00b.png`为7391字节，SHA `fe10e97c530d9cd03908e77dddaa9413a8284baab8c22bb461e7bb05b4638654`，收据SHA `32e9bc205742cb9a4c4039b2c6287afbf89a29c6ab95893d1985277ba0f663aa`；母图SHA仍`7100b11dd00bceb72147a606b1f048949a86f2ec3a9e253950fb3932ee83a756`。文件与回执已实读核对，CPU导出没有导入Creator。

母图导入确认页已打开，但导入POST为0。先启动原Dashboard-backed隔离Creator3.8.8（PID3356、session `4cad55e0-c5ce-44c7-bcb5-4880d690d54a`），仅7458守卫在导入前发现自有额外`127.0.0.1:11097`监听并关闭本轮进程树。该端口用途未核明，不能冒认为Bridge；project.log随后明确记录原Bridge监听`127.0.0.1:11105`。守卫原错误字符串为`Unexpected wildcard listener`，但本次实测额外地址是loopback，不能称为公网监听。由于本轮“不得扩端口”的明确要求，先请求精确澄清；前一条误把11097称为Bridge的问题已更正，不能据它继续执行。新目标PNG/meta仍不存在，任务保持selected/r3，不重导既有成功变体、不重放UNKNOWN。

原API停止及绑定本工程PID/创建时间的收尾已确认进程树和7458关闭；没有11097/11105或自有监听残留，独立Edge关闭。此次保守启动至全关闭计20.524秒，累计346778/1800000ms，剩余1453222ms，active=null，账本锁已释放。冻结旧工程元数据、旧成功task、manifest、46个原跟踪文件及7个原未跟踪settings逐字节保持，运行Next与共享源码不部署。为继续同一任务核验，隔离工程HEAD保持原a2ff18a，新增CPU导出文件/收据暂不提交或清理。

两次早期自动化失败均保留：首次停于Element Plus隐藏input（零业务写）；第二次采用已成功但自动化在前端回执处理完成前切页，未自动选中历史任务，随后通过原历史显式继续。没有将这些脚本失败当成应用Bug或成功验收。主会话根据reviewer的只读发现，在启动前修复了验收脚本的提前关闭、终态身份顺序和独立清理问题，并核对身份检查顺序及语法；非业务代码修改。当前真实剩余门槛是Creator原本机监听范围澄清后的单次母图导入，不是productionVerified字段，也不是重做前三项按钮。

- [三个按钮的真实回执与保护摘要](evidence/next-existing-buttons-real-20261017.json)
- [CPU导出真实页面截图](evidence/next-existing-export-real-20261017.png)（已查看，回执可见；截图时页面仍展示操作清理提示，不作为锁最终释放证据）
- 完整尝试、逐请求正文、失败截图及累计账本：`C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/interface-load-20261016-phase2/recovery-20261017/isolated-import-20261017/e2e-30min/attempt-04-ui-buttons`。

## 05:10 UTC 可使用范围与明确剩余项

当前可用的是已有隔离任务的真实历史、状态和96×96变体PNG查看。单张变体的API导入、场景保存/重开、Preview、Profiler、WebMobile Build与固定产物Smoke均有真实证据，但变体导入不是从Next页面发起。Next尚无`import-variant`写入口，因此“在Next完成96×96导出并导入Creator”仍缺少这一项接线；不能把读图通过描述为完整页面写流程通过。

### 现在查看已验资源

1. 使用原Companion的`creator-ai ui`正常会话入口；已登录的同源浏览器可直接进入[隔离工程资源第六步](http://127.0.0.1:32180/next/index.html#/resources?project=a79f4915296f4091&step=6)。如会话无效，回到原入口重新打开，不复制认证码或Cookie。当前服务仅监听127.0.0.1。
2. 核对工程ID`a79f4915296f4091`，点击“读取 / 刷新任务历史”，选择`STUDIO-RUN-variant-isolated-20261017-27c2be4f`并读取原任务。
3. 查看独立变体导入摘要，再点击“预览此变体”。应显示96×96钱袋、文件SHA `fe10e97c530d9cd03908e77dddaa9413a8284baab8c22bb461e7bb05b4638654`；母任务仍为selected/r6，变体为imported_pending_verification。历史只读提示和禁写是预期行为，不应重新导入。

真实页面截图见下节两张已验截图；[Library中的实际Preview截图](https://chatgpt.com/api/library/files/libfile_49e9aeb37f28819186fd6d3ee34cf950/download)已交付，不重复上传。这份历史读取不启动Creator，也不证明当前Creator仍在线。

### 新任务流程：实现、实测和缺口分别记录

| 操作 | 当前实现 | 本轮真实验收边界 |
| --- | --- | --- |
| 单图准备、inspect、enqueue或采用可信PNG | Next已有入口；需当前工程HEAD、已保存v2规范；采用来源限登记manifest | 05:25已从真实页面采用一次并检查新目标；生成enqueue未执行，采用不接受任意本地PNG路径 |
| GPU运行/恢复原任务 | Next已有run-next/resume，逐次批准，UNKNOWN只查原操作 | 本轮未从Next执行真实GPU生成，不新增启动模型权限 |
| 候选审阅、保存唯一选择 | Next已有入口，先显示并核候选SHA | 05:25已从真实页面显示1024候选并保存唯一选择一次 |
| 导出默认或自定义96×96 PNG | Next已有export-variant；封存v2规范、唯一已选母图、CPU缩放、禁止覆盖 | 05:25自定义96×96真实确认一次，PNG/收据SHA及尺寸已实读 |
| 导入已选母图（1024） | Next已有import，按钮和确认均明确母图 | 05:40真实按钮一次导入，原操作SUCCEEDED/TERMINAL、租约释放，PNG/meta/Asset/SpriteFrame回读一致；不导入96×96变体 |
| 导入96×96变体 | 后端import-variant及原操作查询已实现、单张真实导入已验 | Next缺少对应写操作合同/确认/接线；这是具体功能缺口，不只是缺一项测试 |
| 查看已有变体摘要和PNG | Next已有受限只读variant-preview | 04:38真实同源页面已通过，零业务写入 |

普通新任务在当前HEAD、已保存规范、合法会话和原服务可用的前提下，可按资源步骤准备/采用→生成（仅需要时）→显示并审阅候选→保存选择→导出其他尺寸（96×96）操作；05:25真实采用/选图/导出已按上表补验，生成仍未执行。原隔离历史任务禁止写入，不能用来测试新动作。要实现页面内尺寸变体导入，最小后续切片是原步骤5的domain输入/回执、adapter、store确认与UNKNOWN保护、面板和定向测试，并复用现有后端；本轮未新建导航、导入向导或另一套执行器。

### productionVerified不是无限待办

实际Studio `companion_api.py`任务快照与变体结果固定写`productionVerified:false`；Next `src/domain/ai-jobs-read.ts`要求收到false并返回false，后端schema同样只接受false。当前没有已实现的置true接口。独立`productAcceptance`投影也不会修改该字段。它是现行协议禁止自动宣称生产验收的固定策略，不能据此重复导入、重跑Creator或无限延长验收；已通过的场景、Preview、Build及Smoke按各自来源/产物SHA记录。真实Next写流程和缺失的变体导入入口仍按上表处理，不把固定false当作这些缺口的代称。

### 源码整合和类型检查归属

此前共享main整合待办已经完成：资源代码`8f169c709d7b731b2753fbd4ea9390c7b0c5ce86`，合同`4fcfe82717da3f4a84f4e3117217366bffb93b4b`。独立索引树165/165图标测试及TypeScript通过，两份实际资源源码与运行sourcemap一致；22项并行dirty仍保持。权威边界见[共享源码整合记录](../../cocos-mcp/mcp/docs/resource-api-source-integration-20261017.md)。本次纯文档澄清不重建部署，运行Next代码仍为caf14fb/1.3.173.18。

混合工作区的`mcp/tests/stop-previous-daemon.test.ts:2`以静态TypeScript导入`../scripts/stop-previous-daemon.mjs`，而NodeNext/strict及tests包含规则下没有同名声明，产生TS7016。整合前检查点已记录脚本和测试为未跟踪；`build-companion.mjs:62–63`直接调用该脚本，归属并行构建/停服生命周期候选，具体执行者/Owner尚未核明。最小type-only修复是由该候选维护者新增`mcp/scripts/stop-previous-daemon.d.mts`，精确声明`companionDaemonBundlePath(root?: string): string`、`commandRunsDaemon(commandLine: string, daemonPath: string): boolean`、`locatorPath(): string`和`stopPreviousDaemon(): Promise<void>`。无需改JS/test/tsconfig或运行构建/停服。本轮依要求只读定位，不吸收该并行文件，也不以放宽类型检查掩盖错误。

本轮只读审查真实任务为`/root/resource_source_git_mapper`（Next流程/固定策略）和`/root/window_budget_reviewer`（TS7016归因/最小修复），均为普通子代理的prompt-emulated职责，硬只读运行隔离未核验。未发现本任务自身新增接口/测试缺陷；仅修正旧文档中已过期的“源码待整合”和验收范围描述。未操作Creator、UNKNOWN、真实写任务、旧Windows UI/生命周期、服务启停、push/tag/父pin或关机。

## 04:38 UTC 本机交付：已解决 409 与变体 PNG 缺口

Next 功能检查点 `caf14fbf997ef1b2cc18aa5e4d0a980885df9882` / `1.3.173.18` 已构建并精确部署六静态路径，产品版本仍为 1.3.173；index SHA `8ac97a787d9a8bf19c79b48e1bde144eeef74118098e2ae82e6c8bc2251a2eac`。以下旧阶段的失败证据保留，后端协调项已由本节实现替代。

实际服务使用的 Studio 是外置工作树 `C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/studio`，不是较旧的 P9000 main。功能提交 `6cb7c092e1f5a4fe5b063692f236cba80167cd61` / 0.0.0.41，合同提交 `7e117fed6c3d3733b11f9c52a4c56b89ff365238` / 0.0.0.42。仅 jobs/status 可在 HEAD 变化后读取历史，返回原 sourceRevision 与显式 historyOnly/currentSourceRevision；来源、候选及派生证据仍校验，母图 candidate 和写入仍要求原 HEAD，task.json 不写回。

Node 从此前已审查的实际运行源码快照增量构建，新 daemon bundle SHA `f3323c72165a2d2f28f3faf89b3c5811e5df1dafee384303db0bf84811970e70`。`variant-preview` 只接受原 jobId/operationId，读取持久绑定并核 PNG、尺寸、母图和文件/收据 SHA，不调用 Creator、不重导出或导入。Next 在原资源面板读取，另核身份、尺寸、CRC、SHA；历史或已有变体任务均暂停写入，换工程/任务取消并隔离迟到结果。

04:38时共享cocos-mcp main较旧且有22项并行dirty，当时只将运行增量补丁、完整测试快照和受限接口合同保存到隔离验收仓`tests/fixtures/mcp-readonly-patch/`。05:03已精确整合本任务资源源码，详见上节及共享源码整合记录；没有覆盖并行差异。两份候选bundle、输入SHA清单和旧四文件备份继续保留。

完整受影响校验：Python 三份模块 80 测试通过（1 项原有跳过），MCP 八份图标模块 140 测试通过，Next 23 份 AI 模块 948 测试通过，TypeScript/Vue 类型检查和 workspace 构建通过。prompt-emulated reviewer `/root/window_budget_reviewer` 发现并复核修复三项 P2：变体完成后的直连写入、generated 历史 candidate、两次 status 间 HEAD 变化时导出。OCR Delegation 清单与共享规则由宿主审读，未称为 managed PASS。

同一 127.0.0.1:32180 服务更新前确认原 PID16140 OPEN、全计数零、unknown=[]。官方 stop 绑定原身份与 generation，确认原 PID 退出后替换四 bundle，保留旧 hash 静态并原子切换入口。首启错误使用 Node22，与既有 better-sqlite3 ABI141 不匹配（Node22 要求127），无残留监听/实例；以原 Node v25.2.1 唯一重试成功，新 PID4092 OPEN。未安装或重编译依赖，回滚只在核清当前身份/产物后恢复已备份四文件与旧 index，并用原 Node25 官方启动；不重跑旧停服脚本、不裁决 UNKNOWN。

2026-10-17 04:38:40–04:38:44 UTC，正常 `/v1/ui/session` 入口、独立禁 GPU Edge、1440×1080 视口，真实同源 jobs/status/variant-preview 全部 200。旧任务仍 selected/r6，变体仍 imported_pending_verification/RELEASED；界面显式只读，母图读取禁用。PNG 自然尺寸 96×96，SHA `fe10e97c530d9cd03908e77dddaa9413a8284baab8c22bb461e7bb05b4638654`，收据 SHA `041737637fee9ef00d955abaffeee9572fce18198a0ea5fe8eb30569f965e457`，已实际查看钱袋图像。业务写入、被拦请求、HTTP 错误及 page error 均为零；浏览器关闭。原 task SHA `181095392e02d8b08a368ef725fc34629bb804f29710a18d991f724a4da69126` 前后相同。

- [真实历史列表截图](evidence/variant-history-real-20261017.png)
- [真实变体图像截图](evidence/variant-png-real-20261017.png)
- [无凭据页面及请求回执](evidence/variant-readonly-ui-20261017.json)
- [本机受控停启与产物身份](evidence/variant-readonly-runtime-20261017.json)
- [六静态文件与源码身份](evidence/variant-readonly-static-20261017.json)

这是隔离工程现有资源面板的实际读取与图像闭环；保存 PNG 不代表当前 Creator 资产回读或生产验收，productionVerified=false。没有新增业务流程或重做编辑器。

WebMobile Smoke 也已通过：04:11:49–04:12:20 UTC，使用既有固定构建、fresh lease/fence8 和新 render-ready 操作，750×1334 实图已查看，四类完整原始诊断数组均为空；独立浏览器、12189 服务及租约关闭。首个未派发 schema 错误、第二次过早空白截图均保留，不冒充可见成功。构建 sourceRevision 仍为 `f19564bda642374b7780a00b19d9c86cf72185d7`，无 Creator/重建/重新导入，预算仍 326254/1800000ms。核心 Smoke 回执、原报告及截图已进入隔离验收仓 `tests/fixtures/build-smoke-*`，新增六项只读证据检查通过。

本次已有变体的真实读取切片无阻断，共享main资源源码整合也已完成。新任务写流程实测及Next缺失的变体导入入口按05:10范围表分别列明；不能将本次读取切片扩大为完整页面写流程通过。未push/tag/父pin，未关机。

## 03:55 UTC 旧阶段记录（已由上述交付推进）

## 已实现与验证

本地代码 `c3b1fd1a8adf27c21018ff314e01eb666305d378` / `1.3.173.16` 读取现有 `jobs/status` 的独立 `variantImport` 摘要，展示原操作、状态、写入效果、租约、尺寸、文件/收据 SHA 和目标。母任务可仍为 selected；页面保留该事实，存在变体记录时暂停此任务的全部写操作。路径兼容合法点名，拒绝独立 `.` / `..`、编码、查询和外部 URL。`productionVerified` 保持 false。

23 份受影响 AI 模块、936 项离线测试通过，Vue 类型检查与 workspace 构建通过。类型检查最初发现新增合成测试的泛型推断错误，已修正；修正仅为类型注解，复用行为测试覆盖。首次受限 shell 在临时缓存 rename 返回 EPERM、未运行测试；已在授权正常主机对同组离线验证重试。reviewer `/root/window_budget_reviewer` 为普通子代理的 prompt-emulated 职责审查，硬隔离未核验；一项点名兼容 P2 已修复并复审。OCR 使用 Delegation 文件清单/规则及宿主审查，不称为 managed PASS。

03:55 UTC 时新前端未部署，当时运行中的 Next 为代码 `5419ace06f5f25f4a3f4300dcfab2a85255edc68`，index SHA `4717a68ace5df9c95fe65ca67783b85d1069d95e83de053d7e618fccfc9808ab`。

## 实际浏览器结果

2026-10-17 03:54:59–03:55:01 UTC，使用原 `/v1/ui/session` 正常入口进入独立临时 Edge；未读取/保存认证码、Cookie 或传输凭据。1440×1080 单一设计视口，禁用 GPU，同源真实请求，无业务 mock；仅允许 GET/HEAD 及该隔离项目有限只读 POST。

页面正确显示工程 `a79f4915296f4091` 和路径，进入资源第六步。点击“读取 / 刷新任务历史”后，原 GET `/api/icons/a79f4915296f4091/jobs` 返回 409，UI 显示失败，没有将失败变为空历史或任务完成。没有写请求、被拦请求或 page error；独立浏览器已关闭。

- [真实页面截图](evidence/variant-resource-ui-20261017.png)：SHA `ab2bb1bf29f14f973df79ed41d1fa293d4068368255ec717256d33637d655a81`，已实际查看。
- [浏览器请求及结果](evidence/variant-resource-ui-20261017.json)：只记录无凭据的路径、状态和页面文字。

03:55 UTC 当时本切片的资源 UI 验收未通过，以下保留原失败；04:38 UTC 已按本节真实接口重新验收，没有使用旧 JSON 伪造页面。

## 精确后端协调项

只读 `jobs/status` 返回 `REVISION_MISMATCH`。Studio 当前 `companion_api.py` 的 adopted 路径经 `snapshot → candidates → validate_adoption_inputs → validate_request` 要求保存的 sourceRevision 等于当前 HEAD；README/protocol 明确规定此检查也适用于读取。提交后旧任务不能查看，单个旧 adopted 任务也会中断历史列表。这是既有安全合同缺少 history-only 读取能力，不能直接移除 fence。

由 Studio Owner 协调的最小文件：

- `P9000/ai-game-studio/project/tools/local-icons/companion_api.py`：分离只读历史摘要与可操作快照；保留 candidate 内容、select、prepare/finish-import 的当前 HEAD/来源证据校验。
- 同目录 `protocol-v1.json`、`README.md` 及相应测试：定义 stale/history-only 的字段和动作边界。原任务记录、sourceRevision 和导入状态不得改写。
- 若引入新摘要字段，Companion Owner 同步 `P8000/cocos-mcp/mcp/src/companion/icon-adapter.ts` schema，并与 Next 对接显式 stale 写保护；不得在共享并行 dirty 上直接覆盖。

只读 `variant-import-status` 对同一 operation 返回历史 `reportedResult=imported_pending_verification/effectApplied=true`，但当前 `query=import_unknown/UNKNOWN`：Creator 关闭，资产实时回读连接失败。历史成功与当前查询分别保留，不能因此重复导入或宣称当前资产不存在。

变体图像也未接通：现有 `candidate` 返回 1024 母图；`readVariant` 只返回经过 PNG/尺寸/文件及收据 SHA 校验的元数据，未提供 PNG 字节。最小后端文件为 `icon-adapter.ts`、`icon-image-assets.ts` 及对应测试/合同，增加受限只读变体图像接口后再接 Next。不得用 `import-variant` 写路径获取预览。

## Runtime、Library 与 Build Smoke

隔离工程权威证据在 `P8000/local-tests/creator-ai-variant-import-acceptance-20261017`：HEAD `aae735afc76793186c9e100179f75425caffad28` / `0.1.0.8`，已保存场景并跨 Creator 会话重开、Preview 实际可见、851 样本 profiler 无 error/warn findings、WebMobile 构建通过。产物 sourceRevision 仍为 `f19564bda642374b7780a00b19d9c86cf72185d7`，不改写为后续文档提交。

WebMobile package SHA `ee8e5ba469e2f11205f2008de2767e1493c35ddc2794287015dcc12421bb5fbb`，index SHA `058b167898f99c4e2cce8ad53035bc7d7dcbe406f14ec08f079acbf6a1487602`，本轮 CPU 复核一致。现有 `build_smoke` 会在 `127.0.0.1` 临时端口只读提供固定产物，使用独立浏览器并自动关闭服务；不需重启 Creator、导入或重建。

03:55 UTC 当时 Build Smoke 已准备、尚未执行：另一任务使用 GPU，窗口释放确认仍待协调。一次性脚本 `postbuild-ui-20261017/build-smoke-ready.mjs` 要求一分钟内的明确 GPU gate，使用原 tool、fresh lease 和固定 operationId；UNKNOWN 只查询原操作、不重放。该文件位于下述外置证据目录。

真实 Preview 截图已成功保存至 Library：`libfile_49e9aeb37f28819186fd6d3ee34cf950`，file ID `file_00000000702c820c9bad768e0d232e16`，SHA `0fde4ec06b618a47fb48714895456fa250008444220eae77c43e421da1fcc621`，750×1334。Windows helper 的本机身份标记写入失败（Python 无 `os.setxattr`）；上传成功，不重复上传。

本轮未启动 Creator，累计预算仍为 `326254 / 1800000 ms`，active=null；03:59:31 UTC 核验 7456/7458 无监听、此工程 Creator 为 0、本轮 Edge 无残留，原 daemon PID16140 身份保持。旧冻结工程元数据 SHA `9eab90dcc56b34bf217e55dea3f73ab163a91908f948f8a7001e258c3f1a6828`、adoption manifest、已部署 Next、Owner hooks/package/lock 与 PNG/meta/scene 均保持。

外置证据目录：`C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/interface-load-20261016-phase2/recovery-20261017/isolated-import-20261017/postbuild-ui-20261017`。含实际只读响应、构建基线、保护复核、OCR 清单/规则、宿主审查和一次性 Smoke 脚本。未 push/tag、未改父 pin、未重启共享服务、未操作冻结 UNKNOWN、未关机。

上述旧排队项现已由 04:38 UTC 交付节完成；保留这份记录说明真实失败及修复来源。
