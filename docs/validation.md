# 验证记录

本文件按顺序保留历史记录。最新源码为文末 Next 0.1.17；早期“最新检查点”仅指当时阶段，不能代替本轮结果。

日期：2026-10-11。范围：dot 自有工作区的独立 Companion Next 前端及只读适配。

最新检查点：Picker 图片素材接入的完整前端回归 14 文件、299 项通过；完整类型检查与 Vite build 通过。Python 同源桥 58 项 stdlib 离线测试通过。原 117 项基线及之后资源规划 / 来源整合回归均包含在本次完整前端执行中。依赖与 lock 未改变。

## 已验证

- `npm run build`：Vue / TypeScript 类型检查通过；Vite 6.4.4 生产构建成功。
- `npm test`：4 个测试文件、117 项测试通过。包括 44 项只读适配测试；规范完整 schema、保存隔离、跨页草稿冲突、模式切换、取消/旧响应隔离，以及 mounted Vue + Element Plus 的组件 DOM 行为。
- `npm audit`：锁定依赖的已知公告 0 项；版本及升级原因见 `dependencies.md`。
- 默认未连接；示例只能显式加载；失败不回退到 fixture；所有真实写入按钮禁用。
- 真实资源清单未读时显示未知，不冒充已登记 0 项；失败的服务占位不标记为真实服务响应。
- 保存保留编辑开始时的 revision；检测到其他页面更新时拒绝覆盖，并提供明确重新载入。支持 Web Locks 时加同源写锁；缺少此 API 时持久保存禁用，保留表单，不执行不安全的 localStorage 并发写。
- 无 API 默认注册、无 Windows 地址、无代理、无凭据存储、无 CORS 放开、无部署/发布。

## 独立源码复审

首轮发现并已修复：

1. 本地草稿原本可能被并行页面静默覆盖。
2. live 查询失败后占位服务的来源标签不准确。
3. 本地存储规范的运行时结构校验不完整。
4. 未查询的资源清单可能显示成已测得零项。

已添加以上定向回归。同一 reviewer 定向源码复审通过：原四项均已闭合，没有剩余源码阻断。reviewer 只读核查代码与回归测试定义，未代替本文件记录的实际测试执行。真实浏览器视觉、响应式布局及真实多 tab Web Locks 行为仍未实测。

## 未通过 / 未验证

真实浏览器渲染、响应式布局、截图、视觉效果尚未完成验证，不能以 jsdom 的组件 DOM 测试替代。

- exec 内 Chromium 启动失败：`process_singleton_posix.cc socket() failed: Operation not permitted`，临时 profile / IPC 受执行环境限制。
- 正常 `require_escalated` 测试请求后仍返回相同 IPC 错误；未改系统权限或绕过限制。
- dot 提供的独立 Chrome 无法访问该 exec 工作区 loopback，返回 `ERR_CONNECTION_REFUSED`。
- 没有可交付运行截图；没有用设计图冒充产品截图。
- `tests/browser-smoke.py` 是待执行脚本，在具备 Chromium IPC 能力的环境运行才可形成浏览器验收证据。

没有访问 Windows、Creator、Bridge 或 ComfyUI。这些真实环境的认证、连通、导入、绑定、运行与视觉验收均未执行。

## 安装与进程说明

依赖使用官方 npm registry，`--ignore-scripts`，缓存仅在获准 `/tmp`。首轮安装等待遇 review cancellation，收到原任务授权证据后按原命令重试一次成功。最终 install、build、test、audit 均有成功退出记录。临时 Vite 开发服务已停止，不保留监听。

## 资源规划与预检检查点

2026-10-11：原 117 项基线全部保留，新建资源需求 / 单尺寸与显式同图派生 / 同规范批次 / manifest 导出 / 执行前预检，以及 Vue 组件 DOM 定向回归。7 文件 161 项测试全部通过，完整类型检查和 Vite build 通过。package.json 与 lock 未变，无新依赖。

本片定向源码复审通过；补正“需求弹窗打开后规范改变”的保存终点校验，并有回归。真实浏览器、Windows、ComfyUI、Creator / Bridge 仍未验证，没有执行真实生成。此记录是持续开发检查点，不代表整套资源流程完成。

## 资源计划恢复与编辑检查点

本片增加严格 JSON 导入 / 恢复、显式替换与旧草稿备份、未编批需求编辑 / 移除、本地计划批次取消与引用保护。4 个相关文件 82 项测试通过，完整类型检查与 build 通过。

定向源码复审发现并关闭三项边界：

1. 紧凑 JSON 虽不足 512 KiB，但标准导出超过预算。现在导入在状态写入前验证可重新导出；失败不改变当前计划或备份。
2. 借用同一绑定 ID 修改其规范快照。现在比较完整绑定语义，包含 Owner 项时不允许重绑；比较与 JSON 键顺序无关。
3. 选择新文件后可能仍恢复旧候选。现在清空候选和确认，读取中禁用恢复，超限 / 失败后保持未就绪；旧读取、关闭、项目切换均不能复活旧候选。

三项定向复审通过，没有剩余源码阻断。文件选择 / 下载及真实浏览器交互只做组件 DOM 模拟，尚未经过真实浏览器验证。

### 剩余真实依赖

- 浏览器：当前 dot 执行环境 Chromium IPC 阻断仍存在；需可用且获授权的浏览器环境完成视觉、响应式、真实文件选择 / 下载、多标签行为验收。未重试或绕过旧限制。
- 规范与样板：需要真实目标项目 / 规范快照、首批资源范围、Owner 风格 / 批次批准与参考素材许可证据。当前示例和未批准计划不构成真实生产批准。
- 真实服务：需要已登记 ComfyUI 工作流及版本的输入 / 输出映射、模型和 GPU 可用性，以及 Cocos 导入目标 / UUID / Prefab / 运行验收证据。没有注册或调用这些服务。任何新 GitHub 项目 / 依赖候选先交 Owner 批准。

以上是整套流程下一阶段的真实输入与环境依赖；当前检查点不等于全流程完成。

## ComfyUI / Codex 原生来源整合检查点

2026-10-11：来源选择、旧 manifest 来源缺省迁移、共享规范 / Owner 保护、同项目恢复、来源专属阻塞条件、空输出回执、交接 512 KiB 预算、项目 / 规范变化清除过期预览等新增回归通过。最终执行 `npm test -- tests/generation-source.test.ts tests/generation-source-ui.test.ts tests/resource-planning.test.ts tests/resource-plan-recovery.test.ts tests/resource-preflight.test.ts tests/resource-planner-ui.test.ts`：6 文件、108 项通过；随后完整 `npm run build` 成功。

本片独立只读源码复核通过。复核建议的规范变化使预览失效与合法计划包装后超限两项均已补正、添加回归并通过本地最终执行。首轮新增测试夹具缺风格名已修正。一次中间运行结果读取被取消，原 session 重查已不存在，故不计其结果；此处成功结论来自最后完整退出 0 的独立收尾验证。

无依赖或 lock 变化；未再次运行依赖审计，沿用前次零公告记录。构建有主 bundle 约 1100.68 kB 超过配置阈值的提示，不影响构建成功，后续可在实际加载性能验证后优化。本片没有浏览器渲染 / 下载实测或真实来源调用，不把独立本机原生样本视为本网页端到端证据。

## Picker 图片素材与同源桥检查点

2026-10-11：新增独立图片素材入口、Picker v16 严格解析、真实任务状态归一化、固定同源图片页内预览、保留选择、受保护保存与逐项回执。来源 URL 不直接作为图片请求；不复制 token 到 dot，不持久化凭据，不改变 Host / Origin / CORS / CSP。

最终完整 `npm test`：14 文件、299 项通过；随后的 `npm run build` 类型检查与 Vite 构建成功。构建主包约 1125.76 kB，有超过 1100 kB 阈值的提示，未因此失败。Python 执行 `python3 -m unittest discover -s tests -p test_picker_bridge.py`：58 项通过；测试禁止创建 socket，使用明确的离线 handler/store/server 替身。当前 dist 入口与两份 JS/CSS 产物满足桥接固定白名单。

前端独立复审补正并覆盖：入队响应后旧 idle 快照不能造成重复提交；DNS 尾点与精确保留网段判断；写入期间注册变化延后断连，离页返回也核身份。还覆盖服务重启后显式重连刷新会话、预览取消 / 迟到结果、旧导出接口禁用、原子保存精确请求、取消 / 部分失败 / 未知回执，以及拒绝与执行结果未知的区分。旧 UI 测试原先取第一个 dialog，会命中后来增加的隐藏预览对话框；现改为定位实际规范弹窗，保存断言保持不变。

真实后端核心源码来自经核对的 v0.1.0.20 合同与 SHA，未在 dot 复制或启动完整后端。独立 Python 桥复用原类 / 鉴权 / 原生目录选择 / TaskStore.export，不用复制文件替身。其单测不能证明原本机目录导出已运行。

待实机：消费完整且核验通过的原后端、缓存租约及依赖；同源托管与 token；原CSP下 Vue / Element Plus 的实际样式；图片预览、跨 tab stale/busy、目录取消、两次同名保存、实际图片和source.json回执。Windows 此时离线；本片没有访问或部署 Windows，也没有改变旧 Companion。项目配置与 Creator 导入 / 引用 / 运行仍未接入。

本片前端与桥接各经独立只读复审，定向修复后均无剩余源码阻断。桥接复审额外加强执行阶段错误分类：chooser/export 阶段任何 Exception 均为 500/export_failed，不能误报副作用前的 400/409；58 项 Python 测试包含此回归。真实环境待验边界不因源码复审而消失。

## 人工生成文件回收检查点

2026-10-12：在第 3 步增加本地 PNG 母图登记，冻结项目 / 规范 / 需求 / 批次 / 来源；实测 SHA-256、字节数、PNG 结构元数据，并导出独立待审清单。计划执行计数、Owner 保护及 Picker 源码保持不变。

最终合并工作区执行 `npm test`：17 文件、390 项通过（原 299 项 + 新领域 75 项 + store 8 项 + DOM 8 项）；随后 `npm run build` 类型检查与 Vite 构建通过。本次由领域模块开发任务执行全量检查，主任务未重复启动同一全量命令。无依赖 / lock 修改；未重复审计无变化的依赖。构建主包约 1142.47 kB，仍有既有阈值提示，不影响成功。

覆盖：真实测试 PNG 字节与标准 SHA-256 比对、CRC / 核心块 / 尺寸 / APNG / 截断等拒绝、跨 realm WebCrypto、冻结与伪 JSON 拒绝、Owner 禁入、同上下文重复、16 MiB / 32 份 / 512 KiB 上限、尺寸不符仍待审、来源 / 规范 / 项目变化与取消 / 卸载迟到结果。测试特意保留“结构检查不能证明压缩流完整解码”的边界，像素与视觉状态始终未检查。

独立只读复审发现并闭合同组件路由 query 变化未取消读取的问题：已加入同步路由失效，A→B→A 晚到结果也拒绝；独立 DOM 复验 8 项通过。复审无剩余源码阻断。初轮测试使用的 Node WebCrypto / Uint8Array 跨 realm 验证已改为原生内部槽检查；测试中使用 Node 内建模块的类型声明不引入新包。

本片没有实际浏览器文件选择 / 下载 / WebCrypto / CSP 渲染验收，没有访问本机或外部生成服务。真实 PNG 解码、像素 alpha、视觉 Owner 批准、工程保存和 Creator 导入仍未检查。已有 Picker 58 项 Python 单测结果沿用上个检查点，本片没有修改或重跑该桥。剩余协议与必要环境详见 `generation-receipts.md`。

## Picker 路径测试跨平台修正

2026-10-12：Windows 隔离消费者反馈原 58 项中 57 项通过，唯一失败是测试把 `Path('/chosen/output')` 的字符串硬编码为 POSIX 斜杠。Windows 的 Path 按本机语义返回反斜杠；生产桥使用 `os.fsdecode(os.fspath(directory))`，此处没有证据表明生产逻辑有误。

仅修 `tests/test_picker_bridge.py`：期望值来自 chooser 返回 Path 的原生字符串，同时检查原 store.export 收到完全相同路径。新增 PureWindowsPath 的盘符与 UNC 两种情况，在任意测试宿主验证分隔符、盘符 / 共享名和空格不被桥改写。FakeStore 不访问这些目录，不创建文件。

dot 重新执行 `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_picker_bridge.py`：59 项通过，退出 0；`git diff --check` 通过。生产桥、前端和依赖没有修改，因此未重复不相关的前端构建与 390 项测试。此结果不替代 Windows 复验，也不代表真实同源浏览器、原生目录保存已通过。原 Library v4 包保持不变，以限定补丁交付，避免进行中的验收版本漂移。

## Picker 刷新后保存就绪修复

2026-10-12：Windows 隔离消费者在实际 Edge 复现：勾选 ready 图片后保存可用，刷新完成仍勾选 / ready / 空闲，保存却持续禁用。dot 使用真实同源适配器配合离线 HTTP 替身，先在原源码上复现两项失败（store 与真实组件 DOM 的 pending 帧），证实普通 capability getter 在刷新时短路导致 Vue 计算属性失去后续响应式依赖。

保存能力现由 store 的响应式 `saveGuardVerified` 快照表达：每次刷新开始、连接 / 断开、最新读取失败均关闭；只在最新请求成功且状态校验通过后，采集该次 provider 的能力。按钮与提示共用它。`save()` 终点另外保留原 provider guard 检查；adapter 与服务端 atomic expected-task / selected-IDs 路由未改，也没有放开忙碌、未知结果、并发写或选择状态门。

新 17 项回归覆盖刷新完成恢复、能力 / 状态失败、缺失能力、外部撤销能力时零 POST、409、跨 tab busy→idle、过期任务、候选不再 ready、并发读乱序及断开迟到结果。审阅相关 4 文件 53 项通过，最终完整 `npm test`：18 文件 407 项通过；`npm run build` 的 Vue / TS 检查与 Vite 构建通过。主包约 1142.52 kB 的既有大小提示仍存在。Python 桥 59 项再次通过，`git diff --check` 通过；无新依赖或 lock 改动。独立只读复核无剩余源码阻断。

交付为限定源补丁：从原始 Library v4 基线的累计版本包含前一项 Windows 路径测试修正；另提供已应用该测试修正的增量版本，二者只选一个。原完整 v4 ZIP 保持不变。消费前后须核对文件 SHA，保护本机并行变更。

消费源码后必须重新构建 dist，并重启独立 `launch_picker` 宿主，再重新打开页面 / 连接服务。静态白名单保存启动时的不可变产物，单独覆盖 dist 或刷新旧服务不会加载新 JS。当前仅 dot 离线验证；修正后的真实 Edge 刷新 / 保存、原生目录选择和文件结果仍待消费者复验，不提前记为已通过。

## 帮助、关于、版本与功能保留对照

2026-10-12：根据旧功能应全部保留、仅改变布局与交互的要求，核对已批准 v133 本地参考，形成 19 项功能差异及源码行号清单（`migration-parity-v133.md`）。当前旧版实际目标已更新为 v148，其最新源码 / 交互清单由单独的只读任务核对，不能用此前 v142 冻结信息作为最终目标。

前端独立版本升为 0.1.1，package 和 lock 只同步项目自身版本，依赖树未改变。顶栏版本始终保留入口，另有帮助、关于、前端更新记录和旧功能保留对照。帮助包含已核旧版的四类目录 / 13 个内容入口，并提供新版使用说明。当前 daemon / Creator 版本未读取，旧关于的兼容、反馈与协议声明均标明参考来源；未补造旧收款二维码。

独立只读复审发现并闭合帮助导航丢失 Picker 未解析输入的问题：输入与已解析文本仅移入现有 Pinia 内存，未持久化，也未改变服务合同。离页继续取消读取 / 预览，返回重置下载确认；已解析 A / 未解析 B 不混用。回归覆盖进行中写入与未知结果不因进入帮助被解锁。迁移对照深链接增加白名单目标、焦点、滚动及迟到回调失效。

最终 `npm test`：19 文件、422 项通过；`npm run build` 的 Vue / TS 检查与 Vite 构建通过。新增导航 / 身份用例 15 项；既有审阅、规划、回收、只读适配与数据保护回归保持通过。`git diff --check` 通过。生产 Picker bridge 和同源审阅 adapter 未变，Python 59 项结果沿用上一已验证检查点。主包约 1165.29 kB，既有大小提示未导致构建失败。

本片页面验证为组件 DOM 和生产路由检查，未以 jsdom 代替真实移动端布局、CSP 或截图验收。没有重试此前被拒绝的 Chromium IPC 路径，也未操作 Windows 消费服务。旧工程 / 知识库 / 模型服务 / 日志 / 调用记录 / CLI / MCP / 工具权限等仍须按当前基线补齐真实功能；静态说明和新增图片流程不能证明完整迁移。

## v148 原帮助、关于与发布记录回收

接续同一任务，读取已交接的 v0.3.148 原 UI 包，225414 字节，SHA-256 `e659531bdcd8228aa8394aac59e4bf8ac633f52607ef352c9a365ef5cda762c3`。16 个源文件及报告逐项校验匹配。新增 `migration-parity-v148.md` 作为当前功能对照，v133 文档仅为历史审计。

恢复 13 节完整静态帮助（90 个原语义块 + 1 个明确未接工具目录提示），含 10 段完整代码 / 提示词和 6 个短说明；复制、换行、长文展开不会执行原命令。保留原关于 SVG / 微信二维码的原始字节及反馈 / 下载入口。恢复全部原发布日志（114 原始记录、201 条变更、27 个北京时间日分组），与前端 0.1.1 分开显示。四个旧主入口可达真实迁移状态，不假装旧业务已接通。项目、计划及审阅输入 / 未知结果保护继续保留。

`npm test` 全量 **20 文件 / 435 项通过**；`npm run build` 中 vue-tsc 与 Vite 通过；Python bridge **59 项通过**。生产构建经现有 `build_static_manifest` 白名单核验接受（6 个固定路由），两张原图输出哈希均与交接包完全相同。设置 `assetsInlineLimit: 0` 仅确保原 SVG / PNG 使用同源静态文件而非 data URL，不更改原 CSP 或桥接逻辑。主 JS 1214.91 kB，既有大小提示未导致构建失败。

09:47 UTC 再查 dot 支持的 cloud Chromium 可用，但访问 exec 内 127.0.0.1:4173 生产预览返回 `ERR_CONNECTION_REFUSED`，两环境 loopback 不共享。预览进程已停止；没有重试此前被拒的 exec Chromium，没有扩大监听或代理。因此真实浏览器视觉、移动布局及最终页面 CSP 仍未验；DOM / 构建 / 静态字节证据不代替它们。Windows 6373 / 11918 原消费实例未变更。

独立图片关键词搜索的原只读合同已取得并记录在 `public-image-review-parity.md`；本片没有接通该功能，当前 UI 仍只接 browser_import。原 AI 图标完整六步与旧工程 / 知识 / 模型等业务迁移均未完成。

独立只读复审确认：13主题原正文与日志 / 资产无非预期遗漏，无服务请求或权限扩大。复审发现的全局共享换行状态已恢复为逐块独立控制并加回归；Agent交接未迁缺口与知识原文页内查看文案已补齐。最终修正后全量仍为 435 / 435，定向内容与导航 28 / 28，类型与构建通过。


## 图片关键词、任务操作与持久化选择（0.1.2）

2026-10-12：消费并逐文件校验独立 public-image-review v0.1.0.20 的 7 文件只读参考包。包不是完整 runtime；未启动原服务、访问搜索来源或消费 Windows。按真实原状态合同迁入双模式、来源报告 / 冷却、历史、1.2 秒可见页串行读取、受控缩略图 / 原图与元数据、重试 / 停止 / 可恢复回收。原子保存未退回旧 export。

新增七个任务绑定操作，其中选择有独立 guarded_selection 能力；每次勾选 / 全反取消选择即时调用原 store.select 保存，读回服务选择，不以本地勾选冒充持久化。选择、回收、保存均携带冻结任务 / 完整 IDs；未知或部分执行失败锁定后续提交，服务选择在刷新 / 重开时恢复。只读复核补正同任务轮询清预览、采用已读任务清空服务选择的问题；三项能力随取消读取同步关闭。桥接复核确认锁序、下载中可选 / 导出冻结、旧任务409及选择赋值前400 / 写后500分类；原无守卫 stop 的既有行为仍明确披露。

最终代码完整执行：**22 文件 / 477 个前端测试通过**，随后 **vue-tsc + Vite 生产构建通过**，接着 **106 个 Python 桥离线测试通过**，整条命令退出 0。主 JS 1240.47 kB，既有大小提示未导致失败。package / lock 只同步本项目版本 0.1.2，依赖树未变化，未重复审计或安装。独立前端及桥接源码复审无剩余已发现阻断；readiness 原 17 项刷新 / 保存安全门回归完整保留并改用持久化选择假服务。

过程记录：旧代码中间 aggregate session39292 的只读结果查询被取消，按获准的同查询重试一次返回 Unknown process id，故该轮结果未知，未读取其日志或重放执行。后续新增持久化选择后的第一次全量前端477通过，但类型检查发现新测试 spy 字面量被拓宽为 string；补 as const 后才得到上述最终完整退出0结果，不沿用旧未知轮为成功。

页面验证是组件 DOM / 真实适配器配合离线HTTP替身与生产构建；Python tests 禁止 socket，使用明确fake实现验证原类调用合同。新页面未在真实浏览器 / CSP / 文件系统 / 真实网络验收；不能以此替代 Windows 中的下载、缓存、选择重开、历史、跨标签旧任务 / 导出冻结、原生chooser取消 / 两次同名保存与source.json结果。原v5当前Windows验收基线不变。本片无新外部权限、凭据、代理、依赖、发布或旧工程修改。

## v148 工程、日志与调用手动读取（0.1.3）

2026-10-12：原后端参考ZIP 108630 B，SHA-256 `6801560238a8a835f70ac0392f6d709e08b1d0bcfa233c4f70814702c1fcaf28`；29个源码/测试/package文件按manifest长度及SHA全匹配。新片实现六类固定同源GET客户端、独立原工程记录页、日志筛选与调用分页；保留未读/未知/失败区别。专用companion-readonly构建与原Picker身份互斥，不取token，不新建Cookie或更改认证。

独立源码复核发现并关闭：status单点失败不应丢弃成功登记；离页期间provider改变后返回需立即重核；当前Creator不能以工程要求版本兜底；Windows Dashboard显示路径需规范化但POSIX保留大小写；cancelReads后的connect续体不能再发counts。均补定向回归。额外保持A→B→A、调用session/游标变化、筛选与卸载迟到隔离；未知状态不混入stopped或opened排序。

最终本工程 **25文件 / 611测试通过**（原477 + 新适配109 + store/UI25），随后 `npm run build` 与 `npm run build:companion-readonly` 两次vue-tsc及Vite构建均通过，整条命令退出0。普通主JS1260.17 kB、Companion专用主JS1260.08 kB，既有大小提示不影响成功。普通产物仍通过既有Picker静态6路由白名单检查。桥生产逻辑未改，本轮未重跑不相关的Python106测试，沿用v6已验证结果。依赖树未变，仅本项目版本0.1.3、一个构建script和测试发现范围改变，未重装或重复audit。

过程说明：首次全量自动发现了`.test-artifacts`中刚物化的原后端参考测试，12个套件因该包非完整构建依赖失败；这不作为本工程结果，也没有补装或启动原服务。Vitest已明确只收`tests/**/*.test.ts`，防止参考包被误执行。随后本工程611通过但类型检查抓到adapter测试二维参数行被展开、形成错误覆盖；将日志/状态数组行包装为对象，验证传入完整数组，再取得上述最终完整成功。没有沿用先前失败或范围错误的计数作为完成证据。

“只读”指前端只观察原GET；原status可能查询Bridge、更新内部连接状态并记录诊断日志。实际daemon未转发HTTP类的webRoot选项，且Cookie不按端口隔离，本片没有伪造完整宿主启动方法。没有实际Windows/daemon Cookie读取、浏览器视觉/窄屏或真实SSE验收。SSE、自动轮询、setup/生命周期/清日志/知识/模型及AI图标业务尚未迁入；旧工程、Windowsv5验收与v6图片交付保持独立。

## v148 知识只读查询与模型状态（0.1.4）

2026-10-12：基于同一已校验 v148 后端包实现 3 个 GET 与 8 个逻辑只读 POST 的严格适配；独立知识页、模型状态入口、页面内存结果与取消隔离。构造 / 注册 / 路由挂载无请求；所有查询由明确按钮触发。原文副作用说明、未知状态、原始文本转义、二进制只显示元信息均覆盖，不执行、保存或链接内容。

独立只读源码 review 唯一 P2：sync.available=false/error 的空来源被渲染为成功空列表。已显示固定错误及未知分支，并新增 UI 失败回归；复核确认关闭，无剩余已发现阻断。实际源码和文档仍明确：模型 `running` 仅代表启动器可达；知识状态不等于新检索或索引成功；CLI 临时文件操作不等于用户目录保存；没有 iframe、启停、setup、chat、同步、凭据或新权限。

最终业务代码 **28 文件 / 712 测试通过**（前片611 + adapter70 + store21 / UI10），随后类型检查与默认 / Companion 专用生产构建均通过，命令退出0。完成后仅补页面卡片外观样式与验证文档，再次类型与双构建通过；默认主JS1277.60 kB，Companion专用1291.64 kB，保留既有大小警告，不调阈值隐藏。依赖树未改，仅本项目版本同步0.1.4；Python桥生产代码未变，此片未重复无关的106 Python测试。

过程：首次全量709/711，两个旧帮助测试仍期望知识/模型未迁入口；更新为当前只读入口和明确未迁写动作。下一次710/711是测试替换未匹配空格，精确修正后加入上述review回归才得712全部通过。定向最初29/30的HTML预览测试在改变store后未等待DOM按钮启用，补组件更新等待后30/30通过。没有把任何中间失败当最终成功。

本片页面验证仍为组件 DOM 与离线假transport；真实浏览器桌面 / 窄屏、真实 CLI / 原知识库、实际同源 Cookie 宿主均未验证。Windows v5 / Library v6 未替换，0.1.3与本片都只是 dot 独立源码提交。宿主装配的已核阻断与最小补源清单见 `companion-host-assembly.md`。

## v148 宿主 options 准备（保持前端0.1.4）

2026-10-12：宿主闭包366694B，SHA `5abcc93f02ddfd2baf22aebcc77e2843716fbf551282f80d76b66c459f174901`；100原文件大小/SHA均匹配，其中97个CRLF文件按标准LF归一化才匹配Git blob，未改原字节。闭包已齐，不再请求同源文件。

纯options模块和20条测试仅使用内存函数替身，不导入/构造原HTTP类、不提供start/listen、不读文件或凭据。定向20通过及vue-tsc通过。最初草案的fake constructor / start生命周期测试被独立review否决后收窄；删除启动入口，不沿用先前28/30计数。原SSE先写响应头再logs.on的异常风险、具体类带private成员导致facade不能直接类型适配、旧calls和Bridge token边界均明确列为真实runtime binder硬阻塞，而非仅文案提示。

运行依赖安装与临时监听尚待Owner批准；当前没有真实HTTP/鉴权/浏览器或网络测试。全量最终回归另记下方结果。前端应用源码与生产构建未改，不新增依赖或更新Libraryv6/Windowsv5。

最终本片全量 **29文件 / 732测试通过**，随后vue-tsc及diff检查通过。源码独立复核确认不可启动边界；没有生产构建或依赖变化。

## 获准的临时原 HTTP / Cookie / SSE 验证

2026-10-12 11:45:12 UTC Owner 明确准许限定安装及dot临时测试。先复用真实DebugLogStore子类保留SSE on/off，只拒绝clear；工具预设继承原类并覆盖全部10方法，解决参数map的private名义类型装配缺口。`host/v148-runtime-binder.ts`无type assertions / any、不导入daemon/CLI，只显式构造原HTTP类；不自动listen、不默认连接Windows服务。

只在ignored `.test-artifacts/v148-host-runtime` 用原锁裁出zod4.4.3、MCP SDK1.30.0、better-sqlite3 12.11.1及128个总安装包，`npm ci --ignore-scripts --no-audit --no-fund`实际成功。没有更改本Vue package/lock依赖、运行第三方安装脚本、构造SQLite库或持久locator。源码副本仍逐100文件SHA校验，binder仅复制到隔离副本的独立新文件；原参考包及旧Windows没有改变。

原HTTP及新前端read clients用既有esbuild实际转译，Node24运行两个临时127.0.0.1随机端口实例。**最终21组真实HTTP检查通过**（2026-10-12T11:58:32.982Z），证据 `docs/evidence/v148-http-validation.json`：一次性登录、HttpOnly/SameSite=Strict Cookie头、跨实例拒绝、未认证/Host/POST Origin拒绝、静态新UI、原项目/日志/calls路由、8知识POST、状态局部失败、未绑定能力、实际KnowledgeAdapter无身份401、拒绝knowledge writer/chat与服务启停、拒绝日志清理/preset写入、坏JSON/超限、请求取消、真实SSE默认日志和named-call事件、取消订阅。两个服务在finally关闭，并分别得到 **ECONNREFUSED**，不是把timeout当关闭证据；unhandledRejection 0，隔离状态目录保持空。

业务查询内容均为独立fixture，不能称Owner工程、模型或知识索引已通。无身份负例确实复用原KnowledgeAdapter，但fileAvailable固定false、runJson明确禁止执行，不读真实配置或生成CLI子进程。Cookie只在测试进程内存，不写入证据、磁盘或日志。没有运行Creator控制HTTP、Owner目录、外站、真实下载、浏览器视觉或Cookie浏览器策略验收。网页header正确不代替真实浏览器行为。

独立review已发现并修正SSE错误时finally全局abort兜底、searchStarted有界等待、allSettled关闭全部实例、关闭后严格ECONNREFUSED断言和过宽“所有生命周期”文案。最终源码回归 **29文件/732测试通过 + Vue类型检查通过**，脚本语法检查通过。前端产物仍是0.1.4最近已过的双构建；本片不改UI，未重复前端构建。

另明确未通过项：最终沿原tsconfig.build选项、使用现有TS5.8.3对binder+传递源码做semantic检查，得到214诊断（原锁期望TS5.9.3也未额外安装），主要缺Node/global/module声明及未批准的原开发类型依赖；binder本文件缺node:path声明。没有安装额外开发包或用虚假shims隐藏。**实际转译/HTTP运行通过，不代表完整原包semantic typecheck或npm build通过。**

过程失败均保留语义：最初secondary fixture未传必需testReaders，构造拒绝且尚未监听；补显式{}后，Node fetch忽略测试Host覆盖导致预期403而实际200，原服务finally正常关闭。改用node:http发送真实Host测试头后403通过。最终再按review修正有界取消和ECONNREFUSED后重跑21组，未沿用中间失败作为通过。当前库v6/Windowsv5依然未更新，临时测试不是可部署生产宿主。

## `next/` 相对 base 离线候选（0.1.4，未部署）

2026-10-12：在任务检查点 `0e26ebb` 后，只新增独立构建 / 清单脚本与测试 / 文档 / 两个 package script。既有前端、host、Python bridge、Vite config 和 package-lock 均未修改，没有安装待批的4个编译 / 类型包，也没有启动服务、操作Windows或替换Library。

独立源码review最初发现静态字面量检查漏过未加引号外链script、inline script、CSS @import及JS裸import。改用已有jsdom的不执行 / 不加载解析、当前入口标签属性白名单、已有TypeScript AST与SVG固定源哈希；补齐回归。父路径写入前检查与构建前后HEAD/dirty记录同样已补，定向复审确认原问题闭合，未发现阻断离线候选准备的剩余问题。

最终 **56/56 Node静态候选测试通过（无跳过）**；既有Companion宿主注册与读取页面 **9/9** 回归通过。源码提交 `3a2ee1f` 后重新执行 `npm run build:companion-static`，**vue-tsc + Vite相对base构建通过**，随后只读清单重核成功：构建前后同一提交、sourceDirty=false，六文件 / 四条静态引用，入口为 `/next/index.html#/projects`。两张原关于图片SHA未变。原主包大小警告继续保留；没有把构建当浏览器或实际业务接口验收。

最终旁置清单原字节留存 `docs/evidence/companion-static-additions.json`，SHA-256 `4b58f32f357d06f43435ce6efc1b0dfbe46dec112333c7ae2ea4bd06696586df`。文件政策只新增next、目标必须不存在、不覆盖、不跟随链接；清单本身不进入webRoot。工具不含部署 / 回滚执行器，不能代替Windows实际reparse point、实时运行身份、原manifest与源哈希重核。

既有732全量业务测试结果沿用上一代码检查点；本次未改业务源码，不重复无关全量或Python测试。实际桌面 / 窄屏、原Cookie浏览器会话、真实工程 / 知识读取和新增目录的Windows消费仍待批准及验收。现场报告已列校验未发现额外目录禁止，不等于未来升级 / 恢复保证保留；原冻结部署新增next例外仍由Owner确认。

## 获准补齐类型依赖与静态交接（2026-10-12）

Owner已明确批准此前两项请求。先以 `52be175` 建立本任务检查点，随后仅在原isolated runtime补TypeScript5.9.3、@types/node24.13.3、@types/better-sqlite3 7.6.13和undici-types7.18.2。npm安装输出added4，原128锁条目完全未变，现132；旧锁版本/integrity原样保留，只将tarball镜像地址换为官方registry，ignore-scripts保持。主工程package/lock与业务源码未改。

新增可复现语义检查脚本先核100原文件和当前binder字节，再沿原tsconfig.build选项与TS5.9.3检查。**Binder及其55非声明文件图为0诊断**，补闭此前214诊断的目标范围；没有修改原代码、加shim、弱化strict。额外全部提供源码检查为88根/93文件，原Bridge/Edge等因缺ws声明/Playwright仍15诊断，脚本明确exit1；没有扩大安装，不能将本结果称完整旧后端构建通过。55/93包含JSON。证据 `docs/evidence/v148-typecheck-approved.json`。

最新clean静态候选与原旁置manifest重核全部一致，继续复用源码3a2ee1f的六文件，不因类型依赖验证重新构建或漂移资源。独立复核检查字节、引用和限制，打包只包含next六资源及webRoot外留存的README / SHA256SUMS / STATIC-ADDITIONS，共9文件。正式交付信息见 `docs/evidence/companion-static-delivery.json`。构建包不是既有Library v6源码包的新版本，也不部署测试binder；旧源码Library身份保持原样。

本轮没有监听服务、启动原后台模块、读取Owner身份、执行Windows或真实浏览器验收。现Owner授权已到，消费者仍需先核实时运行身份、原部署哈希、next完全不存在和所有祖先reparse point；不符即停。

## 2026-10-13：可见页工程刷新与日志 / 调用 SSE（0.1.5）

- 基线 `4d1429c`，任务前检查点 `1a72b2f`。代码采用已核 v148 来源；没有新依赖、真实网络、服务监听、Windows 操作或 Library 包替换。
- 最终 `npm test -- --maxWorkers=2`：31 文件 **845 / 845** 通过，原 732 项全部保留。新增事件适配 81 项、store 29 项、UI 3 项，共 113 项。fake EventSource / HTTP 只验证离线合同和生命周期。
- `npm run build` 与 `npm run build:companion-readonly`：均成功，含完整 Vue / TypeScript 检查。现有大 bundle 提示仍在，没有改变 chunk 阈值掩盖；没有新增依赖。
- `npm run test:companion-static`：**56 / 56** 通过。此次未重新交付静态包，前序 v0.1.4 Library 静态产物身份和字节不变。
- 首轮全量发现迁移表标签断言仍按“手动读取已接”；已更新为真实的新源状态。其后默认并行一轮旧资源大清单测试超过 5 秒（844 通过 / 1 timeout）；未放宽用例断言或超时，改用两个 worker 后最终全部通过。上述早期失败不记为通过。
- 独立只读复审闭合四个并发问题：旧完成事件误标 latest、旧 HTTP 恢复过时 latest、换 session 后旧 stream 回调回退、counts 失败与旧 calls 交错降低 total。对应回归均进入最终 845 项。
- 复审未见剩余源码阻断，`git diff --check` 通过。真实浏览器 EventSource、页面可见性、Windows 同源会话、断线恢复效果仍未验；不能沿用前序宿主 21 组测试声称本片新 UI 已实机接通。

## 2026-10-13：工具目录 / 预设只读源码候选（0.1.6）

- 基线 `7edc4a1`，任务前检查点 `3ecdd0a`。只增加三类原同源 GET 和帮助页交互，没有安装、服务监听、Windows 操作或 Library 更新。
- 前置定向：工具 domain/adapter **140 / 140**；store/UI/help **52 / 52**；当时完整 Vue / TypeScript 检查通过。随后又补导出终点已读目录引用校验和相应回归，须以之后新版本最终执行为准。
- 之前一次全量 / 双构建 / 静态检查命令的会话 `46523`，终态查询先被 automatic approval review cancelled；获授权仅原查询重试一次后返回 Unknown process id。该次完整结果未知，不记通过，也未重放旧命令。
- 已保存新增引用校验的源码检查点，下一轮对这份新代码正常执行离线完整验证。源码复审已闭合数据 / 错误重投影、中文内置标签重名兼容、内置导出新 ID / 非 epoch 时间及默认 full 文案；导出终点引用校验另做窄复核。
- 真实浏览器下载、原 v148 同源接口、Windows / 原 MCP 可见范围仍未验。下载请求不代表磁盘已保存，目录 access 标签不是安全权限。

### 0.1.6 最终新代码验证终态

- 新源码 `30caf24d9e475cec46b78e4bb579c660800c7810`，新的正常验证会话 `23494` 已取得退出码 0；不是重放未知的 `46523`，旧结果仍未知。
- `npm test -- --maxWorkers=2`：34 文件 **1020 / 1020** 通过。保留前片 845 项，新 domain/adapter 140、store 28、UI 7，共新增 175 项。
- `npm run build`、`npm run build:companion-readonly`：全部 Vue / TypeScript 检查和双生产构建通过；只有原有 bundle 大小提示。
- `npm run test:companion-static`：**56 / 56** 通过；没有重新交付静态包或修改旧包身份。
- 最后窄复核确认：目录读取期间禁止新导出，刷新开始立即清旧准备句柄；目录可用时导出终点再次核 override 引用；回归覆盖 pending / 目录新快照 / 直接 store 调用。独立复审无剩余源码阻断，`git diff --check` 通过。
- 这些是新前端源码 / 合成 provider / jsdom 证据，仍不是 Windows、真实浏览器下载或原宿主预设存储验收。

## 2026-10-13：真实工程 CLI 文本复制（0.1.7）

- 基线 `2ff6651`，任务前检查点 `3fdad91`。复用已核 v148 自有纯函数，原 SHA-256 `a1dbbaa6e151f073b5a76318ada5606e5d378078d55415f6696f291645186899` 与本地保留副本一致；无依赖、API、凭据或执行权限增加。
- 新增 pure wrapper **114 项**，CLI 弹板 / 工程集成 **16 项**。完整 ID、原两段逐字保真、危险元数据拒绝、完整复制、剪贴板失败 / 未决不可撤销、项目 / 来源变化、首次打开等待 race、连续 A/B 与卸载晚响应都有回归。
- 最终会话 `48808` 退出码 0：`npm test -- --maxWorkers=2` **36 文件 1150 / 1150**；`npm run build` 和 `npm run build:companion-readonly` 均通过完整类型检查与生产构建；`npm run test:companion-static` **56 / 56**。原 bundle 大小提示仍如实保留。
- 开发期 UI 测试曾误用 teleport stub，连带替换 Element Plus 的 ElTeleport 丢掉插槽；改用真实组件后测试通过。没有用假弹窗替代真实 Element 交互测试。该 jsdom 结果仍不是视觉 / 系统剪贴板实机验收。
- 独立源码复审发现首次 nextTick 打开前只核 ID、不核同 ID 名称/路径；已冻结完整三字段及 provider 并补回归。最后复核未见剩余源码阻断。
- 页面仅按明确点击请求复制文本，没有执行其中的 CLI / Skill 要求、注册 MCP、打开外部 Agent 或改 Windows。真实 CLI 可用性、Skill 文件与自动触发、外部协议、系统剪贴板和用户机器视觉行为尚未验证。

原字节 CLI helper 为 CRLF，默认 Git whitespace 检查曾把其行尾识别为 trailing whitespace；仅对该原字节 fixture 增加 `.gitattributes` 的 `-text` 与 `cr-at-eol`，保护跨平台 SHA，保留其余空白检查。未修改 helper 字节或宽泛改变 Git 配置。

## 2026-10-13：原 AI 工程配置 / 参考读取（0.1.8）

- 基线 `47337ca`，任务前检查点 `1a67ab9`。只使用已核 v148 自有源码合同；没有新依赖、真实HTTP、服务监听、Windows修改或安全设置变化。
- 新增 domain / adapter 定向 **151 / 151** 通过；store / UI **36 / 36** 通过。覆盖固定两类只读POST、归属/状态/草稿一致性、旧v1、隐含配置文件名、PNG格式/尺寸/CRC/SHA、预算、失败、超时、取消、并发、工程A→B→A、provider与元数据变更、卸载及晚回执。
- 独立源码review三项已闭合：允许原合同合法的点开头配置basename；不安全旧参考预览按钮禁用且解释；更正原工作流参考图封存并非只有元数据。复审未发现剩余源码阻断，没有以review冒充执行测试。
- 开发期一个missing配置fixture错误地保留了非默认导出目录，被严格投影正确拒绝；修正fixture为原后台实际默认。UI测试初次静态引入Node crypto缺类型，改复用既有内置WebCrypto测试helper，无安装、tsignore或放宽类型。
- 最终新执行会话 `57636` 取得退出码0：`npm test -- --maxWorkers=2` **39文件 1337 / 1337**（原1150 + 新187）通过；`npm run build` 和 `npm run build:companion-readonly` 完整Vue/TypeScript及双生产构建通过；`npm run test:companion-static` **56 / 56** 通过。原bundle大小警告仍保留，未改变阈值。
- 真实原服务配置、Python/Pillow CPU预览、浏览器图像解码 / CSP、Windows同源会话仍未验证。任务历史与候选读取因实际Studio Python源码缺口未接；不宣称AI完整六步或生产可用。此前Library静态包不变。

## 2026-10-13：原资源配置共用编辑 / 保存保护（0.1.9）

- 基线 `c29f27b`，任务前检查点 `b80f951`。复用已核v148原resource-config-save合同；仅源码与fake/jsdom验证，无真实HTTP、Windows、模型/GPU、项目文件保存或部署。依赖树未改，package/lock版本号与新增独立构建脚本不等于新增软件。
- 原只读/普通/Picker构建不注册writer；新增 `companion-config-editor` 源构建需另行部署授权，不在此前六个只读静态文件例外中。loopback检查不是会话身份或用户操作授权。
- 新保存domain/adapter **119项**，与原reader共270项通过；store首次最终49项、UI23项与原读取UI17项共40项通过，含完整类型检查。最终收口又补known-STALE重复回读证据保护，最终汇总以下一段全量终态为准。
- 独立复审问题均逐项修复：未检测画布可填写；既有invalid文件不冒充新建且版本冻结正确；离页保留草稿可查看/按原身份恢复；v1新增字段不冒充旧保存值；provider撤销null正确失效；在途新编辑不冒充已保存；回读完整内容与差异可见后再确认采用。已知STALE结论不依赖容易变化的页面phase，UNKNOWN同hash仍阻止盲重发。
- 开发期模板参数隐式any已显式声明；初期checkbox测试错误把ElementPlus的aria-label定位到input而非label，修为实际DOM选择器。没有换成假组件、tsignore、降级断言或安装类型包。
- 最终源码候选 `9a2397f` 的 store54项、UI23项、adapter119项均保留，新增总数196。两轮整套进程分别1531/1533与1532/1533：只有旧帮助跨页DOM用例超过原5秒上限，没有断言失败；它们是失败记录，不能算全量通过。单项隔离原上限1.99秒通过，随后整份帮助导航文件原样19/19通过。
- 最终完整覆盖采用两个独立进程分批：会话 `33398` 执行 `npm test -- --maxWorkers=1 tests/help-about-navigation.test.ts`，19/19通过；会话 `47712` 执行 `npm test -- --maxWorkers=1 --exclude tests/help-about-navigation.test.ts`，其余41文件1514/1514通过。合计42文件 **1533/1533**、无跳过；没有改超时、弱化断言、删测试或把早期失败隐去。分批结果不是宣称此前单进程全量成功。
- 同一最终会话 `47712` 接续 `npm run build`、`npm run build:companion-readonly`、`npm run build:companion-config-editor`、`npm run test:companion-static`，最终退出0：三种Vue/TypeScript检查与Vite构建均通过，静态校验 **56/56** 通过。主JS约1364.78/1388.45/1405.36kB，既有1100kB告警仍保留，未改阈值掩盖。未生成或替换原已交付静态包。
- 最终窄复审确认源码/构建边界无阻断；README三处已对齐AI按构建保存、游戏资源localStorage归属、原六文件静态目录有条件批准与编辑构建另批。仅文档在最终测试后更新，业务源码和测试未再变化。`git diff --check`通过；lock剔除项目自身version后与0.1.8完全一致，没有新依赖或重跑不变依赖的审计。
- 系统浏览器、sessionStorage实机、多tab文件CAS、实际原会话和磁盘保存/回滚仍未验。所有保存回归均为fake传输；没有真实项目写入、部署或新凭据。

## 2026-10-13：原参考图上传与草稿衔接（0.1.10）

- 基线 `0af9569`，任务前检查点 `655b8e2`。仅dot源码/fake测试，复用已核v148自有合同；没有真实上传、Windows/GPU调用、依赖安装或编辑构建部署。原只读static脚本和已交付包未改。
- 领域/adapter定向 **121/121** 通过；上传store加原编辑store **103/103** 通过；新UI19加原编辑UI23共 **42/42** 通过。实际bitmap/Canvas在jsdom使用明确替身，JPEG/WebP结构夹具并非像素解码证据。
- 独立review发现并修复：adapter超时先拒绝但底层fetch/read/cancel未结束时不得释放跨配置保存租约；回执附入状态须按当前同工程草稿成员关系重算，删除/放弃重开不能沿用旧“已附入”。末版还纠正对应状态文字，避免成功提示与待回收内容矛盾。
- `waitForIdle`拒绝继续持锁；成功回执持久记录更新失败仍保留内存已知回执和先前保护，不自动保存规范。定向覆盖存储损坏/预算/写回失败、旧回执、未知结果、重复SHA、取消/切换/晚响应、租约、四引用上限与新建表单先上传。
- UI早期异步WebCrypto未等终态导致测试抢跑，改为等待实际准备终态；另有预期文案“已/已经”差异与fake Promise缺泛型，均按真实DOM/显式类型修正，没有延长5秒、删断言、假组件或tsignore。完整Vue类型检查已通过。
- 当前源代码独立复审通过，最终分批全量与三构建/56静态检查的终态以下段为准；前述定向不能代替全量。真实浏览器/原会话/Pillow/双文件磁盘结果/元数据清理/Windows并发仍未实测。

### 0.1.10 最终验证终态

- 最终源候选 `bb26351` 的新验证会话 `92075` 已退出0。按与上片相同的资源隔离方式，先运行原帮助导航19/19，再运行其余44文件1703/1703，合计 **45文件1722/1722**，无跳过、未改5秒超时或断言。本片新增189项，原1533项完整保留。
- 同一会话接续普通 `build`、`build:companion-readonly`、`build:companion-config-editor` 均通过完整Vue/TypeScript与Vite生产构建；`test:companion-static` **56/56**通过。主JS分别约1393.62/1417.28/1438.81kB，既有1100kB提示继续保留，未调阈值掩盖。
- 独立只读终态review确认bb26351范围内无未解决问题，最后回执状态文字亦已闭合。后续仅补本条文档记录，业务代码/测试没有改变。lock剔除自身版本后与0.1.9完全相同；没有安装或重新审计不变依赖。`git diff --check`通过。
- 这是源码、fake/jsdom和本地构建证据，不是原宿主、真实文件/Pillow、元数据效果、浏览器视觉或Windows验收。旧静态包、Picker bridge、原部署和真实项目均未变更。编辑构建实际部署/写入仍需另批。


## 2026-10-13：工具预设本地副本与严格 JSON 交换（0.1.11）

- 既有0.1.10基线 `27c2f1c`，任务前检查点 `b1ee0a0`，本片源码候选 `05ef219`。仅复用已核v148自有工具预设合同和已有依赖；没有真实HTTP/宿主preset写入、Windows调用或部署。原static交付和脚本未变。
- 新增领域 **99项**、内存store **41项**、实际ElementPlus DOM **18项**，合计158项；原1722项保留。严格七字段/批量20/输入输出双1MiB、未知字段/失效工具/重名/容量/core-full保护、不可变来源与备份、临时非法输入、关闭离页内存保留/刷新丢失、文件迟到/失败、来源变更和最终下载guard均覆盖。
- 独立只读复审发现并修复两项：JSON没有原工程信息，导入来源不能填当前工程；可规范化导出的首尾空白名称也应能创建新身份副本。对原权限措辞做准确化，避免工具可见范围被当Creator授权。最终复审确认05ef219无剩余问题，未把review当执行结果。
- 首轮会话 `10186`：帮助导航19/19通过；其余47文件1861项中1860通过，只有原 `ai-resource-read-ui.test.ts` 的错PNG hash用例超出原5000ms（5741ms），无断言失败。该轮退出1，三构建未执行，不能标记全量通过。
- 同一未修改源码候选的新会话 `90180`：先将该旧AI读UI文件隔离执行 **17/17** 通过，再执行其余46文件 **1844/1844** 通过。与10186中成功的帮助19合计 **48文件1880/1880** 完整覆盖，无跳过；保持原5秒、真实Element组件与所有断言，不宣称此前单进程成功。
- 会话90180随后普通 `build`、`build:companion-readonly`、`build:companion-config-editor` 三次完整Vue/TypeScript检查及Vite生产构建均通过；`test:companion-static` **56/56**，最终exit0。主JS分别约1419.37/1443.04/1464.56kB，已有1100kB告警如实保留，未提高阈值掩盖。
- package-lock去除项目自身version后与0.1.10完全相同，没有新增依赖或重跑不变依赖的审计；`git diff --check`通过。测试后只补本记录和README终态，不再改业务源/测试。
- 真实系统文件选择/下载、浏览器视觉与响应式、当前原宿主快照仍未验证。页面本地JSON操作不等于宿主CRUD/import/assign已迁，更不改变工程工具范围或MCP权限。按父任务本片先报告证据，未自行上传或替换Library/旧静态包。


## 2026-10-13：独立知识库问答与会话保护（0.1.12）

- 基线 `0ee8c91`，任务前检查点 `1c4bd55`，源码候选 `b5969b5`。复用已核v148自有chat合同；仅dot fake/jsdom验证，无真实问题发送、模型/Windows调用、新依赖或部署。已有static脚本/包及后端binder未放行chat。
- 新增domain/adapter **96项**、store **33项**、UI及host界限 **26项**、实际main装配 **9项**，共164项。main测试动态导入真实入口而仅mock注册依赖，证明readonly/config-editor不注册chat、chat不注册save/upload/image、错误宿主不退回Picker且所有构造不自动fetch。
- 完整覆盖严格原输入/回答/文本引用、4096字节请求/2MiB响应/块数/fatalUTF8、403精确前置拒绝与CHAT_UNAVAILABLE区别、每次opaque确认、重复点击、KB/provider/工程本地scope与A→B→A隔离、迟到答复、UNKNOWN旧会话/发送记录保留、单飞与fetch/read/cancel实际settle、内存预算和明确清理。
- 源码核对收口修复：未返回时sessionId必须null，不能把旧requestSessionId冒充返回回执；成功已收到但底层cleanup仍pending时取消不能降级成功；leave保留问题草稿；waitForIdle拒绝保持全局锁但不否定已知答复。CHAT_UNAVAILABLE文案不推断唯一根因或污染检索认证。独立review及最终差异复审均无剩余阻断。
- 开发期adapter测试修复跨realm Uint8Array检查，以及it.each数组展开导致的TypeScript fixture错误；另把注入transport/reader异常视作本地固定unknown，不能信任其伪造error outcome。未延长超时、弱化断言、使用假Element组件或新增依赖。
- 最终会话 `67108` 对同一b5969b5完整运行：帮助导航 **19/19**，原AI读取UI **17/17**，其余50文件 **2008/2008**，合计 **52文件2044/2044**，无失败/跳过。继续沿前序的三进程资源隔离方式，原5秒测试上限保持不变，本片没有失败的最终回归轮。
- 同一会话普通build、companion-readonly、companion-config-editor、新增companion-knowledge-chat **四次完整Vue/TypeScript与Vite构建通过**，test:companion-static **56/56**，最终exit0。主JS约1438.10/1474.34/1483.37/1478.49kB；既有1100kB体积提示如实保留，没有改变阈值掩盖。
- package-lock剔除自身version后与0.1.11完全相同；没有安装或重跑不变依赖审计。git diff --check通过。最终执行后仅补README/本记录，业务源和测试未再修改。
- 实际浏览器、原宿主会话、模型调用/收费、服务端保存及取消效果均未验。客户端idle只代表客户端Promise结算，不证明服务端/模型终止；刷新会丢失内存记录及本页fence，不能据此把旧请求当未发送。真实问答构建部署和每次发送需要明确授权，不继承旧readonly/config-editor的部署范围。
- 本片按任务先交证据，未上传Library、未改旧静态包。自定义Agent、同步、服务启停及AI任务等剩余功能仍未全迁。

## 2026-10-14 · 0.1.13 被动只读连接修复

源基线从Library v12恢复，201文件manifest逐字节核对，Git tree与f1167e9完全一致；独立任务checkpoint c451df5。原dot 0.1.4/4d1429c工作树不动，旧SOURCE-MANIFEST/SHA256SUMS移至独立v12-recovery-manifests证据目录，不作为新版本清单。没有依赖变更或安装。

- 定向7文件324测试通过（session90283，退出0）。早期类型检查发现新增fake事件枚举`invalid-event`不合法，已改为真实`invalid-frame`；后续Vue/TS检查退出0，没有改原超时或断言来回避。
- 最终完整53文件2060测试通过（session91181，退出0；2044基线+16新增，无跳过），包括首次零请求、连接只projects/counts、手动读取、实时/SSE失败/隐藏恢复/离页、401/403/404/500、直接数组/错误包装、配置只读与Python预览拒绝、实际main五类宿主隔离、页面禁用和未探测文案。全部fake/jsdom，不访问原服务。
- 普通production、companion-readonly、companion-config-editor、companion-knowledge-chat四构建，以及56项静态检查全部通过（session53916，退出0）。四构建均含vue-tsc；已有1100kB chunk警告保留，未调大阈值。
- 独立只读源码review通过；未运行真实浏览器、Windows、模型或用户API。review最后指出README旧版本字样已修正，恢复清单已移出新版源码目录。GET不是零副作用保证，本候选禁止状态/发现/知识CLI/参考Python，仅保留明确读取合同。详见passive-readonly-013.md。
- 原v12源码与README Library、原0.1.4静态Library没有覆盖/升级；相对base新候选仅dot准备，部署待明确批准与现场复核。

日志保存在本次隔离准备目录：full-tests.log SHA256 `3874bf1437367aa6513d8504c25079e81f319798174c9b51f722c137bdbd1a2f`；four-builds-static-tests.log SHA256 `ee524f9c8e45b3dec63dd30331f055597f87a72677c5757a8d65f46849045a25`。日志的测试宿主本地时间不作为Windows运行时间证据。


## Next 0.1.14：正常工程状态与 Creator 启动 / 聚焦

2026-10-14，任务检查点4896086，基于0.1.13完成提交c3af4b4ac25ab702c1c6223f0326022e2c18e458。真实v150合同经原维护线程只读确认。本片dot源码实现，不触发实机状态、CIM、Creator启动/聚焦、配置写入或部署。

- 首片相关8文件327项通过；最终完整58文件2256项全部通过，未跳过（单worker，60.85s）。
- 五构建分别通过类型检查与Vite生产编译：默认、companion-readonly、companion-config-editor、companion-knowledge-chat、companion-workspace。新正常模式base `./`；原已交0.1.13静态候选不改变。
- 原静态候选脚本56项通过；没有为正常模式冒充只读部署授权。
- 原依赖锁版本不变，仅项目版本0.1.14，无安装、升级或新增第三方。
- 独立源码复审发现并闭合三点：3秒轮询撤销确认；发送后聚焦标题/目标消失；成功后清理期间换来源/离页仍回读。新增暂停工程轮询13项及UI相应回归，保留手动刷新撤销、SSE/日志、UNKNOWN/传输清理保护。定向复审通过，无剩余源码阻断。
- 初次新UI测试4项失败，原因是ElementPlus弹窗teleport到body，原测试只查组件wrapper。增加dialogOpen/冻结目标断言并按既有DOMWrapper方式核查真实DOM后通过，未放松业务确认。首轮完整2255通过/1失败是旧测试写死v148目标；当前已核目标v150后端，修正精确版本文案后重新全量2256通过。
- 构建保留原Vite chunk>500kB警告；未为消除警告增加依赖或扩展本片。

日志字节/hash与终态见 `evidence/normal-project-014.json`。UI可审查展示见 `creator-flow-review.md`，不是浏览器截图。真实浏览器像素布局、原宿主Cookie、原生窗口、跨tab实际并发、正常模式部署仍未验。本片只是旧功能恢复第一条核心链，完整迁移尚未完成，当前剩余项见 `feature-parity-current.md`。


## Next 0.1.15：停止 / 重启原动作与谨慎回执

2026-10-14，检查点333cf7f，基于0.1.14完成commit41454be463081fca6e3edbc3588d48f97894d91d。只在dot补原stop/restart源码与fake交互，没有真实请求/Windows操作/进程启停、安装依赖或部署。

- 聚合7文件370项通过；最终完整58文件2408项全部通过，无跳过（63.84秒）。
- 默认、只读、config-editor、knowledge-chat、正常workspace五构建均通过Vue/TypeScript与Vite生产编译；静态检查56项通过。保留已有chunk size提示，未改变预算规避检查。
- 独立源码复审通过。补正真实后台码DASHBOARD_OPEN_WITHOUT_BRIDGE与短码错配，并补短码不误匹配回归；同时修正该码可来自重开后的Bridge失败，不能统一宣布重启未发生。store/UI与文档保持阶段未知、可能已有影响。
- stop响应必须对应工程且state=stopped；只保留回执，不直接写卡片当前状态。明确不证明OS退出。未保存错误只保留本地文本提示和UNKNOWN，不生成伪业务码、原始错误或任意HTML。
- 原目标/来源冻结、确认一次消费、跨动作单飞、取消/离页/迟到回执拒绝、UNKNOWN新读取屏障及底层清理失败阻断均保留。
- v148的Boolean(result)与Dashboard等待局限已记录，v150未保存精确原文/类型处理与等待内部细节尚未复核。前端没有替旧后台修复安全逻辑，也不宣传所有未知保存值均拒绝。

0.1.14正常候选已冻结为682939B ZIP，SHA256 `e1c24005d8c17678a465d5ef9cc47ce2b4b8bf47c67031a4aba906f4ea37c4e4`；CRC与逐文件字节核验通过。本片再次核hash一致，未覆盖、上传或部署；0.1.13只读候选同样保持。完整日志hash见 `evidence/creator-stop-restart-015.json`。UI文本/DOM审查展示不是实机截图，实际浏览器、原生进程及生产部署仍待验；完整旧功能迁移未完成。


## Next 0.1.16：打开目录 / 移除登记与独立回读

2026-10-15，基线c5e1d929ff261d24ba42b5dfd20cd81ac17c4a70，任务检查点707dc8c。仅dot源码/fake/jsdom，原v148自有源码合同已核；没有真实API写入、Windows操作、目录打开、部署或新增依赖。v150停止检查的两层Boolean风险由父任务提供只读证据，本片仅更新新UI/文档。

- 定向4文件552项通过：adapter305、store209、实际ElementPlus DOM25、原轮询暂停13。
- 最终会话19050完整58文件2620项全部通过，无跳过（57.09秒），较2408基线新增212项。覆盖固定DELETE无body、POST空JSON、严格回执/路径、removed:false、不乐观删除、共享全局单飞、冻结确认、部分结果UNKNOWN、旧在途读/来源A→B→A/同reader重连/清理失败，以及原生命周期状态屏障。
- 同一最终会话继续完成默认、只读、config-editor、knowledge-chat、正常workspace五次Vue/TypeScript及Vite生产构建，静态脚本56/56，终态exit0。正常workspace相对base ./；既有chunk size提示保留，未放大预算掩盖。
- 初轮完整2620通过（57.53秒），随后首build因store测试故意构造非布尔removed而直接类型断言触发TS2352，未执行后续构建。改为显式unknown再断言，运行值与断言不变；之后重新完成上述全量与五构建，不用早期成功冒充最终整轮。
- 独立源码复审通过。修复两处文案：工程对照不能把尚未迁入的添加/setup写成已迁；未知ID500仅针对open-folder，DELETE缺ID应是removed:false。最终readback返回值需本次新revision与readgeneration，避免旧成功结果被当作新刷新成功；来源永久解绑、旧在途读取隔离均复核通过。
- package-lock除工程自身0.1.16版本外完全等同基线，无安装/升级。git diff --check通过。正式执行后仅补本记录、README和证据JSON，不修改业务源/测试。
- 0.1.14冻结ZIP再次核对682939B、SHA256 e1c24005d8c17678a465d5ef9cc47ce2b4b8bf47c67031a4aba906f4ea37c4e4，未覆盖/上传/部署。正常模式部署仍需批准，旧只读包不自动扩大能力。

详细日志字节/SHA与本轮正常构建完整文件清单见`evidence/project-registration-016.json`。DOM审查说明见`creator-flow-review.md`，不是实际浏览器截图。真实v150管理端点/同源会话、文件管理器视觉、注册与工具绑定落盘、跨tab行为均未实测；完整功能迁移仍未完成。

## Next 0.1.17：已有工程仅登记 / 显式完整安装接入

2026-10-15，基线858ed2884626500e35ff8334daadb8c02a94604f，任务检查点f9a9161。逐项复用已取得的v148原注册表、setup、Bridge安装与Codex配置实现；v150大合同既有只读证据与本轮fake验证分开。没有真实登记、安装、启停、Codex写入、Windows操作、依赖安装、上传或部署。

本片实现：手动绝对路径仅登记、规范路径回执、原工程重读后单独全量setup；五项默认未勾选与精确目标/来源确认；202任务追踪、有限串行GET、UNKNOWN/暂停/隐藏/离页、显式同ID恢复与同页共享操作锁。没有严格部分setup、原生目录选择、scaffold、工具分配或其他Agent配置。部署及原宿主实际效果仍待批准和验收。

首轮完整运行session15366返回3019通过/4失败：帮助矩阵断言仍写死MCP完全未迁，改为当前“完整setup源码·其余待迁”并额外约束未部署和其它Agent边界；状态worker最后3项原始metadata边界回归/修正与首轮启动交叉，因此未采用该轮为最终证据。源码稳定后重新全量执行，未放宽超时、跳过测试或删减安全断言。早期类型检查还纠正两处测试fake返回字面量的TypeScript宽化，不修改运行语义。

独立复审发现并关闭终态释放共享锁时的同步重入竞态：先清理旧操作引用再发布解锁，不覆盖新任务；登记同样处理。补初次computed尚无任务时的canResume响应性、确认期间轮询协调、source重连/原始metadata修改、隐藏/迟到/清理失败、原任务复用提示及202非终态回归。实际ElementPlus DOM17项与原Creator25项一并包含在完整测试中，不能当浏览器像素或Windows验收。

中间session21505完整3023项、五构建及56静态检查已通过；随后独立复审指出暂停后canResume缓存与原始provider标签变动可留下假tracking（不发送新请求、也不解锁）。已在resume入口与后续边界重新核对原上下文，补第83项状态回归；最后定向复审通过。最终结果只使用修复后新的完整session63744，不将中间结果沿用为最终。

最终session63744 exit0：62文件3024项全部通过、零跳过，63.35秒；默认 / 被动只读 / config-editor / knowledge-chat / 正常workspace五次Vue/TypeScript与Vite构建均通过，静态脚本56/56。正常workspace实际输出6文件、2062708B，固定base ./，经原静态检查器核对所有路径、资源引用、字节及无链接。现有chunk size警告保留，没有调阈值规避。

独立源码复审所有发现已关闭，reviewer未代跑测试。依赖锁除工程自身0.1.17版本外与f9a9161基线完全相同；git diff --check通过。冻结0.1.14 ZIP再次核实682939B、SHA256 e1c24005d8c17678a465d5ef9cc47ce2b4b8bf47c67031a4aba906f4ea37c4e4，未覆盖、上传或部署。最终执行后仅补文档和证据，不修改源码/测试。

详细原合同文件hash、日志hash与完整正常构建清单见 `evidence/project-setup-017.json`。本轮没有源码ZIP或Library版本变更。正常0.1.17包含新增完整setup写能力，不能沿用冻结0.1.14的候选或旧只读部署授权自动替换。严格部分setup、原生目录选择 / scaffold、真实v150接入与持久配置及完整旧功能覆盖仍未完成。

## Next 0.1.18：工程界面减文案、问号提示与直接启动 / 聚焦

2026-10-15，基线00052ded324ec8a206829c9e62a58bcb7b8d3293，任务检查点7295ba0。只实施Owner明确四项UI调整；原导航分组/顺序/路由与帮助入口保持，未确认的操作记录弹窗和导航重排已撤回。start/focus点击直接冻结目标并发送原动作，不进入setup；危险动作与完整接入确认不变，未调用实际API或Windows。

- direct状态层274项、工程/动作真实ElementPlus DOM52项、导航21项、setup22 UI＋83 state、InfoTip5项定向通过。键盘focus/Escape、文本转义、等待禁用/重复点击、未知结果新读屏障、原来源与A→B→A、晚回执/清理失败、既有日志/调用入口均覆盖。
- 独立源码复审关闭三项：ack早于cleanup不能提前成功toast；重新挂载不重播旧终态；setup锁定关窗后的ID/路径/完整错误以及ack/complete清理中仍可从原状态问号读取。无新历史入口，解锁完成后不留下常驻回执。
- 首轮session45388完整3096项、五构建和56静态检查exit0。末尾诊断tip调整的一次复合执行返回取消，无session/exit；只读核实修改已落盘且无测试进程，该次测试结果保持未知，没有重放文本插入。获准后对新源重新验证，session44028定向110项和typecheck通过。
- 最终session1940（05:35:45–05:38:02 UTC）exit0：63文件3097项全部通过、零跳过，67.81秒；默认/只读/config-editor/knowledge-chat/workspace五种Vue/TypeScript与Vite生产构建通过，56/56静态检查通过。旧chunk size警告保留，没有调整阈值。
- 正常workspace实际输出6个相对base ./ 静态文件，所有资源引用/路径/SHA/普通文件边界由既有检查器复核；完整清单与日志hash见`evidence/compact-ui-018.json`。锁文件除本工程版本外完全等同基线，无新依赖。最终执行后仅更新文档和证据，没有修改业务源/测试。
- 当前无dot cloud browser工具入口，未使用用户电脑CUA或重试已拒exec Chromium，因此没有运行截图，也不把DOM测试当像素/窄屏/真实窗口验收。消费端须验证实际同源页面、图标tip布局与点击效果，不自动触发真实setup/启停作为部署测试。

0.1.14冻结ZIP与0.1.17交付ZIP逐字节hash保持。仅准备新的0.1.18正常静态部署包，部署由既有消费任务负责。本片没有增加功能覆盖或声称完整旧功能迁移完成；其余范围仍以`feature-parity-current.md`为准。


## Next 0.1.19：工程入口同步、紧凑布局与稳定实时显示

2026-10-15，基线2e6f7d9336c13fb61a4bd6e567e1a9ebbb37bd28，检查点4b5f5ca。Owner明确六项调整，随后文字定位红框是工程标题与问号间距，并补充实时刷新闪动。只在dot源码/fake验证，未操作Windows、真实启停/setup、依赖、账号或权限。

- 正常workspace显式entry政策：初载、路由重入、回前台、logs/calls回工程读取原projects/status/counts；其他构建保持手动政策，不自动Dashboard/CIM/SSE/安装。已有Creator/setup UNKNOWN、确认、传输与共享lane阻断自动读。
- 紧凑工程卡与同行添加、箭头展开、应用内安全返回；标题和问号同inline-flex组。日志控件同行换行与原24px阈值“↓ 最新”。原setup实例跨tab保留，不丢输入/任务状态。
- live路径本身没有reload/导航循环；修复后台连接spinner和通用读取提示插入造成的刷新感，原安全busy禁用保留。相同快照复用数组，真实revision照常推进；多轮慢读保持DOM、卡片展开、输入焦点/选择、筛选与scrollTop，实际状态变化仍更新。
- 新入口22项（含真实BrowserView/router）、新布局15项（含3轮9秒延迟工程读及日志突发）、既有浏览器DOM17项、导航28项、后台清理4项定向通过。UNKNOWN登记经waitForIdle释放lane后关窗/可见/重入也不能自动解除屏障，必须手动读取；独立review此发现已关闭。
- 首轮session76638完整66文件3145项通过（77.62秒），首个类型检查因新fake状态缺必填capabilityProfile而失败。仅补fixture为unknown，生产逻辑不变；首轮日志完整保留，之后对最终代码重新全套验证。
- 最终session72035 06:23:01–06:25:28 UTC exit0：66文件3145项全部通过、零跳过（77.15秒）；默认、被动只读、config-editor、knowledge-chat、正常workspace五种Vue/TypeScript与Vite构建全过；静态56/56。原chunk size警告保留，没有放宽阈值。
- 正常workspace实际6文件2,078,081B，base ./，资源图/普通文件/无链接与全部SHA经原检查器核验。锁文件除本工程版本外不变。最终执行后只补文档/证据，不再改业务源或测试。
- 独立只读源码review闭环；取消/失败/源A晚到不能清B标志已补回归。没有dot cloud browser入口，未用用户电脑CUA，也未重试旧拒绝Chromium路径；没有截图/像素/真实窄屏或实际同源验收声明。

父任务转交Windows维护只读证据证明当时ant-cook实际ready/Creator3.8.8，前端018确缺自动初载；不唯一归因Owner历史当次，也不据此自动启动/重装Bridge。冻结014/017/018 ZIP哈希保持。新019独立包交给既有消费方验收部署，dot不自行Windows操作。详情和完整hash见 `evidence/project-ui-019.json`、`project-ui-019.md`。


## Next 0.1.20：真实工程概览与已批准界面修正

2026-10-15，基线bff3e733，检查点6d8afe9。最终session72228 exit0：67文件3184项全部通过（17.13s）、零跳过；五构建及56静态检查通过。完整时间、日志SHA、静态文件与保护包证据见 `evidence/project-ui-020.json`。

- ready卡片可收起，状态轮询/切tab/重挂载不强制展开；无生命周期副作用。
- 向导仅恢复原自有v148深色调；五项选择、明确确认、共享锁、202与UNKNOWN不变。
- 概览首位及默认首页真实接入登记工程；完整ID/路径/provider身份隔离，资源只显示选中工程的已读规范，未知库存不补示例或规划草稿。
- 新概览33项与旧相关48项合81定向通过；折叠/颜色43项。两次独立源码review关闭禁用勾选/hover对比、缓存列表深链和修饰键点击问题。
- 早期依赖CSS注入回归曾通过；前端缺node:fs类型后Vite raw导入共享依赖CSS被Denied。该路径停止，最终仅自有CSS+组件DOM验证；没有更换读取路线、放宽权限或装类型包。完整最终CSS级联及真实像素未复验。
- 无dot浏览器工具，未调用用户电脑或重试历史被拒Chromium；未真实连接/启停/安装/保存/生成/部署。014/017/018/019 ZIP原字节保持。


## 1.3.171 正式页面接线与统一版本

2026-10-15：按用户逐页正式化要求恢复服务真实探针、正常workspace配置保存/参考上传/知识问答、原知识启停/模型启动器关闭、工具预设持久操作、原AI jobs/status/candidate手动读取。完整差距仍在功能矩阵，不把本片称全部迁移完成。版本按最终要求150+21统一为1.3.171，已核0.3.150仅构建基线。

最终run45658：78文件3478测试，vue-tsc，五种Vite构建及56静态检查全部退出0；测试0失败/跳过。前一run27018的3477项及构建也过，但其后独立review要求回读区标清冻结原来源/路径，补DOM回归后完整重跑，以新结果为准。完整证据 `docs/evidence/production-pages-021.json`，逐页验收 `docs/page-acceptance-021.md`。

独立只读review闭合所有本片已发现源码问题。测试全为fake/DOM；旧014/017/018/019/020包SHA未变。没有新增依赖或实际Windows、服务启停、模型发送、生成/导入/项目保存调用。真实视觉与像素/浏览器CSP仍未验。中间AI子片npx检查遭网络风险拒绝，已核前段修改落盘未重施；最终按明确收窄授权仅直接Node运行既有本地工具，没有重试该npx外部访问。
