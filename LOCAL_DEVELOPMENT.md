2026-10-21 正式后台启动入口：在熟悉的 `D:/code/shidai3/P8000/cocos-mcp`（或其 `web` 目录）执行 `npm run start:next`，一次完成原官方 daemon start、原认证会话与新版 `/next/index.html#/overview` 打开；旧 `npm start` 保留不变。也可在本仓根目录执行 `npm start`。`npm run dev` 仍只是 Vite 开发服务器，不是正式后台。

仅启动/复用服务而不打开窗口：`npm run start:next -- --no-browser`（本仓对应 `npm start -- --no-browser`）。默认新开一个独立 Edge 窗口，不操作当前标签；关闭该新窗口后命令结束，后台服务继续运行。无安装、构建覆盖、restart、端口强杀、模型启动、凭据创建或用户配置修改。原官方 ui 没有目标参数且认证后固定跳旧 `/`；新 helper 复用同一 `/v1/ui/session` 和 `/auth`，在独立 context 消费原 cookie，再仅导航 Next，不渲染旧页、不持久保存认证状态。

本轮首次官方CLI未及时确认，唯一child随后实际就绪；没有重发冷启动或停服务。helper只在原CLI结果未确认时追加有界只读就绪核对，不伪称CLI成功，也不二次启动。之后通过熟悉根目录别名的真实重复运行exit0，复用PID21872；认证inflight HTTP200/OPEN、daemon SHA70df不变。8隔离入口回归通过；独立Edge真实认证和看板/知识三页20检查、6静态HTTP SHA全部通过，页面错误/越权写请求0。现有UI静态仍是5ae52d0 / 1.3.173.191，文档基线18ffe02 / .192，本轮启动项提交不自动构建或替换UI。知识库查询/问答/Agent/同步/索引/模型未执行，Library403没有重试。

证据：`C:/Users/33272/AppData/Local/Temp/companion-start-entry-20261021`。旧仓仅新增两个package别名，原22条并行修改、原start及其它scripts不变；旧包原字节备份在old-package.json、old-web-package.json。旧仓两个package改动保留为本任务未提交增量，不混入旧仓并行发布；检查点为旧仓checkpoints/next-start-entry-20261021与本仓checkpoints/start-entry-20261021。

2026-10-20 知识库三页已实际部署 **5ae52d0 / 1.3.173.191**（产品版本1.3.173）：左侧“知识库”下为检索与文档、问答、连接与同步，默认检索页；问答页内切换普通/Agent，模型服务旧链接独立保留。选库、检索条件、完成结果、草稿和返回滚动在三页间保留；换源、改条件或默认库改变会清旧结果。未发送确认离页撤销，UNKNOWN及实际在途锁不因缓存而清除。

全仓4556项通过；最后旧服务锚点兼容修正后，受影响47项通过，其余4510项保持。严格类型、独立只读审查和本地OCR规则已核。最终候选47项、部署后47项实际隔离浏览器检查通过，页面错误/拦截写请求均0；知识库列表、文档列表/详情/分块/原文及纯关键词检索实际读取通过，三页切换不重复请求。6静态HTTP文件SHA一致。模型启动、推理问答、Agent执行、同步/演练均未真实执行，不能据入口存在称业务验收通过。

只替换Next index并新增2哈希资源，保留326原文件中的其余内容，最新328文件基线。PID20252/22932、9业务表、旧后台共享修改/暂存指纹保持，无服务重启、无用户标签操作。Codex配置在任务期间独立变化：保留当前指纹和原始基线，不读取配置值、不恢复旧值、不推断修改者。详见configuration-observation.json。

已补6张此前已部署页面截图（188/6cc9c28，旧知识页明确historical）和3张新知识页截图（1.3.173.191/5ae52d0），含哈希清单且未见认证秘密。Library官方附件助手此前tools/list返回403，尚无恢复证据，本轮未重试、无上传和Library ID；截图源保留本机。**自检完成、已部署、待用户验收**。证据：C:/Users/33272/AppData/Local/Temp/companion-knowledge-subpages-20261020-1451（delivery-summary.json、source-validation.json、candidate-browser.json、deployed-browser.json、deployment.json、http-verification.json、final-protection.json、post-static-baseline.json，以及两个截图manifest）。后续文档提交不改变实际部署源5ae52d0。下方旧交付/只读评估按其历史时点阅读；“等待批准拆页”已由本轮批准与实施取代。

生命周期实现约束：仅知识三页在当前visit内KeepAlive；独立models/出族销毁缓存。KB选择进入普通问答目标，Agent旧请求仍只有原agent/session/query参数，选库仅本地会话隔离；没有伪造新增Agent KB字段。源watch位于store，缓存页未显示时换源仍会失效。scope所有权和实际transport waitForIdle保留，禁止为视觉跳页提前解锁。

2026-10-20 服务状态已合并项目概览：实际部署源码 **7261a35 / 1.3.173.184**，产品页面1.3.173。概览紧凑摘要显示Companion、知识服务及模型启动器的响应与更新时间，异常可展开；移除独立服务状态导航，旧/services保留query并转至overview#service-status。工程沿用原单例事件流与3秒状态轮询；服务status GET完成后15秒再读，失败显示未知/待核对，可达不代表模型或ComfyUI就绪。暂停会话、隐藏/离页取消、代际、UNKNOWN/互斥及有界恢复已核。183项受影响用例已覆盖（最终修复后定向51通过，其余132不变通过）、严格类型/构建/独立审查；候选27项、部署后29项实际浏览器检查和6HTTP SHA通过。**自检完成／已部署／待用户看图验收**。实际截图保留本机；此前Library工具发现阶段403未获新访问证据，本轮未重试、无Library ID。当前322文件保护基线与全部回执位于 `C:/Users/33272/AppData/Local/Temp/companion-overview-services-20261020`；下方7261a35之前的部署与基线均按历史时点阅读。 后续执行前使用本轮 `C:/Users/33272/AppData/Local/Temp/companion-overview-services-20261020/post-static-baseline.json`（322文件）；320/318基线均为历史。

2026-10-20 美术资源分组交付：源码与实际部署 **3b96bad / 1.3.173.181**，页面产品版本1.3.173。一级“美术资源”下为AI图标／游戏资源／图片素材；父项仅开合，原三个路由和业务保持，进入子页自动展开且仅子项高亮。概览首项及模型服务／服务状态保持。89项相关测试、严格类型、构建、独立只读审查通过；候选36项和部署后38项实际浏览器检查通过，6静态HTTP SHA一致，7完整工程卡及无横向溢出已核。**自检完成／已部署／待用户看图验收**，不称全部迁移验收完成。两张实际部署高清截图保留本机，授权Library保存因当前官方批量助手在tools/list阶段返回403而未能开始上传，未创建Library ID。证据目录：`C:/Users/33272/AppData/Local/Temp/companion-art-navigation-20261020`。下方338e759/.179为上一轮交付时点。 上一轮320文件基线（现已被322文件基线替代） `C:/Users/33272/AppData/Local/Temp/companion-art-navigation-20261020/post-static-baseline.json`；下方navigation-followup/318文件基线及“最新”指令仅为上一轮历史，不再作为当前基线。

2026-10-20 最新本机静态交付：源码338e759/内部1.3.173.179，产品1.3.173；daemon6564/32180持续运行且未重启。314旧文件中仅Next index变化，先后新增4个哈希资源，当前318文件；9业务表、三客户端配置、共享22修改及知识服务600/8081均保护。后续执行前使用最新基线 `C:/Users/33272/AppData/Local/Temp/companion-old-experience-20261020/navigation-followup/post-static-baseline.json`，不能再拿旧312/314/316基线直接比较。最后一次静态交付与回滚备份在同目录deployment.json、backup-index.html；rollback-index.py只在index仍匹配回执时恢复上一入口，不删资源、不重启。完整恢复本轮前入口需先按导航回执退回17b0404，再使用上级目录的回滚脚本退回此前3438b08；本轮未执行回滚。导航三个新增入口的最终归属未决，见原有问题清单。下方保留历史时点记录。

# Windows本地开发交接

2026-10-18 工程展示恢复仅Next view+纯formatter；缺耗时保留未知，不冒充0。67项定向、strict/一次构建通过，等待静态与Edge验收，见docs/project-empty-call-meta-20261018.md。

2026-10-18 类别选择仅改现有草稿组件/store，无新接口；100项回归、最终strict/构建通过，旧未知项仅在计数投影中过滤，不从真实draft清除。详见docs/tool-scope-selection-20261018.md。

2026-10-18 搜索快捷键modal保护：仅一处原handler及相邻迁移页类型helper；92项定向通过，最终strict/构建通过。部署源与文档时点分别记录，详见docs/modal-search-shortcut-20261018.md。

2026-10-18 Preview/Profiler恢复只改Next，330+46定向测试、strict/构建通过，未知保护跨收起/离页；仅做隔离操作验收，不触发真实Creator/模型或持久配置。专项证据：docs/preview-profiler-entry-20261018.md。

2026-10-18 访问说明：裸Next地址需要当前浏览器会话。403已通过原creator-ai ui正式入口在普通Edge恢复，并以真实接口验证Next及工程/状态/统计200；完整地址http://127.0.0.1:32180/next/index.html#/projects，旧403标签需刷新，守护进程重启后先重新运行ui。[原因、正式命令与两类浏览器证据](docs/access-session-403-20261018.md)。不关闭鉴权，不输出凭据；当前部署仍a8813ac/.44。

2026-10-17 a8813ac/.44工具范围入口已部署验收，证据C:/Users/33272/AppData/Local/Temp/companion-project-tool-scope-20261017/browser-proof.json及final-protection.json。无生产配置写入，Next检查点与部署源分别记录。

2026-10-17 接入完成示例d982a34/.42已部署；本次接续工程工具范围入口，不启动Creator/模型或写客户端配置，使用现有32180/PID2100，保护共享22项修改。详见docs/project-tool-scope-entry-20261017.md。

2026-10-17 日志切片最终部署9a6e952/.35：先备份26旧资源、保留hash、最后原子切换index，六HTTP SHA与独立认证Edge通过。清除只测隔离数据，生产DELETE0；真实诊断一次/583B仅存Temp本机。PID4092/epoch、22dirty及用户窗口保持，无新监听/Creator/模型/客户端配置。代码与文档HEAD分开，详见[本轮交付](docs/log-tools-20261017.md)。


2026-10-17 10:43 UTC接续：独立fixture c80b890/.18已归档本轮新96资源的场景/跨会话重开、Preview/846采样Profiler/WebMobile/Smoke；原scene_validate的两种弃用warn误判false不改写，真实运行四类诊断为空、两图已查看。累计554154/1800000ms、active=null，全体自有测试进程/7458/Smoke12180关闭，旧32构建文件恢复、7settings保持。随后原/v1只读status+variant-preview均200，原任务r6/source796a233/currentHistoryHead=c80b890，PNG/收据和三task字节保持；Next原适配离线82项与strict类型通过，仅增加测试/证据，不改src/依赖/部署。页面实际仍1.3.173，部署源3074d37/.25；正式creator-ai ui与同源Next地址已在用户浏览器打开，独立正常认证Edge核页面200、六文件SHA相同、0页面/Console错误且已关闭，用户窗口保留。不启动模型/Creator，不因3595无监听重复起daemon；原32180/PID4092继续。详见[接续回归记录](docs/history-read-regression-20261017.md)，早期记录保持原时间。

2026-10-17 新尺寸变体入口已完成：代码及实际部署3074d37/1.3.173.25，产品页面版本1.3.173；新任务一次96×96 import-variant、资源UUID/SpriteFrame和真实PNG预览通过，原母图按钮未执行。3883测试/类型/构建通过，六静态HTTP SHA一致，原Node25服务未重启，Owner dirty与旧任务保持。累计412.673/1800秒，自有进程关闭，零云上传。[完整计划、回执与本地截图](docs/variant-ui-import-20261017.md)。

2026-10-17 05:40 UTC：原独立新任务已真实完成Next采用/选图/CPU96导出/1024母图导入，各写一次；r6、effectApplied=true、租约RELEASED，资产及meta回读一致，账本SUCCEEDED/TERMINAL/fence9。Creator/Edge/全部自有端口关闭，累计381.067/1800秒、active=null。任务原sourceRevision仍a2ff18a，资产检查点e182b6b/0.1.0.11后仅读历史，未改任务；原settings、旧成功资源与冻结记录保持。运行Next仍caf14fb/1.3.173.18，无业务源码/部署变化；不新增变体导入UI，productionVerified固定false。实际步骤、本地回执/截图及误上传撤回记录见[本轮交付](docs/variant-ui-followup-20261017.md)；下列旧记录保留各自时间。

2026-10-17 变体摘要本地增量：代码 `c3b1fd1a8adf27c21018ff314e01eb666305d378` / `1.3.173.16`，936 项受影响测试、类型和 workspace 构建通过；未部署。真实 Next 资源页正确选中隔离工程，但原 jobs/status 因 Studio adopted exact-HEAD 合同返回409，完整 UI 尚未通过；变体 PNG 字节接口也待协调。既有 Preview/Profiler/Build 证据及 Library 截图 ID、GPU 待排 Smoke、精确 Owner 文件清单见[本轮交接](docs/variant-ui-followup-20261017.md)。

原创建/初始化已恢复（本机源码切片）：四来源选择、Creator3.8.8原scaffold接口，显式确认成功只回填路径。92文件3840项、类型/正常构建通过；真实接口仅在两个本任务Temp合成工程验证201与最小文件，登记列表未变，未启动Creator。静态/浏览器交付与剩余缺口见[本片记录](docs/project-scaffold-local.md)和[主差距清单](docs/feature-parity-current.md)。


原目录选择已恢复并部署（2026-10-16 13:13 UTC）：代码20412e1/本地1.3.173.9；显式系统选择只填路径，取消保留，未知窗口保持互斥，不自动登记/初始化/启动。最终91文件3797项、类型/构建和Edge受控5项通过；六静态回读一致、39个既有进程及1779/22保护不变。真实系统窗口与生产认证页面仍待验，见[本片交付](docs/project-directory-local.md)。

知识入口后续交付（2026-10-16 12:43 UTC）：源码 `d3792c10a6017830118ecb0878cacb44667ac819` / 本地1.3.173.7，只恢复旧知识服务不可内嵌分支的8081固定外链；模型原版无外开，不擅加新入口。最终90文件3775测试、types与正常构建通过，独立Edge受控5项通过（真实后台未打开）。固定8081只读实测ECONNREFUSED，未为测试启动服务/模型。详见[知识入口](docs/knowledge-service-entry-local.md)。

第二片六静态回读一致，新增index-BLZP7lTS.js/index-BaZPIQDA.css，最后原子切换入口；旧12文件已备份，11份旧资源保留。1779保护项/22原脏项无变化；第二次部署前后43个node/python/Creator身份一致。该片构建源是d3792c1，后续纯说明提交不重标构建；package/页面继续1.3.173。第二片证据在原任务目录的knowledge-entry子目录，前Dashboard证据及备份完整保留。

最新功能交付（2026-10-16）：已恢复独立手动Dashboard列表与原点选路径进入登记向导，代码 `6fe88585d942fe9862acc98b65664465734d1d10` / 本地版本1.3.173.5；package/页面版本继续1.3.173，没有擅改Owner前三位版本。90文件3768测试、vue-tsc及正常workspace构建通过，静态55通过/1项Windows大小写fixture跳过。真实机器API两次8项/6项登记匹配；既有Playwright+独立Edge以真实只读快照和受控故障验证5项流程，0业务写入/0页面异常；不等于认证生产页面验收。

仅部署本片同一六静态路径，新增index-CXcfVXmi.css/index-DVyF6XSu.js并最后原子切换index，回读六项一致；原10项中的9项旧资源和index备份保留，1779保护/22原脏项无变。部署前后42个node/python/Creator进程PID、名称、创建时间一致，无共享服务重启/模型操作。源码、文档提交与可回滚部署分别记录，完整缺口见主矩阵；旧AI变体产物/UNKNOWN保持。完整证据位于 `C:/Users/33272/AppData/Local/Temp/companion-next-parity-20261016-1201`，本片合同与边界见 [Dashboard还原](docs/dashboard-discovery-local.md)。

状态：Accepted（Owner/Parent已批准完整源码同步、本地开发/测试/构建/六静态文件部署及原锁官方npm依赖；Owner Sentinel_40a744e240288191a450453b37a4b488另明确批准第1项在Windows正常执行环境中保留原检查完成这些动作，不改网络/安全配置）。

当前交付（2026-10-16 08:57 UTC）：获准宿主确认无残留项目npm，正常DNS/HTTPS200；原锁214包安装与逐项版本/来源/SHA512通过，package/lock不变、D盘缓存、生命周期脚本未运行。本机89文件3751测试、vue-tsc及正常companion-workspace构建通过；静态55通过/0失败/1项Windows大小写fixture跳过，实际六产物引用/SHA独立通过。已仅部署本机173六静态并回读一致，172六备份/旧hash资源、1779保护项与22原修改保留，无共享服务重启。Owner认证页面与真实浏览器交互仍未验收。证据在仓外同目录host-dependency-verification.json、local-validation-result.json、local-workspace-manifest.json与local173-deployment-result.json。

历史阻塞（05:15 UTC，已由本次明确批准的正常执行环境解决）：此前受限上下文安装因`ENOTFOUND`退出1，并报`Exit handler never called!`。当时没有改DNS、代理或安全设置、没有绕过拒绝；旧回执`locked-install-blocker-receipt.json`仅代表当时状态。

本目录为Companion Next独立前端源码，与独立游戏运营后台分别维护。最初接收既有1.3.173基线；后续已按上述本机切片继续恢复旧功能，没有改旧后端源码或控制共享服务。

## 来源与文件边界

来源完整包`companion-next-1.3.173-complete-source.zip`，1313261字节，SHA256=`b4dc893ddaab276ef8fd95c2eb35d82a4f1597affe8b6b6f03e1659d0ad2b477`；Library `libfile_bbf510fb90948191afc351ff85cfd1db`/version0，来源HEAD=`9db8b3af26982af7e9366ae03d865d8782f98a33`，产品版本1.3.173。正常浏览器会话下载，未读取认证材料。

04:56 UTC导入时319份来源文件及3份迁移元信息全部逐文件校验字节/SHA256并回读；不含Git历史。原清单`SOURCE-MANIFEST.json`和`SOURCE-COMMIT.txt`原样保留。之后仅在README增加本地版本与状态入口，并增加本文件、VERSION、标准scripts/git_version.py及两项.githooks；package/lock/业务源码均保持来源字节。初始Git提交是本地导入检查点，不是来源提交本身，不能声称保留原Git历史。旧Downloads快照及既有后端未改。

本次实际测试/构建/部署源为本地`31de6878239d20230657f85368e57601a51ba70b`（本地检查点1.3.173.2），原来源仍为9db8b3a。后续本README/交接与Hook VERSION的说明提交不重标这批构建；产品package/页面仍为1.3.173。

## 环境与锁定安装

采用已存在Node22.23.3：`D:/code/shidai3/P8000/dual-game-build/node_modules/node/bin/node.exe`，配套物理npm11.6.2入口`C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`。不改系统Node/PATH，不共享其他项目node_modules。

锁文件v3有264个package记录，全部为官方HTTPS tarball并带SHA512；当前Win32-x64适用214个，缓存命中110、缺104（102必需、2可选）。原110份缓存已逐包验证完整性后复制到上述D盘缓存。逐项版本/URL/integrity清单在`C:/Users/33272/AppData/Local/Temp/companion-next-1.3.173-source-sync-20261016/dependency-download-scope.json`，最初待批准状态是历史；本次Parent已批准原锁必要依赖，无需重复确认。

首次执行原锁项目本地安装因受限上下文失败，15个原锁tarball及npm update-notifier元信息共16个URL、48次DNS失败、0个成功HTTP；没有升级npm或依赖。08:45在明确获准宿主正常环境续装，使用同一D盘缓存及`ci --ignore-scripts --no-audit --no-fund --prefer-offline --update-notifier=false --registry=https://registry.npmjs.org`，退出0，214包完整安装。实际安装解析来源全部registry.npmjs.org且与原锁一致，全部已安装tarball的SHA512回查通过；没有运行安装脚本、增加包、全局安装或升级锁。package SHA256=`853f7379d7e4ea38c114213947cbc4773de2ffd8b98a5a9fc8b14fc5d8098ab2`，lock SHA256=`c5cfda71019754a954c6acd9e570121d28a9975e6aceae65bab7ee375c98e23a`，安装前后不变。保留上游whatwg-encoding/glob弃用提示，未擅自升级或宣称完成新漏洞审计。

本地Git使用P0002四段版本合同，前三位沿用批准的产品1.3.173，本仓W独立递增。Hook和VERSION由本仓维护；脚本从工作区标准实现复制，仅适配首次unborn HEAD。Hook默认python3；Windows已有python3为Store别名，本轮仅在提交进程中设置`COMPANION_NEXT_PYTHON=C:/Users/33272/miniconda3/python.exe`，不修改全局配置或PATH。

## 验证、部署与下一步

2026-10-16只读验收补核：本轮工具目录没有用户浏览器控制、Playwright/CUA或工具检索入口，只有打开Codex面板；不重试历史失败初始化。173认证页面版本、资源响应SHA、真实hover/focus/Escape/失焦与截图仍未验，Owner会话状态未知。源码ProjectStatusTag.vue:8–11与旧app.ts:1364–1365的两条独立条件一致，既有3751本机测试不代替浏览器验收。旧7471草稿导出/重启答复仅对应已完成编辑器窗口，没有取消这两项核查；没有重复应用/重启。

AI变体只读结论：通用asset_import接受绝对sourcePath与db://assets/... destinationUrl，目标存在拒绝、overwrite:false/rename:false；使用现有lease/stable operationId、operation_get和资产hash/UUID/SpriteFrame读回。裸工具不接预期SHA/variant身份；Python facade没有任意PNG/variant导入API，Studio importer固定1024×1024透明comfyui-local母图。正式nested companion-daemon.js（SHA39e88c9045e5d8266b059ce2b1ceb48cf522c5d0afc5f4596658c4545ae6641e）仍为v1变体收据、runtimeImported:false，没有源码新增的binding/readVariant；不能把旧jobId母图import或未打包源码当variant闭环。运行所选Python/Node/CLI/Studio/Pillow路径仍未读取/未验证。下一窄片先由旧后端/Studio Owner协调icon-adapter.ts、icon-image-assets.ts和local-icon-import.ts的可读回绑定收据/variant分支，保留Creator原语与UNKNOWN不重发；本轮不实施。完整参数、防覆盖、meta、UNKNOWN及执行器路径证据：仓外同目录[browser173-variant-import-contract-20261016.md](C:/Users/33272/AppData/Local/Temp/companion-next-1.3.173-source-sync-20261016/browser173-variant-import-contract-20261016.md)。

实际依次执行`npm test -- --maxWorkers=4`、`npm run build:companion-workspace`和`npm run test:companion-static`：Vitest89文件/3751项全过；workspace脚本先vue-tsc --noEmit再正常Vite构建、base ./，退出0；静态55通过/0失败/1跳过，跳过原因是Windows无法同时表示仅大小写不同的文件名。实际六产物另由现有inspectStaticCandidate检查普通文件/链接、路径、JS语法、HTML/JS/CSS引用及完整SHA，全部通过。验证期间源码commit、package/lock保持、工作树干净；未改断言、减少测试范围或重复另外四种构建模式。保留大chunk提示，不把离线结果等同真实浏览器/GPU/Creator或业务API验收。

08:57 UTC仅部署到`D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/web/next`的manifest六路径，共2283176字节。实际新增`assets/index-W3W5uKIL.js`和`assets/index-BS4nt8-3.css`，最后原子切换index；另三资源同字节未重写。旧hash资源保留，172六备份仍位于`C:/Users/33272/AppData/Local/Temp/companion-next-1.3.173-deploy-20261016/backup-current-172`，全部回读通过。部署前后1779保护/22原修改匹配，其中junction只核元信息，原node_modules目录不遍历，不能扩成内部内容审计。没有启动/停止/重启daemon、Creator或Dashboard，没有使用预构建ZIP代替本机验证。

- 本地构建manifest SHA256：`bbaafb75dbae58bd7e1fd03401c8f5689274f8b5fe0db3398a15020f017e072b`
- 构建/部署相同六静态内容摘要：`04232eb3f19c7fe572c581a62c27ddba51c9faa87351c4211a205d3c67bc299d`
- 已部署index SHA256：`74d548524c24040537ebe6b9918de1aa3ad352f3aa82ea50f66e2ecedd5079d8`

回滚只恢复已核172 index，旧JS/CSS仍在，新hash资源可保持未引用；不恢复旧源码/父仓索引/用户数据或重启共享服务。若结果不明或有后续修改，先核当前SHA，不直接重跑apply/覆盖；脚本切换index后的失败不会自动回滚。本次已正常完成。完整六文件/前后保护/备份及写入记录在local173-deployment-result.json，元信息和manifest没有放入网页目录。

原Hook/Agent/check-head用于本地检查点；部署脚本经独立reviewer审查无有证据P1/P2。普通角色prompt-emulated、硬只读隔离未核验；OCR仅作任务文档范围规则选择/宿主审读，不宣称managed PASS。认证页面、资源响应SHA及真实交互未验，没有读取/迁移Cookie/token。AI资源链独立只读合同已在仓外readonly-diagnostics-20261016.md记录；未修改旧后端/Studio、调用模型/GPU或导入业务资源，合同扩展另协调。

可恢复性：同步到全新独立路径，未覆盖原工程；本地Git检查点保留来源及治理适配。若放弃本机准备，保留目录及证据供Owner处置，不自动递归删除；不回滚旧后端、父仓索引、用户数据或共享服务。没有远端、push/tag或父仓gitlink变化。


## 2026-10-20 模型交互、知识库层级及看板收敛

任务检查点 checkpoints/model-copy-20261020 指向72989d4。模型页按旧实现直接启停，仅改变前端步骤，原同源鉴权、UNKNOWN及并发锁保持；knowledgeOnly只呈现知识服务，跨页回执按服务过滤。知识查询参数/原文/Agent/问答/同步入口保留。看板集中工程及服务状态并跳转既有管理页，不因点击启动服务。隔离验证拦截全部模型启停POST，知识只作已有库、有限文档和纯关键词读取。禁止截图/上传及触碰用户当前标签。证据目录：C:/Users/33272/AppData/Local/Temp/companion-model-copy-20261020-1336。Windows重启后既有Companion PID20252、WeKnora PID22932已恢复；当前配置哈希另立保护基线，不回退用户已变化的Codex配置。静态交付尚待实际收据确认。


本轮追加已确认：更新记录按UTC+08自然日归并（保留原版本追溯与全部变更）；帮助左侧目录仅加强一二级视觉层级、选中与键盘焦点；关于页删除“数据与兼容边界”展示，合并Next/Creator AI产品信息块。上述均仅界面范围，版本策略、数据及兼容逻辑保持。


2026-10-20 六项界面收敛代码已完成并通过独立只读审查：模型旧交互、知识库精简、看板合卡状态跳转、全局每日更新记录、帮助目录层级、关于合卡。知识页/模型页定向状态GET，看板保留两服务汇总。全仓4497项初跑4496通过，唯一旧空态断言已同步，最终受影响3文件64项通过，其余4496项通过；严格类型通过。原历史114版本/201变更及前端记录守恒，10月12日两产品同日真正合一条。当前是源码自检结果，静态部署/实际隔离页面验收待下一条交付记录，不能代替用户验收。


## 2026-10-20 本轮实际交付（8260985）

2026-10-20 本轮六项已部署：实际静态源码 **8260985 / 1.3.173.186**，页面产品版本仍1.3.173。模型页恢复原一次点击启动/关闭；知识库移除无关模型卡、说明、回执及状态请求，列表/搜索优先；看板单卡集中五类独立状态并跳已有管理页；更新记录按UTC+08全局每日一条，保留全部版本及历史；帮助目录层级/选中/焦点加强；关于产品信息合卡并删除指定边界展示。**自检完成、已部署、待用户验收**，没有操作用户当前标签。

验证：全仓4497项初跑4496通过，唯一空态旧文案断言已同步，最终受影响3文件64项通过；严格类型、构建及独立审查通过。实际部署6文件HTTP SHA全部一致，隔离页面34项通过/0页面错误；既有知识库列表/有限文档/纯关键词查询均真实读取；模型启停各拦截1次，真实启停0次，知识库页面模型状态GET为0。帮助1384/760/390宽度与焦点/选中、看板窄屏、更新记录10月12日跨产品同日合并及版本追溯、关于原必要功能保留均验。322原文件只有Next index替换，新增2哈希资源，旧资源保留，最新324文件基线；Companion PID20252、WeKnora PID22932、9业务表、现有配置及共享修改/暂存指纹保持。历史UNKNOWN未清理，截图/上传0次。完整本轮收据：C:/Users/33272/AppData/Local/Temp/companion-model-copy-20261020-1336（delivery-summary、deployment、http-verification、browser-result、final-protection及post-static-baseline）。后续docs-only提交不改变这份实际部署源码。


## 2026-10-20 看板归属错误复盘与返工

先读既有knowledge-retrospective-20261018.md第5节：局部测试通过不能替代用户目标闭环。该文件是知识专项，不冒称通用UI规范。本轮8b9fcfd/8260985看板用户验收未通过：把“集中必要信息”实现为选中工程的总卡，全局知识库/模型启动器因位于工程名之下被错误表达为工程附属；同时把全局看板做成了带选择器与详情列表的工程页。实现和审查偏重状态映射、链接及测试计数，没有验证模块归属与用户预期的信息结构。

本轮明确纠正：看板不按selectedProject渲染；每工程独立卡、最多真实最近4个，Dashboard原lastOpenedAt排序，缺时间明确标示，禁止用observedAt或当前时间代替；知识库/模型为独立全局卡，不嵌工程节点，服务链接不携工程参数。状态、摘要在各自卡内，全部工程只链接既有列表页，删除独立状态说明/工程详情/重复列表。原工程管理/资源/规范功能仍可达，其他页面选择器保留。

验收增加归属断言：每工程状态只来自该projectId；服务卡不得有工程卡祖先或任何工程名/上下文；2/3/4/空列表、真实时间排序、有效空recent不回旧缓存、探测中断/来源替换与迟到结果、卡片空白和次级入口、同视口布局、窄屏/键盘均需核对。实际页面检查及用户验收分别报告，不以N项通过宣称用户接受。返工前检查点checkpoints/dashboard-rework-20261020=8b9fcfd；运行保护基线324文件。


## 2026-10-20 14:21 看板返工源码状态

前轮8260985总卡布局未通过用户验收。本轮工程各一张卡、最多真实最近4个，知识库/模型/Companion各独立全局卡；移除看板下拉及重复说明/详情/列表，保留全部工程、各工程资源/规范/Bridge入口和动态更新。进入无参数看板不再默认选首工程，服务卡不带工程query、不改原选择；显式旧链接与其他页选择行为保持。真实recent仅用原Dashboard.lastOpenedAt，不用当前时间；有效空/失败不复用旧缓存，缺时间明确标示。

4521项全仓初跑4520通过，唯一旧总卡selector已更新，最终6相关文件151项通过；严格类型、独立只读审查和本地规则检查通过。当前尚待同视口实际页面及部署核验，不代表用户接受。复盘与归属断言见LOCAL_DEVELOPMENT.md；任务前checkpoint=8b9fcfd。知识库拆页仅评估，未改知识路由/导航或结构。


## 本轮实际部署与验收边界（6cc9c28）

2026-10-20 看板返工已实际部署 **6cc9c28 / 1.3.173.188**（产品版本1.3.173）：工程各独立卡、最多真实最近4个，全局知识库/模型/Companion独立卡，不再归属ant-cook或任何工程；无看板下拉、独立状态说明/工程详情/重复列表，保留全部工程、资源/规范/Bridge及实时控制。全局进入与服务点击不改原工程上下文，显式旧链接兼容。本轮修正了前轮被用户拒绝的总卡布局；归属复盘见LOCAL_DEVELOPMENT。

全仓4521项初跑4520通过，唯一旧总卡selector断言已同步，最终6文件151项通过；严格类型、构建、独立审查、本地规则通过。候选42项和已部署42项DOM/布局/点击检查均通过，页面错误0；真实7登记/9Dashboard记录排序核对、2/3/4/空列表、1384/760/390宽度、卡片空白点击与独立服务跳转均验。6静态HTTP SHA一致。324原文件仅Next index变化，新增2哈希资源，最新326文件基线；PID20252/22932、9业务表、配置及共享修改/暂存指纹保持，历史UNKNOWN未清理。截图检查因保留不截图指令被自动审批拒绝，执行前未产生截图；改用DOM/计算布局，截图/上传/模型操作/用户标签操作均0。**自检完成、已部署、待用户验收**，不称图像截图审阅或用户已接受。

证据：C:/Users/33272/AppData/Local/Temp/companion-dashboard-rework-20261020-1421（delivery-summary.json、candidate-browser.json、deployed-browser.json、deployment.json、http-verification.json、final-protection.json、post-static-baseline.json）。文档提交不改变实际部署源码6cc9c28。

知识库拆页已只读评估，未改路由/导航/结构：建议三个子页“检索与文档（默认）／问答／连接与同步”，二级入口；ID/切片/原始回执留详情，问答方式页内切换。实施需保留选中库、搜索结果/条件/返回位置和跨页UNKNOWN保护，旧knowledge及models链接兼容；问答/Agent/同步不能因已有入口称真实验收通过。待用户确认方案后才实施。
