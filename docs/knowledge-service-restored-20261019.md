最新核验：用户本人执行接入命令后，2026-10-19 03:31 UTC状态为 `auth=denied`；唯一授权KB元数据请求返回 `403 AUTH_DENIED`，尚未正向通过。请停止后续读取，不重复运行包装脚本；见[实际回执](reader-codex-verification-20261019.md)。下文恢复结果及命令按各自时间和执行者阅读。

# 知识库服务恢复与本机只读接入（2026-10-19）

## 当前结果

2026-10-19 00:14 UTC 已确认 8081 恢复：WeKnora PID16812 仅监听 `127.0.0.1:8081`，`GET /health` 返回 `status=ok`。Companion PID8844 仅监听 `127.0.0.1:32180`。最后检查直接复用两个进程，启动请求为 0，见[端口与健康证据](evidence/knowledge-service-restored-20261019/port-bindings.json)。这些 PID 是当时记录。

原生 `/login` 页面返回 HTTP200，标题为 WeKnora，密码输入框可见；没有提交登录。Companion 仍为 `auth=missing`、`keyword=unverified`、`writerEnabled=false`、`schedulerEnabled=false`。未装载真实 reader，也未配置其凭据路径。见[验证回执](evidence/knowledge-service-restored-20261019/restore-result-r3.json)和[空白登录页](evidence/knowledge-service-restored-20261019/login-blank.png)。

## 本人接入步骤

1. 在本机 PowerShell 中执行下面这一条命令。**仅供本人执行，代理未执行。** 脚本封装原已审查命令：清除当前进程的明文密钥变量，传入固定 DPAPI 文件路径，保留四项 Owner 路径并补齐 WindowsPowerShell PATH；不会读取或解密凭据。
2. 脚本仅在 guarded restart 成功后调用原 `ui` 命令。重新授权浏览器会话，再打开 `http://127.0.0.1:32180/next/index.html#/knowledge`。
3. 点击现有“读取知识库列表”，核对唯一允许的知识库 ID：`da1051a5-3fff-4198-ba55-017ea79df9c3`。如需继续，文档列表最多读取 3 项。

```powershell
& 'D:/code/shidai3/P8000/companion-next/scripts/connect-knowledge-reader.ps1'
```

## 预期结果与错误处理

脚本只完成静态解析和原命令对齐检查，尚未由代理运行；不修改 `ExecutionPolicy`。若本机策略阻止脚本，请保留原报错并停止，不使用绕过参数。

- 重启会等待当前工作结束；遇到 busy/unknown 可能拒绝。命令返回失败就停在该处，不强制终止，也不重复启动。它会更换 Companion 身份，原 SSE/MCP/浏览器连接可能重连，需要重新授权 UI。
- 该命令不重启 8081、Creator 或模型，不修改系统环境，也不写入明文 API key。不要使用旧 `Enter-PilotCli.ps1` 搜索辅助脚本。
- 仅设置路径不能证明认证成功；私有 worker 只在发起 reader 操作时解密。列表读取失败或仍显示 `auth=missing` 时，保留错误状态和回执，停止后续读取；不要把 DPAPI 内容或密钥粘贴到聊天。
- 当前 reader 为 `keyID3`、`tenant1`、`retrieve-only`、`full_access=false`，到期时间 `2026-11-08T01:25:46Z`。只允许上述知识库内的库、文档、分块、原文读取和 `--no-vector` 关键词检索；不包含新建/续期密钥、扩大权限、chat/Agent/推理、写入、同步写入、入库或历史恢复。它是 API 身份，不是原生 Web 登录 JWT。

列表或元数据读取成功，只能证明这一段接入。关键词相关性、原文准确性、Agent/问答、同步及新旧后台完整对齐仍需分别验收。本任务没有执行真实 reader 正向读取。

## 恢复过程与保留证据

首次原 API 启动返回 503：上一次部署遗漏子进程 PATH 中的 `WindowsPowerShell/v1.0`，导致 `powershell.exe` 报 ENOENT，原启动脚本尚未执行。这是代理部署环境遗漏。确认两次空闲快照（计数全 0、无 unknown）后，使用原 guarded CLI 将 Companion2772 重启为 8844，daemon SHA 保持 `9d2d01747eb2830d0b4d7c6b8456846fc02c131b9a1d4625839b4a4214f99fa5`。只修正子进程 PATH，并保留四项 Owner 路径；未改全局环境或产品源码，未强杀。

第二次原 API 启动返回 200，WeKnora 实际启动一次；随后代理验证脚本误用 `h.status()` 而非 `h.status` 报错。修正后的验证器检测到已有实例，没有再次启动。[503 回执](evidence/knowledge-service-restored-20261019/restore-result.json)、[guarded restart 回执](evidence/knowledge-service-restored-20261019/companion-path-restart.json)和[启动成功后验证器报错回执](evidence/knowledge-service-restored-20261019/restore-result-r2.json)均保留。

恢复沿用原 `D:/services/weknora/Start-PilotAccess.ps1`（SHA `d5d799ea341e0bd4bc77fbb39f7d673e9e9200cfb1a021c93cc7b8a9737ed233`）及原二进制（SHA `b05899bc8ccaf299f8d5b5bb7c131cedf81491e51b02906b4321d72c10d6ce64`）。`AUTO_MIGRATE=false`、`AUTO_RECOVER_DIRTY=false`、`WEKNORA_HOUSEKEEPING_ENABLED=false` 保持关闭。服务正常读取自身数据库/JWT 配置，代理未提取或打印密钥；未执行历史恢复、迁移、索引、Creator 或模型操作。

首次冷启动只读检查在 30 秒超时，未绕过原 guard；随后以 100 秒诊断预算调用相同 `inspect_database`，使用 SQLite `mode=ro/query_only/BEGIN`，10.55 秒通过；事后检查 0.38 秒通过。[前快照](evidence/knowledge-service-restored-20261019/metadata-before.json)与[后快照](evidence/knowledge-service-restored-20261019/metadata-after.json)所采字段和计数深度一致：schema30/dirty0、quick_check=ok、guarded trigger counts0、knowledges1650/chunks59433/lite_embeddings2272/auth_tokens38/users2/tenants2；knowledge-state SHA 为 `2bdae1ba12dad8adb3ce61a25fa57366081821e40af1abb4a236277fa2c7e2b5`。这不证明全部文档元数据、正文或数据库字节相同。[保护检查](evidence/knowledge-service-restored-20261019/preservation.json)确认原登记文件字节一致，共享 cocos-mcp HEAD/status/diff 未变。

独立审查未发现 P1/P2，确认上述快照比较及重新授权要求；最后的端口回执补齐了证据格式。未重跑预设/SSE/Creator 套件，原验收范围不变。本阶段没有源码补丁、上传、推送、新监听服务、安装软件或修改安全权限。
