# bc7afdd 候选交付清单

日期：2026-10-21。状态：**候选已冻结并完成所列验证，未部署正式后台；不是资源生成全流程完成报告。**

本清单仅记录冻结候选与只读核验结果，不修改源码、配置、任务记录或运行服务，不提交 Git。用户已取消 32181；后续唯一后台为 32180，不以重新开测试实例作为本清单的下一步。


> 更新：第6节中5852658的默认启动组合缺口已在新宿主候选c0c22c5中补齐，见第7节。正式现场尚未应用；其他未完成项仍保留。

## 1. 冻结来源与产物

- Next 源码：`bc7afddd734b8ac4d3f6e4dd87e9c49b29c5385e`，内部检查点 `1.3.173.213`。前端产品版本仍为 `1.3.173`；检查点不是新的产品发布号。
- 静态候选：`D:/code/shidai3/P8000/companion-next/dist-companion-workspace`。
- 父任务本轮独立验证：9 个测试文件、161 项通过；`npm run build:companion-workspace` exit 0。本清单未重复执行这批测试，已独立核对实际产物及以下 SHA256。

| 产物 | SHA256 |
|---|---|
| `index.html` | `d4e3f3020ddd0bcf10dc4b6c960e266dcfd36c986a4d087c5998d656025f6152` |
| `assets/index-BdeIAJec.js` | `8ccb6965dc0c6b85743f8fab24e4031e6bae60ad7189796ac91a0c2eb60df1ce` |
| `assets/index-BEUcvY70.css` | `539d74630ea187760532055397d2e8f1860f5e84f6ffef5ce6cfac2569ccc0e2` |

宿主候选来源：`585265882f0dea3ce0dfc7828a0a3225d103b988`。实际完整候选目录为：

`C:/Users/33272/AppData/Local/Temp/companion-host-repair-20261021/mcp/dist/e2e-full-585265882f0d`

该目录包含 daemon、CLI、e2e-support 三对 JS/map，以及 `host-package.json`、`product-build.json`、`candidate-files.json`。不要误用 W 的普通 `mcp/dist/companion` 或较早 `verification-product-version` 产物。

- 已独立核对 daemon SHA256：`c6cb6961931e084cc2486b828c80433de552bcfbfdbc0ff1773b549557a685d3`。
- 来源清单所列 map SHA256：`5c52022355dac12fdd96b4c56228891bd9519645f4063d6ef1fada078083f157`。
- 绑定元数据：`build.id=585265882f0d-c6cb6961931e`，产品名称 `Creator AI Companion`，宿主包版本 `0.3.142`，包名 `cocos-creator-ai-bridge-poc`。元数据中的 entry SHA 与上述 daemon 一致。
- 完整类型闭合记录：`ae80a187f32df3812a85816d79857c3f601209f7`，来源为父任务的完整 NodeNext 验证记录；不把其测试提交号当运行产品版本。

## 2. 本候选覆盖与边界

| 项目 | 已实现／已验证范围 | 不代表已完成 |
|---|---|---|
| 美术规范三分区 | 全局继承、项目设定、素材分类；项目保存引用、固定版本及差异，展示有效值与来源 | 正式宿主已启用、所有项目自动继承 |
| 五类规范 | 人物/IP、装备、技能、UI、图标；类别技术覆盖、删除覆盖以恢复继承、各类必填与适用范围校验 | 五类模型生成都可用、人物多视角一致性或完整 UI 自动搭建 |
| 保存与原操作恢复 | 有限同源 GET/POST、CAS 原 hash、服务端递增版本；请求前持久化原 operationId/范围；未知结果只查原状态，重建 Pinia/provider 不重发 | 浏览器与正式后台真实保存已闭环 |
| 旧 v2 兼容与迁移 | 严格保留旧图标配置读取；明确确认后带原 hash/版本迁移，新统一规范递增版本，旧字节不变；无隐式双写 | 已批量迁移正式工程 |
| 统一头部 | 三个资源子页统一工程选择与规范状态；任务、采集器状态按职责展示，Creator 仅在导入相关步骤显示；侧栏版本区纵向排列 | 将多个依赖合并成统一绿灯、采集器就绪等同模型就绪 |
| 前端与宿主版本 | 产品号、源码构建标识、宿主包版本分开；宿主版本只接受认证接口的构建元数据，换源／错误清旧值 | 用第四位检查点、构建基线或 Bridge 协议号代替宿主版本 |

P0001 是权威来源边界，当前后端没有配置可信结构化 scope 映射，`authorities=[]`。源码支持显式独立项目与 Canon pin/范围校验，**不能说真实 P0001 继承已经生效**。不应从文档名、自由文本或任意客户端 JSON 臆造 Accepted 权威值；不同项目不被强制套用同一母风格。

当前生成适配仍是图标固定 profile。参考图保存、预览和封存存在，但**参考图真实入模尚未实现**；人物/IP、装备、技能、UI 的实际生成验收未完成。新美术规范解析结果与现有生成调用链的最终接线，也须单独验证，不能以字段可填写替代模型使用证据。

## 3. 真实文件保存与迁移证据

证据目录：`C:/Users/33272/AppData/Local/Temp/companion-art-contract-20261021`。

| 文件 | 实证结果 |
|---|---|
| `result.json` | `success=true`；真实 backend、文件系统与 Next fetch adapter；版本 1→2→3，恰好 3 次 POST。第三次在持久保存后故意丢失响应，以新 Pinia/provider 只查询原 operation status 恢复，没有第四次 POST。 |
| `legacy-result.json` | `success=true`；旧配置版本 1→新统一规范版本 2；确认前无 POST，带 `migrateLegacy:true` 的 1 次 POST；`legacyBytesPreserved=true`，丢响应后仅查原 status 恢复。 |

这两项是**进程内 fetch 分派＋真实后端／真实磁盘契约测试**。没有启动 HTTP 监听，没有浏览器点击闭环，也没有 Creator 操作。不能改称部署后 UI 新建、保存、读取均已验收。`result.json` 中测试 origin 的 32181 只是进程内 adapter 绑定，不表示当前重新启动了该端口。

已发生的另一阶段是真实图标 UI 出图、PNG 预览、唯一候选选用及 96×96 导出，详见 [资源流验收记录](resource-flow-acceptance-20261021.md)。Creator 导入、PNG/meta/UUID/SpriteFrame 回读仍未通过；不能把该出图段或文件契约段拼成完整资源闭环。

## 4. 正式现场只读核验

2026-10-21 12:49:51 UTC，既有认证生命周期接口与文件核验结果：

- 唯一监听 `127.0.0.1:32180`，PID `1840`，准入 `OPEN`；32181 无监听。
- epoch：`47159a25-f1b7-44d2-8466-bf661d281fd4`。
- 正式 daemon SHA256：`9717bc798caaf6c709048e1f2dc6f84b9ffe290e5893583f0e1602bc77de8bf7`，不是新候选 c6cb。
- `nativeEpochUnproven=2`，`historicalUnknownCount=2`，`quiescenceEvidenceCount=0`。历史记录保留；当前 OPEN 不等于具备安全退出证明。
- 本轮没有执行停止、维护重启、替换正式文件、模型启动或 Creator 操作。
- 项目专用启动配置仍指向 `D:/CompanionData/art-task-store-v1`、`offline_import_only`。在该明确任务目录内进行有界目录核验，`STUDIO-RUN-*` 目录数为 0，不含 `STUDIO-RUN-icon-mvi0tih2-c9ac2e90`。
- 上述唯一生成任务仍保留于 `D:/CompanionData/art-generation-acceptance-20261021/e2e-store/16ad921aa0fb06d6/`。没有迁入正式库；这不是任务丢失，也不是正式 UI 已能继续导入该任务的证据。

## 5. 前端单独替换与旧宿主兼容评估

**静态前端可以与宿主升级分开，不要求为界面更新重启后台。** 已从当前正式 9717 source map 核实 `http-server.ts`：静态请求逐次检查文件并使用 `createReadStream(filePath)`，响应 `cache-control:no-store`，不是启动时内存固化的静态页面。

若后续选择仅更新前端，最小动作是先备份既有 Next 静态目录／入口及哈希，放入新带 hash 的资源，最后切换入口；保留旧 hash 资源供已有页面使用。回滚只需恢复旧入口／资源，不触及 daemon、认证、库或历史记录。本清单没有执行这一步；仍需真实页面视觉与兼容回归，用户当前标签不被脚本控制。

新前端连接旧 9717 宿主时的准确边界：

- `/api/version` 不支持而返回 404：版本 provider 明确降级“当前接口未提供”；不显示 0.3.142 猜测值，不把前端号当后端号。503 同为未提供，401/403 为认证失效，网络错误和无效元数据分别显示。
- `/api/art-spec/<id>` 若不存在（404）或新宿主未组合 backend（503 `ART_BACKEND_UNAVAILABLE`）：读取未确认，`hash` 保持 `undefined`，`canSave` 必须为 false。可以编辑未保存草稿，但不能显示已保存，不能靠确认框绕过读取前置条件。
- 原 v2 图标读取／编辑入口与已存在接口保留；新统一规范服务不可用不会自动覆写旧文件。
- 因而“先更新界面”能交付统一布局及准确降级，**不能交付新美术规范的真实服务保存，也不能消除当前后端版本未提供提示**。

## 6. 宿主部署前的精准缺口与最小后续动作

1. **正式启动组合缺失。** `5852658` 的 `mcp/src/companion-daemon.ts:100` 仅声明可选 `projectArt`，`:220` 只在 `options.projectArt` 存在时透传；`:1321` 的正式入口仍调用 `startCompanionDaemon()`，没有注入。HTTP handler 在未配置时返回 503。仅把 daemon 换成 c6cb，仍不能让新规范保存可用。
2. **需准备正式组合入口，而非继续测试端口。** 在唯一 32180 的启动组合中，明确真实 registry 查询、规范 decoder/validator、固定 operation ledger 路径及可信 source reader；保持同源认证和登记工程边界。持久原操作记录放在宿主数据区，不能放入工程或临时浏览器内存。准备完成后先做不启服务的组合测试，证明正常 CLI 实际得到 backend，不能只验 options 注入夹具。
3. **可信 P0001 scope 仍缺。** 先形成固定 revision、Accepted 状态、项目／类别适用范围、锁定值／可覆盖默认值的可信映射，并验证 Canon Interface。未完成时保留空 authorities 和明确无继承模式，不能宣称自动全局继承已完成，更不能无提示跟随全局文件变化。
4. **版本元数据必须随真正最终包绑定。** 正式组合代码若改变，需要重建并重新生成与最终 entry SHA 完全匹配的 `product-build.json`；不能继续沿用当前 c6cb 清单。备份包／map／元数据和正式数据的一致性证据后，才评估现场应用。
5. **维护切换仍有真实安全门禁。** 当前两条历史未决记录没有退出证明，普通停止可能被拒绝。不要用“当前计数为零”替代历史证明，不清 UNKNOWN、不改库、不强杀、不注入或伪造退出。不把用户确认解释为可绕过门禁。先核查支持的历史任务／生命周期取证途径；停止拒绝时保留现场并报告，不能陷入反复维护重启。当前没有在本清单内验证可执行的宿主切换步骤。
6. **正式资源链路需要同源任务可见性方案。** 正式库没有32181任务。应先明确如何在唯一32180下采用保留验收产物／记录，并核对原任务身份、规范 hash 与目标，不能直接复制任务库或伪造 UI 历史。新的 GPU 请求不由本次导入或界面工作自动授权。
7. **后续 Creator 验收只从开发者后台UI发起。** 先通过正式32180的工程UI确认或登记隔离目标，核实返回完整路径与ID；不能把原32181登记视为32180已经登记。之后才执行现有安装／启动／导入入口，检查真实终态，再回读PNG、meta、UUID及SpriteFrame。不得用直接Dashboard API、CLI、exe或诊断调用触发编辑器动作来替代UI。当前这部分未通过，也未在本清单中重做。

结论：本冻结候选具备所列配置、持久契约、兼容与UI候选成果。静态界面可作为独立、无需重启的交付选项；新规范正式保存、P0001可信继承、真实版本接口、生成配置接线和Creator导入闭环仍分别需要上述前置条件与现场证据。**不应直接部署整套宿主后宣称流程跑通。**


## 7. 正式默认启动组合补齐（本轮追加，未部署）

- 新宿主源码检查点：`c0c22c5d37d623cb60eb945e04104fbf1a6d0f94`。`project-art-default.ts`用真实`registry.get`、冻结共享decoder/validator及固定Accepted Git源组合backend；daemon默认启动即采用它，显式options.projectArt覆盖仍保留。
- 共享模型为冻结Next提交`6e75e4ef1e81c3efb294ce01abba17523f311fcb`的两个纯TS原字节及provenance，静态收入daemon bundle；不从运行中的Next脏工作区动态加载、不另写schema。
- 持久操作路径为`dirname(locatorFile)/project-art-operations`。正常CLI使用原宿主数据目录；不放项目内部、不使用临时内存。不自动写项目、迁移、登记、读Git或生成。sources仅在显式读取时访问既有3份固定版本文档；适用authority仍为空，P0001实际继承未完成。
- 主任务独立实跑`npx vitest run tests/project-art-default.test.ts`：5/5通过。真实Temp文件验证missing无写、CAS v1→v2、重建默认实例后的原receipt恢复/同op replay、stale拒绝、legacy显式迁移且原字节不变、pending不重发、未登记目标拒绝及伪Canon绑定拒绝。
- 主任务独立实跑完整`npm run typecheck --prefix mcp`（含tests与嵌套web）：exit0。完整daemon/CLI构建exit0；新bundle仅import加载smoke通过，没有调用start、没有创建监听。未启动第二后台、未操作Creator。
- 最新完整候选：`C:/Users/33272/AppData/Local/Temp/companion-host-repair-20261021/mcp/dist/e2e-full-c0c22c5d37d6`。
- daemon SHA256：`a24664f8b41017d07a84468751ec85c51b347951fba2b2f20565aa270c65f38b`。map SHA256：`50bfced31b6ad780040aef495a75f30c1fa86409c17b8b0f609fdcdf37eebf4c`。相邻host-package.json/product-build.json已与该entry精确绑定；宿主包产品版本0.3.142，不使用Bridge协议号或内部检查点作产品号。

### 同后台UI结果与现场部署限制

1. 2026-10-21 12:59:04 UTC，正式32180/PID1840 `/v1/projects`实际200、7工程、目标目录匹配0。没有执行添加写接口，没有登记成功。原浏览器18756已复用，标题变为Companion、地址栏为Next工程页，但系统UI自动化仍找不到网页内添加按钮（Invoked=false）；不冒称已操作。最小人工操作是在当前32180页面通过“添加已有工程”登记`D:/CompanionData/art-generation-acceptance-20261021/e2e-project`，不新建/不启动；之后只读验证原7项和唯一新增项。Creator后续操作仍须经实际后台UI，不改走直接API/CLI。
2. 现有32180仍运行9717原产物，OPEN；nativeEpochUnproven=2、无合法静默证明，当前正常停机门禁仍会拒绝。没有重试停止或生成证明，也不清记录。现有正式证据查询入口为只读`/v1/daemon/native-history`；没有已验证的独立取消维护入口。完整替换须先得到门禁接受的真实历史退出/静默证据，或在宿主已经正常离线且身份/端口/数据核验成立的维护窗口再应用。不能用用户一句同意、当前计数为零、强杀或伪造记录代替证明，也不要求用户现在为此重启电脑。
3. 静态页面独立替换无需重启在技术上成立，但用户已明确拒绝保存接口不可用的半成品，故不先部署。完整应用至少须备份原宿主js/map、元数据、Next入口和必要数据，然后使用同一验证候选与对应元数据；保留原认证/已批准绑定/历史记录，正常启动后验证接口及真实UI保存。无安全切换路径时不覆盖正在运行包。
4. 正式Studio只读对照：`D:/code/shidai3/P9000/ai-game-studio/project/policies/local-icons-import-contract.json`不存在；四个契约文件中companion_api.py、local-icon-import.ts、protocol-v1.json与已验证完整Studio候选不同，local-icons-import.json相同。正式facade SHA为`1b1b918d13f045173dba2e484c20b3ae8f9388f094397bbb1938a6512607979b`，正是已实证会在任务读写前拒绝variant字段的旧版。必须先准备并验证配套Studio差异/完整依赖，不应只换宿主后宣称变体导入能用。本轮未改正式Studio。
5. 正式任务库为空且不含本次唯一生成任务；若后续通过正式UI已有文件入口导入本轮PNG，证据必须标“导入既有生成物”，不能伪称原任务已迁入正式库或原生成任务端到端完成。尚未实际执行此导入。

当前可交付的是：冻结前端候选、已补默认正式入口的宿主候选及其类型/构建/真实文件合同证据。浏览器登记/保存重读、P0001可信适用绑定、参考图入模、同后台真实Creator导入与UUID回读均不得列为通过。
