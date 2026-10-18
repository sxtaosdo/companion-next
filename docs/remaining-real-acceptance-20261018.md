# 剩余迁移真实验收批次（2026-10-18）

状态：Accepted。用户明确继续已核剩余旧功能真实验收，源基线d919e5a/.95，静态9af5813/.94。完成本批有界操作后收尾，不重跑保存、733库存、SSE、96资源或模型实验。先建立本任务检查点与Temp原数据/源修改快照。

本轮计划：

1. 现有工程creator.hasUnsavedChanges已读为false；隔离工程a79f4915296f4091已登记，原23740/food-hunt运行。Creator正常启停/重启已获准；仅原接口、每步结果先核对，使用原隔离场景，不编辑scene/prefab/meta或重导资产。原非回环预览监听只有7456，隔离Creator如需临时运行应复用该窗口而不叠加外部监听；不改网络安全设置。保留当前工程源/脏改动，最终恢复原工程正常运行。
2. 通过正式Next隔离工程卡实际Preview probe/status/start/reload、Profiler各一次，读取原回执；不跑Build/Smoke或96资产旧验收。Preview/Profiler的场景运行属于本轮新后台按钮真实验收，不重新声称旧资源已通过。若原支持路径不能满足监听/文档安全约束，保留已能读取的结果并报告精确限制，不自造引擎接口。
3. 工具预设只操作带本任务唯一名称/ID的新自定义项，正式Next创建/改名或保存/导入/导出/分配与普通409在用保护。绑定仅隔离工程；不用confirm=true、不改用户预设，不写MCP配置。每次读取实际盘面，发现非任务并行变化则停止旧快照覆盖。清理只移除本任务预设和本轮新建的fixture绑定，原隐式full需精确恢复；若需调用原repository.removeProjectSelection作清理，只针对已验证的任务自有绑定，绝不重置整库。
4. 编辑器协议先确认原处理器。Cursor已注册；Codex当前协议未注册，不能安装/注册冒充验收。只交接固定的任务验收说明到隔离工程、禁止执行代码/模型/网络动作，不强关原窗口；若实际处理器不能接收或必须新配置，记录环境阻塞。剪贴板用户数据不记录，必要交接完成后尽力恢复原剪贴板类型/内容，不把复制当执行成功。
5. 知识启动仅沿用已有Start-PilotAccess.ps1的独立pilot SQLite、本地文件存储、127.0.0.1:8081；原脚本AUTO_MIGRATE/AUTO_RECOVER_DIRTY/HOUSEKEEPING=false，注册/telemetry/graph关闭，不自动恢复模型或同步。不读取凭据正文，不做Owner登录/检索/问答/同步/API-key生成。若原启动前metadata守卫失败，不改守卫/DB/历史任务；需要外部写入、缺依赖或新增信任则停并给最小明确需求。

已快照：旧共享22项、原工程267项及隔离工程原修改、Git工作/暂存patch、预设原tool-presets.json；不把这些快照当新业务通过。原daemon20116/launcher7292/Heretic3260保持，不抢占GPU。无安装、MCP持久写入、模型下载、发布、上传或push。

证据目录：C:/Users/33272/AppData/Local/Temp/companion-remaining-real-acceptance-20261018。每项真实通过/失败/未执行与清理结果在本文件续记。
