# 工具预设类别批量选择恢复（2026-10-18）

状态：Accepted，恢复旧app.ts790–848按scope分类、已选/总数、折叠及全选/取消/半选态；旧仅自定义可编辑。Next本地草稿当前为逐工具三态，没有类别操作。

计划：保持逐工具三态，在草稿区按已读取目录scope分组，类别计数按实际effectiveToolNames计算。只编辑现有自定义内存副本，沿用原正式保存确认流程；一次批量操作只产生一次草稿更新。搜索只过滤显示，类别按钮明确作用于完整类别，不能误受搜索子集影响。未知/失效目录不批量更改，不清除其他类别或未知旧覆盖项。保留原core/full内置预设和provider调用计数不变。定向测试、类型、独立只读review、必要构建后既定静态发布和隔离Edge。

已部署基线2524d9b/.50，上一片92回归、strict/构建/六HTTP SHA及5例Edge通过。继续保护共享22改动、用户普通Edge和PID2100，不触碰模型/Creator/凭据或真实配置。


## 实现与本地验证

保留逐工具三态；增加scope标题、折叠、完整类别已选/总数与半选复选框。setScopeSelection根据baseProfile计算最小enabled/disabled覆盖，一次replaceEdited/一次revision，不触发provider。其他scope及未知旧覆盖项原样保留，core/full内置不改，只编辑自定义副本。搜索过滤不改变类别按钮的操作成员。

独立只读review发现：原effectiveToolNames校验未知旧覆盖会使所有类别禁用。已修正为仅在计数临时投影中过滤未知名，实际草稿未知覆盖仍显示且保留，完整导出/保存校验继续拒绝未知项。新增实际UI点击回归后复核无剩余具体问题。

4文件100项单worker定向回归通过（草稿store/UI、正式保存store/UI），最终strict类型和workspace构建通过。初始strict提示checkbox回调隐式any，已显式unknown并以value===true接收；最终严格检查通过。沿用本链55静态通过/1平台跳过的入口机制验证，本片未改打包机制，不重复全套测试。无真实配置/模型/Creator写入，待既定静态部署及隔离Edge验收。
