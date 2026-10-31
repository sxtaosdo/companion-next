# 执行与验收清单

这是本项目唯一的执行清单入口。来源/能力复用、状态语义和既有验收规则以 [source-and-reuse-policy.md](source-and-reuse-policy.md) 与 [AGENTS.md](../AGENTS.md) 为准；本清单不改写它们，也不扩大用户授权。每项任务记录实际证据、结果和未覆盖项。未满足必要条件就停在对应步骤，不用完成百分比掩盖阻塞。

## 1. 开始前：范围与原始状态

- [ ] 写明用户授权、目标、负责人与允许修改的精确路径；并行 owner 不得重叠。保存 HEAD、原有 staged/unstaged/untracked 状态、原有 dirty 文件字节及 SHA256，不默认 stash/reset、自动提交或推送。
- [ ] 先查原实现、共享组件、已有脚本和历史失败记录，按来源规范配置/复用后再补码。把源码、候选产物、已部署产物、测试 fixture、原始证据分别列出，不混用版本身份。
- [ ] 准备任务 manifest，执行 `npm run preflight -- --manifest <绝对JSON路径>`。该入口只读，检查声明的 HEAD、owner scope、源文件/保护文件/产物/证据哈希，不启动服务、不写业务数据。manifest 不等于授权，也不证明未列出的路径没有变化。

manifest 格式（占位值必须替换为真实值；不支持“自动接受当前值”）：

```json
{
  "schemaVersion": 1,
  "task": "本任务ID",
  "owner": "当前负责人",
  "expectedHead": "40位实际HEAD",
  "scope": ["scripts/example.mjs"],
  "parallelOwners": [{"owner": "其他负责人", "scope": ["src/other-area"]}],
  "files": [
    {"path": "scripts/example.mjs", "role": "source", "sha256": null},
    {"path": "package-lock.json", "role": "protected", "sha256": "64位原始SHA256"},
    {"path": "C:/task/candidate.js", "role": "artifact", "sha256": "64位实际SHA256"},
    {"path": "C:/task/results.json", "role": "evidence", "sha256": "64位实际SHA256"}
  ]
}
```

`source` 必须在当前 owner 的 scope 内；`null` 仅用于明确验证尚不存在的源/保护文件。artifact/evidence 指向明确已有的文件，只验证哈希而不执行。绝对路径只用于明确的保护/产物/证据文件。新阶段需要新的、可解释的 manifest；不要为了通过检查覆盖旧基线。全仓 Git diff 与并行 owner 协调仍需人工复核。

## 2. 运行时与可复现命令（机械门禁）

| 入口 | 必须满足 | 实际机械检查 |
| --- | --- | --- |
| `test`、`test:*`、`test:watch`、`build`、`build:*` | Node22 且至少22.12 | `scripts/runtime-gate.mjs frontend` 在工具加载前拒绝错误运行时，记录 execPath/version/ABI、package 和 lock 哈希，用同一 execPath 执行子工具 |
| `start` | Node25、ABI141，匹配当前原生宿主产物 | `scripts/runtime-gate.mjs host-start` 通过后才进入原 start-companion.mjs；不替换该启动功能，也不证明服务已经就绪 |
| `preflight` | 明确任务 manifest、HEAD 和哈希 | `scripts/task-preflight.mjs` 只读验证声明的文件和 owner 重叠；不代表业务验收 |
| `preflight -- --delivery <绝对JSON路径>` | 严格 host product-build 契约及候选字节一致 | 校验既有 consumer 源码pin、严格key集、manifest/entry/package SHA、包名/版本和预期版本/源码revision；不启动候选或daemon |

- [ ] 使用已有正确的可执行文件，不升级/卸载 Node、不安装依赖、不改变系统 PATH 或全局 NODE_OPTIONS。现有前端通过值是 `D:/code/shidai3/P8000/dual-game-build/node_modules/node/bin/node.exe`（22.23.3）；当前宿主路径为 `C:/Program Files/nodejs/node.exe`（25.2.1）。其他22.x小版本仅通过版本范围检查，不代表已实际跑过本项目全套测试。
- [ ] 可先只检查：`<Node22> scripts/runtime-gate.mjs frontend --check`；`<Node25> scripts/runtime-gate.mjs host-start --check`。`--check` 不执行子程序，**不算构建/测试/启动成功**。
- [ ] 从项目 cwd 用正确 Node 执行入口，例如 `<Node22> scripts/runtime-gate.mjs frontend -- node_modules/vitest/vitest.mjs run <测试路径>`。不要让检查后的子工具又通过 PATH 换回另一个 Node。保存完整命令、cwd、运行时身份、退出码、原始日志、测试文件/用例总数。
- [ ] 门禁自身验证：用现有 Node22 调 `scripts/runtime-gate.mjs frontend -- --test tests/runtime-gate.test.mjs tests/task-preflight.test.mjs`；测试子进程需要 `COMPANION_GATE_TEST_NODE25` 指向已有 Node25（仅该次测试环境），另可明确 `COMPANION_GATE_TEST_NODE22`。缺Node25证据会失败，不能静默跳过或伪报跨版本测试通过。测试不会启动服务或 Creator。

门禁不自动切换运行时、不下载工具、不读认证配置、不更改存储兼容 flag。前端包同时含宿主启动入口，因此不把整个 package engines 独占锁为22。既有预检失败日志必须保留，不能改断言使它“通过”。

## 3. 实施与复现（需真实证据）

- [ ] 明确实际公共接口和测试 seam；错误先复现/找根因，保留原始失败。每次修复走必要的 red→green；只证明初始化失败的日志不能归类为业务断言失败。无必要的低风险纯文档改动不用制造测试。
- [ ] 定向测试、类型检查、构建分别记录实际结果。修复后只在新改动、失败或未解疑点要求时扩大测试，避免重复跑全套。模拟/隔离测试与真实环境验收分栏；版本号、源码 SHA、构建输入、包清单和运行进程身份互相对齐。
- [ ] UNKNOWN/过期/异常保留原始证据与未完成义务；不重写为 STOPPED/READY，不因“请求受理”声称业务完成，不自动重放写请求。具体状态/UI检查遵循来源规范并保留实际渲染证据。

## 4. 产物、维护与实机验收（人工门禁）

- [ ] **部署前必须实际检查产品版本契约，不能只做 `node --check`、模块 import 或产物哈希自洽。** 运行 `npm run preflight -- --delivery <绝对JSON路径>`；可与 `--manifest` 同用。delivery JSON 含 `schemaVersion:1`、绝对 `manifestPath/entryPath/packagePath/contractSourcePath`、预期 `manifestSha256/entrySha256/packageSha256/version/sourceRevision`。三个产物按consumer的相邻 `product-build.json`、entry、`host-package.json` 布局验证。审计字段外置，不能塞入严格build对象；规则源为 `cocos-mcp/mcp/src/companion/product-version.ts:7–11,18–31`，源码SHA变化会阻断，需重新对照再更新门禁，不能跳过。离线契约通过仍不等于运行中的 `/v1/version` 已消费新产物，需另存真实读回与身份。

- [ ] 出图：记录批准范围、GPU预算/实际任务数、来源、文件/透明度/尺寸等实际检查及预览；没有批准不追加生成。素材质量、导入、绑定是不同结果，不能互相替代。
- [ ] 导入/绑定/场景操作：核对项目/场景/资源UUID、原素材、操作回执和真实读回/渲染证据。所有 Creator 动作只从已有 `127.0.0.1:32180` 开发者后台UI发起，不从CLI/API脚本替代，不重复动作制造历史证据。P1060/P3000等未授权项目保持暂停。
- [ ] 部署/宿主维护：只有在已有授权范围内才执行；确认唯一32180、维护门禁、当前进程/epoch、UNKNOWN义务、精确备份与回退目标，再用既有正式路径。不得创建额外后台/端口、改认证或放松产品清单 schema。源码、产物、已运行身份分别核验；静态文件写入不等于新进程已经加载。
- [ ] 本清单及两个脚本**没有机械证明**素材质量、UI语义、真实Creator效果、运行服务数、维护许可或回退可行性；这些项需要负责人保存真实读取/操作证据。不能把JSON里的手写“passed”当成实机证明。

## 5. 交付

- [ ] 复查范围、并行owner、保护文件与Git diff，确认用户既有dirty内容原样保留；版本/锁文件非任务目标不改。
- [ ] 列出实际运行的测试文件数/用例数、构建次数、服务/Creator/GPU操作数、每个失败/阻塞、未覆盖分支与证据路径。不把“没跑”“模拟通过”“入口check通过”记成实机完成。
- [ ] 按 [来源与能力复用规范](source-and-reuse-policy.md) 的交付与状态验收要求收口；遇到审批拒绝，停止那个动作并原文报告，不换路线绕过。


## 工作流知识库证据门禁

适用任务在计划前解析既有 Agent 预设并保留检索证据，在交付时核对引用采用；使用 `npm run preflight -- --workflow <绝对证据JSON> --workflow-policy <独立绝对策略JSON>`，两参数必须成对。凡 `--manifest` 任务预检均须同时提交这两个参数，缺失即阻塞；没有 scope-only 绕过入口。独立策略须明确 `phase: start` 或 `phase: delivery`：开始阶段只核对真实计划，交付阶段必须同时核对真实交付与计划引用，开始通过不能冒称交付完成。策略 taskId 须与已核验 scope.task 一致。不适用也须独立策略与明确理由，不自动回退。单独 `--delivery` 仍仅验证离线产物。策略锚点不能从被查证据反向复制，须原 scope manifest 固定其文件哈希，或明确记录调用者人工审查责任。缺文件、哈希/关联不符、服务不可用即阻塞；零命中和不适用必须分别写明真实处理与理由。命中不等于采用，配置解析不等于模型或角色已实际生效，未证明的运行生效一律标未验。原 scope/delivery 检查仍不代表业务许可或真实知识检索；强制入口、字段与局限以[知识库工作流证据合同](workflow-evidence-contract.md)为准，隔离样例不得冒充生产调用。
