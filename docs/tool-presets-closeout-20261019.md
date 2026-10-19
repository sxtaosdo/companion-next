后续更新：页面覆盖保存及名称/ID冲突拒绝已真实通过，#15按限定主流程关闭；当前12/7/2，见[最终页面验收与统计追溯](tool-presets-page-acceptance-20261019.md)。以下保留前次15:24时点记录。

# 工具预设最小真实收口（2026-10-19）

检查点 `6c98883 / 1.3.173.148` 后，现有部署 UI `a8e88ac / 内部1.3.173.146` 的两项批量导入、导出、fixture 分配与真实 MCP 新连接应用通过。本轮未发现需要修改的 Next 产品缺陷，没有部署、重启或重复此前全套测试。

## 逐项证据

| 流程 | 真实结果 | 证据 |
| --- | --- | --- |
| 目录读取、本地选择 | 117 项目录，57 项 core；选择 core 预览和导出期间，预设文件完全未变 | proof.json / readonly |
| 内置预设导出 | 浏览器真实下载；导出为新的自定义 core 副本，未复用 core ID、未持久化 | built-in-export.json |
| 两项导入 | 仅两个唯一任务 ID；Next 本地 JSON 候选→整体确认→POST /api/tool-presets/import 201；core/full 基础和 enabled/disabled 覆盖均逐项回读一致 | proof.json、import-readback.json |
| 自定义导出 | 浏览器真实下载；ID、名称、基础范围、覆盖及时间与持久项完全一致 | custom-export.json |
| 工程分配 | 仅 fixture a79f4915296f4091；Next 原确认按钮 POST 200，并回读选中范围 | proof.json、assigned-scope.png |
| 实际 MCP 生效 | 原安装 CLI stdio 的 initialize/tools/list：原连接保持117项；新连接57项，与计算集合逐个名称相同，加入 scene_create，移除 project_write_lease | proof.json / clientApplication |
| 清理 | 原仓库方法仅移除本次 fixture 分配；Next 普通 DELETE 两个自有 ID 各200，无 confirm=true；原文件 SHA256 完全恢复 | proof.json、restored.png |

此前真实创建、改名、草稿保存、单项导入、分配及引用删除409已在[10月18日验收](remaining-real-acceptance-20261018.md)完成，本轮复用而不重复。

## 范围与未验证

实际客户端为现有原 CLI MCP stdio 连接，未写入真实 IDE 配置，不能据此声称 Cursor/Codex 等 IDE 的登记、接收或业务工具执行通过。只发送 initialize/initialized/tools/list，tools/call 为0；两连接正常关闭，stderr为0，没有预设读取失败后回退full。

本轮覆盖规则通过 JSON 导入真实持久化并在新连接精确应用；页面逐工具编辑后正式保存没有另做真实验收。多项草稿保存、重名/ID冲突的真实拒绝和并发写入没有本轮证据。原 API 不提供 CAS/原子并发校验，当前 UI 已说明，不能把缺少此宿主能力称为迁移新增缺陷。

因此 #15 的这些主流程已真实通过，但整行保留“部分完成”，21项统计维持11通过/8部分/2暂停。最小后续仅需隔离预设的页面覆盖编辑→正式保存→回读，以及同任务ID/重名冲突的拒绝确认；不需要再跑目录、导出、分配或 MCP 连接流程。真实 IDE 接收/执行仍归 #13/#14 的独立范围。

## 原状态保护

- 原预设文件前后 SHA256 均为 `dfe12eab0cb4206f682b77f95a4dabc11661362adcdc43387c29c568acd0dec2`；另4个工程分配未变，自有预设剩余0，fixture恢复隐式full。
- cocos-mcp 共享22项修改、21个保护源文件及312个安装文件哈希未变；fixture HEAD、跟踪文件、原 settings、profile 和原 `?? settings/` 状态未变。
- daemon PID4264、原epoch b4ad0920-0c1a-4add-889e-cde005e96e6f、OPEN 保持；本轮会话计数归零，原 nativeEpochUnproven=2 / UNKNOWN 保留。CLI serverInfo 的0.3.142是内嵌常量，不代表宿主0.3.147被降级。
- Creator进程0，Dashboard3924保持；未启模型、Creator、新服务监听，未触及用户浏览器、真实IDE配置、旧宿主生命周期或VS Code候选。

旧宿主子进程修复继续等待用户对具体文件范围的确认，本轮未实施。机器证据和截图见 [manifest](evidence/tool-presets-closeout-20261019/manifest.json)。
