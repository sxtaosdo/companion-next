# 知识认证恢复及双启动验收（2026-10-19）

结果：当前401已修复。恢复同一个既有DPAPI文件路径引用与原retrieve-only权限，保持原0.3.147全部310安装文件。没有装载VS Code候选，没有系统重启、模型/P1060启动、真实客户端配置写入或日志清空。

## 根因与最小修复

原浏览器session成功，401 AUTH_MISSING由Companion的IsolatedKnowledgeAdapter缺credentialFile时直接发出，早于worker/WeKnora；不是浏览器登录失败，也未证明上游key失效。上次切换仅继承环境，丢失原接入脚本的临时引用。旧搜索成功属于之前带引用启动的实例。

scripts/connect-knowledge-reader.ps1现将同一既有路径持久为User环境引用，拒绝替换不同现存值，只stat原文件、不读取密钥；每次从User引用读回Process环境再调用原CLI。增加StartOnly/NoBrowser，精确旧进程退出后使用原CLI正常start且不操作用户窗口；默认guarded restart不放宽。旧脚本不受支持的--json启动参数同时移除。语法AST检查通过，credential_architecture_review独立静态复核通过。

本次首轮10820→18564，随后清除临时Process引用，再从正常脚本入口启动18564→4264。第二次从持久User引用恢复并通过同链，证明不依赖前一个临时PowerShell会话。未经该入口重新加载用户环境的旧父进程，仍须刷新环境；不宣称进程环境可以自动热更新。

## 精确进程与锁边界

每轮捕获在线认证identity/epoch、实际安装entry SHA、精确Windows句柄/创建时间、已知boot锁完整SHA/PID/writer/openedAt及inode。锁自身不含epoch；绑定来自同一capture的认证identity和OS句柄，未虚构锁字段。冻结DRAINING后再核身份/generation/保护文件及任务计数。首轮保留UNCLASSIFIED_HTTP_1事实，在用户明确强杀且无需保存数据授权下中断，不冒称SSE或全排空；其余专用业务计数0。第二轮包括http在内当前计数均0。

只Terminate精确句柄，不杀进程树。确认退出后，以Windows不覆盖目标的rename保留已核验旧boot锁，保留原字节与inode；未知锁不触碰，不清UNKNOWN。两个retired sidecar留在原目录，不是数据迁移。journal/head/legacy锁、原工程/预设配置及9张业务表一致。新原.147用原wx路径启动，每轮实际新身份、entry SHA与OPEN状态均验证；不以CLI exit0替代实际启动。

## 两轮真实只读链

固定原授权KB，选同一2235B小文本，文档与分片查询均限1；不遍历全库。两轮各7项POST实际200：kb/list、kb/view、doc/list、doc/view、chunk/list、doc/download、search。正文只在自有浏览器内显示，API→UI hash对应；证据仅保留IDs/计数/hash，不归档正文、标题或原文文件。关键词复用已成功的shidai3，限1命中1，无问答/模型。

分片count1且truncated=true表示限1的真实边界，不是全量切片验收。原文2235B、truncated=false，两轮SHA相同3f232d48e83e4cc64752ab234b5065362d5f88aa5d68ccba8440e94c46a6624f。blocked/pageErrors均空；每轮知识验收session POST1次，自有Edge均关闭，用户浏览器未接管。最终静态SHA复核另用一次短会话、未打开浏览器；此前未带会话的静态GET403属预期鉴权，不是知识401复发。

## 实际版本与保持

当前PID4264，epochb4ad0920-0c1a-4add-889e-cde005e96e6f，原宿主9b8f979/0.3.147，entry SHA aa703700e04116f3a03352ed63fc59e39e46cf82c0645202a408810086becc6f；全部310安装文件原字节一致，因此未装载.148/.149候选。实际HTTP三份Next静态SHA与安装文件一致，仍ecabe7e/内部1.3.173.131、页面1.3.173；本轮无静态部署。共享22修改及21受保护源码保持，9张业务表保持，UNKNOWN2、archived0、quiescence证据0。

#19仅按原reader已批准只读主流程关闭，当前矩阵11通过/8部分/2暂停或阻塞，21组等权52.4%不是工作量进度。写入、问答、同步及模型暂停范围不由本次代证。普通guarded stop仍保持原保护；实际应用切换按既有精确强杀授权执行，未新增维护框架。

证据目录：[两轮API/UI与进程、静态SHA回执](evidence/knowledge-auth-recovery-20261019/)。原运维完整回执Temp/companion-kb-recovery-20261019/{first,second}，不复制带locator/token的私有启动输出。VS Code隔离代码保留且暂停，不再作为当前迁移阻塞。
