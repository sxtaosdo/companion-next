# 知识库只读模块并行核对（2026-10-19）

结论：旧知识库列表、详情、文档元数据、切片、原文入口已接线；本轮源码与离线定向验收通过，未发出真实知识请求或启动推理。**keyword=unverified 是状态展示，不是检索入口的禁用保护。当前不能证明该检索不会触发向量/推理，因此没有点击或调用真实 search。**

基线为主会话建立的 `checkpoint/next-parallel-20261019-47f310e`。实际模块执行者为 `/root/next_knowledge_read`，主会话统一集成。本轮只新增两个测试文件中的6项回归及本文，没有修改业务代码、共享后端、worker、凭据、服务、界面流程或 Git 索引。

| 核对项 | 本轮结果和证据 | 真实未验边界 |
| --- | --- | --- |
| 旧入口对应 | 旧 `cocos-mcp/web/src/knowledge-page.ts` 的 `bindKnowledgeAgentTools` 使用 kb/list、kb/view、doc/list、doc/view、doc/download、chunk/list；Next `src/adapters/knowledge-read.ts` 固定同源对应路径，显式用户动作调用 | 不把历史 reader 元数据200扩大为正文通过 |
| 文档详情和正文 | doc/view投影为文档元数据/description；切片提供受限content；真正原文由doc/download返回。Next原文以惰性文本显示，二进制仅元数据 | 未读取、记录或存储真实标题/正文；不把metadata当全文 |
| 分页/截断 | 旧后端 `knowledge-adapter.ts:345` doc/list schema只有kbId/keyword/limit；chunk/list只有id/limit，无page/cursor。Next保留truncated，并明确文档列表无分页，切片仍有未返回内容 | 完整分页不是现有同源合同，不自行增加UI/后台协议 |
| 来源切换迟到 | store同步watch所有输入，actionVersion/epoch/provider身份共同拦截旧响应。新增四项覆盖文档列表切KB、详情/切片/原文切文档；即使provider忽略AbortSignal，旧内容不回灌 | 离线注入provider验证，不是生产网络时序观测 |
| 原文副作用/上限 | 旧后端download创建companion-kb临时目录，finally清理；Next说明该行为，最多1MiB预览，无浏览器保存。既有测试覆盖二进制、HTML惰性呈现、超限/取消 | 未执行真实download；取消不证明远端清理完成 |
| keyword入口 | `KnowledgeReadView.vue:16,47` 的disabled条件为provider/busy/非空query，不依赖retrieval.keyword。新增UI测试确认unverified时输入非空仍可点击，但没有自动请求 | unverified不能称为阻止检索，也不能当成纯关键词模式已确认 |
| 无推理证明 | 当前共享可读源码 `cocos-mcp/mcp/src/companion/knowledge-adapter.ts:244` 将search交给CLI `search chunks`，没有显式`--no-vector`；`:515` cliArgs仅追加format/profile。生产worker可能有独立构建差异，此处不推断实际运行路径 | 现有源码不足以证明无向量/无推理；本轮真实search=0，不恢复模型实验 |

## 实际验证

- 首轮既有三组回归：3文件109项通过，2026-10-19本机17:54:18开始，11.71秒。
- 新增六项后相同定向命令：`node node_modules/vitest/vitest.mjs run tests/knowledge-read-adapter.test.ts tests/knowledge-read-store.test.ts tests/knowledge-read-ui.test.ts`；**3文件115项全部通过**，本机17:55:13开始，2.82秒（本机时间带+08:00）。
- 最初受限环境因Vite配置临时缓存EPERM未进入测试；随后按审批在正常宿主执行离线测试成功，没有新监听或服务启动。
- 新增测试位置：`tests/knowledge-read-store.test.ts` 的 knowledge document source generations；`tests/knowledge-read-ui.test.ts` 的 knowledge bounded read presentation。所有新增内容均为合成fixture，不含真实知识数据。
- 未打开浏览器、未访问P1060、未做ask/chat/sync/index/import、未读凭据、未提交/部署。本lane已执行 vue-tsc --noEmit（退出0）及两测试文件 git diff --check（退出0）；主会话统一交付。本lane不将受控离线结果表述为真实UI或生产内容验收。

未发现需要在已批准旧只读合同中立即修改的业务缺陷，因此没有为制造变更而改产品代码。检索无推理安全性和真实正文读取继续明确标记未验证。
