后续状态：既有知识库服务已按授权恢复，原reader限定只读链全部200，auth/keyword verified；CLI/worker代码仍未改，历史首错分支仍未知。见[02:07恢复结果](knowledge-service-resume-20261020.md)。下文保留先前时点的调查/阻塞记录。

后续授权状态：父线程已允许通过既有入口恢复知识库服务，前提是先确认不会连带启动暂停模型/推理或其他越界效果。当前正核查依赖；CLI等待和worker分类代码修复仍等待用户批准。下文保留01:52调查阶段结论与边界，后续服务结果另记。

# 2026-10-20 启动等待与 reader403：并行只读根因和最小方案

本轮按明确委派独立并行调查；没有重新部署/重启/替换运行实例，没有新监听、模型、Creator、P1060、VS Code或旧数据迁移。PID7156在最终01:52 UTC复核仍OPEN、OS创建身份不变、32180监听归属一致，UNKNOWN2和旧锁原对象、共享22修改/21保护文件、310个其他运行文件及9业务表均保持。[保护回执](evidence/postboot-diagnosis-20261020/final-preservation.json)

## 1. CLI 8秒等待：确证的旧宿主缺陷

真实安装 `creator-ai.js` SHA bc1e15920a33e388a6d5cdc8347a9bec93fbe7cc719e7208cc8b112feeebca53，安装map对应旧宿主 `mcp/src/companion-cli.ts:235–265` 的 `startDaemonAndDiscover`。函数启动detached child后硬编码8000ms截止，每100ms轮询locator和status；到期抛DAEMON_UNAVAILABLE并退出1，不终止child。因此当前首次入口报超时与同一child随后监听并不矛盾，超时不能被说成daemon确已启动失败。错误呈现也没有明确说明后台可能仍启动。

另有独立确定的问题：`status()`调用未传AbortSignal，外层只在循环边界检查截止；一个尚未结束的fetch可超过名义8秒。仅改数值不构成严格有界等待。

时间证据须校正：**13,769.405ms是OS进程创建→locator对象createdAt的间隔**，不是实测首次HTTP200或精确listen-ready耗时。源码先await listen，再创建该时间，之后才持久化locator。identity.startedAt→该时间13,231ms，进程创建→identity 538.405ms；没有本次各阶段计时日志。

实际NativeMaintenance.open隔离夹具确认异常元组首次迁移路径含10次boot采样、7次owner观察、1次真实native保留；生产实现各自是顺序PowerShell/CIM或Add-Type调用。这证明结构成本，不能把13.769秒全部归给某一调用，也不支持删减或缓存掉安全重采样。其他初始化、文件/链验证和调度也在区间内，具体占比未知。

最小提案属于**旧宿主CLI**：将启动预算改为经过审查的较长有界值（30秒仅为当前隔离实验候选），利用已有`client.request(..., AbortSignal)`给status探测施加剩余截止；保留即时child退出判断、鉴权成功才能就绪、每次命令仅一次spawn。超时应表示“就绪尚未确认，已启动PID可能仍继续”，不自动kill、restart或再spawn。无需修改Next或全局status默认行为。精确性能优化需另获阶段计时/未来启动验收授权；本轮不为测量重启PID7156。

已独立完成：真实安装函数假时钟6例均通过，覆盖8秒误报、永不就绪、立即就绪、child早退、仅提案30秒可覆盖13.769虚拟就绪、单个probe越过8秒。实际open定向测试1项通过，34项未选择，不冒充新跑35项。提案30秒没有投入生产。[独立完整报告](evidence/postboot-diagnosis-20261020/cli/CLI-WAIT-INVESTIGATION.md)

## 2. reader403：确定不可达和错误归类，真实首个失败分支仍未知

当前原目标 `http://127.0.0.1:8081` 无监听；不带凭据的`/health`没有HTTP响应，Windows10061/ConnectionRefused。相关进程/服务名称未发现，不证明为何未运行，更不能擅自归因未自启、崩溃或权限拒绝。

原User引用仍指向已批准的reader路径，文件仅stat为普通非重解析620B；没有读取/解密其内容。只读数据库仅投影key3的8个公开授权列，tenant1、tenant scope、full_access=false、唯一KB da1051a5-3fff-4198-ba55-017ea79df9c3、retrieve、到期2026-11-08T01:25:46.685460+00:00、revoked=null均与昨天一致。worker07c4861及到期小数修复保持；当前daemon知识链5个模块与昨天17:31成功KB元数据200时点的71cb源码完全一致。[连续性](evidence/postboot-diagnosis-20261020/source-continuity.json)

安装map实际旧宿主 `knowledge-worker-core.ts`：16–20行固定请求`/api/v1/auth/reader-identity`；21/28行检查HTTP或identity；93–94行先load credential、再verify；99–100行通用catch把非KnowledgeFault异常也变成AUTH_DENIED403。`knowledge-isolation.ts:75–77`随后缓存readerAuth=denied，status200只投影缓存，不是一次独立鉴权健康检查。

实际安装核心在VM中执行的3个隔离例均通过：合法公开metadata→成功；fetch抛ECONNREFUSED→AUTH_DENIED403且后续backend调用0；真正HTTP401→AUTH_DENIED403。FS/process/network/真实credential调用均0，KnowledgeFault形状使用stub。由此确证网络失败被错误归类为身份拒绝的机制。

**不能越过证据的限制**：真实请求在fetch前会加载DPAPI；现有协议只给settled/code/status，没有阶段记录。因此不读/解密内容、不运行真实认证的本轮，不能确认生产403的首个错误已到fetch，不能证明DPAPI加载成功或当前DPAPI→key3绑定。公开metadata一致也不能证明文件内容。可以确证当前流程必被8081不可达阻塞；不能把当前403当成WeKnora已拒绝原权限、过期/吊销或需要更换身份的证据。[完整只读发现](evidence/postboot-diagnosis-20261020/reader/readonly-findings.json)

最小代码提案在**旧宿主knowledge-worker-core.ts**：在fetch边界把连接/超时/取消与真正身份/范围拒绝分开，使用现有封闭错误码和安全消息（例如连接失败UPSTREAM_UNAVAILABLE503），保留原identity、KB、capability、expiry检查；不笼统把所有TypeError都当网络错误，不输出原始错误或凭据。合法身份拒绝仍403。已有daemon的denied是既有缓存；worker分类修复本身不会追溯证明鉴权或自动改成verified。

服务恢复属于另一运行操作：需明确批准后才可恢复**既有8081 WeKnora服务**，不得顺带启动模型；随后按原身份/同一KB的限定只读验收确认。无需为当前不可达而改reader权限、延期、创建凭据或改用其他身份，也无需先重启Companion。本轮既未恢复上游，也未调用真实worker认证。

## 范围与已完成项

|事项|归属|本轮完成/下一步授权|
|---|---|---|
|Next固定KB请求、状态独立性、403安全投影|新后台|3项定向隔离通过；源码未发现需改问题，不制造产品改动|
|启动预算、probe截止、超时呈现|旧宿主CLI|精确源码与6例隔离已完成；需批准该窄代码修复及后续正常入口验收|
|网络错误分类|旧宿主worker|精确源码与3例隔离已完成；需批准保留授权校验的窄修和验证|
|8081服务恢复及原reader只读确认|既有服务运行操作|需要单独明确批准；当前不操作，不改权限/凭据，不启动模型|
|历史各阶段耗时、真实403首分支|证据限制|现有记录不足；不能通过猜测关闭，也不为追踪自行重启/解密|

本轮所有可独立完成的只读/隔离核查已完成，生产部署0、daemon start/restart0、reader认证请求0。历史21项13通过/6部分/2暂停口径不变；#19当前应标“上游不可达，鉴权未验证”，不是确认权限被拒。其余真实客户端接入、生产清空、真实调用分页/失败详情、模型链等未因本次调查而提升。
