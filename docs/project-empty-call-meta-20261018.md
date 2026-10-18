# 工程空状态与最近调用展示恢复（2026-10-18）

状态：Accepted，恢复旧UI现存行为，不增加业务接口。基线dcd9d70/.52已部署并通过100回归、strict/构建和隔离Edge。

旧app.ts1539–1562区分无登记（添加项目）和筛选无匹配（清除筛选），3315–3331复用原添加入口并同时清空query/filter。Next仅一个empty文案。恢复按钮时只打开现有ProjectSetupWizard，不提交任何登记/安装；未连接或读取失败不冒称无工程，添加遵守provider/连接/项目lane。

旧call-meta.ts及app.ts1472–1491、2007–2018显示运行耗时/完成耗时与相对时间，每100ms（运行）或1s（完成）局部更新。Next已有真实latest.durationMs适配，但只显示英文状态和固定开始时间。复用旧格式逻辑，完成缺耗时不伪造0；计时仅在可见工程页存在可见摘要时启用，隐藏/离页卸载清理，不增加任何请求或整页刷新。

范围：Next工程视图及纯文本格式helper、相应UI/格式测试。先定向、strict、只读review，再必要构建/现有静态部署与隔离Edge。真实Creator/模型/安装/凭据仍不操作；普通用户窗口/Cookie和PID2100保持。


## 实现与验证

工程empty区分未连接、读取失败、已核实空登记与筛选无匹配；添加只开已有向导，受source/provider、连接、loading和lane保护；清除同时复位搜索与状态筛选，无请求。最近调用保留原准确工程导航，复用已读取startedAt/status/durationMs，运行100ms/完成1s局部计时，仅可见工程页展开摘要启用，隐藏/切页/卸载停止。缺耗时不伪造0，超日历完成时间不抛异常。

3文件67项单worker定向回归通过（纯格式、工程UI、实时store），最终strict和一次workspace构建通过（原chunk体积提示保留）；独立只读review无具体发现。测试验证添加仅开窗且fetch0、共享lane、读失败不冒称空；本地计时隐藏暂停、恢复和卸载清理，不产生额外工程/计数请求。下一步静态部署后以隔离Edge分支验证。


## 已部署验收

源f903bc2/.54已部署，备份42旧文件并保留hash资源，六文件HTTP SHA匹配。隔离Edge正常/空登记/读取失败三分支通过：运行毫秒局部递增且请求数不变；清空搜索+状态筛选无额外请求；已报告250ms与1分钟前显示正确；空登记只开原向导无请求，读取失败不显示添加/尚无工程。首次脚本点击ElSelect内部input被标签拦截，改点可见wrapper后通过，未重复发布。截图project-call-meta.png已查看。业务写入0，PID2100/epoch/OPEN保持；证据C:/Users/33272/AppData/Local/Temp/companion-project-presentation-20261018/browser-proof.json及deployment-result.json。
