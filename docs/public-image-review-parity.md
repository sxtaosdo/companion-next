# 独立图片审阅：原功能保留与关键词合同

此合同属于独立 `public-image-review`，不是 Companion v148 AI 图标或知识库服务。2026-10-12 已读取原只读审计最终正文：任务 `01a12f84-4469-7309-8914-4d617fa13430`、消息 `msg_08e826bd3e8be6d1016accae8f7f8887d0b7dc00e4d7e850fd`。原基线 v0.1.0.20 / `776b7ea4de6d03b6dde408fcf27b51490967f367`，报告工作区干净；本轮没有真实联网搜索或下载。

## v5 / 289edee 审计时的差异

Next 已接 Picker JSON 的 `browser_import`、受控预览、选择、原子保存与逐图回执。`src/adapters/image-review.ts` 在该基线拒绝 `mode: search`，并未保留 `source_reports / tasks / cooldowns`；新增帮助 / 关于不会改变这一事实。

尚需迁入：关键词搜索并下载、来源多选及逐来源报告、历史任务切换、1.2 秒状态轮询、全选 / 反选 / 取消选择、大图与完整来源许可、单张失败重试、请求停止、可恢复回收区、百度 / Google 外部入口后的手动 Picker 导入。原保存能力保留，禁止回退有跨标签选择竞态的旧 `/api/export {}`。

## 已核请求

- `POST /api/search`：`{query, limit, source_ids}`。query 去首尾空白后 1–200 字且无字符码 <32 的控制字符；limit 是真正整数 1–30；source_ids 仅 `openverse / commons`，非空、去重，limit 不小于来源数。成功 `{ok:true}` 只代表后台开始检索和下载。
- 旧后端兼容省略来源（默认 Openverse）或旧 `source` 单值字段，但不能和 source_ids 混用；新 UI 无需生成旧格式。
- 来源单页有限检索，不翻页、不因失败 / 去重补搜；某来源失败不阻断其他来源。5 张、两来源按顺序分配 3 / 2。
- 搜索与导入共享至少 10 秒间隔，忙时拒绝。按钮本身是明确“搜索并下载”确认。**不接受 filter_policy 或 download_confirmed**；这与 Picker 的导入策略不同。
- `POST /api/stop {}` 仅请求取消，不是停止终态，不取消原生保存窗口。
- `POST /api/retry {id}` 只重试当前 failed 图片，不搜索、不补候选。`POST /api/task {id}` 切换历史。
- `POST /api/select {ids}` 完整列表允许空，仅 ready；`/api/recycle {}` 将未选 ready 移到回收区；`/api/restore {}` 恢复。
- 继续使用已有 `POST /api/companion/export {expected_task_id, selected_ids}`：原子核任务 / 选择 / busy，无 mode 限制。busy / 旧任务 409、非法选择 400、执行异常 500；复用原 chooser 和原导出器。

原定位：`app.py:99`、`publicImages.py:78,283,369`、`ui.js:183`、`picker_bridge.py:73`。

## 状态与来源

GET `/api/state`：`{task, busy, cache, tasks, sources, cooldowns}`。cache 是本机缓存路径，无需向外传送。

Task：id、query、limit、created_at、provider、source_id、source_ids、mode、status、error、items、selected、exports、source_reports。mode 为 search / browser_import。status 为 searching / downloading / done / stopped / failed / interrupted；**done 可包含 failed 图片**，重试 busy 与 task 状态独立。

图片状态：waiting / downloading / ready / failed / duplicate / trash。基础元数据包括 id/title/image_url/source_page/source_website/provider/source/search_source_id/discovered_by/creator/license/license_version/license_url/retrieved_at/status/error；成功才新增 width/height/extension/content_type/sha256/bytes/final_url/downloaded_at。下载中不得强求成功字段。重复有 duplicate_of；失败可能有 HTTP / 受限 / 冷却字段。

逐来源报告：requested、returned、accepted、skipped、duplicate_urls、downloaded、download_failed、duplicate_contents、error、reasons、status；限制时另含冷却信息。status 包含 pending/searching/searched/downloading/done/failed/limited/blocked/stopped/interrupted。历史最多 100 条按创建时间降序并保留来源与 mode；恢复中断任务将等待 / 下载中项转失败，可显式重试，已下载项保留。

精确 `sources / cooldowns / histories` 字段现已在下述只读源码包核对：分别来自 imageSources.SOURCES、RateLimits.snapshot 与 TaskStore.histories；不能从省略字段臆造结果。

原定位：`publicImages.py:65,171,308`、`taskStore.py:86,100`、`imageSources.py:8,62`。

## 不变安全语义

- 同源、准确 Host、原进程授权不变；旧接口鉴权 403，字段 / busy 400，异常 500。
- 429 冷却持久化，Retry-After 与 60–3600 秒保守退避；重启 / 取消 / 重试不能清除，到期只允许用户重试，不自动访问。
- 下载仅无凭据 HTTPS/443，拒签名参数 / 内网地址；DNS / 重定向重新验证，连接固定验证 IP。单并发、每图 10 MiB / 2000 万像素、网络总期限 25 秒 / 解码 15 秒。401 / 403 / 429 或验证页停止受限主机，不绕过。
- Picker 独有 filter_policy：宽高整数 0–4096，排除格式七类去重；实际解码只支持静态 JPEG / PNG / WebP，选择 / 重试 / 恢复 / 导出继续校验。
- 原 bridge 已继承转发旧接口；本片为避免跨标签任务漂移另加受保护同源操作，不新增代理、CORS、任意 URL 下载、凭据持久化或新的搜索站点。

原定位：`safeFetch.py:62`、`decodeImage.py:10`、`rateLimits.py:122`、`imageManifest.py:18`。本合同是后续已批迁移的依据，不是实现完成或生产来源可用的验收回执。

## 0.1.2 源码迁入状态

2026-10-12 取得 7 个原文件的只读包（非完整 runtime），28711 B，ZIP SHA-256 `df411553cf79f3638ca7db8fd632e3474dce749d7e0c5de75d15f42d0fd67e06`；REFERENCE.json 的逐文件长度 / SHA 均匹配。Next 增加双模式状态投影、关键词 / 原来源、100 条历史、128 条冷却、逐来源报告、受控缩略图 / 原图与元数据、全反取消选择、单张重试、停止请求、可恢复回收、原手动外站入口及串行读取。

七个写动作（含选择即时持久化）使用新增 expected_task_id 受保护桥接，不直接调用旧全局接口；选择与全选 / 反选 / 清空即时持久化，当前服务选择在刷新 / 重开时恢复；单独核 guarded_selection。原子保存保留。旧 import 400 的部分副作用风险已保守分类为未知。源代码与离线测试完成不代表已联网、已部署或原 chooser / 下载 / 恢复链已实机通过。当前后续实际验收需按新构建 / 新桥合同单独取证，不能借用 v5 帮助页验收。
