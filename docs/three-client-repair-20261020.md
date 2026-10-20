2026-10-20日常Cursor后续：已在原用户窗口分别单条Reload cocos/cook，各1次，均Connected/117工具，原来源及配置SHA保持。Cursor业务工具调用0：正常MCP面板仅Reload/Done及开关，没有无推理Run/Test入口，未新发Agent回合。详见[日常连接与剩余一步](cursor-daily-acceptance-20261020.md)。

# 三条既有客户端配置修复与实际连接验证（2026-10-20）

用户03:48:08“好”已批准仅修复Codex ant-cook、Cursor cocos/cook并验证连接。修复已完成，**Codex实际程序验证通过，Cursor实际连接仍未通过；不报全部完成。**

## 已完成写入与恢复副本

写前两文件哈希与上轮提案一致，Temp Git检查点a03b618。只改3个现有条目的command和args：command为现有C:/Program Files/nodejs/node.exe，args最前增加原JS绝对路径，原mcp/--project/项目ID保持。使用同一原文件的写入句柄，未更改安全权限；校验完整解析结果仅这6个字段变化。未改其他并行内容、未增加服务器、凭据、环境变量或工具权限。Cursor其余8个旧Mac条目及P1060条目完整保持。

原件备份留在原配置目录：

- `C:/Users/33272/.codex/config.toml.companion-three-20261020-3dea588400f4.bak`
- `C:/Users/33272/.cursor/mcp.json.companion-three-20261020-904a8a96c98e.bak`

副本SHA与写前原件一致。副本可能含用户其他配置，未显示内容、未复制进Git证据。恢复时应先确认目标文件仍是本轮写后哈希，不能覆盖之后用户修改。精确前后哈希及变更见[plan](evidence/three-client-repair-20261020/plan.json)、[写入回执](evidence/three-client-repair-20261020/write-result.json)。两份正式配置各仅写一次。

## Codex实际客户端：通过

用安装的`codex.exe app-server --stdio`读取用户修复后的ant-cook配置，而非独立Node MCP SDK。为本验证进程临时禁用非目标MCP条目，未持久化这些开关。官方App Server的mcpServerStatus/list发现117工具；在ephemeral线程上下文通过mcpServer/tool/call执行project_get_status，返回PASSED；验证app-server exit0。没有调用turn/start、模型生成或向用户已有会话投递消息。stdio不使用OAuth，authStatus=unsupported不是拒绝。依据[官方App Server文档](https://developers.openai.com/codex/app-server)和本机生成协议schema；[实际Codex回执](evidence/three-client-repair-20261020/codex-actual-result.json)。这是实际Codex可执行程序的连接验证，不声称用户已有交互会话已热重载。

## Cursor：配置已修复，实际回执未通过

日常Cursor原先未运行。为避免启动全部历史/暂停条目，用安装的Cursor创建临时隔离实例，只载入两条批准定义，定义值与正式配置完全一致；临时开发测试驱动未安装到用户扩展目录、未登录账号、未改变日常profile、未关闭用户应用。实际Cursor extension host和内置anysphere.cursor-mcp已加载。

第一轮：实际命令列表仅暴露mcp.reloadClient，未暴露mcp.createClient，测试以TARGET_MCP_COMMAND_NOT_EXPOSED退出1，没有工具调用。第二轮据此改用真实暴露的目标reload及内置getMcpLease；目标client仍未创建，CURSOR_TARGET_CLIENT_UNAVAILABLE，退出1，没有业务调用。两次原回执均保存，测试实例和子进程已全部退出；无悬挂、无未知写入。没有再用独立SDK“证明Cursor成功”，也没有私有注入、全量启用或放宽权限。

**当前剩余：在用户日常Cursor的MCP页面，单独启用/重载cocos与cook两条已修复连接，取得其成功连接/工具列表及各1次无副作用读取回执。当前可用接口不能从无现存目标client的隔离实例完成这一步。** 不需要关闭整个应用或创建凭据；本轮没有通过启动全量旧条目来绕过暂停边界。日常profile实际重载及Cursor两次业务调用未验收。

## 矩阵如何更新

总体仍13通过/6部分/2暂停，不因3条配置写入或Codex单客户端通过就关闭整个模块。

| 项目 | 当前具体剩余 |
| --- | --- |
| #5 | 既有3条修复已获批准并执行；这不等于01/11向导本身验收。01需其精确安装/配置写入范围；11还含Creator启动，当前禁启不执行 |
| #10 | 导出/诊断保持已通过；真实日志清空仍明确禁止 |
| #11 | 上轮真实limit1游标已通过；当前仅增加Codex一次真实成功状态读取，未刷满51条；正式50条UI第二页和自然失败详情仍缺自然数据 |
| #13 | Codex实际程序发现117工具/只读调用通过；Cursor实际用户profile连接和工具回执仍未通过 |
| #14 | 两文件3条既有Windows配置已修且回读；Cursor实际连接回执待补。8旧Mac清理与P1060/VS Code均不纳入 |
| #16 | 96变体旧验收保持；模型部分继续暂停，不重做 |

后台6564/32180/OPEN、WeKnora600/8081保持；312运行文件、共享22修改/21保护源、9业务表、canonical锁和UNKNOWN2保持。没有清日志、启动Creator/模型/P1060或其他项目。[保护回执](evidence/three-client-repair-20261020/final-protection.json)。

并行环境说明：收尾观察到外部Creator主进程21060，父进程14212，创建于03:50:06，早于本轮实际Codex连接验证和Cursor测试。本线程没有启动、停止或操作该Creator，也没有查询其业务内容；不能把当前环境写成Creator0。取证脚本据此仅要求本线程隔离Cursor进程全部退出，原后台/业务保护仍通过。
