# 知识库问答源码（0.1.12）

## 范围与运行授权

已实现当前知识库提问、显示回答和引用、沿用返回会话追问、显式开始新会话、停止等待，以及逐次确认和未确认结果保护。原检索/列表/文档功能保持独立；本片不含自定义 Agent、同步或服务启停。

这是 dot 中的源码及 fake/jsdom 测试，本轮没有发送真实问题、调用模型或操作 Windows。新增 `companion-knowledge-chat` 独立源码构建，输出 `dist-companion-chat`；部署需单独批准。旧普通 / Picker / `companion-readonly` / `companion-config-editor` 均不注册发送。问答构建也不注册配置保存/参考上传 writer。旧静态包、原静态生成脚本与后端 binder 没有放行新接口。

精确 loopback 与构建名只是运输条件，不证明原宿主授权、用户会话或此次发送获准。实际发送仍依赖原已有同源认证，每条问题需用户核对并单独确认。服务会使用原配置的模型，可能产生模型调用及服务端会话；页面不能凭启动器状态推断模型就绪或免费。

## 已核原合同

来源为已取得的自有 v148 HEAD `f6dcac804fb9ad806e8094594c7820a71cfab7b8`，没有新 GitHub 方案或依赖：

- `mcp/src/companion/http-server.ts` SHA256 `d4cf830523dddb37217ccec980272037330060f7d4effc567b56d86366db5184`，524–577行：仅固定 `POST /api/knowledge/chat`，无query，HTTP body≤4096字节，原session/Host/Origin检查，断连传播AbortSignal。
- `mcp/src/companion/knowledge-adapter.ts` SHA256 `03a25fdc5a5c30329f675f4322befa811a0687559bd708dfeae81541f814d086`，195–203、400–407、427–435、528–545行：严格请求、固定CLI调用、对话错误映射、固定回答投影。原测试 `knowledge-adapter.test.ts` 276–280行明确覆盖 `CHAT_UNAVAILABLE/403`。

请求只有 `{query,kbId?,sessionId?}`。问题trim后1–512个JS字符，不以`-`开头、不含C0/DEL；ID为`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$`。界面不在dispatch时再解析默认知识库：输入为空时只能采用已成功读取的默认ID，并在确认/请求中显式冻结该ID。原接口没有工程ID字段，页面工程变化仅用于本地隔离，工程路径/名称/配置不会附入请求。

返回投影：`schemaVersion='companion-knowledge-v1'`、`answer`（≤12000字符）、安全`sessionId`、`references`（≤20项，仅可选kbId/chunkId、各≤80字符）。原合同允许空回答、空引用对象和重复引用。引用字符串没有安全ID保证，前端只做文本显示，不转链接、不查询、不拼URL、不据名称推断读写性质。服务返回HTML、URL及用户问题都由Vue文本插值/`pre`显示，无`v-html`、iframe或Markdown HTML解释。

适配器显式注入fetch，仅固定same-origin Cookie POST，redirect:error、no-store；不读取/保存/转发token，不接受base URL。网页等待上限75000ms、响应≤2MiB、≤4096块、fatal UTF-8，再做JSON结构/白名单投影。原CLI预算60秒/1MiB与前端预算不混同。

## 状态、失败与上下文

- 每次先准备冻结预览，再单独勾选确认；prepared对象身份、revision、问题、知识库、旧session、provider与本地范围均在发送终点核对。预览不等于授权，同一对象发送后立即消费，重复点击没有第二次请求。
- 每条记录保留请求问题、原目标KB、来源、原请求会话、返回会话、结果状态与是否脱离当前上下文。只有实际校验通过的回答才填写返回会话；旧会话不能冒充新回执。
- KB / provider / 读取身份 / 页面工程元数据变化、离页或显式新会话撤销确认并隔离旧记录。A→B→A也不能把旧回答采用为新会话。问答API没有回显KB/工程，归属靠冻结上下文和请求代次，不能读取当前表单反推。
- UNKNOWN保留原session和记录，不自动重发/续发。用户核对风险并明确开始新会话后才可另行准备；这不会撤销旧问答，重复问题可能再次调用模型。没有幂等键、结果回读端点或服务端历史删除接口，不能自行发明。
- `CHAT_UNAVAILABLE`合并了认证拒绝与上游不可用，并可能返回403。它不等于入口拒绝，也不能据此把检索/列表全部标为无权限。只接受原source可证明的精确前置拒绝格式；其它HTTP/CLI/网络/坏JSON结果保守为未知，不反射诊断或问题内容。
- 取消只停止前端等待并请求abort，不证明模型没收到。底层fetch、read、cancel各Promise全部settle之前保持单飞锁；换来源/新会话不能释放此锁。`waitForIdle`若失败保持阻断，已收到的成功回答不降级成未知。
- 客户端运输排空不等于后端子进程或远端模型终止。即使原HTTP已经结束，UNKNOWN也不自动消失；无法保证关闭页面或刷新撤销服务端行为。

## 本地数据保留

问题、回答、session仅留Pinia内存，不写项目、日志、localStorage或sessionStorage。离页保留输入及只读记录，但撤销会话续问绑定；刷新/关闭会丢失本地记录及UNKNOWN提示，因此不能靠刷新把旧发送当作未发生。无自动恢复发送。

最多20条、总2MiB，每次预留256KiB预算。达到预算时禁止再发，允许用户明确清理本页已收到回答 / 明确拒绝 / 未发出的记录；UNKNOWN和在途记录不自动驱逐，也不被该清理按钮移除。此动作不会删除服务端历史。记录全部未知时可继续阅读但不能通过自动清理腾出发送空间。

## 文件与验收

- `src/domain/knowledge-conversation.ts` / `src/adapters/knowledge-conversation.ts`
- `src/stores/knowledge-conversation.ts` / `src/components/KnowledgeConversationPanel.vue`
- `src/knowledge-conversation-integration.ts`，仅独立问答模式注册
- adapter/store/UI三份回归；原knowledge读取、帮助导航、四构建与static回归

最终计数和执行终态见 `validation.md`。真实模型、原会话、服务端存储与取消效果、浏览器视觉仍未验；fake不替代这些证据。未经批准不能把此问答构建放入旧只读静态目录或配置编辑部署。
