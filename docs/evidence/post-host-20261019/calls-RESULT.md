# 调用记录页真实只读验收（2026-10-19）

已完成限定验收。源码及仓库docs未改；自有无GPUheadless Edge通过pipe启动，没有新服务或监听，最终正常关闭，用户窗口未触碰。host证据绑定PID10820、epoch7601ac9d-a500-46d8-8db0-9a0f28e7569c、入口SHA aa703700e04116f3a03352ed63fc59e39e46cf82c0645202a408810086becc6f（0.3.147由root已核）。本模块未调用管理/Native/Creator/模型接口或重放记录。

只读先核实登记响应，选择已有任务隔离工程a79f4915296f4091；确认不是P1060，只保存路径SHA，不读工程内容。真实counts该工程键缺失、latest缺失：其语义是未记录，不把该缺失键改写为0。真实history分别全部/仅失败均明确total0、retained0、records[]、nextBefore缺失，同一sessionSHA与counts对应。

通过真实可见选择器的键盘ArrowDown+option点击选择工程和全部/仅失败，实际GET分别limit=50与limit=50&status=failed。UI累计/保留数字及空态与响应一致，手动刷新仍空。错误分支只中止自有Context的一次GET history，不伪造服务器响应；UI显示读取连接失败、累计未读取及无旧行，随后真实GET刷新恢复total0空态，最后返回全部。前后真实counts内容完全相同。

成功运行18条页面GET（含一次本地中止的history GET），详细path/query见calls-ui-proof.json。blocked=[]、pageErrors=[]，业务POST/DELETE=0，Creator/模型动作=0，实时流未启用。认证前的sessionPOST仅用于原登录。脚本早期5次只读运行因Element Plus重复aria-label/输入框点击拦截和外壳定位不匹配中止；均在选择阶段前后仅登录+元数据GET，自建浏览器在finally关闭，未改产品。最终改用原键盘交互通过。总登录sessionPOST6次，成功运行1次；不存在业务重试。

截图calls-all-masked.png已查看：原调用页空态可见，工程字段遮罩，部分选择框过渡区域连同统计被遮罩；统计精确比对由JSON与脚本断言提供，不冒充截图中的可见数值。

仍未验证：非空调用摘要/详情、真实失败记录过滤排除成功记录、50条以上分页及更多游标、长时并发调用UI。没有制造50条记录，没有把空态通过说成这些分支已验。读取失败是自有浏览器传输中止，不是生产服务真实500验收。最终OPEN/UNKNOWN状态由root接续只读核验，本模块不作已核声明。
