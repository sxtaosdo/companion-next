# 工程、日志与调用的只读迁入片

前端 0.1.3，页面 `#/projects`，日志 / 调用通过 `?tab=logs|calls`。这是一片实际 GET 客户端和交互迁移，不是完整工程管理迁移：没有 setup、目录选择、生命周期、诊断、配置、日志删除或调用重放方法。SSE、3 秒轮询和原管理写操作仍单列未迁，不能用禁用按钮充当完成。

## 已核后端

读取 v148 后端合同包：108630 B，SHA-256 `6801560238a8a835f70ac0392f6d709e08b1d0bcfa233c4f70814702c1fcaf28`。同 HEAD `f6dcac804fb9ad806e8094594c7820a71cfab7b8` 的13源码、15测试及package共29文件在dot重新核对长度/SHA，全部匹配。原测试只作合同参考，没有把该包当完整应用运行；它不含 http-server/daemon 的完整构建依赖。

真实六类 GET 与响应、预算见 `companion-browser-contract.md`。页面调用固定相对路径、mode/credentials=same-origin、redirect=error，不收地址或 token、不转向机器Bearer API。构造 / 注册不发请求，用户点击连接才读取。

“只读”指前端仅观察已核 GET。原 `/api/status` 会 refresh Bridge / markDisconnected，并可能由原 daemon 记录诊断日志，不能承诺后端零写入。`/api/logs` 只读原环形日志，不主动向场景 / Preview 取证或拉起 console watcher。

## 两类构建严格分开

- `npm run build` → `dist/`：既有图片审阅 / 普通前端构建；不注册 Companion 工程只读接口。Picker同源路径的现有行为不变。
- `npm run build:companion-readonly` → `dist-companion/`：明确 Companion 宿主构建。仅在 `http://127.0.0.1` 下注册 Cookie 同源 provider；不会注册 Picker token provider。端口来自网页原origin，不允许编辑baseURL。

Vue hash路由不要求daemon新增SPA fallback。经核 v148 `CompanionHttpServerOptions.webRoot` 可指定静态根，但 **startCompanionDaemon未向它转发webRoot，也没有已核现成CLI参数可直接挂此dist**。本片不修改原后端、不虚造启动命令、不新造后台或通用代理。真实部署还需在已批准独立启动方式下提供正确静态根，并核对定位文件 / registry / cache / 租约 / 已有实例；不能只换端口就宣称隔离。

本机Cookie不按端口隔离。Companion与Picker的凭据机制不同；即使同为127.0.0.1，也不能拿已有图片页的token或进程冒充Companion。页面未复制、输入或持久化任何凭据，也不改变Cookie、Host、Origin、CORS或权限。

## 已实现交互

- 工程：真实登记、Creator八态/未知、当前与要求版本分别显示、权限标识、Dashboard最近打开、调用摘要；名称/路径/ID/状态搜索、运行/停止筛选、折叠偏好、复制字段。状态或Dashboard单点失败不丢弃已成功登记工程，明确警告并保持未知；注册读取失败清空视图，不回落示例。
- Windows Dashboard显示匹配只规范化Windows盘符/UNC语法的大小写与分隔符；POSIX路径保留大小写。这只是显示关联，不构成文件身份验证。
- 日志：工程/来源/级别/消息筛选、最多最新200条手动读取、滚到最新；筛选变化立即清旧结果并取消旧请求。没有HTTP日志分页，就不提供假的“更早记录”。
- 调用：按登记工程查询，全部/失败、每页50与服务游标更多、摘要展开、错误态、total/retained真实语义；服务session变化清旧页和游标。更多时发现会话改变要求重读首批，不用旧游标结果填充首页。
- 导航 / 注册身份：卸载取消读取；返回立即核对注册provider；旧connect不能在新身份下续发counts。A→B→A、重新连接、筛选改变、服务会话变化均拒绝迟到响应。与原项目示例/规范草稿/资源计划及图片审阅独立，互不清除。

此页不自动嵌入完整知识/模型面板，不发送知识检索、聊天或同步请求。工具范围不等于Creator写权限。旧工程“启动”实际上setup/安装Bridge/配置Codex，必须单独迁移并保留真实批准范围。

## 待验与下一片

当前只证明源码、离线合同 / DOM / 构建。没有在实际 Companion daemon / Cookie会话中读取用户工程、日志或调用，也没有真实浏览器桌面/窄屏与本页样式验收。

后续先解决完整原宿主的独立静态托管入口，再验证401/403、部分失败、已登记工程、真实日志分页边界、调用session/游标；然后补受控SSE与原实时语义。管理写操作、知识、模型及AI图标继续按 `migration-execution-order.md` 分片，不把本页读记录替代完整旧业务。Windows进行中的v5验收与v6图片功能交付不被本片覆盖。
