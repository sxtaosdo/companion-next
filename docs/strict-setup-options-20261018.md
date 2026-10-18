# 严格分项安装合同及Next接线

状态：Accepted，用户明确允许窄范围旧Companion安装接口修复（2026-10-18 02:16:44 UTC「允许」）。不改旧页面/账号权限/持久客户端配置，不安装软件、不启动模型/真实Owner Creator、不推送。

检查点：Next ca253c3/.63，旧repo 4fcfe82717da3f4a84f4e3117217366bffb93b4b仍22项并行dirty；基线/逐文件SHA/二进制patch位于Temp/companion-setup-options-20261018/baseline.json及old-dirty-before.patch。HTTP/daemon/changelog有并行改动，本任务只提交相对基线的独立补丁，不add-A。安装service原文件干净。

后端：归一化不可变有效选项、同路径仅同有效选项复用，不同选项409拒绝；创建/GET回显contract版本与有效选项。提供同范围只读合同发现，避免Next把分项选择发给不支持严格复用的旧服务。新建任务无额外依赖，始终原Bridge安装，Creator/Codex由明确选项控制。先验证四组合、可变输入、重用/409及HTTP；真实动作全部受控执行器。

部署：当前bundle内嵌的66份自有源码与工作树除lifecycle-drain.ts外一致。以现运行包source map还原隔离源码，叠加本任务setup-service/http-server/daemon三文件，保留运行时原生命周期，不误上线其它并行修改；不执行整个旧release/旧页面构建。若需要一次重启，通过原guarded-stop/原CLI恢复既有32180，正式ui恢复Cookie并核对普通窗口无403。

Next保留登记独立动作，恢复Bridge必选及Creator/Codex独立选择，确认绑定实际选项，202和GET合同不匹配记UNKNOWN不重发，旧服务能力不足不发分项请求。完成示例不把未配置Codex误称已连接。共享scope/Agent动作保持明确确认与真实配置0写入。

## Implementation and isolated verification

- Backend setup service, daemon mapping and HTTP routes implement optionsContractVersion 1. Dedicated options-v1 POST prevents old handlers accepting partial choices. 41 backend service/HTTP tests passed with fake executors and temporary directories.
- Next freezes independently selected Creator/Codex flags; Bridge remains required. Capability GET and the dedicated POST never fall back to legacy POST. 202/GET must match; conflict is rejected, mismatch remains UNKNOWN and retains the shared write barrier. Completion shows actual selected steps; no MCP configured prompt when Codex was not selected. Agent and scope steps bind to any matching completed setup.
- Original Next regression selection: 424 passed. Contract tests 17 passed. Post-review store/UI/client regression: 77 passed. Added four real Vue confirmation combinations: latest UI+contract run 53 passed. Next types passed. Backend all-source plus installation-test isolated types passed; full pre-existing test tree still reports missing declaration for parallel untracked stop-previous-daemon.mjs, outside this task.
- Reviewer review_log_refresh found stale confirmation/Agent wording and generic paused mismatch state; fixed both and added four UI combination tests. OCR executable remains rejected by automatic approval review from earlier phase; no OCR pass is claimed. Local read-only reviewer used.
- Build reconstructed original 107-file source closure plus 66 live embedded sources. Before applying patch, generated daemon is byte-identical to live f3323c72165a2d2f28f3faf89b3c5811e5df1dafee384303db0bf84811970e70. Candidate hash 0b9c2e28d7993201cc31e99329b2a58c06087c2fb7f06e8b0e6277242c2197ab; all 236 mapped sources match except exactly three authorized setup API files. Original lifecycle preserved. Evidence: Temp/companion-setup-options-20261018/verified-build-proof.json.

Deployment is pending guarded replacement and formal UI session restoration. No real project installation, Creator launch, client configuration write, model or cloud operation has been performed.

Follow-up review closed the adapter pre-decode path too: invalid contract version/options now become options-mismatch before store polling; actual adapter-to-store tests cover version, shape, missing metadata and different flags. Latest adapter+contract tests: 302 passed. Original mixed/CRLF line endings restored for unchanged wizard and connection-store lines.
