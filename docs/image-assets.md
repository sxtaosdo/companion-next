# 图片素材搜索与 Picker 审阅接入

## 可以做什么

「图片素材」独立于项目 / 示例工作区。搜索输入与 Picker 清单驻留页面会话内存；保留选择经任务绑定接口写入原审阅任务缓存，不写项目规范或资源计划。

0. 显式连接后可选择原 Openverse / Commons 来源，输入关键词与合并上限，点击“搜索并下载到审阅区”。这一步明确会访问所选来源并下载，不跟随输入自动检索。
1. 导入 Picker v16 的 `公开图片-待审清单.json`，或粘贴完整 JSON。解析只读取地址与元数据，原清单在新输入无效时保留。
2. 核对候选地址及过滤策略。文件是地址清单，不含图片字节；不会把其中 URL 直接作为 `<img src>` 或代替本地服务访问。
3. 在受控本机同源宿主下显式连接审阅服务。确认下载范围后，原服务访问公开来源；`ok:true` 只表示入队，同一规范化清单不重复入队，结果未知时禁止自动重试。
4. 页面可见且已显式连接时约 1.2 秒串行读取；写入期间暂停，隐藏 / 离页停止。支持来源报告、历史、冷却、单张失败重试、请求停止、全选 / 反选 / 取消选择及可恢复回收。选择已下载 `ready` 候选，在页内原图区域审阅并勾选保留；ready / trash 均可查看受控缩略图 / 原图，只有 ready 可选择。等待 / 下载 / 失败 / 重复 / 回收状态均不冒充可用图片。
5. 只有同源桥声明并实际提供原子任务 / 选择保护，才允许原生目录选择及保存。取消、逐项成功和失败分开显示；未知或不匹配回执不算保存成功。

保存原图及来源记录由原 `TaskStore.export` 完成；不接受网页传入目录路径，不用浏览器下载冒充选择本地目录，不覆盖同名文件。该保存不等于 Cocos 导入、绑定或工程配置写入。

## 已核真实合同

原审阅后端 v0.1.0.20，Git `776b7ea4de6d03b6dde408fcf27b51490967f367`；Picker 扩展仍为 v16。基线核心 SHA-256：

- app.py：`26e9e7cad8519c54fab2378eccd9e1833d23c51875fd552da0c7ecf3e62ad959`
- publicImages.py：`4838d7c068cfcdbce5ca54a4c05618f93be783016313acaa2d3958cb669276b0`
- taskStore.py：`41aa8936543b3d0117b0773871e61b6bcea8f78960b9b481fb9e43b7b71905a1`

原 7 个界面 / 合同源码已作为只读参考按 SHA 消费，不是完整运行发行包，也未在 dot 运行原服务。独立桥启动必须核验本机完整基线，不自动安装依赖。

- `GET /` 在 body 的 data-token 提供本进程会话；API 使用 X-Review-Token。严格 Host / Origin 与 Cross-site 限制不变，无 CORS。
- `GET /api/state` 的 `busy` 是真实操作锁状态，不能从 `task.status=done` 推断空闲。选中 ID 来自 `task.selected`，不是 item.selected。
- `POST /api/import` 接受 schema_version 1，1–30 项 images；image_url / source_page 必须存在，title / candidate_kind / discovery_method 可选。支持可选 filter_policy：宽高 0–4096 整数，排除格式唯一且只能为 svg/png/jpeg/webp/gif/avif/bmp。导入 256 KiB，其它请求 8192 字节。
- 任务与图片 ID 为 32 位小写十六进制。图片状态 waiting/downloading/ready/failed/duplicate/trash；任务状态 searching/downloading/done/stopped/failed/interrupted。
- 图片只通过 `/image/<process-token>/<id>/thumb|full` 访问。缩略图 JPEG，原图已核 JPEG/PNG/WebP；不存在任意文件路径或通用远程图片代理。

前端地址验证是离线语法防护：拒绝凭据、非 HTTP(S)、明显本地和保留地址（含 DNS 尾点归一化），不声称做过 DNS、重定向或许可核验。这些网络 / 内容检查仍由原审阅下载器负责。

## 同源托管与保存竞态

`main.ts` 仅在 `http://127.0.0.1:<port>/companion/` 或其 index.html 下注册本机审阅适配器。普通 Vite 根页面不注册。注册不发请求；点击连接才同源 GET 原首页，以惰性内存会话读取固定 API，不执行旧 HTML 脚本，不跨机器复制 token。显式重新连接会重新获取当前进程会话，支持服务重启后恢复；不会因认证失败自动重试写入。

- 新 `GET /api/companion/capabilities` 必须声明 schema_version 1 / guarded_export true。
- 新 `POST /api/companion/export` 仅接受 expected_task_id 和 selected_ids。服务器在同一非重入 app.lock 内检查忙碌与任务 ID，通过原 store.select 验证所选项，设置 export 操作锁；随后才释放 app.lock，打开原目录选择器并调用完整 store.export。
- 不在持 app.lock 时调用 app.claim/select/export，以免死锁；最后安全释放忙碌状态。客户端不能选择目录、清空权限或更改缓存根。
- 原 `POST /api/export {}` 在 select 与 export 之间有跨 tab 窗口。前端旧适配器明确不启用该保存接口，不用一次 GET 比较来伪装原子保护。
- UI 使用当前成功读取所提交的响应式保存能力快照；刷新开始、读取失败或断开时立即关闭能力。只有最新一次能力 / 状态读取与状态校验成功后才恢复，避免适配器普通 getter 在刷新期间使计算属性永久缓存为禁用。实际点击保存仍再次检查适配器 guard，服务端原子任务 / 选择锁不变。

宿主 CSP 保持原值，尤其不允许 blob 图片、inline script / eval / inline style 或外部字体。预览因此使用严格匹配当前 ID 的同源图片路径，不使用 blob: 或候选远程地址。Vue 使用预编译构建、外部 JS/CSS 与系统字体。Element Plus 在该 CSP 下的实际样式行为仍须真实浏览器验证，未放宽 CSP。

## 中断与不确定结果

- 旧状态读取 / 旧预览不会覆盖切换后的任务或连接。
- 新文件读取期间不能拿旧候选确认发起下载；失败保留原清单但不复用旧确认。
- 保存或入队期间禁止本页重复写操作。注册服务变更会等正在进行的写操作结束，再断开旧身份；离页返回时也立即复核。
- 受保护 companion 路由的 400 / 409 及鉴权 403 表示副作用前拒绝；选择已赋值后的 save 失败、动作执行中异常为 500 / 未知。原 `/api/import` 的 400 可能来自任务创建后的保存失败，必须保守记未知，不能泛化为未执行。
- 入队或保存返回不明时保留“不确定”标记，后续写入暂停，要求在原审阅服务核对，不自动重发。
- ready 勾选 / 全选 / 反选 / 清空通过 `/api/companion/select {expected_task_id, selected_ids}` 即时写入原任务缓存；读回前禁后续写入。下载中允许选择，导出等忙碌状态由原锁拒绝。同任务刷新也采用服务选择，重新打开从服务恢复。选择请求未知时不靠刷新 / 重连解除写门。
- 当前保留选择只是审阅意图；唯有完整匹配的服务回执才展示逐项保存成功。历史回执不暗示新任务已保存。

## 验证与运行边界

合同 / store / DOM 测试使用明确离线替身，没有真实网络、图片下载或文件保存。Python 桥的单元测试同样不能替代完整原后端验收。普通 Vite 构建可以验证前端，不证明原生目录选择和 Windows 的同源宿主已运行。

本次关键词 / 任务操作扩展未部署 Windows；此前 v4 修复与 v5 UI 的独立消费证据不覆盖它。仍需在获准的完整审阅基线上消费当前独立桥，并实测 CSP、预览、跨 tab 任务冲突、目录取消 / 两次保存与来源副文件。没有新增第三方依赖、端口扩大、凭据或安全权限。

## 任务绑定操作与恢复

同源 capabilities 的 `guarded_review_actions: true` 与成功状态校验共同启用搜索、历史、重试、停止、回收、恢复六个操作；选择另须 `guarded_selection: true`；旧宿主缺此字段时这些按钮保持不可用，现有受保护保存不退回旧 API。端点 / 锁合同见 `bridge-review-controls.md`，来源字段与原合同见 `public-image-review-parity.md`。

新搜索、历史、retry、stop、recycle、restore 都携带 expected_task_id；回收同时发送本次完整保留列表（可为空），同锁复用原 TaskStore。回收 / 恢复可能逐图提交，失败并不保证全部回滚；500 / 断流时后续写入暂停。原未加守卫的 `/api/stop` 仍可影响同进程任务，新保护只覆盖新入口，不修改旧站点。

搜索 / 历史请求受理后，未读取到目标前不按旧空闲快照解锁。若另一标签改变了当前任务，可以在受理后成功读取、最新能力有效、未读写且非未知状态时，显式采用屏幕显示的当前任务；仅清本地待切换标记 / 旧回执，保留当前有效快照的服务选择，不发 POST、不重放、不解除未知结果，也不清提交间隔或已受理 Picker 清单。

冷却按原 128 项记录保留，手动 hold 不自动解除；到期仅允许用户再试，不自动搜索 / 重试 / 补搜。`done` 可有失败项，`busy` 独立显示。关键词接口没有 filter_policy 或 download_confirmed；Picker 原筛选合同保留。
