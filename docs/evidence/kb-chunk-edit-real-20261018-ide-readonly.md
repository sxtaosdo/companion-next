# IDE交接剩余缺口：当前源与精确安装证据复核

范围：只读源码和既有证据；未启动应用、投递协议、触碰桌面或剪贴板、读取草稿正文/秘密、修改持久配置、运行测试。沿用既有18例离线一致与Cursor实机取消，不重跑。

## 已证明

1. Next src/domain/agent-handoff.ts:3–7 固定生成 cursor://anysphere.cursor-deeplink/prompt?text= 或 codex://new?prompt=，encodeURIComponent编码；生成URL超过8000字符时用粘贴提醒占位并标记clipboardOnly。该fallback仍会打开含prompt的协议，不能用来绕过Codex草稿覆盖风险。
2. AgentHandoffButtons.vue:9–19：明确点击后先writeText完整文本，成功才open；失败不启动Agent。来源/文本/上下文变化或卸载后不再继续原交接。UI回执只称“已尝试打开”，没有接收确认。main.ts:65实现是navigator.clipboard.writeText和window.location.assign，没有空白目标检查、窗口ID、收件回执或自动submit。
3. 本机Cursor实际prompt处理先显示Create Chat/Cancel，取消分支在createComposer和填草稿前return。实际无害marker弹窗收到后Cancel已通过，不能把该结果扩张成创建聊天、业务材料执行或模型响应通过。
4. 当前冻结的Codex安装证据对应26.1013.4894.0：oD destination new -> gD/_D读取prompt -> main newThread导航/，state带prefillPrompt -> renderer Kxd -> setPromptText。该链不直接submit，无需笼统解除模型暂停。
5. setPromptText使用replaceWith(0,doc.content.size,content)，会替换整个目标composer内容。虽然renderer内部支持prefillPromptOnlyIfEmpty，OS parser未转交它；协议主窗口分支使用ensureWindow({forNavigation:true})，未调用内部createFreshWindow。

## 没有可保证空白目标的现有受支持入口

已核查的完整route构造仅转交mode/originUrl/path/projectId/prompt/browserUrl/browserTabId/browserActive。添加windowId/newWindow/onlyIfEmpty等未知query不会获得保护。/threads/new与/new同落newThread；新开普通窗口不保证协议投往该窗口。path/projectId会改变项目选择甚至登记，不是草稿隔离，不用于最小验收。browserActive=false具有特定backfill用途及约束，也不是空白draft入口。

手动在用户确认的空白composer粘贴是既有交互，但不证明OS协议投递；不能用它充当这项实机接收闭环。新造empty-only、窗口目标或自动新建任务属于扩展接收合同，不在本轮自动实施。

## 仍未验证

- Codex精确new?prompt路由在当前运行用户实例收到marker；已有注册和源码证据不能代替实机。
- 从真实Next业务材料按钮，经过浏览器剪贴板和OS激活，到正确IDE目标的完整端到端交接。Cursor取消验收只是接收确认分支，不包含业务执行。
- 长文本真实接收/粘贴结果；已有离线长度和编码测试不等于IDE最终收到完整材料。
- 客户端MCP持久注册和客户端刷新工具列表是另一条链，不由prompt接收证明。

## 最小具体确认

“允许在明确选定的Codex主窗口空白首页输入框验收一次，仅填入COMPANION_PROTOCOL_RECEIPT_ONLY_20261018，观察后删除该marker，不发送任务；由用户先自行保护原草稿并确认目标为空。”

这项确认针对草稿目的地和恢复方式，不是解除模型暂停。若执行真实Next按钮，还要明确允许本轮无害marker覆盖系统剪贴板；不读取原剪贴板内容，不为恢复而复制敏感数据。若目标空白性无法可靠确定，保持未投递；不能靠新开普通窗口或未知参数猜测安全。

操作恢复仅删除本轮唯一marker、回到原窗口/页面；原有草稿由用户已确认的保护方式恢复。不自动读取/保存用户草稿，不承诺任意富文本/附件可由纯文本恢复。

当前既有权限足以完成本报告、源码核对和复用已过证据；没有另一项未验且可在不碰窗口/草稿/剪贴板下证明实机接收的步骤。

## 精确证据

- companion-next/src/domain/agent-handoff.ts SHA256 2a3fa48d1acd8d7f789df980492840c4c1a4b9042b0ae56da169a9d80574024b
- companion-next/src/components/AgentHandoffButtons.vue SHA256 3004dd63354b731058d70828ad16fbc59b3e44bb56041b0bbc84969cae85ab1b
- companion-next/src/main.ts SHA256 91044ff66cec736893dbfd2f9cf61e8c58f30f4af8e949310d41ee2239e7f81b
- Temp/companion-parallel-clients-20261018/codex-nonoverwriting-route-check.json：bootstrap完整gD/_D与主窗口路径；bundle SHA a8fdd0feea4448d66037df9f264aade773f1405299bbccf2418544e4b619b41b
- 同目录/codex-targeted-routes.json：oD解析及newThread dispatch，main SHA c8a2af504b21314fa6a64ad1b4ec83dbad80033ede902caf9978fd9c74a2c175
- 同目录/final-installed-route-proof.json：Cursor确认取消分支与Codex Kxd，renderer SHA c70d95da34ba7e5962a559dbf68d0102d10b4b47b877f5d9933629bb5a1f3a10
- 同目录/codex-setPromptText-definition.json：字符偏移13145275，完整replaceWith路径
- companion-next/docs/native-ui-receipt-20261018.md：Cursor实机接收取消，Codex未投递的真实记录

以上安装bundle身份为冻结证据，不宣称本轮重新校验了当前安装版本或运行实例。源码摘要为本轮实际读取。
