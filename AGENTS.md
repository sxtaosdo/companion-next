# Companion Next execution constraints

User instruction, 2026-10-21 11:52:23 UTC:

> 你对cocos creator的所有操作都要用开发者后台

All real Cocos Creator actions, including opening, closing, importing, refreshing, building and other editor actions, must originate from the developer backend's existing user interface. Do not substitute direct Dashboard APIs, CLI commands, scripts, executables or diagnostic calls that trigger editor actions. Normal backend internals may call Dashboard/Creator. Read-only code/log diagnosis and isolated non-Creator simulations remain allowed. If the UI fails, diagnose and repair that path; propose any unapproved new interaction before implementing it. Do not manufacture historical UI records or repeat actions merely to create evidence.

Current acceptance uses only the already registered isolated test project 16ad921aa0fb06d6 via test backend 127.0.0.1:32181. Production 32180 and formal assets stay unchanged. No additional GPU generation is authorized by import or UI repair work.
