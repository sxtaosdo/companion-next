# 尺寸变体“导入当前工程”实施与验收

状态：Accepted（本次唯一范围计划；执行状态随证据更新）

Owner 于 2026-10-17 07:28:12 UTC 确认新增入口，消息 `Sentinel_a0ec1b9dbf9c8191ae555d737e8f2e12`。仅在新 Companion 的尺寸变体区域接入已验证的 `import-variant`；不改变旧 Windows UI、生命周期、冻结 UNKNOWN、已有成功任务或后台接口。

## 基线与文件边界

- 新前端：`P8000/companion-next`，Vue 3 / TypeScript；起点 `6eb5b6c7851a062e2660c9c8e3bada51b4590294` / `1.3.173.23`，工作树和索引干净。原产品版本 `1.3.173` 保持。
- 允许功能文件：`src/domain/ai-job-actions.ts`、`ai-jobs-read.ts`、`ai-write-coordination.ts`，对应 adapters/stores，`components/AiJobActionsPanel.vue`、`AiJobsReadPanel.vue`，相关定向测试及本项目日志/交接文件。原动作状态机、写锁、持久未知保护和请求清理复用。
- 共享后端 `P8000/cocos-mcp` 的 HEAD `4fcfe827` 及 22 项并行 dirty 只读保护；仅允许将已验证的 Next 构建静态文件部署至原 `mcp/dist/companion/web/next`，不修改后端源码、不重启共享服务。Node 25 原生 ABI 服务继续使用原实例。
- 原隔离 Creator 3.8.8 工程 `a79f4915296f4091`：新独立测试任务及不存在的尺寸目标。旧 96 变体和新 1024 母图历史均保持，不重导、不重标 sourceRevision。

## 阶段、依赖与验收

| 阶段 | 工作与验收 | 状态 |
| --- | --- | --- |
| A | 记录 Git/进程/部署/Owner dirty 基线，提交本范围计划作为起始检查点 | 已完成；b7d2a87 / 1.3.173.24 |
| B | 保留导出 receipt SHA；尺寸回执旁增加“导入当前工程”及冻结范围确认，严格绑定工程、任务版本、候选、尺寸、文件/收据 SHA、新目标。导入后沿用真实变体预览 | 源码已实现 |
| C | 复用写锁、跨页持久保护及 waitForIdle；请求进行中不可重复，失败不自动重试，未知只读核原操作；测试错误工程、母图混淆、过期确认、慢请求、未知、成功回读 | 定向 146 项及新任务真实导入通过 |
| D | 定向测试/类型检查、独立 reviewer 和 OCR Delegation 宿主审读；一次受影响完整测试与 workspace 构建、静态检查；精准代码提交、本地六静态部署及 HTTP SHA 回读 | 3074d37/.25 已部署，六HTTP SHA通过 |
| E | 新隔离任务实际点击一次变体导入，核原操作/资源 UUID/SpriteFrame、PNG/meta/SHA/尺寸；截图仅本地，关闭本次自有 Creator/Edge/端口并累计预算；提交证据与最终状态 | 已完成；新任务一次真实导入，回读/关闭通过 |

接口事实：`export-variant` 当前返回文件身份和可选 `receiptSha256`，不返回导出 PNG；已有 `variant-preview` 绑定已保存的导入操作。入口放在尺寸回执旁，导入前不伪造文件预览、不扩后台 API；成功后可查看该操作真实变体图像。没有 receipt SHA 的旧响应只能展示，不能导入。

返回 dispatch 只代表派发，不能标为成功。尺寸结果与母任务状态分开；读取同一原操作，只有明确写入成功且租约释放才展示文件导入通过，资源 ID 由原查询/资产读取证据核对。`productionVerified=false` 为固定策略，不是待解除门槛。

## 运行、安全与回滚

Creator 只经原 Dashboard-backed 接口启动，7458 是唯一批准的非回环监听；同一官方主进程必要回环通信沿用授权。累计上限 1800000ms，起点已用 381067ms、剩余 1418933ms、active=null。启动前建立独立预算守卫；出现额外非回环、未知结果或身份不符立即停止后续写入并保存证据。

无真实 GPU 生成、云上传、push/tag/父 pin、网络/防火墙/权限变化或关机。截图和全过程回执保存在本机 Temp 任务目录，正式摘要只纳入本仓明确证据路径。真实新变体导入不等于新场景/Preview/Build验收。

回滚先核对当前 SHA 和并行差异，仅逆向本任务源码；部署保留旧静态和 index 备份，入口最后原子切换，故障仅恢复本任务旧 index。已完成的真实资源和原任务历史保留，不通过重放、删除或 reset/clean 回滚。

## 协作与下一步

code-mapper `/root/variant_ui_mapper` 已启动，只读定位。接口不支持注册角色 preset，按根配置使用普通子代理 prompt-emulated；硬只读隔离未核验。实现后由独立 reviewer 复核；主线程负责全部修改、验证和交付。

已验证：最终完整回归 94 文件 / 3883 项通过，vue-tsc 与正常 companion-workspace 构建通过，静态 55 通过 / 0 失败 / 1 Windows 大小写 fixture 跳过。初轮新增测试 mock 泛型推断错误已修正；完整回归初轮仅旧步骤白名单缺新动作，精确更新 step4/5 后最终全量通过，没有缩减覆盖。未重复原四个已验操作。

reviewer `/root/variant_ui_reviewer` 首轮发现缺 artifact 的旧摘要不应显示导入通过，主线程修复并补有/无 artifact 面板回归；复审无剩余 P1/P2。部署脚本只读审查通过，仍不代表已部署。OCR Delegation 已解析共享 TS 和默认 Vue 规则；主线程审读差异，不称 OCR-managed PASS。外置证据为 `C:/Users/33272/AppData/Local/Temp/companion-next-variant-ui-20261017`。

本次批准切片已完成，无剩余运行阻塞。完成本地证据检查点后交付；不继续启动或扩展功能。

## 07:51 UTC 新尺寸变体入口真实交付

按本次新增批准，Next 代码/实际部署源为 `3074d37e7b279b1c45c645d2ef7175549ef693ed` / `1.3.173.25`，产品页面版本仍 `1.3.173`。六静态文件通过正常认证 Edge 逐项 HTTP SHA 回读；只新增 hash JS/CSS、最后原子切换 index，旧静态备份保留，原 Node25 PID4092 未重启。

真实新任务 `STUDIO-RUN-icon-mvc3kj0s-b2d4ee94` 绑定本隔离工程与源提交 `796a233a424749ac0baecf5c7001a514ac8ef2d6`；新任务前置采用/选图/96CPU导出各一次，唯一 `import-variant` POST 一次，均200；母图 `import` 为0，旧两个成功任务0写且原字节保持。新按钮从实际导出回执确认当前工程、版本、候选、96×96、文件/收据 SHA 与新目标；实际派发后入口阻断，最终任务 r6、母状态selected、mother import=null，变体独立完成。请求进行中防双击、错误工程/尺寸/双SHA、过期确认和失败/UNKNOWN禁重发由定向自动测试验证，不把这些受控分支称为真实故障注入。

目标 `db://assets/art/coin-pouch-variant-ui-20261017-96x96-fe10e97c530d.png`，96×96、7391字节，PNG SHA `fe10e97c530d9cd03908e77dddaa9413a8284baab8c22bb461e7bb05b4638654`，meta SHA `e68136948572b2962ae2bdc85c8a5e52cabfee778037a9c9d9cdc6a3fd16ee8e`；导出收据 SHA `88be3fd8f4234bb151a929a562c2901242aa1f1d81477258fa942814768821ca`。资产 UUID `40ee0bc7-f379-4384-85c6-08cd40b59f82`，SpriteFrame `40ee0bc7-f379-4384-85c6-08cd40b59f82@f9941`，在本次 Creator 中实际回读与文件/meta一致。原操作 `icon-import-710dd9df6d2038390b667d9b76af5996` 的 asset_import=SUCCEEDED、dispatch=TERMINAL、fence10租约RELEASED。真实变体预览200，96×96实际PNG已查看；母图新目标仍不存在。

Creator3.8.8 PID19860/session `ce4fb35a-606e-4095-bb5c-6b4dcc07406c` 由原Dashboard接口启动，仅0.0.0.0:7458及该主进程127.0.0.1:10161/10169；未调用未知回环接口。立即官方停止并核对全部自有进程/端口和Edge关闭，本窗口31.606秒，累计412673/1800000ms、剩余1387327ms、active=null、预算锁释放。原51跟踪文件、7settings、旧两task、冻结元数据、manifest、共享22dirty/HEAD及daemon身份均保持，服务OPEN/零在途/unknown=[]。

自动验证：定向146项、完整94文件3883项、类型与workspace构建通过；静态55通过/0失败/1 Windows大小写fixture跳过。独立reviewer修复复审收敛，OCR只用Delegation及宿主审读。首次验收脚本误点隐藏checkbox，零业务写/Creator未起/预算未耗，原失败和零效果证据保留；改可见标签后才完成本次唯一导入，没有重发已写请求。裸HTTP探针及短时请求清理的验证方式修正亦保留外置记录。

本轮没有云上传、真实GPU生成、新场景/Preview/Build；productionVerified固定false。旧96变体场景/Preview/Build与先前1024母图导入均为不同资产和来源的历史证据，不套用于本次新变体。证据提交后不重标原sourceRevision，不重导本任务。

[本地汇总回执](evidence/variant-ui-import-20261017.json) · [真实确认页](evidence/variant-ui-confirmation-20261017.png) · [真实导入变体预览](evidence/variant-ui-imported-20261017.png)。全部截图仅本地保存。

本地隔离资源/证据检查点：`e80ab03fdbd7d907fad06b661e70b50b24340837` / `0.1.0.13`，原settings未跟踪且保持；此HEAD仅为事后归档，不替换任务导入源796a233。前端后续纯文档检查点不重标实际构建3074d37。
