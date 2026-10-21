# 资源流：真实类离线验证与恢复条件

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
