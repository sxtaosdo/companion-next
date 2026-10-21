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

## 默认入口完整回归收口

完整回归揭示原候选的真实遗漏：空登记工程入口未转发新向导、目录能力缺失仍显示选择按钮、Dashboard 状态/中文错态/关闭取消丢失、scaffold 历史与异步来源保护不足。先仅修实现，原五组测试恢复到 123 通过、12 失败；证据 `Temp/add-parity-source-only.json`。剩余旧控件阻塞逐项核对后，才把已取消的登记/二次创建确认转换为默认 Next，并保留原安全断言。

原四文件批量修改被自动审批拒绝，未执行；没有拆批绕过。父线程审查了新实证与每个文件的精确差异后，新的 directory、scaffold、discovery、layout 单文件窄动作分别获批。未创建共享虚构能力夹具、未 mock canStart、未把这些默认入口 case 转向维护入口。必要测试能力使用原 decoder 接受的标准 core/full 元数据。

目录 22/22、Dashboard 17/17、scaffold 43/43、布局 19/19 均通过。scaffold 编辑撤销仍在真实组件层验证：读取范围进入启动确认后保留旧启动按钮，返回修改表单，旧按钮也不能发起任务；原 lane、cleanup、迟到、导航、来源变更和 no-write 断言保留。

最终相关九文件合并 212/212，vue-tsc 与 diff 检查 exit0；结构化报告 `C:/Users/33272/AppData/Local/Temp/add-parity-final-focused.json`。原维护界面测试独立保留；新默认入口继续覆盖真实 native/scaffold/discovery 行为。父线程恢复的示例入口也已在该组合回归中通过。本代理未运行全量、未部署或操作用户服务/Creator；发布及真实验收由父线程统筹。
