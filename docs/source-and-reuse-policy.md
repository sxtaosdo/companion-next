# 来源与能力复用规范

适用范围：Companion Next 的开发、修复与交付。按用户 2026-10-22 指令建立；本文件是来源边界与能力复用原则的权威正文，执行约束仍以项目 AGENTS.md 为准。

## 已核实来源与适用边界

| 对象 | 来源与证据 | 适用边界 |
| --- | --- | --- |
| 原 Companion | [sxtaosdo/cocos-mcp](https://github.com/sxtaosdo/cocos-mcp) | 旧 Companion 宿主、CLI 和旧 UI 的上游；不能据此认定 Next 使用了某个第三方后台模板。 |
| Companion Next | 完整源码 ZIP `companion-next-1.3.173-complete-source.zip`；来源提交 `9db8b3af26982af7e9366ae03d865d8782f98a33`，319 个源码文件 | 导入包未携带 `.git` 历史或 remote。导入清单记录的来源提交，不等于本地 Git 可访问的上游历史；本地初始提交仅为导入检查点。 |
| 独立运营后台 game-ops-admin | [Cool-admin Vue 8.x](https://github.com/cool-team-official/cool-admin-vue/tree/8.x) 与配套 [Cool-admin Midway 8.x](https://github.com/cool-team-official/cool-admin-midway/tree/8.x) | 属于另一套运营后台。其登录或组件能力不能写成 Companion Next 已有功能，也不是已证实的 Next 模板来源。 |

来源证据以 [导入记录](../LOCAL_DEVELOPMENT.md)、[原始提交记录](../SOURCE-COMMIT.txt) 和 [文件清单](../SOURCE-MANIFEST.json) 为准，不改写原始导入元数据来描述后续版本。

2026-10-22 的有限溯源检查未在 Next、cocos-mcp、shidai3 三个本地仓库找到上述来源提交对象，也未从已检查的初始目录、README、许可归属及可用项目记录确认第三方后台模板地址。这是当前证据边界，不代表证明历史上从未使用模板。没有新增证据时必须标为“来源未确认”，不得把相似外观或依赖列表当来源证明。[依赖记录](dependencies.md) 说明所用库，不证明存在可直接恢复的整套登录模块。

## 开发顺序：先查已有能力，再补缺口

1. 先检查当前系统、上游和已有依赖的实际接口、配置、组件与官方使用方式，区分真实实现、演示 mock、未接线和缺失能力。
2. 能通过现有配置、组件复用或接口接线解决的，优先使用；保留已有用户流程、认证和权限边界。
3. 只有证实已有能力不足后才新增最小代码；在任务记录或变更说明中写明查过什么、具体缺口、为何配置或接线不能解决，以及验证方法。
4. 不为“复用”引入无关整套系统，不重复建设已存在的状态、存储或认证机制；需要额外依赖或扩大功能、权限时，按用户授权范围先提出具体方案。
5. 以实际行为验证接线结果。源码合入、构建成功、运行进程已加载和真实页面验收分别报告；模拟测试不能替代真实流程验收。

## 当前认证工作的复用边界

The current approved browser login reuses the existing Cool-admin/Midway authentication provider. Companion adapts its existing Cookie session; it does not implement password hashing, copy signing keys, initialize an account database, or create accounts. The original Companion CLI authorization remains compatible, but a terminal-command guide is not the requested browser login experience.

Only explicitly allowed existing usernames may enter Companion. The allowlist defaults to empty; there is no default admin or automatic access for all operations accounts. Credentials and provider access tokens remain server-side and are not logged or persisted in browser storage. Session expiry, provider revocation, Host/Origin rejection, and business permission errors remain distinct. Writes are never automatically replayed.

The approved provider address is loopback port 8001. A port conflict does not authorize stopping its owner or changing network/security configuration. An alternative port requires approval. Provider login retains its existing per-user token-cache behavior; Companion logout removes only its own browser session and does not invoke provider-wide logout.

## 运行与交付证据

部署前重新读取当前实例身份、版本、健康状态及正常维护条件。此前 `nativeEpochUnproven=2` 阻止正常停止是历史观测，不能不经核验当作当前状态，也不能因机器重启就假定已经消失。

优先使用现有正式启动和维护流程。复用或修复不构成清除 UNKNOWN、伪造退出证明、绕过门禁、强杀或更改安全权限的授权。遇到无法安全应用的修改，应明确区分已完成源码与未生效运行产物，报告精确阻塞。
