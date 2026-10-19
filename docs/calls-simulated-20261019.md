# 调用记录非空、筛选与分页：隔离模拟验收（2026-10-19）

限定模拟验收通过，未发现需要修复的前端缺陷。本轮没有生产业务请求、数据库写入或新监听，没有登录、Creator/模型动作、真实客户端配置修改、部署或共享服务重启。VS Code修复由另一路独立隔离目录执行，尚不能据此视为运行包已修复。

## 已执行与结果

- **已部署静态的浏览器验收**：自建Edge headless，通过pipe控制；HTML/JS/CSS读取现有部署目录原字节，记录SHA，所有静态和API请求均context.route本地响应，零真实网络。页面仍使用真实发布UI代码，API与数据完全合成，不是真实历史。17次本地拦截请求，blocked/pageErrors均空，自有浏览器已关闭，用户窗口未触碰。
- **132条全部记录**按50/50/32加载，游标83→33→无；**66条失败记录**按50/16加载，游标34→无。逐行sequence与预期完整序列比较，无重复/漏项；累计/保留始终132，不因失败筛选误写为66。
- 模拟第二页HTTP503后，首批50条和before83保留，错误可见；同游标重试成功。刷新/筛选切换回首批，终页不再显示加载更多。
- 详情核验仅覆盖所选成功/失败样本：输入/结果/错误摘要对应，成功记录无错误区，模拟敏感值遮盖，HTML作为文字且不执行。不是逐条详情内容全验。
- **真实adapter→store的合成HTTP集成**：新增4项覆盖132/66全序列、append503同游标重试、外工程坏页拒绝且无部分合并、非空刷新失败清除旧数据/未知统计再恢复。与既有adapter/store回归合计**129/129通过，0skip/xfail**。所有fetch均注入，不访问真实网络、客户端或数据库。
- `vue-tsc --noEmit`退出0。独立只读复审未发现新增P1/P2；查询合同对照实际宿主CallHistoryStore.query、HTTP投影与Next decodeCalls/loadCalls。

首次Vitest启动复用了上一批仅含三份旧测试的include配置，报告0测试并退出1；随即改用本轮专属配置，129项实际执行通过。没有将0测试启动计入通过数。

## 交付与边界

[合成UI证据](evidence/calls-simulated-20261019/simulated-calls-proof.json)、[专用浏览器脚本](evidence/calls-simulated-20261019/simulated-calls.mjs)、[样本详情截图](evidence/calls-simulated-20261019/simulated-failed-detail.png)、[129项报告](evidence/calls-simulated-20261019/adapter-store-vitest.json)、[SHA清单](evidence/calls-simulated-20261019/manifest.json)。新可重复测试位于`tests/call-history-pagination-integration.test.ts`。

真实历史读取82项与上一批真实当前会话空态验收仍单列在[最新21项矩阵](post-host-closeout-20261019.md)。本轮补齐的是非空UI/适配器的合成合同证据；**非空生产历史分页、真实失败记录、数据库保留/截断、长时并发及实时SSE投递仍未验**。未运行真实失败业务来凑记录，也未写入真实history。
