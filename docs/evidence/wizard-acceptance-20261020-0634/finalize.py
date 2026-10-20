from pathlib import Path
import json, hashlib, datetime
W=Path(__file__).parent; R=Path('D:/code/shidai3/P8000/companion-next'); E=R/'docs/evidence/wizard-acceptance-20261020-0634'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert load(W/'typecheck.json')['passed']
verified=load(W/'verification.json');assert verified['passed']==8 and verified['realGlobalConfigAndInstalledRuntimeHashesUnchanged']
matrix=(R/'docs/parity-matrix-20261020.md').read_bytes(); text=matrix.decode('utf-8')
encoding={'file':'docs/parity-matrix-20261020.md','strictUtf8Decode':True,'replacementCharacterCount':text.count('\ufffd'),'containsExpectedChineseTitle':'新旧 Companion 功能对齐矩阵' in text,'sourceBytesChangedByThisLane':False,'interpretation':'PowerShell/tool display encoding mismatch, not damaged source bytes'}
assert encoding['replacementCharacterCount']==0 and encoding['containsExpectedChineseTitle']
(W/'encoding-check.json').write_text(json.dumps(encoding,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
E.mkdir(exist_ok=True)
attempts=load(W/'attempts.json')
if not any(x['stage']=='independent review P2: non-JS override compatibility' for x in attempts['attempts']):
 attempts['attempts'].append({'stage':'independent review P2: non-JS override compatibility','outcome':'fixed and verified in offline candidate only','observation':'Previous 7-scenario candidate wrapped every Windows creatorAiPath. Final candidate wraps only js/cjs/mjs and gates legacy managed upgrade on useNode; native exe actual isolated CLI create/get/no-op and cmd controlled read remain original command plus three args. Four affected/new scenarios rerun; four unchanged scenarios carried from preserved prior receipt. Strict semantic types passed.'})
(W/'attempts.json').write_text(json.dumps(attempts,indent=2)+'\n',encoding='utf-8',newline='\n')
for name in ['prepare.py','verify.mjs','verify-followup.mjs','typecheck.mjs','finalize.py','baseline.json','verification.json','verification-before-review-p2.json','candidate-before-review-p2.ts','typecheck.json','attempts.json','encoding-check.json','codex-configurator.patch','baseline/codex-configurator.ts','candidate/codex-configurator.ts']:
 p=E/name;p.parent.mkdir(exist_ok=True,parents=True);p.write_bytes((W/name).read_bytes())
(E/'sha256.json').write_text(json.dumps({str(p.relative_to(E)).replace('\\','/'):sha(p) for p in E.rglob('*') if p.is_file() and p.name!='sha256.json'},indent=2)+'\n',encoding='utf-8',newline='\n')
doc='''# 安装向导01/11：本轮结果与跳过项（2026-10-20 06:34续核）

**生产01仍未执行，11继续暂停。已找出两个具体技术问题并完成离线Codex修复候选；没有把隔离测试算作真实安装完成。** 本轮不重复已经通过的00/10，不操作用户Cursor桌面、不启动或控制Creator/模型，不改真实配置、旧后台、共享源码或已安装文件，不部署或重启服务。

| 项目 | 本轮状态 | 用户影响、原因与准确剩余 |
| --- | --- | --- |
| 01：Bridge必选、Creator不启动、配置Codex | **never run（生产）** | 安装服务先登记工程和安装Bridge，再调用Codex配置器。现有已修复的Node+JS登记会被部署配置器误认同名冲突；新登记则仍生成Windows无法直接执行的JS入口。不能为探测此问题执行生产01，因为前面的Bridge步骤已有副作用。还缺已修复写入器的正式交付、对应Next回执合同兼容及真实向导完成回读。 |
| 11：Bridge、Creator启动与Codex配置 | **never run（生产），按用户限制暂停** | 包含Creator启动/复用/验证。当前不能操作外部Creator，也没有新的专用Creator验收窗口。不能把允许修复现有配置当作允许运行11。还缺01同样的配置器交付，以及明确Creator验收窗口中的真实步骤。 |
| 部署配置器匹配当前Node登记 | **failed（部署源码精确复现）** | 已部署Codex模块只把command=creator-ai.js、args=[mcp,--project,id]识别为managed；当前合法Node包装形态会在read/conflict终止，未发任何配置写命令。此为写入器未同步已批准Windows启动修复，不是现有已修复连接失效。 |
| 缺项错误识别 | **failed（首次实际隔离CLI候选），候选已修复** | 实际已装Codex CLI输出已知PATH警告加大写Error缺项句。部署模块仅识别整串裸句/小写error，移除旧项后会误报unknown。首次隔离失败保留在attempts.json，未涉及全局配置。候选只接受目标名称完全匹配的已知缺项句及已观察PATH警告，权限、登录、未知或其他名称错误仍拒绝。 |
| Windows写入器最小候选 | **passed（离线/专属Temp）** | 实际Codex CLI只在任务专属CODEX_HOME做mcp get/add/remove，未启动服务器、AppServer或推理。旧JS同工程升级、新Node幂等、Windows路径大小写/分隔符兼容、其他工程/权限限制/无关命令冲突、混合未知错误拒绝、非JS原命令兼容等8个场景有通过证据；审查修正后仅重验4个受影响/新增场景，其余4项沿用未变逻辑的原证据，明确标记在回执中。生产源未替换，生产安装未执行。 |
| 文档乱码核查 | **passed（只读）** | 矩阵严格UTF-8解码成功，U+FFFD=0，中文标题真实存在；是PowerShell到工具输出的显示编码问题，未批量改文档。 |

## 已准备的具体候选

候选仅修改从实际daemon.map提取的`codex-configurator.ts`。只有Windows的js/cjs/mjs入口目标为当前Node可执行文件`process.execPath`，首参仍是原`creator-ai.js`，其后保持`mcp --project 原ID`。已修好的同工程Node登记直接no-op；旧直接JS同工程登记通过既有remove/add/verify与恢复保护升级；不认可无关Node路径、其他项目ID、增权或自定义限制配置。Windows非JS的exe/cmd覆盖入口及非Windows入口均维持原command和三个args。独立审查发现前版无条件包装会破坏非JS覆盖能力，此P2已收窄useNode并补定向证据；旧候选与7场景回执仍保留，不能冒充最终版本。

CLI隔离验收使用已安装`896a0166b774037a/codex.exe`，原7场景回合9条、P2后定向回合15条MCP配置管理命令，实际退出及get回读通过；命令数量只说明证据来源，不代表功能完成数量。新增exe入口只由mcp管理命令存储/读取，绝未执行该exe；cmd形态使用显式受控CLI读取桩。没有模型/Agent回合，也没有MCP服务器启动。迁移后的无关配置条目块字节不变，Node和exe幂等时整个config.toml字节不变；**不承诺任意注释逐字保留**：首次CLI种子写入观察到CLI自身会删除文件首注释，已原样记录。候选没有为绕过CLI而读写私有存储。

严格TypeScript语义检查（strict、noUncheckedIndexedAccess）无诊断。候选生成前后，真实Codex/Cursor配置以及已安装daemon/map/CLI SHA一致。源基线SHA为`962dc7cc307ed0f32ee3049cf5772a3b2750dfe0478aa3329d85be5237bec498`，对应daemon SHA为`70df42a8f84e6bf9d32c050919fcb91565ff4b53ff9f85a3b1e50664d267ca65`。这不是历史21文件完整保护基线，整体312文件/9表保护由主任务统一复核。

## 建议下一步与能否独立继续

1. **可独立继续**：审查离线补丁，与Cursor同类候选一起完成交付前核对。中央任务已修复Next源码中Node包装4个args回执兼容，48项定向测试、类型与离线构建通过；本工作单元不重复改该共享文件。该源码/候选均尚未部署，不能据此关闭真实向导验收。
2. **技术交付窗口后才能继续**：候选经审查后，按现有宿主保护/生命周期规程交付配置器。当前不擅自替换运行包或重启，不需要用户新提供账号、Token或购买额度来解决此配置器问题。
3. **01真实验收**：交付后明确目标工程，确认Bridge目录保护、已有注册/预设和备份边界；通过正式Next向导仅勾Bridge+Codex，核对202选项回显、同一operation终态、Codex真实持久配置与客户端工具回执。此时也不能把一条配置修复等同向导通过。
4. **11真实验收**：除上述条件外，需要用户允许的专用Creator运行窗口；目前继续暂停。不要使用外部正在工作的Creator完成验收。

全部相关记录见[证据目录](evidence/wizard-acceptance-20261020-0634/verification.json)、[候选补丁](evidence/wizard-acceptance-20261020-0634/codex-configurator.patch)、[首次失败与限制](evidence/wizard-acceptance-20261020-0634/attempts.json)。本轮仅形成可审查离线候选，矩阵#5仍为部分完成，不能提高整体通过数。

隔离依据：OpenAI Docs技能核对了[官方CODEX_HOME配置位置](https://developers.openai.com/codex/config-file/config-advanced)，隔离环境仅作用于本次子进程；未改全局环境或用户真实配置。
'''
(R/'docs/wizard-acceptance-20261020-0634.md').write_text(doc,encoding='utf-8',newline='\n')
print(json.dumps({'document':str(R/'docs/wizard-acceptance-20261020-0634.md'),'evidenceFiles':len(list(E.rglob('*'))),'production01':'never run','production11':'paused/never run','candidatePassed':verified['passed'],'strictTypesPassed':True}))
