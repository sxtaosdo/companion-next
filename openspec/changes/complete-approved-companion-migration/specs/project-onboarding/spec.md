# Spec Delta

## Purpose

在项目安装接入完成后为用户提供绑定该工程身份的使用指引，使用户能够核对目标工程并复制给现有Agent。该指引只描述连接和等待要求，不触发Creator、自动投递或修改工程，且工程或来源改变时不能沿用旧指引。

## ADDED Requirements

### Requirement: Bound completion usage
系统 SHALL 在已确认完成且工程身份已回读时提供当前工程的Agent提示词、换行和复制；身份变化后旧内容 MUST 失效。

#### Scenario: Completed project
- **WHEN** 安装流程完成并已读回同一工程身份
- **THEN** 显示该工程绑定的使用示例并允许复制，不自动发送或执行

#### Scenario: Identity changes
- **WHEN** 工程、任务或提供者来源改变
- **THEN** 不允许继续复制旧工程指引
