# 日志筛选查询与诊断目标恢复（2026-10-18）

状态：Accepted。旧app.ts1276–1278三多选变化、3528搜索变化即loadLogs；Next store仅liveEnabled时排队，因此普通工作区关闭实时后修改条件留空。恢复当前日志页用户筛选触发既有GET，保留原取消/版本保护，实时运行时复用已有队列避免双查，暂停实时只阻事件不阻用户查询；离页/未连接/只读构建不增加读取。

旧app.ts602记录lastPreviewProjectId，3508–3511诊断顺序为日志选中首项→最后Preview工程→首个登记工程，3383移除时清理。Next只取日志首项/首个工程。恢复同一当前来源、仍登记的最后有效Preview回执目标；Profiler不改目标，换源/断连/移除不复活。诊断准备仍冻结目标，不自动发POST。

范围：Next视图、Preview store和LogTools组件及对应回归。基线f903bc2/.54已部署。测试、strict、本地只读review、构建后原静态发布与隔离Edge。真实Creator/Preview/诊断写流程不执行，Cookie/用户窗口/服务不动。

补充只读核对：原doctor仅报告daemon/protocol/projectCount、Codex CLI可用性、Dashboard与Creator安装发现；codexAvailable不是五客户端项目MCP配置读取，不能替代所缺GET。严格部分安装和五客户端配置仍受原合同边界限制。

## 实现与验证

已恢复正常 workspace 可见日志页在停止实时更新或暂停日志时，用户修改筛选立即查询；实时运行时复用原队列，无重复请求。只读构建、其它页、未连接时保持原边界。有效 Preview 回执目标独立于结果显示保存，仅限当前来源及同一工程路径；Profiler/失败/迟到回执不写入，工程移除、换路径、断连清除。诊断选择优先级保持原逻辑，准备弹窗不自动发送。

3文件63项单 worker 回归通过；首次新增测试写反按钮文案后修正通过。strict 首次发现测试夹具修改 readonly 属性，改为构造时指定后通过。独立只读 reviewer 无具体发现。无真实 Creator/Preview/诊断写入；外部 OCR 沿用既有自动审批拒绝状态，未重试、不记为通过。
