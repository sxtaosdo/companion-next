# 2026-10-20 writer-only 启动修复及真实结果

用户明确批准原 common-host 启动身份/可靠性窄修。隔离代码检查点 `7965c4b`，基线 `5b39b55` 来自原安装 daemon71cb 的82项自有源码；没有在共享 cocos-mcp 源树写入或构建。候选精确覆盖6文件，未改原 quiescence anchor、Windows采样、CLI、旧UI、Next页面、Creator算法或权限。

## 当前真实结论

|项目|实际结果|证据边界|
|---|---|---|
|同bootId/不同PID4的writer准入|已恢复，PID7156，32180，OPEN|[运行回执](evidence/boot-writer-20261020/readonly-live-result.json)、[OS与监听](evidence/boot-writer-20261020/process-listener-proof.json)|
|原正常入口首次启动|未完整通过：CLI8秒等待超时/exit1；同一个child约13.769秒后已写locator并就绪|没有重发start或另启child；不能把最终可访问写成初次入口返回成功|
|Next现有页面/静态文件|index与原asset均200，SHA不变；UI仍a8e88ac/内部1.3.173.146|没有重建或部署新版UI|
|原reader真实鉴权链|状态200但auth=denied，授权KB元数据403/AUTH_DENIED|不是200通过；未更换凭据、未解密展示、未调整读者权限|
|历史与共享数据|UNKNOWN2、quiescence0、旧锁原字节及inode保留，原anchor/journal/head/legacy/handoff、9业务表不变|[保护结果](evidence/boot-writer-20261020/preservation-after-start.json)，310个其他运行文件不变，共享22修改与21保护文件不变|
|项目/调用只读|7个登记项目200，counts及选定项目调用页200；本次新内存session为空|不注入调用凑分页，不计真实失败详情/分页通过|

新daemon SHA：`70df42a8f84e6bf9d32c050919fcb91565ff4b53ff9f85a3b1e50664d267ca65`。只替换daemon/map两个文件。OS进程创建身份与v2锁绑定一致；核验脚本曾遇到PowerShell7 JSON自动转DateTime导致七位字符串比较差异，规范化后相等，不是产品身份改变。

## 机制与验证

仍争用原 `.boot-<raw GUID>.lock` 的wx锁。首次v1迁移由独立编译的WRITER_ONLY绑定固定原锁字节/hash、旧locator完整identity、当前OS元组及原anchor摘要，旧PID必须两次正面不存在。后续v2锁携带实际OS创建身份；活的原owner拒绝，PID复用只观察不控制。原锁通过独占Win32文件句柄验证单链接/普通文件/大小/hash后原对象rename保留，禁止覆盖既存目标。取锁后再次核验自身owner；失败只清理本次持有的锁。

原 `newBoot/proof/verifier` 仍要求boot GUID和PID4 lifetime同时变化。本轮同GUID不能获得Native退出证明，不写quiescence或归档UNKNOWN。v2恢复仅覆盖该异常元组分支，不宣称所有陈旧锁或启动故障均可自动恢复。

独立真实Windows回归35/35，包括10次既存目标冲突、原对象/文件名不变、硬链接/重解析/hash/size拒绝、原生并发至多一保留、实际NativeMaintenance.open+v2锁/post-open重检、UNKNOWN2及proof拒绝。集成原日志链30项后65/65，tsc --noEmit通过；两个独立只读审查无剩余P1/P2。

首轮隔离测试发现原生文件名缓冲缺结尾WCHAR，可使源保留名附随机Unicode字符；修正为额外清零WCHAR、FileNameLength仍不含终止符后回归通过。该首候选从未部署，没有覆盖真实目标。布局按[微软FILE_RENAME_INFO约定](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_rename_info)。保留首轮失败与调查证据于独立Temp报告；不掩盖测试发现。

## 功能对齐与下一步边界

历史21项限定主流程仍13通过/6部分/2暂停，61.9%仅为等权条目率；不是当前可用率。#19保留历史通过证据，但今天当前鉴权已被403阻塞，不能继续称当前KB已恢复。剩余#5/#13/#14真实客户端接入、#10真实清空、#11真实分页/失败详情、#16未执行模型链仍未完成；#20/#21暂停。原96变体PNG/meta/UUID、场景重开/Preview/Build/Smoke不重做。Creator首500唯一历史根因仍未知，本次boot错误不替代那个结论。

发现两个具体后续点：①原CLI固定8秒等待小于本次13.769秒真实启动，可提出有限延长等待、保留早退/单实例判定的窄修；当前批准边界未扩展到CLI，所以本轮只记录，没有顺手改CLI。②原reader403需进一步只读确认授权侧原因；任何reader授权/权限更改必须另行明确批准，不通过放宽权限换取200。本轮没有改Windows安全设置/Fast Startup、重启电脑、启动Creator/模型/P1060、修改真实客户端配置、清空生产日志或发布上传。

源码及复现测试作为[冻结证据](evidence/boot-writer-20261020/REPAIR.md)归档；运行代码仍是已验证的精确overlay，Next本次版本仅为文档/检查点，不代表UI重部署。
