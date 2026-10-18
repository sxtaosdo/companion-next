# 旧编辑器唤起与图片 owner 字节核对（2026-10-18）

状态：Accepted；任务检查点，基线2711b67/.57，部署源7bc072d/.56。仅Next自有文件；旧共享22项不动，PID2100和普通用户Edge会话保留。

旧web/src/agent-handoff.ts固定cursor://anysphere.cursor-deeplink/prompt?text=和codex://new?prompt=，encodeURIComponent完整原文；URL超过8000字符改用完整剪贴板+短提示。app.ts2286先成功复制再assign，3155在用户点击时调用；帮助、CLI和安装完成的data-copy-block共用。恢复相同按钮和行为，不自动发送、不安装、不HTTP传输；页面/工程失效或剪贴板失败不唤起。正常workspace显式注册，普通只读模式不增加操作能力。

图片原public-image-review v0.1.0.20三源SHA匹配bridge/launch_picker.py固定值。原app.py只在独立owner宿主提供GET /api/state、/image/<process-token>/<32hex-id>/thumb|full；X-Review-Token和同源安全头保持。Next现有createHostedImageReviewProvider只在独立/companion/宿主注册，32180/next正常workspace未注册，不具备自动跨服务接入。继续核实原缓存字节与当前路由，真正需宿主/权限的项给最小方案，不擅改旧daemon、不新增代理/CORS/持久token或下载。

验收合并一批：必要针对回归、一次最终strict/build、只读review及一次部署验收。协议导航在测试中拦截，不实际拉起外部应用；图片不触发搜索/下载/chooser。
