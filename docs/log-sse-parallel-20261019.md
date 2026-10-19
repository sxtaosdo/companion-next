# 日志与 SSE 并行定向核验（2026-10-19）

状态：离线定向验证通过；没有发现需要修改产品源码的具体缺陷。本片不能将迁移矩阵中的“长时间多源/跨重连完整性未全验”改为真实验收通过。协议仍无事件回放保证。

## 范围与旧行为

基线为 Companion Next 47f310ef7f84c47f3a309df93695a3b078cf72c1，主会话检查点 checkpoint/next-parallel-20261019-47f310e。仅读旧 cocos-mcp/web/src/app.ts：548–550 行按 projectId/source/level 分别追加多选查询；3489 行手动刷新直接 loadLogs；3491–3497 行暂停切换独立变量；3557–3559 行仅暂停 SSE 日志刷新。旧调用事件仍独立更新，不因日志暂停停止。

现有 81ea56c 跨页 SSE 真实恢复验收保持，不重复执行。本模块只新增 tests/companion-log-reconnect.test.ts，组合正式 HTTP 读取 adapter、Pinia store 和可控离线事件源，所有 fetch 均为内存模拟，没有连接当前 32180。

## 本次新增组合覆盖

- 日志快照读取尚未完成时暂停并同时选择两工程、两来源、两级别及包含 &/? 的字面关键字；原请求 AbortSignal 必须中止。
- 模拟连接错误并等待既有 1 秒重连，旧事件源失效；新流打开仍保持日志暂停。
- 旧流 onOpen/onLog 与新流日志提示各重复 100 次，迟到 HTTP 旧快照不能恢复已失效数据，也不能触发暂停中的读取。
- 暂停时显式手动刷新仍可读。通过正式 adapter 实际生成的 URLSearchParams 核对多值与关键字，没有自行编码简化版接口。
- 恢复自动日志刷新后 100 次提示合并成一次读取，并保持完全相同筛选；旧流后续提示不能再触发读取或覆盖当前结果。主动停止后计时器为零，所有请求均为 GET。

## 验证结果与边界

定向命令：node node_modules/vitest/vitest.mjs run tests/companion-events.test.ts tests/companion-live-store.test.ts tests/companion-browser-adapter.test.ts tests/companion-log-reconnect.test.ts。

4 文件共 224 项通过（包含新增 1 项组合回归）。node node_modules/vue-tsc/bin/vue-tsc.js --noEmit 退出 0。

没有修改 adapter/store/组件、版本/README/CHANGELOG 或 Git 索引；没有控制真实浏览器、daemon、Creator、模型，没有生产清除/诊断/新监听或业务请求，没有部署。共享恢复版 ccc1341 保持在模块边界外。真实长时多源事件完整性、断网期间事件无遗漏仍未验证，不从本次模拟结论外推。
