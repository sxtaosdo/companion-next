# Companion Next 对齐矩阵：运行包更新后收尾（2026-10-19）

**尚未完全对齐。** 本表覆盖旧开发者后台21类功能，区分限定实测、隔离验证、缺失和未验证；占位、按钮可见、配置回执均不等于业务完成。此前矩阵及逐项历史路由见[原21项矩阵](parity-default-project-20261019.md)，本表只更新当前结论，不覆盖历史证据。

当前后台：`9b8f979 / 0.3.147`，PID10820，epoch `7601ac9d-a500-46d8-8db0-9a0f28e7569c`。Next已部署静态仍为`ecabe7e / 1.3.173.131`；本轮只有测试/证据/文档修改，没有重新构建或部署，没有再次停止后台。

## 重要差距

1. **VS Code登记格式有缺陷（P2）**：当前`vscode-configurator.ts`委托Cursor，将`mcpServers`写到`.vscode/mcp.json`。该路径要求顶层`servers`；根`.mcp.json`才使用`mcpServers`。[VS Code官方配置说明](https://code.visualstudio.com/docs/agent-customization/mcp-servers)（本轮读取）。原VSCode测试及共享测试断言相同错误格式，故93项通过仅证明回滚等内部合同，不能证明原生VS Code发现或连接成功。用户级`~/.vscode/mcp.json`也不能当作已验证的官方profile配置路径。
2. 五客户端真实持久化/连接、安装01/11仍未完成。当前五项回滚缺陷已修复并装载，旧5项预期失败只保留为历史复现，不再列成当前未修复。
3. 图像Owner旧页面的批量/合并/删除/历史/回收等未在当前窄入口迁入；Agent/问答/同步写入及模型工作继续暂停。调用记录非空详情和50条以上分页、日志清空及部分异常分支仍未验。

## 逐项矩阵

| # | 旧功能 / Next入口 | 已实现且验证的范围 / 证据 | 缺失或未验证 |
| --- | --- | --- | --- |
| 1 | 帮助/关于/版本/历史；`/help /about /changelog` | 已迁入；原文、导航、版本取值限定真实页面通过，见原矩阵 | daemon/Creator版本不由页面版本代证；不是全部业务验收 |
| 2 | 概览默认首个真实工程；`/overview` | c44d847部署后真实7工程列表下默认首项/明确第二项及未知/空/重复参数通过；移除保护有隔离回归 | 未读取字段仍显示未知 |
| 3 | 工程列表/状态/筛选/折叠；`/projects` | 既有状态API与页面限定实测；手动折叠及基本筛选 | 未覆盖全部异常状态与所有时序 |
| 4 | 添加/导入/登记/脚手架；SetupWizard | 隔离工程登记移除、原生目录及脚手架既有实证 | 无效目录、权限、部分写入失败未全实测 |
| 5 | 五步安装/旧配色/完成用法 | 00/10已有真实验收；01/11受控8项与Next选项合同21项；当前只读options-v1支持strictOptions | 01/11真实客户端持久化未验，不执行Creator安装 |
| 6 | Creator启动/聚焦/停止/重启 | 既有聚焦、安装及预览切换恢复限定实证 | 异常/未安装/外部OS退出未全验；本轮不启动或停止Creator |
| 7 | 打开目录/移除登记 | 既有真实只读导航及隔离工程移除证据 | 不等于删除工程或停止Creator |
| 8 | Preview探测/打开/刷新/Profiler | 原正式Next主链和848入口既有限定实测 | 各失败状态、运行工程刷新效果未全验；本轮暂停Creator |
| 9 | 日志筛选/刷新/暂停/滚到底 | 既有真实日志；4次真实SSE/断连恢复/来源筛选/停止限定通过 | 长时间/高频边界未验，无协议事件重放保证 |
| 10 | 清空/导出/诊断 | 导出、诊断已有真实证据 | 实际清空DELETE未执行，需先明确可清数据范围 |
| 11 | 调用记录/全部失败/摘要/分页 | 原历史读取82项保留；本轮真实空记录、limit=50与status=failed、刷新、单次自有请求中止及恢复通过；[UI证据](evidence/post-host-20261019/calls-calls-ui-proof.json) | counts缺键保持未知；非空详情、真实失败排除成功、>50分页及并发未验；未造记录 |
| 12 | 局部实时更新/跨页恢复 | 既有有限真实SSE恢复与停止；保留UNKNOWN显示 | 不承诺事件零丢失或长时连续全部验收 |
| 13 | CLI使用/IDE交接 | 既有协议预览与原生入口；本轮原安装CLI `daemon inflight`只读成功 | 交接预览不是客户端接收/执行；未执行真实Codex CLI |
| 14 | 五客户端MCP登记 | 装载包7模块逐SHA匹配09c；抽取原代码跑原5份测试93/93正常通过（无skip/xfail）；[汇总](evidence/post-host-20261019/client-regression-summary.json) | **VSCode格式缺陷未修**；真实五客户端配置/发现/连接均未验。JSON为Temp合成文件，Codex为fake exec |
| 15 | 工具目录/范围/预设CRUD导入导出 | 既有真实摘要导出、静态/隔离写入合同 | 覆盖/导入冲突及所有客户端实际生效未全验，无旧协议CAS保证 |
| 16 | AI资源/变体/编辑/导入 | 已完成96变体PNG/meta/UUID回读、场景保存重开、Preview/Build/Smoke；3074d37/c80b890与既有证据 | 不重跑已完成链；GPU/本地模型任务暂停；可选依赖及失败恢复未全验 |
| 17 | 真实工程资源库存 | 既有单工程/单会话733条接口与UI对应实证 | 733不是当前全局常量；就绪前、未知字段仍需按实际显示 |
| 18 | 图片Owner窄入口 | 既有预览/持久选择/保存限定真实验收 | 旧图片页批量、合并、删除、历史切换、停用、回收恢复未迁入当前窄入口，不能算完成 |
| 19 | 知识库/文档/分片/原文/搜索 | 既有元数据200与真实关键词命中3/空0/越权403；[关键词实测](knowledge-sse-live-20261019.md) | 不再写“keyword未验”；embedding、索引写入、问答未验 |
| 20 | Agent/会话/KB问答/同步 | 源码接入和注入测试已有证据 | 真实Agent/问答、来源写入、队列执行未验；模型/写入继续暂停 |
| 21 | 知识服务/模型启停/原页面 | WeKnora恢复已有独立证据；原生入口和状态接口已接 | 本轮不重新探测模型，不做启停/切换/GPU推理；running不能当作推理成功 |

## 本轮测试与保护核验

- **当前后端93/93**：从实际安装map抽取7模块，源码SHA匹配09c；5份测试保持原bytes并与9b8/09c绑定。四JSON客户端使用默认原子提交路径但仅写合成Temp文件；Codex仅fake exec。验证前后安装包、抽取源码、测试副本SHA不变。当前运行身份由根会话只读GET及安装文件SHA绑定，[source bindings](evidence/post-host-20261019/client-source-bindings.json)。这不证明原生客户端接受格式。
- **Next定向82项**：77项普通通过+5项历史预期失败；包含历史ccc复现与project-connections/setup-options合同。修正历史测试误绑“当前安装包”的问题，改读字节校验的升级前归档；所有旧SHA pin和5个it.fails不变，不能把它们移到新包假装成功。[输出](evidence/post-host-20261019/next-targeted-tests.txt)。
- Next `vue-tsc --noEmit`退出0；[类型检查记录](evidence/post-host-20261019/next-typecheck.json)。
- 调用页仅自建headless Edge/pipe，无新监听；最终18次页面GET尝试，其中包含一次自有GET中止。定位准备共6次会话登录POST，业务POST/DELETE=0，未造调用，用户窗口未触碰。截图遮罩覆盖部分统计，精确值以JSON和脚本为准。自建浏览器已关闭。原始calls-RESULT.md将18次尝试误写为18次成功，原件保留供审计；以proof.reads及本段更正为准。
- [前](evidence/post-host-20261019/host-before.json)/[后](evidence/post-host-20261019/host-after.json)核验：PID10820/epoch一致、OPEN；nativeAwaiting/Uncertain=0、历史UNKNOWN=2、quiescenceEvidence=0；9张业务表、原仓库22项修改和308个其他运行文件不变；真实客户端文件元数据不变，Codex真实配置未读；未再次重启服务。
- 本轮没有修改旧WindowsCompanionUI/生命周期、安全权限、真实客户端配置；没有Creator/模型、7470/7471、P1060、发布/上传/推送。

## 下一步最小范围

先在独立检查点修复VSCode专属`servers`解析/写入，复用原子提交层和原回执；补正确结构、幂等、已有servers/inputs保留、同名冲突、坏结构拒绝、部分写入与恢复测试；Cursor/Trae/Kiro继续断言mcpServers。不要自动迁移/删除历史mcpServers，也不把用户级~/.vscode/mcp.json视作已确认官方路径。本轮未修改该后端行为，也未重新部署。

格式修正通过后，最小真实验收需单独明确：仅登记已有Temp工程`companion-closeout-safe-20261018/next-registration-only-fixture`（当前未登记），只创建其`.vscode/mcp.json`（当前不存在），通过已安装VSCode打开该工程，确认原生发现/连接。工程登记会写Companion登记表；配置回读成功仍不能代替原生连接。不要触及用户级或Codex配置、Creator、模型或其他工程。此范围尚未执行。
