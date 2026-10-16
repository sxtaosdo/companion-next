# Companion 1.3.171：原图标任务历史、状态与候选只读接线

已核构建基线：daemon 0.3.150 + Next 21；不是实时宿主版本探测。仅本轮独立 Next 源码与 fake 测试；未对实际工程、Python、GPU 或 Windows 服务发送请求，也未部署。

## 已核合同与接线

复用已批准的自有原实现，不增加第三方代码、依赖或协议。完整 snapshot、assets、candidates、import 字段与交叉引用来自 v148 `mcp/src/companion/icon-adapter.ts:28–68,183–210`；v150 交接确认四个图标实现模块未变。Python 读取路径的副作用边界来自 2026-10-15 v150 脱敏合同，不据操作名推断纯内存查询。

- GET `/api/icons/{16hex}/jobs`：原列表、HEAD、profile 与最多100个任务。
- POST `/api/icons/{16hex}/status`，严格 `{jobId}`：原任务快照。
- POST `/api/icons/{16hex}/candidate`，严格 `{jobId,candidateId}`：原 PNG 字节。
- 原 Cookie、同源模式、禁止重定向、不缓存、不提取或复制凭据；没有 query、任意路径、外部图片地址、轮询或重试。
- 三路均只在用户明确点击时运行。构造、注册、挂载、选工程、选任务和切页不触发任务请求。只读 POST 仍会执行原 Python，读文件/Git，并可能运行 Pillow 候选 QA；取消浏览器读取不能证明后台已停止。
- 主接线由宿主实现，仅正常 workspace 注册；`companion-readonly` 不增加这组 Python-backed 读取。

组件 `AiJobsReadPanel` 接收 `{project:{id,name,path}|null, source:object|null, provider?:AiJobsReadProvider|null}`；省略 provider 使用被动注册的 `aiJobsReadProvider`。复用在原 AI 页与资源步骤3/4，无新导航。每个挂载面板持有独立状态，避免另一个面板离页取消当前面板。

## 状态与证据保真

保留11个原任务状态；不创造 completed/succeeded。`unknown`、`import_unknown` 没有恢复/生成/重发/导入动作。`dispatchAccepted` 回执不能作为 status 成功；HTTP200不代表原工作完成。`import.effectApplied` 与 `leaseState` 分开保留，租约释放不代表未写入；`imported_pending_verification` 不等于场景、Preview、Build 或生产验收通过。

snapshot 逐字段投影，核工程/任务身份、revision、sourceRevision、requestHash、预算、资产/候选/选择唯一性及归属。未知字段不进入UI；额外 productAcceptance/resourceSnapshot 不在本面板投影，并明确独立人工验收与封存证据未展示，不能据任务 productionVerified=false 否定独立人工验收。路径只作惰性文本，不用作访问入口。

本次列表 HEAD 与每个任务的 sourceRevision 单列；generated status 不重新核当前产品 HEAD，不得据状态读取声称当前 HEAD 匹配。最新单任务快照与其实际读取时间共同缓存，切回任务仍展示对应的时间；失败刷新清除当前详情，不能把旧快照包装成新结果。更低revision或同任务requestHash/sourceRevision变化拒绝。

## 有界读取与候选显示

- 列表/状态 JSON 4MiB；候选 JSON 13MiB；最多4096块；20秒；最多3个未结算读取。受控失败 envelope 单独8KiB。
- 槽位直到实际 fetch、body read、body cancel、迟到响应清理和异步摘要校验都结算才释放。超时或离页只结束本页等待，不提前释放实际未结束 I/O 的预算。
- 候选 canonical base64 最大12MiB（字节最大9MiB），核 PNG签名、CRC、chunk顺序/边界、1024×1024/8-bit RGBA、SHA-256与已选任务快照一致。
- 为安全和可测试性，客户端只接受 IHDR、连续 IDAT、IEND 和单块不超过256KiB的 tEXt；APNG、压缩元数据和其他 chunk fail closed。这是客户端受控子集，不能据拒绝断言原候选文件损坏。可能需要后续已核样本才能扩大兼容性。
- 仅用校验后的 `data:image/png;base64` 显示；无远程图、任意 URL、SVG、文件下载或写操作。浏览器解码失败清图；结构/SHA通过不是透明度、语义或视觉验收证据。没有修改 CSP。

工程 ID/name/path、登记 source、任务 reader、选择、取消、关闭候选和离页各有代次隔离。A→B→A不会接受旧A响应；候选绑定完整任务快照与SHA，刷新状态/换任务清除旧预览。换provider清除读取结果。相同登记快照不误清结果。

## 失败语义

401/403保留原认证含义。只有已核HTTP与`error/code`一致、`retryable:false`的闭集可展示具体原因：503的 ICON_ADAPTER_DISABLED、ICON_CONFIG_INVALID、IMAGE_PROCESSING_UNAVAILABLE、ICON_OUTCOME_UNCONFIRMED；429的 ICON_WORKER_BUSY；404的 PROJECT_NOT_FOUND；502的 ICON_SCHEMA_INVALID、IMAGE_RESULT_INVALID。未知响应、路径和底层诊断不回显；不把原retryable当作写重试许可，不自动启动模型、补配置或生成任务。

## 验证边界

fake传输与Vue DOM测试覆盖精确端点/方法/正文、被动构造与挂载、11种状态、导入不确定性、工程/任务/候选归属、有界解析、PNG/SHA拒绝、全部未结算I/O预算、明确单步点击、迟到/换工程/换provider/离页、失败清空与时间保真。本片最终本地验证：3份定向测试共85/85通过；vue-tsc --noEmit通过。整合与构建结果另记在主任务验证记录。

曾有将编辑与 `npx vue-tsc --noEmit` 合并的命令遭安全审查拒绝，原因是 npx 触发 registry.npmjs.org 网络访问不在任务授权内；前段源码编辑已落盘，未重施。后续按本轮明确授权，仅直接调用预先安装的本地 Node 编译器/测试器，不做解析下载或安装。未重复外网请求。

未验证实际Python执行、Pillow与候选原字节兼容、Cookie实机会话、生产任务/导入效果、浏览器真实像素和Windows服务。三路合同与本地测试可支持本轮源码接线，不能替代实机验收。
