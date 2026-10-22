# Spec Delta

## Purpose

恢复已有参考素材准备流程，让用户从实际图片选择范围、保存裁剪结果并查询同一原请求。裁剪使用原确定性cropId和项目上下文，保存结果只是参考素材留证，不代表规范已自动修改，更不代表图像条件已进入模型。

## ADDED Requirements

### Requirement: Source bound crop
系统 SHALL 使用原图片字节、SHA、ROI和当前工程上下文准备并验证裁剪保存回执。

#### Scenario: Valid selection
- **WHEN** 用户确认有效图片范围并请求保存
- **THEN** 调用原裁剪接口并展示校验后的路径和回执，不暗中保存规范

#### Scenario: Invalid region or stale context
- **WHEN** ROI越界、字节或hash无效、工程及来源已改变
- **THEN** 不发出新保存，不将旧结果附到另一工程

### Requirement: Query uncertain crop
系统 MUST 在未确认结果时保留原cropId，仅查询该请求；不得通过关闭重开或切换工程自动重放保存。

#### Scenario: Interrupted save
- **WHEN** 保存超时、取消等待或结果未知
- **THEN** 允许原cropId状态查询，保持未知与失败/成功区分
