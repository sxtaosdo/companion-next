# VSCode工程配置格式：隔离修复交付（2026-10-19）

用户已明确批准隔离修复。候选源码提交`dacb89b67c2fa197a357b049510b996f3cccdc3c / 0.3.148`，基线9b8f979；**未部署，当前运行包仍0.3.147/PID10820**。

VSCode工程`.vscode/mcp.json`现在专属读写`servers`，其他客户端保持`mcpServers`。复用同一原子写入层，保留已有servers/inputs/未知字段/历史mcpServers；不同同名条目拒绝覆盖，幂等保持原字节。原子/security/Codex/Trae/Kiro实现不变，没有生命周期框架改动。

最终冻结源码5文件配置回归**114/114通过**（VSCode专属26项），变更日志3项通过，MCP/Web类型检查退出0，独立只读复审无P1/P2。直接esbuild生成CLI/daemon及两份map，4构建物SHA核验和node --check通过，不执行bundle，也不运行原停服打包脚本。daemon map中变更实现SHA逐项匹配测试源码；CLI不嵌入未使用登记器。首次绑定脚本误要求CLI也含所有登记器，已按实际职责更正后完整通过，没有把失败核验当通过。

证据：[候选验证](evidence/vscode-format-candidate-20261019/candidate-verification.json)、[源码绑定](evidence/vscode-format-candidate-20261019/source-bindings.json)、[构建清单](evidence/vscode-format-candidate-20261019/offline-build-manifest.json)、[前](evidence/vscode-format-candidate-20261019/host-before.json)/[后](evidence/vscode-format-candidate-20261019/host-after.json)只读保护核验。

可恢复交付：`C:/Users/33272/Documents/Codex/2026-10-17/task/companion-vscode-format-candidate-20261019/`包含16份源文件快照、candidate.patch、CLI/daemon与maps、测试和SHA清单，33文件逐SHA核验。Git隔离分支`codex/client-rollback-fix-20261019`干净。

未验/未解决：用户profile路径发现仍未扩展，`~/.vscode/mcp.json` fallback不是官方profile定位；strict JSON仍不支持JSONC；旧错误mcpServers残留不自动迁删；真实VSCode配置/发现/连接均未验。后续部署或真实配置另行明确范围。

前后核验保持PID10820 OPEN、历史UNKNOWN2、quiescenceEvidence0；9张业务表、共享22项修改、308个其他运行文件及真实客户端元数据不变。无真实配置/业务数据库写入、Creator/模型、新监听、服务重启、发布/上传/推送。
