# 96×96 变体：真实 UI 复核与后续边界

状态：Accepted（本机事实及交接记录，不代表完整产品验收）

## 已实现与验证

本地代码 `c3b1fd1a8adf27c21018ff314e01eb666305d378` / `1.3.173.16` 读取现有 `jobs/status` 的独立 `variantImport` 摘要，展示原操作、状态、写入效果、租约、尺寸、文件/收据 SHA 和目标。母任务可仍为 selected；页面保留该事实，存在变体记录时暂停此任务的全部写操作。路径兼容合法点名，拒绝独立 `.` / `..`、编码、查询和外部 URL。`productionVerified` 保持 false。

23 份受影响 AI 模块、936 项离线测试通过，Vue 类型检查与 workspace 构建通过。类型检查最初发现新增合成测试的泛型推断错误，已修正；修正仅为类型注解，复用行为测试覆盖。首次受限 shell 在临时缓存 rename 返回 EPERM、未运行测试；已在授权正常主机对同组离线验证重试。reviewer `/root/window_budget_reviewer` 为普通子代理的 prompt-emulated 职责审查，硬隔离未核验；一项点名兼容 P2 已修复并复审。OCR 使用 Delegation 文件清单/规则及宿主审查，不称为 managed PASS。

新前端未部署。运行中的 Next 仍为代码 `5419ace06f5f25f4a3f4300dcfab2a85255edc68`，index SHA `4717a68ace5df9c95fe65ca67783b85d1069d95e83de053d7e618fccfc9808ab`。

## 实际浏览器结果

2026-10-17 03:54:59–03:55:01 UTC，使用原 `/v1/ui/session` 正常入口进入独立临时 Edge；未读取/保存认证码、Cookie 或传输凭据。1440×1080 单一设计视口，禁用 GPU，同源真实请求，无业务 mock；仅允许 GET/HEAD 及该隔离项目有限只读 POST。

页面正确显示工程 `a79f4915296f4091` 和路径，进入资源第六步。点击“读取 / 刷新任务历史”后，原 GET `/api/icons/a79f4915296f4091/jobs` 返回 409，UI 显示失败，没有将失败变为空历史或任务完成。没有写请求、被拦请求或 page error；独立浏览器已关闭。

- [真实页面截图](evidence/variant-resource-ui-20261017.png)：SHA `ab2bb1bf29f14f973df79ed41d1fa293d4068368255ec717256d33637d655a81`，已实际查看。
- [浏览器请求及结果](evidence/variant-resource-ui-20261017.json)：只记录无凭据的路径、状态和页面文字。

完整资源 UI 验收未通过，新摘要只完成离线合成验证，不能用旧离线 job JSON 伪造真实页面成功。

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

Build Smoke 已准备，尚未执行：另一任务使用 GPU，窗口释放确认仍待协调。一次性脚本 `postbuild-ui-20261017/build-smoke-ready.mjs` 要求一分钟内的明确 GPU gate，使用原 tool、fresh lease 和固定 operationId；UNKNOWN 只查询原操作、不重放。该文件位于下述外置证据目录。

真实 Preview 截图已成功保存至 Library：`libfile_49e9aeb37f28819186fd6d3ee34cf950`，file ID `file_00000000702c820c9bad768e0d232e16`，SHA `0fde4ec06b618a47fb48714895456fa250008444220eae77c43e421da1fcc621`，750×1334。Windows helper 的本机身份标记写入失败（Python 无 `os.setxattr`）；上传成功，不重复上传。

本轮未启动 Creator，累计预算仍为 `326254 / 1800000 ms`，active=null；03:59:31 UTC 核验 7456/7458 无监听、此工程 Creator 为 0、本轮 Edge 无残留，原 daemon PID16140 身份保持。旧冻结工程元数据 SHA `9eab90dcc56b34bf217e55dea3f73ab163a91908f948f8a7001e258c3f1a6828`、adoption manifest、已部署 Next、Owner hooks/package/lock 与 PNG/meta/scene 均保持。

外置证据目录：`C:/Users/33272/AppData/Local/Temp/companion-variant-import-20261016/interface-load-20261016-phase2/recovery-20261017/isolated-import-20261017/postbuild-ui-20261017`。含实际只读响应、构建基线、保护复核、OCR 清单/规则、宿主审查和一次性 Smoke 脚本。未 push/tag、未改父 pin、未重启共享服务、未操作冻结 UNKNOWN、未关机。

下一步仅保留：协调 GPU 窗口执行现有产物 Smoke；由 Studio/Companion Owner 完成上述只读历史及变体图像合同后，部署受影响本机产物并重新做真实 Next 资源 UI 验收。
