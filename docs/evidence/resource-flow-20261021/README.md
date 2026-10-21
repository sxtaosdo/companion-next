# 资源真实类离线验证的冻结证据

这是原Temp执行的关键证据子集，不是新后台端到端或模型生成成功证明。原目录包含38件业务产物，原records/artifact-manifest.json不包含自身和Git内部；本归档有独立archive-sha256.json，路径范围不同。

源码是安装map中的原始字节快照；验证脚本仅供审计，不是产品入口，也不要在证据目录运行。若需复现，应复制到新的自有临时目录并先核实既有工具路径、来源SHA及许可。运行原脚本会建立测试Git工程和文件，原run-flow曾因link EPERM停止；resume-flow保留了补跑过程。不得为复现覆盖现有测试数据。

installed-classes.cjs未重复归档；其SHA、所用esbuild/zod版本和4份完整源在source-evidence中记录。构建入口installed-src/entry.ts使用现有esbuild进行node/cjs bundle；4份源及运行脚本已冻结。完整原目录和编译模块仍在Temp。

初轮使用Codex bundled Python；批准的Comfy Python仅补验inspect和直接CPU导出，未验证完整宿主绑定。输出PNG是合成测试输入经CPU缩放所得，非模型生成，非成功adopt或任务绑定导出。

maintenance中的历史构建脚本仅作追溯，后缀txt；它限定旧71cb baseline，不能直接用于当前70df安装包。它依赖的原fallback工作树已不存在，缺失三模块未被本归档补齐。OS/history两份摘要源自已完成只读工具输出，原采样时刻未捕获；文件明确记录这个限制。
