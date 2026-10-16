# 正常工程操作模式：状态与基础生命周期

## 0.1.18当前交互变更

用户明确批准start/focus点击直接执行，点击即是冻结目标的一次授权；不再展示二次确认框或成功后的常驻回执。其它动作保留必要确认。下述原合同、副作用与UNKNOWN/来源/单飞边界继续有效，旧0.1.14的“逐次确认弹窗”交互由此更新。详情见`compact-project-ui-018.md`。

## 0.1.14完成标准与构建

0.1.14恢复正常模式的第一条完整工程操作链：连接原同源会话 → 真实工程状态 → 核对工程 / 来源 → 明确启动或聚焦 → 独立回执 → 再读当前状态。它不是全功能迁移完成，也不把CLI说明当原按钮的替代。完整剩余项见 `feature-parity-current.md`。

- `npm run build:companion-workspace`：相对 base `./`，输出 `dist-companion-workspace`，入口由原宿主同源静态目录提供，hash路由 `/projects`。
- 仅 `http://127.0.0.1` 的此模式注册 Creator 操作provider；这只是传输边界，不是认证证明或部署批准。
- 首次页面加载 / provider构造零请求；用户点击连接才读工程 / 状态 / 调用统计。
- 旧 `companion-readonly` 继续只读登记和被动记录，永不注册启停provider，不自动状态探测。配置编辑、上传、知识问答仍分别留在既有专用模式，没有被本次正常模式偷偷合并。
- 新模式仍需单独安排部署与实机验收。本轮只有dot源码和fake测试，没有真实POST、Creator启动 / 聚焦、Windows操作、CIM、凭据搬运或服务部署。

## 真实合同与副作用

v148原源码闭包已核；v150原维护线程再次只读确认（2026-10-14）。v150合同bundle SHA256：`39e88c9045e5d8266b059ce2b1ceb48cf522c5d0afc5f4596658c4545ae6641e`。行号为原bundle，非本仓文件行号。

| 请求 | 响应与语义 | 副作用 / 边界 |
| --- | --- | --- |
| GET `/api/projects` | 直接数组，id/name/path与可选requiredCreatorVersion | 要求版本是登记时检测值，不是当前Creator版本。原行37591/39082/31776 |
| GET `/api/status` | 直接数组，projectId/state，creatorVersion/sessionId/pid/capabilityProfile等可选 | 会探测Bridge creator.projectInfo，可能移除路由缓存、改变生命周期、写诊断日志；不是无副作用读取。原行37606/39537/38944 |
| POST `/api/projects/:id/start`，body `{}` | 对应工程RuntimeState对象；ready会聚焦，否则Dashboard启动并等Bridge | 可导入Dashboard工程记录/打开应用。**不装Bridge、不配置Codex**。原行37715/39093/32670 |
| POST `/api/projects/:id/focus`，body `{}` | `{ok:true}` | 可经Bridge/Dashboard查找进程并原生聚焦。回执不证明窗口已到前台；不会替用户启动工程。原行39106/32507 |

不存在浏览器GET `/api/projects/:id/status`。新模式没有添加该猜测路径，也不自动调用 `/api/dashboard/projects` 发现（Windows可能CIM）。状态真实八态与真实Creator版本展示；缺状态仍未知，不默认已停止，不拿requiredCreatorVersion冒充实测版本。

原Cookie会话、127.0.0.1 Host、POST严格Origin继续由宿主执行；不读取/存储token，不发Bearer，不增CORS或代理。维护可503，恢复屏障可409。已核DashboardFault为409/不支持501且retryable:false；普通500 `{error}`不能证明无副作用。

## 旧setup不能偷换成普通启动

旧主卡“启动”实际上走setup（startCreator=true/configureCodex=true），添加向导则显式configureCodex=false。setup会登记、安装Bridge、可能配置客户端再启动；省略两个flag都默认true，且同trim路径活跃操作复用，后来的false不能撤销先前true。这个持久配置流程本片尚未迁完。

本片卡片清楚标为直接启动 / 打开已有工程，单独说明未接入工程仍需安装接入流程。ready主按钮走focus；stopped/crashed/incompatible/error才允许start，启动中/等Bridge/停止中或未知状态不猜测可重复启动。单独focus允许对已登记目标请求聚焦，不承诺其运行中。

0.1.15继续恢复stop/restart源码，精确边界见 `creator-stop-restart.md`。0.1.16已补目录打开与移除登记源码，见`project-registration-actions.md`。完整添加setup向导、Preview/Profiler等仍未迁完。原stop返回stopped不证明进程退出，不能升级该回执语义。

## 确认 / UNKNOWN / 并发边界

- 确认冻结完整id/name/path/required版本、真实状态、两provider身份/标签、读取时间与递增快照revision。必须显式点确认，一次性消费，重复点击不能二次发送。
- 仅start/focus/stop/restart四个固定POST、精确两个请求字段、body固定空JSON；id必须16位小写hex。任意路径/操作名/附加字段都拒绝。
- 确认期间暂停工程自动轮询；SSE/日志/调用保留。关闭恢复轮询。手动刷新、来源/工程/连接变化仍撤销确认，不能发送旧目标。
- 发出后可停止等待、关闭或离页；这只停止前端等待，**不是后台取消**。回执持续保留原目标/来源/动作，晚到响应不得挂到新目标。
- HTTP200启动回执与当前ready分开，聚焦回执与窗口视觉分开。成功后仅在原页面/来源/工程上下文仍有效时回读；清理期间换来源/离页不自动读取新来源。
- 超时、断线、取消、形状错误或不明确错误保留UNKNOWN。后台报告失败也可能有部分影响。原工程须在不确定性产生后发起并完成一次真实状态读取，才能重新明确确认；旧在途GET不能解除保护。回读不把旧UNKNOWN改成成功。
- 传输超时120秒、响应128KiB/512chunks。abort不被底层配合时，发送锁仍保留直到fetch/read/cancel真正settle。无法证明清理结束则失败关闭，不能靠换来源解锁。
- 后台没有Web operationId/lease/fencing/持久幂等；仅start规范路径有内存Promise复用。前端单飞和冻结确认**不能证明跨tab恰好执行一次**，也不能消除其他客户端同时更改工程的竞态。
- 回执与UNKNOWN记录为页面会话内存；浏览器刷新会丢失，不能宣称跨刷新幂等或自动恢复。操作不确定时先查原状态/日志，不刷新页面后盲目重发。

## 验证边界

测试使用与真实schema一致的合成fixture，所有fetch/provider均fake；测试计数见 `validation.md`。无真实用户工程/数据、网络、启动/聚焦或真实浏览器窗口验收。源码独立复审与测试并不等于部署后的完整迁移验收。
