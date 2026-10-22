# Proposal

## Why

34项实际入口审计确认旧功能仍有遗漏，代码存在也未形成当前32180的完整业务证据。用户已明确批准恢复三项缺口与引用预设删除，并保留新布局及手动日志查询；本变更记录这份既有批准，不新增范围。

## What Changes

- 添加完成页复用工程绑定的Agent提示词、换行与复制。
- 恢复原任务绑定交接包的任务、候选、hash与目标工程校验，不自动发送或触发Creator。
- 恢复原参考裁剪与cropId查询，未知只查原请求，不接参考图入模。
- 恢复确认删除引用预设并使关联工程回退full的能力，不实际删除用户预设。
- 使用唯一32180、已有e2e工程与生成物验证后台UI打开、导入、文件/UUID重读和添加安装；分别记录失败、未执行与通过。
- OpenSpec仅关联审计、已批准差异、任务和证据，既有AGENTS/规范继续权威。

## Capabilities

### New Capabilities

以下是首次写入OpenSpec的能力规格，非新增未经批准产品功能：
- `project-onboarding`: 完成后的工程绑定使用指引。
- `icon-task-handoff`: 原图标任务交接包的身份和内容校验。
- `reference-cropping`: 原参考裁剪保存与确定性cropId状态查询。
- `tool-preset-removal`: 引用预设的显式影响确认和删除恢复边界。
- `migration-evidence`: 34项审计与单一32180真实验收证据映射。

### Modified Capabilities

无既有OpenSpec主规格；不改变已批准布局与日志手动查询。

## Impact

仅当前Next源码、测试与项目工作流文档；复用现有Companion接口、Cookie及工具链。正常静态更新不重启宿主。若验收需配置既有生成物来源或正常服务级重启，先核实确切绑定与授权边界；不新增后台、账号权限、GPU生成、正式素材写入或云发布。
