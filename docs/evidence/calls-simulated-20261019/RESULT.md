# 调用记录非空模拟 UI 验收（2026-10-19）

结论：限定模拟UI验收通过，没有发现此场景的产品缺陷。不代表真实历史或真实服务分页已经验收。Next源码和仓库docs未改；没有Git操作。

## 正式合同依据

仅读 src/adapters/companion-browser.ts 的 decodeCalls/loadCalls、src/stores/companion-browser.ts 的 loadCalls/merge，以及原 cocos-mcp/mcp/src/companion/call-history.ts query 与 http-server.ts 的 calls GET参数投影。

query先按sequence<before（严格小于）和status=failed过滤，再倒序取最多50；nextBefore仅在还有更多匹配项时返回本页末sequence。total为整个工程累计，retained为全部保留记录数，失败过滤不改变两者。adapter验证ID唯一、序号递减、工程一致、before排他及nextBefore等于末条。store追加使用同一服务器游标、合并详情，刷新或筛选变化重置首批；追加请求失败保留已有数据及原cursor。

## 隔离方式

自有Playwright msedge headless --disable-gpu/--disable-gpu-compositing，pipe通信，没有自建服务或监听。所有请求均由context.route接管；API完整合成，原部署静态也从安装目录读取字节并fulfill，既没有登录也没有HTTP透传。实际网络请求0，sessionPOST0，业务请求0，数据库写0，Creator/模型动作0；用户浏览器未触碰，自建browser正常关闭。

使用的部署静态字节（非本次构建）：
- index.html SHA256 1bb7f3edb912cc64010ed37d152921a78b717a160f0bf8dd8960f8010f37d6d1。
- assets/index-CRVreJhY.js SHA256 0c53dfe075f66f5aa4faa6a2657c2136c4f6f7ddb7b04f3aab9015310875a010。
- assets/index-gwbq_QMl.css SHA256 0731082f61d115956d105d687cd742bdab49124a49112f773fefaa57877467db。

## 实际模拟结果

固定132条合法投影记录，66成功/66失败，三个原来源web/cli/mcp轮换；纯fixture工程和session，无真实工程映射。17次被拦截的静态/API读取，blocked=[]、pageErrors=[]。

- 全部调用：50+50+32，exclusive游标83→33→无；每个UI序号与fixture完整132→1逐项一致，无重复/遗漏。
- 第二页第一次合成HTTP503：首50条与原cursor保留，UI错误提示，重试同before83成功；第三页后不再显示“加载更多”。
- 仅失败：50+16，exclusive游标34→无；每行均失败、完整匹配偶数132→2，无重复/遗漏。累计132/保留132不错误显示为66。
- 手动刷新仅失败回到第一批50；切回全部也清旧筛选数据并回首50。
- 展开132失败记录：参数、结果、错误摘要与fixture对应；模拟token值在adapter中遮盖，HTML作为文本展示，没有img元素。展开131成功记录只有参数/结果，没有错误摘要。截图simulated-failed-detail.png已实际查看。

证据simulated-calls-proof.json保存每次请求query、每页实际序号、静态SHA及各项断言结果；simulated-calls.mjs为可重现专有脚本。首次执行即通过，没有为了通过修改产品或降低断言。

## 保留边界

本片不证明真实后台有132记录，不写真实调用history，不补造真实业务，不重新登记工程，也不证明真实服务的数据库/内存保留、长时并发及SSE投递。真实当前会话空态、筛选、刷新和本地读取中止恢复是上一份独立真实回执；本次合成证据须与它分开标注。
