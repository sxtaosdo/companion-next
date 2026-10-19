# 正常停止展示修复与旧宿主边界（2026-10-19）

Next最小展示修复已部署并单次实机通过；原宿主子进程问题已精准归因，但未越过此前禁止修改旧宿主生命周期的边界。不是两项全部修复。

## 旧行为与真实缺陷

两个现有独立代理实际并行只读核对：stop_display_review、creator_child_review。旧UI web/src/app.ts:696–735在非ready/starting/stopped时也提示Bridge异常，故error并非Next独有回归。实际.147的creator-lifecycle.ts:193–208停止时只SIGTERM主PID并立即置stopped/丢弃PID；下一次companion-daemon.ts:681–711刷新Bridge失败，经markDisconnected改成error，停止因果丢失。重启仅等Dashboard running=false，不处理原实例后代；之前残留17876/22228正由此产生。

## Next最小修复

检查点c2ebf71/1.3.173.145后，仅改src/stores/creator-operations.ts、src/components/ProjectStatusTag.vue、src/views/CompanionBrowserView.vue。保持原tag和页面布局，无新按钮或交互。

必须是当前同来源、同daemon会话、同工程identity、最新成功stop回执、结果之后才开始的新读取，以及精确的通用Bridge不可达且无PID/session/version，才显示中性“已请求停止”。保留原始error、lastError、筛选、操作资格与停止回执“不证明退出”的原合同；不把它改成已停止。未知/失败回执、busy/冲突、其他错误、新身份、后继动作、来源或会话改变均不匹配，正向运行观察或工程身份变化后永久撤销旧提示，不能A→B→A复活。未盖过真正异常。

独立复审发现两个撤销边界，已修正并补测试，复审未见剩余P1/P2。最终三个受影响测试文件334/334通过，vue-tsc无错误，正常workspace生产构建成功；没有重复KB或全套测试。首次测试命令用了已弃用cache.dir参数，在任何测试执行前拒绝，改成Temp配置；静态预检首次因未计入既有favicon而拒绝，尚未写入任何安装文件，核实六文件后继续。真实写入只一次。

## 串行部署与单次实机

已部署源码a8e88ac75fc1701169835c055299169410bfce96/内部1.3.173.146，产品页仍1.3.173。仅追加CSS/JS哈希文件并原子切换index，旧哈希资源保留；正常静态回执与本次浏览器实际HTTP SHA匹配。没有重启Companion、装载VSCode或改宿主bundle/旧UI；旧310个安装文件仅Next index按批准切换，其余保持，新增2哈希文件后当前312文件在实机前后保持。

正式会话Microsoft Edge仅对原自有fixture a79f4915296f4091执行启动→停止一次：启动200/ready，Creator PID452/session b7491890-8b2a-496d-a0fa-81f39f7a28a2；原停止确认按钮200/stopped，独立OS确认452退出。刷新后实际raw state仍error，状态标签为“已请求停止”，原Bridge不可达说明及退出待核实说明同时可见，见final.png。当前Creator残留0，本轮无需人工子进程清理；不由此声称未重测的restart子进程缺陷已修复。只有两个真实UI POST，各一次，restart0，KB重测0，blocked/pageErrors为空，自有Edge关闭。

## 子进程修复：精确受限范围

产品修复需要修改此前明确禁止的旧宿主：

1. cocos-mcp/mcp/src/companion/creator-lifecycle.ts：stop经可测试适配器处理该实例，并确认退出后再发布stopped；restart复用该保证。
2. cocos-mcp/mcp/src/companion/local-process.ts或一份窄用途creator-process-stop.ts：停前核根PID、工程参数、OS创建时间，冻结后代身份，再按精确句柄复核并只处理该实例，等退出；未知/变化的身份拒绝，不按进程名杀全局。
3. 对应生命周期及Windows身份/子树边界测试。

现有terminated-session-observation.ts仅全局只读观察，不是安全终止器；local-process.killPid也只单PID，没有可直接调用的精确树终止实现。无需改Native UNKNOWN、锁、Dashboard或旧WindowsCompanionUI。按照最新“必须改此前禁止的旧宿主时先报告范围”要求，本轮已报告且未修改上述文件，不引入维护框架或新权限。

## 当前服务与保护

Companion仍PID4264/epochb4ad0920-0c1a-4add-889e-cde005e96e6f、原9b8f979/0.3.147、OPEN，所有当前计数0，历史UNKNOWN2保持。Creator0；原Dashboard3924继续运行。共享22修改与21受保护源码保持，登记/Bridge安装/预设原字节保持，fixture HEAD/原跟踪文件/settings/server profile保持。无P1060生命周期、模型、客户端权限或历史迁移操作。矩阵#6保留部分，当前11/8/2不变。

证据：[停止展示截图、实际HTTP/进程回执、定向测试与SHA](evidence/creator-stop-display-fix-20261019/)。
