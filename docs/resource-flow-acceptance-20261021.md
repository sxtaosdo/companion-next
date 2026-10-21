# 资源流：真实类离线验证与恢复条件

## 2026-10-21 11:53 UTC：Creator入口约束与当前真实边界

用户原话（11:52:23 UTC）：**“你对cocos creator的所有操作都要用开发者后台”**。所有真实打开、关闭、导入、刷新、构建等动作都必须从后台现有UI发起；失败就修后台，不得用Dashboard/CLI/脚本/exe替代。后台内部正常调用不受影响；只读日志/代码诊断可用。已记入本项目AGENTS.md，并通知所有执行者。

- 11:27:47、11:29:34两次是32181工程页“启动Creator”，分别409/最终超时；对应历史属于32181，正式32180未登记测试工程。
- 用户批准仅使用全局索引的测试条目后，约11:44使用本机脚本直接调用复制运行包的DashboardLauncher.launch，列表只过滤获准的测试路径。这**不是UI入口，不计UI启动验收**，也不产生Companion调用历史。不得补造历史。
- 虽launcher报告超时，Creator实际主PID22628于11:44:07.506 UTC创建，父Dashboard12528；测试工程temp/startup.json pid相同，进程project参数匹配测试路径。11:45:53独立后台UI显示该工程已就绪。后续只用后台UI，不再次脚本打开。证据records/e2e-creator-open-evidence.json、e2e-ui-20-creator-observed.json。
- 11:47从32181真实UI确认import-variant一次，HTTP200仅dispatchAccepted，尚未出现目标PNG/meta/UUID。11:53宿主OPEN、当前全部在途0，不代表导入成功；原任务仍selected、UI未决保护保留。
- 定位版本合同不匹配：测试Studio来自P9000 main fbceaea，prepare-import仅接受jobId/revision/approved，拒绝宿主传入variant；其local-icon-import.ts也无变体合同。宿主异步catch吞错，未给UI可恢复的失败回执。历史96正确Studio是完整提交7e117fed/.42，而非main fbceaea。正在独立Temp恢复该完整提交并保留f4cedcf错误终态修复，尚未替换活服务/改任务。不得清UNKNOWN或手写成功记录。

下方11:33阶段记录及旧失败保留；本轮真实生成、预览、选用、导出已通过，但**UI打开工程及Creator导入/UUID重读仍未通过**。参考图入模仍未实现。


## 2026-10-21 11:33 UTC：隔离 Next UI 真实出图与导出，Creator 导入尚阻塞

**本轮已通过真实 UI：登记 → 规范保存和重读 → 输入 → 排队/执行 → 状态 → PNG 预览 → 选用 → 96×96 导出。Creator 导入、UUID/meta 重读尚未完成；参考图未入模。** 下方前次记录保留为历史，不代表本轮仍未出图。

授权：用户批准 loopback 32181 独立完整宿主、独立凭据/数据、一个隔离工程、额外一次 UI 生成；32180、正式工程素材不动，无下载、无付费。用户随后明确“重试”；本轮仅执行原有一个新任务，没有追加请求。

### 实际身份与回执

- 正式宿主始终 PID1840、OPEN、epoch 47159a25-f1b7-44d2-8466-bf661d281fd4。11:11 认证 API 与独立浏览器均读到7工程；直接未认证访问403。按原认证打开独立窗口后用户回复“好了”。没有重启正式宿主。
- 测试宿主 PID20456 / epoch49139b5f-f713-4309-a069-d2e2969c5fc5，后经官方 daemon stop（PASSED）、确认PID/端口退出后，普通启动为 PID23336 / epochc7aa24c3-e9fe-4830-9839-c52dc0e3ded5。重载仅修复测试 allowlist 漏 ProgramFiles 的发现环境；原任务、凭据和图片保留，没有重跑模型。
- 同一完整 daemon SHA：9717bc798caaf6c709048e1f2dc6f84b9ffe290e5893583f0e1602bc77de8bf7；测试 Studio 仅 local_icons.py 使用 f4cedcf 已验证错误终态候选。测试 CLI guard 10/10 拒绝缺失/错误端点/身份，无32180回退；凭据仅测试 locator 与私有浏览器状态，不进入仓库。
- 通过 UI 201 登记真实 Creator3.8.8 scaffold：工程16ad921aa0fb06d6，目录 D:/CompanionData/art-generation-acceptance-20261021/e2e-project，HEAD138045f326033dabc63a9a6957fbf65fb3f1de99。
- UI 保存规范 HTTP200，version1，SHA6929cec0df96b243287efed1251b8f4645e5c28397e69ff9232d1f5eb876bcb5；画布1080×1920，icon96×96，透明PNG，目标assets/generated/acceptance，导出art/final/companion；UI另行读回相同字段。
- UI 新任务 STUDIO-RUN-icon-mvi0tih2-c9ac2e90，requestSHA be9f0856527035182384b7afd83db35ccb52b87f000251ab57d1fe20fc844a37，封存上述规范。UI run-next HTTP200 dispatchAccepted只算派发；终态另行读取。
- 唯一 Comfy prompt ebece44e-81e5-4ee5-95ec-52e80092170f，11:23:14 UTC提交，52.35秒执行，11:24:08回执 VERIFIED。固定 z-image-turbo-digital-asset-v1、1024×1024、8steps、1candidate、1attempt；启动日志明确加载 amd_batchnorm_fix.py 且出现 MIOpen bypass enabled。
- PNG SHA19b87e93e23cb116131fefa718fea11443f8ba98365a5adea483d73d33cfca90；RGBA/1024×1024，透明比例0.901524543762207、可见比例0.09762096405029297；costUsd0。真实 UI img complete=true，naturalWidth/Height1024、data-sha一致。已查看图像；测试选用不代表正式美术质量批准。
- UI select HTTP200，selectedIds唯一 CANDIDATE-acceptance-blue-crystal-1；UI export-variant HTTP200：art/final/companion/acceptance-blue-crystal-96x96-19b87e93e23c.png，96×96，SHA bc7898630727c26da62ee196da99652a6f9b0d2f9b64ba7cfcd5ed6891ff33ce，receiptSHA37eaae3c6f23211a368d3e24b22d15730cab445e88025ef1582b3db0805ad0bc。尚未写入Creator资产目录。
- 本次 Comfy 队列 running/pending均0后正常Ctrl+C，8188监听消失，无强杀。测试服务可重复启动，不注册常驻/开机服务。

### Creator 导入阻塞与隔离副作用

UI Bridge-only 安装202后查询完成；未勾Creator和Codex。其后UI启动Creator：首次409 DASHBOARD_NOT_FOUND，原因是测试环境漏保留ProgramFiles；修复后经官方流程启动隔离 user-data-dir 的 Dashboard（主PID23468），最终 DASHBOARD_LAUNCH_TIMEOUT，Creator进程未启动。没有绕过Dashboard直接启动Creator。

**发现未完全隔离的真实副作用**：Dashboard仍把测试工程登记到 C:/Users/33272/.Cocos/profiles/project.json（11:29:38 UTC、共10项，其中包含测试工程），而测试profile对应 .Cocos 索引不存在。该记录说明--user-data-dir不隔离Dashboard全局工程索引；不能宣称测试所有数据都已隔离。未证明其他条目发生变化，未回滚整个文件、未删该记录、未动正式素材。发现后暂停导入与Dashboard写操作；只读检查安装源码显示其工程目录使用global://project.json与Electron home相关profile。

继续前需确认官方支持的全局profile隔离方式；若无，应明确批准仅在Dashboard全局索引中登记/启动本隔离工程（不改其他条目、不复制登录凭据），并先验证实际Creator与Bridge/32181身份。不能把无响应当成功，不能为完成测试修改全局安全/账号设置。当前没有import-variant提交或UUID/meta证据。

### 可重复步骤与证据

1. 核对32180身份与测试端口/GPU空闲；以start-e2e-host.mjs启动32181；读取独立locator创建官方UI会话，认证信息不打印。
2. 通过项目页正常登记；step1保存并重读规范；step2准备、批准并enqueue，记录jobId。只允许一个新的UI执行确认，提交前wx哨兵避免不确定时重发。
3. 用官方AMD必要参数与模块启动已有Comfy；queue/object_info预检；UI选择原任务→状态→执行确认；只追踪同prompt，超时保留状态，不再enqueue或run-next。
4. step4原任务状态/保护记录核对→真实PNG预览→选择→独立确认保存。step5导出默认96→核对receipt/SHA/实际PNG。重新打开自己的浏览器可读回同任务，不生成。
5. **暂停门**：解决上面的Dashboard全局profile边界后，才继续Creator/Bridge→UI导入当前工程→PNG/meta/UUID/SpriteFrame读回。尚未通过，不能作为最终完成。

本轮证据根目录 D:/CompanionData/art-generation-acceptance-20261021/records/：e2e-ui-03-register.json、06-spec-save、08-enqueue、09-run-confirm、10-generate、12-preview、13-select、14-export、16-bridge-install、17/18-creator-launch；comfy-e2e-002.log、e2e-preflight-002.json、e2e-preparation-manifest.json。任务journal与原PNG在e2e-store/16ad921aa0fb06d6/STUDIO-RUN-icon-mvi0tih2-c9ac2e90/。临时driver在本机Temp，仅本机验收用，含私有浏览器状态的host-data不提交。

## 前次 11:03 UTC 检查点（历史）


## 2026-10-21 正式完整流程验收进展

结论：生产宿主已恢复，资源只读接口可用；完整新后台 UI 生成、选用、导出和导入链尚未通过。本轮真实任务失败，不能登记为出图或透明 PNG 成功。以下是当前状态；后文原始离线记录作为历史快照保留。

### 已取得的真实证据

- 08:20 正式宿主 PID 1840 为 OPEN，两个工程接口 200、7 个工程；历史账本保留两个 UNKNOWN、零条退出证明，登记表与历史 SHA 未变。只替换宿主 JS/map，备份在 `D:/CompanionData/host-repair-backup-2026-10-21T08-17-57-916Z`。
- 7 个工程的 resource-config 和 jobs 均为实际 HTTP 200；jobs 明确返回 `offline_import_only`、0 个任务。5 个工程规范 missing，2 个验收工程 valid。API 有效不等于整个 UI 流程已通过。
- 当前 GPU 实际为 AMD RX 6800 XT，PyTorch ROCm 可见一张卡；不是此前记录的 4060。固定五权重存在且非空。模型启动前空闲显存约 15.8 GiB，队列为空，固定 15 类节点和模型选项预检通过。
- 唯一真实请求：`STUDIO-RUN-real-gpu-20261021-aaa3a678`，prompt `ecb1e1e6-8c78-4078-8486-fcaacaa1d5f3`，09:11:01 UTC 提交；8 步采样和 VAE 解码完成，263.83 秒后 node13 RemoveBackground 报错，outputs 为空，最终 PNG 数量为 0，透明度未验证。没有第二次提交。
- 错误精确到 MIOpen BatchNorm 的 HIPRTC 编译，`miopen_type_traits.hpp:151` 缺少 `type_traits`。本机已有 `custom_nodes/amd_batchnorm_fix.py` 处理同一问题；本次测试仅白名单 GGUF，错误地跳过已有兼容模块。这是测试启动配置遗漏，不应据此要求安装依赖或改成 CPU 全流程。
- 已有 AMD 模块在自有短进程小张量 FP16 GPU 对 CPU FP32 数值检查通过，最大绝对误差 0.0024786；未加载模型、未提交 prompt。该检查不能代替重新加载模块后的透明 PNG 端到端验证。
- 原 CLI 因 ComfyUI `status_str=error, completed=false` 漏判错误而等到 360 秒，记 UNKNOWN。隔离候选修复了明确错误终态识别：32 测试通过、1 既有 junction 环境跳过，独立复审无 P1/P2。用候选仅 `--resume` 读取同一个真实 prompt，回执已 FAILED、原 operation 租约已释放；不 POST、不重采样、不创建候选。候选检查点 `f4cedcf9d9477421e37bdf4d0ee502f5e1d887bb`，尚未部署到正式 Studio。
- 队列 running/pending 均为 0 后，仅正常 Ctrl+C 关闭自有 ComfyUI PID 18984；未强杀，未重启生产后台。新后台仍为 offline_import_only。

本轮请求、服务日志、真实 history、收口前后回执及数值检查均在 `D:/CompanionData/art-generation-acceptance-20261021/records/`。输入 `request.json`、run-001、既有隔离工程的 Git HEAD 和哈希均保留；没有正式素材写入、模型下载或付费 API。

### 完整 UI 链路核对与验收门槛

正式界面路径是 RegisteredProjectResources；示例 workspace 中的占位按钮不作为实现证据。真实流程使用同一个已登记隔离工程、同一份 v2 规范、同一个 UI 创建的 jobId，所有步骤都核对真实 HTTP 与回执。

|步骤|现有入口/实现|必须取得的验收证据|当前状态|
|---|---|---|---|
|1 工程与规范|工程登记；`/resources?step=1` 读、新建、编辑保存 v2 规范|真实 registry ID、稳定 Git HEAD；UI 保存成功后重新读取，版本/SHA/字段相同|资源 API 可读；新端到端工程尚未纳管。原 CLI fixture id 不能冒充 registry ID|
|2 输入|step2 读取生成所需配置，填写一张图标的名称、用途与画面|输入来源绑定步骤1的规范 SHA/版本及工程 HEAD；inspect 返回真实目标缺失|控件与适配器存在；真实 UI 任务未创建|
|3 提交与状态|确认后 enqueue；step3 对原 job 执行 run-next/读取状态|仅一个 UI job 和一个 Comfy prompt，排队/运行/失败或成功真实变化，不整页刷新、不重复提交|生产模式明确禁止生成；独立 CLI 错误不是 UI 闭环|
|4 预览|候选实际图片预览，校验文件 SHA 与 candidateId|浏览器图片实际加载；1024 RGBA、透明度/边缘 QA，失败不可选用|本轮无 PNG，未验证|
|5 选用|step4 在实际图片预览通过后 select|选用 revision/selectedIds 与原 job、文件一致|未验证|
|6 导出|step5 默认尺寸/扩展尺寸 PNG|独立测试项目 art/final/companion 中真实文件及 receipt，重读 SHA/尺寸匹配|已有 CPU 导出证据保留，不代替本次生成图验证|
|7 保存到测试工程|现有 import-variant，目标仅隔离项目 `db://assets/...png`|真实 Creator/Bridge 导入结果、PNG/meta、asset/spriteFrame UUID 回读；失败不改写为成功|本轮隔离 fixture 缺 Creator 项目元数据且无 Bridge。不能用只导出 PNG 代替 AssetDB 导入|
|8 重读与重复执行|新独立浏览器重新进入同一工程、同一 job|规范、任务、选用、图片、导出及导入回执一致；第二次读取不再次生成；再次测试使用新 runId|未验证|

参考图目前 `referencesAsModelInput=false`，仅记录路径/SHA；不能宣称人物 IP、视角或参考图条件一致性已经接通。当前可执行的完整验收对象是已有单图标链，项目级全美术 schema 扩展沿用原方案，不在本次擅自新增 UI。

### 下一次完整验收的最小执行方案（待合并确认后激活）

1. 复用现有 Next UI 与完整宿主产物建立可重复的隔离验收实例，建议本机 `127.0.0.1:32181`。认证、locator、journal、协调库和资源 STORE 各自独立，只登记一个真实 Cocos 测试工程；正式 32180、7 个工程及其 offline 模式保持不动。它是同一产品界面和真实接口的验收环境，不是 CLI 替代或模拟后端。新增监听及 generation 配置先确认，不擅自启动。
2. 所有测试输入和文件固定在 `D:/CompanionData/art-generation-acceptance-20261021/`。由现有 scaffold 形成 `e2e-project` 的真实 Creator 项目形状、本地 Git 检查点，再由正常登记流程获取真实 ID；在这一个工程中执行上述步骤1至8。原 aabbccddeeff0011 fixture 任务保留为第一阶段历史，不迁移/伪造为新 UI job。在 job 完成前保持工程 Git HEAD 稳定。
3. 将错误终态识别候选用于隔离 Studio runtime，保留原 script/hash 和回滚文件；不必重启或替换生产宿主。测试实例的 generation 使用既有 Studio/Python/CLI，endpoint 固定 `http://127.0.0.1:8188`，STORE 在 e2e-store，GPU 租约在独立 e2e-gpu-lease。注册表仅有测试工程，避免对正式工程开放生成权限。
4. 对照既有 `C:/ai/start-image.bat` 保留必要 AMD 环境和性能参数：PYTHONUTF8、YOLO_AUTOINSTALL=false、PYTORCH_HIP_ALLOC_CONF=expandable_segments:True、HSA_ENABLE_SDMA=0；`--use-pytorch-cross-attention --reserve-vram 4 --disable-dynamic-vram --disable-auto-launch`。测试仅监听127.0.0.1、目录隔离且离线；保留 GGUF 与既有 AMD 兼容模块，白名单精确为 `ComfyUI-GGUF amd_batchnorm_fix.py`（后者必须带 .py）。不执行原 bat 的 LAN 监听和弹浏览器动作，不安装下载。正式模型入口源码为 Companion AiLauncherClient → `C:/ai/launcher/launcher.py` → 该 bat。
5. 在新后台完成步骤1至6，最少还需 **1 次新的完整 UI 生成**：1图、1候选、8步、1 POST，等待上限360秒。此请求必须新 jobId，不能重提本次已 FAILED prompt。数值检查已经通过，因此不再要求新增 CPU 模型推理或 CPU 补丁。若失败/超时，保留真实状态，不自动补发。
6. 模型任务结束并正常释放 GPU 后，再仅为 e2e-project 使用既有 Creator/Bridge 完成步骤7、8。原正式工程不启动或改动，正式素材不写。若环境不允许 Creator，导出和重读可记录阶段完成，但“保存到 Cocos 工程/UUID”仍须标未通过。
7. 形成可重复测试入口与逐步回执：固定配置预检→启动/复用相符的自有测试服务→独立浏览器执行步骤1至8→核对 job/prompt/PNG/receipt/UUID→重进页面重读→只正常关闭自有且无任务的服务。每次运行新 runId/目标文件名，失败保留目录，禁止清历史重试。不得添加开机常驻或系统服务。

需要合并确认的运行动作是：启用上述隔离测试实例的 generation 配置与本机32181；按原 AMD 必要配置启动已有模型服务；额外一次 UI 生成；仅隔离工程的 Creator 导入回读。没有生产模式切换或生产维护重启。若改为直接在32180启用generation，则必须另行评估其全工程权限与既有UNKNOWN停止门禁，不能擅自切换。

## 原始离线验收记录（维护恢复前的历史快照）


日期：2026-10-21。结论：**完整资源生成链路尚未跑通，新后台也未恢复。** 本轮实际完成了安装版本真实类的离线功能验证，没有模拟生成或把测试图登记为真实生成来源。近期复盘已独立交付，见[复盘MD](recent-failures-retrospective-20261021.md)；内部检查点不代表产品版本。

## 已执行的最小切片

所有写入限定 `C:/Users/33272/AppData/Local/Temp/companion-resource-flow-20261021`。测试工程id为aabbccddeeff0011，具备真实Git HEAD `00bbbae331edf0ef4983e8822ba8c2aeeb67086a`，未登记到宿主；手造测试id不能当作正式registry id。没有触碰D盘正式工程或批准的新任务库。

安装map SHA为a37eab4792d6b9b98365a8b1823513d322701422ff5b860179cc00ba00c1b878。提取的IconResourceConfigs、IconImageAssets及其完整依赖按原字节构建，未使用脏源或stub；Studio源码HEAD为fbceaea84d13639b98932de1813ac9bd17dd585c。来源、原类源码、执行脚本及证据已[冻结归档](evidence/resource-flow-20261021/README.md)。

|步骤|本轮实际结果|不能据此声称的结果|
|---|---|---|
|创建规范草稿|实际read返回missing和草稿|不是宿主页面新建成功|
|保存/读回|实际save，新实例读取字段、版本、SHA一致；旧expectedHash被RESOURCE_CONFIG_STALE拒绝|不是正式工程写入或整个启动绑定通过|
|输入封存|实际prepare绑定Git HEAD、规范版本和参考PNG SHA，生成sealed快照|参考图并未传入模型|
|输入检查|真实Studio CLI inspect通过，正确发现目标图缺失|没有模型生成成果|
|生成门禁|实际enqueue、run-next、resume均返回GENERATION_DISABLED|负向拒绝不等于生成通过|
|采用已有图片|合成图实际被ADOPTION_SOURCE_INVALID拒绝，未伪造comfyui-local来源|成功采用/候选选择尚未完成|
|CPU处理|安装类直接导出96×96 RGBA，alpha范围0–255；重复调用复用，拒绝覆盖不同内容|不是模型出图，也不是任务绑定导出|
|文件/回执|实际PNG、源/目标SHA及v1回执读回一致，runtimeImported=false|不是Creator导入或实际游戏运行|

results.json是16条记录、15个不同stage；保留重复读取及初次失败，不把它们凑成独立测试数量。本轮没有模拟阶段。原Temp清单含38件业务产物，不含Git内部及清单自身；仓库归档是关键子集，另有独立SHA清单。

### 执行环境与失败没有隐去

初轮使用既有Codex bundled Python。另以批准绑定 `C:/ai/ComfyUI/py/python.exe`（Python3.12.15、Pillow12.3.0）复用同一prepared输入完成实际inspect与独立CPU导出/PNG/回执回读，原规范SHA未变；没有重做规范保存，也没有把这次补验称作完整宿主绑定验证。

初次规范保存的普通执行环境返回 `link ...project/.resource-config-2e6aa469-9892-4031-9ab8-786c0b6262dd.tmp -> ...project/aabbccddeeff0011.ai-icons.json` EPERM。按既有授权在获准执行环境补跑同一预期隔离目标成功。未独立确定EPERM根因，未改ACL、算法或换位置绕过拒绝；原[failure.json](evidence/resource-flow-20261021/records/failure.json)保留。

批准Python的实际CPU测试产物：[96×96 PNG](evidence/resource-flow-20261021/outputs/approved-python-cpu.png)。它是合成测试图经过CPU处理得到，非模型生成；SHA为a98df5e8d5f8cc7f4b584fd7d9b75193a76cb9b09cab313c5b6236e77b062a84。[最终报告](evidence/resource-flow-20261021/records/final-report.json)、[批准Python补验](evidence/resource-flow-20261021/records/approved-python-check.json)。

## 新后台到真实生成仍有四个缺口

1. **宿主准入。** PID21872持续DRAINING，资源HTTP在路由派发前被拒绝。没有公开resume/cancel/hotload；本轮没有再次stop/proof。离线提取类绕开了宿主运行依赖，只能用于组件验证，不能绕过现场维护门禁。
2. **实际接入。** 项目专用五路径+offline_import_only配置已持久化，但当前进程未重载；恢复后还须确认适配器不再返回ICON_ADAPTER_DISABLED。DRAINING与适配器未启用是两层问题。
3. **模型生成。** 当前模式明确禁用生成，本地模型仍处于暂停要求；没有获准推理窗口、endpoint/GPU lease和生成任务。不能靠离线采用测试替代实际生成。
4. **真实来源与任务链。** 成功采用、选择和任务绑定导出缺可信已有生成PNG与manifest。本轮合成图不具备该来源。若下一步执行真实生成，应使用新生成任务本身的候选回执；若选择采用旧图，则要先核实真实源文件及来源清单，不能改写generator字段让测试通过。

## 模型、参考图和费用：已知与未知

现有固定profile为 `z-image-turbo-digital-asset-v1`，1024×1024、单候选、一次提交、最多360秒。所需五个权重的文件元数据均在已知 `C:/ai/ComfyUI/models` 找到：unet/z-image-turbo-Q8_0.gguf、text_encoders/Qwen_3_4b-Q8_0.gguf、loras/DigitalAssetMedia_Redmond_ZImageTurbo.safetensors、vae/ae.safetensors、background_removal/birefnet.safetensors。此次只在该models目录两层深度内读取名称及大小，未读取权重内容、加载模型或启动ComfyUI；文件存在不证明完整性、节点兼容、显存可用或生成就绪。见[元数据证据](evidence/resource-flow-20261021/model-file-metadata.json)。

参考图当前最多4张，只做路径/SHA留证；`referencesAsModelInput:false`，图流程没有实际图像条件输入。因此不能声称人物脸、项目IP或P0001母图一致性已实现。涉及要求真实母图输入的项目，现有文本生成链不能满足该要求；需要先提出并批准能力扩展。

本轮离线段没有推理请求，也没有API Token消耗。现有生成代码面向本机ComfyUI，不接ChatGPT订阅；当前没有已验证可用的生成端点，不能据此承诺真实生成成本、时长或质量。4060仍按既有约定供Creator使用，本轮没有停止Creator、抢GPU或启动模型。

服务基础恢复后，建议先提交一个具体生成确认：仅隔离工程、1个技术测试图、1候选、1次提交、360秒上限、现有本地profile，不写正式素材；同时明确允许的GPU窗口、确切输出目录和endpoint/lease。此建议未执行，也不包含在既有offline授权中。若用户目标需要参考图条件，则先补明确方案，不能用纯文本图代替。

## 维护恢复的最小行动与所缺输入

已完成官方只读取证：inflight、native-history及安装版本OS采样。当前同机器、同kernel boot、不同System生命周期；现有退出proof要求后两者均变化，条件不满足。没有人工“取消这两条聚合UNKNOWN”的公开接口；原结果仍UNKNOWN，不能拿项目级人工处置代替Native退出证明。

下一步不是重试维护。向原宿主构建/维护执行方提供[恢复包](companion-drain-recovery-20261021.md)，并明确索取：

- 当前70df42…daemon/a37eab…map对应的完整构建工作树或权威输入快照，重点是缺失的src/companion-mcp.ts、src/companion/tool-profiles.ts、src/companion/types.ts及其来源证明。
- 既有回执已绑定这两个产物，原build-candidate.mjs也已找到；但它依赖的旧fallback工作树已不存在，现存归档没有三文件hash/快照。旧脚本限定71cb baseline，不能直接重跑或拼接其他版本。先在隔离环境逐字节复现当前安装包，再集成已审准入恢复补丁。
- 一个保留历史UNKNOWN、保持停机与退出证明门禁的正式恢复准入及应用流程。当前进程无热加载/取消维护，磁盘修复不能更新已加载代码；本轮许可内没有可执行的现场替换路径。外部终止、注入、清库、改锁或伪造记录不列为下一步动作。

这里要求维护方补的是明确构建输入与当前进程的合法应用方式，并非让用户猜环境变量或重启整机。得到这些条件后，先验证OPEN、身份/历史/其他服务保持，再验证实际五绑定和只读资源接口；随后才通过新后台重做同一隔离工程的规范保存读回，最后处理真实生成许可和任务候选链。没有这些条件时，资源整链继续标阻塞，不无限搜索或重复失败。

## 本轮交付边界

近期复盘已独立交付。资源流本轮交付的是实际离线类验证、原始失败、来源与产物哈希、模型元数据及精确恢复条件；完整生成流仍未交付。未启动任何服务/模型或监听器、未调用宿主业务API、未注册工程、未写正式素材/实际任务库、未上传文件，也没有蚂蚁或采集器新增实施与验收。
