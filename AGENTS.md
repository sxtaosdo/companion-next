# Companion Next execution constraints

User instruction, 2026-10-21 11:52:23 UTC:

> 你对cocos creator的所有操作都要用开发者后台

All real Cocos Creator actions, including opening, closing, importing, refreshing, building and other editor actions, must originate from the developer backend's existing user interface. Do not substitute direct Dashboard APIs, CLI commands, scripts, executables or diagnostic calls that trigger editor actions. Normal backend internals may call Dashboard/Creator. Read-only code/log diagnosis and isolated non-Creator simulations remain allowed. If the UI fails, diagnose and repair that path; propose any unapproved new interaction before implementing it. Do not manufacture historical UI records or repeat actions merely to create evidence.

Current acceptance uses only the already registered isolated test project 16ad921aa0fb06d6 via test backend 127.0.0.1:32181. Production 32180 and formal assets stay unchanged. No additional GPU generation is authorized by import or UI repair work.

## 2026-10-21 12:32 UTC：统一后台（覆盖此前隔离实例约定）

用户原话：“赶紧关闭多余的后台，用同一个”。后续只使用正式 `http://127.0.0.1:32180`，不得再创建32181或其他后台实例/新端口；复用既有浏览器窗口。32181已正常停止，测试数据和生成物保留。不得把同后台指令当作覆盖正式宿主、改变认证或绕过维护门禁的授权。所有Creator实际操作仍必须经开发者后台UI。
