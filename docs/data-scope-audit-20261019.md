# 旧数据/历史数据处理事实盘点与范围纠正（2026-10-19）

用户明确：旧数据都是测试用，无需迁移；停止旧数据/历史数据搬迁及为此新增保留工程，不删除现有数据或备份。本轮没有执行新数据复制、恢复、导入、清理或原缓存切换，以下只核既有文档、回执及文件名。源码草稿的Git暂存不属于业务数据搬迁。

## 旧页面的历史入口到底是什么

- 旧Companion `cocos-mcp/web/index.html:21–25`主导航为AI icons/projects/knowledge/models，未找到图片任务历史入口；`:799–809`是项目工具调用记录弹窗，不是图片任务历史。
- 独立工具`public-image-review/index.html:23`有“任务记录”下拉`id=history`；`ui.js:144–149`从当前缓存tasks填充，`:211`选择后POST`/api/task {id}`；`app.py:137–138`调用change_task。它切换当前缓存任务，不是搬迁或备份图片库；TaskStore.load可能在原任务中恢复/写回元数据，所以也不能当纯只读操作执行。
- Next的`ImageAssetsView.vue:111`及`stores/image-review.ts:148`已有历史切换UI/逻辑，只是正式Owner provider不开放。不是新发现的旧Companion漏迁页面。[先前分类](migration-closeout-classification-20261018.md)本已将该独立工具排除，后来第18项统计扩大了范围，应纠正。

## 实际发生过什么

| 类别 | 旧位置 → 实际新位置概括 | 复制/格式转换/导入事实 | 当前功能影响 / 迁移验收门槛 |
| --- | --- | --- | --- |
| 图片临时缓存、任务元数据、trash | Temp/public-image-review → Temp/companion-client-owner-20261018/owner-cache-copy | **此前确实复制41文件、10200818字节**供隔离验证；清单original-cache-baseline.json有source/copy和SHA。不能说从未读取/复制。后续验证副本有测试修改，不能当完整原库恢复备份；不是正式新库格式迁移 | 当前验证服务使用测试缓存；原缓存未因本轮切换。取消再备份/切回/迁移，不列为完成门槛；不删除现有副本 |
| 图片库正式备份/切回计划 | 曾计划task/backups/public-image-review-before-switch-20261018 | 用户2026-10-18已取消，**未执行**；本轮只读确认该目标不存在。没有从原库恢复到新后台 | 整项移出验收，不再新建保留工程，原缓存不动 |
| 知识历史文档、分片、索引 | D:/services/weknora既有数据目录，继续原地使用 | 未将全历史文档搬到Next，未新建历史库或全量重建历史索引。服务代码修复前曾把SQLite、EXE/manifest备份到专用Temp；这是保护性复制，不是新后台数据导入。历史1647文档的选定元数据及索引计数有只读对比，不是全DB字节相同证明 | 不再把1493旧未完成任务恢复、旧状态保持或历史文档迁入当验收门槛。原数据及备份不删除 |
| 知识测试文档 | 同一WeKnora测试KB内的虚构TXT/测试文档 | 之前有真实1次chunk编辑及1次source reparse恢复，产生测试索引写入；不是旧文档迁移。不能把“未迁移”说成知识库从未写过。见knowledge-chunk-edit-real-20261018.md | 功能测试既有证据，不新增历史恢复工作 |
| Companion SQLite 9业务表 | %APPDATA%/Creator AI Companion → 原位置继续运行；另备份至task/companion-process-restart-20261019/private-backup | 进程切换前实际保存coordination-consistent.sqlite，以及raw DB/WAL/SHM；9表未导出导入、未改格式，备份未作为新在线数据库。新进程继续读原DB | 移除迁移/导入/恢复门槛；不需要新增备份或搬表；不删除原DB/备份 |
| Native UNKNOWN/journal/head/lock | 原%APPDATA%位置继续用，另存上述private-backup/raw | 备份了journal/head/legacy lock；原地历史UNKNOWN2仍在，quiescence0；没有转换为成功/取消、没有旧记录导入新库 | 不是历史迁移任务，不再扩维护工程。用户取消搬迁不等于可删除或伪造退出证明；本轮不改守卫 |
| Companion自身配置/locator | 原%APPDATA%位置 → private-backup/raw | 实际备份projects.json、bridge-installs.json、tool-presets.json、daemon.json。前3是自身登记/安装/预设，daemon是运行定位与认证；新进程正常更新运行身份。**不是五种真实客户端配置备份** | 没有将客户端配置从旧IDE搬到新IDE。现有备份保留，不再作为迁移完成门槛 |
| 五客户端配置回滚测试 | 合成Temp文件/fake Codex ledger → 合成Temp stage与回读 | 真实Cursor/Trae/Kiro/VSCode/Codex配置未写、未迁移；候选测试产生的临时原文件/阶段文件都是合成数据 | 属于功能验证。VSCode候选未部署、原生连接未验，不能以旧数据恢复为前提 |
| 调用记录、AI任务历史读取 | 既有正式API → Temp/测试JSON/报告中的限定响应 | 82项历史读取是响应注入回归，未向业务DB导入历史。新132/66调用完全合成，未制造真实失败业务；重启前曾导出12条内存日志、0调用记录作证据，不是历史库迁入 | 只验功能/当前数据行为；旧记录无需搬迁，不保留“迁完旧记录”门槛 |
| 96变体资源功能验收 | 生成/验证资源 → 独立Creator验收工程assets | 已按此前批准真实导入PNG/meta/UUID，并做场景重开/Preview/Build/Smoke；这是生成资源导入功能的测试，不是将旧项目资源搬迁到新项目 | 已完成不重做，不增加旧项目数据迁移门槛 |
| 报告、截图、构建与源码归档 | Temp → docs/evidence、任务交付目录 | 实际复制了API响应、测试报告、遮罩截图、示例PNG、源码patch和构建物；未将这些归档导入运行数据库。候选构建/源码不是旧业务数据 | 属于证据/代码交付；不影响功能开通，不要求继续收集全部旧数据；现有归档不删除 |

进程切换备份只列结构，不输出配置正文或token。知识服务恢复记录明确AUTO_MIGRATE=false、AUTO_RECOVER_DIRTY=false、housekeeping关闭；恢复服务不是恢复全部历史任务。[服务记录](knowledge-service-restored-20261019.md)。

## 当前源码/统计状态

VSCode隔离修复dacb89b/0.3.148已完成114项回归与离线构建，尚未部署；调用页132/66模拟和129项回归已完成，不重复启动。

Owner此前新增但未集成的两组接线草稿已暂停并只作源码Git stash（`3246bdb750350068bb08b224ea1367246f9e8eb3`）；没有接入主provider、部署或操作缓存。批量组7项、历史组35项曾跑合成测试，**不计功能完成**。Root仅加过接口类型，未成功修改主provider/store/view，已随草稿暂存；当前业务源码保持已提交版本。

固定21项中，第18项改为已有批准且实机通过的“Owner预览、选择、保存”，不再混入独立工具功能和旧数据迁移。统计更正为**7完整验收通过/12部分/2未完成或阻塞，按项等权33.3%**。这是原范围误列的纠正，不是新增功能完成；不是工作量进度。详细可复算行见[migration-status-21-20261019.md](migration-status-21-20261019.md)。
