# 知识401专项：尚未修复（2026-10-19）

用户最新范围优先：撤销VS Code候选装载及其专属后继锁开发，保留隔离代码；当前只恢复原知识只读配置。VS Code不是用户正在使用的功能，不作为当前迁移阻塞。

## 确切401层级

自有浏览器原session登录成功、knowledge/status200，kb/list实际401/top-level AUTH_MISSING。实际安装companion-daemon.js.map的knowledge-isolation.ts:66–67在缺isolation.credentialFile时直接拒绝，早于worker/CLI/WeKnora。不是浏览器登录401，也没有证据称为WeKnora密钥过期、权限403或服务不通。

daemon构造时仅从COMPANION_KNOWLEDGE_CREDENTIAL_FILE捕获引用（companion-daemon.ts:207–209）；原正常CLI只spawn并继承父进程环境（companion-cli.ts:235–240），无恢复引用逻辑。原scripts/connect-knowledge-reader.ps1:6只设当前PowerShell进程变量，未持久保存。只读检查确认当前用户级和调用进程级均缺该变量。原D:/services/weknora/cli/private/pilot-recovery-reader.dpapi仍存在620B，仅stat元数据，未读取blob或密钥。

此前真实关键词搜索通过来自带原引用启动的前一实例；12:14应用切换脚本仅继承环境，未显式恢复引用。磁盘文件还在不能代证新实例带引用。先前用旧搜索成功证明当前知识已恢复的判断无效。

## 操作状态与具体阻塞

撤销时没有进入部署：无admission-frozen/termination-issued/install-issued/start-issued，目标确切句柄只Inspect未Terminate。13:35复核服务仍PID10820、epoch7601ac9d-a500-46d8-8db0-9a0f28e7569c、OPEN；安装entrySHA仍aa703700e04116f3a03352ed63fc59e39e46cf82c0645202a408810086becc6f，原0.3.147。历史UNKNOWN2保留，业务计数0（状态请求自身http1）。UI仍ecabe7e/内部1.3.173.131。没有半部署/半停止。

运行包未提供reader reload/config入口，immutable构造引用不能通过改浏览器session恢复。正常daemon start --restart调用同一guarded stop，现有UNKNOWN2会阻止close；若直接结束进程，现有同boot锁留存，原包拒绝新wx写入者。当前没有执行强退、删锁、清UNKNOWN或沿用已取消的候选路径。因此当前知识修复、持久配置恢复、正常入口重启后的验收均未完成，不宣称服务已恢复。

需要解决的是知识正常启动引用持久性与既有宿主安全切换路径，不是VS Code。仅一次设置启动环境也不能满足用户要求的正常重启后保留；不能以一次HTTP成功结束。验收仍需当前UI文档列表、分片、符合既有小文件条件的原文、搜索，以及正常入口重启后重复核验。原reader固定KB与retrieve-only权限保持，禁止换全权限key/遍历资料/原文归档/问答模型。

## 已暂停隔离代码

Temp/companion-client-rollback-fix-20261019保留全部原候选和新增未装载修改；未提交/构建最终包/部署。最初六文件164项通过，后加三项边界测试的一次运行因新增测试段残留字面加号导致解析失败（其余五文件127项通过），尚未修复；不得将其称为最终通过候选。用户撤销后未继续专属锁开发。

本记录及矩阵为事实检查点，不请求重复审批，不把已取消候选或新维护框架当作KB恢复前置。真实阻塞保留待明确安全的原宿主修复路径，所有运行配置与锁保持原样。

## 后续已授权恢复准备
+
+原入口scripts/connect-knowledge-reader.ps1最小修复：同一既有reader路径写入用户级非密钥启动引用；已有不同引用则拒绝替换，仅检查原文件元数据，不读取密钥。增加StartOnly供精确旧进程退出后的正常CLI启动，NoBrowser避免操作用户窗口；默认guarded restart保留。正常重新启动从持久引用恢复，不依赖上一个临时PowerShell会话。
+
+KB专项切换保持实际安装0.3.147全部文件，不装载VSCode候选。预定复用精确进程句柄身份/创建时间校验及授权强杀，冻结后证明无当前实际任务，保留UNKNOWN2；退出后只把已核验pid/writer/hash/inode的已知旧boot锁原字节保留为retired sidecar，原legacy锁和journal/head保持。没有未知锁删除或历史迁移。实际结果以后续回执为准，当前为操作前检查点。
+