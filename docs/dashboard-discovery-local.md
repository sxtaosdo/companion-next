# Dashboard 工程发现：本机功能还原

状态：Accepted，任务相关本地开发、测试、Git检查点和可回滚静态部署已授权；禁止push、新依赖、旧后端范围外修改、模型操作及网络/凭据/权限变化。

## 原功能与文件边界

对照旧 `cocos-mcp/web/src/app.ts:1899–1957、3281–3304`：刷新Dashboard/Creator工程列表，展示名称/路径/存在性/登记状态/版本/来源/进度/最近打开/运行PID；路径不存在禁选。点击只把路径及已登记身份带入原接入流程，不执行登记、安装或启动。

Next复用已有同源 `/api/dashboard/projects` GET、严格解码、超时/取消护栏和原登记向导；增加独立手动读取，不改变正常工作区 `dashboardDiscovery:false`，避免工程每3秒轮询反复执行进程发现。记录本次Dashboard观察时间；普通状态轮询保留该快照，来源断开清空。失败清旧列表、不假报零，关闭/离页取消，重复点击合并；注册列表仍只来自原登记接口。

功能文件限于既有browser domain/adapter/store、工程页面、ProjectSetupWizard及其局部原深色样式。新增定向测试及更新原API枚举断言；权威前端更新记录为 `src/domain/product-information.ts`。未修改旧后台、Creator工程、Scene/Prefab/Meta、AI产物或UNKNOWN。

## 已验证与待验

- 定向5文件173项通过；vue-tsc类型通过。默认沙箱Vitest缓存rename曾EPERM、未执行用例；已有正常宿主授权下同一命令受审重试，保留原断言。早期新增测试桩类型/方法缺失已纠正。
- 2026-10-16 12:12 UTC经已安装官方CompanionApiClient合法认证只读既有 `/v1/dashboard/projects` 两次，608/448毫秒，均返回8项，6项与真实登记匹配；新版解码通过。原6个登记、实际状态另行只读取得；匿名网页API仍403。仅为机器API/实际数据证据，不声称认证网页端到端已验。
- 正式daemon bundle仍SHA256 `39e88c9045e5d8266b059ce2b1ceb48cf522c5d0afc5f4596658c4545ae6641e`。没有注册、setup、模型、服务重启或实际业务写入。
- 完整前端90文件3768项通过；正常workspace的vue-tsc/Vite构建通过，保留原大chunk提示。静态检查正常宿主55通过/0失败/1项Windows大小写fixture跳过；默认沙箱另有hard-link夹具EPERM失败，原命令受审重试后通过，没有修改断言或跳过配置。实际六产物由原inspectStaticCandidate校验路径/普通文件/JS语法/引用/SHA，全部通过。
- 已存在Playwright及独立Microsoft Edge，1440×1080设计分辨率验证5项：真实只读快照工程/Dashboard列表、原点选路径及仅准备登记、HTTP503故障清旧列表、空响应、重复禁用与关闭/迟到/往返导航。0页面异常、0业务写入；测试服务仅127.0.0.1，测试后关闭自有浏览器和服务。首次测试夹具误将机器status封装当浏览器数组，已按旧路由使用同一projects数组修正后重跑通过；产品代码未改。截图为真实浏览器渲染，数据为已取真实快照与受控故障，不是认证生产页面验收。
- 独立只读reviewer审查功能及仓外部署helper均未发现有证据P1/P2；OCR Delegation显式加载父仓共享规则，12文件选取/规则与宿主审读已完成，最终说明/版本镜像另纳入提交核对，不宣称managed PASS。

## 本地提交、部署与保护证据

功能提交 `6fe88585d942fe9862acc98b65664465734d1d10`，原Hook生成本地1.3.173.5并校验Agent署名；产品package/页面仍1.3.173，锁文件与依赖未变。构建时为同一功能工作树，提交后逐个构建输入SHA与已提交源码状态复核一致，不把后续说明提交重标成重新构建。

六静态已部署到原 `cocos-mcp/mcp/dist/companion/web/next` 并逐文件回读：仅新增 `assets/index-CXcfVXmi.css` / `assets/index-DVyF6XSu.js` 并最后原子切换index，其余三文件字节相同未重写。原10个文件中9个旧资源保留，全部原文件和入口在本任务 `backup-before-dashboard` 有已校验备份。1779保护项/22原脏项前后保持，junction仅核元信息不遍历；42个既有node/python/Creator进程PID/名称/创建时间前后一致，daemon21104、Creator25244/25848及已有Python均保留。

- 新入口SHA256：`50cdbbcd85da44c5b92f48ad01177f42de064217710af80eec96cc06ffef138a`
- 新JS SHA256：`5d0a571c7e6ee4287d5e6f08379c72a1be0cd61487c29148105bd06c99e1f698`
- 新CSS SHA256：`aae6a2f550df9919b22dedff496d324548153298023c89695e52ebf11582de91`
- 部署helper SHA256：`4ea0f4312fb150c5f5950316470995f593521771db3717cbcbe4f499bef98e4a`

仍待Owner认证页面的版本/响应SHA与真实业务操作验收；未读取或搬运Cookie/token，没有真实登记/setup/模型或Creator写操作。前置CIM快照在沙箱无法访问CIM资源，未作为成功证据；获准正常宿主重试的部署前后快照才用于上述42进程比较。

## 剩余迁移与回滚

目录选择/四来源创建与scaffold、严格部分setup、Preview/Profiler/诊断导出、日志清空、独立MCP客户端配置、Agent问答/同步和供图统一装配仍缺；模型启动的网络副作用及AI变体真实导入是独立阻塞，不阻塞本片。总清单以 `feature-parity-current.md` 为准，不另造第二主计划。

本地源码通过原Hook精确提交，不push。部署只替换原Next六静态文件，保留当前173入口及所有旧hash资源的备份/哈希，最后原子切换index；不重启共享daemon。回滚只在目标仍匹配本次hash时恢复部署前入口，保留新增未引用资源，不清理Owner/并行文件或旧UNKNOWN。

仓外证据：`C:/Users/33272/AppData/Local/Temp/companion-next-parity-20261016-1201`；包含基线、测试、真实只读数据及后续部署/复审记录。角色为普通子代理prompt-emulated，注册preset与硬只读隔离未核验。
