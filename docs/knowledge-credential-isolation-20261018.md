# 知识凭据隔离候选（2026-10-18）

**源码隔离开发已完成，虚构凭据测试通过；尚未部署共享后台，真实密钥接入与真实 Next 正向查询未验收。不能据此宣布新旧后台全部对齐。**

用户已同意先做凭据隔离，再由用户本机完成密钥接入。本轮恢复后实际执行机为 DESKTOP-0F68QLN；未再次关机。

| 项目 | 结果与证据 |
| --- | --- |
| Git 检查点 | 共享原 HEAD `6ff44f5`，独立基线 `3b0c24a` 保存原有 21 文件并行修改；候选提交 `3f4ca701460fde68c8475c823b9232bbbb4086c9`，分支 `codex/credential-isolation-20261018`，仅本地，不推送 |
| 实现 | 共享 CLI/daemon 按变量名拒绝遗留 reader/writer 凭据环境；父进程仅传非敏感 DPAPI 文件路径；一次性私有 stdio worker 负责读取、解密、验证现有只读身份及调用 CLI |
| 原权限范围 | 固定 key3、tenant1、原单 KB、retrieve-only、非 full 和原有效期；不创建/续期/扩大凭据。检索显式 `--no-vector`，不开放问答、Agent 或 writer |
| 返回边界 | 复用原 Adapter 在 worker 中投影，随后按已知凭据及常见编码脱敏；二进制下载含凭据字节时固定拒绝；原始 stderr/异常不返回共享后台 |
| 生命周期 | 父进程只协作取消，不强杀 worker。观察 CLI/decryptor close 后才能回执；期限/异常退出保留 unknown，禁止误报 drain 完成 |
| 定向验证 | 7 文件 91 项通过；真实生成的虚构 DPAPI blob、随机 loopback 假服务、假 CLI/无关子进程，包含超限、取消、60 秒期限和异常退出 |
| 构建 | production build typecheck 通过；CLI/daemon/worker 三份候选 bundle 构建通过，打包 worker 对未批准方法先拒绝 |
| 全量类型检查 | 仍有基线已有 `mcp/tests/stop-previous-daemon.test.ts:2` 的 TS7016（并行 mjs 无声明）；没有掩盖为全部通过 |
| 独立审查 | reviewer 与 architect-reviewer 复核；3 项具体边界问题修复后无未关闭 P1/P2。审查者未重跑测试；不声称操作系统强制只读 |
| 共享保护 | 原 cocos-mcp HEAD、status、完整工作 diff 前后相同；未改旧 UI、共享服务、Creator、模型、用户窗口、草稿或剪贴板 |

候选工作区：`C:/Users/33272/AppData/Local/Temp/companion-credential-isolation-20261018/worktree`。最小接入说明在该候选 `mcp/docs/knowledge-reader-isolation.md`；相对基线的完整补丁及证据已归档 [evidence](evidence/knowledge-credential-isolation-20261018/)。

## 用户本机接入（本轮未执行）

在批准部署候选且通过原 guarded 流程确认旧实例已安全退出后，用户在本机新 PowerShell 会话中移除该会话的 `WEKNORA_API_KEY`、`KNOWLEDGE_SYNC_API_KEY` 环境变量，仅设置非敏感 `COMPANION_KNOWLEDGE_CREDENTIAL_FILE` 为原用户 DPAPI 文件路径，再按原流程启动更新后的 Companion。无需把密钥交给 Codex，不新建凭据。随后用户在 Next 执行一次有界只读操作，分别核验认证和结果；status=configured 不能替代正向结果。

这实现防止 Companion 意外继承传播，不宣称抵御同用户恶意进程、完整内存擦除或已证明所有异常退出后的子进程消失。无有效退出确认时必须保留 unknown。

## 并行推进

23:37 UTC 用户要求独立模块多开。已保存 Next 干净 `867f7e0` 检查点，并实际启动日志/SSE混合竞态、预设覆盖与在途竞态两个不重叠模块；复用 reviewer 只读审查。根独占 Git 索引、共享文案、服务和桌面。分支发现和最终结果另记，不能提前列为业务验收完成。
