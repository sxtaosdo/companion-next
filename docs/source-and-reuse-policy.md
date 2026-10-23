# 来源与能力复用规范

适用范围：Companion Next 的开发、修复与交付。按用户 2026-10-22 指令建立；本文件是来源边界与能力复用原则的权威正文，执行约束仍以项目 AGENTS.md 为准。

## 已核实来源与适用边界

| 对象 | 来源与证据 | 适用边界 |
| --- | --- | --- |
| 原 Companion | [sxtaosdo/cocos-mcp](https://github.com/sxtaosdo/cocos-mcp) | 旧 Companion 宿主、CLI 和旧 UI 的上游；不能据此认定 Next 使用了某个第三方后台模板。 |
| Companion Next | 完整源码 ZIP `companion-next-1.3.173-complete-source.zip`；来源提交 `9db8b3af26982af7e9366ae03d865d8782f98a33`，319 个源码文件 | 导入包未携带 `.git` 历史或 remote。导入清单记录的来源提交，不等于本地 Git 可访问的上游历史；本地初始提交仅为导入检查点。 |
| 独立运营后台 game-ops-admin | [Cool-admin Vue 8.x](https://github.com/cool-team-official/cool-admin-vue/tree/8.x) 与配套 [Cool-admin Midway 8.x](https://github.com/cool-team-official/cool-admin-midway/tree/8.x) | 属于另一套运营后台。其登录或组件能力不能写成 Companion Next 已有功能，也不是已证实的 Next 模板来源。 |

来源证据以 [导入记录](../LOCAL_DEVELOPMENT.md)、[原始提交记录](../SOURCE-COMMIT.txt) 和 [文件清单](../SOURCE-MANIFEST.json) 为准，不改写原始导入元数据来描述后续版本。

2026-10-22 的有限溯源检查未在 Next、cocos-mcp、shidai3 三个本地仓库找到上述来源提交对象，也未从已检查的初始目录、README、许可归属及可用项目记录确认第三方后台模板地址。这是当前证据边界，不代表证明历史上从未使用模板。没有新增证据时必须标为“来源未确认”，不得把相似外观或依赖列表当来源证明。[依赖记录](dependencies.md) 说明所用库，不证明存在可直接恢复的整套登录模块。

## 开发顺序：先查已有能力，再补缺口

1. 先检查当前系统、上游和已有依赖的实际接口、配置、组件与官方使用方式，区分真实实现、演示 mock、未接线和缺失能力。
2. 能通过现有配置、组件复用或接口接线解决的，优先使用；保留已有用户流程、认证和权限边界。
3. 只有证实已有能力不足后才新增最小代码；在任务记录或变更说明中写明查过什么、具体缺口、为何配置或接线不能解决，以及验证方法。
4. 不为“复用”引入无关整套系统，不重复建设已存在的状态、存储或认证机制；需要额外依赖或扩大功能、权限时，按用户授权范围先提出具体方案。
5. 以实际行为验证接线结果。源码合入、构建成功、运行进程已加载和真实页面验收分别报告；模拟测试不能替代真实流程验收。

## 当前认证工作的复用边界

The current approved browser login reuses the existing Cool-admin/Midway authentication provider. Companion adapts its existing Cookie session; it does not implement password hashing, copy signing keys, initialize an account database, or create accounts. The original Companion CLI authorization remains compatible, but a terminal-command guide is not the requested browser login experience.

Only explicitly allowed existing usernames may enter Companion. The allowlist defaults to empty; there is no default admin or automatic access for all operations accounts. Credentials and provider access tokens remain server-side and are not logged or persisted in browser storage. Session expiry, provider revocation, Host/Origin rejection, and business permission errors remain distinct. Writes are never automatically replayed.

The approved provider address is loopback port 18001 (user-approved change from occupied port 8001 on 2026-10-22). A port conflict does not authorize stopping its owner or changing network/security configuration. An alternative port requires approval. Provider login retains its existing per-user token-cache behavior; Companion logout removes only its own browser session and does not invoke provider-wide logout.

## 运行与交付证据

部署前重新读取当前实例身份、版本、健康状态及正常维护条件。此前 `nativeEpochUnproven=2` 阻止正常停止是历史观测，不能不经核验当作当前状态，也不能因机器重启就假定已经消失。

优先使用现有正式启动和维护流程。复用或修复不构成清除 UNKNOWN、伪造退出证明、绕过门禁、强杀或更改安全权限的授权。遇到无法安全应用的修改，应明确区分已完成源码与未生效运行产物，报告精确阻塞。


## 状态呈现与验收约定

这是当前项目状态 UI 与验收的单一约定；各页面不得另维护相冲突的颜色、图标或状态词表。开发前先读旧 Companion 对应实现及当前共享组件，确认状态含义、数据来源、归属和公共样式，再分页面修改。并行任务必须遵守相同组件/语义契约，公共层只由单一负责人整合。

现有复用入口：`ProjectStatusTag.vue`、`OperationFeedback.vue`、各业务已有 store；共享外观为 `src/styles/status-presentation.css` 的 `companion-status-tag` / `companion-status-icon`。这是现有 Element Plus 标签的呈现层，不是另一套状态存储或请求系统。

| 含义 | 呈现 | 必须保留的区别 |
| --- | --- | --- |
| 已就绪、稳定可达、已选用等真实稳定状态 | success 绿、勾、静态 | 可达不等于模型已加载；已导入不等于运行验收通过 |
| 实际启动、停止、读取、执行中 | primary 蓝、Loading、短动词 | 只有真实进行中才动画，排队或等服务不假造执行中 |
| 未读取、未启动/已停止、未连接 | info 灰、图标和明确文字 | 未连接不推断未启动；未读取不推断停止 |
| 失败、拒绝 | danger 红、叉、就地原因/详情及适用重试 | 不自动重发写请求；读取失败不伪装服务停止 |
| 结果未知、观测过期 | warning 橙、待核对、静态 | 过期须有现有 stale/来源证据，不沿用旧绿，不擅造 TTL |
| 操作受理回执 | 中性回执文案，与实体状态分开 | 收到请求不代表运行就绪，不能以绿灯代替当前观测 |

标签统一高24px、字号12px、图标14px、图文间距6px；使用已有主题变量，状态在标题旁，操作按钮独立。适用时提示观测时间。Tag显示状态，Loading表示加载，Progress只用真实百分比，Alert保留持续异常，Result处理页面级结果/访问异常，Badge处理数量或轻量标记；Message不能作为唯一失败证据。

交付闸门：测试并实际渲染检查加载、成功、失败、未连接、未知、过期及请求受理≠业务就绪；校验图标+文字可理解、仅进行中动画、窄屏可读及原重试/详情仍可达。单测绿灯、静态哈希或模拟结果都不能单独宣称现场完整可用。渲染夹具与真实服务验证分别记录，未覆盖场景明确标注。不得为制造验收状态执行模型、Creator、正式数据写入或绕过安全边界。

官方组件说明：https://element-plus.org/en-US/component/tag.html 、https://element-plus.org/en-US/component/loading.html 、https://element-plus.org/en-US/component/alert.html 、https://element-plus.org/en-US/component/progress.html 、https://element-plus.org/en-US/component/result 、https://element-plus.org/en-US/component/badge 。业务颜色映射参考已核实旧 Companion `web/app.css:252–301`，不能声称是未确认 Next 模板的原生规范。


## 整体迁移开工与闭环

整体迁移先列全量旧功能、入口、处理函数及交互清单，再确认共享数据/状态契约和用户已批准差异，按同一清单逐项闭环。每项分别标记代码对应、已真实验证、仅模拟验证、遗漏或待核对授权；不能用局部测试成功推定全站迁移完成。看板布局、合并美术资源等已批准变化保留，未找到授权证据的差异标待核对，不自行回退或扩大修复。


### 2026-10-22 状态统一执行证据

本批前端产品1.3.183覆盖工程、看板、模型服务、知识库、美术资源和任务面板。沿用原store及共享组件，仅保留原有服务错误码警告避免将HTTP失败降成普通未知；历史只读运行任务不播放执行动效。292项整合定向回归、99项store/adapter回归及7项产品记录测试通过，类型检查通过。网络全部拦截的Edge真实渲染覆盖63项页面/尺寸/颜色/动效/加载/失败/未连接/过期检查，另12项任务运行/未知/失败/导入待验收检查；这是渲染夹具验证，不代表真实生成、Creator或维护操作验收。证据位于本机任务目录 `C:/Users/33272/Documents/Codex/2026-10-17/task/status-ui-20261022/`，现场结果另以 `deployed183.json` 为准。未为测试触发任何真实模型、生成、Creator、同步或规范写入；请求受理与就绪转换由现有组件测试覆盖，本轮未真实执行启动/停止业务。整体功能迁移核对尚需独立清单，不能从此状态批次推定全量对齐。


现场复核：1.3.183静态产物已更新原 `cocos-mcp/mcp/dist/companion/web/next`；源码 `516ab9af`，真实构建 `516ab9af+working`（保留既有登录验收文档修改）。`deployed183.json`记录30项真实HTTP/页面只读检查通过：7路由呈现、6静态文件哈希、版本、同PID28744/epoch/OPEN和原8工程均一致。后端仍0.3.144，未重启、未注销。备份 `status-ui-20261022/before183-static` 已校验120文件；回退仅恢复该备份index，旧哈希资源与登录目录保留。此处不声称真实生成、服务启停或Creator业务闭环已验。


## 2026-10-23 Companion 固定七天网页登录（已批准）

仅 Companion 入口取消验证码，保留用户名/密码校验和精确账号许可。复用现认证提供方的 verifyPassword、用户状态/密码版本/角色与 CoolCacheStore；新增最小的 Companion 专用 login/session/logout 接线，使用独立缓存命名空间，不更改运营后台原 login/captcha/JWT/refresh/SSO 缓存。提供方路由仅既有本机监听、精确Host，拒绝带Origin的浏览器直调；不签发新账号、静态凭据或扩大网络访问。

网页登录会话首次成功时固定七天，Cookie剩余Max-Age与服务端绝对期限一致，请求不会续期。磁盘缓存使刷新与服务重启不丢失；退出删除专用记录，停用/密码版本/角色变化使会话撤销。测试只用隔离身份与临时目录；真实密码仍由用户在原32180页面输入。旧的本机一次性授权入口保持兼容，不能把它的进程级Cookie当作七天网页登录会话。


## 2026-10-23 原工程布局调查与待批准的最小方案（上游复核修订）

本地包仍是来源证据边界：直接读取 Downloads 的 `companion-next-source.zip`（0.1.0）、`companion-next-source (1).zip`（0.1.1）、`companion-next-source (2).zip`（0.1.7）、`companion-next-source (3).zip`（0.1.12）、`companion-next-1.3.173-complete-source.zip`（1.3.173）。完整包 SHA256 b4dc893ddaab276ef8fd95c2eb35d82a4f1597affe8b6b6f03e1659d0ad2b477 与原导入清单一致。五包没有足以确认第三方上游的 repository/homepage/license 元数据；它们不含这些组件不等于已知参考框架没有功能。

2026-10-23已直接核对明确参考源 [Cool-admin Vue 8.x](https://github.com/cool-team-official/cool-admin-vue/tree/8.x) 的真实源码及其 [MIT许可](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/LICENSE)。主布局 `src/modules/base/pages/main/index.vue` 引入 topbar/process/views，插件 `src/plugins/dev-tools/config.ts` 注册工具。该仓库是已知参考技术体系及独立运营后台来源，仍未证明 Companion Next 整套由它派生。后续复用须保留许可/归属及实际来源版本，不能把参考集成写成找回 Next 原 Git 历史。

| 项目 | 上游真实能力与现有差异 | 最小适配方案（待批准，不实施） | 不直接照搬的依赖/验证点 |
| --- | --- | --- | --- |
| 用户信息 | [topbar.vue](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/src/modules/base/pages/main/components/topbar.vue) 显示 nickName/headImg/email、个人中心及退出；[user.ts](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/src/modules/base/store/user.ts) 含账号token与刷新逻辑。Next当前只有退出；专用会话 person 现仅返回 id/username/status/expiresAt，前端 /api/ui/session 只有authenticated。 | 复用顶栏下拉布局及ElementPlus；只接现有安全Cookie会话的已验证用户名摘要，退出复用当前注销。昵称/头像/邮箱若要显示，需提供方同一已认证身份最小白名单字段，不把全用户对象返回前端。无头像时用默认呈现，原CLI入口明确“本机授权”。 | 不复制token/refreshToken浏览器存储、router.clear或账号切换。个人中心尚无Next对应页面，不能做假入口或顺带新增修改密码/资料。验证账号、本机授权、失效/未知身份及七天/退出不被破坏。 |
| 右下悬浮工具 | [dev-tools/index.vue](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/src/plugins/dev-tools/components/index.vue) 入口固定右20/下20、v-if=isDev且hidden-sm-and-down；内容是Eps、代理请求、字典、账号、文档。正式构建及小屏隐藏是其原行为，不是足以断言的漏迁移。 | 推荐保留原开发环境/桌面限制。本批不在正式32180强制启用整套。若确认开发场景需要，先只复用抽屉/按钮外观和适用文档入口，逐项确认真实能力后接线，不能做空工具壳。 | Eps依赖virtual:eps和生成service；代理会切请求环境；字典依赖dict API/菜单/权限；账号工具保存token/refreshToken并切换账号，与Cookie边界冲突，不迁入。文档虽较独立也应只链接本项目已用依赖。不得为了恢复按钮开放代理/权限或引入全套Cool服务。 |
| 顶部面包屑 | [route-nav.vue](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/src/modules/base/pages/main/components/route-nav.vue) 是ElementPlus面包屑，按menu.group找层级，小屏只留末级；源码没有配置点击跳转。Next早期包有“项目工作区/当前页”文字，当前仅页名。 | 复用面包屑外观与小屏规则，用Next现有静态路由/meta和侧栏分组生成层级，不接运营菜单/权限服务，默认保留只展示语义。 | 不把可点击层级冒充原生能力。验证深链接、知识库子路由、资源旧链接重定向及project查询保持，小屏末级不溢出。 |
| 路由页签 | [process.vue](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/src/modules/base/pages/main/components/process.vue) 支持切换、关闭当前/其他/全部、返回/刷新/首页；依赖process/app store、useCool、ContextMenu及mitt。上游按path合并标签，[views.vue](https://github.com/cool-team-official/cool-admin-vue/blob/8.x/src/modules/base/pages/main/components/views.vue) 由process/meta.keepAlive算缓存，刷新会增加整层KeepAlive key。Next已有美术专用KeepAlive/v-show及知识库独立缓存，不能替换。 | 可复用页签外观和操作语义，薄适配到现有Router，保留完整fullPath及工程上下文；保留Next现缓存/草稿，不导入上游user/store/router体系。推荐作为第二小批，先通过页面切换、关闭、草稿和任务保护再开放。 | 不能直接复制整层key刷新或只按path合并不同工程。关闭标签不等于取消后台任务；未保存/进行中有原有确认或保留策略。刷新只调用适用的当前页现有刷新入口，不全局reload/重发写操作；资源内部三tab仍为页内任务切换。验证query/工程隔离、展开/滚动、后台轮询暂停/恢复、草稿与未知任务不丢失。 |

推荐批准范围：第一批先统一静默轮询、真实用户菜单和只展示面包屑；第二批再接路由页签并验证现有缓存/草稿。右下工具遵守上游仅开发模式显示，不盲目在正式后台打开；其中账号/代理/Eps/字典能力不混入第一批。可复用的是源码布局与已适用交互，需最小适配的是会话字段、路由树和任务/缓存生命周期；没有用现成能力的部分必须说明其真实接口缺口。当前仅文档方案，无布局、认证、路由或轮询实现/部署变更。

Companion“检查中”只读结论：`src/components/OverviewServiceSummary.vue:30` 以 directory.projectLoading 直接显示检查中；`src/stores/companion-browser.ts` 的 refreshProjects(true) 后台轮询同时设 projectLoading 与 backgroundProjectRead（约三秒一次），而卡片未使用后者区分静默刷新。读的是同源 /api/projects 等工程API可达性，不是独立MCP或Creator启动证明。`src/composables/use-overview-service-status.ts` 另以十五秒更新知识/模型服务，两者不可混为一个依赖绿灯。需要保留检测以识别断连/失效/接口错误；待批准最小修正是已有成功且未过期时保持已连接，后台刷新仅更新观察时间；首次读或真正状态变化再显示加载/失败/待核对。不得用旧绿灯掩盖失败或过期，也不改变真实依赖含义。当前未改布局或状态组件。


### 工程页持续刷新：只读根因与合并方案（待批准）

当前工程入口为 `src/router.ts` → `src/views/CompanionBrowserView.vue`。未发现该页/store调用 location.reload；不能把每次轮询叫整页刷新。`src/stores/companion-browser.ts:75–98` 的 refreshProjects(true) 设置 projectLoading/backgroundProjectRead；相同 projects/statuses 已JSON去重，卡片 `:key=project.id`，显式展开在视图92–93按工程ID保存。因此正常无变化轮询不应整列表重挂或随机排序。仍存在确定的可见更新：每次成功都改 observedAt 并增加 projectSnapshotRevision；`src/stores/creator-operations.ts:183` 对所有 projectLoading 阻断 canPrepare，视图124、146等按钮随后台读反复禁用。视图96–102另有100/1000ms的调用耗时显示计时器，不是网络轮询。

三秒轮询在store scheduleProjectPoll（约180行）每次先clearTimeout，完成当前读取才安排下一次，并有projectLoading并发保护；setLivePageActive/setLiveVisibility/clearLiveWork及视图119卸载处理暂停和清理，begin/epoch/version拒绝旧响应。当前只读代码未证实重复计时器/并发请求覆盖，也未进行用户当前页的运行时计数，不能宣称已全面排除。网络失败分支会clearData，短暂错误即可清空旧卡片，恢复后重新挂载；默认展开跟随运行状态，显式选择已有优先保护。

最小建议与看板统一：首次读取显示加载；成功快照有效时后台静默更新，只改实际变化字段，保持稳定ID/排序/显式展开/滚动。后台读失败保留旧内容并标过期/待核对，不冒充当前已就绪或清成无工程。区分后台读busy与业务操作busy；避免所有按钮视觉反复闪禁，点击操作时仍等待/冻结最新读取并按原身份、generation及确认门禁核验，不为稳定UI放宽写入保护。真实启动/停止进度继续及时显示。保留单一计时器与旧响应保护，不增加定时器。验收应录制正常轮询、慢响应、超时恢复、真实状态变更、切页/隐藏再返回，断言无document reload、无无谓卡片重挂/重复定时器、顺序/展开/滚动保持、操作不误重放。此处仅方案，未改任何布局/状态代码或执行Creator操作。


### 2026-10-23 已批准的工作区导航与静默读取实施

用户已批准上述最小方案。顶栏布局参考 Cool-admin Vue 8.x 的 topbar.vue、route-nav.vue 与 process.vue；新增适配组件保留 MIT 出处，许可证沿用 src/login/COOL-ADMIN-LICENSE.txt。仅复用布局和显示语义，不引入其 Token 存储、EPS、账号权限或另一后台。面包屑只展示层级；路由标签按完整内部路由保留工程 query，不将不同工程合并为同一目的页。右下 Dev Tools 保持原开发模式边界，正式后台不新增空工具入口。

用户身份只取现有受保护 /api/ui/session 的服务端核实用户名；本机一次性授权明确标为本机授权，旧宿主不提供身份时明确显示身份未提供，不推测账户。七天到期、注销、账号停用与权限校验仍使用现有机制。

后台轮询保留成功快照和稳定 DOM，读取失败标待核对并禁止旧快照直接授权写入。可在后台读取期间表达操作意图，但实际派发必须等待新读完成并重新校验来源、工程、运行身份和 revision，不将旧确认当新确认。离页清理读取计时器和请求；知识库保留输入及已完成结果，离页暂停在途操作并撤销临时确认，不重发。美术工作区既有 iframe 留在 DOM，避免路由切换重载素材选择。

验收记录见 [工作区导航与静默刷新验收](ui-shell-acceptance-20261023.md)。构建通过、模拟行为与实际 32180 页面验证必须分别记录。

### 2026-10-23 紧凑布局与可见文档工具（后续批准覆盖开发模式限制）

用户随后明确要求日常后台恢复右下悬浮入口。本轮复用 Cool-admin 8.x dev-tools 的悬浮开关、右侧菜单和文档卡片，仅连接现有 Companion 帮助及实际依赖的官方文档；正式构建可见。不启用 EPS、代理、字典、账号切换：它们依赖另一套生成服务、权限或 Token，不能放空入口或照搬凭据。MIT 许可继续保留。

侧栏折叠参考同源 app.fold、topbar.vue、slider.vue；只持久化显示偏好，复用现有 RouterLink 和 Element Plus Popover，不引入另一套路由、权限或状态仓库。窄屏沿用原抽屉，二级菜单实际可访问。公共头压缩间距与重复标题，字体及业务状态含义保持。

美术规范保留唯一左侧步骤和原格式；通用要求及分类为默认收起的可选高级设置。独立项目适用说明可缺失或为空，不虚构理由，Canon 适用范围与锁定验证不变。图标留白移至图标规划：新规范通过已有单任务 overrides 解析，旧 v2 仅展示旧值，不能静默改配置或绑定哈希。

### 四步规范与兼容输出

规范创建复用原添加项目式左竖步骤与InfoTip，当前四步仅分离项目、通用和分类，不新增需求表或并行生产体系。创建不填写单素材尺寸；具体规划沿已有overrides解析。2D/3D仅描述游戏表现，不改变图片/模型资源能力。全局来源未关联、读取失败与明确排除不同，不从空数组推断适用性。新图片规范固定透明；必须以现有CPU处理器实际像素校验输出，不能只看扩展名或RGBA模式；旧数据不静默改写，所有未知写入保护不变。
