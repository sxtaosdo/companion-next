2026-10-18 聚焦最新结果：宿主修复已按原guarded流程部署，真实Next点击后OS前台为原Creator并恢复。知识身份未注入，Creator、模型及WeKnora未重启；Companion daemon按授权guarded重启。详见[聚焦交付](windows-focus-fix-20261018.md)、[当前矩阵](parity-remaining-safe-20261018.md)与[知识库只读复盘](knowledge-retrospective-20261018.md)。下方历史状态保留。

# 原生窗口与 IDE 接收续验（2026-10-18）

状态：Accepted。范围仅新 Companion 对旧 Companion；基线2942ed1。桌面操作由根串行执行，客户端路由/知识身份源码由既有子 agent 只读并行查证。不是整张矩阵完成报告。

| 项目 | 本轮结果 | 证据及限制 |
| --- | --- | --- |
| 原生目录取消 | 通过 | 真实Next按钮派发；观察daemon20116直属PowerShell子进程12028的原生#32770窗口，向该窗口原生Cancel控件发送命令；200 cancelled=true，输入值及登记表未变，原前台恢复。 |
| 原生目录确认 | 通过默认桌面目录确认 | 子进程15528、窗口2754368；原生OK后200返回C:/Users/33272/Desktop，输入准确回填，未登记/安装。只覆盖默认目录确认，不泛化为任意层级树导航已验收。 |
| 打开目录 | 通过真实Explorer | Next确认后API200；观察到新Explorer窗口1377454，Shell LocationURL对应既有96变体工程规范路径；只关闭该新窗口。 |
| 聚焦Creator | 未通过实际前台切换 | Next原生聚焦按钮API200，但OS前台仍Codex19688，非Creator18252。该次来自独立headless页面；未证明真人桌面手势同样失败，也不能把200当聚焦成功。 |
| Cursor协议实际接收 | 通过接收后取消 | 使用与Next生成函数一致的已注册cursor://anysphere.cursor-deeplink/prompt?text=COMPANION_PROTOCOL_RECEIPT_ONLY_20261018。应用窗口264344中UIAutomation观察到该唯一标记和Create Chat/Cancel；仅调用Cancel，随后标记弹窗消失。未点击创建聊天、填草稿或发送。 |
| Codex协议实际接收 | 未发送，保护已有草稿 | 安装代码确认codex://new?prompt=仅prefill，没有该分支自动submit；但setPromptText替换整个目标草稿，且URL链未设onlyIfEmpty。当前无法证明独立空白目标，不对用户已有Codex窗口投递。此边界不是模型权限不足或协议未注册。 |

## 自动化与真实交互的区分

目录确认第一次尝试用外部BFFM选择消息强制指向Temp目录；该方式导致原PowerShell异常退出/API500，自动化又遇到失效句柄。已撤回该方式，未据此认定正常产品按钮有缺陷。其后仅向真实窗口原生OK控件发送命令，默认桌面目录确认200并准确回填。保留失败证据，不称任意目录导航通过。

聚焦原宿主platform.ts直接忽略ShowWindowAsync/SetForegroundWindow布尔结果；Next现有回执明确只表示后台收到请求、不证明前台成功（src/stores/creator-operations.ts:90），本轮没有新增误导文案。缺少前台切换成功证据仍保留。未修改系统前台策略、安全设置或旧宿主原生聚焦实现；未为此重启共享服务。

Cursor证明的是本机已安装协议处理链确实收到文本并允许在创建聊天前取消；并非本轮从Next生成业务材料到IDE执行的全流程。原有18例新旧URL函数离线一致和受控按钮证据继续复用。实际启动Cursor可能产生应用自身日志/恢复状态，本轮未编辑MCP、客户端授权配置、凭据或协议注册。启动前Cursor进程/窗口均空；取消后只向本轮新窗口发正常关闭，最终无Cursor进程/窗口，原Codex、Creator、用户浏览器窗口均保留，原前台恢复。

## 知识库401的精确身份结论

1. Companion cookie已经通过，知识请求进入适配器后才401 AUTH_MISSING；不是Companion需要重新登录。
2. 8081原生网页Owner登录与daemon的WeKnora API检索身份不同；未检查用户浏览器Cookie/存储，当前网页会话有效性未知。现有实现没有将该Cookie转发到KnowledgeAdapter的桥接，已有网页会话也不能直接给Next补API身份。
3. 公开非秘密交接记载已有Owner批准的受限reader ID3：tenant1、仅shidai3-pilot（KB da1051a5-3fff-4198-ba55-017ea79df9c3）、retrieve、full_access=false、到期2026-11-08。10月15日元数据收据证明当时绑定验证通过；不能据到期日推断今天未撤销。无需默认新建密钥。
4. 仅验证既有reader当前有效性：需明确允许短时受控复用原保护身份，只请求reader-identity并检查ID/范围/有效期，不输出或持久化密钥；此步无需daemon重启、不搜索/推理/写入。本轮遵守不读取密钥要求，未执行。
5. 接入Next正向读取：现有daemon只在构造时捕获WEKNORA_API_KEY，无热加载setter。现实现需协调guarded重启现有Companion daemon，将同一受限身份仅注入该进程环境；无需重启WeKnora、停止Creator、启动模型、改全局环境或长期客户端配置。本轮未执行。
6. 最小数据范围先限定单一允许KB的列表/元数据（至多1个允许ID），不读正文、不跨库/租户。retrieve不自动授权Agent列表或问答；实际问答另涉及conversation能力、模型及会话写入。旧search未传no-vector的独立风险仍未解决，不因身份就绪运行搜索。

待确认动作应分别是：受控复用既有reader做一次身份元数据核验；若需Next正向验收，再协调daemon进程身份注入/重启；以及Codex独立空白草稿目标。未请求新建长期凭据或扩大权限。原暂停的问答/模型/同步仍不执行。

## 保护与收尾

原工程操作前后ready、PID18252、session e04e7299-680f-4109-a829-8cac07a51bd4相同；daemon仍20116且原epoch；projects.json恢复原字节、tool-presets.json字节未变。cocos-mcp、原游戏及96变体工程的HEAD/status/diff/index哈希与前轮保护基线一致（最终机器收据为准）。未关闭用户窗口，未启动Creator或新监听，未修改产品代码；本轮无新增代码部署需求。文件证据及SHA清单见docs/evidence/native-ui-20261018-*。

非秘密来源与冻结说明：[身份精查冻结记录](evidence/native-ui-20261018-identity-clarification.md)；公开交接为 [Owner-Cli-Handoff.md](/D:/services/weknora/cli/Owner-Cli-Handoff.md)，历史元数据为 [pilot-readonly-smoke-metadata.json](/D:/services/weknora/cli/evidence/pilot-readonly-smoke-metadata.json)（2026-10-15 04:04:12 UTC）及 [reader-boundary-metadata.json](/D:/services/weknora/cli/evidence/reader-boundary-metadata.json)（04:24:51 UTC）。构造时捕获身份见 [companion-daemon.ts](../../cocos-mcp/mcp/src/companion-daemon.ts) 197–200行；缺身份401及命令前置检查见 [knowledge-adapter.ts](../../cocos-mcp/mcp/src/companion/knowledge-adapter.ts) 446–461行。以上来源未作为新增凭据使用授权，也未把历史收据当作当前有效性证明。
