# 旧功能与失败路径增量（2026-10-19）

状态：源码候选已验证；共享网页部署另记。基线 a0fe818 / 1.3.173.118，工作区干净。仅新 Companion Next，与 cocos-mcp 原 UI 对照；不涉及 game-ops-admin、7470/7471。历史矩阵中的“缺失”先与后续交付核对，不将已补控件重复开发。

| 本轮实际模块 | 发现与修改 | 验证级别及证据 |
| --- | --- | --- |
| 工程登记 / 安装向导失败路径 | 登记已成功、工程列表慢回读时，用户改路径或项目后旧回调仍自动选中原工程。冻结本次回执、writer及表单身份；独立同步binding版本阻止reader/writer替换ABA及可观测label变化，不把自身列表刷新误当表单变更。原登记、安装、确认与lane锁策略保持。 | 新回归原代码失败；独立审查再发现writer ABA，先红后修。最终工程UI42项通过，包含正常canonical登记、路径变更/ABA、项目ABA、writer替换/ABA、reactive-labelABA。 |
| MCP注册成功提示 / CLI交接说明 | 旧 web/src/app.ts:142的Cursor/Trae/Kiro/VS Code刷新或重开提示漏迁。恢复原文，仅附在匹配key且当前有效的成功回执。CLI复制说明区分复制按钮与已有明确外部交接按钮，未新增UI或协议动作。 | 新增10项定向假响应/组件回归通过；后项已知失败、UNKNOWN、错key、取消均保留前项回执并停止续发。没有真实注册、剪贴板写入或IDE投递。 |
| 资源原任务与读取链 | 根只读核对RegisteredProjectResources、AiTaskCreationPanel/state、AiJobsReadPanel/state、AiResourceReadView/editor及库存读取；工程绑定、取消和未知结果保护已有实现。本轮没有找到可证实的新增纯Next漏迁动作。 | 源码核对，不称真实资源流程新验收；既有96导入/Creator/Preview/Build证据复用，不重跑。 |
| Dashboard / 帮助关于 | 工程lane对照现有实现，未找到另一个有确切证据的漏迁；真实交互未覆盖部分继续标未验证。 | 只读审计，不因没有新补丁宣称全部对齐。 |

## 串行集成与审查

实际并行lane为 /root/project_failure_audit 与 /root/tools_handoff_audit；根独占Git、更新说明、归档、构建与部署协调；/root/reviewer独立只读审查。两个lane分别写原2文件和4文件，无共享写入交叉。源修改共4文件、对应测试3文件；没有改旧共享源码、原UI或生命周期。

初轮三文件100测试通过，类型检查发现新增测试的Promise返回类型推断unknown；已补明确返回类型。独立review另发现provider ABA竞态并修复，保留该发现；新增label夹具的readonly赋值类型错误改为仅测试用Reflect.set。最终根三文件102/102通过，并补正常回读自动选中断言后工程UI42项再通过，严格类型与workspace构建通过，仅既有大chunk提示。原始集成日志见[证据目录](evidence/safe-parity-modules-20261019/)；lane前红/后绿记录明确为工具stdout摘要，不冒充当时未另存的原始日志。独立review最终P2已关闭、无剩余P1/P2；建议的正常选择断言也已补入。审查未声称自己执行业务或根测试。

binding版本只能观察Vue实际通知的provider/connected/label变化；raw浅引用对象的label静默瞬时修改再改回不可观测，本轮不声称覆盖该情形。没有为此修改全局provider合同。

## 剩余具体动作及原因

- 知识库正向读取：Companion仍missing-auth，真实reader仅由用户本人按既有手工块配置；本轮不读取、解密、复制或注入。列表通过也不能替代关键词、原文、回答或同步验收。
- 持久MCP客户端配置、configureCodex=true的01/11组合：会改用户配置，本轮明确不执行；本次成功提示测试仅用假接口，未声称已配置真实客户端。
- 真实IDE投递：用户已明确批准Codex仅填入、不发送。本轮03:08 UTC前置检查发现剪贴板非空，按用户条件立即停止；仅检查剪贴板格式是否存在，未读取内容、未覆盖、未投递标记。当前PowerShell观察环境未找到可唯一确认的Codex输入框，不能证明其为空。须先由用户保持剪贴板为空，并在可观察的同一桌面会话确认目标空输入框；不把URI打开或用户先前确认当作当下接收成功。
- Agent/KB问答及模型启停/生成：仍按当前暂停，未调用；同步还需明确来源、目标和写入范围，当前writer/scheduler禁用，未发演练或执行。
- 图片窄宿主以外的搜索/下载、切历史/恢复/回收及Codex自动回收：已有分类与未开放白名单，不通过前端开关伪装旧Companion漏迁；若扩范围先方案确认。
- 原生目录任意树导航及其他未覆盖生命周期/长时网络范围：属于具体未验证动作，不改称缺实现或凭据阻塞；本轮不为补覆盖自动启动Creator、开系统窗口或重复已通过SSE/预设验收。

没有新的纯Next漏迁证据时不制造功能。仍不能宣称新版已全部验收对齐。未推送、发布上传、安装软件、改安全权限、启动新监听或独立模型实验。

## 用户追加要求

[知识服务恢复与接入说明](knowledge-service-restored-20261019.md)已改为简明中文，含步骤、预期结果、错误处理。唯一PowerShell命令块与原文逐字节一致，SHA256为288c243202cf19a9d1b2f89fc87d794490a2e19ccce2108a05457fa6b3e7cd92；仅修改说明，没有执行该块。

[Codex前置回执](evidence/safe-parity-modules-20261019/codex-empty-preflight.json)仅记录空值判断/窗口可见性，clipboardContentRead=false、inputContentRead=false、mutations=0。非空剪贴板按用户约束构成本轮真实阻塞；没有清除未知内容，也没有发送或创建任务。
