# Windows本地开发交接

状态：Accepted（Owner已批准完整源码同步、独立本地开发及Git基线；新增依赖下载须先向Parent报告范围）。

本目录为Companion Next独立前端源码，与独立游戏运营后台分别维护。当前只接收既有1.3.173功能，没有重做功能、改旧后端或控制共享服务。

## 来源与文件边界

来源完整包`companion-next-1.3.173-complete-source.zip`，1313261字节，SHA256=`b4dc893ddaab276ef8fd95c2eb35d82a4f1597affe8b6b6f03e1659d0ad2b477`；Library `libfile_bbf510fb90948191afc351ff85cfd1db`/version0，来源HEAD=`9db8b3af26982af7e9366ae03d865d8782f98a33`，产品版本1.3.173。正常浏览器会话下载，未读取认证材料。

04:56 UTC导入时319份来源文件及3份迁移元信息全部逐文件校验字节/SHA256并回读；不含Git历史。原清单`SOURCE-MANIFEST.json`和`SOURCE-COMMIT.txt`原样保留。之后仅在README增加本地版本与状态入口，并增加本文件、VERSION、标准scripts/git_version.py及两项.githooks；package/lock/业务源码均保持来源字节。初始Git提交是本地导入检查点，不是来源提交本身，不能声称保留原Git历史。旧Downloads快照及既有后端未改。

## 环境与待批准补包范围

采用已存在Node22.23.3：`D:/code/shidai3/P8000/dual-game-build/node_modules/node/bin/node.exe`，配套物理npm11.6.2入口`C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`。不改系统Node/PATH，不共享其他项目node_modules。

锁文件v3有264个package记录，当前Win32-x64适用214个；npm本机完整性缓存命中110，缺104（102必需、2可选）。缺包均为`registry.npmjs.org`的已锁定tarball；逐项版本/URL/integrity清单在`C:/Users/33272/AppData/Local/Temp/companion-next-1.3.173-source-sync-20261016/dependency-download-scope.json`，缓存审计在同目录`dependency-cache-audit.json`。尚未取得这次新增下载判断，故未联网补包或执行npm ci。拟获准后按原package-lock执行项目本地`npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org`，不升级锁、不全局安装、不运行依赖安装脚本。当前无法据缓存数量推算准确下载字节。

本地Git使用P0002四段版本合同，前三位沿用批准的产品1.3.173，本仓W独立递增。Hook和VERSION由本仓维护；脚本从工作区标准实现复制，仅适配首次unborn HEAD。Hook默认python3；Windows已有python3为Store别名，本轮仅在提交进程中设置`COMPANION_NEXT_PYTHON=C:/Users/33272/miniconda3/python.exe`，不修改全局配置或PATH。

## 验证、部署与下一步

来源哈希核验已完成；本机npm依赖安装、3751测试、类型检查、五构建及静态检查均未执行。上游结果只按`BUILD-AND-MIGRATION.md`保留来源含义，不能算本机通过。新增补包获准后执行该文档七条命令；五种build均含类型检查，静态检查为独立测试，不是第六种构建。真实浏览器/GPU/Creator/业务API不包含在这些离线结果内。

当前既有Next仍保持1.3.172；本轮没有部署1.3.173，也没有启动/重启daemon、Creator或Dashboard。只有本机验证通过且原保护基线/并行修改仍相符时，才继续既定六静态文件部署；以旧index与旧hash资源作精确回滚，不能用预构建ZIP替代本地验证门。

可恢复性：同步到全新独立路径，未覆盖原工程；本地Git检查点保留来源及治理适配。若放弃本机准备，保留目录及证据供Owner处置，不自动递归删除；不回滚旧后端、父仓索引、用户数据或共享服务。没有远端、push/tag或父仓gitlink变化。
