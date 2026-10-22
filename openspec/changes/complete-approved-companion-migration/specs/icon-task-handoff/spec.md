# Spec Delta

## Purpose

为图标任务提供原有可核验交接内容，明确任务、候选、素材摘要与目标工程的关系，避免通用文本误代工程绑定合同。交接只准备、展示或复制，不能被解释成导入完成，也不能自动打开Agent或触发Creator业务动作。

## ADDED Requirements

### Requirement: Verified task package
系统 SHALL 核对当前工程、任务版本、来源版本、候选、请求及素材hash和目标后才展示原接口返回的交接包。

#### Scenario: Consistent task
- **WHEN** 同一当前任务和素材的全部绑定与回执一致
- **THEN** 可准备并复制交接内容，且交付状态只表示prepared

#### Scenario: Mismatch or unknown
- **WHEN** 任一身份、hash、目标、来源发生变化或结果未知
- **THEN** 阻止使用旧包，未知不自动重发准备请求

### Requirement: Backend UI action boundary
交接指引 MUST 保留所有Creator实际动作经唯一32180后台UI发起的约束。

#### Scenario: Copy package
- **WHEN** 用户复制交接内容
- **THEN** 只复制，不能发送消息、执行脚本或启动Creator
