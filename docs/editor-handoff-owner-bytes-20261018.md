# 旧编辑器唤起与图片 owner 字节核对（2026-10-18）

状态：Accepted；任务检查点，基线2711b67/.57，部署源7bc072d/.56。仅Next自有文件；旧共享22项不动，PID2100和普通用户Edge会话保留。

旧web/src/agent-handoff.ts固定cursor://anysphere.cursor-deeplink/prompt?text=和codex://new?prompt=，encodeURIComponent完整原文；URL超过8000字符改用完整剪贴板+短提示。app.ts2286先成功复制再assign，3155在用户点击时调用；帮助、CLI和安装完成的data-copy-block共用。恢复相同按钮和行为，不自动发送、不安装、不HTTP传输；页面/工程失效或剪贴板失败不唤起。正常workspace显式注册，普通只读模式不增加操作能力。

图片原public-image-review v0.1.0.20三源SHA匹配bridge/launch_picker.py固定值。原app.py只在独立owner宿主提供GET /api/state、/image/<process-token>/<32hex-id>/thumb|full；X-Review-Token和同源安全头保持。Next现有createHostedImageReviewProvider只在独立/companion/宿主注册，32180/next正常workspace未注册，不具备自动跨服务接入。继续核实原缓存字节与当前路由，真正需宿主/权限的项给最小方案，不擅改旧daemon、不新增代理/CORS/持久token或下载。

验收合并一批：必要针对回归、一次最终strict/build、只读review及一次部署验收。协议导航在测试中拦截，不实际拉起外部应用；图片不触发搜索/下载/chooser。

## 本批实现与离线证据

三类原copy-block均恢复发送到Cursor/Codex；仅normal workspace注册固定本机协议能力。完整复制完成才唤起，8000字符上限沿用原fallback；失败提示不包含底层异常。页面/工程/对话框变化取消迟到导航。所有原复制与交接共享剪贴板锁，关闭后仍等待原异步复制结束，避免旧工程文本覆盖后续长文本交接。reviewer发现的全局锁缺口及过期帮助文案已修复并复核关闭。4文件78项必要回归及最终strict通过。

图片真实owner源码版本0.1.0.20三SHA均与现有launch_picker固定基线一致；原缓存找到1组ready原图/缩略图，通过原TaskStore.asset_path/path只读检查，原图SHA与manifest一致，10个缓存JSON SHA不变。未运行TaskStore构造/load/save或恢复逻辑；没有下载、模型、目录选择、导出或新监听。此证据只证明真实缓存字节，不冒充HTTP预览/Next绑定闭环。证据Temp/companion-editor-owner-20261018/owner-bytes-readonly.json。
