# 工作区导航与静默刷新验收（2026-10-23）

本轮范围：静默轮询、真实用户菜单、层级面包屑、路由标签。仅同一32180，无Creator或模型操作。

## 来源与边界

参考 Cool-admin Vue 8.x topbar.vue、route-nav.vue、process.vue，MIT许可见src/login/COOL-ADMIN-LICENSE.txt。其整体并非已证实的Next原始模板。仅适配显示/布局，保留Companion Cookie七天会话，不引入另一套token或账号系统。Dev Tools不在生产开启。

## 本轮检查

- 后端身份接口：47项认证/HTTP/登录导航隔离测试通过，完整后端类型检查通过。
- 导航/知识库/帮助及问答组件：120项回归通过，包含工程query隔离、标签切换/关闭、真实身份/本机授权/旧宿主降级、失效身份清除、知识库已完成结果与输入跨路由保留。
- 静默读取/导航/知识库组合：230/230通过；额外工程上下文及标签58/58通过，另8项旧版配置区块测试不在该定向集内，未宣称全套通过。测试批次有重叠，不相加。
- 最终源码类型检查及前端构建通过。构建仍有既有单包体积提示；本轮未做代码分包。
- 构建拦截渲染和实际部署渲染分别14项通过，无pageerror，无页面业务写请求。覆盖9工程、身份、面包屑、路由标签、搜索条件、后台静默读取、知识库输入、美术未保存草稿、e2e工程query、页内任务标签不重复生成顶层标签、唯一选中态和600px布局。
- 真实HTTP的6个最终静态文件SHA256全部匹配；身份接口确认local授权类型。真实账号密码/注销/七天跨期本轮未操作，身份账号分支由隔离认证测试验证。

## 恢复与保护

原始检查点及工作区差异在本机 task/ui-shell-20261023；部署前记录实际身份、计数和工程ID，先完成完整备份与产物校验，预检成功后才允许正常停止。保留所有历史UNKNOWN、工程配置、认证缓存与并行修改。未操作用户密码或主动注销用户。

## 当前实际生效

唯一地址 http://127.0.0.1:32180/next/index.html ，前端1.3.186，构建f7ca6be8+working（保留先前未提交登录验收文档，因此如实带working），后端0.3.147，构建af1d77c827b4-38b1f7c5abf9。

先完成逐文件备份和SQLite online backup（integrity_check=ok），再正常停止PID9264；确认进程及端口退出后替换12文件。原npm start -- --no-browser返回LOCAL_START_FAILED，但核实实际已成功启动PID1692/OPEN，因此没有重复启动。最后6个静态文件更新不再重启服务。认证18001仍原PID23848、版本0.1.0.25；9工程全部保留，历史nativeEpochUnproven=2保留，当前活动计数为0。没有Windows重启、模型/Creator操作或正式规范保存。

## 复验发现并修复

初始未解析的根路由不建空标签；美术页内图标/UI/人物类型共用本工程的顶层标签但保存最新完整目的路由。有效同源同路径工程重复选择不再短暂解绑，避免返回后规范入口消失；来源/路径变化仍按原规则失效，无效目标明确不可用。

## 证据和回滚

本机 C:/Users/33272/Documents/Codex/2026-10-17/task/ui-shell-20261023：final-tests.json、context-tests.json、live-render.json、http-hashes.json、live-state.json、build-evidence.json、final-static-hashes.json、stop-receipt.json。before-installed及before-data保存更新前文件/配置/历史和一致性库备份；before-static-final保存最后静态补丁前文件。回滚须正常停止同一后台后按deployment-plan.json恢复对应原文件并普通启动；不自动恢复数据覆盖用户新改动。当前没有回滚需要。

## 未覆盖边界

本轮未对用户账号实际密码登录、主动注销或真实Creator/模型动作进行验收，不代表资源生成链路新验收。额外creator-operations-ui历史停止文案断言仍与已批准“停止已受理 · 待核对”不符，未掩盖或计入本轮通过数。所有真实业务动作仍须经同一后台UI。
