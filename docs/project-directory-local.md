# 原系统目录选择迁移

本片边界：恢复旧 `web/src/app.ts:1960–1978` 的显式选择目录，只回填已有登记向导的路径。取消保留原输入；不登记、scaffold、安装 Bridge、启动 Creator 或配置客户端。

原合同已从本机 v150 源码核对：`http-server.ts:296–298` 接受同源已认证的 `POST /api/pick-directory`，空 JSON；daemon `companion-daemon.ts:267–270` 返回 `{path}` 或 `{cancelled:true}`。Windows `platform.ts:141–161` 复用系统 FolderBrowserDialog，关闭新建目录按钮。Next 不新增原生执行接口、依赖或权限。

实现边界为 `src/domain/project-setup.ts`、`src/adapters/project-setup.ts`、`src/components/ProjectSetupWizard.vue` 及对应回归，复用现有响应预算和工程操作互斥。原生窗口按旧行为等待本人选择/取消，不套用会提前中止 fetch 的通用120秒计时器。仅正常工作区提供能力；初载、导航和取消均不自动弹窗。向导关闭、连接/来源或原输入变化后，迟到结果不回填。前端关闭不保证系统窗口关闭，客户端清理完成前保留操作锁；传输未知或解码失败时，即使客户端idle也不能证明原生窗口结束，本页继续锁定，不自动重试。需本人先在原窗口完成/取消并核对，不能用刷新页面假称取消；旧后端没有查询/关闭未知窗口的接口，本片不新增它。

验收：固定空 JSON POST、严格路径/取消解码、错误脱敏、重复点击单次发送、取消保留输入、选择只回填、迟到响应/来源切换/导航不污染新上下文；既有登记和完整接入回归。真实系统选择仍需本人交互，受控浏览器不能替代。部署只更新既有六静态候选，保留旧 hash 资源及入口备份，不重启共享服务或模型。

状态：代码 `20412e11ed93c751f6a090d1af068237640e8c6e` / 本地1.3.173.9 已提交并完成六静态部署/回读；package与页面版本保持1.3.173。最终91文件3797项、定向428项、类型与正常workspace构建通过；独立reviewer发现通用超时会提前放开原生窗口的P2，修复并复审闭合。Edge独立上下文1440×1080五项通过，目录回执全部拦截，未打开真实系统窗口或生产认证页面。浏览器首轮脚本误点模态层后的侧栏而超时，仅将测试改为地址片段导航，产品不改。

部署13:13 UTC：新index-4sCvidlJ.js/index-Ug1PqAvX.css，入口SHA256=74ff66517075dc484dd73dfea2dcbab92487fafdee4684a02e1b01f15e83e922；原14文件已逐字节备份、13份旧资源保留。1779保护项/22原dirty无变，39个部署前后进程身份一致，无共享服务或模型动作。产物为代码.9，后续纯文档提交不重标；证据在原Temp任务目录directory-picker，见deployment-result.json、browser-receipt.json、final-full-tests.log。

首次沙盒Vitest在用例前缓存rename EPERM，原命令正常主机一次通过；首次Git提交在未改Hook启动sh时NtCreateDirectoryObject 0xC0000022失败，原提交正常主机一次成功，未绕Hook/修改权限。OCR Delegation显式父规则、宿主逐项审读，不称managed PASS。回退仅在入口仍匹配本片SHA时原子恢复backup-before-directory/index.html，保留旧新hash资源，不还原 Owner 文件、注册或原修改。创建/初始化、严格部分 setup 及其余差距继续以 [当前差距清单](feature-parity-current.md) 为准。
