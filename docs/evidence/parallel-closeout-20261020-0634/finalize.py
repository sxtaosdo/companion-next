from pathlib import Path
import json,hashlib,datetime
W=Path(__file__).parent;R=Path('D:/code/shidai3/P8000/companion-next')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def archive(name,source,files):
 e=R/'docs/evidence'/name;e.mkdir(exist_ok=False)
 for f in files:(e/f).write_bytes((source/f).read_bytes())
 (e/'sha256.json').write_text(json.dumps({p.name:sha(p) for p in e.iterdir() if p.is_file()},indent=2)+'\n',encoding='utf-8',newline='\n')
 return e
uiW=Path('C:/Users/33272/AppData/Local/Temp/companion-history-ui-20261020-0634')
ui=load(uiW/'result.json');assert len(ui['failedDetailsPassed'])==2 and ui['countsBeforeAfterEqual'] and ui['pageErrors']==[]
archive('history-ui-acceptance-20261020-0634',uiW,['accept.mjs','failure.json','result.json'])
nextW=Path('C:/Users/33272/AppData/Local/Temp/companion-registration-next-20261020-0634')
candidate=nextW/'ui-candidate'
proof={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceFiles':{n:sha(R/n) for n in ['src/adapters/project-connections.ts','tests/project-connections.test.ts']},'targetedVitest':{'command':'node node_modules/vitest/vitest.mjs run tests/project-connections.test.ts','exitCode':0,'testFilesPassed':1,'testsPassed':48,'testsFailed':0,'observedDurationSeconds':2.92},'strictTypecheck':{'command':'node node_modules/vue-tsc/bin/vue-tsc.js --noEmit','exitCode':0},'offlineBuild':{'mode':'companion-workspace','exitCode':0,'observedDurationSeconds':7.63,'files':{str(p.relative_to(candidate)).replace('\\','/'):sha(p) for p in candidate.rglob('*') if p.is_file()}},'deployed':False,'configurationWrites':0,'productionRegistrationPosts':0,'newListeners':0}
(nextW/'verification.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8',newline='\n')
archive('registration-next-20261020-0634',nextW,['edit.py','edit-result.json','verification.json'])
archive('parallel-closeout-20261020-0634',W,['protect.py','protection.json','finalize.py'])
(R/'docs/skipped-and-open-issues-20261020.md').write_bytes((W/'skipped-and-open-issues-20261020.md').read_bytes())
notice='''2026-10-20 06:34续核最新结论：两条自然失败的API及实际部署UI详情已通过，19→19、错误摘要匹配、页面错误0；正式50条第二页仍缺自然数据。Cursor本轮无现有进程/窗口，依用户一次尝试上限跳过，发送0；旧额度拦截请求1次不重放。正式登记写入器Windows回退/冲突缺陷已有离线候选，新后台回执兼容源码48项测试/类型/构建通过，但均未部署，生产登记/01仍未执行。当前仍13通过/6部分/2暂停。完整分类、建议和所需条件见[跳过项与待解决问题](skipped-and-open-issues-20261020.md)。以下较早记录按其历史时点阅读。\n\n'''
for name in ['migration-next-tasks-20261019.md','three-client-repair-20261020.md','cursor-agent-status-20261020.md','cursor-daily-acceptance-20261020.md']:
 p=R/'docs'/name;p.write_bytes(notice.encode()+p.read_bytes())
p=R/'docs/parity-matrix-20261020.md';s=p.read_text(encoding='utf-8');s=s[s.index('# 新旧 Companion'):]
rows={
5:'| 5 | 五步安装与可选动作 | 部分完成，01/11真实组合未验证 | 00/10历史真实通过；01受已部署Codex写入器缺陷阻塞，11还需专用Creator验收窗口；离线候选通过不代替向导完成 |',
11:'| 11 | 调用记录/筛选/详情/分页 | 部分完成，仅正式50条第二页缺自然数据 | 19条自然记录含2失败，失败API及当前部署UI展开/错误摘要匹配/19→19通过；真实小页游标已过，正式50条后续游标不存在 |',
13:'| 13 | CLI/IDE使用 | 部分完成，Cursor实际工具调用未验证 | 实际Codex只读调用PASSED；历史Cursor cocos/cook Connected/117。本轮无现有Cursor进程/窗口，按用户上限跳过，发送0；不是当前MCP失败 |',
14:'| 14 | 多客户端MCP登记 | 部分完成，正式写入器交付与读回未验 | 3条现有Windows配置已修且保持；当前正式writer会回退/冲突，生产POST0；Cursor/Codex离线候选、新后台回执兼容已验，均未部署；VS Code已排除 |',
}
lines=[]
for line in s.splitlines():
 for number,row in rows.items():
  if line.startswith(f'| {number} |'):line=row;break
 lines.append(line)
p.write_text(notice+'\n'.join(lines)+'\n',encoding='utf-8',newline='\n')
partial='''# 六项部分完成的准确剩余（2026-10-20 06:34续核）

当前矩阵仍为13项限定通过、6项部分完成、2项暂停。自然失败详情已补齐；正式登记发现技术缺陷，不能冒险重写正确配置来换取验收。完整用户清单见[跳过项与待解决问题](skipped-and-open-issues-20261020.md)。

| 项目 | 已通过 | 真实剩余与分类 | 下一步 |
| --- | --- | --- | --- |
| #5 安装向导 | 00/10历史真实证据；本轮配置器离线候选 | 01生产never run：现有writer冲突/旧JS，且先安装Bridge有副作用；11另受Creator限制 | 审查并交付写入器；明确01目标/备份；11另需专用Creator窗口 |
| #10 日志清空/导出/诊断 | 真实导出/诊断 | 真实清空按用户禁止，未删除日志；不是功能失败 | 保持禁止；以后真要验收需明确可删数据/备份边界 |
| #11 调用分页 | 真实小页游标、列表/筛选；本轮两条自然失败API及实际UI详情、19→19、错误摘要逐字匹配 | 正式limit50第二页never run：同会话同工程只有19自然记录，无后续游标 | 自然积累≥51条后只读验收；不刷调用、不注入、不重放失败 |
| #13 CLI/IDE | 实际Codex只读调用；历史Cursor两连接Connected/117 | Cursor实际工具调用never run；旧一次请求被额度拒绝，本轮无现有窗口、发送0、按用户上限跳过，当前额度未测试 | 用户以后打开日常窗口并允许一次目标状态查询，以真实工具回执判定；无需付费/改权限 |
| #14 正式客户端登记 | 三条批准配置保持正确；两writer最小离线候选；Next回执兼容48测试/类型/构建通过 | 生产writer仍会回退Cursor或拒绝Codex Node形态，POST0；候选未部署、正式读回未验 | 先审查/维护交付窗口，再仅现有获准目标正式登记读回；不新增服务器或改旧Mac条目 |
| #16 AI资源 | 96变体导入/PNG/meta/UUID/场景重开/Preview/Build/Smoke | 真实模型生成/编辑链仍按用户暂停 | 只核历史证据，明确恢复模型和GPU窗口前不启动 |

#20后台Agent/会话/问答/同步、#21模型启停/切换/GPU继续暂停。一次Cursor工具验收授权不解除它们的暂停。VS Code候选、旧图片数据搬迁和历史迁移不作为当前对齐缺口。

[历史与自然数据证据](history-acceptance-20261020-0634.md) · [登记候选与风险](registration-acceptance-20261020-0634.md) · [安装向导证据](wizard-acceptance-20261020-0634.md)
'''
(R/'docs/partial-six-remaining-20261020.md').write_text(partial,encoding='utf-8',newline='\n')
# Supporting notes now describe the final source state, not coordination instructions.
p=R/'docs/registration-acceptance-20261020-0634.md';s=p.read_text(encoding='utf-8')
s=s.replace('由主代理独占验收 | 本工作单元未操作 Cursor 桌面，未追加 Agent 请求','本轮按用户上限跳过 | 未发现现有日常Cursor窗口，本轮请求0；历史连接通过不代替实际调用')
s=s.replace('已通知主代理','已完成新后台源码修复')
s=s.replace('主代理在自有 Next adapter 做精确合同修复和必要定向测试，禁止放宽成任意 args 或任意工程','Next adapter已完成精确Node+原JS回执兼容，48项相关测试、严格类型和离线构建通过；尚未部署')
s=s.replace('可以独立修复自有 Next 代码，主代理负责共同文件','源码修复已验证，等待配套交付')
s=s.replace('Codex 精确分支与安装向导由另一个工作单元负责；本候选不触 Codex 行为或真实配置','Codex精确分支与安装向导已有独立离线候选和证据；当前运行配置保持')
s=s.replace('再由主代理按授权推进','再按明确维护窗口推进').replace('全局矩阵由主代理统一更新','全局矩阵已统一更新')
p.write_text(s,encoding='utf-8',newline='\n')
p=R/'docs/wizard-acceptance-20261020-0634.md';s=p.read_text(encoding='utf-8')
s=s.replace('本工作单元不改该共享文件，已交给主任务协调','该Next源码已完成兼容修复，48项相关测试、严格类型和离线构建通过，尚未部署')
s=s.replace('整体312文件/9表保护由主任务统一复核','本轮另有312文件/9表统一保护核对证据')
p.write_text(s,encoding='utf-8',newline='\n')
names=['history-acceptance-20261020-0634','history-ui-acceptance-20261020-0634','registration-acceptance-20261020-0634','wizard-acceptance-20261020-0634','registration-next-20261020-0634','parallel-closeout-20261020-0634']
p=R/'.gitattributes';raw=p.read_bytes()
for name in names:
 rule=f'docs/evidence/{name}/** -text -whitespace\n'.encode()
 if rule not in raw:raw+=b'\n'+rule
p.write_bytes(raw)
print(json.dumps({'newUiFailureDetailsPassed':2,'nextAdapterTestsPassed':48,'nextTypecheckBuildPassed':True,'cursorResumeRequests':0,'matrix':'13/6/2','documentsReady':True}))
