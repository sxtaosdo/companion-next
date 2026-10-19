2026-10-19 03:45 UTC: Reader403根因为本机到期常量丢失小数秒，仅修worker复用原配置、无重启；授权KB及3项文档元数据200、auth=verified，keyword仍unverified。Codex此前误读placeholder；真实Next标记完整接收并精确清理，无发送。见[原因与证据](reader-precision-codex-receipt-20261019.md)。

# 一条命令接入与 Codex 仅填入检查（2026-10-19）

知识库包装已准备，**仅供用户本人运行，代理未执行**：

```powershell
& 'D:/code/shidai3/P8000/companion-next/scripts/connect-knowledge-reader.ps1'
```

脚本固定复用原受限reader路径，保留四项Owner路径和进程PATH，先清当前shell两项明文key变量；原guarded restart失败即停，成功才ui。未读取/解密DPAPI或任何密钥，未执行认证配置、创建密钥、扩权限、改执行策略或安装软件。静态Parser检查0错误，命令主体与此前已审查块一致；中文说明同步为单行命令。运行后的认证是否成功仍需用户本人限定读取核对，不能以脚本存在代替通过。

Codex实际UI进程为OpenAI.Codex包内ChatGPT.exe，而非无主窗口的codex.exe；之前按进程名查找未定位窗口是诊断方法问题。此次已定位PID14200/窗口132096及唯一可见ProseMirror编辑区。调用顶部侧栏“新聊天”原控件及不带prompt的codex://new入口后，该编辑区仍不能证明为空：仅计数可访问字符单位为100，未读取文字、未修改草稿或点击丢弃确认。没有把URI唤起记为接收成功。

用户概括要求代操作后，清剪贴板命令在执行前被自动审批拒绝：审查认为未在用户原文中明确授权删除现有剪贴板，存在请用户先清空的更安全替代。没有改用其他工具或间接执行清除；剪贴板未读取/覆盖，未写测试标记、发送或创建任务。该动作需用户明确确认；同时仍须可证明为空的独立目标，不能销毁未知草稿。

[本轮结果](evidence/one-command-codex-20261019/outcome.json)、[输入长度元数据](evidence/one-command-codex-20261019/codex-editor-length-only.json)和[包装静态解析](evidence/one-command-codex-20261019/one-command-parser.json)均为限定证据；没有对话正文、密钥或剪贴板内容。诊断脚本先遇PowerShell5的UTF8 BOM及TextPatternRangeEndpoint命名空间错误，修正后才得到上述元数据；这些执行器问题不当作产品缺陷。

独立reviewer只读审查包装脚本与说明，未发现P1/P2；未执行脚本。
