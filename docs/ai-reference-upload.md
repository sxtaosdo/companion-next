# 原工程参考图选择与上传（Next 0.1.10）

## 页面流程

在原 AI 图标的同一个配置编辑弹窗选择本地图片，先在 Canvas 查看，再单独勾选这次上传确认。普通、Picker、只读构建只允许本地选择/预览；上传 provider 仅在独立 `companion-config-editor` 模式注册。该构建仍只有 dot 源码/fake测试授权，没有实机部署和真实项目上传许可，不在先前六个只读静态文件的部署例外内。

- 只接收静态 PNG、JPEG、WebP，文件 1 字节至 4 MiB，每边 1–4096，总像素不超过 16,000,000。4096×4096 超出总像素预算。
- 文件容器、CRC/边界/帧标记、EXIF 方向尺寸和实际 SHA 预检之后，必须再通过本地 `createImageBitmap` 解码。没有此能力、解码或 Canvas 失败就不允许上传，不降级为外链图片。
- 缩略图使用 Canvas，不创建 Blob/data 图片 URL，不访问第三方图源，也不修改 CSP。Canvas 展示不是裁剪，不改变上传原字节。结构检查和合成解码测试不能证明实际图片质量。
- 用户可核对当前完整工程 ID/名称/路径、原文件大小/尺寸/SHA及预览。换文件、改表单、切工程、撤销 provider、关弹窗或离页都撤销原确认。只读模式不因选择图片获得写入能力。
- 成功回执只能把原后台返回的相对路径附入同工程仍有效的配置草稿，最多四条、不重复。配置摘要仍是已读版本；需要用户另行查看差异、勾选并保存配置。上传不准备、生成、采用或导入图像。

## 两份文件与隐私边界

v148 `IconImageAssets.uploadReference` 先保存上传原字节，再保存 CPU 归一化 PNG。原文件可能保留 EXIF、拍摄位置、ICC 或文字等元数据；另存去元数据 PNG 不会清除原文件里的信息。确认前页面明确提醒核对内容、来源与使用权限。

原后台 `ImageOps.exif_transpose` 校正方向，再创建新 RGBA 画布去除 EXIF/ICC/文字等元数据，输出 PNG。前端只核回执的路径、SHA、类型、方向后尺寸，没有拿一次合法回执就宣称真实像素/去元数据效果或风格验收通过。

真实上传会写当前工程：

- 原图：`art/reference/companion/original/<原字节SHA>.<png|jpg|webp>`
- 归一化图：`art/reference/companion/<PNG字节SHA>.png`

服务沿用原路径安全检查和独占文件创建，不接收任意输出路径、不覆盖不同内容的已有目标。两次持久保存不是一个可原子回滚的操作：后一步失败时原图可能已保存，不能提示“没有写入”。本前端不删除这些文件或假称关闭弹窗已撤销上传。

## 已核请求与回执

来源为已批准自有 v148 `icon-image-assets.ts`、`icon-adapter.ts`、`http-server.ts` 及旧 `ai-icons-page.ts:362–393`，没有新增第三方代码或依赖。

唯一操作是原同源 `POST /api/icons/{16hex}/reference-upload`，正文严格 `{base64, approved:true}`。仅显式逐次确认后生成 approved。上传仍由原宿主 Cookie/Origin/Host/授权处理；前端精确 loopback 检查不是认证或部署批准。不读取、复制或保存 Cookie/token，不使用代理、Bearer、跨域/CORS。

仅 HTTP 200 的八字段完整回执可接受：`schemaVersion, relativePath, sha256, width, height, mimeType, originalRelativePath, originalSha256`。回执无 projectId，因此还必须保留请求所属完整上下文。两条路径与各自 SHA 完全绑定，原 SHA、扩展名和方向后尺寸必须匹配实际发送字节。

固定传输预算为请求 6 MiB、响应 8 KiB、最多 4096 响应块、20 秒；禁止重定向、缓存和自动重试。构造/注册 provider 不联网。

## 失败、保护与恢复

- 明确写前拒绝才标 rejected，401/403 保留原认证含义。`IMAGE_INPUT_LIMIT`、`IMAGE_PATH_UNSAFE`、`OVERWRITE_FORBIDDEN`、`IMAGE_WRITE_UNCONFIRMED` 等可能发生在持久保存阶段，不能泛称未写入。
- 网络失去回执、超时、坏回执、未知服务错误都保留 UNKNOWN；原文件或归一化 PNG 可能已写入。没有虚构“查询上传成功”API，也不凭本地预览或缺响应重试。
- 发送前建立有界 sessionStorage 记录，以项目和原字节 SHA 防重复；没有图像 base64、原文件内容、会话 Cookie 或 token。记录包含完整工程身份及必要恢复回执路径，供核对。存储不可用/损坏/写入后读回不一致时禁止新上传。
- 成功回执也保留，避免重选同一文件产生重复请求。回执无法附入旧草稿时仍保留其原工程身份，返回原目标后需要明确附入；实际重载后仅提供路径供人工核对，不能凭持久 JSON 自动取得旧内存权限。
- 本地清选图不清操作保护。没有一键清除 UNKNOWN 或自动重发按钮；移除草稿引用也不会删除项目文件。
- 上传请求与配置保存共享原编辑器租约。等待期间不能同时提交另一操作；关闭和切页不提前释放。传输超时不等于底层 fetch/body 已终止，provider 可观察的底层等待终态用于释放租约。服务器是否已完成仍以真实回执/UNKNOWN区分，不承诺客户端取消能回滚后台。

## 验证与剩余

本片使用真实组件 DOM、fake传输和合成图片字节测试，未调用实际上传。最终测试和独立复审记录见 `validation.md`。未验证真实浏览器图像解码/Canvas、原会话、Pillow及双文件保存、Windows路径/并发、真实元数据清理效果；没有启动 GPU 或部署新版页面。

参考裁剪仍是后续独立需求，不能把已有 contain 等比缩放留边当作裁剪。原 jobs/status/candidate 仍缺实际 Studio Python读取闭包；这不阻塞已具备完整原合同的参考上传源码开发。
