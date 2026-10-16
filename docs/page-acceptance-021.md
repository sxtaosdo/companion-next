# 1.3.171 逐页验收清单

以下列出本轮实际接线与需要消费端核对的结果。离线 DOM/provider 测试只能验证前端流程与契约，不能替代真实浏览器、模型发送或工程文件落盘。

| 页面 | 本轮可核行为 | 离线测试证据 | 真实验收仍需 |
| --- | --- | --- | --- |
| 项目概览 | 真实登记选择、状态、深链；无库存时保持未知 | registered-project-views | 同源已登录、多工程选择、真实 Bridge 状态 |
| 工程 | 保留原登记/setup/生命周期/目录/日志/calls/SSE；本轮不改动作协议 | creator-operations、project-setup、companion-live 等既有全量回归 | 原操作各自真实回执；不以本轮构建代替启停证据 |
| 游戏资源 / 规范 | 正式保存摘要、同弹窗新建/迁移/编辑；参考独立上传后仍须保存配置 | resource-config-production、ai-resource-editor、ai-reference-upload | 指定测试工程、原文件hash、上传原图/规范图及保存回执；原图元数据仍保留 |
| 游戏资源 / 生成与审阅 | 明确点击读取原任务、状态、候选；无示例、不新建作业 | ai-jobs-read、resource-config-production | 已配置原适配器的jobs/status/candidate，候选像素/显示；读取会执行Python/Git/Pillow |
| 游戏资源 / 规划、导入、运行 | 库存/批准/导入/UUID/运行证据仍缺，不显示虚构完成 | registered-project-views、resource-config-production | 原流程逐操作接线和真正Creator验证；当前为空态而非已迁功能 |
| AI 图标 | 与资源页同一真实工程及规范；原任务只读查看 | ai-resource-read-ui、resource-config-production、ai-jobs-read | 同上；inspect/enqueue/run/select/import/export-variant仍未在本轮恢复 |
| 知识库 | 真实列表/检索/原文；问答逐次确认、原引用文本、续问/新会话、UNKNOWN保护 | knowledge-read、knowledge-conversation、local-service-operations | 指定库/问题的实际模型与会话回执；不能把fake回答当真实回答 |
| 模型服务 | 启动器可达与确认关闭；不推断Comfy/GPU健康 | local-service-operations、knowledge-read-ui | 实际启动器关闭回执；模型start的LAN/代理风险另待审批 |
| 服务状态 | API响应、逐工程Creator/Bridge、知识/模型探针；Comfy详情未由同源提供 | service-status | 有效登录、成功/部分失败、返回时间、真实状态；禁止以探测未达断言进程退出 |
| 工具清单 | 读/导出/本地编辑保留；真实创建/更新/整批导入/分配/普通删除逐次确认 | tool-presets-read、tool-preset-drafts、tool-presets-write | 指定非生产测试预设、持久文件与工程范围回读；旧接口无CAS，不强制删除回退full |
| 图片素材 | 原独立审阅宿主保留；正常Companion没有通用Owner字节导入及保存provider | image-review、guarded bridge既有回归 | 独立宿主合法装配与Owner供图接口；reference-upload不能代替；不继续搜索采集开发 |
| 历史、帮助、关于、日志 | 真实来源/能力、原静态正文/资产；版本统一1.3.171 | help-about-navigation、legacy-v148-content、ui | 页面/剪贴板/原图资产显示，不把兼容基线当实时宿主版本 |

## 必须保持的负向验收

- 只读构建不注册保存、上传、问答、服务操作、工具writer、Python任务读取；普通Picker保持自身认证边界。
- 构造/注册不发写请求。任务读取只由明确点击触发，无轮询、GPU、批准或导入。
- 工程ID相同而路径变更、登记来源替换、A→B→A、离页和晚回执都不能写入另一个工程。
- 刷新服务状态不释放Creator/setup的UNKNOWN；刷新知识状态不清问答UNKNOWN或会话；逻辑取消不放开未结束I/O。
- 工具更新无法保证服务端并发CAS，不能用前端冻结制造原子性承诺；在用删除不发送confirm=true。
- 只显示已核受控错误，不将任意后端路径/token/HTML拼入URL、脚本或复制摘要。

## 视觉证据边界

本轮没有可用的dot云浏览器能力；现工具只提供用户电脑CUA，未在本任务调用。此前被拒Chromium路径和共享依赖CSS读取未重试或绕过。父级记录Windows浏览器工具MXC错误仍阻塞实际视觉验收。这里不包含截图，也不声称完成像素、移动端布局、CSP、原生文件选择或多标签实测。
