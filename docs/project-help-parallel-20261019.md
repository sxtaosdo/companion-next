# 项目概览与帮助并行核验（2026-10-19）

状态：源码定向验证完成；静态交付和真实页面验收由主会话统一执行，本文件不据此宣称已部署。

范围为 `companion-next` 的项目概览、明确工程绑定和帮助事实。起点 HEAD `47f310e / v1.3.173.128`，主会话检查点 `checkpoint/next-parallel-20261019-47f310e`。执行代理 `/root/next_project_help`。未操作 P1060、Creator、模型、浏览器、服务或旧 cocos-mcp 文件；未暂存或提交。

## 逐项结果

| 核验点 | 结论与证据 | 边界 |
| --- | --- | --- |
| 首次概览默认真实首项 | `registered-project.ts:21–35` 仅在 overview 未给 project 时等待真实登记，再选首项；两组测试通过 | 不写 URL、不启动 Creator、不读资源或生成示例 |
| 迟到、空列表、重排和移除 | 原测试覆盖迟到读取、重排保持及移除失效；本轮追加空列表后首次到达、移除后重新出现仍不复活的用例 | 移除或同 ID 路径替换后要求明确重选 |
| 明确无效参数与后续选择 | 原有空串、重复、未知参数测试保留；新增裸参数 null、超长参数，以及延迟读取遵从后来的明确 project | 无效明确参数不改选首项 |
| 资源工程上下文 | 现有测试覆盖无参数不默认、深链接恢复、步骤保持、来源/路径失效、迟到响应丢弃 | 未发资源生成、保存或导入请求 |
| 旧帮助和关于 | 只读对照 `../cocos-mcp/web/index.html:443` 帮助、页首关于入口和 `web/src/app.ts:1638` 原工程卡；现有测试核对帮助原文复制/换行、原资产、完整历史和导航 | 静态帮助不是业务链路验收，前端版本不是 daemon/Creator 实测版本 |
| 帮助事实限定 | `product-information.ts` 最新 Native 条目原称未接入或部署，已改为后续本机独立启动/HTTP 核验；明确历史 UNKNOWN 仍保留、完整恢复另验 | 不宣称旧事务恢复，不恢复用户已停止业务 |

没有发现需要重复修改 `registered-project.ts` 或 `use-registered-project-page.ts` 的明确缺陷。日志与知识内容由各自模块独立核验，未在此扩大结论。

## 实际验证

使用现有 Node 与依赖，在进程环境仅设置 `NODE_OPTIONS=--no-experimental-webstorage`（Node25 与 jsdom localStorage 兼容），运行：

```text
node node_modules/vitest/vitest.mjs run tests/registered-project-views.test.ts tests/help-about-navigation.test.ts --reporter=dot
```

- 原基线：2 文件、67/67 通过，51.08 秒。
- 最终：2 文件、71/71 通过，8.92 秒；Vitest 4.1.11，session `39432`，退出 0。
- `git diff --check` 对三项本模块改动通过。保持原 LF；最小差异 33 行新增、1 行替换。
- 全局类型、构建、静态部署、认证页面与真实旧功能验收由主会话统一协调，本代理未执行且不以离线测试代替。

修改文件：`src/domain/product-information.ts`、`tests/registered-project-views.test.ts`、`tests/help-about-navigation.test.ts`、本记录。

## 追加两处过时帮助状态修正

按主会话追加授权只改既有说明，不增加交互。实际重读 `log-tools-20261017.md`、`sse-navigation-resume-fix-20261018.md`、`reader-precision-codex-receipt-20261019.md` 与 `native-ui-receipt-20261018.md` 后：

- 日志保留项改为“日志工具条已接 · 限定专项已验”。限定真实滚动、一次真实诊断本机下载和 SSE 跨页恢复 / 主动停止专项；诊断当时 Bridge 不可达/error 如实保留，不据此证明 Creator 就绪。清空只隔离数据验证，生产 DELETE 未执行；长时断线完整性和事件回放仍未验收。
- 帮助保留项纠正“实际应用接收尚待验收”的整项过时结论：Codex 完整标记预填 / 精确清理与 Cursor 协议原生接收后取消已有专项实证。未发送任务，不保证任意客户端状态或业务执行；Cursor 专项不是完整业务材料执行链。
- 帮助测试仅调整 / 新增三条精确断言。只重跑 `tests/help-about-navigation.test.ts`：32/32 通过，9.73 秒，session `28104`，退出 0； scoped `git diff --check` 通过。前述项目71项结果不重标为本次执行。

至此本模块停止编辑，交由主会话统一类型、构建与静态 / 真实页面验收。
