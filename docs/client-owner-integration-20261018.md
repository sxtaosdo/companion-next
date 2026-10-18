# 客户端注册、向导接线及隔离owner验收

状态：Accepted。检查点基线fe43869/.60，当前部署4aaeedf/.59。本批明确授权仅Next开发，五客户端全部受控测试、真实配置写入0；独立owner临时loopback服务+原缓存隔离副本+Temp导出可验，结束关闭。模型/搜索/下载/真实Creator不启动，不改旧Companion或持久权限，保护共享22项和PID2100/用户会话。

开发：原POST /api/projects/:id/mcp/register五目标；卡片原注册弹窗和向导Agent多选/全选/跳过。复用正常workspace显式provider、同Pinia操作lane、当前完整工程身份、明确确认及UNKNOWN禁止重发，串行批次首个异常停止后续。工具范围用原GET /api/tool-presets?projectId=和POST /api/projects/:id/tool-preset，带匹配complete的setupOperationId，仅显式选择确认写入。

严格部分安装仍等待后端options合同；现有完整接入已经明确包含Codex，向导Agent跳过只跳过额外注册，不声称撤销/避免既有Codex。既有完成回执才显示后续Agent和范围，不自动POST。

owner：原三SHA固定源，现有Pillow12.3/tkinter环境；原缓存只读快照复制到Temp且核对SHA，原load_last/lease仅作用于副本。生产模式独立包与原桥接，只127.0.0.1动态端口；真实thumb/full HTTP字节和解码、选择与Temp导出，断言无搜索/下载。验后关自建服务，不触及32180。

## 实现与回归

已接原五客户端POST、卡片弹窗及完成向导Agent多选/全选/跳过；scope原POST带匹配complete的setupOperationId，写后有效回执才读回。确认冻结工程和所选客户端/预设，单lane串行批次、首错停后续，UNKNOWN单项禁止重发，关闭或换源抑制迟到回执，传输真实清理后放锁。原严格部分安装边界不变，跳过明确不是撤销Codex。独立reviewer发现跳过状态跨任务串用，已绑定完成工程/路径/任务ID并补回归，复核关闭。

3文件94项必要回归、最终strict通过。原计时回归定位到Element Plus use-lockscreen卸载的200ms清理，等待第三方清理完成再断言无遗留timer；本地计时interval泄漏仍会失败。调试instrumentation已全部还原。真实客户端配置写入0。

## 实际部署与受控客户端验收

30e1739/.62已一次部署到现有32180，先备份48旧静态文件，只新增hash资源并原子替换index；产品页面仍1.3.173。独立Edge核验6原始HTTP文件SHA，5类场景通过：五客户端卡片精确目标、匹配complete任务的向导范围确认/读回、Agent半选和4项串行批次、首个UNKNOWN停止剩余及禁止重发、跳过额外注册0POST。共13个业务POST均被独立浏览器fixture拦截（含1个模拟setup），真实客户端配置写入0，真实Creator0；source/实例PID2100/epoch/OPEN不变。scopeReads=2，回读后核对按钮禁用。

必要回归94通过；脚本曾修正scope变量名/报告作用域和Element Plus半选CSS选择器，均仅重跑浏览器，不重建、不重复部署。截图client-wizard.png已查看。普通Edge2992经只读UIAutomation核对Next地址及工程控件可见、Forbidden不可见；没有导航或访问Cookie。

## 隔离owner真实验收

独立production包使用现有同源桥接、三SHA固定原app/TaskStore。原缓存41文件/10200818字节只读复制到Temp并核SHA，副本指定已有真实ready任务。第一次临时进程24020只监听127.0.0.1:10719，脚本把“连接本机审阅服务”误写为“本地”而超时，finally关闭；诊断确认路由/JS/CSP无产品故障。第二次20140只监听127.0.0.1:11494，修正脚本文案后通过，无产品代码改动或重建。

原thumb/full真实HTTP 200与缓存SHA一致、浏览器实际解码成功，截图owner-real-preview.png已目视查看猫与鱼缸。原TaskStore exporter真实导出到隔离Temp两次，每次一个图片和.source.json；两文件名不同，字节SHA及来源元数据匹配，共4文件，不覆盖。chooser仅注入固定Temp目录，原生系统目录弹窗未验。HTTP guard、原store选择/导出均真实执行；未mock后端响应，只有出口网络被测试harness禁止、chooser目标固定。CSP错误0，外部浏览器请求0，服务outboundAttempts=0，搜索/下载/模型0。

两次自建服务均已关闭、进程及监听不存在；原缓存41文件SHA全部保持，旧owner源码未改。此验收完成独立owner宿主闭环，不表示32180已增加owner provider或常驻服务：用户要求临时验后关闭，32180三个owner路由仍不由本批新增。

## 本机编辑器与保留边界

Cursor根协议cursor://已通过OS打开，进程由0变1，未携带prompt、未提交任务。完整短/长文本传递仍依据既有受控验收，不以根协议测试代替。Codex://在本机未注册，不安装、不改注册表。未关闭用户应用窗口。

严格部分安装选项/复用合同等待旧Companion授权；当前完整安装已配置Codex，向导跳过仅跳过额外注册，不保证不配置Codex。配置只读GET是额外能力，不应再视为恢复五客户端POST注册的前提。模型/Agent/知识同步暂停，真实Creator独占窗口未授权。

证据根：C:/Users/33272/AppData/Local/Temp/companion-client-owner-20261018/，包含browser-proof.json、deployment-result.json、owner-browser-proof.json、owner-server-closed.json、owner-original-protection.json、ordinary-window-proof.json、editor-os-open.json、final-protection.json。共享22项HEAD/status/binary diff/dirty字节和daemon bundle均保护通过。
