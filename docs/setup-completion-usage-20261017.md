# 开机恢复与接入完成使用示例（2026-10-17接续）

状态：Accepted。用户明确批准核无实例后通过已有CLI恢复32180 loopback服务，再继续旧功能恢复；无模型/Creator/安装/真实客户端持久配置/推送。

恢复只读结果：HEAD837b43f/.40，Next干净；六已部署文件与其deployment-result.json逐项SHA相同，共享22dirty保持路径，32180无监听、无node进程。原本PID4092因关机已不存在，不声称维持旧启动epoch。使用现有Node25.2.1与原creator-ai daemon start --json，不加restart/kill-port，不改旧源码或生命周期；沿用已记录offline_import_only资源配置，清掉本进程继承的generation lease/endpoint，不启动模型。

下一缺口：旧app.ts:2562–2571使用buildAgentPrompt，完成向导显示“使用 ${mcpName} MCP 检查连接，确认工程身份后等待我的修改要求。禁止操作其他 Creator 工程。”，无返回名称时用“当前工程的 Cocos Creator MCP”。Next完整setup回执已在，但缺该原使用示例和复制/换行。只恢复完成回执中的纯文本能力，不把CLI两段其它提示词冒充此原示例，不执行MCP/安装/Agent。

范围：Next setup store保存完成回执的来源/工程绑定；原向导完成区使用示例小组件和可复制文本；对应定向测试及product-information更新。仅same source/同工程且任务complete可用，失败/UNKNOWN/换来源/变工程不借旧成功生成当前示例。复制仅本机剪贴板，不执行命令。完整五步其它差异仍缺，不假称配置已完成。

验证：轻量串行定向Vitest/strict类型和一次必要构建；独立认证Edge拦截setup/状态以隔离任务验证成功/失败和复制，所有真实安装/配置请求禁止到达宿主。完成后仅六静态备份、保留hash并原子入口部署，真实SHA与受控分支分级记录；不重启已恢复共享服务。


## 恢复与源码验证

原CLI单次daemon start成功，新PID2100/Node25.2.1，唯一127.0.0.1:32180监听，OPEN；独立正式认证Edge帮助页可达，原837b43f/.40六HTTP SHA一致，无重复部署或模型/Creator启动。早期files-applied候选清单已过时，第一次在派发前停止；改核最后.40运行回执的f3323c72…daemon SHA与现存原CLI6085072c…后才启动，没有覆盖旧文件。新epoch不冒充原PID4092。恢复回执位于C:/Users/33272/AppData/Local/Temp/companion-next-resume-usage/service-restored.json。

恢复完成示例原文（包括旧缺省文本MCP MCP），仅来源/完整工程身份匹配的complete回执可用；失败、UNKNOWN、明确failureReported或非法MCP名不生成，换来源/身份后不复活旧示例；向导选择其它工程不显示旧示例。复制和换行不调用接口。

3文件126项单worker串行测试通过，strict类型和一次必要workspace构建通过，保留原大chunk提示。首轮125项断言通过但Navigator替身引发未处理错误，不算成功；已改为保留真实Navigator仅注入clipboard并复跑通过，追加迟到复制不串来源。独立只读reviewer未发现具体缺陷，未运行额外高负载测试。

本轮ocr delegate被自动审批拒绝：外部审查程序可能更新检查或传输私有源码，未获授权且不必要。未执行该命令、不重试、不绕过，改用本地类型/测试和独立源码审查；不宣称OCR完成或managed PASS。后续静态备份/部署/Edge隔离回执另记，不以源码完成代替已部署。


## 已部署验收

源 d982a34 / 1.3.173.42 已通过原静态发布流程部署到现有32180，六文件HTTP SHA一致，保留旧静态文件和共享22项修改。Edge顺序验证有名称、缺省、失败三分支；复制/换行有效，断开重连不复活旧完成示例。三个setup均为拦截fixture，生产setup/安装/客户端配置写入/用户剪贴板写入均0。PID2100和startupEpoch保持，独立浏览器已关闭。证据：C:/Users/33272/AppData/Local/Temp/companion-next-resume-usage/delivery/browser-proof.json；截图completion-usage.png已查看。
