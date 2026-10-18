# 知识服务启动503修复与只读恢复（2026-10-18）

状态：Accepted。本批独立处理知识服务启动，不重试被拒的Creator切换，不重跑预设或Preview探测。前置任务Git检查点为 `95b2f9e / 1.3.173.97`。Next产品静态代码仍是 `9af5813 / .94`，原daemon无需重启。

## 根因与最小修复

前批真实Next启动一次503。此次两次检查均无weknora.exe、无原启动脚本进程、8081无监听；原metadata-prestart/server日志仍为10月16日，确认不是结果未知或已启动，不重复启动。

将原脚本启动前20行提取为只读诊断（元数据输出改到任务Temp，不加载JWT或启动服务），用同一个powershell.exe复现：约1.3秒后在 `Get-FileHash` 退出1，CommandNotFound。Windows PowerShell实际版本5.1.26100.9711；继承的PSModulePath将Codex运行时的Microsoft.PowerShell.Utility模块7.0.0.0/Core排在系统模块3.1.0.0/Desktop前，导致Desktop进程无法正常发现该命令。仅给诊断子进程限定系统5.1模块目录后，相同守卫约2秒退出0，所有SQLite/历史状态守卫通过。

修复仅在 `D:/services/weknora/Start-PilotAccess.ps1` 的ErrorActionPreference之后、首个cmdlet之前增加注释及下列进程环境赋值：

```powershell
# Windows PowerShell must not auto-load inherited PowerShell 7 modules.
$env:PSModulePath = Join-Path $PSHOME 'Modules'
```

只影响本次启动的PowerShell进程，不改用户/系统全局环境，也不改凭据、执行策略、安全头或权限。原其余字节完全保留；仍执行原二进制manifest哈希、SQLite只读预检查和历史哈希守卫。原AUTO_MIGRATE/AUTO_RECOVER_DIRTY/HOUSEKEEPING=false、127.0.0.1绑定、SQLite/本地文件存储及禁用模型/同步自动动作的配置保留。

原脚本SHA `960a29822febd4b942d5f70dfd00c0fa4a64bf4b6c25d1da8676482f04aef8eb`，修复后 `d5d799ea341e0bd4bc77fbb39f7d673e9e9200cfb1a021c93cc7b8a9737ed233`。原完整备份为任务Temp下 `Start-PilotAccess.before.ps1`；长期证据包含准确补丁和前后SHA，不包含JWT内容。若回滚，须先核对当前SHA仍等于本次after，不能覆盖其他人的后续修改；本批未回滚已验证修复。

## 真实恢复结果

| 检查 | 真实结果 | 边界 |
| --- | --- | --- |
| Next原确认启动入口 | 修复后只POST一次，HTTP200、running=true、无error | 初步脚本的externalLink=false是未等待状态刷新；下项独立只读检查已明确验证外开入口可见，不把该瞬时结果当产品失败 |
| 进程与监听 | 原weknora.exe PID20364；只监听127.0.0.1:8081 | 未增公网/通配监听，不重启共享daemon或Creator |
| Next状态和外开入口 | GET状态200，running=true、frameable=false；实际链接8081、target=_blank、noopener noreferrer；点击后原站/login、WeKnora标题和密码框可见，根页面HTTP200 | 自有空白浏览器会话只读查看，未登录、未创建凭据或提交问答/同步 |
| 实际iframe | Next iframe数0，正确使用原外开回退 | 原站X-Frame-Options=SAMEORIGIN、CSP frame-ancestors 'self'禁止32180跨端口内嵌；保留安全头，不计为iframe已通过，也不绕过限制 |
| 数据库守卫 | 启动后migration30/dirty0、quick_check=ok；触发表仍全部0；历史哈希和全部原state-check元数据与启动前相同 | 不等于整个数据库文件字节不变；未删除/重置/迁移/自动恢复数据库 |

知识服务保留运行以完成“安全恢复”的目标；未安装Windows服务或增加自动启动。问答、Agent、知识同步、Owner认证仍未执行；不据此宣称这些功能验收通过。

## 保护与审查

旧cocos-mcp、原工程和隔离工程HEAD/status、原脏文件哈希及暂存/未暂存补丁均保持基线。原daemon20116/epoch613ef7f2/SHA35225eb5、真实CLI入口6085072c、原Creator23740/session和Heretic3260模型状态投影保持；fixture无PID。没有Creator切换、模型启停、外部网络任务、安装、MCP配置写入、发布或推送。用户窗口未关闭，仅关闭自有headless Edge。

真实reviewer已只读审查根因实证和最小修复，无P1/P2阻碍；未让reviewer运行服务或修改文件，实际只读隔离未验证。无需重跑无关前端单元测试：本批验证为前置失败复现、修复后只读守卫、一次正式Next启动、独立只读页面/监听/元数据与保护核对。

[长期证据与准确启动补丁](evidence/knowledge-start-recovery-20261018.json)。原始脚本、JSON和截图目录：`C:/Users/33272/AppData/Local/Temp/companion-knowledge-start-diagnosis-20261018/`。
