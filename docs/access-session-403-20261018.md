# 普通浏览器403访问恢复（2026-10-18）

状态：Accepted。用户实际打开裸Next地址收到403，优先暂停Preview/Profiler开发处理；本片无产品代码或旧Companion修改。

## 原因与原流程

现有守护进程PID2100，唯一监听127.0.0.1:32180，OPEN。旧运行代码companion-daemon.js:36994–36998先校验Host必须127.0.0.1，然后检查当前creator_ai_session Cookie；未认证返回403/Forbidden。GET入口不要求Origin头，非GET要求同源Origin。此处复现的请求Host正确、没有当前Cookie，因此是会话鉴权拒绝，非静态文件SHA/前端路由缺失。关机后恢复守护进程建立新会话，旧浏览器Cookie不会自动变成当前Cookie。

已有creator-ai ui流程在本地认证客户端中POST /v1/ui/session，打开一次性/auth入口；authenticate以302到/并设HttpOnly、SameSite=Strict、Path=/会话Cookie。未关闭鉴权、未放宽Host/Origin、不新建持久凭据，令牌/Cookie/一次性URL均未输出或保存。

## 恢复与实际验收

执行已有入口：

```powershell
& 'C:/Program Files/nodejs/node.exe' 'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/creator-ai.js' ui --json
```

CLI回执PASSED/opened=true；继而在默认浏览器打开完整Next URL：http://127.0.0.1:32180/next/index.html#/projects 。不关闭原窗口。只读Windows UIAutomation在普通Edge/PID2992核对：Next地址可见、工程列表/连接工程控件可见、Forbidden未见；这份证明来自普通用户窗口，并非独立Playwright窗口。

另以独立Edge、新空白context、真实接口且无业务mock复验：裸入口403/Forbidden，正式/auth响应302，真实新导航Next200，应用外壳1，真实/api/projects、/api/status、/api/calls/counts全部200，页面错误0。PID2100/startupEpoch不变，独立浏览器关闭。初始测试从原403文档只改变hash，浏览器未发新导航，返回null；更正为离开旧文档后真正新导航，通过，不把hash变化误判为新HTTP访问。已认证但旧标签仍显示403时需刷新；服务重启后需再次运行正式ui入口。

证据：C:/Users/33272/AppData/Local/Temp/companion-access-403-20261018/ordinary-window-proof.json（普通窗口）与real-browser-proof.json（独立真实接口），authenticated-real-page.png（独立窗口截图）。无API模拟、安装/客户端配置写入、模型或Creator启动，无新服务监听。当前部署仍a8813ac/.44，本文件检查点不代表新构建。

## 接续目标

Preview/Profiler尚在只读核对阶段，未开始功能改动。旧app.ts:587 Preview动作是POST /api/projects/:id/preview/:name，start传target=browser；:612 Profiler为POST /api/projects/:id/profiler/capture并带web-profiler时间戳operationId。双方都以当前Creator状态ready为前提。后续继续核运行路由及回执合同，只在Next恢复入口，不启动真实Creator或非loopback监听。严格部分安装、五客户端配置只核安全读取路径，不用写接口模拟读取；外部OCR已拒绝，不重试。
