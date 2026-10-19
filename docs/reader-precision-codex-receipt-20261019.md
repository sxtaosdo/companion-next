# Reader 精度修复与 Codex 真实接收（2026-10-19）

**两项限定验收通过，无需用户重复接入。** Companion仍为PID1748/epoch453db64a-5cfe-4e53-b7aa-6df9e609a59b。代理未读取/解密DPAPI或密钥，未修改认证配置、重启daemon或执行接入脚本。

## Reader 原因与修复

AUTH_DENIED统一映射多种本机/上游失败，先前403不能单独证明WeKnora拒绝。只读安全元数据仅查询key3的id/tenant/scope/full_access/KB/capabilities/expires_at/revoked_at，未选择secret/hash；DPAPI仅stat，普通文件620字节，未读内容。

确定缺陷在本机validReaderIdentity：硬编码2026-11-08T01:25:46Z，真实已有key3为2026-11-08T01:25:46.685460+00:00，服务保留RFC3339Nano。685ms差导致合法身份被拒绝。仅恢复原已有到期常量的小数秒；key3/tenant1/tenant scope/full_access=false/唯一KB da1051a5-3fff-4198-ba55-017ea79df9c3/仅retrieve检查保持，没有续期或扩大权限。

Date.parse仍按毫秒比较，不声称微秒精确相等；到.685ms即拒绝，比真实边界最多提前0.460ms，未延长有效期。假identity先红后绿，覆盖整秒、±1ms、过期及额外KB/权限拒绝；完整隔离测试11/11，lane及根静态类型通过。独立review无P1/P2，并指出上述精度边界。

按live worker.map复建，baseline逐字节一致ff0ff140…；仅改该常量生成worker 07c4861de1716058f79866df3b15e64286b1281da8478e5f8feef192964013d4。worker每请求spawn，空闲检查后只备份替换worker.js/map，无需重启/重新接入。daemon和CLI字节、原登记/预设、共享HEAD/status/diff/index前后保持。原备份在任务Temp/companion-reader-denial-diagnosis-20261019/worker-backup；源码在独立credential工作树，最小补丁冻结在本证据目录，未覆盖共享源码或操作其索引。

真实同源复验：授权KB view 200；同KB doc/list limit3返回3项元数据、truncated=true；auth=verified、keyword=unverified，writer/scheduler=false，daemon身份未变。只归档ID/状态/类型，不归档标题/正文。没有search/chunk/original/Agent/同步/历史重建或模型推理。**元数据通过不等于检索、回答、同步或全部业务对齐。**

## Codex 误判更正与验收

此前“100字符/非空草稿”断言需更正：TextPattern.DocumentRange实际包围class=placeholder。安装代码只在一个空paragraph且content.size=0时添加该装饰；唯一可见编辑框RawView有该结构，因此可证明空而不读取文字。ValuePattern值检查被自动审批拒绝后未执行，改用此结构证明。

无参数codex://new在本机解析器中无效；改用支持的codex://threads/new打开空新任务。原Next带prompt的codex://new?prompt=仍有效，未改变产品URL。

实际Next在独立可见Edge上下文中，仅把一条CLI帮助示例数据替为唯一无敏感标记；原组件、writeText及Location.assign未mock，live资产未改。真实按钮点击后，Codex FindText与完整范围双端点比较证明输入精确等于完整标记，剪贴板亦匹配；不是仅URI成功。Next pageErrors/blocked为空，未按Enter或点击发送、未提交任务/注册配置/调用模型。

清理期间目标消失或变化时检查即停，不删未知内容。剪贴板只在精确匹配本标记时清空；随后通过已核新任务路由返回原标记，完整匹配后确认焦点、选择该范围并按一次Backspace，正常编辑事件后emptyAfterInputEvent=true、clipboardEmptyAfter=true。其他任务及窗口保持，只关闭测试自有Edge。

## 证据与保留的执行器问题

[Reader结果](evidence/reader-precision-codex-20261019/reader-metadata-result.json)、[部署保护](evidence/reader-precision-codex-20261019/worker-deployment.json)、[安装代码依据](evidence/reader-precision-codex-20261019/installed-code-structural-proof.json)、[真实接收](evidence/reader-precision-codex-20261019/codex-structural-After.json)、[精确清理](evidence/reader-precision-codex-20261019/codex-structural-Cleanup.json)。截图仅自有Next页面，无用户对话。归档文本仅规范换行/末尾空白，原日志留Temp。

构建器先因候选换行差异拒绝，确认唯一实质改动后保留原换行重建；部署检查先误把generation和观察自身http=1当任务，查原counts合同后修正，实际替换其余counts0/unknown空。这些是执行器问题，未绕过真实忙碌或认证拒绝。

仅提交Companion Next独立索引，未动其他并行模块/共享索引；未安装、改安全设置、推送、启动Creator或新监听。此前403及草稿保护记录保留为原时点，并由本次具体原因和证据纠正。

冻结的两文件源码补丁已在独立工作树通过git apply --check --reverse，只读检查匹配当前候选，未应用或改索引。

独立终审复核磁盘worker/map SHA及限定回执，无P1/P2。最终Cleanup的clipboardChanged=false，只证明此时剪贴板已空，不将其描述为该次动作清空；03:44的Before=false是回填后复检，初始空态使用单独保存的structural-initial。审查未运行UI/API或测试。
