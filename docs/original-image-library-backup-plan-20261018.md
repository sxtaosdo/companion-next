2026-10-18 用户最新决定：原图片库均为本任务临时测试数据，无需备份或恢复。取消备份、切回及相应审批待办；继续使用当前已验证任务缓存，旧库不删除、不迁移。原库未切换仅为来源事实，**不是用户阻塞或迁移缺口**。本轮只改文档，不重跑测试、不部署或重启。

# 原图片库确切路径、备份与失败恢复方案（未执行）

状态：历史方案已取消，不执行、不待审批。2026-10-18，基线348ad5b/.87。本轮从既有本机记录确认，未枚举原库、读写原图片/清单、创建TaskStore/lease、执行load_last或切库。

## 已确认的目标

原库确切绝对路径：`C:/Users/33272/AppData/Local/Temp/public-image-review`。

不是仅由默认Temp推测：已有 `C:/Users/33272/AppData/Local/Temp/companion-client-owner-20261018/original-cache-baseline.json` 明确记录 source 为该路径、copy 为当次隔离副本，记录41文件、10200818字节及逐文件SHA256；同目录 `owner-original-protection.json` 记录originalCacheFiles=41、allOriginalBytesUnchanged=true、ownerSourceUnmodified=true。记录文件SHA256分别为 `2c20ea8bbe9e3344bdc5da30c5cf586df897843d0f3cebcb5752875976ba8d39`、`3cb6bdb63a6bbd9f1f36fbd08a1c7d50cc457611ae20605867cfcb451419ca76`。这是既有来源证据，不声称此刻仍只有41文件；若执行前目录不存在/所有权不符，应停止，不能创建新库冒充原库。

当次 `owner-cache-copy` 已为验收修改过活动任务，**不能作为整个原库的恢复备份**。原库本身位于Temp，不能把唯一备份也放Temp。Git不跟踪这些缓存，Git reset/revert不能恢复它们。

## 待批准的完整备份

建议新备份目录：`C:/Users/33272/Documents/Codex/2026-10-17/task/backups/public-image-review-before-switch-20261018`，其中 `cache/` 为完整原库快照，`manifest.json` 存全部相对路径、文件长度、SHA256、目录清单及可保留的mtime/属性；`context.json` 仅存原缓存路径、原隔离缓存路径、四个非秘密启动路径值及daemon身份/关闭回执，不存cookie/token。若目录已有任何内容则停止并另取新名，绝不覆盖。备份不运行任何应用，也不自动上传。

批准后依次执行（本轮未执行）：

1. 先正常排空并关闭所有使用这两个库的Owner实例及对应正式宿主，核对原drain和unknown、child退出及lease释放。若原库被另一个独立程序持锁，先识别并正常结束它，不能删锁/强杀/读一个仍在变化的库来当稳定备份。锁文件存在本身不证明有人占用；也不靠PID猜测直接删锁。
2. 确认精确源目录存在且不是junction/symlink；备份目的目录新建且在上述task/backups之下。递归只复制原库全部文件及目录，不过滤扩展名，包括application.json、last.json、cooldowns.json、running.lock、所有32hex任务目录的manifest.json、原图.image、缩略图.thumb.jpg、trash/、现存.tmp及未知附属文件。遇到链接、读失败或文件变化停止，不跟随链接，不漏掉文件继续宣称成功。保留时间/属性，并记录空目录；不复制Windows ACL或扩大安全权限。
3. 对源与备份的每个文件读字节计算SHA256、核对长度/路径集合；在停机状态再次核源集合及哈希一致，写出完整manifest，再核备份自身。只有全部一致才允许下一步。**这一步需要读原图片字节并写本地完整备份，故只作为待批准方案，本轮没有执行。** 锁文件的普通字节可备份，但OS锁状态不能备份，也不应恢复为“仍在运行”。
4. 备份校验完成后，保持其他三个Owner路径不变，仅把本次启动进程的CREATOR_AI_OWNER_CACHE指向上述确切原库，再按原CLI启动32180、恢复认证、显式连接Owner。不写系统持久环境或客户端配置，不复制/合并测试库，不删除隔离坏SHA样本来掩盖来源。首次仅核连接/最近任务，暂不勾选、导出、切历史、下载或回收。

## 原启动可能改变的具体文件和位置

源码依据：原 `../public-image-review/taskStore.py:31–45,49–52,100–147,291–309`；Next `bridge/hosted_owner.py:49–58`。启动没有新格式迁移，也不会运行搜索/下载，但会执行原恢复逻辑：

| 位置 | 原行为 / 潜在变化 |
| --- | --- |
| 根application.json | 已有标记只核所有权；空库会建标记，未知非空库拒绝。方案要求原根必须已存在，避免误建。 |
| 根running.lock | 以a+b打开，空时写1字节，取得OS独占锁；正常退出释放句柄，原逻辑不承诺删除文件。 |
| 根last.json | 读取其中任务ID；成功load后用原子JSON保存同一活动任务ID，文件字节/mtime可能变化。 |
| `<task-id>/manifest.json` | 只恢复last指向的任务：waiting/downloading图片置failed，searching/downloading任务置interrupted；补source_ids、mode、逐图片来源和来源报告计数等；保留原错误/失败含义，随后原子写回。不自动遍历恢复全部历史任务。 |
| `<task-id>/<image-id>.image` 与`.thumb.jpg`，及同任务trash/下对应两文件 | 清单状态ready时：目标是任务根；若目标不存在而trash有对应文件，则从trash移动回任务根。清单状态trash时方向相反：从任务根移到trash。仅目标缺失且备用存在时rename；不是覆盖已存在目标，不涉及用户已导出目录。文件缺失会把该图片标failed。 |
| `<task-id>/<随机uuid>.tmp` 与根`<随机uuid>.tmp` | atomic_json先以x创建同目录随机临时JSON，再os.replace到manifest.json或last.json；正常finally删该次临时文件，崩溃可能留下它。失败可能已部分写回，因此不能承诺失败无变化。 |

ImageApplication还会读取该库cooldowns等状态；启动链没有主动调用搜索/重试/导出/回收的动作。后续若显式勾选或导出，还会改变selected/exports清单并向用户选定的库外目录写文件；本最小切换不执行这些动作，备份仅覆盖缓存根，不覆盖任意导出目录。

因此准确风险是“原恢复程序会覆写少量缓存元数据，并可能在同一任务根与trash之间恢复文件位置”，不是“迁移全部图片”或“只读连接”。启动期间若JSON/图片异常、源被占用或原子替换失败，应停止，不重试写、不绕过原保护。

## 失败后如何恢复

1. 先正常关闭本次Owner及32180并确认无handler/busy/worker、child已退出且锁释放；未排空或身份未知时停止恢复，不对活动库拷贝覆盖。
2. 验证备份cache/全部文件与manifest完全一致。把当前可能已恢复写回的原目录保留为同父目录新名字 `public-image-review.failed-switch-20261018-<UTC>`，不删除；执行前解析最终绝对路径，确认两个路径均在同一用户Temp根且不含junction，目标必须不存在。目录移动也是待批准恢复动作，不在本轮执行。
3. 从备份cache/复制到原父目录一个新的staging目录，完整核路径/长度/哈希/空目录及可保留的mtime/属性，核对后重命名为精确原根 `public-image-review`。这样整库恢复，不合并覆盖新旧manifest/trash，不借Git恢复。备份保持不动；失败现场另存，不先清理。
4. 原库恢复后先不再次启动它，否则load_last可能再次产生同样恢复写回。把daemon启动环境改回原任务隔离缓存，通过原CLI恢复服务/认证；原库保持与备份一致，等待查明问题。独立Owner如要重新使用原库，需在后续明确恢复窗口正常启动。

复制普通文件不保留原文件ID、ctime或OS锁状态；方案保证内容和目录结构可验证恢复，时间/属性尽力保留，不能声称所有文件系统元数据逐位相同。任何库外新导出不在此回滚范围，首次切换不做导出即可避免这个额外范围。

## 用于一次请求批准的精确范围

“将正式图片审阅缓存从当前任务隔离库切到 `C:/Users/33272/AppData/Local/Temp/public-image-review`。先正常停止相关持有者，把整库读出、复制到上述Documents/task/backups位置并逐文件SHA核验；然后只改本次daemon启动环境的缓存路径并正常启动。接受原load_last改写最近任务manifest/last、补中断状态，以及按清单在该任务根与trash之间恢复原图/缩略图位置；不搜索/下载/回收/导出/调用模型，不安装或改客户端配置。失败时正常停机，保留失败整库，按完整备份恢复原路径，再退回任务隔离缓存。”

这是具体待批准方案，本轮没有执行备份、切换或失败恢复，也没有读取原图片字节。此前服务启停授权不等于已批准接管和写回用户原库。
