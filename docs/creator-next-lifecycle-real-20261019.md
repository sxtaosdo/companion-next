# Next Creator启动→重启→停止实机验收（2026-10-19）

结果：三次真实Next UI主流程通过，但不宣称整项生命周期完成。#6保持部分：原宿主重启遗留两个子进程，需要本次明确归属后的人工清理；没有用清理结果伪装产品自动清理通过。没有修改Next功能源码、共享生命周期或安装包。

## 执行与身份

检查点a1db44c/1.3.173.143。开始仅主执行者，无其他代理；只读CIM确认无Creator/Dashboard，fixture端口7458空闲。只用原自有3.8.8工程a79f4915296f4091、既有Bridge和Dashboard automation profile，未新建客户端授权。原宿主4264/epochb4ad0920-0c1a-4add-889e-cde005e96e6f，OPEN/当前计数0，保留UNKNOWN2。

Microsoft Edge自有headless页面经原正式会话进入已部署Next，搜索并核对fixture ID/完整路径。只准许该fixture的三个空JSON POST，各恰好一次；其余写路由本地拒绝，blocked/pageErrors最终均空。启动直接点击；重启、停止均在原对话框核对目标后点击原确认按钮，有实际截图和回执。不以直接API调用替代UI。没有重放。

| Next动作 | 实际回执 | 独立核对 |
| --- | --- | --- |
| 启动 | 200/ready，PID14128/session d480dc31-3e7e-4369-bd22-0eb1860a0227 | CIM工程参数精确匹配fixture，父Dashboard3924，创建时间与命令行SHA记录；Next显示打开Creator/ready |
| 重启 | 200/ready，PID15124/session262ed76a-8db5-4a8e-930a-06c140a9bcf6 | PID/session均变化，旧主14128确实退出，新主CIM路径匹配；实际原确认/回执/卡片截图 |
| 停止 | 200/stopped | 新主15124确实退出，实际原确认与回执截图；不把stopped回执本身当OS证明 |

最终手动真实刷新后API/UI均观察为error（Bridge不可达），如实保存，没有把它改写为stopped。原宿主resolvedStatus在Bridge断开后保守markDisconnected；当前主进程已独立确认退出。Next忠实映射该值，本批未发现需修复的前端响应/操作差异。全局status仍是已核过的只读身份观察，不是对P1060执行生命周期或文件修改。

## 原宿主子进程限制与清理

原creator-lifecycle.stop仅在dirty检查后对主PID发SIGTERM，并立即返回stopped；restart以Dashboard是否运行作等待。本轮首次14128重启后，留下17876/22228两个CocosCreator子进程，即使最终15124停止后仍存在。最初验收脚本在全部三次200和最终截图之后因额外全树退出断言FIXTURE_CHILDREN_REMAIN失败；该失败保留在journal，未重复三次操作或改写为完整通过。

独立检查确认两者父PID均14128，创建时间均在首次主进程创建至本次重启发出之间，名称/完整可执行路径/精确OS创建时间及句柄再次绑定，未包含P1060或其他project参数。仅按本任务授权清理这两个确定自有进程，精确句柄已确认退出；最终Creator进程0。清理脚本首次在日期检查时拒绝、未发终止；原因是PowerShell自动解析JSON日期后又按本地时间重解析，改为DateTimeOffset UTC后才执行。该测试工具问题与产品残留限制分开记录。

这不是新后台漏发按钮或新增权限问题。共享旧生命周期受既定保护，本批未扩大到进程树管理/新维护接口；原宿主全树停止限制尚未修复，故#6不升级整项通过。没有用模拟测试代替该缺口，也没有把人工清理计为产品能力。

## 保持与当前状态

共享22修改、21受保护源码、全部310安装文件保持；projects/bridge-installs/tool-presets字节保持，fixture HEADc80b890、原跟踪文件/原settings/原server profile均一致，Git状态前后仍仅?? settings/。没有改场景/资源或迁移历史数据。

当前Companion仍PID4264、原9b8f979/0.3.147、OPEN，所有当前计数0，Native历史UNKNOWN2保持。Creator0；本次由原Dashboard路径正常启动的Dashboard主3924仍运行（原启动流程如此），没有已有用户Creator会话被关闭或重启。自有Edge在finally关闭，用户浏览器未接管。Next仍ecabe7e/内部1.3.173.131、页面1.3.173，未部署新UI或VSCode候选。没有模型/P1060生命周期动作、客户端配置写入或KB重测。

证据：[真实UI回执、OS身份、截图、保护与SHA清单](evidence/creator-next-lifecycle-real-20261019/)。完整自有脚本和原保护基线仅保留在Temp/companion-next-creator-lifecycle-20261019，未复制原工程内容。
