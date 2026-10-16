# 逐路由正式化审计（1.3.171）

基线 c325b41e / 0.1.20。用户要求服务状态真实版，并检查全部类似临时页面；审计不把前端可点击或 fake 测试当成实机完成。

| 入口 | 020 实际数据/功能 | 本轮处理与仍缺的实际链路 |
|---|---|---|
| `/overview` | 真实工程登记、Creator 状态/版本；库存与验收未知 | 保持真实工程上下文；没有库存/验收接口时不造数量 |
| `/projects` | 核心工程动作、登记/setup、日志/calls/SSE 已接 | 保留；Dashboard/目录选择/scaffold/Preview/Profiler/诊断/独立 MCP 仍未迁，原 v148 源存在，非缺整套合同 |
| `/resources` | 第1步仅规范读取，第2–6步空态（020基线） | 第1步复用正式规范编辑/参考预览/单独上传；第3–4步接原任务历史/状态/候选只读回收。生成/批准/导入和运行仍须独立接线及真实验收，不用本地计划替代工程数据 |
| `/ai-icons` | 配置读取/参考预览真读；编辑writer未注册正常工作区 | 正常工作区注册已有保存/上传，两个入口共享工程身份/同弹窗/UNKNOWN；不自动写入 |
| `/knowledge` | 查询/原文真读；问答sender仅专用构建 | 正常工作区接已有问答，逐次确认；真实工程切换隔离会话；保留CLI/认证闭合错误类别。Agent问答、同步未迁 |
| `/knowledge?tab=models` | 仅启动器可达状态 | 恢复有完整证据的状态及关闭启动器；原启动因LAN及条件性8092代理风险未开放。知识服务独立恢复原启停并逐次确认 |
| 工具（`/help?topic=tools`） | 目录/范围/导出真读，编辑导入仅页面草稿 | 恢复原宿主持久合同；每次确认/UNKNOWN/旧接口无hash限制。关联删除会回退full，不自动强制删除 |
| `/image-assets` | 独立图片宿主已接审阅/保存，但正常Companion无provider；旧search/URL清单不是Owner本地字节导入 | 两宿主认证不同，不能互换token/cookie。Owner字节导入+正式宿主保存合同待补；停止新增搜索采集功能 |
| `/services` | generic snapshot未在正常模式注册，三卡占位 | 改真实Companion登记/API证据、逐工程Creator/Bridge、知识服务/模型启动器探测；Comfy详细健康只在8090原启动器，同源未投影。失败清空旧成功，不改工程UNKNOWN屏障 |
| `/history` | 旧v133原型文案与generic连接误报 | 改当前前端版本、已核参考、实际宿主能力与登记读取，不冒充工程版本历史 |
| `/about` | 图标/二维码/复制是真功能；草稿/连接描述过时 | 采用实际工程来源/Creator已返回版本；剪贴板不包含路径/token |
| `/help` | 原帮助真实正文/复制，部分当前能力说明过时 | 同步能力和Owner供图范围；原文与实际支持边界分开 |
| `/changelog`、`/migration` | 真实静态信息页 | 同步本轮实际能力；v148参考与v150指定接口核验不混称 |

## 确切剩余边界

1. 已核 v150 的 15 个图标操作、原 facade / persistent queue / 单次 Comfy 提交 / 候选 / 窄 importer 闭包。Next 本片恢复任务读取；生成、批准、导入、尺寸导出还未迁入，不能再笼统称原服务不存在。当前运行选择的 studioRoot/pythonPath/nodePath/cliPath/store/lease/mode/endpoint 与相关文件哈希、Pillow 尚未证明；合同存在不代表现场可执行。
2. Owner 供图片字节的审阅保存，以及正常 Companion 与独立图片审阅服务的合法同源装配仍缺。reference-upload 仅保存参考图，不是任意资产/candidate/Creator 导入；X-Review-Token 与 Companion Cookie 不能互换或搬运。
3. 知识原 start 已核固定 loopback8081、原进程 Bypass 参数、读取既有 JWT 到 Process、写日志/PID/摘要，源码沿旧 route 每次确认，不复制秘密脚本。模型原 start 会监听0.0.0.0:8090并可能补启8092 LAN代理，未开放；停止只结束启动器，不保证所有模型退出。Comfy 细状态需要受限同源投影，不能失败转队列0。
4. 严格部分 setup 受活跃任务复用限制，前端 false 不能撤销旧 true；需后端可核选项/fencing。工具预设更新无 expectedHash；不伪造并发保证，关联预设删除也不发 confirm=true 强制回退full。
5. 知识全局 writerEnabled 不能授权逐来源同步；v150 无逐来源 approved/enabled/writerReady，原入队不等于索引完成，本片不开放同步。
6. 实机视觉、文件选择/下载、真实会话/状态/保存/问答/服务动作逐项验收仍待完成，不由 fake 测试替代。

依据：2026-10-15 原维护只读 v150 合同（bundle SHA256 39e88c9045e5d8266b059ce2b1ceb48cf522c5d0afc5f4596658c4545ae6641e）；最后允许状态证据为13:06:34 UTC，本片没有新增运行状态断言。

## 旧自有源已存在、后续可继续的保留项

`v148-host-reference` 中 http-server、tool-preset-store、knowledge-adapter、ai-launcher-client、原UI等均可复用；不再用历史文档的“未取得后端”阻塞这些源码工作。Preview/Profiler/诊断/目录选择/scaffold/MCP等需继续逐动作核语义与当前宿主差异，不能纳入“全迁完成”。
