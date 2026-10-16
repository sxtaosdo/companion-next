# 只新增 `next/` 的离线静态候选

## 0.1.13 当前候选说明（2026-10-14）

下文2026-10-12批准仅记录旧候选历史，不能视作当前v150替换/部署授权。当前只做dot构建；新的原宿主web/next目录部署仍待独立确认。旧web文件与现场manifest存在不一致，消费者不得覆盖或修复它们；由父任务协调当前身份和路径核对。旧0.1.4 Library静态包保持原字节。

0.1.13只读模式能力缩小至[明确读取清单](passive-readonly-013.md)：工程状态/发现与知识CLI探测不注册或不发请求，AI仅配置文件读取而不执行参考Python。`next/`实际文件数量以本次生成清单为准，禁止沿用旧六文件结论。入口保持`/next/index.html#/projects`；页面所用`/api/...`必须由同一宿主提供，Vite/纯静态preview无法代替。

此流程只在 dot 生成候选文件与校验清单，不安装依赖、不启动服务、不部署 Windows。待批的 4 个旧锁定编译 / 类型包不参与这个前端构建。Library v6、Windows 消费 v5 和旧版活部署均保持原状。

后续批准状态：2026-10-12 Owner 已明确同意这4包和旧webRoot仅新增next的冻结例外。4包的隔离语义检查另记 `companion-runtime-binder.md`，不改变本静态候选的字节或前端依赖。本页下文“待批准”是准备时的前置条件；现已满足授权条件，实时运行身份 / 原哈希 / next缺席 / 路径检查仍必须由消费者执行，不能据此直接假定现场安全。

## 为什么需要独立构建

现有 `build` / `build:companion-readonly` 的 base 是 `/`，其 HTML 和关于页图片引用根 `/assets/`。直接把 `dist-companion/` 复制到子目录会引用错误位置，不能部署该产物到 `next/`。

```bash
npm run test:companion-static
npm run build:companion-static
```

新命令先进行 Vue / TypeScript 检查，再复用现有 Vite，以 `--mode companion-readonly --base ./` 构建。每次在 `.test-artifacts/companion-static/candidate-<uuid>/` 建立全新目录；不接受外部目标参数，不清理或覆盖已存在目录，也不改变 `dist/`、`dist-companion/`。失败候选保留在 ignored 目录，未通过校验时不生成成功清单。

产物结构：

```text
candidate-<uuid>/
  STATIC-ADDITIONS.json     # 消费 / 校验说明，不部署到 webRoot
  next/
    index.html
    favicon.svg
    assets/                # 预编译 JS、CSS、原关于 SVG / 二维码 PNG
```

明确入口为 `/next/index.html#/projects`，知识查询为 `/next/index.html#/knowledge`。不能使用 `/next/` 期待自动索引。所有前端静态资源留在 `next/`；API 仍使用原来的根 `/api/...`，没有代理或新的凭据处理。固定 Companion 构建身份及精确 `http://127.0.0.1` 注册条件不变，页面挂载不会自行连接业务服务。

## 已核源码支持和现场边界

原 v148 `http-server.ts:289–295,817–839` 仅把 `/` 映射为 index，其余非 API GET 在 webRoot 内按文件读取；`.html/.js/.css/.svg/.png/.ico` 均有原 Content-Type。不存在 Picker 的固定静态文件白名单，也没有在这个 HTTP 类中添加 CSP。子目录路径仍经过原鉴权与路径检查，不需新增路由、改 Cookie / Host / Origin、放宽 CORS 或重启后台。

2026-10-12 父任务现场只读核验报告：磁盘 v148 / f6dcac8 的六个旧 Web 文件、daemon 与 package 匹配其已核 manifest，已列外围文件中未发现额外目录拒绝或整树签名。此报告不能证明未来升级 / 恢复一定保留新增目录。源码普通 build 会重建其输出 Web 目录，现场独立 deployment 的后续升级行为另有边界。

原部署合同禁止直接修改活部署，因此新增 `next/` 也是需要明确冻结例外批准的部署变更。目前只准备 dot 候选；不能把“未覆盖原文件”说成“完全未改部署”。运行实例身份必须执行时通过受支持入口重新确认，不能沿用历史 PID；现场 CIM 读取失败也不能被旧记录替代。

## 清单校验范围

- 每文件精确字节数和 SHA-256，排序路径，完整文件集合，静态引用关系。
- 只允许 `next/index.html`、`next/favicon.svg`、`next/assets/` 下受限扩展文件；拒绝绝对路径、反斜杠、`..`、URL 编码、Windows 盘符 / ADS / 保留名、查询 / fragment、大小写冲突、额外 HTML / map / JSON / 隐藏文件。
- `lstat` 检查根、父层、子目录与叶文件；拒绝 symlink、dangling link、hardlink 与非普通文件。最终 Windows 消费还必须检查实际 reparse points；dot 离线测试不代替 Windows 路径检查。
- 使用现有 jsdom 的不执行 / 不加载模式解析 HTML，限定当前 Vite 入口的标签与属性和单个外部 module，拒绝 inline script / 事件 / style / 重定向。现有 TypeScript AST 检查 JS 字面量 import / `import.meta.url` 图片；HTML 和 CSS 文件资源解析到本清单，CSS 禁止 `@import`，内联 data 与 fragment 资源保留原有行为。SVG 另固定两份已审源字节 SHA，不扩为任意 SVG 可信证明。原关于 SVG / PNG 字节不变。
- `verifyStaticCandidate(nextDirectory, manifest)` 只读重核文件增删改、路径政策及引用。清单不具签名或凭据作用；消费者还需从已确认交接核清单本身 SHA。
- 这是受控 Vite 产物的字面量静态引用检查，不是任意 JavaScript 审计器、浏览器渲染测试、CSP 证明或后端只读权限隔离。
- 构建前后记录 Git HEAD 与脏状态，两次均干净且 HEAD 相同才记 clean。候选构建假设本工作区无并行写者；不是抵抗并发替换目录或恶意修改源码的部署器。已批准的安装依赖未变化。

## 待批准后消费者必须执行的检查

1. 核当前运行版本 / 身份和旧文件原始 SHA，任何漂移先停；只使用实际定位的 webRoot。
2. `next/` 必须不存在，含已有空目录或 dangling link 都不能合并覆盖；目标祖先路径不能是 symlink / reparse point。
3. 候选按交接清单核完整集合、大小、SHA；清单在外留存，只复制六个列出的新文件到新增子目录，再逐字节复核。此脚本未实现复制功能。
4. 沿原 `creator-ai ui` 支持入口或已登录原页面使用会话，不读取或转移 Owner token / Cookie，不用 `npm start` 重启后台。
5. 原会话权限不变。只读由已审查前端固定 API 行为限制，不是服务器新建的只读身份。原状态查询可能产生诊断日志，知识查询使用原后台既有身份与配置。
6. 真实浏览器验证相对资源、原关于图片、菜单、工程 / 日志 / calls、知识查询与失败提示。无实际数据时保留未知，不以空实例结果冒充旧数据。
7. 回退只针对本次新增且当前 SHA 仍匹配的文件 / 目录；发现后续编辑先停，不能删除、覆盖或回退任何原文件、会话、数据、pin 清单或进程。

未来升级或恢复若清理 `next/`，需重新确认版本 / 原合同后再装配，不能默认保留或自动重装。真实部署与浏览器验收仍待批准及独立消费证据。
