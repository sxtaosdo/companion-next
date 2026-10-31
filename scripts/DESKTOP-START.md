# 游戏开发后台桌面入口

此入口提供六个独立操作：启动后台、只读诊断、在 Edge 打开后台、核查并恢复启动、认证就绪后继续启动、核查上次续接结果。启动沿用本项目的 `runtime-gate.mjs host-start` 和 `start-companion.mjs --no-browser`，由既有启动程序检查本地配置、账号服务和唯一的 32180 后台身份；面板本身不实现新的启动协议，不启动 Creator、生成服务或额外后台。打开后台使用固定的本机 32180 地址，并沿用原登录页面。

## 安装

将本次 `scripts/desktop-control.mjs`、`scripts/desktop-panel.ps1`、`scripts/desktop-protocol.ps1`、`scripts/install-desktop-shortcut.ps1` 和本说明文件与本项目已验证的启动脚本一起交付到**真实 Companion Next 项目目录**后，由操作员在该目录执行：

```powershell
powershell.exe -NoProfile -File .\scripts\install-desktop-shortcut.ps1
```

安装只创建桌面上的“游戏开发后台”快捷方式，不启动服务。已有同名快捷方式不会覆盖。快捷方式使用安装时的绝对路径，不要从隔离副本安装；项目移动后需先由操作员处理旧快捷方式，再从新位置安装。`node.exe` 必须通过当前用户 PATH 可用；原 host-start 门禁会继续校验 Node 版本、ABI、依赖及项目身份。Windows 的现有 PowerShell 执行策略仍然有效。

## 使用与恢复

打开快捷方式后，选择“启动后台”，等待真实启动和身份回读完成；“打开后台”只打开页面，可在启动前或后使用。“只读诊断”复用现有受信身份与入口检查，不启动服务，也不把不可达解释为已停止。关闭面板不会关闭后台或中断已派发的启动程序。启动期间不要从其他入口重复启动。

为避免启动结果不明时重复派发，面板将原启动保护记录保存在当前用户的 `LocalAppData\CompanionNext\desktop-launch\startup.pending`；原启动明确成功后才自动移除。异常、超时、退出中断或记录损坏时保留该记录，启动按钮会锁定；只读诊断和打开后台仍可使用。面板提供“核查并恢复启动”：仅在原启动意图已超过五分钟、此后系统重新启动、两次完整进程与端口观察均未发现受控启动活动及目标监听时，归档原始记录和观察证据。历史结果继续保持未知，不代表原启动成功；恢复不会自动启动，需另外点击“启动后台”。条件不满足则原记录保持。启动与恢复共用 Windows 命名互斥，进程退出由系统释放；不可删除记录强行重试。

面板不显示子进程原始输出、认证票据或配置值；此入口没有停止服务按钮。诊断分别报告后台身份与网页状态。受信后台 OPEN 但默认静态目录缺少 Next 首页时显示 UI_FILES_MISSING；首页内容不符合预期也会明确提示。当前后台要求浏览器 Cookie 才能读取该页面，桌面只读诊断不会生成一次性登录票据，因此即使本地 HTML 看起来正确，也只能报告“网页访问尚未核验”，不能声称页面已通过 HTTP 检查。登录或认证读取失败不会报成功。后台就绪不代表各模型、任务或 Creator 已就绪。

恢复所需文件必须随包交付：desktop-recovery.mjs、desktop-exclusive.ps1、desktop-verify-lock.ps1、desktop-observation.ps1。命令行等价入口为 desktop-control.mjs recover，仅供维护自动化；普通用户使用面板按钮。内部 --mutex-held 不接受直接调用，控制器核验父进程和已持有的系统互斥。观察结论仅覆盖现有受控本机启动入口，不替代工作流或 Native 维护门禁。

认证就绪后继续启动仅适用于原启动明确在认证等待阶段退出（持久诊断 ACCOUNT_PROVIDER_UNCONFIRMED、退出码1）。两次核对认证身份、健康及无原启动工作进程，保存一次性续接意图，仅通过官方启动链启动缺失后台，不重复启动认证。未知不再次派发，正式readiness确认后归档原pending，历史结果仍为未知。须同时安装desktop-continue.mjs和desktop-account-observation.ps1。

核查上次续接结果（inspect-continuation）不会发出启动：后台受信身份已就绪则保存查询收束回执并归档原pending；若HTTP明确拒绝连接、两次完整OS观察均无后台/原启动工作进程与端口、认证身份和健康不变，才追加恢复审计，允许同原ID下一次明确continue。原intent/result字节不改，第二次有独立文件；未知状态不自动重发。原请求未保存CLI PID，所以审计仅声明当前受控本机工作活动已不在，不补造历史EOF或退出回执。新增desktop-continuation-observation.ps1必须随包安装。
