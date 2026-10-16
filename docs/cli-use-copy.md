# v148 按工程复制 CLI 文本合同

## 原始来源与真实两段

原文件：`.test-artifacts/v148-reference/source/source/web/src/cli-use-copy.ts`。

原 SHA-256：`a1dbbaa6e151f073b5a76318ada5606e5d378078d55415f6696f291645186899`。

`src/domain/legacy-v148-cli-use-copy.ts` 是上述已核实的自有项目文件的原字节副本，连同 CRLF 源码换行完整保留；没有改写、缩略、重排或补造原逻辑。此片只提供原弹板实际使用的两段：

1. `buildCliAgentPromptWithCommands`：按工程生成完整 Agent 提示词，文末附原四条检查命令。
2. `buildCliSkillInstallPrompt`：按工程生成完整九项 Skill 创建要求和结尾说明。

旧模块还包含帮助函数与 `buildCliSkillMarkdown`，仅为原字节完整性保留。它们不是本片的 UI 入口，也不增加为第三、第四个复制页。原帮助中过时的“四段”描述不能覆盖已核实的真实弹板行为。两段实际输出都使用 LF；源码 CRLF 不会改变 `.join("\n")` 的输出。

## 唯一 UI 接口

`buildProjectCliCopy(project: unknown): { agentPrompt: string; skillPrompt: string }`

只从 `ManagedProject` 形状中读取自身数据字段 `id`、`name`、`path`，不读取 accessor 或其他字段。调用方应把已有 Companion 工程登记结果传入；本纯函数不证明工程已登记、路径存在、Creator 正在运行或工程属于当前电脑。UI 只应导入 wrapper，不能绕过校验直接使用 legacy 函数。

校验通过后将三个值原样传给旧函数。没有 trim、大小写改写、路径分隔符替换、归一化或截断。真正的四行命令只有已验证的完整 ID 被插入；工程名与路径仅出现在说明文字中。`doctor` 原本不带项目参数，其余三行原命令使用完整 `--project <ID>`，不伪造旧行为。

## fail-closed 输入边界

- ID 完整匹配 `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`，最大 128 字符。额外检查完整匹配，末尾 LF 不能利用 JavaScript `$` 的边界语义通过。
- 名称 1–256、路径 1–4096 个 UTF-16 单元，必须包含非空白内容。控制字符（含 C0/C1）、Unicode 格式/双向/零宽字符、行与段分隔符、孤立代理项全部拒绝。
- 元数据中的反引号以及 `[]<>` 拒绝，防止穿过 Markdown 代码、链接或 HTML 展示边界。普通中文、emoji、空格、单引号、双引号、Windows 反斜杠保留。允许字符不是 shell 转义保证：名称和路径始终只是说明，绝不拼进执行命令。
- 只做词法上的绝对本地路径识别：单 `/` 开头的 POSIX 路径，或盘符加根分隔符的 Windows 路径（`C:\...` / `C:/...`）。拒绝 URL、相对/盘符相对路径、UNC 网络路径、Windows 设备命名空间、POSIX `/dev` 路径、Windows DOS 设备名与 NTFS alternate-stream 形式。不会访问、解析、补全或修复路径，不猜 Creator 所在机器。
- 缺字段、错误类型、数组、继承字段、accessor、任何非法元数据都拒绝整个结果。错误对象只提供 `CliCopyError`、固定 code `invalid-project` 与固定中文说明；没有原始值、cause 或诊断字段。UI 应显示固定错误，并以 Vue 文本转义显示原始登记字段供核对，不能静默改路径后复制。

固定错误说明：“工程登记信息不符合安全复制要求，请检查工程 ID、名称和绝对本地路径。”

## 动作与验证边界

这是纯文本生成。模块不联网、不读写项目文件、不安装依赖、不调用 shell/CLI、不注册 MCP、不启动 Creator、不打开 Agent，也不读取或复制任何凭据。Skill 文本中的“创建/写入 Skill”只是原提示词内容，本片没有执行其中的要求。额外登记字段（包括任何凭据字段）不会进入输出。

系统剪贴板复制由 UI 在用户点击后独立处理。文本就绪不等于复制成功；剪贴板成功不等于 CLI 可用、Skill 已安装或 Agent 已打开。两段内容必须用文本节点展示，不能用 `v-html` 或 Markdown 渲染器。

本片离线测试使用合成项目，核对 legacy 源字节 SHA-256、两段对原函数逐字一致、完整 ID、LF、九项要求、长度边界、quotes/spaces/Windows 路径、控制/双向/Markdown 边界、伪命令注入、固定错误与无关字段隔离。真实 CLI 执行、Windows 宿主、Skill 创建/自动触发、Agent 启动均未验证；不将这些状态描述为已通过。

## 弹板交互与取消的真实边界

工程卡只允许从当前真实登记列表打开；打开前后冻结并比较完整 ID / 名称 / 路径和同源 provider，首次渲染前目标变化也不打开。已打开后登记字段改变、登记删除、断开或更换来源会关闭旧弹板；相同字段的普通状态刷新不会误关。

两段超过五行默认折叠，换行和折叠仅为 CSS 显示，`writeText` 始终使用完整原文。所有动态字段用 Vue 文本节点，非法数据不静默清洗成另一个路径；只显示警告并禁用复制。异步剪贴板返回须核对 generation / context / source / alive，过期完成不显示成功。未决请求期间禁止同弹板的重叠复制。

系统剪贴板 API 没有取消能力。关闭或换工程能撤销提示，不能保证撤销已发出的系统写入；页面明确提醒粘贴前核对目标，并对未决时变化发出警告。本片没有 `location.assign`、外部协议按钮、CLI spawn、文件写入或注册请求。
