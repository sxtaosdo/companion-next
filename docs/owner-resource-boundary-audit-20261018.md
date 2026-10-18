2026-10-18: Approved B+C narrow Owner host and readonly inventory are implemented and deployed (Nexte2367be/.83; host6ff44f5; daemon25288/SHA35225eb5). Actual preview/selection and native taskTemp PNG+source passed; stable native-success page receipt remains unverified after an original300s chooser timeout. Actual inventory reports503 while Creator/Bridge is unavailable; positive live summary remains unverified. Overall alignment is not complete. See [current acceptance matrix](owner-host-acceptance-20261018.md). Original22 parallel modifications, old UI and original Owner sources preserved.

# 最后两项非模型断点：只读核对与最小方案

状态：Accepted。源码基线5eb6e19/.80，线上静态5138bbf/.79。仅核对源码、既有证据和本地进程；未启动服务、读取用户图片/token/session日志、调用API、重跑Owner/96资源测试或写真实资源。产品代码不变，不构建/部署无变化的静态包。

## 结论与分类修正

| 项目 | 当前准确断点 | 仅改Next能否完成 |
| --- | --- | --- |
| 正式32180 Owner图片 | 独立Owner合同及Next页面/provider/桥接已存在，正式Node宿主没有Owner对象、bootstrap、受保护路由和进程/缓存lease装配 | 不能。盲目注册现provider只会向错误宿主请求Owner路径；需宿主接线，或另行运行独立Owner入口（后者仍不是32180整合） |
| 通用资源库存 | 旧MCP/CLI已有AssetDB汇总工具；浏览器Cookie API没有对应只读投影，汇总也不返回资产条目或Owner批准 | 不能把现有机器Bearer接口直接给网页。可以复用算法，但正式读接口/投影需Node宿主改动 |
| Codex会话原始字节 | 当前已核旧MCP/Web/Next合同里没有会话产物列举/导出/字节读取接口；旧UI本来也没有自动回收流程 | 自动回收不能实现。已有人工选PNG测量可继续使用，但不证明Codex来源，也不自动保存/导入 |

因此通用库存浏览器展示与Codex自动回收不能一概叫“旧UI漏迁按钮”。Bridge session、知识/Agent session、Studio job、Owner task均不是Codex生成会话。这里没有断言所有Codex产品都没有artifact能力；只是当前工程未接、未核实可用合同。

## 1. Owner现有接口、进程和I/O

现有源码：Next `src/main.ts`、`src/adapters/image-review.ts:25–97`、`src/adapters/image-review-state.ts`、`bridge/picker_bridge.py`、`bridge/launch_picker.py:168–210`；原Owner `../public-image-review/app.py:21–96`、`taskStore.py`。

- 正式32180是Node进程PID9764，执行文件C:/Program Files/nodejs/node.exe。只读端口核对仅127.0.0.1:32180在监听；既有Owner测试端口10719/11494没有监听。原Owner测试PID20140已按证据关闭，不是当前Node的子系统。
- Owner固定源仍为0.1.0.20，app.py/publicImages.py/taskStore.py三项SHA与Next launcher固定值全部一致。本轮仅哈希源码，没有导入执行原Python，也没有实例化TaskStore。
- `GET /`：Owner原HTML的唯一`body[data-token]`是本进程临时bootstrap。`createHostedImageReviewProvider()`仅同源、惰性读取该HTML，不执行旧脚本、不接收人工token、不持久化。
- `GET /api/state`：带`X-Review-Token`，输出原snapshot；Next投影taskId、busy、items及task/history/sources/cooldowns。任务/候选由Owner原TaskStore持有。
- `GET /image/<process-token>/<32hex-id>/thumb|full`：同源进程URL，原store核对ready/trash候选并读取真实缓存字节，最大10MiB；thumb为JPEG，full按原content_type。它不是任意文件路径接口。
- `GET /api/companion/capabilities`：原鉴权下返回schema_version=1及guarded_export、guarded_review_actions、guarded_selection。缺能力不能开保存。
- `POST /api/companion/select`：`{expected_task_id,selected_ids}`，32hex任务/候选ID，原任务/选择保护；没有降级为无任务约束的选择。
- `POST /api/companion/export`：同样严格`{expected_task_id,selected_ids}`（导出1–30个唯一候选），锁内核对busy/任务/ready选择，再原chooser及TaskStore.export；返回`{cancelled,results:[{id,ok,filename?,error?}],directory?}`。输出是原图及.source.json，不覆盖；保存到用户选择的目录，不等于Cocos导入/UUID/绑定。
- 既有`/api/companion/search|task|retry|stop|recycle|restore`沿用expected_task_id保护；原`POST /api/import`接Picker候选地址清单并可能下载，清单不是图片字节。本轮均未调用。
- 原app鉴权严格核Host=127.0.0.1:本端口、拒绝cross-site，API另核进程token及同源Origin；原CSP/no-store/nosniff/no-referrer不变。原`/api/export {}`缺期待任务/选择原子保护，不能代替桥接export。

`launch_picker.run()`已有完整装配：固定源码SHA → 原TaskStore(cache,restore=False) → CacheLease → load_last() → ImageApplication → 原make_server(loopback) → attach_bridge → serve_forever；finally关闭server及lease。故启动launcher会监听端口并恢复/接管缓存，不能算无副作用的Next构建步骤。

现缺：`main.ts`仅在独立`/companion/`分支注册图片provider；normal companion-workspace `/next`不注册。Node的`http-server.ts`处理Companion cookie页面和/api/icons等，没有Owner `/api/state`、`/api/companion/*`、`/image/*`；32180的`/`也不是Owner bootstrap。只修改注册条件不会创造这些合同。

## 2. 通用库存、现有窄资源链和Codex回收

| 现有能力 | 输入 → 输出 | 归属/不能替代的部分 |
| --- | --- | --- |
| `asset_inventory_summary` / CLI `creator-ai asset inventory` | `{root?,includeSubAssets?}`，root限定db://assets或规范子目录；tool-execution先Bridge `asset.list({})`再汇总 → `root,total,imported,unimported,unknownType,byType,byTopLevelFolder,generatedAt` | mcp/src/companion/tool-specs.ts:122、tool-execution.ts:330、asset-inventory.ts:68；不是原资源条目、PNG字节或Owner批准；依赖对应Creator/Bridge已可用 |
| `/v1/projects/:id/bridge/call` | POST `{method,params?}` → 对应Bridge结果 | http-server.ts:696的Bearer机器接口；网页Cookie `/api`没有等价库存路由，不能向Next暴露机器token或通用bridge代理 |
| `/api/icons/:project/resource-plan-preview` | POST `{config,expectedHash}`，核工程/版本/hash → 需求/页面/样本计划及问题 | 计划不是当前工程库存；源码resource-plan.ts:77。Next已有原计划/任务区，不应复制成一份伪库存 |
| `/api/icons/:project/jobs|status|candidate` | jobs GET；status POST `{jobId}`；candidate POST `{jobId,candidateId}` → 绑定job/sourceRevision的状态或PNG base64、SHA、尺寸 | Studio/原AI图标任务；不是任意Codex会话产物 |
| 原adopt / variant | adopt POST `{request,resourceBinding?,sourceId,approved:true}`，宿主必须有adoptionManifest；variant-preview需`{jobId,operationId}` | adopt缺清单即ADOPTION_DISABLED，不接受任意session/path；96变体PNG/meta/UUID/Preview/Build证据已通过，未重做 |
| 原handoff | 冻结工程/job/图片SHA/目标/证据 → export_or_copy、dispatchId=null、writeAuthorizationIncluded=false | icon-handoff.ts:23–41；是交接包，不是会话产物下载或写入授权 |
| Next人工PNG登记 | 明确选择`{name,bytes:Uint8Array}`及冻结计划上下文 → SHA/PNG结构/尺寸回执，16MiB/8192²上限 | generation-receipt.ts:203；user-declared/not-verified，needs-review；不保留原始bytes、不保存/导入/绑定；JSON导出不含原图且不能反向导入为测量证据 |
| Next Codex来源/交接 | generation-source选择元数据；handoff输出draft-not-submitted、空artifacts、awaiting-external-files | 没有会话执行器或artifact reader。旧Agent问答JSON、Bridge session、客户端MCP配置和Cursor/Codex提示词交接均不等于图像文件回收 |

`same-origin-readonly.ts`只读/api/projects和/api/status，resources保持空/未知；ResourceItem还需要用途、类别、Owner保护和验收等业务证据，不能把AssetDB汇总或缺字段推成完整库存。`RegisteredProjectResources.vue`的正式页已走原配置/计划/AI任务，而非人工示例清单。

## 3. 最小可实施方案（仅方案，本轮未执行）

| 方案 | 涉及文件/服务与流程 | 凭据/安全/授权边界 |
| --- | --- | --- |
| A：独立Owner现成入口 | 使用既有bridge/launch_picker.py和独立适配构建，Owner单独loopback `/companion/#/image-assets`，明确cache及退出归属。无旧源码/旧UI业务改动，但新增常驻进程、lease和独立入口，仍不等于32180整合 | 不需新外部凭据、不改CORS/CSP/Host；原进程token留原同源机制。启动/恢复缓存及真实chooser/export均需相应授权，本轮不启动 |
| B：正式32180整合（目标方案） | Node宿主增加固定Owner目标的窄同源命名空间、状态/图片/原guarded动作装配；明确Owner进程及cache lease启动/退出归属。随后Next main/provider接此合同。涉及旧mcp/src/companion/http-server.ts及daemon装配、Next main.ts/image-review adapter/测试；原Owner业务及旧页面可保持不变 | 必须改旧宿主，超出仅Next范围。建议Owner临时token仅宿主内存，浏览器仍用既有32180 cookie；固定目标/方法/ID/大小及原任务选择保护，图片经受控同源路由。不得开放任意URL代理、前端token框、持久token或放宽CORS/CSP/Host。新路由命名和生命周期尚未批准，未实现 |
| C：先只接库存汇总 | 在Node现有会话鉴权内增加工程绑定只读投影，复用asset.list及createAssetInventorySummary；Next显示“汇总”而不是完整库存。原AssetDB条目/分页与Owner证据另议 | 新增旧宿主接口及浏览器读权限范围，当前只报告。不能搬Bearer到网页，不能顺便暴露通用bridge/call；真实Bridge读取不可用时保留未知，不启动Creator验收 |
| D：Codex先采用已有人工文件交接 | 用户在原来源自行导出PNG，再用既有明确文件选择/本地字节测量；若要接入正式登记工程，先确认现有ResourcePlan/工程规范的冻结映射和UI入口 | 不需外传/读取会话凭据，但不是旧UI已有自动流程；新增正式页入口须先确认，不能静默把示例计划或用户声明变成来源证明。项目保存/导入仍需独立写授权 |
| E：未来自动Codex回收 | 先由Owner确认实际可用、受授权的artifact导出合同，明确来源/会话/工程/产物ID、原始bytes、SHA/类型/大小、授权和取消隔离，然后才实现读取与回执 | 当前没有已核入口。可能涉及新的会话产物读取权限/宿主服务，不能扫描用户session日志、提取token、装GitHub方案、改跨域设置或调用AI代替文件。任何外传参考图或真实写入均另有范围，当前不执行 |

本轮没有完全落在“旧UI既有合同 + 仅Next修改”的剩余实施项，故产品代码、服务及静态包均未变。Next-only可复用的计划展示/人工测量本来已存在；把它们接到新的正式工程入口或当作自动回收，属于需先确认的流程变化，不伪装为已补齐。

## 4. 复用证据与本轮保护

复用既有Temp/companion-client-owner-20261018：真实thumb/full两项字节HTTP及解码、原exporter两次生成4文件、原41缓存文件不变，chooser固定Temp（原生系统chooser未验收），owner-server-closed=true、outboundAttempts=0、downloads/modelStarts=0。没有重启Owner或重放导出。复用local-tests/creator-ai-variant-import-acceptance-20261017/RUNTIME-96-20261017.md，未重跑96资源。

只读next_parity_gap核Owner，review_log_refresh核库存/会话合同，两者均未写文件或执行业务。审计凭据与图片均未读取。最终HEAD/status/diff/脏文件SHA/daemon校验确认旧22项并行修改及运行bundle不变；本轮仅此报告、当前矩阵及必要版本记录更新。证据：C:/Users/33272/AppData/Local/Temp/companion-next-owner-resource-audit-20261018/audit-proof.json。
