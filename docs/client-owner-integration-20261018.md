# 客户端注册、向导接线及隔离owner验收

状态：Accepted。检查点基线fe43869/.60，当前部署4aaeedf/.59。本批明确授权仅Next开发，五客户端全部受控测试、真实配置写入0；独立owner临时loopback服务+原缓存隔离副本+Temp导出可验，结束关闭。模型/搜索/下载/真实Creator不启动，不改旧Companion或持久权限，保护共享22项和PID2100/用户会话。

开发：原POST /api/projects/:id/mcp/register五目标；卡片原注册弹窗和向导Agent多选/全选/跳过。复用正常workspace显式provider、同Pinia操作lane、当前完整工程身份、明确确认及UNKNOWN禁止重发，串行批次首个异常停止后续。工具范围用原GET /api/tool-presets?projectId=和POST /api/projects/:id/tool-preset，带匹配complete的setupOperationId，仅显式选择确认写入。

严格部分安装仍等待后端options合同；现有完整接入已经明确包含Codex，向导Agent跳过只跳过额外注册，不声称撤销/避免既有Codex。既有完成回执才显示后续Agent和范围，不自动POST。

owner：原三SHA固定源，现有Pillow12.3/tkinter环境；原缓存只读快照复制到Temp且核对SHA，原load_last/lease仅作用于副本。生产模式独立包与原桥接，只127.0.0.1动态端口；真实thumb/full HTTP字节和解码、选择与Temp导出，断言无搜索/下载。验后关自建服务，不触及32180。

## 实现与回归

已接原五客户端POST、卡片弹窗及完成向导Agent多选/全选/跳过；scope原POST带匹配complete的setupOperationId，写后有效回执才读回。确认冻结工程和所选客户端/预设，单lane串行批次、首错停后续，UNKNOWN单项禁止重发，关闭或换源抑制迟到回执，传输真实清理后放锁。原严格部分安装边界不变，跳过明确不是撤销Codex。独立reviewer发现跳过状态跨任务串用，已绑定完成工程/路径/任务ID并补回归，复核关闭。

3文件94项必要回归、最终strict通过。原计时回归定位到Element Plus use-lockscreen卸载的200ms清理，等待第三方清理完成再断言无遗留timer；本地计时interval泄漏仍会失败。调试instrumentation已全部还原。真实客户端配置写入0。
