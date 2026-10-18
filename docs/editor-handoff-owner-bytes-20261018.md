# 旧编辑器唤起与图片 owner 字节核对（2026-10-18）

状态：Accepted；任务检查点，基线2711b67/.57，部署源7bc072d/.56。仅Next自有文件；旧共享22项不动，PID2100和普通用户Edge会话保留。

旧web/src/agent-handoff.ts固定cursor://anysphere.cursor-deeplink/prompt?text=和codex://new?prompt=，encodeURIComponent完整原文；URL超过8000字符改用完整剪贴板+短提示。app.ts2286先成功复制再assign，3155在用户点击时调用；帮助、CLI和安装完成的data-copy-block共用。恢复相同按钮和行为，不自动发送、不安装、不HTTP传输；页面/工程失效或剪贴板失败不唤起。正常workspace显式注册，普通只读模式不增加操作能力。

图片原public-image-review v0.1.0.20三源SHA匹配bridge/launch_picker.py固定值。原app.py只在独立owner宿主提供GET /api/state、/image/<process-token>/<32hex-id>/thumb|full；X-Review-Token和同源安全头保持。Next现有createHostedImageReviewProvider只在独立/companion/宿主注册，32180/next正常workspace未注册，不具备自动跨服务接入。继续核实原缓存字节与当前路由，真正需宿主/权限的项给最小方案，不擅改旧daemon、不新增代理/CORS/持久token或下载。

验收合并一批：必要针对回归、一次最终strict/build、只读review及一次部署验收。协议导航在测试中拦截，不实际拉起外部应用；图片不触发搜索/下载/chooser。

## 本批实现与离线证据

三类原copy-block均恢复发送到Cursor/Codex；仅normal workspace注册固定本机协议能力。完整复制完成才唤起，8000字符上限沿用原fallback；失败提示不包含底层异常。页面/工程/对话框变化取消迟到导航。所有原复制与交接共享剪贴板锁，关闭后仍等待原异步复制结束，避免旧工程文本覆盖后续长文本交接。reviewer发现的全局锁缺口及过期帮助文案已修复并复核关闭。4文件78项必要回归及最终strict通过。

图片真实owner源码版本0.1.0.20三SHA均与现有launch_picker固定基线一致；原缓存找到1组ready原图/缩略图，通过原TaskStore.asset_path/path只读检查，原图SHA与manifest一致，10个缓存JSON SHA不变。未运行TaskStore构造/load/save或恢复逻辑；没有下载、模型、目录选择、导出或新监听。此证据只证明真实缓存字节，不冒充HTTP预览/Next绑定闭环。证据Temp/companion-editor-owner-20261018/owner-bytes-readonly.json。

## 已部署与真实边界

4aaeedf/.59已部署，先备份46旧文件，仅新增hash资源和原子替换index，旧hash资源保留。6个原始HTTP文件SHA一致。独立Edge7场景通过：帮助Cursor/Codex、工程Agent/Skill两段、剪贴板拒绝不唤起、关闭工程后迟到复制不唤起、当前workspace不伪注册图片owner。浏览器只替换一个固定Location.assign传输边界为内存记录器；clipboard也是独立上下文内存fixture，用户剪贴板不读写，真实应用打开0。截图editor-handoff.png已目视查看。长文本8000回退在针对性测试覆盖，本次四个实际页面文本未达到回退阈值，不将其记为浏览器长文本验收。保存/安装/Creator/模型/图片搜索下载0，PID2100/epoch/OPEN不变。

正式独立session的GET证实32180下 `/api/state`、`/api/companion/capabilities`、`/companion/` 均404。先前CompanionApiClient直接访问这些legacy路径返回403只是没有legacy Cookie，不可用来证明路由存在与否；正式session结果为准。Next图片provider仍为null，原真实缓存144024字节原图、7821字节缩略图只读SHA证据不能代替页面HTTP预览与保存闭环。

证据：`C:/Users/33272/AppData/Local/Temp/companion-editor-owner-20261018/` 中 browser-proof.json、deployment-result.json、owner-bytes-readonly.json、final-protection.json。旧共享22项HEAD/status/binary diff及dirty字节SHA、daemon bundle与本批前保持相同。

## 图片 owner 的最小接入方案（待决定宿主，不实施）

优先复用已存在Next自有 `bridge/launch_picker.py`，不改旧Companion：用已匹配三SHA的owner源和既有Python环境、独立production静态包、明确指定的owner cache启动原loopback桥接，入口为该owner宿主 `/companion/#/image-assets`；它已有GET bootstrap/token、guarded capabilities、state及原 `/image/<process-token>/<id>/thumb|full`，前端也已在该模式/路径注册provider。需要明确owner宿主启动窗口和缓存接管范围，因为原load_last/CacheLease有恢复与写缓存行为；本轮仅只读缓存，不接管、不新建监听。先验证缓存图片HTTP字节SHA与解码、切任务/断连迟到拒绝；原guarded选择/chooser导出另按真实写入范围验证，不下载新图。

若必须保持现有32180单宿主，需要旧Companion新增明确的same-origin owner服务接入/命名空间合同（状态、限定ID的thumb/full、guarded操作及会话鉴权），之后Next才可绑定；这超出只改Next范围，不能用跨端口fetch、手填token、CORS或任意文件URL代替。本轮未自行实施这个新合同。

## 剩余必需项

- 五客户端MCP配置：缺只读GET，现有注册POST不能作为状态查询。
- 严格部分安装：复用任务必须回显原有效options/配置身份，才可证明执行范围。
- 图片owner：上述宿主接入未实施，真实预览/选中/目录保存未验；缓存字节核对已完成。
- 模型、Agent问答、知识同步继续按用户要求暂停；不启动模型。
- 真实Creator/Preview/Profiler及外部编辑器OS协议处理器验收待相应窗口；受控传输验收不冒充真实应用执行。
