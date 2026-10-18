2026-10-18 文案后续：本页所列保存/库存过时帮助已由b142600/.88修正并静态部署，41项定向、类型/构建、六HTTP哈希及真实页面文字核对通过；未重做业务验收。见[专项交付](owner-help-copy-refresh-20261018.md)。下文上一片“尚未改在线帮助”仅保留原时点。

2026-10-18 后续记录已从 original-cache-baseline.json 确认原库确切路径，完整备份与失败恢复方案见[原图片库备份方案](original-image-library-backup-plan-20261018.md)。下文“路径待确认”是上一片时点；本轮仍未访问原库或执行切换。

# 迁移收口分类与原图片库切换方案（2026-10-18）

状态：Accepted。基线 Next `0a93aeb` / 1.3.173.86；本轮仅只读源码核对及更新文档，未调用业务接口、读取用户图片清单/图片、取得缓存锁、切换缓存、重启服务或重跑保存/733库存验收。此前实机结果继续见 [验收矩阵](owner-host-acceptance-20261018.md)。进程号与733计数均为此前验收时点事实，本轮不重新宣称实时状态。

## “完整任务工作流未开放”的准确含义

这句话在此前Owner验收中专指**正式32180的图片审阅窄宿主**，不是说所有Companion任务都没有实现。正式宿主仅开放 state/capabilities/select/export及受控图片读取；`guarded_review_actions=false`、`candidate_import=false`。Next provider同样将workflow标为unverified，因而搜索、切历史、重试、停止、回收/恢复及候选下载保持不可用；预览/选择/保存独立有已验证能力。

证据：`src/adapters/companion-owner-review.ts:9–26`；原宿主 `../cocos-mcp/mcp/src/companion/owner-review-host.ts:146–156`；`bridge/picker_bridge.py:21–23,79–110`。不得仅翻转能力标志，也不能把guarded原桥的存在当作正式cookie路由已经开放。

| 分类 | 具体能力与现状 | 收口判断 / 最小后续 |
| --- | --- | --- |
| 旧迁移必需：原Companion任务与工程操作 | 原AI图标任务准备/历史/执行/选图/窄导入、安装、Creator/Preview/Profiler、预设持久操作已有原合同接线。96变体及本次Creator启动/Bridge库存只证明各自定向范围；不能推广到所有动作。 | 保留实现与未验收的区别。真实安装/客户端配置、其他生命周期、原生工程目录选择、预设持久并发、长时SSE仍按原矩阵列未验证，不因未实测再造新按钮。 |
| 旧迁移必需：知识Agent与同步 | Agent列表/单会话问答/本地重置和原逐来源同步演练/执行/状态已迁入，并已通过隔离测试和页面验证；真实问答/同步未做。 | 已实现但真实验收暂停，不再列作“缺按钮”。同步本身不等于模型调用，但当前明确禁止真实同步；不发送演练来试探权限。见 knowledge-agent-parity-20261018.md、knowledge-sync-parity-20261018.md。 |
| 既有图片工具的能力，需区别于旧Companion必迁 | 搜索、URL清单下载、历史切换、重试、停止、手动回收/恢复是原独立public-image-review已有能力。旧Companion初始四页不是该独立工具，现有Next曾保留其页面代码；正式B范围仅批准预览/选择/保存。 | 这些不是全新算法，也不能统称旧Companion漏迁。历史切换/恢复如要进入正式32180，最小需明确扩大原宿主固定动作白名单及provider，再核任务身份/锁/生命周期；不是纯Next修复。搜索/下载已有明确“不继续”边界。手动回收与自动回收也须分开；本轮均不开放。 |
| 暂停模型 | 本地模型启动/管理及真实生成、真实KB/Agent模型回答、Comfy提交/运行验收。真实Agent对话也可能写会话，不以列表可读推断可执行。 | 维持暂停，原UI代码/合同可保留；不启动模型、不调用实际问答，也不为验收改LAN/代理/凭据。 |
| 新增功能 | Codex会话产物自动回收/原始bytes读取、自动来源闭环、会话列表/创建/切换/删除管理、流式回答、后台自动回收或同步调度，以及原来没有的模型外开入口。 | 不属于恢复旧按钮。先明确实际artifact/API合同、Owner、来源/会话/工程绑定和作用范围；没有已核入口时不能扫描session日志、提取token或拿提示词冒充文件。现有人工PNG清单仅代表用户提供文件，不证明Codex来源。 |

前三类是需求归属，暂停/权限是执行条件：旧功能也可能处于“已迁入、真实验收暂停”；图片旧独立工具的未开放项也不能错误归入“需要模型”。Owner自身公开图片搜索原本不调用LLM，但仍在本轮禁止搜索/下载的边界内。

本轮未找到新的、已批准而缺少实现的纯Next业务动作。发现帮助/迁移页仍有“同宿主保存待合同/实机待验”的历史文字（`src/domain/product-information.ts:41,59`）；准确状态由本收口及验收矩阵纠正。它是可在后续静态交付时合并修正文案的纯Next项，不构成重新开放Owner工作流或操作用户缓存的理由；本轮未修改/构建/部署产品文件，不把文档更新声称已改在线帮助。

## 从隔离测试缓存切回用户原图片库：最小方案（未执行）

原图片库不是Creator AssetDB，也不是studio任务目录。原程序 `../public-image-review/app.py:163–167` 的默认根为 `Path(tempfile.gettempdir()) / "public-image-review"`；在当前用户默认Temp下通常为 `C:/Users/33272/AppData/Local/Temp/public-image-review`。默认推导不证明用户一定采用它，执行前仍需由原启动配置/已知来源确认准确绝对路径；本轮没有读取该目录内容、获取锁或用构造TaskStore来验证。

当前正式Owner使用任务Temp下 `directed-acceptance-cache`。宿主配置来自四个绝对路径环境变量 `CREATOR_AI_OWNER_PYTHON`、`CREATOR_AI_OWNER_BRIDGE_ROOT`、`CREATOR_AI_OWNER_REVIEW_ROOT`、`CREATOR_AI_OWNER_CACHE`（owner-review-host.ts:8–11），在daemon装配时固定，网页没有缓存热切换接口；只改启动shell的环境变量不会改变现有daemon/child。

1. 仅确认用户原缓存准确路径及是否已由独立Owner占用。若被原程序持锁，复用现有入口或按原流程正常关闭它；不删running.lock、不绕过锁、不强杀。需要保护的原缓存先按批准范围做快照/哈希清单。
2. 停止本页轮询/实时订阅，核对原drain全零且unknown为空，通过原guarded CLI正常停止当前daemon并确认owned child退出、lease释放；不在旧child运行时改变目标。此步骤会中断共享服务，执行时需协调窗口，但用户已有正常服务启停授权，不需新增安全权限。
3. 仍用原Python/BridgeRoot/ReviewRoot，仅把 `CREATOR_AI_OWNER_CACHE` 改为确认的原缓存根，用原CLI启动同一32180。配置只作用于该启动进程环境，不写客户端配置、不持久修改系统环境。由正式ui入口恢复现有浏览器认证，再显式连接图片服务；启动Owner是惰性的。
4. child按 `TaskStore(root,restore=False) → CacheLease → load_last() → ImageApplication` 打开原库（hosted_owner.py:49–58）。核对所显示的当前任务及图片来源后即可使用现有预览/选择/保存；先不切历史、不下载、不回收。不要把测试坏SHA样本复制进去。历史列表可在state中读取，但正式宿主的切换动作仍禁用。
5. 若要退回隔离库，先正常排空退出，再改回原环境值并原入口启动。原库启动恢复或后续选择/导出产生的变化不会因退回配置自动回滚；不得覆盖原库来伪装撤销。

### 是否迁移、覆写

**无需迁移或合并图片库**：当前原后端和schema同源，直接指向原根；不复制测试库、不把测试last.json/manifest写入原库、不改变原PNG字节，不做文件格式升级。它也不是只读挂载，不能保证零写入：

- `TaskStore.__init__` 会mkdir并检查application.json所有权；若指定空目录会新建标记，未知非空目录或junction拒绝接管（taskStore.py:31–45）。因此不能拿猜测路径试启动。
- `CacheLease` 会创建/打开running.lock并可能写入锁字节（291–309），这是正常互斥，不是删除回收机制。
- `load_last → load` 会把waiting/downloading标为失败、searching/downloading任务改interrupted，补默认字段/来源报告；按已持久化ready/trash状态修复图片/缩略图位置（必要时rename），再原子保存该任务manifest和last.json（49–52、100–147）。这是原程序的恢复写回，不是本轮新增迁移，也不能说“完全不覆写元数据”。
- 显式勾选会持久化selected；导出仍写原缓存的exports记录并写用户选中的输出目录。原导出文件同名不覆盖，且切库不等于导入Creator。

若用户要求**原库所有字节完全不变**，本方案不能满足；最小替代是经批准复制快照继续隔离使用，或者另立只读加载改动方案。后者涉及原加载合同，不能以放宽现宿主保护、只改前端标志来实现。

## 本轮交付边界

本轮仅修正当前文档对“未开放/未实现/未验证”的分类，未申请或扩大任何权限。保存三结果、真实733库存和原22/267项保护证据沿用0a93aeb以前验收；没有重复执行。没有真实同步/问答、安装、客户端配置、自动回收、模型、发布或推送。完整迁移仍不宣称全对齐。
