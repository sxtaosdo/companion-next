# Spec Delta

## Purpose

保留普通无引用预设删除，并恢复原有被引用预设删除及关联工程回退全部工具的可见能力。用户必须明确知道受影响工程和范围变化；确认、冲突、未知及来源隔离继续生效，不能把普通删除拒绝自动升级成扩大范围操作。

## ADDED Requirements

### Requirement: Explicit linked impact
系统 SHALL 在删除被引用预设前列明关联工程回退full的影响并取得独立明确确认，随后使用原confirm=true合同。

#### Scenario: Ordinary deletion
- **WHEN** 用户选择普通删除但预设仍被引用
- **THEN** 显示拒绝，不自动改为带确认删除

#### Scenario: Confirmed linked removal
- **WHEN** 用户对当前预设与全部关联工程影响明确确认
- **THEN** 仅按原合同提交一次并回读结果，失败/未知不伪装成功

#### Scenario: Context or transport changes
- **WHEN** 来源/工程/预设改变或原请求仍未结束
- **THEN** 旧确认失效，不自动重发写请求
