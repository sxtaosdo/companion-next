# 96×96 变体：真实 UI 复核与后续边界

状态：Accepted（本机事实及交接记录，不代表完整产品验收）

## 04:38 UTC 本机交付：已解决 409 与变体 PNG 缺口

Next 功能检查点 `caf14fbf997ef1b2cc18aa5e4d0a980885df9882` / `1.3.173.18` 已构建并精确部署六静态路径，产品版本仍为 1.3.173；index SHA `8ac97a787d9a8bf19c79b48e1bde144eeef74118098e2ae82e6c8bc2251a2eac`。以下旧阶段的失败证据保留，后端协调项已由本节实现替代。

实际服务使用的 Studio 是外置工作树 `C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/studio`，不是较旧的 P9000 main。功能提交 `6cb7c092e1f5a4fe5b063692f236cba80167cd61` / 0.0.0.41，合同提交 `7e117fed6c3d3733b11f9c52a4c56b89ff365238` / 0.0.0.42。仅 jobs/status 可在 HEAD 变化后读取历史，返回原 sourceRevision 与显式 historyOnly/currentSourceRevision；来源、候选及派生证据仍校验，母图 candidate 和写入仍要求原 HEAD，task.json 不写回。

Node 从此前已审查的实际运行源码快照增量构建，新 daemon bundle SHA `f3323c72165a2d2f28f3faf89b3c5811e5df1dafee384303db0bf84811970e70`。`variant-preview` 只接受原 jobId/operationId，读取持久绑定并核 PNG、尺寸、母图和文件/收据 SHA，不调用 Creator、不重导出或导入。Next 在原资源面板读取，另核身份、尺寸、CRC、SHA；历史或已有变体任务均暂停写入，换工程/任务取消并隔离迟到结果。

共享 cocos-mcp main 较旧且有 22 项并行 dirty，未覆盖、暂存或提交这些源码。运行增量补丁、完整测试快照和受限接口合同已保存在隔离验收仓 `tests/fixtures/mcp-readonly-patch/`，manifest 记录原运行 sourcemap 基线和 SHA，供后续由源码 Owner 精确整合；不可盲贴到较旧 main。两份候选 bundle、输入 SHA 清单和旧四文件备份另存于外置证据目录。

完整受影响校验：Python 三份模块 80 测试通过（1 项原有跳过），MCP 八份图标模块 140 测试通过，Next 23 份 AI 模块 948 测试通过，TypeScript/Vue 类型检查和 workspace 构建通过。prompt-emulated reviewer `/root/window_budget_reviewer` 发现并复核修复三项 P2：变体完成后的直连写入、generated 历史 candidate、两次 status 间 HEAD 变化时导出。OCR Delegation 清单与共享规则由宿主审读，未称为 managed PASS。

同一 127.0.0.1:32180 服务更新前确认原 PID16140 OPEN、全计数零、unknown=[]。官方 stop 绑定原身份与 generation，确认原 PID 退出后替换四 bundle，保留旧 hash 静态并原子切换入口。首启错误使用 Node22，与既有 better-sqlite3 ABI141 不匹配（Node22 要求127），无残留监听/实例；以原 Node v25.2.1 唯一重试成功，新 PID4092 OPEN。未安装或重编译依赖，回滚只在核清当前身份/产物后恢复已备份四文件与旧 index，并用原 Node25 官方启动；不重跑旧停服脚本、不裁决 UNKNOWN。

2026-10-17 04:38:40–04:38:44 UTC，正常 `/v1/ui/session` 入口、独立禁 GPU Edge、1440×1080 视口，真实同源 jobs/status/variant-preview 全部 200。旧任务仍 selected/r6，变体仍 imported_pending_verification/RELEASED；界面显式只读，母图读取禁用。PNG 自然尺寸 96×96，SHA `fe10e97c530d9cd03908e77dddaa9413a8284baab8c22bb461e7bb05b4638654`，收据 SHA `041737637fee9ef00d955abaffeee9572fce18198a0ea5fe8eb30569f965e457`，已实际查看钱袋图像。业务写入、被拦请求、HTTP 错误及 page error 均为零；浏览器关闭。原 task SHA `181095392e02d8b08a368ef725fc34629bb804f29710a18d991f724a4da69126` 前后相同。

- [真实历史列表截图](evidence/variant-history-real-20261017.png)
- [真实变体图像截图](evidence/variant-png-real-20261017.png)
- [无凭据页面及请求回执](evidence/variant-readonly-ui-20261017.json)
- [本机受控停启与产物身份](evidence/variant-readonly-runtime-20261017.json)
- [六静态文件与源码身份](evidence/variant-readonly-static-20261017.json)

这是隔离工程现有资源面板的实际读取与图像闭环；保存 PNG 不代表当前 Creator 资产回读或生产验收，productionVerified=false。没有新增业务流程或重做编辑器。

WebMobile Smoke 也已通过：04:11:49–04:12:20 UTC，使用既有固定构建、fresh lease/fence8 和新 render-ready 操作，750×1334 实图已查看，四类完整原始诊断数组均为空；独立浏览器、12189 服务及租约关闭。首个未派发 schema 错误、第二次过早空白截图均保留，不冒充可见成功。构建 sourceRevision 仍为 `f19564bda642374b7780a00b19d9c86cf72185d7`，无 Creator/重建/重新导入，预算仍 326254/1800000ms。核心 Smoke 回执、原报告及截图已进入隔离验收仓 `tests/fixtures/build-smoke-*`，新增六项只读证据检查通过。

当前切片无待协调的实现或真实读取阻断；剩余仅为共享较旧 main 的源码整合，以及任何新平台/生产用途另行授权。未 push/tag/父 pin，未关机。

## 03:55 UTC 旧阶段记录（已由上述交付推进）

## 已实现与验证

本地代码 `c3b1fd1a8adf27c21018ff314e01eb666305d378` / `1.3.173.16` 读取现有 `jobs/status` 的独立 `variantImport` 摘要，展示原操作、状态、写入效果、租约、尺寸、文件/收据 SHA 和目标。母任务可仍为 selected；页面保留该事实，存在变体记录时暂停此任务的全部写操作。路径兼容合法点名，拒绝独立 `.` / `..`、编码、查询和外部 URL。`productionVerified` 保持 false。

23 份受影响 AI 模块、936 项离线测试通过，Vue 类型检查与 workspace 构建通过。类型检查最初发现新增合成测试的泛型推断错误，已修正；修正仅为类型注解，复用行为测试覆盖。首次受限 shell 在临时缓存 rename 返回 EPERM、未运行测试；已在授权正常主机对同组离线验证重试。reviewer `/root/window_budget_reviewer` 为普通子代理的 prompt-emulated 职责审查，硬隔离未核验；一项点名兼容 P2 已修复并复审。OCR 使用 Delegation 文件清单/规则及宿主审查，不称为 managed PASS。

03:55 UTC 时新前端未部署，当时运行中的 Next 为代码 `5419ace06f5f25f4a3f4300dcfab2a85255edc68`，index SHA `4717a68ace5df9c95fe65ca67783b85d1069d95e83de053d7e618fccfc9808ab`。

## 实际浏览器结果

2026-10-17 03:54:59–03:55:01 UTC，使用原 `/v1/ui/session` 正常入口进入独立临时 Edge；未读取/保存认证码、Cookie 或传输凭据。1440×1080 单一设计视口，禁用 GPU，同源真实请求，无业务 mock；仅允许 GET/HEAD 及该隔离项目有限只读 POST。

页面正确显示工程 `a79f4915296f4091` 和路径，进入资源第六步。点击“读取 / 刷新任务历史”后，原 GET `/api/icons/a79f4915296f4091/jobs` 返回 409，UI 显示失败，没有将失败变为空历史或任务完成。没有写请求、被拦请求或 page error；独立浏览器已关闭。

- [真实页面截图](evidence/variant-resource-ui-20261017.png)：SHA `ab2bb1bf29f14f973df79ed41d1fa293d4068368255ec717256d33637d655a81`，已实际查看。
- [浏览器请求及结果](evidence/variant-resource-ui-20261017.json)：只记录无凭据的路径、状态和页面文字。

03:55 UTC 当时本切片的资源 UI 验收未通过，以下保留原失败；04:38 UTC 已按本节真实接口重新验收，没有使用旧 JSON 伪造页面。

## 精确后端协调项

只读 `jobs/status` 返回 `REVISION_MISMATCH`。Studio 当前 `companion_api.py` 的 adopted 路径经 `snapshot → candidates → validate_adoption_inputs → validate_request` 要求保存的 sourceRevision 等于当前 HEAD；README/protocol 明确规定此检查也适用于读取。提交后旧任务不能查看，单个旧 adopted 任务也会中断历史列表。这是既有安全合同缺少 history-only 读取能力，不能直接移除 fence。

由 Studio Owner 协调的最小文件：

- `P9000/ai-game-studio/project/tools/local-icons/companion_api.py`：分离只读历史摘要与可操作快照；保留 candidate 内容、select、prepare/finish-import 的当前 HEAD/来源证据校验。
- 同目录 `protocol-v1.json`、`README.md` 及相应测试：定义 stale/history-only 的字段和动作边界。原任务记录、sourceRevision 和导入状态不得改写。
- 若引入新摘要字段，Companion Owner 同步 `P8000/cocos-mcp/mcp/src/companion/icon-adapter.ts` schema，并与 Next 对接显式 stale 写保护；不得在共享并行 dirty 上直接覆盖。

只读 `variant-import-status` 对同一 operation 返回历史 `reportedResult=imported_pending_verification/effectApplied=true`，但当前 `query=import_unknown/UNKNOWN`：Creator 关闭，资产实时回读连接失败。历史成功与当前查询分别保留，不能因此重复导入或宣称当前资产不存在。

变体图像也未接通：现有 `candidate` 返回 1024 母图；`readVariant` 只返回经过 PNG/尺寸/文件及收据 SHA 校验的元数据，未提供 PNG 字节。最小后端文件为 `icon-adapter.ts`、`icon-image-assets.ts` 及对应测试/合同，增加受限只读变体图像接口后再接 Next。不得用 `import-variant` 写路径获取预览。

## Runtime、Library 与 Build Smoke

隔离工程权威证据在 `P8000/local-tests/creator-ai-variant-import-acceptance-20261017`：HEAD `aae735afc76793186c9e100179f75425caffad28` / `0.1.0.8`，已保存场景并跨 Creator 会话重开、Preview 实际可见、851 样本 profiler 无 error/warn findings、WebMobile 构建通过。产物 sourceRevision 仍为 `f19564bda642374b7780a00b19d9c86cf72185d7`，不改写为后续文档提交。

WebMobile package SHA `ee8e5ba469e2f11205f2008de2767e1493c35ddc2794287015dcc12421bb5fbb`，index SHA `058b167898f99c4e2cce8ad53035bc7d7dcbe406f14ec08f079acbf6a1487602`，本轮 CPU 复核一致。现有 `build_smoke` 会在 `127.0.0.1` 临时端口只读提供固定产物，使用独立浏览器并自动关闭服务；不需重启 Creator、导入或重建。

03:55 UTC 当时 Build Smoke 已准备、尚未执行：另一任务使用 GPU，窗口释放确认仍待协调。一次性脚本 `postbuild-ui-20261017/build-smoke-ready.mjs` 要求一分钟内的明确 GPU gate，使用原 tool、fresh lease 和固定 operationId；UNKNOWN 只查询原操作、不重放。该文件位于下述外置证据目录。

真实 Preview 截图已成功保存至 Library：`libfile_49e9aeb37f28819186fd6d3ee34cf950`，file ID `file_00000000702c820c9bad768e0d232e16`，SHA `0fde4ec06b618a47fb48714895456fa250008444220eae77c43e421da1fcc621`，750×1334。Windows helper 的本机身份标记写入失败（Python 无 `os.setxattr`）；上传成功，不重复上传。

本轮未启动 Creator，累计预算仍为 `326254 / 1800000 ms`，active=null；03:59:31 UTC 核验 7456/7458 无监听、此工程 Creator 为 0、本轮 Edge 无残留，原 daemon PID16140 身份保持。旧冻结工程元数据 SHA `9eab90dcc56b34bf217e55dea3f73ab163a91908f948f8a7001e258c3f1a6828`、adoption manifest、已部署 Next、Owner hooks/package/lock 与 PNG/meta/scene 均保持。

外置证据目录：`C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/interface-load-20261016-phase2/recovery-20261017/isolated-import-20261017/postbuild-ui-20261017`。含实际只读响应、构建基线、保护复核、OCR 清单/规则、宿主审查和一次性 Smoke 脚本。未 push/tag、未改父 pin、未重启共享服务、未操作冻结 UNKNOWN、未关机。

上述旧排队项现已由 04:38 UTC 交付节完成；保留这份记录说明真实失败及修复来源。
