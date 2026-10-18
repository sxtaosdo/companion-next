# 弹窗中搜索快捷键保护（2026-10-18）

状态：Accepted，恢复用户已批准的旧UI交互。旧web/src/app.ts:3459在body.modal-open时忽略快捷键；Next CompanionBrowserView.vue:84只排除输入元素，CLI/登记安装/Creator弹窗内按钮或正文按/时会聚焦背后工程搜索。此前Preview/Profiler已部署9319ddd/.48，当前会话/用户窗口不动。

计划：在原快捷键入口检查三个已有弹窗开关及实际可见modal dialog，保留普通页/搜索、输入框、修饰键、调用/日志标签原行为。仅Next前端；增加真实按键回归、只读review、串行类型/必要构建后现有静态发布。不触碰鉴权、Creator/模型/安装/配置。


## 验证

修复前新增CLI弹窗和可见modal两例确实失败（原handler抢走/并preventDefault）。修复后3文件92项通过，包含隐藏modal恢复搜索和修饰键保持原行为。只读review未发现具体回归；最终严格类型与workspace构建通过。

邻接类型修复：.48最后更新runtime状态文案后，原MigrationView两处“尚未迁入”字面量比较触发TS2367；.48初始strict发生在该文案变更前，不是最终文案版本的strict通过证据。本片改为参数string的isNotMigrated比较函数，运行语义不变，最终strict已验证通过。前轮“strict通过”记录按此更正。类型失败时未构建本片候选；最终产物包含该修正。

沿用上一片静态路径/产物检查（55通过/1平台跳过），本片未改打包机制，不重复全套。后续独立Edge验证三个实际弹窗和原生modal的焦点，以及关闭后恢复搜索；仍不执行任何业务POST/安装/Creator。
