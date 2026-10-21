# 项目美术规范：独立配置合同第一阶段

2026-10-21；Owner：用户。范围为 Next 独立 domain、三分区 UI 候选及隔离测试；未部署、未写入任何工程规范或调用生成。

检查点：`checkpoints/art-spec-domain-20261021`。新模块 `src/domain/project-art-spec.ts`；测试 `tests/project-art-spec.test.ts`。

## 来源与权限

依据 P0001 `ip/canon_interface.md`、`ip/canteen-transport-interface.md`、`art/master-style-reference.md` 和 `AGENTS.md` 的 Accepted 边界消费，不修改或复制另一份 Canon。产品只能在适用接口范围消费；母级风格不是所有工程的通用默认值。P0001 没有已定义的机器可读通用“允许覆盖默认字段”，模块不代为发明。

`ProjectArtSpec` 仅保存固定 Git revision 的来源引用、项目必填内容、项目差异与类别差异。必须明确 `inheritance.mode=none` 及原因，或明确 `canon` 来源；不会自动选择 P1000 / P4000 或母级画风。新 schema 不接受内嵌 authority，调用方的可信来源加载器提供 Accepted、确切版本、项目/类别范围、锁定值及明确允许覆盖的 defaults。缺失、版本变动、Review、范围不符、重复来源与权威冲突均拒绝。Canon 模式至少需要适用接口，不能仅加载美术正文绕过接口。

当前模块没有文件 IO，因此不证明来源内容已经读取、Owner 母图已查看或 authority 中的解释已获接受。后续宿主必须从明确来源加载并核对固定 revision；不能将浏览器提交的 authority 当可信权威，不能用自行填写的 Accepted 替代真实来源状态。

## 合同

- 项目必填：登记 projectId、版本、名称、内容说明、当前 `cocos-creator` 引擎、有效设计画布、明确继承范围。引擎限制只对应当前工程，不宣称工作区全局引擎。
- 解析顺序：明确可覆盖 defaults → authority 锁定字段 → 项目差异 → 类别差异 → 单资产差异。后三级不能改变锁定字段；同值允许。默认冲突拒绝，不依靠来源顺序偷偷选胜者。输出保留来源版本、锁定字段及实际值来源。
- 类别：人物 IP 要求身份、允许变化和视角；装备要求用途；技能要求用途与状态；UI 要求状态和文本安全区；图标要求用途。所有资产要求主体、尺寸、透明标志和受限 Creator 目录。字段是内容合同，不保证模型理解或人物一致。
- 单资产 prompt 保持原文，不自动追加/改写 Canon。自由文本是否语义违背权威仍需审阅；结构锁定不是自然语言合规证明。
- 现有图标 adapter 的类别能力只能声明 `['icon']`；其他类别即使配置齐全也返回 `GENERATION_CATEGORY_UNSUPPORTED`。必要参考缺失或 adapter 不支持图像条件输入时返回阻塞。不得把留证路径称为图像已入模。
- `readyForGeneration` 仅表示调用方声明能力下配置检查无阻塞，不授权调用模型、不证明图像读取、样本方向验收或模型质量；`visualCompliance` 始终 `unverified`，`persistence` 始终 `not-performed`。
- 原 `project-resource-config-v2` 使用现有严格 decoder 兼容读取，返回独立 legacy 投影，不改写、迁移或丢失尺寸/参考/目录字段；明确 `referencesAsModelInput=false`。

## Implemented persistence and recovery contract

The task-specific file is `<projectId>.art-spec.json`. Legacy v2 remains read-only compatibility: no implicit migration or dual write. `ProjectArtSpecPanel.vue` provides global inheritance, project settings and five asset categories. Existing v2 editing and icon workflows remain below it. Category width, height, transparency and destination support explicit overrides, removal back to inheritance, and effective-value/source display. Canon pins are not editable authority definitions; selected saved pins cannot silently disappear.

`adapters/project-art-spec.ts` uses bounded, credentialed same-origin GET/POST `/api/art-spec/<projectId>` and read-only GET `/api/art-spec/<projectId>/operations/<operationId>`. The provider is registered only for the normal workspace host in `main.ts`; other entry modes retain null. Endpoint availability and real host capabilities still require runtime acceptance. No localStorage configuration is presented as a saved project file.

The server allocates the next version. A completed receipt must match the original project, normalized path, operation id, canonical request hash, full configuration apart from the server version increment, and returned trusted bindings. The client does not infer completion from a current-file hash or an acknowledgement alone.

Before dispatch, a durable browser record freezes the exact request, operation id, stable endpoint/project/path identity, expected hash and base version. Failure to persist prevents POST. Source object/provider/Pinia reconstruction cannot remove this fence. Unknown completion permits only status lookup of the original operation, never automatic resubmission. Pending/missing/mismatched status retains UNKNOWN; only the matching durable completed or rejected result can release the fence. Late receipts from another view binding do not update that view. Storage contains recovery metadata and the unsent/frozen draft, not credentials.

## Validation and limits

Seven focused suites passed 105/105: domain 31, editor store 13, panel 4, same-origin adapter 8, composition 5, existing AI read UI 21 and existing editor UI 23. `vue-tsc --noEmit` and `git diff --check` passed after these suites. The independent reviewer must still evaluate the final candidate; these are implementation-team results.

Actual backend/file-store contract evidence is in `C:/Users/33272/AppData/Local/Temp/companion-art-contract-20261021/result.json` with its `verify.ts`, `build.cjs` and `verify.mjs`. The harness imports the real W RegisteredProjectArtBackend, persistent operation ledger, real Next parser/store/adapter and a fresh Temp project directory. Fetch dispatch is in-process: no HTTP listener, Creator, production project or real generation was used. Real disk saves produced versions 1, 2 and 3. The third response was deliberately lost after commit; a fresh Pinia/source/provider recovered only through the original operation-status lookup. There were exactly three POSTs, with no replay. This proves the transport/backend contract and filesystem behavior in isolation, not deployed browser acceptance.

Selected source validation first checks every pin/status/project binding, then applies only sources supporting the requested asset category. A different category interface cannot authorize the requested category. Current icon-only generation support remains icon-only. Reference-image model input is still unimplemented; preview/reference paths are not claimed to be model inputs. Visual compliance remains unverified. Production deployment, real UI file persistence and the broader art generation integration are owned by the parent task and are not established by these tests.
