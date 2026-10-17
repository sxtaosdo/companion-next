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
| C | 复用写锁、跨页持久保护及 waitForIdle；请求进行中不可重复，失败不自动重试，未知只读核原操作；测试错误工程、母图混淆、过期确认、慢请求、未知、成功回读 | 定向 146 项通过，待真实导入 |
| D | 定向测试/类型检查、独立 reviewer 和 OCR Delegation 宿主审读；一次受影响完整测试与 workspace 构建、静态检查；精准代码提交、本地六静态部署及 HTTP SHA 回读 | 测试/构建/复审完成，部署待执行 |
| E | 新隔离任务实际点击一次变体导入，核原操作/资源 UUID/SpriteFrame、PNG/meta/SHA/尺寸；截图仅本地，关闭本次自有 Creator/Edge/端口并累计预算；提交证据与最终状态 | 待执行 |

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

下一步：精准提交本实现、仅部署已核六静态并 HTTP 回读，再进行 E 的新独立任务单次真实尺寸变体导入。普通可修复开发问题继续处理，仅超出授权或确实结果未知构成阻塞。
