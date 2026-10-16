# 原 AI 资源任务正式接线（第22片，1.3.172源码已验证）

基线源码：8dd699da615f8fdcca0cb60e7abf6367e3a0662b / 1.3.171。该版正常工作区静态 ZIP 已独立冻结，不吸收本片未验修改。

用户已批准将临时页面接入原正式功能。父任务于 2026-10-15 再次确认可继续原 AI 写链；这里只实施 dot 源码与 fake 离线回归，不执行真实 GPU、模型、Creator 导入或工程写入。

## 实施顺序

1. 复用已核 v150 原操作：已有任务运行、恢复原任务、候选审阅选择、窄导入及 CPU 尺寸导出；维持原任务身份/版本、逐次确认与 UNKNOWN 禁重放。
2. 核对原 inspect/enqueue/adopt 请求准备和旧 UI；仅在合同齐全后接入原任务创建，绑定当前工程 HEAD 与已保存规范版本/hash，不以页面草稿冒充封存配置。
3. 独立源码复审、定向及最终相关完整回归、既有构建和静态核验后另行形成新交付。旧包不更新、不混用测试结果。

## 必须保留的边界

- 原任务 dispatchAccepted 只表示派发被接受，返回快照可能是执行前状态；后续仅读取同一任务，不把 HTTP200 当作生成/导入完成。
- 生成或导入结果未知时，不用重新创建、换页面、换来源或取消请求解除屏障；原 resume 只处理原任务，禁止另发生成请求。
- 候选人工选择必须绑定已校验预览的 SHA 与当前任务；服务返回 productionVerified=false，导入待验证不等于场景引用、Preview 或 Build 通过。
- 参考图仅作为原合同封存证据，不作为模型图像条件；不新增裁剪/通用图片上传/外部 URL 或 Token 搬运。
- 原后端链路存在；实际选中的 Python、工作室、CLI、Pillow 路径与文件哈希仍待实机核验，源码测试不证明真实链路可执行。
- 独立只读、配置编辑、知识问答及 Picker 构建不增加 AI 写入能力。注册仅在正常工作区，真实操作仍依赖原合法会话和每次明确确认。

## 已落地源文件与原接口

- `ai-task-creation` domain / adapter / store / panel：只允许一个 icon，资源名称、用途、画面和 Advanced 技术字段复用旧表单语义；目标路径由当前已保存 v2 规范派生，禁止任意目标或外部URL。原 `inspect` 返回任何已有目标（包括 REUSABLE）均禁止 enqueue/adopt。
- `ai-job-actions` domain / adapter / store / panel：固定 run-next、resume、select、import、export-variant；候选必须经字节/PNG/CRC/SHA与实际 img load 核对，再允许人工选择。原UI唯一选图保留；wire合同合法1–2不扩大页面能力。
- `ai-write-coordination`：正常站点 Web Locks + 小型 localStorage fence，未知结果跨页保留；无锁/损坏/无法持久化均不发送。只协调本Next站点，不冒充原后端幂等或锁住其他客户端。
- `ai-resource-snapshot` / `ai-job-acceptance`：严格投影原任务封存规范及已存在验收证据；没有任意路径/URL/quote。Owner手工确认与自动化UNKNOWN、服务 productionVerified=false 分别呈现。
- `AiJobsReadPanel` / `RegisteredProjectResources` / `AiResourceReadView`：相同已登记工程、相同provider/source/路径；历史与候选跨步骤保留，离开操作步骤撤销未派发确认；已派发保留屏障，不声称后台取消。
- `main.ts`：仅 normal workspace 注册两个惰性writer，页面加载不生成、不选图、不导入、不自动读取任务或配置。

## 传输、恢复与回执

所有请求沿原同源Cookie/Origin；不读写token，不持久新凭据，不调用通用代理。资源配置/任务读取在取消、超时后仍跟踪底层fetch、body read/cancel和异步digest；writer在这些I/O完成前不跨过写入边界。清理拒绝不证明结束，保持屏障。

创建请求冻结一次runId，重新核对已保存配置hash、HEAD、模式和可信adoption source SHA，然后inspect并提交。持久化之前/之后的错误分别报告；enqueue/adopt失败可能已留下封存文件，不能把普通HTTP失败当纯未发送。显式恢复只读保留的原完整请求对应的原任务，并核对服务编译后的requestHash、封存配置/参考SHA和来源SHA；重载仅剩最小fence时不猜完整输入，也不清除保护。

run-next/resume/import返回执行前快照及dispatchAccepted，不能充当任务完成。后续状态必须同工程/任务/requestHash/sourceRevision、版本不回退。导入UNKNOWN不重试；只有更高版本与明确导入效果/租约终态才能解除该fence。尺寸导出UNKNOWN不能用任务状态猜成功；没有原图导出文件回执核对合同，继续保持保护。

CPU尺寸导出仅原封存v2规范和唯一保存候选；单尺寸1..4096且面积≤1600万，等比contain留边，双边都超1024才是原合同upscale，并另行明确接受不增加细节。导出PNG不导入Creator、不改场景/meta、不等于生产验收。

## 逐页验收边界

| 页面 / 步骤 | 本片可核源码行为 | 仍需真实验收 |
| --- | --- | --- |
| AI图标 / 资源规划 | 显式读取配置与HEAD，冻结单图，检查并入队或采用可信PNG | 实际选中依赖、封存文件/持久队列、原会话 |
| 生成素材 | 明确GPU批准后执行原任务，UNKNOWN仅恢复原任务 | 真实运行中服务、GPU/队列/一次提交与结果 |
| 视觉审阅 | 当前候选PNG/SHA及显示事件后才可保存一张选择 | 真实浏览器显示与Owner风格/用途批准 |
| 导入绑定 | 原1024母图窄import与单尺寸CPU导出，回执/状态分开 | 原CLI可能启动daemon，实际assets/meta与UUID、导出像素 |
| 运行验收 | 投影原阻塞/Owner手工记录，仍显示生产未证 | 真Creator场景引用、Preview、Build、当前产物对应证据 |

没有扩展裁剪、通用资产字节上传、网页Codex生图API、自动批量生成、自动重试或新后台；旧Picker按Owner供图范围保留，不恢复采集开发。

## 最终验证与交付边界

- 最终 run `AI-WORKFLOW-022-FINAL-V2` / session42026 / exit0，2026-10-15T15:06:16Z—15:08:03Z。
- 88个测试文件、3737项测试通过，无失败/跳过；直接本地vue-tsc类型检查通过。
- default、companion-readonly、companion-config-editor、companion-knowledge-chat、companion-workspace五构建通过；正常工作区base `./`。
- 56静态测试通过；正常产物6文件，全部路径/资源图/SHA另经inspectStaticCandidate核验。无链接、源码map或外部资产引用。
- 独立只读源码复审闭环：来源SHA、原创建UNKNOWN恢复、fetch/body/digest drain保留锁、离开步骤未派发撤权、旧图片DOM事件隔离、导入内外终态一致性均覆盖。
- 上一session16741全测试通过但两处测试wrapper类型注解失败，未进入构建；修复仅测试类型cast后最终v2整套重新执行。没有将失败或早期结果当作最终通过。
- 0.1.14 / .17 / .18 / .19 / .20 / 1.3.171共六个冻结ZIP字节数/SHA仍相符。Windows未操作，新候选与旧包分开。

关键回归：`ai-task-creation-*`覆盖冻结单图、编译hash/adopt来源、已有目标阻止、UNKNOWN原请求恢复与active离步；`ai-job-actions-*`覆盖五原动作、单张审阅、动态步骤撤权、跨tab锁、迟到/清理与内外导入状态；`ai-jobs-read-*`与`resource-config-production`覆盖真实项目/source隔离、当前DOM图片显示、六步状态保留；`knowledge-conversation-bootstrap`覆盖只有正常模式注册；`help-about-navigation`覆盖版本1.3.(150+22)。

机器可读证据：`docs/evidence/ai-workflow-022.json`。这些结果是离线fake与DOM测试，不等于真实浏览器、GPU、Python、Creator或Windows部署验收。原后端链路已存在，待核运行条件与端到端结果不描述为“没有生图服务”。
