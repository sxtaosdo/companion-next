2026-10-20 美术资源分组交付：源码与实际部署 **3b96bad / 1.3.173.181**，页面产品版本1.3.173。一级“美术资源”下为AI图标／游戏资源／图片素材；父项仅开合，原三个路由和业务保持，进入子页自动展开且仅子项高亮。概览首项及模型服务／服务状态保持。89项相关测试、严格类型、构建、独立只读审查通过；候选36项和部署后38项实际浏览器检查通过，6静态HTTP SHA一致，7完整工程卡及无横向溢出已核。**自检完成／已部署／待用户看图验收**，不称全部迁移验收完成。两张实际部署高清截图保留本机，授权Library保存因当前官方批量助手在tools/list阶段返回403而未能开始上传，未创建Library ID。证据目录：`C:/Users/33272/AppData/Local/Temp/companion-art-navigation-20261020`。下方338e759/.179为上一轮交付时点。 后续执行前使用本轮320文件基线 `C:/Users/33272/AppData/Local/Temp/companion-art-navigation-20261020/post-static-baseline.json`；下方navigation-followup/318文件基线及“最新”指令仅为上一轮历史，不再作为当前基线。

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
