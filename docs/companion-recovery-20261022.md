# Companion 开机恢复与交付记录（2026-10-22）

## 运行事实

开机后旧PID1840不存在，32180无监听，原8工程完整。没有把源码合入当作运行生效。

在无daemon/无监听条件下，备份旧包、8工程登记、工具配置、Bridge登记、原生历史/锁与日志，并以SQLite只读backup API生成一致性快照。备份 `C:/Users/33272/AppData/Local/Temp/companion-boot-deploy-20261022`，quick_check=ok。仅更换daemon/CLI及map、host-package.json/product-build.json六文件，保留所有静态页、Bridge包和配置。

仅执行一次 `npm run start:next -- --no-browser`，未restart。入口先报未确认，不能据此视为进程没启动；随后一直只读追踪同一PID11604，最终正式32180 OPEN。后端真实产品版本0.3.142、build4376a5ec0845-acce4593a02e、entry SHA256 acce4593a02e50e90eac0045d6b7dd26e03da47cf4b9d8744d8bd728c734a915。启动保护按协议保留旧锁归档、接管写者；未手工改锁或构造Native退出证明。历史UNKNOWN原始journal逐字节未变，nativeEpochUnproven仍为2。协调库8表记录数与备份相同（operations713、dispatch345等）。

认证GET /api/projects、/api/version、测试工程 /api/art-spec/16ad921aa0fb06d6 均200，规范仍是原project-resource-config-v2。没有调用Creator动作、生成或写正式规范/素材。用户确认原页面可访问后，未再次启动或改变其浏览器标签。

## 实际前端发布

用户授权的完整维护源码已发布产品1.3.177，source/build 8aec67cc（完整提交8aec67cc2ad01fcdc80ef5b991d02219c482663f）。本轮完整源码4769/4769、vue-tsc和Vite构建通过。已接通获批美术规范的全局继承/项目设定/素材分类界面、持久化回执及新输入绑定；兼容旧v2，继续保留已发布添加流程、统一顶部和素材采集入口。

正式认证6静态资源全部200且hash一致。index SHA256 7ab0ec0481c2cf9145325741347567b54001d2ad640511e7b465d1de207ac76f。PID11604、epoch4b5a46e4-44f0-434b-952f-b3870736d9a9、8工程ID保持。没有重启、开窗口或刷新用户标签；原标签由用户下次刷新加载新包。

证据 `C:/Users/33272/AppData/Local/Temp/companion-live-release-177-20261022/deployment-verification.json`；原176静态完整备份在同目录previous-176。真实生成、参考图条件输入、Creator导入/UUID重读仍未完成；当前仍offline_import_only，不把界面和契约通过当完整业务验收。

## Serena

官方推荐uv tool install -p3.13 serena-agent；安装位于D:/tools/serena。Serena2.1.0、uv/uvx0.13.4、独立Python3.13.16。CLI版本与stdio initialize/tools/list验证通过，3工具、0调用、0项目激活、0网络监听。

配置C:/Users/33272/.codex/config.toml，只追加serena、context=codex，禁Web dashboard/GUI。备份同目录config.toml.before-serena.20261022T010944Z.bak。原三MCP与全部原内容逐字节保留；没有改PATH、权限、审批、安全或沙箱。独立保留证据在boot备份目录serena-config-preservation.json，握手证据D:/tools/serena/mcp-verification.json。

当前会话尚未加载Serena工具。可用客户端MCP服务重载入口；若无入口，在任务结束后由用户重新打开Codex客户端。未自动重启客户端/Windows或创建新任务。

## P9000

新增明确授权后唯一一次重试原被拒迁回操作成功：12限定目标及hook版本文件，共13文件。本地commit9daeb00000948d7f7733d1e639b4815254242a30，版本0.0.0.38，未push。原两个untracked build目录字节保留。53通过/1跳过、local-icons33通过、TS importer10通过、类型通过；完整Node243通过/76失败/8跳过，不能称全绿。

76失败分类：SQLite node-v141绑定缺失32、Windows双盘符路径14、self-media Skill缺失9、native图片写入/文本6、M7路径/断言6、receipt/hash4、其他5。22失败测试及其静态相对import闭包均未到达本次4项runtime；闭包内可与baseline比较的文件换行归一后相同。静态无关联不排除动态数据依赖；hash/文本/deep-equal/symlink等仍待专项核查，未证明76项全部为基线故障。可选baseline代表复现因Temp依赖junction失败未完成，不冒称复现通过。

完整证据 `C:/Users/33272/AppData/Local/Temp/studio-maintained-source-migration-20261022T011832Z/completion.json`、full-suite-failure-classification.json、failure-runtime-reachability.json。没有为失败更改全局hook、安装项目依赖或扩大修复范围。没有运行模型或真实生成。

## 按需启动问答（只读方案，未实施）

原3MCP均stdio：node_repl、cocos-creator-ant-cook-04c4cde2、cocos-creator-p1060-c16c7137；Serena为新增第4项。两个cocos包装器均指向现有creator-ai.js mcp，不直接配置HTTP URL。

cocos包装器已有首次实际调用时的ensure/discover/start共用32180逻辑，tools/list不等于宿主和Creator已启动。现有启动确认截止8秒，启动可能晚于此窗口；两个cocos命令形式不一致（一项显式node.exe、一项直接.js）。两项MCP配置本身也未携带start:next所加载的六项离线绑定，按需分支未调用那个配置加载器。Serena进程、MCP包装器、独立Companion宿主、Creator内Bridge是不同层次。

最小统一方向：标准node+相同wrapper；入口和MCP按需复用同一获批绑定与就绪确认；只启动/复用同一32180，不自动开Creator或模型，保留全部停机保护。这里只提供方案，未改cocos配置、自启动、Windows任务计划或运行进程。

## E/F

只读映射E=物理盘2、约1TB Toshiba DT01ACA系列、RAID控制器；F=物理盘3、USB通用型号。Windows未识别F介质，无Storage Spaces池或VirtualDisk。有限根/一级目录候选查询未找到两盘可比较的大型只读样本，未运行测速。用户随后确认F是NVMe移动硬盘，因此预期F随机访问明显优于E机械盘，实际顺序速度取决于USB链路；这是硬件判断而非实测。按用户补充立即停止后续探测，无磁盘写入或软件安装。
