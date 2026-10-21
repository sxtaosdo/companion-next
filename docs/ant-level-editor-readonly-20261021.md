# 蚂蚁关卡编辑器：指定工程目录与刷新生效核查

状态：只读结论；未修改编辑器、工程关卡、Creator、预览或存档。2026-10-21。

## 结论

目前不能直接做到“编辑后写正式工程指定目录，刷新游戏即读取最新配置”。现有流程已经能编译候选、检查与试玩，但正式工程导入未开放。这里将用户“指令目录”理解为“指定目录”，未猜测自定义路径。

## 当前保存与输出

- 仅棋盘：`colony-board-v1` JSON，文件名`board-<行数>x<列数>.json`。只含schema、rows、columns、boardCells，不是完整运行关卡。
- 整份草稿：`level-<目标关>-draft.json`，包含棋盘、待选数字组、规则及关联；通过浏览器下载保存，目录由浏览器/用户选择，不自动进入工程。
- 浏览器编译：每次服务启动建立`%TEMP%/ant-level-editor-v2-<随机后缀>/`。每次候选放`<id>-candidate/`，对应隔离工程为`<id>-sandbox/`。
- 候选包括`board.json`、`rules.json`、`levels.csv`、`operationalThemeData.ts`、`level-catalog.json`、`validation.json`、`preview.diff`、`plan.json`。按当前主题元数据替换既有1–60关的目标行。
- apply需要审阅计划SHA，并核对源数据/代码/候选指纹和真实模型搬运见证；只允许有标记的工程外隔离副本，明确拒绝正式工程及路径别名。

## 正式工程与运行时

正式主题数据：`D:/code/shidai3/P4000/ant-cook/assets/Colony/config/themes/<themeId>/levels.csv`，五个主题分别为leafy-vegetable、orchard-fruit、root-vegetable、tropical-fruit、tropical-vegetable。

编译输出：`D:/code/shidai3/P4000/ant-cook/assets/Colony/scripts/application/operationalThemeData.ts`。

运行入口：`LoadingState.loadLevelCatalog()` → `createOperationalCatalog()` → 静态导入的`OPERATIONAL_THEME_DATA` → 新建`ColonyFlowModel`；catalog和model保留在当前session。不是每次进关/刷新发HTTP读取CSV或下载JSON，也没有该链路的外部JSON缓存失效接口。`development-levels.json`不是此入口当前的数据源。

开发预览：将来正式导入入口获批实现后，需要写入CSV与对应生成TS、经Creator标准导入/编译确认新版本，再整页刷新预览重建session。单写下载JSON后刷新不会生效；未编译完成或旧预览chunk仍在时也不能保证最新。此为代码路径推论，本轮未调用Creator或刷新用户页面实测。

打包发布：运行配置已进入编译脚本产物；修改本地CSV/TS不会更新既有包。当前需要重新构建、部署，客户端再加载新产物。若期望发布后不重建就换关卡，需要另行设计远程配置版本、校验与缓存更新流程，当前未实现。

## 最小可执行方案（待批准）

保留现有草稿、编译与通关见证，增加一个固定绑定本工程的“导入工程”入口：显示目标关和两个目标文件，预览差异；确认后用源hash围栏、备份和失败回滚写入CSV/生成TS，给出Creator导入/编译结果及“可刷新”反馈。拒绝任意浏览器路径和并发覆盖。先用隔离工程验证成功、过期候选、第二文件失败与回滚，再在明确释放的工程窗口验证。不先改成任意目录写入或远程热更新。

## 代码证据

- [棋盘下载](../../../P4000/ant-cook/scripts/board-editor/editor.ts:117)、[完整草稿及候选交互](../../../P4000/ant-cook/scripts/board-editor/groupsEditor.ts:155)。
- [临时根与候选路径](../../../P4000/ant-cook/scripts/board-editor/serve.mjs:28)、[编译和apply服务](../../../P4000/ant-cook/scripts/board-editor/serve.mjs:55)。
- [生产路径](../../../P4000/ant-cook/scripts/board-editor/levelPipeline.ts:13)、[只允许隔离导入](../../../P4000/ant-cook/scripts/board-editor/levelPipeline.ts:282)。
- [静态导入运行数据](../../../P4000/ant-cook/assets/Colony/scripts/application/operationalLevels.ts:3)、[catalog构建](../../../P4000/ant-cook/assets/Colony/scripts/application/operationalLevels.ts:21)、[启动构建session](../../../P4000/ant-cook/assets/Colony/scripts/presentation/pageStates/loadingState.ts:134)。
- [现有使用合同](../../../P4000/ant-cook/BOARD_EDITOR.md:52)。历史端口/验收记录不代表本轮服务状态，本轮未访问7470/7471或任何编辑器服务。
