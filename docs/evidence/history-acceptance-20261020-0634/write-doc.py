from pathlib import Path
import json,hashlib
W=Path(__file__).parent
R=Path('D:/code/shidai3/P8000/companion-next')
E=R/'docs/evidence/history-acceptance-20261020-0634'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
proof=load(W/'natural-history-result.json');post=load(W/'classification-postcheck.json')
assert post['antCookInitialCount']==post['antCookAfterCount']==19 and post['naturalFailureCount']==2
assert post['countsMatchInitialHistoryRead'] and post['countsUnchangedWithinClassificationReads']
E.mkdir(exist_ok=True)
for name in ['read-natural-history.py','classify-and-postcheck.py','natural-history-result.json','classification-postcheck.json','write-doc.py']:
    (E/name).write_bytes((W/name).read_bytes())
(E/'sha256.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in E.iterdir() if p.is_file() and p.name!='sha256.json'},indent=2)+'\n',encoding='utf-8',newline='\n')
doc='''# 日志与调用记录验收、剩余问题（2026-10-20 06:34轮）

本轮真实只读查询发现 **ant-cook 有19条自然调用记录，其中2条失败**。正式接口读取、失败筛选和两条错误摘要返回通过；正式50条分页第二页仍未执行。没有发起新MCP调用、补造记录、重放失败或清理日志。只读查询过程中 ant-cook 计数始终19，其他5个非P1060工程均0；P1060已排除，未查询其历史。

| 验收内容 | 本轮结果 | 证据与限制 |
| --- | --- | --- |
| 自然调用列表、累计/保留数量 | passed | 6个非P1060工程的正式`GET /api/projects/:id/calls?limit=50`均HTTP200；ant-cook total=retained=19，其余0 |
| 自然失败筛选及错误摘要接口 | passed | ant-cook `status=failed`返回2条，状态均failed，input/error摘要存在；不在证据中保存业务摘要正文 |
| 正式每页50条的第二页接口/UI | never run | 所有工程的`nextBefore`均为空；最多19条，不足51条，未用小页结果冒充正式第二页 |
| 自然失败详情正式浏览器UI | 本单元never run，已交主代理 | 本单元仅操作API和离线文件，桌面由主代理独占；主代理可读现有两条记录补验，不需要新增失败 |
| 生产日志真实清空 | 禁止执行 | 用户仍明确排除真实清日志；本轮未触发。既有导出、诊断证据继续有效，不以这些替代清空验收 |
| 已通过的limit1真实游标分页 | 保留既有passed | 本轮不重复原2条小页测试，不用重复次数抬高完成度 |

## 可立即定位的自然失败详情

在已认证的新后台打开`/next/index.html#/projects?tab=calls`，选工程 **ant-cook**（`04c4cde24ee76d83`），将调用记录筛选设为“仅失败”。正式UI详情元素为`details.companion-call-record`；展开相应`summary`后可查看已有输入/结果/错误摘要。这里只是读取记录，禁止重试/重放对应业务工具。

| 记录ID | 序号 / 来源 / 操作 | 已有错误摘要SHA-256 |
| --- | --- | --- |
| `493d905e-7953-49c0-9769-d2b9c5476d1c` | 15 / cli / `playtest_run` | `0530776c35d5cbb7d4bcb2bdf0e228205569fbad9c7d2c4c2393dd15f8f6add6`（2090字节） |
| `66d250e0-0b03-4744-bda4-483ce6fbd7da` | 10 / cli / `script_wait_compile` | `d1c8e03a51c4bd39630316de749db45963f1b587721b743af987aa4fa7970a6b`（213字节） |

两条业务调用均在本轮前发生：分别04:03:48、03:57:36 UTC，来源为CLI。`script_wait_compile`已有摘要代码为`INVALID_REQUEST`及`invalid_type`，指向该次请求的参数类型校验；`playtest_run`摘要为文本或截断格式，包含Bridge及失败描述，没有提取出可靠机器错误码。本轮没有重现它们，也没有足够证据把它们归因为新后台迁移缺陷。**业务调用failed与本轮历史读取passed分开记录**：它们提供真实失败详情样本，不自动加入迁移待修缺陷清单。

前端定位：`src/views/CompanionBrowserView.vue:157`为调用筛选区，159为`details`及错误摘要；`src/adapters/companion-browser.ts:315`起固定`limit=50`并在失败模式加`status=failed`；`src/stores/companion-browser.ts:121`起处理追加游标。源码检查只用于定位，不作为浏览器实际通过证据。

## 仍待解决问题与建议操作

| 问题 | 功能影响与原因 | 已尝试及实际结果 | 准确剩余 / 下一步 | 需要的批准或数据 | 能否独立继续 |
| --- | --- | --- | --- | --- | --- |
| 正式50条第二页缺自然数据 | 不能证明正式UI的“加载更多（50条）”在真实数据下可用；最多只有19条 | 已读6个非P1060工程的正式50条页，全部无后续游标；原limit1实际分页已通过，不重复 | 等任一允许工程在正常使用中自然积累≥51条，再读第一页及游标页，核对不重不漏，随后验正式UI追加 | 需要≥51条自然记录；不要求恢复模型/Creator/P1060，也不应为验收批量刷调用 | 当前无数据可继续；可独立读已有列表，不能关闭第二页验收 |
| 自然失败详情UI尚待主代理回执 | API已有样本，尚不能仅凭源码/JSON宣称正式页面可展开正确内容 | 两条失败接口已返回非空摘要并留SHA；已将ID、路径、selector交主代理 | 主代理在现有认证浏览器只读选择ant-cook、仅失败，展开2条；比对输入/错误块和状态，不重放 | 无需新增失败或新业务权限；若浏览器不可用则保留never run并给用户同样手动步骤 | 可由唯一桌面操作者独立继续，本单元不抢桌面 |
| 真实清日志被排除 | #10清空的生产效果未验收；真实操作会删除用户现有日志 | 本轮未触发，既有导出/诊断仍通过；不能用离线清空或导出替代 | 保持禁止。若用户未来明确改授权，应先选可丢弃的独立日志目标，明确删除范围再验收 | 需要用户明确改变“真实清日志禁止”边界及指定可丢弃目标；当前不请求、不实施 | 当前不能独立执行；其他日志只读/导出不受此项阻塞 |
| 旧CLI自然业务失败的具体根因 | 可能影响该两次业务操作；不影响已经HTTP200的历史筛选读取 | 仅查已有摘要类型、代码与哈希；未重放、未启动Creator或模型 | 如业务所有者需修复，应另立明确复现范围，核对原请求参数/Bridge结果；本轮不把它们自动归为迁移软件缺陷 | 需要业务所有者决定是否调查并给可允许的复现环境；无需为历史UI验收复现失败 | 历史展示可继续；业务复现当前不在本单元范围 |

本单元没有修改旧后台UI、共享源码、数据库或客户端配置，没有启动监听、Creator或模型。两次正常UI认证票据仅用于本地只读HTTP会话；未输出、归档或改写token/cookie。API证据只保存元数据、摘要存在性、长度和SHA，不保存错误或日志正文。全局运行文件、9张业务表和配置保护由主代理统一核对，本单元不冒称执行了该全量复核。

[自然数据与请求清单](evidence/history-acceptance-20261020-0634/natural-history-result.json) · [错误归类与19→19计数核对](evidence/history-acceptance-20261020-0634/classification-postcheck.json) · [证据SHA清单](evidence/history-acceptance-20261020-0634/sha256.json)
'''
(R/'docs/history-acceptance-20261020-0634.md').write_text(doc,encoding='utf-8',newline='\n')
print(json.dumps({'newDoc':'docs/history-acceptance-20261020-0634.md','evidenceFiles':len(list(E.iterdir())),'apiNaturalFailureDetail':'passed','uiNaturalFailureDetail':'delegated_to_primary','formal50SecondPage':'never_run_insufficient_natural_data','sourceChanges':0,'commits':0}))
