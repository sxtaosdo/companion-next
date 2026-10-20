2026-10-20 Cursor actual-call update: one authorized project_get_status-only Agent request was sent once. Cursor returned Weekly usage limit reached / Buy credits or Upgrade Plan before any tool receipt. STOPPED, no retry or paid action; actual Cursor business invocation remains unverified. Matrix remains 13/6/2. [Evidence and remaining blocker](cursor-agent-status-20261020.md).

2026-10-20日常Cursor后续：已在原用户窗口分别单条Reload cocos/cook，各1次，均Connected/117工具，原来源及配置SHA保持。Cursor业务工具调用0：正常MCP面板仅Reload/Done及开关，没有无推理Run/Test入口，未新发Agent回合。详见[日常连接与剩余一步](cursor-daily-acceptance-20261020.md)。

2026-10-20三条配置修复：用户批准的Codex ant-cook及Cursor cocos/cook已备份并修为Node+原JS，其他条目/权限保持。实际codex.exe发现117工具并只读调用PASSED；Cursor隔离实际客户端目标未创建，日常Cursor定向重载/回执仍未验证，不能报全通过。详见[修复与精确剩余](three-client-repair-20261020.md)。

# 六项部分完成的精确剩余条件（2026-10-20）

总体仍为13项限定主流程通过、6项部分完成、2项暂停。本轮只读核实用户实际使用的Codex CLI和Cursor；VS Code退出范围。没有修改客户端配置或创建凭据，没有启动Creator、模型、P1060，没有清空日志，没有重跑既有通过回归。

## 当前接入事实

Codex `C:/Users/33272/.codex/config.toml` 有ant-cook登记，项目ID04c4cde24ee76d83正确，但command直接指向creator-ai.js。Cursor `C:/Users/33272/.cursor/mcp.json` 的cocos/cook两个Windows条目同样直接指向JS；另外8个非暂停条目仍为旧Mac的/Users/sxt路径，本机不存在。常规工程级.cursor/mcp.json和.codex/config.toml在6个非暂停已登记工程均不存在。Cursor当前未运行，最近专用日志是20261019，包含失败/closed，未找到成功连接标记。配置存在和Codex进程存在均不作为已连通证明。

Windows无shell直接启动该JS文件被OS拒绝：Win32错误193、子进程未创建、工具请求0。这不是危险业务失败记录。用已安装Node显式运行同一JS后，独立MCP SDK握手成功，实际server0.3.142，列出117工具；对ant-cook执行project_get_status及source=launcher/limit3的debug_get_logs，两次均PASSED，stderr0。测试只证明底层协议/只读工具可用，**不等同于实际Codex CLI或Cursor已按其配置成功连接**。没有通过客户端发聊天消息、模型请求或外部投递。

## 六项分别如何继续

| 项目 | 已有真实证据 | 真实剩余条件 | 分类与下一步 |
| --- | --- | --- | --- |
| #5 五步安装/可选配置 | 00/10真实通过，安装恢复合同已验证 | 01/11包含真实Codex配置写入、完成回读及客户端重载连接；不能以底层stdio替代向导执行 | 需真实配置批准。先修正已存在的Windows启动条目并确定同一ant-cook目标；任何01/11向导写入仍按精确文件/安装范围执行，不启动Creator或模型 |
| #10 清空/导出/诊断 | 导出和诊断已有真实证据；清空交互/合同已隔离验证 | 真实清空会删除用户日志，已被明确禁止 | 禁止项，不是普通等待验收。保留禁止；若另有独立可丢弃日志域再单独提出，不删除当前真实日志，也不重做已通过导出/诊断 |
| #11 调用分页/失败详情 | 本轮2次真实只读MCP调用均成功，limit1游标两页与limit50顺序一致、输入/结果摘要存在 | 正式UI每页50，当前总数2、无nextBefore；真实失败数0。仍缺同一工程至少51条自然记录和自然失败记录，及对应UI页面验收 | 小页真实API游标本轮已补足。生产UI50条第二页/真实失败详情缺自然数据；不为凑数刷51次、不注入假记录、不制造失败。既有隔离分页/失败验证不重跑 |
| #13 CLI/IDE使用 | CLI冷启动与幂等复用已通过；本轮独立stdio握手及2个只读工具通过 | 实际Codex CLI与Cursor使用现有配置完成连接、取得工具并各执行一项只读操作的客户端回执 | 需配置批准，然后可继续。实际客户端重载可能需要用户操作；不伪称SDK是Codex/Cursor，不启模型生成对话 |
| #14 多客户端MCP登记 | 两客户端已有登记；项目ID和路径逐条核实 | 现有3个Windows登记command需加Node解释器；8旧Mac条目为另外的历史清理范围。真实登记完成/客户端连接回读未通过 | 需两文件三条目的合并批准。只修已有Windows条目；不新加服务器、扩大工具权限、写凭据或动VS Code/P1060。旧Mac清理不自动实施 |
| #16 AI资源链 | 96变体PNG/meta/UUID、保存重开、Preview/Build/Smoke已通过 | 真实模型生成/后续模型相关链路仍按用户暂停 | 明确暂停。可核复用历史证据，本轮不重做96项，不启动模型/Creator/P1060 |

#20 Agent/会话/问答/同步和#21模型启停/切换/GPU继续明确暂停；它们不是本轮配置修复的附带验收范围。

## 本轮补足的调用证据

初始当前session counts为空。两条记录均由真实MCP只读工具通过正常start/finish审计路径产生，没有直接写CallHistoryStore或SQLite。ant-cook现为total2/retained2、source=mcp、success。limit1第一项sequence2，nextBefore2；第二项sequence1且无后续游标，和limit50的真实顺序相同。失败过滤HTTP200且0条。只归档ID/状态/摘要哈希，未归档日志或业务摘要正文。

安装组合的附加边界：00/10/01/11的两位分别为startCreator/configureCodex。01是不启动Creator、配置Codex；仍需先批准其真实配置写入与目标范围。11同时包含启动Creator，当前“不启动Creator”的限制下不能执行；即使批准本文两个文件的三条启动命令修复，也不构成11向导或Creator启动授权，不能据此关闭#5。此条件应留到明确允许Creator的验收窗口，不与本轮最小配置修复捆绑。

## 一次性最小配置确认建议（尚未写入）

只替换下列3条现有登记的command和args，其他字段、服务器、工程绑定和工具预设保持：

| 文件 | 服务器条目 | 目标 |
| --- | --- | --- |
| C:/Users/33272/.codex/config.toml | cocos-creator-ant-cook-04c4cde2 | ant-cook / 04c4cde24ee76d83 |
| C:/Users/33272/.cursor/mcp.json | cocos-creator-cocos-214a2184 | cocos / 214a2184be887306 |
| C:/Users/33272/.cursor/mcp.json | cocos-creator-cook-cdc0709d | cook / cdc0709d4eaaa8a2 |

command统一为`C:/Program Files/nodejs/node.exe`；args为`[原creator-ai.js绝对路径, "mcp", "--project", 原项目ID]`。保留全部其他字段；写前校验最新文件哈希，原子备份/写入，随后核对回读。影响仅为让Windows实际运行现有JS入口：不增服务器、账号、凭据、权限或监听地址，现有工具目录/预设不变。具体可审查数据见[三条配置提案](evidence/client-calls-closeout-20261020/configuration-proposal.json)。只读核实不授权这次写入，需用户合并确认；如需Cursor另外接ant-cook，则属于新登记，应另明确目标，不混入本提案。

本轮最终Companion6564/32180/OPEN，Node25.2.1，原CLI8ba06c76/worker9a02abcd/daemon70df42a8保持；WeKnora600/8081健康。312运行文件、共享22修改/21保护源、9业务表、Companion配置、canonical锁与UNKNOWN2保持。客户端两文件SHA与本轮初始一致。只新增上述2条正常只读工具审计记录。[保护证据](evidence/client-calls-closeout-20261020/protection.json)。
