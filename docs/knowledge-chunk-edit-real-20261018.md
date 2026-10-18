# 关键词分块编辑实测与并行差距核对（2026-10-18）

本轮已继续修复并部署同一关键词模型依赖错误。**原生测试库分块API编辑→新旧词命中互换→原TXT恢复通过；整体新后台仍未全部验收对齐。** Next身份和IDE投递已并行完成只读核对，没有越过凭据或草稿保护边界。

| 分支 | 具体结果 | 剩余边界 |
| --- | --- | --- |
| 关键词分块编辑 | 已修复、部署并实测通过 | 只验收原生前端正常API，未宣称Next编辑控件或所有KB配置均通过 |
| 无摘要任务 | 测试文档SummaryStatus=none、pending=0；定向回归零enqueue | 不能泛称任意summary_enabled=false都无任务；已有摘要文档仍保留原摘要刷新行为 |
| Next知识身份 | 只读定位完成 | 同源Companion会话不等于WeKnora API身份；当前无热设置入口，未做正向身份接入 |
| Codex投递 | 只读定位完成 | 现有入口可能覆盖主窗口草稿，未做真实写草稿或剪贴板操作 |
| Cursor投递、既有三TXT上传/reparse测试 | 复用已通过证据 | 没有为补次数而重跑旧验收 |

## 修复、部署与保护

Next任务检查点9445216；服务源码从clean277acc4建立任务检查点后修改，最终clean commit b469ba0fc6c5070cf752d0b33e7d0fdb97bed420。仅最小syncChunkIndex及共享维度helper等相关源码变更：keyword-only不构造嵌入客户端，使用已有模型元数据Dimension保留旧清理维度；清理用原composite，写入用知识库策略过滤视图，空通道在索引Delete前拒绝。vector与既有摘要行为保留，未改UI、模型配置、身份或全局策略。

两包15项顶级定向测试通过，含bound/unbound、summary none/completed、禁用分块、元数据异常、空通道和vector保留。没有重跑不相关全套测试。独立源码、哈希和保护审查无新P1/P2；原11项Windows改动、25项reader overlay及round2候选保持。源码本地分支未推送。

沿原KnowledgeServiceClient stop/start、原runtime路径部署，仅替换EXE并更新原manifest、保留历史修复记录；四DLL、启动脚本及startup baseline原字节未改。停止后备份旧EXE、manifest及SQLite二进制文件留在任务Temp，没有提交DB/EXE入Git。最终服务PID23608，只监听127.0.0.1:8081；EXE SHA b05899bc8ccaf299f8d5b5bb7c131cedf81491e51b02906b4321d72c10d6ce64。修复提交由clean源码、文件SHA和manifest绑定，不冒称EXE内有本地VCS标记。

## 真实编辑与恢复

仅写KB c5f0a1bd-5748-4716-ab5c-36f08378a3c0 的01-amber-lantern文档420b32ba-7b7c-4e02-b217-67dae10290a1，另外两篇不写，原1647篇不处理。

1. 前置读取确认原文等于虚构TXT、分块c9c6635b-ade9-442a-9c51-00dfe0fdc7ea/revision0/ready、文档completed/pending0/summary none、KB keyword=true/vector=false。
2. 通过现有原生前端正常API执行一次PUT，expected_revision=0；AMBERLANTERN731改为AMBEREDIT731ONLY，虚构风筝数量由17改19。响应和只读回读均revision1/ready、正文符合编辑，summary none/pending0。
3. 仅对精确文档执行有界关键词搜索，match_count=3、disable_vector_match=true、knowledge_ids限定01；新词1条、旧词0条，命中已编辑分块。
4. 先核对revision1及已知编辑内容，再对同文档正常reparse一次，从未修改的源TXT恢复；显式关闭摘要/多模态/语音/问题/图谱/抽取。这是新编辑后的必要恢复，不是重复旧验收。
5. 原词1条、新词0条，命中新生成的source chunk，正文SHA与原TXT精确相同。其余两篇前后分块/索引快照逐对象相等。最终3个ready分块、3条keyword索引、3个FTS映射、dimension0、0个1024维vector映射。

既有编辑API会TrimSpace，故未用PUT声称恢复尾换行；精确原文恢复由source reparse完成。API先保存正文再重建索引，失败时可能正文已保存/index_status=failed；本次修复保护的是异常下Delete前的旧索引，不宣称整次编辑原子回滚。

编辑前控制台输入控件曾不可用，执行器在SetValue/Enter之前终止，未发业务请求；恢复现有DevTools后才执行一次编辑。实际回执为1编辑、1恢复、4搜索，未重传或盲重试。请求参数依据[实际执行输入及SHA](evidence/kb-chunk-edit-real-20261018-request-config.json)，不是独立HTTP抓包。

## 最终原状态

原1647篇选定元数据SHA仍400e49c75b77cc45e16cb96cd6d21ecc47bc0b5df144886fce698d400b68efcd；chunks59428/indexRows2269/vectorMappings2264、migration30/dirty0保持。未查询原文正文；选定字段/计数不等于完整内容逐字节证明。

原Creator21004/session b0471fa2-0879-4f30-b27f-7038dd6ef8cc仍ready，Companion18036及bundle身份保持；模型7292/3260未操作。三登记文件原字节、cocos-mcp/原游戏/变体工程Git快照保持。原9个浏览器标签及先前选择恢复，只关闭自用DevTools；没有关闭原窗口。合法测试修订/重处理留下的自有文档历史不伪称数据库字节未变。

## 准确的后续确认事项

Next：适配器仅在构造时捕获WEKNORA_API_KEY，没有从原生浏览器JWT自动转交或热设置。已有status/CLI兼容/缺身份拒绝证据可继续引用；当前授权不足以读取或注入API秘密。最小下一步需明确批准通过现有受限reader的正常加载流程，仅进程内临时使用（不打印/转存/持久配置/扩大scope），先reader-identity核对真实scope/expiry，再在原guarded重启边界下只验其允许KB的列表/metadata，之后撤回临时使用。旧脱敏元数据里的ID3不等于本轮已认证，且其scope不自动包括本次新测试KB。metadata成功也不等于adapter.auth=verified，不能为状态绿而擅自跑search。

Codex：现入口codex://new?prompt=先复制完整文本再OS打开，只填草稿、不自动发送，没有接收回执或可靠only-if-empty保护。最小确认需指定已保护原草稿的主窗口空白首页输入框，只填唯一marker、核对后删除、不发送；从Next按钮验还需允许临时更改剪贴板。没有这个目标确认前不投递，不能把它说成需要笼统解除模型暂停。

[身份只读报告](evidence/kb-chunk-edit-real-20261018-next-identity-readonly.md) · [IDE只读报告](evidence/kb-chunk-edit-real-20261018-ide-readonly.md)

## 证据

[真实断言](evidence/kb-chunk-edit-real-20261018-accepted-results.json) · [响应/检索](evidence/kb-chunk-edit-real-20261018-browser-final-receipts.json) · [部署](evidence/kb-chunk-edit-real-20261018-deploy-deployment.json) · [离线回归](evidence/kb-chunk-edit-real-20261018-offline-tests.json) · [恢复视图](evidence/kb-chunk-edit-real-20261018-native-restored-content.png) · [本轮证据哈希](evidence/kb-chunk-edit-real-20261018-manifest.json)

独立最终只读审查确认23项manifest、4份请求源SHA及上述局部结论吻合，无新P1/P2；没有额外重跑业务。
