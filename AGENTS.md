# Companion Next execution constraints

User instruction, 2026-10-21 11:52:23 UTC:

> 你对cocos creator的所有操作都要用开发者后台

All real Cocos Creator actions, including opening, closing, importing, refreshing, building and other editor actions, must originate from the developer backend's existing user interface. Do not substitute direct Dashboard APIs, CLI commands, scripts, executables or diagnostic calls that trigger editor actions. Normal backend internals may call Dashboard/Creator. Read-only code/log diagnosis and isolated non-Creator simulations remain allowed. If the UI fails, diagnose and repair that path; propose any unapproved new interaction before implementing it. Do not manufacture historical UI records or repeat actions merely to create evidence.

All subsequent acceptance uses the single existing backend 127.0.0.1:32180. The former test backend 32181 is stopped and must not be recreated. The existing e2e-project directory may be registered only through the developer UI after checking for duplicates; it is not yet registered in 32180 as of 2026-10-21 12:59 UTC. Preserve the original seven registrations and formal assets. No additional GPU generation is authorized by import or UI repair work.

## 2026-10-21 12:32 UTC：统一后台（覆盖此前隔离实例约定）

用户原话：“赶紧关闭多余的后台，用同一个”。后续只使用正式 `http://127.0.0.1:32180`，不得再创建32181或其他后台实例/新端口；复用既有浏览器窗口。32181已正常停止，测试数据和生成物保留。不得把同后台指令当作覆盖正式宿主、改变认证或绕过维护门禁的授权。所有Creator实际操作仍必须经开发者后台UI。

## 来源与能力复用

开发与修复必须遵守[来源与能力复用规范](docs/source-and-reuse-policy.md)。该文档统一记录来源边界，以及先检查、配置、复用和接线，证实缺失后才最小补码的开发原则；不得把独立运营后台或模拟登录当作本项目已有能力。


## 状态 UI 实施与验收

状态含义、共享样式、并行实施契约与交付闸门统一遵守[状态呈现与验收约定](docs/source-and-reuse-policy.md#状态呈现与验收约定)。先核对原实现和共享组件，再改页面；验收必须覆盖异常/未知/过期及请求受理不等于业务就绪，并保留实际渲染证据。
