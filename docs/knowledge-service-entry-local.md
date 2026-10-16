# 知识服务原后台外开入口

状态：Accepted。延续旧后台功能等价迁移；只恢复已有知识服务外链，不扩展模型/服务/网络/凭据权限，不安装依赖或推送。

旧 `cocos-mcp/web/index.html:106–111` 与 `web/src/app.ts:2875、2902–2923` 使用固定 `http://127.0.0.1:8081/` 外链，仅知识服务运行且不能内嵌时显示。模型原版只有自动iframe（8090），没有外开按钮；新增模型外开属于新交互，本片不实现，须另行确认。

新版复用LocalServiceControls已存在的手动状态读取，只在当前有效来源、非读取/操作在途、知识状态明确 `running:true / frameable:false` 时显示原固定地址锚点。普通新页签、noopener/noreferrer，不新增请求、启动、关闭、iframe或模型链接。未知、停止、可内嵌、源/路由变化与失败均不保留旧外链；不改原启停确认或UNKNOWN保护。权威更新日志仍为 `src/domain/product-information.ts`，总缺口以 `feature-parity-current.md` 为准。

新增7项回归：正确外链/属性与无自动请求，三种不显示状态，模型专用页无链接，刷新/失败清除，以及来源/导航失效。包含Dashboard回归在内的定向5文件153项通过。真实2026-10-16 12:36 UTC读取固定8081返回ECONNREFUSED；没有跟随重定向或读取正文/Cookie/凭据、没有探测模型。实际服务不可达，真实后台打开/登录未验；不为测试启动服务。

完整前端90文件3775项及vue-tsc/正常workspace构建通过；本片没有修改静态检查器，复用前片55通过/1项Windows大小写fixture跳过结果，实际新六产物另经原inspectStaticCandidate验证路径/文件/引用/SHA通过。独立只读reviewer对功能及派生部署脚本均未发现有证据P1/P2，OCR Delegation显式使用父仓共享规则，未宣称managed PASS。

独立现有Microsoft Edge/Playwright、1440×1080设计分辨率5项通过：真实ECONNREFUSED按原停止语义无外链；受控运行不可内嵌时键盘外开精确URL；新页签无opener/referrer；刷新失败清旧链接；可内嵌/模型页/导航无新iframe或外链。0业务写入、0页面异常、0模型请求转发。正向状态及目标页均由测试截获，真实知识后台没有被打开，不能当作后台可用/登录验收。

源码提交 `d3792c10a6017830118ecb0878cacb44667ac819`，原Hook版本1.3.173.7/Agent校验通过；产品package/页面仍1.3.173。2026-10-16 12:43 UTC仅部署同一六静态，新建JS/CSS并最后原子切换index，六项回读一致；旧12文件已逐项备份，11份旧资源保留。1779保护项和22原脏项不变，前后43个node/python/Creator进程PID/名称/创建时间一致。无服务重启、模型操作或网络/凭据权限变化。

- 入口SHA256：`be6cdd9dbaea88a99b70d66ac7869474342b38f988c2836c1f184e5da2f4cbbc`
- JS `assets/index-BLZP7lTS.js` SHA256：`f34fb3759b089f2f9816b525b5e4a26d949ca907091065149238f5d13a4998f7`
- CSS `assets/index-BaZPIQDA.css` SHA256：`15fec78de8872cded6915343245a92362f46af10ab89dc47684c2ba1952fb969`
- 部署helper SHA256：`e615063f56612cbe8409c274a04e254f8c7ada121ade20104c6764d73a84e543`

部署helper复用前片已审逻辑，仅10处固定常量/字段变化。首次prepare错误引用子片基线格式，在任何备份或线上写入前KeyError退出；修正为主任务依赖基线后，prepare/独立复审/apply与回读全部完成，没有重放apply或绕过Hook。

仓外证据位于 `C:/Users/33272/AppData/Local/Temp/companion-next-parity-20261016-1201/knowledge-entry`。上一Dashboard片的源/文档检查点、六静态备份、只读快照和UNKNOWN保护保持；回滚仅恢复本片备份的原入口，先核当前hash，不回退业务数据、模型或其他源文件。
