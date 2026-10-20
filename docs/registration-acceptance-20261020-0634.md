# 正式客户端登记：安全审查及离线修复候选

当前正式登记流程仍不能算验收通过。发现一个会影响已修复连接的确定缺陷：**当前已安装后台的 Cursor 登记 writer 会把 Node＋原 JS 的配置重新写回直接运行 JS**。Windows 上这正是此前触发 OS 193 的启动形态。因此本轮没有向生产登记接口发送 POST，也没有覆盖用户配置。

这不是根据旧源码推测：已从当前安装的 daemon sourcemap 提取真实运行源码并绑定哈希。daemon SHA 为 `70df42a8f84e6bf9d32c050919fcb91565ff4b53ff9f85a3b1e50664d267ca65`；Cursor writer 源 SHA 为 `27cc842a4894948333d21f9f25924c849711cac3775857dc381d97389697cd62`。真实默认文件系统 writer 已在显式 Temp 合成配置上复现回退。测试没有执行客户端，没有访问真实用户配置或启动监听。

## 已完成及证据

| 项目 | 结果 | 证明范围 |
| --- | --- | --- |
| 正式路径核对 | Passed | 工程卡“注册 MCP”→单独选择客户端→确认→`POST /api/projects/{id}/mcp/register`；该接口没有 dry-run 分支 |
| 当前安装实现核对 | Passed | 真实 map 中 registerMcp 把 context.creatorAiPath 传入 writer；Cursor writer 仍取该 JS 作为 command，args 只有 mcp/--project/id |
| 当前缺陷离线复现 | Passed（证明缺陷存在） | 当前安装 writer 在 Temp 将已有 Node＋JS 配置 changed:true 改成直接 JS；不等于正式功能通过 |
| Cursor 最小修复候选 | Passed，仅离线 | 7项定向测试通过、0失败、0跳过；strict TypeScript 通过 |
| 正式生产登记执行 | Never run | 已知会回退正确配置，不以冒险重写代替验收 |
| 真实客户端连接与工具执行 | 本轮按用户上限跳过 | 未发现现有日常Cursor窗口，本轮请求0；历史连接通过不代替实际调用 |

候选仅在 Windows 且入口为 JS 时使用现有 Node 的 `process.execPath`，参数为“原 JS、mcp、--project、原工程 ID”。它精确识别旧 managed 形态和新 Node managed 形态；Windows 路径斜杠及大小写等价时保持字节幂等；拒绝同名其他工程、其他程序、其他脚本、额外执行参数或非 stdio 类型；升级时保留目标原有 metadata 和其他配置。非 JS 的原执行入口保持原有行为。未新增服务器、凭据、权限或产品交互。

七项测试覆盖当前缺陷复现、旧配置升级及原设置保留、已修复配置幂等、其他工程拒绝、foreign 程序拒绝、其他脚本/额外参数/错误类型拒绝、非 JS 入口保留。全部使用当前安装 writer 及其原子文件提交依赖的类型擦除模块，配置写入只在本工作单元的 Temp 合成目录发生。初次准备时缺少安全依赖、Node 类型路径不正确的问题均已修正；最终实际执行的七项测试和 strict 类型检查全部通过，没有将准备失败记成产品故障。

[实际结果](evidence/registration-acceptance-20261020-0634/result.json) · [精确补丁](evidence/registration-acceptance-20261020-0634/cursor-configurator.candidate.patch) · [候选源码](evidence/registration-acceptance-20261020-0634/cursor-configurator.candidate.ts) · [测试及逐项结果](evidence/registration-acceptance-20261020-0634/cursor-candidate-results.json)

## 跳过事项与准确剩余

| 跳过事项／影响 | 原因及已尝试结果 | 准确剩余及建议下一步 | 能否独立继续 |
| --- | --- | --- | --- |
| Cursor 正式登记 POST；不能宣称“登记后可用” | 当前安装 writer 会回退 Node 启动修复，Temp 真实 fs 已复现；生产 POST 0次 | 合并审查后的 Cursor writer 修复、Next 回执兼容修复及打包部署后，在现有 cocos/cook 对应目标单独登记，先核对配置哈希及语义，再读回并验实际客户端；不得全选或改旧 Mac 条目 | 可继续离线代码审查；当前生产登记不能安全继续 |
| 新后台登记回执兼容；否则新格式回执会被报为 unknown | 现有 `src/adapters/project-connections.ts` 硬编码三参数旧形态，即使服务端修复后也会拒绝 Node＋JS 四参数回执；已完成新后台源码修复 | Next adapter已完成精确Node+原JS回执兼容，48项相关测试、严格类型和离线构建通过；尚未部署 | 源码修复已验证，等待配套交付 |
| Codex 正式登记 | 当前 map 中 Codex 目标也仍为直接 JS；已修复 Node 形态不能被当作 changed:false | Codex精确分支与安装向导已有独立离线候选和证据；当前运行配置保持 | 可并行完成 Codex 离线候选，生产执行仍需部署条件 |
| 候选部署及当前 daemon 重载 | 普通应用服务重启已有授权；新增候选涉及旧宿主两个登记模块的实现及daemon产物，范围不同于此前三条现有配置修复。未发现新现场冲突或缺目标 | 明确旧宿主实现变更是否纳入既有交付范围；若已涵盖，沿用原重启授权和保护规程，不再申请普通重启。本次仅澄清，不部署 | 候选已审查，未部署；不是缺重启许可 |
| Trae/Kiro/VS Code 真实登记 | 本轮真实目标限现有 Codex、Cursor；VS Code 已排除，也未授权新增登记或打开其他客户端 | 若以后要纳入，先明确目标客户端、文件、工程及是否允许写入；无需为当前两种客户端验收扩范围 | 无须阻塞当前离线修复；这些目标保持未运行 |

本工作单元结束时，真实两份客户端配置哈希仍与此前已批准的三条修复结果一致，当前 daemon 及 map 字节也一致。未启动或停止 Creator、模型、P1060、其他服务；未改共享源码、旧 UI 或安全权限，未操作真实清日志或历史迁移，未提交、推送或部署。全局矩阵已统一更新，本离线候选不使 #14 自动转为通过。
