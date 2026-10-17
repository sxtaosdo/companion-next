# 隔离96×96变体导入与后续验收

2026-10-17 04:38 UTC 更新：隔离工程的持久场景、Preview、Profiler、WebMobile Build 与固定产物 Smoke 已通过；Next 原资源面板真实历史/状态/原96×96变体PNG读取均200、图片SHA与原收据一致，明确历史只读，productionVerified=false。Next caf14fb/1.3.173.18已部署；实际 Studio 工作树6cb7c09（合同7e117fe），Node25 daemon PID4092。下述旧失败/待办作为当时记录保留，当前状态、源码整合边界和证据以[本轮交付](variant-ui-followup-20261017.md)为准。

后续事实更新（03:59 UTC）：该独立 fixture 已完成持久场景跨会话重开、实际 Preview 可见、Profiler 和 WebMobile Build，权威记录在 fixture `WINDOW-20261017.md` / HEAD `aae735afc76793186c9e100179f75425caffad28`。Build Smoke 尚待 GPU 窗口；真实 Next 资源 UI 已复现旧任务读取409，未通过完整验收。以下保留当时窗口记录，不作为后续 Runtime 未执行的结论；详见[后续交接](variant-ui-followup-20261017.md)。

状态：Accepted。本记录补充真实资源导入证据，不改变Next界面、已部署六静态、共享cocos-mcp源码或旧UNKNOWN。完整迁移差距仍以[主清单](feature-parity-current.md)为准。

后续实际窗口（02:43 UTC）：同一fixture通过Dashboard启动3.8.8，首次7458监听02:43:54.937Z、固定截止02:53:54.937Z。02:44:00.686Z首次只读解析返回NOT_FOUND；资产日志到本机UTC+8 10:44:02才ready，查询早于就绪约2秒。没有派发场景/Preview/Build，没有重导或重放；官方stop后两项已核自有子进程另以同一SIGTERM收尾，02:46:03.487Z确认全树和7456/7458关闭，新fence2于02:46:44释放。原资产7项复查通过；只读就绪门候选8项离线检查通过，尚未实测。细节及原始FALSE关闭回执/最终补充证明见fixture根WINDOW-20261017.md。不能把Bridge ready当AssetDB ready；已用窗口不因重连重置。

2026-10-17在Owner批准的独立fixture `D:/code/shidai3/P8000/local-tests/creator-ai-variant-import-acceptance-20261017`（projectId `a79f4915296f4091`，Creator3.8.8、Bridge0.3.138）已完成现有母图的单张CPU96×96 PNG真实导入。使用新job/绑定/收据，不重用旧失败操作；原sourceId与adoption manifest只读复用。两次启动期间合计只有一次导入POST，首次7456意外端口尝试提交0次，失败与Owner批准的profile修正/残留清理记录保留。

PNG7391字节，SHA256 `fe10e97c530d9cd03908e77dddaa9413a8284baab8c22bb461e7bb05b4638654`，meta SHA256 `e57c2fd7977930cd99f5a5239bbb0947b7d3db6d154448af43dbbf0e27faaa7b`；asset UUID `8caed0d9-2eec-48ff-a7ea-9788842986b0`，SpriteFrame UUID同UUID加`@f9941`。原PNG96×96与SpriteFrame raw96×96一致，有效auto-trim53×68不代表尺寸错误。导出和导入字节相同，Creator实际引用回读与7项只读CPU检查均通过。

隔离工程资产/检查器恢复点为`206ef6bcc91937a67b035a963d76d01a0d1eb3f4` / 0.1.0.2，文档另交付；PNG/meta禁Git行尾转换，保存原样字节，settings/profiles/Bridge保留本机状态。原导入任务sourceRevision仍为450fafb，不随检查点改写。独立reviewer及复审无证实阻断，OCR使用父规则Delegation/宿主审读，不宣称managed PASS；无新Runtime或部署。

唯一导入parent operation `icon-import-72084b9939f06eb1f9a112225bcb2645`，实际子操作后缀`-coin-pouch-variant-96x96-isolated-20261017`为SUCCEEDED；dispatch `747443ff-4b08-4c60-bd13-edd1bea239c4`为TERMINAL/SUCCEEDED，fence1 lease RELEASED。job `STUDIO-RUN-variant-isolated-20261017-27c2be4f` revision6，母图仍selected，变体为imported_pending_verification、productionVerified=false；不能手工改成已验收。

此窗口TCP7458首次观察01:57:22.370Z，官方stop后于01:57:43.082Z验证端口7456/7458及自有进程树全部关闭。观测20.712秒，启动派发至关闭保守上界31.215秒，低于10分钟。GPU窗口已释放；旧窗口已结束，不作为再次启动许可。旧工程`87224a1a9dbb5736`的fence2 STARTED/UNKNOWN、来源manifest和Next部署index SHA `4717a68ace5df9c95fe65ca67783b85d1069d95e83de053d7e618fccfc9808ab`均保持。

后续场景绑定、Preview与Build目标已由Owner“继续推荐。直到完成。可用”授权。当前仅完成离线清单与恢复点；新的TCP7458全IPv4限时监听/GPU窗口仍需Parent协调。严格通过原Dashboard/Bridge、fresh revision/new operation/lease建立最小Canvas+Sprite场景，保存重开并核持久引用，再Preview/Profiler及web-mobile Build。禁止重导入或手写scene/prefab/meta，UNKNOWN只读查同一操作，不重放；实际URL或端口超范围立即停止。步骤、边界与恢复见fixture根ACCEPTANCE.md。

官方3.8.8安装版builder声明证实scenes是`{url,uuid}`对象数组；[官方命令行手册](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)进一步证实startScene值为主场景UUID。运行前在configPath指定文件填实际回读的场景URL/UUID，不给build_start捏造场景参数。现有helper默认scenes空，构建无内置超时；不承诺10分钟内构建完成。Preview不提供端口控制，独立build_smoke还会启用loopback动态端口，未纳入当前7458请求。

原始证据目录：`C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/interface-load-20261016-phase2/recovery-20261017/isolated-import-20261017/approved-7458-run`。核心文件delivery-result.json、new-import-ledger.json、final-job-status.json、final-closure-proof.json、offline-consistency.json。fixture已保存PNG、Creator原样meta、来源/UUID/哈希基线和只读检查，临时目录不承诺永久保留。

本片只有资源资产导入及离线引用图通过。场景序列化/重开、实际像素显示、Preview、Profiler、Build及Next资源UI操作仍未验收；Next运行代码继续为`5419ace06f5f25f4a3f4300dcfab2a85255edc68` / 1.3.173.11，后续文档版本不重标产物。未push/tag/父pin，无关机或平台/凭据动作。
