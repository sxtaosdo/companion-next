# Windows 聚焦修复候选（2026-10-18）

状态：Accepted（候选准备与验证完成，**未装载到共享32180**）。基线1256a93；无新增UI/协议/安全设置，无旧cocos-mcp工作树修改。

## 缺陷与修复

原platform.ts忽略SetForegroundWindow返回值，宿主即使没有把Creator置前也返回200。新代码在host/windows-focus.ts；离线overlay只替换原platform的Windows分支并引入该模块。

- 核对PID、可见主窗口和同PID可见活动弹窗；仅最小化时执行restore。
- 优先正常SetForegroundWindow。只有首次没有成功、前台仍是请求开始时的窗口、没有检测到按键/鼠标保持按下时，才短暂连接当前/前台/目标线程输入队列再试一次。
- 在restore前捕获原前台，首次成功后如果用户切走不重夺；attach前及激活前再次核对前台，try/finally逆序解除所有已成功连接。
- 只有最终前台PID等于目标且连接清理成功才返回；拒绝、超时、无窗口、陈旧PID或无效回执不返回成功。
- 无SPI/注册表修改、无ASFW_ANY/长期授权、无Alt或键盘注入、无提权。GetAsyncKeyState仅作“仍有键按下则不连接”判断，不记录键值/内容。前台状态瞬息可变，结果只证明核验时点，不承诺窗口永远保持前台。

微软说明：[SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow)确有调用方限制；[AttachThreadInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-attachthreadinput)共享临时输入状态且会重置键状态，因此需要上述限次、检测和解除，而不是修改系统策略。

## 验证与修复复核

8项TS测试通过；host模块严格tsc及整个workspace vue-tsc通过。首次直接Node导入造成前端检查缺少node类型，最终改为宿主执行时惰性加载内置模块，未安装依赖或变更项目类型配置。实际跟踪模块成功把Creator18252/窗口459944置前，拒绝无窗口进程和已退出PID，并恢复原Codex19688/窗口525512。

独立review曾发现P2：原前台取得过晚，首次成功后用户切窗可能被当作新baseline而重夺。已修正并复核关闭。tests/windows-focus-native.mjs编译执行真实C#控制流，但将**全部Win32入口替换为stub**，不会操作桌面：旧候选两次调用并重夺；修复后仅一次且verified=false；restore中切窗0次激活；正常fallback两次连接两次解除；attach后切窗失败仍全部解除。该控制流回归与独立真实helper验证分开，不称Next实页回归通过。

另一次实际OS竞态注入没有证明内部切窗前置条件达成，未作为成功证据；保留原Temp记录。复核无新的P1/P2。

## 可审候选与装载边界

scripts/prepare-windows-focus-overlay.mjs只在任务Temp输出，从当前live source map重建基线。原运行JS SHA为35225eb5ddb4d415457a9cad960c8e22d14c4b4a0de321fb8b8aa51adc4af699；重建JS字节一致。最终候选SHA为148f28ad4989a038de1825beae197c4db9947f3209a8f22cf07ec330047df526；已改变源仅platform.ts、已新增源仅windows-focus.ts。不覆盖旧22项并行修改，不捆绑生命周期修改。

候选位于Temp/companion-focus-fix-20261018/runtime-build-release/candidate/。尚未替换正式文件，daemon仍原实例。因此当前32180聚焦行为未因此改变，矩阵仍保留“端到端未通过”。

装载需要的具体动作：协调一个32180共享Companion维护窗口；记录并暂时暂停仅相关后台页的轮询/SSE，观察原guarded drain全部已知计数为0且unknown为空；原CLI正常停止daemon（不强杀）；备份并仅替换daemon JS及map；原配置启动，不注入任何知识身份；恢复相关页认证和实时连接；核对原Creator PID/session及已有修改，再在Next点击聚焦，读取实际前台PID并恢复窗口。若guard拒绝或有未知动作立即停止，不绕过。会中断Companion cookie/SSE/MCP及宿主自有空闲child；不调用Creator/模型/WeKnora停止，但须回读确认。准备阶段曾沿用“不重启共享服务”边界。后续已明确该最近限制仅针对知识身份调查，并重申既有开发后台部署、服务重启授权；因此允许按上述guarded流程装载聚焦补丁。知识身份仍禁止注入。结果待真实装载及Next回归回执追加。

知识库身份方案与Codex草稿核查独立，不是装载聚焦补丁的前置条件，且该维护窗口不得夹带凭据注入。
