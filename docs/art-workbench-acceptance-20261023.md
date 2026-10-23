# 美术工作台首批实际交付（2026-10-23）

当前唯一入口 `http://127.0.0.1:32180/next/index.html#/art-resources`。前端1.3.191、构建6f286934+working；后端0.3.152、构建cb2d2e80d849-2eaeb0f9a49f，PID28520/OPEN。构建标识为构建当时事实，后续源码提交不追写该构建。

## 已实际验收

仅e2e-project / 16ad921aa0fb06d6：已保存规范v2 → 新建固定96×96规格 → 新建继承规格需求 → 绑定既有真实任务STUDIO-RUN-icon-mvklx7yu-93d3c165；四次UI保存均200/completed。工作台v4、hash 77df6c5e354b9e98564b74c32b6ce3967ead8a56f704c3beb34a73cb4656ce05。整页刷新重读后规格、需求、引用及任务绑定保持。

项目层参考经现有上传API归一，真实预览并比对sha f361acafb8bd9922470fc4cf7548a42a91c3424cb57f8432459f1cc9c4b3f03a；落在测试工程art/reference/companion目录。规格/需求层引用的作用域、晚回及未知保护由隔离组件/合同测试覆盖，没有声称三层都现场上传。1440宽与390窄屏实际渲染、无页面异常；等待侧栏过渡结束再判窄屏，document/body均390。

10工程保留，5份已有规范字节hash均保持，包含4060正式规范。未操作Creator、GPU、城市游戏、密码或用户会话注销。仅一次正常停止原PID45244并经原npm入口启动；入口误报LOCAL_START_FAILED，但同一次启动实际产生PID28520/OPEN，无二次启动。

## 测试与复用

相关前端整合123项和版本/日志16项通过、vue-tsc/Vite通过；主线程另独立28项为前述子集，不重复计数。宿主56项唯一相关测试（工作台18含2项真实HTTP）通过，构建及类型检查通过。独立review发现的确定拒绝恢复、未知409分类两项P2均修复；最小10项复审与跨工程上传晚回探查通过。OCR本地Delegation分组及宿主手工规则审查完成；硬只读隔离未核验。

复用现有规范读取、PNG/JPEG/WebP上传归一、哈希预览、任务读取、CAS/操作回执；未新增认证或路径权限。未知保存保留输入/原操作查询，确定拒绝允许用户修正后再保存，不自动重发。未知上传保留最小作用域记录并禁止重传，迟到回执只能明确恢复到原层；移除只撤草稿关联，不删除文件。

## 仍未完成

本批关联的是已有真实任务，没有从需求表新建或批量执行生成。参考图实际入模、风格一致性及人物/UI生成未实现，不以上传或历史任务绑定冒充。整页刷新后的未知保存恢复未验证；同页/跨工程保输入有测试。启动包装误报另保留。

原始证据与备份：`C:/Users/33272/Documents/Codex/2026-10-17/task/art-workbench-delivery-20261023/` 内delivery.json、ui-{spec,reference,need,binding,readback}.json、data-readback.json、before-data、before-installed。SQLite在线备份integrity_check=ok。恢复只在正常停止本宿主后按deployment-plan核验并还原原目标，旧index最后写入，保留后续用户数据；不删历史或新hash资产。


## 第二批：准备任务与整页恢复（2026-10-23，现场验收完成）

- 项目规范仍为唯一权威来源。已保存图标需求通过原 Studio inspect/enqueue 准备真实任务，冻结规范、规格、单项输入和引用证据；不调用 run-next/resume，不把任务创建等同图片生成。
- 单项和顺序批次逐项记录 created/rejected/unknown/not-started；遇未知停止后续，查询原操作并显式恢复关联，不自动重发。人物、UI及参考图入模能力仍未接通。
- 保存恢复记录跨整页刷新保留原 operationId 和草稿。独立审查发现并修复瞬时存储失败丢快照、旧页面覆盖未知操作两项缺陷；复审及真实浏览器证据以本批任务目录最终记录为准，不以单测冒充现场。
- 宿主相关10文件79项回归与TypeScript通过；取证采集器2.2.26显式同窗能力有隔离证据和上限，不代表P1060实战P95达标。现有取证按钮尚无战斗步骤入口。
- 现场更新前备份、预检通过后才正常停止本应用。保护用户登录、10工程、5份规范与城市游戏，不清历史，不新后台，不重启Windows。

证据目录：`C:/Users/33272/Documents/Codex/2026-10-17/task/art-workbench-phase2-20261023/`。源版本与实际运行版本须分别核实；本节不预先声明已部署或新GPU生成成功。

### 第二批现场回执（更新首批未完成项）

前端实际1.3.192/e4bd2402+working；宿主0.3.153/6b6b6db08d3f+working-13aa985c6d48，PID23612/OPEN。同一32180，10工程、5份正式规范hash保持，原用户会话不注销。

在e2e真实页面新建需求acceptance-prepared-20261023，并仅提交一次准备请求，得到任务STUDIO-RUN-workbench-5435056f8e11469d9bd74e864e42fdc2-7abb3488，状态queued。冻结摘要2a32b3eef6a34c95b0028085b2a982fd7d8aee278e22d5c40d187e23284df977；工作台v6/hash764fb34a5a2ae9bd2c40ac628a206a11e4c1000a730d9a20032fb461ad42f23a。刷新重读确认任务关联保持，未执行GPU、未产生新图或prompt ID。

实际构建页面的未知保存整页恢复使用明确网络夹具：1次POST、刷新后保留草稿及原operationId、1次原操作查询恢复；真实项目写入0。此证据验证界面恢复，不能冒充真实故障任务已经恢复。187项前端、79项宿主、14份collector功能脚本、4组独立存储故障探查通过；15个安装目标hash及6个静态HTTP产物核验。

启动误报另已修复并现场复用验证：npm start -- --no-browser返回0，仍PID23612，无第二启动或窗口；33项隔离回归和独立复审通过。冷启动故障分支由隔离测试覆盖，本次现场只证明已运行服务复用。

完整回执delivery.json/live-need.json/live-prepare.json/live-readback.json/browser-reload-fixture.json及备份位于上述phase2目录；启动回执在task/startup-wrapper-20261023/live-reuse.json。场景绑定、Qwen Edit参考入模已获后续实现批准，当前正在独立实施，尚无真实绑定/推理通过证据。P1060战斗入口后续接线不属于本批已完成验收。

### 后续采样交付与实际边界

2026-10-23：前端1.3.193、后端0.3.154同32180/PID40784恢复OPEN，15安装目标及6静态HTTP hash核验，10工程和5规范保持。P1060经现有页面先预览再点击“战斗取证”；operation web-profiler-1792756061360-12678304-84f0-472b-b1b8-9d3bbecc6a3f，两个UI请求均200，无直接Creator调用。窗口5dcbca7c-a9a4-44d0-8868-8291b2b51722保留846帧、0丢帧，P95=18.2ms；战斗12.34%、空闲82.74%、未知4.92%，状态insufficient/UNCONFIRMED。角色自然通关草原后等待选区，不能把此混合窗口当持续战斗性能通过；源/编译/页面身份仍unknown。完整证据task/p1060-samewindow-20261023/actual-window-summary.json与battle-ui-capture.json，原完整文件在P1060/temp/creator-ai-bridge/profiler/capture-1792756086186.json。

启动脚本复用服务验证成功；本次单次冷启动最初返回readiness-unconfirmed，随后只读核验同一启动PID40784正常OPEN，没有第二次启动。冷启动确认预算问题继续修复，不称启动包装冷启动已完整通过。

冷启动确认预算后续纠正：官方CLI内部8秒就绪观察早于wrapper原65秒进程上限返回，旧额外10秒观察导致约18秒就停止确认。现改为一次start与后续只读观察共用原65秒，单次读取最多10秒、不加整体超时、不二次启动；37项虚拟时钟/真实协议隔离测试通过且主协调独立重跑37项。源码脚本已在原启动入口生效；不为验证此修复再次重启当前健康服务，最终冷启动现场验证留待下一次必要启动。证据task/startup-wrapper-cold-20261023/delivery.json。
