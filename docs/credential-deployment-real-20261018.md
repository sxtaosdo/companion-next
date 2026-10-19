# 已部署的预设修复与凭据隔离（2026-10-18）

**已部署到本机32180，并通过真实Edge浏览器的限定验收。尚未读取/解密/注入真实知识凭据，不代表全部旧功能已验收对齐。**

## 实际装载

用户重申已有本地部署及服务重启授权。开机后实际核查32180无监听，Creator/WeKnora/已知模型进程未运行；两次确认无旧daemon后备份并正常启动，没有强杀或停掉其他服务。当前Companion PID **2772**，epoch `0f7ad7e0-f8f4-4159-9582-c6a241795f39`，Node25，仅监听 `127.0.0.1:32180`。

| 项目 | 实际SHA/结果 |
| --- | --- |
| 原live daemon | `148f28ad4989a038de1825beae197c4db9947f3209a8f22cf07ec330047df526`，离线逐字节复建一致 |
| 新live daemon | `9d2d01747eb2830d0b4d7c6b8456846fc02c131b9a1d4625839b4a4214f99fa5`，启动身份与文件SHA一致 |
| CLI | `bc1e15920a33e388a6d5cdc8347a9bec93fbe7cc719e7208cc8b112feeebca53`，原CLI字节完整保留，仅前加按凭据变量名拒绝的guard，map对应移一行 |
| worker | `ff0ff14026e3d5790ac48f83c901053ffd58055e5ab6c6be7fbd9dcdb134d699`，与daemon同目录 |
| Next | 源码`c63e4a5`；实际JS `index-CB_jf848.js`与其余六个静态文件的HTTP200/SHA全部匹配；旧hash资产保留 |
| 部署检查点 | `e633e7a / 1.3.173.116`，精确overlay工具及来源证明；隔离源码`3f4ca70`，类型补声明`4f3efdd` |

Daemon仅改变原knowledge-adapter与daemon指定接线，新增isolation；其它原源无移除/变化，聚焦、分项安装和原lifecycle保持。不执行普通build末尾的旧停进程脚本。缺少credential-file配置时在启动worker/读取DPAPI前返回AUTH_MISSING。

## 实际浏览器验收

使用独立headless Microsoft Edge上下文与真实32180后台，未打开/覆盖用户Codex草稿或剪贴板。只操作任务新建的两个临时工程和一个临时预设，未修改原对象。

| 场景 | 证据 |
| --- | --- |
| missing-auth | 状态auth=missing、keyword=unverified、writer/scheduler=false；kb/list真实401/AUTH_MISSING。未配置真实文件路径，未读取真实密钥 |
| 预设取消 | 可见确认标签勾选后取消，写请求0 |
| 刷新与工程ABA | 保持真实工具GET回包，切A→B→A后旧回调不继续预设GET |
| 在途改名 | 仅临时预设一次真实PATCH200；延迟其真实回执并切工程，界面保留UNKNOWN |
| 回读锁 | 一个tools GET受控abort，另一真实presets GET延迟；未settle时读取按钮保持禁用，结束后UNKNOWN不被改为成功。共5步 |
| SSE | 三次真实200/text-event-stream；一次建立阶段受控网络失败→冷却→真实重连；离页约1.2s无新订阅、返回新流；暂停/恢复当前临时工程日志。共7步，当前工程实际显示1行 |

页面错误0。临时preset、两个project全部DELETE200。`projects.json`与`tool-presets.json`清理后已是原字节，无需强行覆盖恢复；前后SHA及daemon PID/epoch一致。三个阶段的失败/成功记录均保留：首轮执行器误用未暴露的/api状态路由；第二轮隐藏input定位及offline未切已有SSE；修正验收方法后第三轮通过，均已清理，没有以这些测试方法问题伪称修复产品。

SSE有一次未限定日志请求被验收guard阻止；未读取或归档该历史原日志。暂停阶段仅验证有限观察期请求行为，不声称压测或所有事件投递已验。网络失败由route.abort明确注入，未伪造SSE成功，不称自然故障或已建TCP断线验收。原累计三次重连策略未变。

## TS7016核清及修复

独立code-mapper对比基线`3b0c24a`和候选：test:2的mjs导入、helper、两份tsconfig均未变化，无声明文件。故确为原并行基线问题，阻塞包含tests的完整typecheck，但不进入仅src的build/runtime图。候选补四个现有export的`.d.mts`，不改变运行脚本；完整类型检查明确exit0，helper定向1项通过，未运行停服函数。共享原源码工作区仍保护不覆盖，声明修复保留在独立候选分支。

此前91项隔离及194项Next整合已通过；本阶段仅执行受影响的类型/helper、包guard和真实浏览器验收，未重跑96资源/Creator/模型。

## 用户本机接入真实reader的最小步骤（本轮未执行）

当前8081知识服务未运行，本轮保持其停止状态；正向查询还需先通过原入口恢复知识服务。使用原用户已有DPAPI文件，不新建/续期凭据。在用户本机新PowerShell会话中：

```powershell
Remove-Item Env:WEKNORA_API_KEY, Env:KNOWLEDGE_SYNC_API_KEY -ErrorAction SilentlyContinue
$env:COMPANION_KNOWLEDGE_CREDENTIAL_FILE = 'D:/services/weknora/cli/private/pilot-recovery-reader.dpapi'
```

然后由用户在同一会话按原guarded流程重启更新后的Companion，刷新正常本地授权，回到Next执行一次限定只读查询。不要将密钥粘贴给Codex、网页、命令参数或共享环境；status=configured也不代表查询成功。worker仅在读操作时解密并验证原key3/tenant1/单KB/retrieve-only/fullfalse/原有效期。不存在或不匹配即拒绝，不自动扩大权限。

运行包备份、原registry私有备份仍在任务Temp `companion-credential-deploy-20261018-r3/deployment`，未把认证配置或registry正文提交仓库。[本轮证据](evidence/credential-deploy-20261018/)包含所有部署SHA、实际回执、截图、早期失败与独立审查。共享旧仓HEAD/status/workdiff/index哈希前后相同；这不扩大为整个磁盘/运行环境完整性证明。未启动模型推理、Creator、知识服务，未关机、推送或操作7471/7470。
