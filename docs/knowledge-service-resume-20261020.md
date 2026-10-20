# 2026-10-20 原知识库服务恢复与原 reader 只读复验

按最新明确授权，先审查既有入口及依赖，再恢复原知识库服务；旧CLI等待和reader worker错误分类两项代码窄修仍等待批准，均未修改或部署。本次没有重启Companion，没有创建/更换reader凭据或扩大权限，没有安装、系统service/autostart/持久执行策略变化，没有启动模型、推理服务、Creator、P1060或VS Code，也未迁移旧数据。

## 实际恢复结果

- 既有`D:/services/weknora/Start-PilotAccess.ps1`一次执行，exit0，原运行EXE SHA b05899bc8ccaf299f8d5b5bb7c131cedf81491e51b02906b4321d72c10d6ce64；**WeKnora PID600，127.0.0.1:8081，health200**。Companion始终PID7156/32180/OPEN、原epoch与entry70df不变。
- 原stdout2634B、stderr0B和旧数字pid均以唯一无覆盖名称原对象保留，未读取历史日志内容；原入口按原路径写新日志/pid。`metadata-before.json`未改，原入口重新核验运行文件与状态守卫，不绕过任何失败条件。[启动回执](evidence/knowledge-resume-20261020/start-result.json)
- 原reader、同一KB da1051a5-3fff-4198-ba55-017ea79df9c3，**6项逻辑只读POST＋2次status GET均200**：kb/view、doc/list限1、doc/view、chunk/list限1、doc/download、search限1；没有执行kb/list，也没有全库正文遍历。
- 显式详情/分片/原文目标仍97c5935f-6114-43e9-8ead-d0319f61ab9a。2235B原文未截断，SHA `3f232d48e83e4cc64752ab234b5065362d5f88aa5d68ccba8440e94c46a6624f`与昨天一致；分片限1/truncated=true，非全量分片验收。搜索`shidai3`限1，命中另一文档414acc…，与昨天结果hash一致，不能称所有读取仅涉及同一文档。正式worker固定keywordOnly=true，CLI使用no-vector，没有问答/推理/重索引。[只读结果](evidence/knowledge-resume-20261020/reader-result.json)
- 状态由原缓存auth=denied/keyword=unverified变为**auth=verified、keyword=verified**。原程序正常加载既有reader与签名secret，代理未检查或展示明文key；不能说所有进程均未加载凭据。公开key3权限/expiry元数据前后一致，不靠改权限或换身份恢复。

本轮为API级限定复验，不冒充新一次页面点击/截图验收；历史API→UI证据和未改动的静态版本保持。Companion sync writer/scheduler=false只是该同步投影，不能据此声称WeKnora全部维护cron关闭。

## 启动前的独立安全门禁

[独立报告](evidence/knowledge-resume-20261020/safe-start-review.json) SHA a4f6f264c0d5bff1074c1dd56273d411638ff1dd0d9336cafe881cf7167eb9be：5个exe/DLL与原manifest一致；schema30/dirty0、quick_check ok，10类触发表为空，临时KB0，原知识任务状态guard匹配。正常守卫校验1650条知识的任务状态元数据；不读取全库正文。仅原disabled MCP端点允许存在。

启动环境封闭，无Redis、自动迁移/脏恢复/housekeeping、bootstrap-admin或credential-hash回填；源码的Lite任务注册不enqueue，空task_pending_ops/data_sources等没有自动ingest/index/reparse任务。Ollama/model相关构造器仅创建客户端，不启动模型或调用Pull/Chat/Embed/Generate。服务端编译入口不加载.env，YAML不重新注入os.Getenv；签名loader只读已有secret，缺失/不安全即拒绝，不创建或改ACL。

少量空闲cron/维护线程可以存在，不能称全部scheduler关闭。既有PowerShell Bypass仅原客户端进程级参数，未改持久策略。服务运行仍保有原功能，本次仅调用原reader的retrieve范围，不新增全局“只读模式”或权限方案。

## 最终保护与剩余边界

02:07 UTC最终只读核对通过：Companion312运行文件（相对此阶段起点70df包，不是旧.147）、共享22修改/21保护文件、9业务表、UNKNOWN2及native历史保持；WeKnora知识任务状态hash、状态分布与计数前后一致（knowledges1650、chunks59433、lite_embeddings2272、auth_tokens38、users2、tenants2），10触发表仍0，原baseline保持。没有schema修复、状态重置或新凭据。[保护结果](evidence/knowledge-resume-20261020/final-protection.json)

核验脚本最初额外要求服务子进程数量为0；实际唯一子进程是系统`C:/Windows/System32/conhost.exe`。已按真实镜像路径收窄该核验，保留首次after-state文件，未改变运行程序；没有模型子进程，Creator进程0。

恢复8081后同一reader链200，证明**当前**已有凭据正常、限定读取已恢复；无需授权变更。历史403仍缺阶段trace，不能倒推每次首个失败都已到fetch或唯一根因。已证的“8081不可达阻断＋旧worker网络异常误归403”机制及CLI8秒等待/无probe截止问题仍见[并行调查](postboot-two-blockers-diagnosis-20261020.md)。CLI/worker两项旧代码修复尚未获准、未实施；当前知识库服务可用不等于这些潜在误报缺陷已消失。

历史21项仍13通过/6部分/2暂停；本轮恢复#19当前可用性，不新增通过条目。真实客户端接入、生产日志清空、真实调用分页/失败详情和暂停模型链等仍按原边界，96变体/Preview/Build/Smoke不重做。原Creator历史首500唯一根因仍未知。
