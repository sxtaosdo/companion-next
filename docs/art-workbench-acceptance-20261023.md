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
