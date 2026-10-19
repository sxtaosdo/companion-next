# Setup 01/11 隔离验证（2026-10-19）

执行代理 `/root/next_project_help`。仅验证当前部署源码的编排与临时文件结果，**不构成生产01/11安装或真实Codex配置验收**。

已读根AGENTS/AI_CONTEXT、Next README及旧子仓规则，Next无独立AGENTS/AI_CONTEXT。Git根为 D:/code/shidai3/P8000/companion-next。未修改任何业务源码、现有测试、共享cocos-mcp文件或Git索引。

## 来源与实际执行

从已部署 `mcp/dist/companion/companion-daemon.js.map` 的 sourcesContent 提取 SetupService、ProjectRegistry、BridgeInstaller、DashboardFault 依赖，保持字节SHA，使用既有esbuild生成本目录 runtime.mjs，未运行daemon。mapSHA `64828d458dd0f327bfc65cf607f1271966258fc50da51c41a4bba28a19d92b0e`，daemonSHA `103ea371f13b784d7ec0263ae4714906a8ea67ebc4ddc7e0ac9c7cc5439b801c`，逐源绑定见 source-binding.json。codex-configurator源亦只读提取用于核对，但本lane不执行它的真实CLI或重叠writer测试。

运行 `node --test setup-options-isolated.test.mjs`：8/8通过，0失败，403.1754ms，正常退出0。 stdout-final.txt为最终真实stdout。8个场景每项独立mkdtemp，显式临时project、fake-home、registry、Bridge fixture；Bridge仅惰性文本fixture，未加载扩展。无真实客户端home环境覆盖，无exec/spawn或API/浏览器/新监听。Creator-ready/verify和Codex写入均为可见受控callback，Codex callback仅写临时fake-home JSON，不执行配置算法/真实客户端。

- 01 / 11：真实编排完整、optionsContractVersion=1及有效选项回显、调用者后改选项不影响任务、最终mcpName；真实Registry内容/Bridge目标字节/无残留staging或backup核对。
- 同选项在异步登记前保留同步占位并复用同一任务；改变startCreator/configureCodex/codexPath分别409，不能产生第二次副作用。
- bridge / creator-not-ready / codex-after-write / verify四类失败：保留failed原快照，清理active占位；Creator未ready不进入Codex；Codex失败不verify；明确另起请求可得新ID，原失败历史保留。
- **原实现不整体回滚早期副作用**：失败后登记记录保留；Bridge成功后后续失败仍保留Bridge；受控Codex已写后抛错或verify失败，其临时配置保留。测试明确断言此现状，未新加回滚语义；原依赖自身回滚不由编排器保证。

另运行Next现有 `tests/project-setup-options.test.ts`：21/21通过，882ms，session5695退出0。覆盖四组合的严格能力协商/独占route与frozen选项、回执不匹配UNKNOWN、409拒绝及store完成边界；其transport/provider均受控，不将其冒充真实生产API安装。

## 工具自身问题

首次8项断言均通过，但证据输出使用beforeExit异步写入导致该测试进程不能自然结束，已只对本测试进程发送Ctrl+C退出。改为test.after一次写入后原8项再次全部通过并自然退出0。未影响daemon或其他进程；最终stdout与receipt以本次修正后运行作为有效结果。

## 交接边界

真实 configureCodex=true 的01/11生产安装、真实Creator/Bridge会话及真实客户端持久配置仍未验收。没有阻碍本隔离验证的外部依赖；下一步如需生产验收仍须明确相应写入/运行窗口。执行文件和receipt保留，临时项目根路径见receipts.json；不自动删除取证目录。主会话可仅归档本目录，不需重新执行。
