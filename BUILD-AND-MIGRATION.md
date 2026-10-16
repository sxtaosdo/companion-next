# Companion Next 1.3.173 完整源码迁移

源码提交：9db8b3af26982af7e9366ae03d865d8782f98a33

companion-next/ 是完整已提交树，共319个文件，保留源代码、测试、文档、package-lock.json及构建配置。没有node_modules、Git历史、缓存、构建产物、凭据或无关工作区文件。原172/173功能均包含；静态部署与源码迁移分开。

## 接收核验

先解压到独立新目录，不覆盖已有本地项目或用户修改。按SOURCE-MANIFEST.json校验全部319文件字节/SHA256，再选择后续本地开发仓库位置。SOURCE-COMMIT.txt记录来源提交；本包没有.git，不声称已有来源Git历史。已有目标仓库应先核status、保护并行修改，不能直接清空/重置。后续在该本地源码上开发，不要求重复下载云端ZIP。

## 构建

需要受支持Node/npm环境。现有依赖可用时直接使用；安装须遵守接收端权限，按锁文件npm ci，不做自动依赖升级。

npm test
npm run build
npm run build:companion-readonly
npm run build:companion-config-editor
npm run build:companion-knowledge-chat
npm run build:companion-workspace
npm run test:companion-static

正常工作区输出dist-companion-workspace，入口使用原合法同源会话 /next/index.html#/overview。单独静态Vite预览不提供业务API，不能据其404判断原服务失效。构建不自动部署；不要更改宿主认证、网络设置、账号或服务。

本提交已在dot验证89文件3751测试、五类型检查构建、56静态检查；独立复审3文件60测试通过。接收端需重新验证环境及关键回归，不能把这些离线结果当真实GPU/Creator/服务或浏览器验收。原未完业务见docs/migration-acceptance-current.md。
