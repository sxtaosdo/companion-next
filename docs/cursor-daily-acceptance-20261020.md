2026-10-20 06:34续核最新结论：两条自然失败的API及实际部署UI详情已通过，19→19、错误摘要匹配、页面错误0；正式50条第二页仍缺自然数据。Cursor本轮无现有进程/窗口，依用户一次尝试上限跳过，发送0；旧额度拦截请求1次不重放。正式登记写入器Windows回退/冲突缺陷已有离线候选，新后台回执兼容源码48项测试/类型/构建通过，但均未部署，生产登记/01仍未执行。当前仍13通过/6部分/2暂停。完整分类、建议和所需条件见[跳过项与待解决问题](skipped-and-open-issues-20261020.md)。以下较早记录按其历史时点阅读。

2026-10-20 Cursor actual-call update: one authorized project_get_status-only Agent request was sent once. Cursor returned Weekly usage limit reached / Buy credits or Upgrade Plan before any tool receipt. STOPPED, no retry or paid action; actual Cursor business invocation remains unverified. Matrix remains 13/6/2. [Evidence and remaining blocker](cursor-agent-status-20261020.md).

# 日常 Cursor 两条既有连接验收（2026-10-20）

本轮使用用户日常Cursor原配置和可见窗口，**cocos、cook各一次单独Reload后均Connected，117项工具，project_get_status可见。** 不再把隔离实例未创建client当作日常连接失败；先前隔离失败证据仍原样保留。本轮没有打开新隔离实例。

## 实际界面操作与回执

开始时日常Cursor未运行，用正常配置打开了一个未指定工程路径的窗口，PID23912，标题Cursor Agents。没有登录、安装扩展、改安全权限或关闭用户应用；未向聊天输入任何消息。该版本设置页面明确提示MCP位于Customize，正常界面路径为：Settings → Open Customize → MCPs → Configure目标条目。

两条只选了已有的cocos-creator-cocos-214a2184与cocos-creator-cook-cdc0709d，均显示原~/.cursor/mcp.json来源且已启用。未改变source启用、任何工具开关或Writes权限下拉框。先记录目标标题和来源，再写reload-issued回执并调用目标面板Reload；每条只发出一次，重连后再次核对Connected/117工具。最后Done仅关闭目标设置弹窗，日常Cursor窗口保持打开。

| 目标 | 真实日常界面结果 | 动作次数 |
| --- | --- | --- |
| cocos-creator-cocos-214a2184 | Connected；117工具；project_get_status可见；原用户来源 | 单条Reload1次 |
| cocos-creator-cook-cdc0709d | Connected；117工具；project_get_status可见；原用户来源 | 单条Reload1次 |

界面中曾出现导航切换及窗口最小化。过期/缺失目标面板的检查均拒绝输入，未发出Reload；随后使用当前命名控件重新定位，恢复同一日常窗口，最终一进程内验证标题/来源并发出单次动作，避免不确定结果重发。首个取证辅助脚本曾在动作前遇到语法/时序问题，未写任何reload-issued；最终有效动作仅上述两次。

## 精确未覆盖：Cursor业务工具调用

本版本目标Configure面板可见动作只有Reload和Done，另有工具/权限开关；没有Run、Test、Invoke或Call Tool执行按钮。没有把开关当成执行，也没有使用开发者控制台、私有存储、令牌、内部注入或独立Node SDK替代日常客户端。本轮Cursor业务工具调用为0，不能将Connected/工具列表宣布为实际业务调用成功。

用户不需要再改这3条配置、再启用这两条连接、登录、安装扩展或关闭应用。**如果后续要补Cursor工具调用回执，最小动作是明确允许一次Cursor Agent只读回合，然后只针对这两条现有服务器分别调用project_get_status（空参数），核对实际工具名/服务器名和PASSED；不调用Creator/模型管理/写工具。** 这会新发Agent/推理回合，与当前模型/Agent暂停边界不同，故本轮未发送。若维持不发推理回合，则本轮“日常连接+工具发现”已经完成，业务调用保留未验证。

现有Codex实际程序的117工具与只读调用PASSED保持有效：[三条修复及Codex回执](three-client-repair-20261020.md)。本轮补足日常Cursor两条连接，仍不能据此关闭01/11安装向导、正式50条调用第二页/自然失败详情、真实日志清空及暂停模型链路；整体仍13/6/2，#13/#14的剩余应缩小到Cursor业务工具回执与正式登记流程尚未覆盖的部分。

## 保护

两份客户端配置SHA仍等于已批准3条修复后的值，本轮配置写入0；8条Mac和其他条目没有UI操作。后台6564/32180/OPEN、知识库600/8081、312运行文件、共享工作区未写、HEAD及22项状态吻合，9业务表、canonical锁和UNKNOWN2保持。外部Creator未启动、停止或操作。只读目标日志查找未找到按目标名称命名的文件，故不编造成功日志；验收依据是带时间的真实日常UI标题、来源、Connected及工具目录回执。[实际结果](evidence/cursor-daily-acceptance-20261020/result.json)。

保护证据限制：此前用于共享21文件逐字节复核的Temp/native-epoch-recovery-evidence-20261019/baseline.json在本轮收尾时已不存在，来源未知。没有重建或冒充该基线；仅记录当前6ff44f5/22项状态及diff指纹。上一轮精确保护回执仍在Git归档，但不能替代本轮新的逐文件比对。312运行文件、9业务表和Companion非canonical历史配置仍按现存本轮检查点逐项核对通过。
