# 原创建/初始化接口还原

状态：本机已交付。2026-10-17 00:37 UTC完成六静态切换，实际HTTP回读及认证Edge表单验收通过；不代表 Creator 启动或完整五步向导已验收。恢复过程见[中断恢复回执](next-recovery-20261017.md)。

本片复用旧 `POST /api/projects/scaffold`。创建发送 `{mode:"create",parentPath,projectName,creatorVersion:"3.8.8"}`，初始化发送 `{mode:"initialize",path,creatorVersion:"3.8.8"}`；要求201及明确的规范路径/Creator3.8.8回执。创建目标不得存在，初始化目标须为已存在的空目录。原实现只生成package.json和空assets；创建时可能递归建立父目录，失败不保证回滚父目录。

范围为原四来源中的创建和初始化表单、同源适配器、共用工程操作lane和结果回填。成功仅回填后续登记路径；登记、Bridge安装、Dashboard启动和持久Agent配置保持各自显式操作，不在scaffold后自动执行。五步流程的多Agent选择、严格部分setup以及真实Creator/原生窗口仍是独立缺口。

准备确认绑定当前来源、原表单与写入能力，一次确认只发一次请求。并发与原目录窗口共用lane；关闭、离页、来源或表单变化丢弃迟到回填，但保留原回执。结果未知或清理失败保留互斥，不把fetch结束解释为后台文件写入已取消，不自动重试或覆盖目标。回执仅保存在当前Pinia会话，刷新与跨标签不能提供全局互斥。

文件边界：domain/project-setup、adapters/project-setup、独立project-scaffold store、原ProjectSetupWizard、所属更新日志、定向测试及本片文档。不得改旧后台、真实工程文件、依赖、权限或其他项目。

验收：合成传输覆盖精确body/201、输入与回执校验、错误脱敏、并发/UNKNOWN；store/UI覆盖四来源、显式确认、成功只回填、关闭/离页/换源迟到保护。真实API写验证仅使用本任务Temp合成目录，禁止登记/安装/启动。UI只验设计分辨率，浏览器未完成则明确待验。

回滚：只撤回本片Next源码/静态索引；已由用户确认创建的真实目录不会自动删除。测试目录保留证据，若清理只允许逐个核实本任务Temp路径。

验证结果（2026-10-16）：新43项定向测试、既有5文件428项、最终92文件3840项完整回归通过；vue-tsc与正常companion-workspace构建通过。初次新测试导入路径错误已改；沙箱缓存rename EPERM未执行断言，同命令普通宿主仅重试一次通过。OCR Delegation Mode九路径无遗漏，读取共享规则；实际reviewer任务`/root/companion_next_reviewer`只读审查无P1/P2，为prompt-emulated，硬隔离未核验。原始资源代码与共享22条dirty均不在本片修改范围。

真实接口：复用运行候选daemon，Temp合成create和initialize均HTTP201；逐个回读package.json Creator3.8.8、随机UUID和空assets，只新增本任务Temp文件。登记列表未变、daemon仍OPEN；未登记、安装Bridge、配置客户端或启动Creator。接口认证仅原正常UI入口，材料未输出。

证据目录：`C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/interface-load-20261016-phase2`，含`next-scaffold-full-tests.log`、`next-scaffold-types.log`、`next-scaffold-build.log`、`next-scaffold-runtime-receipt.json`、OCR规则与浏览器记录。浏览器首轮脚本点击隐藏radio被Element Plus可见标签阻挡，失败保留，随后改为用户可见标签；不得将脚本首轮失败记成验收通过。

浏览器：独立Edge在1440×1080通过4项，覆盖create/init显式确认、成功只回填、关闭保持互斥及丢弃迟到、失败UNKNOWN不重放；全程4个受控scaffold请求、0个其他业务写请求、0页面错误。首张截图捕捉到radio色彩过渡帧，已独立等待既有动画结束，核对create的checked/is-active与蓝色高亮一致；未改产品样式。`next-scaffold-visual-settled-1440.png`为完成过渡后的截图。测试使用较早真实登记/状态快照、受控写回执，不宣称生产认证浏览器或真实原生窗口验收。

本片交付：构建源码`5419ace06f5f25f4a3f4300dcfab2a85255edc68` / 本地`1.3.173.11`，页面产品版本仍为`1.3.173`。入口SHA256为`4717a68ace5df9c95fe65ca67783b85d1069d95e83de053d7e618fccfc9808ab`；六项实际HTTP200且字节/SHA一致。新认证Edge在1440×1080实际同源页面检查四来源、创建请求预览及初始化表单，0业务写请求、0页面错误；未点击最终创建确认或系统目录窗口。昨晚两个Temp工程201的文件写验证仍按原范围有效，本次没有重放。

现有完整回归92文件3840项、类型与构建证据复用：全部冻结功能输入、构建产物与已提交功能源码未变，本次仅恢复同一提交的README/索引并完成既有部署，不重复全量测试。当前daemon PID16140、启动epoch`4e1af6ae-0131-4c17-9998-2a68d2c7ea41`，仅127.0.0.1:32180，OPEN且活动计数全0。历史UNKNOWN及632操作/292派发的固定元数据前后完全一致。资源候选仅恢复原CLI正常start，四后台产物、110共享源码、22原dirty与45份原工程/任务文件保持。

本轮按恢复交付范围收口，未继续新增UI或日志功能。日志清空、诊断脱敏、完整五步流程和真实Creator等仍以主差距清单为准；真实资源导入与任何通配监听继续受原隔离和Owner审批约束。
