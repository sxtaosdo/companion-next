# Companion v148 宿主装配：纯 options 准备与待批准运行

前片完成了已核原类的**不可启动装配准备**；随后获得明确临时测试批准，新增原类binder并通过21组真实HTTP检查，见文末。原参数模块本身仍保持不可启动。`host/companion-read-assembly.ts` 不导入、不构造原 HTTP 类，也不提供 start / listen / close；仅返回冻结 options、明确能力标志及 `unvalidated-options-only`。这不是可运行宿主，也不是只读服务器。现有 Windows 部署、Library v6 与 Windows v5 消费基线均未改变。

## 同版本源码闭包已齐，无需再次补源

已物化 `Companion-v0.3.148-host-source-closure.zip`，366694 B，SHA-256 `5abcc93f02ddfd2baf22aebcc77e2843716fbf551282f80d76b66c459f174901`。100 来源文件原字节大小与 SHA-256 全部匹配清单；其中97个文件为Windows CRLF，按Git标准LF归一化后blob SHA1全部匹配同提交 `f6dcac804fb9ad806e8094594c7820a71cfab7b8` / v0.3.148。其余3个原字节即匹配Git blob。验证没有更改原字节。

包报告496依赖边、未解析本地模块0、computed模块0。真实CLI为 `companion-cli.ts`；没有 `creator-ai.ts` 源文件。此前最小补源需求已由本包关闭。该包是源码引用闭包；不含 node_modules、Web / Bridge 产物、预生成collector、配置、凭据、数据库或日志，不能运行原 `npm start` / `scripts/start.mjs` 冒充验证。原启动脚本还包含安装、build、npm link、restart和打开UI副作用。

## 为什么不能直接调用原 daemon

1. `companion-daemon.ts:86–99,136–209` 不收 `webRoot`，启动立即构造SQLite协调库，监听后写含apiToken的locator及固定目录日志。更换端口/registryPath不够隔离，不符合此片禁止新增持久凭据的边界。
2. `CompanionHttpServer` 本身可显式webRoot，构造只建实例状态、随机内存session/apiToken/startupCode和Node server；不自动listen、不写locator。默认identity会读取入口源码计算hash，因此也不是零文件读取。`listen()`明确绑定127.0.0.1随机端口。
3. 原 Cookie 同名、Path=/，端口不隔离Cookie。以后独立实例浏览器验证必须隔离上下文，不读取/复制Owner Cookie。旧 `/api` Cookie与 `/v1` Bearer边界以及Host/Origin检查都不能修改。
4. 新实例有新 CallHistoryStore。空 calls 只表示新实例，不表示旧进程无调用；本片capabilities固定 `oldDaemonCalls:false`、`oldDaemonLogs:false`。不存在借此读取旧实例记录的公开装配入口。

## 已完成纯准备

`prepareCompanionReadHostOptions` 只接收已有运行时错误构造工厂和已批准读取对象，不接token、Cookie、API key、daemonIdentity、baseURL、registry路径或进程命令；没有构造器、运行时动态import、安装器、文件I/O和HTTP调用。

- webRoot必须显式绝对本地路径；port固定0。
- 仅转发明确提供的 listProjects / listDashboardProjects / listStatuses、日志query、知识9个状态/读取方法、模型和知识服务status。
- 未绑定读操作抛不可用，不用[]、running:false或默认stopped补造成功。
- 其余actions、工具预设、日志清理/订阅、服务start/stop、knowledge chat / ask / sync均为拒绝准备项。没有icons默认实现。
- 方法属性在准备时捕获；其receiver/closure内部状态仍由原对象拥有，不能称安全沙箱或不可变后端。
- 观察原daemon / native工作明确unknown；不把空观察当全局空闲。

这些是待真正binder整合的options，**不能直接交给监听中的原HTTP类**。

## 前片识别的真实binder阻塞（后续处理见文末）

- 原 `/api/events`（http-server.ts:745–748）先发200和SSE首帧再调用logs.on。拒绝式on会在已发响应头后抛错，随后原catch可能重复写头，引发未处理异常。因此不能靠抛错或空on/off声称安全禁用SSE。真正适配须复用原内存DebugLogStore无directory并正确保留SSE生命周期，或在受审查的独立适配层发送任何响应前拒绝此路由。当前未实现，也未监听。
- 原 logs:DebugLogStore / toolPresets:ToolPresetRepository 含private成员。Record型准备facade不是已通过原构造器类型检查的替代类，不能声称粘贴new CompanionHttpServer(options)即可部署；必须实现并对原类型/运行时验证。
- actions全拒绝也不是全路由只读：logs.clear、toolPreset写路由、/v1 calls begin/finish有直接分支。`closedReadOnlyRouter:false`一直保留；不可将临时验收宿主生产化。
- 原真实 listStatuses 依赖私有resolvedStatus并读取含Bridge token的connection.json。此片不得绑定它，也不能用CreatorLifecycle.status的默认stopped代替。接Owner真实工程需要单独明确读取范围；本次测试仅独立数据。
- 原KnowledgeAdapter需要既有认证对象。此片不创建、读取或搬运apiKey；missing身份应原样失败。临时HTTP测试可用明确独立测试readers，不能据此宣称真实知识库已通。

## 最小批准记录（随后已明确准许）

原HTTP静态值依赖链已核约45 TS + 5 JSON；Next缺少3个原锁定运行依赖：zod 4.4.3、@modelcontextprotocol/sdk 1.30.0、better-sqlite3 12.11.1及其锁定传递项。当前没有安装这些包，没有导入或运行原HTTP类。

父任务已单独请求批准：仅dot隔离测试目录依旧锁安装上述原依赖，使用独立测试数据与独立浏览器上下文，在127.0.0.1随机端口临时验证原HTTP类，**不写locator、不接Owner数据，验毕关闭**。此前参数准备检查点提交时尚未收到批准；随后2026-10-12 11:45:12 UTC已明确准许下述隔离测试。此批准也不会授权旧Windows部署、通用代理、新持久凭据、读取Owner connection/token/Cookie、模型/知识启停或配置MCP。

## 前片参数准备验证分层（472990a，后续运行结果见下节）

- 源完成：100文件核对、原入口/副作用审查、纯options准备和拒绝边界。
- 测试替身：`tests/companion-host-assembly.test.ts` 20条纯内存测试，构造器/监听器均不存在；另有全工程类型检查。不是原类实例、原HTTP、认证、Cookie或网络测试。
- 真实运行：未安装、未构造原HTTP类、未监听、未部署，等待上述批准并先修真正binder硬阻塞。

最初草案曾含fake constructor/start/close测试；静态review发现SSE和启动/关闭生命周期风险后删除全部可启动入口及相应替身生命周期测试。本片不沿用中间28/30条计数作为最终验收。

## 批准后的真实原类验证

新增 `host/v148-runtime-binder.ts` 使用真实原class：日志子类只拒绝clear，继承原on/off；preset子类覆盖全部10个方法，保持private成员名义身份。已经消除原SSE抛错装配风险；当前esbuild转译和原HTTP运行成功。隔离3依赖闭包128包安装无scripts，无新运行依赖写入本Vue工程。

21组真实HTTP检查通过：新UI静态文件、一次性登录和Cookie头/实例隔离、Host/Origin、当前读取客户端、知识POST分发、原缺认证负例、拒绝写动作、取消与真实SSE及清理。两个新实例均finally关闭并以ECONNREFUSED证实。没有Owner配置/凭据/Bridge读取、持久locator或旧Windows改动。业务数据是独立fixture，浏览器视觉及真实业务仍未验。详情与证据见 `companion-runtime-binder.md`。

完整原包semantic typecheck仍未通过：批准范围不包含缺失Node等开发类型声明，未用伪声明掩盖；不能将实际HTTP通过表述为完整旧包build通过。参数准备片的拒绝式logs.on/off仍不可用于真实宿主。当前原类binder仅供批准隔离验证，不是生产部署启动器，也没有更换Libraryv6/Windowsv5。
