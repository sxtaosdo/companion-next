# 依赖版本与审计

本工程复用官方库，没有自建组件库。依赖均从 `https://registry.npmjs.org` 安装，使用 `--ignore-scripts`。

## 参考组合与最终版本

| 依赖 | 参考 / 首轮版本 | 最终锁定 | 原因 |
| --- | --- | --- | --- |
| Vue | 3.5.18 | 3.5.43 | 同 3.5 系列补丁，修复 server-renderer 公告风险 |
| Element Plus | 2.10.2 | 2.11.1 | 修复 el-link href 校验公告的最小已修复 minor |
| Pinia | 2.3.1 | 2.3.1 | 保留验证组合 |
| Vue Router | 4.5.1 | 4.5.1 | 保留验证组合，使用 hash history |
| Vite | 5.4.19 | 6.4.4 | 5.4 修订无法清除当前路径读取公告链；选择兼容 plugin-vue 5.2.4 的 6 系列修订 |
| Vitest | 2.1.9 | 4.1.11 | 清除旧 UI/mocker/tinypool 公告链，兼容 Vite 6 |
| TypeScript | 5.8.3 | 5.8.3 | 类型检查通过 |
| vue-tsc | 2.2.12 | 2.2.12 | Vue 类型检查通过 |

运行环境 Node.js 24.19.0；项目建议 Node.js 20.19+。没有运行 npm 自动强制修复，也没有升级系统 npm。

## 审计结果

2026-10-11，针对锁文件执行：

```bash
npm audit --json --registry=https://registry.npmjs.org --cache=/tmp/companion-next-npm-cache
```

- 首轮参考组合：8 项，包含 2 critical / 3 high / 3 moderate
- 最终组合：0 项（critical/high/moderate/low/info 均 0）
- 最终锁树统计：264 项（prod 53、dev 212、optional 54，分类有重叠）
- 更新时 npm 报告：新增 9、移除 8、更改 29 个包

这是 registry 在该时间点的已知公告审计，不是“绝对安全”保证。此项目仅做本地构建和只读原型；没有运行 Vitest UI server、放开 CORS 或公开监听。

相关公告来自 npm audit 返回的 GitHub Advisory Database：

- Vue renderer: https://github.com/advisories/GHSA-g2v6-rqmx-r4w6
- Element Plus link: https://github.com/advisories/GHSA-5m5x-9j46-h678
- Vite filesystem paths: https://github.com/advisories/GHSA-fx2h-pf6j-xcff
- esbuild development server: https://github.com/advisories/GHSA-67mh-4wv8-2f99
- Vitest UI: https://github.com/advisories/GHSA-5xrq-8626-4rwp
- Vitest mocker: https://github.com/advisories/GHSA-82fw-gwwq-j7x9
- Tinypool: https://github.com/advisories/GHSA-5gmw-xhrv-c9v3
