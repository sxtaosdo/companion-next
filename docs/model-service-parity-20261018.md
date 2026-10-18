# 原模型服务 / AI一致性相关入口迁移（2026-10-18）

状态：Accepted。用户最新明确将旧后台已有模型服务及AI一致性相关操作纳入迁移；此前一概“模型暂停、排除迁移”的分类已撤销。检查点91f8ab3/.93。实现只改Next，原cocos-mcp宿主/旧UI/启动器源码不变；不自动恢复旧批量生成，不下载模型、装软件、改凭据/安全权限，不切换未知GPU任务。

## 旧真实操作与准确范围

| 旧操作 / 归属证据 | Next修复前 | 当前实现与验收层级 |
| --- | --- | --- |
| 模型页导航、进入读取状态：web/index.html:25,191–205；app.ts:2854–2873,2964–2974 | 路由有，但混入知识CLI连接区，模型页不按原行为读取 | 继续原/knowledge?tab=models入口，模型页隐藏知识连接/查询状态块，进入只读原服务状态；不调用知识CLI/同步/模型。 |
| GET /api/model-service/status：http-server.ts:315–316 | 已接 | 保留；running仅为启动器HTTP探针，不承诺GPU健康或模型已加载。 |
| POST /api/model-service/start {}：旧app.ts:3019–3031，ai-launcher-client.ts:65–77 | 缺失，domain/adapter/store显式拒绝 | 已恢复严格service/action、固定同源cookie路由、原200 running=true与503 failure回执；一用确认、来源/快照冻结、互斥、取消UNKNOWN保持。仅隔离测试，未真实启停。 |
| POST /api/model-service/stop {}：app.ts:3033–3051；client.ts:123–134 | 已接 | 保留并与start共用原操作通道。只针对8090、命令行匹配launcher.py进程；不等于终止模型。真实现有实例未关闭。 |
| 固定8090原iframe：app.ts:2938–2961 | 缺失 | 已恢复title“本地 AI 服务启动器”，src=http://127.0.0.1:8090/，仅模型页、本次有效running状态且无读取/确认/UNKNOWN时加载；失效/离页移除。成功启停后模型页核读状态，不虚造就绪。未新增模型外链或重建子应用。 |
| 原启动器各模型/ComfyUI操作：C:/ai/launcher/panel.html:94–131、launcher.py:22–48,465–482 | 因iframe缺失不可达 | 通过原iframe原样保留：服务卡启动/停止、全部停止、原409冲突确认/force重发、日志链接和运行服务的本机/局域网打开。Next不新增绕过GPU互斥、force或任意地址接口。仅入口迁移，不冒称各按钮已真实执行。 |
| AI一致性相关原有工作流入口 | 旧Companion没有另一个名为一致性的专用按钮/API；模型页嵌入启动器，ComfyUI卡指向8188，工作流属于ComfyUI | 纳入迁移，恢复原入口与操作承载；不另造“一致性实验”按钮。现有GPU服务有占用，本轮不启动ComfyUI或提交工作流。具体旧工作流逐项运行仍待明确目标，不能凭管理页可达声称一致性效果通过。 |
| 原AI图标规范/参考/任务链：web/src/ai-icons-page.ts:4–37,518–535 | 已迁入既有资源流程 | 继续保留，不与启动器混为同一会话。旧参考图modelConditioning:false / referencesAsModelInput:false；上传/裁剪不证明模型参考条件或一致性生成。原generation/offline_import_only、adopt/enqueue边界不变，不自动恢复旧任务。 |

### 当前已实现、待验及最小决策

- 已实现：原模型状态、启动/关闭、原内嵌页和页内原操作入口；不会再把这些旧能力记为“本次范围外”。
- 当前没有另外确认的旧Companion模型页缺失按钮；专用一致性业务合同未出现在旧Companion，不能擅自设计。原启动器子应用功能通过原页面复用，不复制为Next新接口。
- 可安全实测：现有正式会话状态GET、原8090管理页和只读状态渲染、Next内嵌入口与离页清理；现有实例保持。启停与冲突/UNKNOWN分支用定向隔离验证。
- 未做的真实验收：启动器真实启动/关闭、各GPU服务切换/全部停止、ComfyUI工作流/一致性效果及原批量生成。它们属于旧功能验收边界或另开实验，不能仅以“暂停模型”排除实现。
- 若需要真实一致性验收，具体最小需求是：确认现有Heretic PID3260可中断/释放的GPU窗口，指定要复验的既有ComfyUI工作流及输入/输出目标和次数；当前8188无监听。没有这些信息不停止或替换现有模型。不需要凭空购买/安装；若指定原工作流缺依赖，再列精确文件，不自动下载。

## 实际运行归属（只读）

`listeners-before.json`确认：Companion32180/PID20116；启动器0.0.0.0:8090/PID7292/pythonw.exe，命令行匹配原C:/ai/launcher/launcher.py；llama-server0.0.0.0:8080/PID3260。8092/8188无监听。没有为本轮新扩监听。

原GET8090/api/status200的安全投影确认gpuRunning=[heretic]、heretic running/PID3260、comfyui stopped、busy=false。busy=false只代表启动器没有正在执行启停，不证明模型无人使用。未读取/保存提示词或模型日志。初次普通沙箱GET被本地EACCES阻止，改用获准只读执行环境成功；不是服务离线，没有改网络权限。

启动副作用按原源码：已有8090探针成功则复用；否则原固定pythonw/launcher.py启动并监听0.0.0.0:8090、启动状态/显存/LLM监控，写原日志；creative_apps监测到已运行Denova时可能补启原8092代理。本轮仅接按钮，不执行该启动。没有改变原监听/ACL/凭据。关闭只结束匹配的启动器，不能承诺模型退出。

## 实现、隔离验证与复审

domain/adapter/store扩展原model start；不改变字段/体积/来源和lease保护。模型页进入探测为单次，旧读取未结束时只为最新有效上下文排队一次；换源/换页/卸载取消旧队列，普通读取失败不自动重试。原知识页手动读取行为保留，模型页不走知识status/CLI。iframe在读取、失败、服务UNKNOWN、确认和来源变化时撤下，固定地址不接受用户输入。

3份核心服务测试初批139通过；复审补3项延迟换源/页签/卸载后，变更UI44通过，核心不同用例共142通过。另帮助/知识被动页/服务状态3份64通过；合计206个不同用例。最终类型/构建和实机只读结果另记，不重跑已覆盖的保存/库存/96资源。

按根AGENTS调用真实code-mapper `/root/code_mapper_model` 只读核对旧路径、Owner、接口和Next缺口，未操作网络/进程或修改文件。真实reviewer `/root/reviewer` 首审发现P2自动探测换源时被旧reading lane吞掉，已修成最新上下文串行补读；复审确认P2关闭、无新P1/P2。二者有效只读隔离未证实，自行遵守只读边界；没有冒称外部OCR通过。

证据目录：`C:/Users/33272/AppData/Local/Temp/companion-model-parity-20261018/`。后续静态与只读页面交付基于已运行的原服务，不做真实启停或GPU实验。以上运行PID只代表这次观察，不作永久默认。

## 最终交付与只读实机（通过）

实现源9af58137f761ac330320e55476d23464b7a35685 / 内部.94，产品1.3.173。最终类型与正式workspace构建通过，206个不同定向隔离用例通过；静态六文件已备份/追加哈希资产/原子index切换，认证HTTP六SHA一致，旧资产保留。后续文档提交不重标静态源。

正式/knowledge?tab=models已真实读取原状态并加载原8090页面，9张原服务卡可见；ComfyUI启动/停止/日志入口与Heretic运行/PID3260匹配原服务；没有知识CLI连接入口。离页iframe移除。整个脚本仅GET，实际启停/生成/同步POST为0，blocked=0，pageErrors=[]。这证明原入口/管理页可用，不将其写成真实模型切换或一致性效果通过。

原daemon20116的PID/epoch/入口SHA不变，原launcher7292和Heretic3260保持；没有启动ComfyUI或8092代理，没有新监听、模型下载、软件安装、凭据或权限变化。用户窗口未触碰，自建无GPU浏览器已关闭，旧cocos-mcp并行修改与runtime/CLI受静态交付保护；原图片缓存决定不变，不重复其它已完成验收。

证据：deployment-prepared.json、deployment-result.json、real-model-readonly-proof.json、real-model-panel.png、launcher-readonly-before.json、launcher-readonly-after.json、listeners-before.json、listeners-after.json、backup-static/。原始模型提示词/日志未归档，只记录服务ID/状态/PID等安全投影。

最小后续仍是明确既有一致性工作流/输入输出及可切换现有Heretic的GPU窗口，随后只验指定旧功能；不默认重启任何旧批量生成。若仅继续使用已运行原面板，无需另启服务或新增权限。真实启动器启停和GPU/工作流执行仍在未验收栏，迁移范围已包含它们，不再一概排除。
