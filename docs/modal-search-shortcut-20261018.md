# 弹窗中搜索快捷键保护（2026-10-18）

状态：Accepted，恢复用户已批准的旧UI交互。旧web/src/app.ts:3459在body.modal-open时忽略快捷键；Next CompanionBrowserView.vue:84只排除输入元素，CLI/登记安装/Creator弹窗内按钮或正文按/时会聚焦背后工程搜索。此前Preview/Profiler已部署9319ddd/.48，当前会话/用户窗口不动。

计划：在原快捷键入口检查三个已有弹窗开关及实际可见modal dialog，保留普通页/搜索、输入框、修饰键、调用/日志标签原行为。仅Next前端；增加真实按键回归、只读review、串行类型/必要构建后现有静态发布。不触碰鉴权、Creator/模型/安装/配置。
