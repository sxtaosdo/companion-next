# 0.1.13 同源与被动读取边界

## 本次问题和修复

现场报告（由 Windows 消费任务核实，本 dot 任务未联网复测）：纯静态 preview 15112 的 `/api/projects`、`/api/status`、`/api/dashboard/projects` 返回404，真实宿主32180提供API。这是同源宿主错误，不能通过放宽CORS、搬Cookie/token或加通用代理解决。正确候选入口为真实已登录宿主的 `/next/index.html#/projects`，API仍使用根 `/api/...`，不写死端口、不转发到另一个origin。

审0.1.12又发现连接/刷新并发读 projects、status、dashboard；实时更新也重复这组三项。v150现场合同确认 status 会探Bridge，可能更新状态/事件/诊断日志；dashboard在Windows可调用CIM；knowledge/status会执行CLI及sync状态查询。不能把GET或“只读”标签等同零副作用。

0.1.13在 `companion-readonly` 模式：
- 应用挂载不进行业务请求。用户显式连接只读 `/api/projects`，成功后读 `/api/calls/counts`。
- 刷新与可见页实时工程轮询只读 `/api/projects`；SSE仅在单独点击后开，原计数/日志/调用合并及失败/取消保护保持。
- 永不通过该provider请求 status/dashboard，状态显示“运行状态未探测”，不可筛选为已停止/运行。不把未探测解释为零服务或离线。
- 不注册 knowledge provider。知识及模型页连接按钮禁用，并显示“此只读预览未启用状态探测”；不以连接知识为由运行CLI。查询功能源码保留在其他独立构建。
- AI provider仅允许显式 resource-config 文件读取；reference-preview在transport前拒绝且按钮禁用。原参考路径仍可查看。
- config-editor / knowledge-chat / 普通Picker模式保留此前注册和逐次确认边界。本次不批准这些模式部署或真实写入/模型调用。

## 此候选允许的后端路径

固定同源Cookie请求，不读或存凭据、不添加Authorization，不改Host/CORS。返回内容有原有大小/类型/ID与迟到响应检查。

| 方法 | 路径 | 触发和语义 |
| --- | --- | --- |
| GET | `/api/projects` | 显式连接/刷新，或显式实时开启后可见页串行刷新；读已登记工程 |
| GET | `/api/calls/counts` | 连接成功、手动统计、SSE连接回读；读当前服务会话统计 |
| GET | `/api/logs?…` | 显式查询或已开启实时日志事件合流；固定过滤与limit |
| GET | `/api/projects/:id/calls?…` | 显式工程/筛选/分页，或SSE重连校核当前工程 |
| GET (SSE) | `/api/events` | 用户单独开启实时；只收原日志/调用事件，没有回放保证 |
| GET | `/api/tools` | 帮助工具清单明确读取；映射静态工具规格 |
| GET | `/api/tool-presets[?projectId=…]` | 明确连接/选择工程；读原JSON及内存内置默认 |
| GET | `/api/tool-presets/:id/export` | 明确下载；后台生成投影副本，无宿主持久化；浏览器下载仍产生用户选择的本地文件 |
| POST | `/api/icons/:id/resource-config` | 用户显式选择工程后读取，body为 `{}`；查固定项目文件/目录/参考路径存在性，非网络/模型任务 |

未列入本候选：`/api/status`、`/api/dashboard/projects`、所有知识/模型接口、`reference-preview`、保存/上传、Picker搜索/下载/回收/保存、生成和Creator生命周期。页面内示例、草稿、本地文件选择/导出与复制不代表宿主写入或API通过。

## 后端证据和范围

v150现场确认了三项目接口顶层直接数组及上述状态/发现/知识探测副作用。dot持有完整源码证据仍是v148 f6dcac8；不声称整个v150字节或部署哈希匹配。fixture沿真实结构、使用合成值，不作实时返回证据。

v148调用链（`mcp/src/companion/`）：
- `http-server.ts:331–347,363–365`，`tool-preset-store.ts:96–110,191–206,300–306`：目录/读取/导出仅静态规格和JSON；缺文件时内存默认，不调用309–319写盘。内置导出生成新UUID/时间戳但不保存。
- `http-server.ts:581–589`、`icon-adapter.ts:117,129`、`icon-resource-config.ts:125–135,147–202`：resource-config读取项目设置/manifest、根目录配置候选和固定目录；参考只做realpath/lstat。迁移草稿在内存，不调save/snapshot/runner。
- `icon-image-assets.ts:207–213,181–186`：reference-preview读取图片并spawn配置Python做Pillow内存归一化。无persist不代表无进程，因此此候选禁用。

## 构建、回退与未验证项

源码从同Library v12（873009B，SHA256 `8d6a77ac073c2e0070216f18aab59fc36cc380c2205312d418a99bf89a995bf2`）恢复到独立dot目录。201文件逐字节核manifest，恢复Git tree=`5ee9bacab80a42e964e91ea357efe5ee19cf2277`，与原f1167e9一致，任务checkpoint=`c451df5`。原 `/workspace/shared/companion-next` 仍是0.1.4/4d1429c，不覆盖或冒称恢复了历史Git提交。

未安装依赖，原node_modules借用于隔离构建；两个lock排除项目自身版本后完全相同。输出为 `companion-readonly --base ./`。使用既有脚本逐文件检查普通文件、无链接、路径范围及HTML/JS/CSS相对引用；manifest必须按实际输出枚举，不能复制旧文件数或SHA。

当前只准备，不上传/部署、不启动服务、不连接用户API。原static Library v0/0.1.4保持不变；本次v150部署批准仍待父任务处理。现场旧文件hash不同不得自动覆盖/修复。候选只允许目标next缺席时新增；将来回退也仅移走此次新增且hash仍匹配的文件，绝不动原文件/会话/进程。

未验证：v150真实同源Cookie和新页面读取、浏览器视觉/CSP、现场路径/运行身份/资产、完整功能业务迁移。构建成功和fake测试不代表这些已通过。构建代码中的127.0.0.1判断只是传输限制，不是权限或已登录证明。
