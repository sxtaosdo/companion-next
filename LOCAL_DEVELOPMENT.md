# Windows本地开发交接

状态：Accepted（Owner/Parent已批准完整源码同步、本地开发/测试/构建/六静态文件部署及原锁官方npm依赖；Owner Sentinel_40a744e240288191a450453b37a4b488另明确批准第1项在Windows正常执行环境中保留原检查完成这些动作，不改网络/安全配置）。

当前环境（2026-10-16 08:48 UTC）：获准宿主预检确认本项目无残留npm，官方DNS及正常HTTPS200；未改DNS/代理/安全设置或读取凭据。随后原锁`npm ci --ignore-scripts`退出0，214个适用依赖全部安装，逐项版本/来源与D盘缓存tarball完整性通过；package/lock字节不变。三份vue-demi默认已选Vue3，esbuild0.25.12原生包可用，所有生命周期脚本仍未执行。本机全量测试、workspace类型/构建和静态校验接续进行，尚未部署173。证据为仓外同目录`host-resume-preflight.json`、`host-install-result.json`与`host-dependency-verification.json`。

历史阻塞（05:15 UTC，已由本次明确批准的正常执行环境解决）：此前受限上下文安装因`ENOTFOUND`退出1，并报`Exit handler never called!`。当时没有改DNS、代理或安全设置、没有绕过拒绝；旧回执`locked-install-blocker-receipt.json`仅代表当时状态。

本目录为Companion Next独立前端源码，与独立游戏运营后台分别维护。当前只接收既有1.3.173功能，没有重做功能、改旧后端或控制共享服务。

## 来源与文件边界

来源完整包`companion-next-1.3.173-complete-source.zip`，1313261字节，SHA256=`b4dc893ddaab276ef8fd95c2eb35d82a4f1597affe8b6b6f03e1659d0ad2b477`；Library `libfile_bbf510fb90948191afc351ff85cfd1db`/version0，来源HEAD=`9db8b3af26982af7e9366ae03d865d8782f98a33`，产品版本1.3.173。正常浏览器会话下载，未读取认证材料。

04:56 UTC导入时319份来源文件及3份迁移元信息全部逐文件校验字节/SHA256并回读；不含Git历史。原清单`SOURCE-MANIFEST.json`和`SOURCE-COMMIT.txt`原样保留。之后仅在README增加本地版本与状态入口，并增加本文件、VERSION、标准scripts/git_version.py及两项.githooks；package/lock/业务源码均保持来源字节。初始Git提交是本地导入检查点，不是来源提交本身，不能声称保留原Git历史。旧Downloads快照及既有后端未改。

## 环境与锁定安装

采用已存在Node22.23.3：`D:/code/shidai3/P8000/dual-game-build/node_modules/node/bin/node.exe`，配套物理npm11.6.2入口`C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`。不改系统Node/PATH，不共享其他项目node_modules。

锁文件v3有264个package记录，全部为官方HTTPS tarball并带SHA512；当前Win32-x64适用214个，缓存命中110、缺104（102必需、2可选）。原110份缓存已逐包验证完整性后复制到上述D盘缓存。逐项版本/URL/integrity清单在`C:/Users/33272/AppData/Local/Temp/companion-next-1.3.173-source-sync-20261016/dependency-download-scope.json`，最初待批准状态是历史；本次Parent已批准原锁必要依赖，无需重复确认。

首次执行原锁项目本地安装因受限上下文失败，15个原锁tarball及npm update-notifier元信息共16个URL、48次DNS失败、0个成功HTTP；没有升级npm或依赖。08:45在明确获准宿主正常环境续装，使用同一D盘缓存及`ci --ignore-scripts --no-audit --no-fund --prefer-offline --update-notifier=false --registry=https://registry.npmjs.org`，退出0，214包完整安装。实际安装解析来源全部registry.npmjs.org且与原锁一致，全部已安装tarball的SHA512回查通过；没有运行安装脚本、增加包、全局安装或升级锁。package SHA256=`853f7379d7e4ea38c114213947cbc4773de2ffd8b98a5a9fc8b14fc5d8098ab2`，lock SHA256=`c5cfda71019754a954c6acd9e570121d28a9975e6aceae65bab7ee375c98e23a`，安装前后不变。保留上游whatwg-encoding/glob弃用提示，未擅自升级或宣称完成新漏洞审计。

本地Git使用P0002四段版本合同，前三位沿用批准的产品1.3.173，本仓W独立递增。Hook和VERSION由本仓维护；脚本从工作区标准实现复制，仅适配首次unborn HEAD。Hook默认python3；Windows已有python3为Store别名，本轮仅在提交进程中设置`COMPANION_NEXT_PYTHON=C:/Users/33272/miniconda3/python.exe`，不修改全局配置或PATH。

## 验证、部署与下一步

来源哈希与本机锁定安装核验已完成；全量测试、类型检查、正常companion-workspace构建与静态引用校验接续进行，本检查点尚不宣称通过。上游3751项等结果仍只按`BUILD-AND-MIGRATION.md`保留来源含义；迁移文档另列的其余构建模式不能在未执行时宣称通过。真实浏览器/GPU/Creator/业务API不包含在离线结果内。

当前既有Next仍保持1.3.172；本检查点没有部署173，也没有启动/重启daemon、Creator或Dashboard。05:27核对1779保护项、22原修改快照、172六文件及六备份均不变。只有本机验证通过并再次核对保护基线/并行修改后，才继续六静态部署；以旧index与旧hash资源精确回滚，不能用预构建ZIP替代本地验证门。AI资源链独立只读合同审计已完成，详见仓外`readonly-diagnostics-20261016.md`；未修改旧后端或Studio、调用模型/GPU或导入资源，其合同扩展另协调。

可恢复性：同步到全新独立路径，未覆盖原工程；本地Git检查点保留来源及治理适配。若放弃本机准备，保留目录及证据供Owner处置，不自动递归删除；不回滚旧后端、父仓索引、用户数据或共享服务。没有远端、push/tag或父仓gitlink变化。
