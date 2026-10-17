# 开机恢复与接入完成使用示例（2026-10-17接续）

状态：Accepted。用户明确批准核无实例后通过已有CLI恢复32180 loopback服务，再继续旧功能恢复；无模型/Creator/安装/真实客户端持久配置/推送。

恢复只读结果：HEAD837b43f/.40，Next干净；六已部署文件与其deployment-result.json逐项SHA相同，共享22dirty保持路径，32180无监听、无node进程。原本PID4092因关机已不存在，不声称维持旧启动epoch。使用现有Node25.2.1与原creator-ai daemon start --json，不加restart/kill-port，不改旧源码或生命周期；沿用已记录offline_import_only资源配置，清掉本进程继承的generation lease/endpoint，不启动模型。

下一缺口：旧app.ts:2562–2571使用buildAgentPrompt，完成向导显示“使用 ${mcpName} MCP 检查连接，确认工程身份后等待我的修改要求。禁止操作其他 Creator 工程。”，无返回名称时用“当前工程的 Cocos Creator MCP”。Next完整setup回执已在，但缺该原使用示例和复制/换行。只恢复完成回执中的纯文本能力，不把CLI两段其它提示词冒充此原示例，不执行MCP/安装/Agent。

范围：Next setup store保存完成回执的来源/工程绑定；原向导完成区使用示例小组件和可复制文本；对应定向测试及product-information更新。仅same source/同工程且任务complete可用，失败/UNKNOWN/换来源/变工程不借旧成功生成当前示例。复制仅本机剪贴板，不执行命令。完整五步其它差异仍缺，不假称配置已完成。

验证：轻量串行定向Vitest/strict类型和一次必要构建；独立认证Edge拦截setup/状态以隔离任务验证成功/失败和复制，所有真实安装/配置请求禁止到达宿主。完成后仅六静态备份、保留hash并原子入口部署，真实SHA与受控分支分级记录；不重启已恢复共享服务。
