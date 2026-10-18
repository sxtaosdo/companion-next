2026-10-18 SSE缺口已修复并静态交付：源81ea56c/.92，135个不同定向用例及最终类型/构建通过；真实工程→概览→帮助→工程自动恢复，返回projects/status/counts/events各1次，最多1活动流；主动停止后返回仍off。六HTTP哈希一致，daemon20116不变，未重做其它业务。见[修复与最终证据](sse-navigation-resume-fix-20261018.md)。下文“只读未修”保留发现时点，当前缺口已关闭；知识服务未运行仍未启动。

# 一次真实只读导航/状态验收（2026-10-18）

状态：Accepted。源码基线dd92900/.90，正式静态b142600/.88。用户限定一次现有服务批量验收；完成即停。仅正式32180会话读取，原生目录窗口打开是本组明确批准的唯一POST业务动作。未重启daemon/Creator、扩监听、测库存或保存，未模型/问答/同步/安装/配置/预设/创建任务操作。不部署无变化静态，不重跑功能测试。

## 一次批量结论

| 验收 | 本次真实证据 | 结论/限制 |
| --- | --- | --- |
| 工程状态同步 | 正式页面初载及手动刷新均读原GET /api/status；目标68a5dccc481a8588真实state=ready、Creator3.8.8/PID23740、原会话d4e9a8b9-39e9-4e6b-8fe5-3c237b04c42d；工程卡显示就绪 | 通过本次API→UI同步；不代表启动/停止等全部状态切换都验过。 |
| 打开目录 | 正式工程卡→打开目录→核对目标并确认；POST /api/projects/68a5dccc481a8588/open-folder一次200，路径D:/code/shidai3/P4000/colony-flow-food-hunt；COM实际识别新资源管理器HWND329348，目标路径匹配且Visible=true | 通过真实原生打开；仅关闭此轮新窗口，原窗口未关闭。这是打开已有工程目录，不是添加工程的目录选择器验收。 |
| 只读日志 | 正式日志页“查询/刷新日志”，原GET /api/logs200，响应17条，DOM17行 | 通过本次读取，不保存原始日志内容；未DELETE/清空/诊断。 |
| 服务状态页 | 原GET工程/状态和knowledge-service/status、model-service/status均返回；Companion API已响应且有目标Creator行 | 通过真实服务读取。知识running=false/frameable=false；模型启动器running=true仅表示已有启动器可达，不代表模型/GPU运行，本轮未启动/调用模型。 |
| 知识内嵌页 | 知识页手动“读取当前服务状态”，原接口仍running=false/frameable=false，页面无iframe | 外部依赖阻塞，未通过已有知识管理页可达性；页面正确不生成iframe。不启动知识服务/模型，不绕过frame/CSP，不调用CLI/检索/问答/同步。 |
| SSE初连、离页、返回 | 初批真实GET /api/events200、text/event-stream；切页返回等不到open。仅对该失败补一次有界定位：初连真实open；到帮助页真实close；返回工程页显示“实时更新未启用”；手动启用后第二条真实流open | 初连/关闭/手动重连通过，**跨路由自动恢复未实现**。没有合成事件，不制造任务或日志来触发消息；不声称事件回放、无遗漏或长时连续性。 |

## SSE准确缺口（本轮只读未修）

`src/views/CompanionBrowserView.vue:112` 的onBeforeUnmount调用 `store.cancelReads()`；`src/stores/companion-browser.ts:26` 的cancelReads直接调用stopLive；stopLive清liveEnabled、eventProvider和绑定，返回页面没有可恢复的订阅意图。真实页面返回off与源码一致，所以不是知识服务不可达、鉴权失败或后台SSE断连。与页面“离页暂停”的提示相比，当前行为需要手动重新启用。

这次确认了一个新的纯Next恢复缺口，取代此前“未发现新缺口”的只读推断。本组任务限定只读，不改功能代码/事件策略、不新增计时/重试、不重新部署；如另行修复，需区分用户主动停止与导航暂停，并保护来源变更/UNKNOWN/隐藏页。此处仅记录准确边界，不自动扩展本轮工作。

## 证据及停止条件

本轮目录：`C:/Users/33272/AppData/Local/Temp/companion-readonly-live-batch-20261018/`。

- `batch-proof.json`：六项结果、实际请求/响应状态、target状态、安全限制、初批daemon前后身份；唯一非GET业务请求是上述目录POST。blocked=0，pageErrors=[]。
- `sse-diagnosis.json`：真实EventSource的open/close/error计数与四阶段状态，automaticResumePassed=false、manualReenablePassed=true、actualBusinessWrites=0。
- `project-status.png`、`service-status.png`、`knowledge-service.png`、`sse-return-off.png`：独立认证页面截图。
- `native-before.json`：原Explorer窗口基线；目录打开时的原生证据在batch-proof.json对应结果native字段（targetVisible=true/newOwnedWindows/closedOwnedWindows）；`native-directory-proof.json` 为finally再次确认清理的末态，不能拿末态targetVisible=false覆盖先前已打开证据。

正式daemon前后PID20116、startupEpoch、入口SHA不变；phase=OPEN、unknown=[]。原用户浏览器和标签未触碰，两个本轮自建无GPU浏览器已关闭，本轮原生窗口已关闭，无新监听或剩余测试窗口。读取Bridge状态可能按原实现更新运行诊断日志，未声称后台字节全只读。

导航/状态读取证据已具备，知识服务阻塞和SSE自动恢复缺口均已准确落表，到此结束，不继续轮询或人为延长会话。733库存、原生保存、96资产、原图片库决定均沿用原证据/用户决定，本轮未再操作。
