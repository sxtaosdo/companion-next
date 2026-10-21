# 添加项目：旧流程核对与 Next 候选

2026-10-21；用户要求添加项目完全照搬旧后台。本记录只证明源码与隔离测试，不表示正式部署或 Creator 实测。

## 权威源码与具体差异

旧实现为 `../cocos-mcp/web/src/app.ts`，HTML 为 `../cocos-mcp/web/index.html`。旧 UI 只读未修改。

| 项目 | 旧实现证据 | 原 Next 差异 | 本候选 |
|---|---|---|---|
| 入口及步骤 | app.ts2778-2841 / index.html334-360：来源→选工程→Dashboard 启动→选 Agent→完成 | 在选工程内先仅登记、预览、再次确认 | 默认添加使用同五步；路径选择只读工具范围，不先登记 |
| 路径与字段 | app.ts2787：自定义、Dashboard、新建、初始化；既有路径校验 | 原路径后必须独立登记才可进入启动 | 冻结原路径后进入启动确认；目录选择不登记 |
| 启动范围 | app.ts3222-3239：projectId 或 projectPath，startCreator=true、configureCodex=false | 原非严格全安装入口强制 true/true，并有五勾选与两次确认 | capability GET 后一次严格 path POST，显式 true/false；不先 POST /api/projects |
| Bridge/登记 | 旧启动按钮说明 Bridge/工程登记由 Dashboard 启动流程处理 | 新界面把安装接入当额外前置选择 | 属同一宿主任务内部阶段，无独立安装勾选或默认 Codex 配置 |
| 工具范围 | app.ts919、956-970、2834：启动前选；新工程 full，旧工程保留；任务完成后持久化选择 | 原 Next 在 Agent 步之后独立确认范围 | 启动前读真实范围；新工程默认 full，旧工程不改未显式改变的选择；完成并回读真实登记 id 后写所选范围 |
| Agent | app.ts3202 / registerSelectedAgents：默认全选，可跳过；单击接入所选 | 原需准备后再独立确认写入 | 默认添加使用既有客户端 store 的单次确认；保留收据和错误展示、UNKNOWN 门禁 |
| 反馈恢复 | 旧任务按原 operationId 查询，complete 后 Agent；失败显示 | Next 有额外安全 lane/UNKNOWN/请求清理保护 | 保留全局 lane、来源及标签冻结、严格实际选项校验、原任务只读恢复；未知 scope 写不重发 |

实际宿主 `parseSetupInput` 接受 projectPath，严格入口要求显式布尔值；复用现有 `/api/setup/options-v1`，未新增宿主 API。旧非严格入口仍保留给原维护代码，本候选默认添加不调用它。

## 文件归属与安全边界

新增 `ProjectAddWizard.vue` 与 `stores/project-setup-add.ts`，仅替换 `ProjectSetupWizard.vue` 默认添加按钮；原按已登记工程的维护入口保留。provider/domain 增加原严格端点的路径变体。Agent 组件增加仅新向导使用的 singleConfirm，ConnectionConfirmation 增加只显示收据的模式，不删错误反馈。

准备范围只读；启动前确认必须有可用的严格路径入口，且新工程/明确改范围时有范围写者。来源对象或原位 label 变化使预览失效或暂停已发任务。202 不当作 ready。原 operationId/path/options 未核实的结果不进入 Agent。接口未清理前不能释放 lane。新建/初始化复用原 scaffold provider，当前接口合同仅支持 Creator 3.8.8，未擅自扩展其他版本。

未触碰正式 32180、用户当前页面、原失败任务或 Creator；未部署、未重新提交任务。旧维护测试改为显式打开维护组件，默认添加由新增组件测试直接覆盖；保留原维护安全断言。

## 候选验证结果

八组 setup 定向回归 469/469：新增 store 10、默认添加真实组件 2，以及保留维护界面、原 adapter、options、store、recovery、completion。随后仅补新组件 dialog/form epoch 防迟到保护，新 store+组件 12/12 再过，vue-tsc 与 git diff --check exit0。两个原共享小组件原文件为 CRLF，任务修改统一为 LF；未改其余无关语义。未进行全站回归或真实浏览器/Creator 验收，不能把模拟通过当成正式用户任务已修复。
